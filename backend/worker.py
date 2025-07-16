
import asyncio
import re
import aiohttp
from faker import Faker
from datetime import datetime
import json
from urllib.parse import parse_qs, urlparse, quote
import traceback

from database import Account, SessionLocal
from temp_mail_client import TempMailClient
from config import TEMP_MAIL_DOMAINS
from logging_config import logger

# Supabase details
SUPABASE_URL = "https://snksxwkyumhdykyrhhch.supabase.co/auth/v1/signup"
SUPABASE_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNua3N4d2t5dW1oZHlreXJoaGNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQ3NzI2NDYsImV4cCI6MjA0MDM0ODY0Nn0.3unO6zdz2NilPL2xdxt7OjvZA19copj3Q7ulIjPVDLQ"
REDIRECT_TO = "https://app.emergent.sh/activate"

fake = Faker()

async def signup_and_verify_account(temp_mail_client: TempMailClient, sse_queue: asyncio.Queue):
    """
    Worker process to sign up and verify a single account.
    This function manages its own database session.
    """
    db = SessionLocal()
    account = None
    email = "N/A"
    full_name = "N/A"
    try:
        # 1. Generate email
        logger.info("Starting new account signup task.")
        username = fake.user_name().lower().replace(".", "")
        domain = fake.random_element(elements=TEMP_MAIL_DOMAINS)
        email_data = await temp_mail_client.generate_email(name=username, domain=domain)
        
        if not email_data or not email_data.get("email"):
            raise Exception("Failed to generate temporary email from API")
        
        email = email_data.get("email")
        logger.info(f"Generated email: {email}")

        # 2. Generate data
        full_name = fake.name()
        password = fake.password(length=12, special_chars=True, digits=True, upper_case=True, lower_case=True)
        logger.debug(f"Generated data for {email}")

        # 3. Create new Account record in DB
        account = Account(
            email=email,
            full_name=full_name, # This was the critical missing piece
            status='pending',
            created_at=datetime.utcnow()
        )
        db.add(account)
        db.commit()
        db.refresh(account)
        logger.info(f"Created initial DB record for {email} with ID: {account.id}")

        # 4. Push SSE update: credentials_generated
        await sse_queue.put(json.dumps({
            "accountId": account.id,
            "email": account.email,
            "full_name": account.full_name,
            "status": "credentials_generated",
            "message": "Credentials generated, starting signup."
        }))

        # 5. Send POST request to Supabase signup endpoint
        async with aiohttp.ClientSession() as session:
            signup_payload = {
                "email": email,
                "password": password,
                "data": {"full_name": full_name}
            }
            headers = {
                "apikey": SUPABASE_API_KEY,
                "Content-Type": "application/json;charset=UTF-8"
            }
            signup_url_with_redirect = f"{SUPABASE_URL}?redirect_to={quote(REDIRECT_TO)}"
            logger.info(f"Posting to Supabase signup for {email}")

            async with session.post(signup_url_with_redirect, json=signup_payload, headers=headers) as response:
                if not response.ok:
                    error_text = await response.text()
                    raise Exception(f"Supabase signup failed with status {response.status}: {error_text}")

        # 6. Push SSE update: verification_link_sent
        await sse_queue.put(json.dumps({
            "accountId": account.id,
            "email": account.email,
            "full_name": account.full_name,
            "status": "verification_link_sent",
            "message": "Signup request sent, waiting for email."
        }))
        logger.info(f"Waiting for verification email for {email}")

        # 7. Poll for Email with more robust polling
        polling_timeout = 180  # Increased to 3 minutes
        poll_interval = 5      # Increased to 5 seconds
        start_time = asyncio.get_event_loop().time()
        verification_link = None
        
        logger.info(f"Starting email polling for {email} with {polling_timeout}s timeout...")

        while asyncio.get_event_loop().time() - start_time < polling_timeout:
            try:
                messages = await temp_mail_client.get_messages(email)
                logger.debug(f"Retrieved {len(messages)} messages for {email}")
                
                for message in messages:
                    message_body = message.get('body', '')
                    message_subject = message.get('subject', '')
                    
                    # Log first few characters of message for debugging
                    logger.debug(f"Message subject: {message_subject[:50]}...")
                    logger.debug(f"Message body preview: {message_body[:100]}...")
                    
                    # Try multiple regex patterns to catch verification links
                    patterns = [
                        r'(https?://[a-zA-Z0-9.-]+\.supabase\.co/auth/v1/verify\?token=[^&"\'\s<>]+)',
                        r'(https://[^/]+/auth/v1/verify\?token=[^&"\'\s<>]+)',
                        r'(https?://[^\s]+/auth/v1/verify[^\s<>"\']+)',
                        r'href="([^"]+)"[^>]*>.*?[Cc]onfirm',  # Look for href with "confirm" text
                        r'<a[^>]+href="([^"]+)"[^>]*>.*?[Cc]onfirm',  # Another pattern for confirmation links
                    ]
                    
                    for pattern in patterns:
                        match = re.search(pattern, message_body)
                        if match:
                            potential_link = match.group(1)
                            
                            # If it's a direct supabase link, use it
                            if 'supabase.co' in potential_link and '/auth/v1/verify' in potential_link:
                                verification_link = potential_link
                                logger.info(f"Found direct verification link for {email}: {verification_link[:50]}...")
                                break
                            # If it's a wrapped redirect link, try to resolve it
                            elif 'http' in potential_link and 'auth/v1/verify' not in potential_link:
                                try:
                                    logger.info(f"Trying to resolve redirect link for {email}: {potential_link[:50]}...")
                                    async with aiohttp.ClientSession() as resolve_session:
                                        async with resolve_session.get(potential_link, allow_redirects=False, timeout=10) as resolve_response:
                                            if resolve_response.status in [301, 302, 303, 307, 308]:
                                                resolved_link = resolve_response.headers.get('Location')
                                                if resolved_link and 'supabase.co' in resolved_link and '/auth/v1/verify' in resolved_link:
                                                    verification_link = resolved_link
                                                    logger.info(f"Resolved verification link for {email}: {verification_link[:50]}...")
                                                    break
                                except Exception as resolve_error:
                                    logger.warning(f"Failed to resolve redirect link for {email}: {resolve_error}")
                            else:
                                # Fallback: assume it's a verification link
                                verification_link = potential_link
                                logger.info(f"Using fallback verification link for {email}: {verification_link[:50]}...")
                                break
                    
                    if verification_link:
                        break
                        
                if verification_link:
                    break
                    
            except Exception as e:
                logger.warning(f"Polling error for {email}: {e}")
                
            # Show progress in logs
            elapsed = asyncio.get_event_loop().time() - start_time
            logger.info(f"Email polling for {email}: {elapsed:.1f}s elapsed, {polling_timeout - elapsed:.1f}s remaining")
            
            await asyncio.sleep(poll_interval)

        if not verification_link:
            raise Exception("Timed out waiting for verification email")

        # 8. Push SSE update: email_received
        await sse_queue.put(json.dumps({
            "accountId": account.id,
            "email": account.email,
            "full_name": account.full_name,
            "status": "email_received",
            "message": "Verification email received, verifying account."
        }))
        logger.info(f"Verifying account for {email}")
        
        # 9. Verify Account by making GET request with retries
        max_retries = 3
        retry_delay = 2
        
        for attempt in range(max_retries):
            try:
                logger.info(f"Verification attempt {attempt + 1}/{max_retries} for {email}")
                
                async with aiohttp.ClientSession() as session:
                    # Add proper headers to mimic a real browser
                    headers = {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Accept-Encoding': 'gzip, deflate',
                        'DNT': '1',
                        'Connection': 'keep-alive',
                        'Upgrade-Insecure-Requests': '1',
                    }
                    
                    async with session.get(verification_link, allow_redirects=False, headers=headers, timeout=30) as response:
                        logger.info(f"Verification response status: {response.status}")
                        
                        if response.status == 302:
                            redirect_location = response.headers.get('Location')
                            if redirect_location:
                                logger.info(f"Successful verification for {email}, redirect: {redirect_location[:100]}...")
                                break
                            else:
                                raise Exception("Verification link did not provide a redirect location")
                        elif response.status == 200:
                            # Some systems return 200 with redirect in body
                            body = await response.text()
                            # Look for redirect in JavaScript or meta tags
                            redirect_match = re.search(r'(?:window\.location\.href|document\.location)\s*=\s*["\']([^"\']+)["\']', body)
                            if not redirect_match:
                                redirect_match = re.search(r'<meta[^>]+http-equiv=["\']refresh["\'][^>]+content=["\'][^;]+;\s*url=([^"\']+)["\']', body)
                            
                            if redirect_match:
                                redirect_location = redirect_match.group(1)
                                logger.info(f"Found redirect in body for {email}: {redirect_location[:100]}...")
                                break
                            else:
                                raise Exception(f"Verification returned 200 but no redirect found. Body: {body[:200]}...")
                        else:
                            error_body = await response.text()
                            raise Exception(f"Verification link returned status {response.status}. Body: {error_body[:200]}...")
                            
            except Exception as e:
                if attempt == max_retries - 1:
                    raise Exception(f"Verification failed after {max_retries} attempts: {str(e)}")
                else:
                    logger.warning(f"Verification attempt {attempt + 1} failed for {email}: {str(e)}, retrying...")
                    await asyncio.sleep(retry_delay)

        # 10. Extract Tokens with enhanced parsing
        logger.info(f"Extracting tokens from redirect URL for {email}")
        parsed_url = urlparse(redirect_location)
        
        access_token = None
        refresh_token = None
        
        # Try extracting from fragment first (most common)
        if parsed_url.fragment:
            fragment_params = parse_qs(parsed_url.fragment)
            access_token = fragment_params.get('access_token', [None])[0]
            refresh_token = fragment_params.get('refresh_token', [None])[0]
            
        # If not found in fragment, try query parameters
        if not access_token and parsed_url.query:
            query_params = parse_qs(parsed_url.query)
            access_token = query_params.get('access_token', [None])[0]
            refresh_token = query_params.get('refresh_token', [None])[0]
            
        # If still not found, try alternative parameter names
        if not access_token and parsed_url.fragment:
            fragment_params = parse_qs(parsed_url.fragment)
            access_token = fragment_params.get('token', [None])[0]  # Some systems use 'token'
            refresh_token = fragment_params.get('refresh', [None])[0]  # Some systems use 'refresh'

        if not access_token or not refresh_token:
            logger.error(f"Token extraction failed for {email}. Redirect URL: {redirect_location}")
            logger.error(f"Fragment: {parsed_url.fragment}")
            logger.error(f"Query: {parsed_url.query}")
            raise Exception(f"Failed to extract access and refresh tokens from redirect URL: {redirect_location}")
            
        logger.info(f"Successfully extracted tokens for {email}")
        logger.debug(f"Access token length: {len(access_token) if access_token else 0}")
        logger.debug(f"Refresh token length: {len(refresh_token) if refresh_token else 0}")

        # 11. Update Account record in DB
        account.status = 'verified'
        account.access_token = access_token
        account.refresh_token = refresh_token
        db.commit()
        logger.info(f"Account for {email} successfully verified and updated in DB.")

        # 12. Final Push SSE update: verified
        await sse_queue.put(json.dumps({
            "accountId": account.id,
            "email": account.email,
            "full_name": account.full_name,
            "status": "verified",
            "message": "Account successfully verified!"
        }))

    except Exception as e:
        error_message = str(e)
        error_trace = traceback.format_exc()
        full_error_log = f"Error: {error_message}\n\nTraceback:\n{error_trace}"
        
        logger.exception(f"Error during account signup/verification for email {email}")
        
        if account and account.id:
            account.status = 'failed'
            account.error_log = full_error_log
            db.commit()
            await sse_queue.put(json.dumps({
                "accountId": account.id,
                "email": account.email,
                "full_name": account.full_name,
                "status": "failed",
                "message": error_message
            }))
        else:
            # Handle cases where the account was never created in the DB
            await sse_queue.put(json.dumps({
                 "accountId": -1, # Use a sentinel value
                 "email": email,
                 "full_name": full_name,
                 "status": "failed",
                 "message": error_message
            }))
    finally:
        if db:
            logger.debug(f"Closing worker db session for account {email}")
            db.close()
