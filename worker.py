import asyncio
import re
import aiohttp
from faker import Faker
from sqlalchemy.orm import Session
from datetime import datetime
import json
from urllib.parse import parse_qs, urlparse
import traceback


from database import Account
from temp_mail_client import TempMailClient
from config import TEMP_MAIL_DOMAINS

# Supabase details - ideally these would be in a config file or environment variables
SUPABASE_URL = "https://snksxwkyumhdykyrhhch.supabase.co/auth/v1/signup"
SUPABASE_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNua3N4d2t5dW1oZHlreXJoaGNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQ3NzI2NDYsImV4cCI6MjA0MDM0ODY0Nn0.3unO6zdz2NilPL2xdxt7OjvZA19copj3Q7ulIjPVDLQ"
REDIRECT_TO = "https://app.emergent.sh/activate" # Supabase redirect URL

fake = Faker()

async def signup_and_verify_account(db: Session, temp_mail_client: TempMailClient, sse_queue: asyncio.Queue):
    account = None
    email = "N/A"
    try:
        # 1. Generate email
        username = fake.user_name().lower().replace(".", "") # Ensure username is simple
        domain = fake.random_element(elements=TEMP_MAIL_DOMAINS)
        email_data = await temp_mail_client.generate_email(name=username, domain=domain)
        email = email_data.get("email")
        if not email:
            raise Exception("Failed to generate temporary email")

        # 2. Generate data
        full_name = fake.name()
        password = fake.password(length=12, special_chars=True, digits=True, upper_case=True, lower_case=True)

        # 3. Create new Account record in DB
        account = Account(
            email=email,
            password=password, # Store temporarily, could be removed after verification if not needed
            full_name=full_name,
            status='pending',
            created_at=datetime.utcnow()
        )
        db.add(account)
        db.commit()
        db.refresh(account) # Get the account ID

        # 4. Push SSE update: credentials_generated
        await sse_queue.put(json.dumps({
            "accountId": account.id,
            "email": account.email,
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
            signup_url_with_redirect = f"{SUPABASE_URL}?redirect_to={aiohttp.helpers.quote(REDIRECT_TO)}"

            async with session.post(signup_url_with_redirect, json=signup_payload, headers=headers) as response:
                if not response.ok:
                    error_text = await response.text()
                    raise Exception(f"Supabase signup failed with status {response.status}: {error_text}")

        # 6. Push SSE update: verification_link_sent
        await sse_queue.put(json.dumps({
            "accountId": account.id,
            "email": account.email,
            "status": "verification_link_sent",
            "message": "Signup request sent, waiting for email."
        }))

        # 7. Poll for Email
        polling_timeout = 90 # seconds
        poll_interval = 3 # seconds
        start_time = asyncio.get_event_loop().time()
        verification_link = None

        while asyncio.get_event_loop().time() - start_time < polling_timeout:
            try:
                messages = await temp_mail_client.get_messages(email)
                for message in messages:
                    # Look for the verification link in the email body (adjust regex based on actual email content)
                    match = re.search(r'(https://snksxwkyumhdykyrhhch\.supabase\.co/auth/v1/verify\?token=[^&"\'\s<>]+)', message.get('text', ''))
                    if match:
                        verification_link = match.group(1)
                        break
                if verification_link:
                    break
            except Exception as e:
                print(f"Polling error for {email}: {e}") # Log polling errors but continue trying
            await asyncio.sleep(poll_interval)

        if not verification_link:
            raise Exception("Timed out waiting for verification email")

        # 8. Once email is found, push SSE update: email_received
        await sse_queue.put(json.dumps({
            "accountId": account.id,
            "email": account.email,
            "status": "email_received",
            "message": "Verification email received, verifying account."
        }))
        
        # 9. and 10. Verify Account by making GET request to the link
        async with aiohttp.ClientSession() as session:
            # Crucially, allow_redirects=False to capture the 302 Location header
            async with session.get(verification_link, allow_redirects=False) as response:
                if response.status != 302:
                     error_body = await response.text()
                     raise Exception(f"Verification link did not return 302 redirect. Status: {response.status}. Body: {error_body}")

                redirect_location = response.headers.get('Location')
                if not redirect_location:
                    raise Exception("Verification link did not provide a redirect location")

        # 11. Extract Tokens from the Location header URL fragment
        parsed_url = urlparse(redirect_location)
        if not parsed_url.fragment:
             raise Exception("Redirect URL missing fragment with tokens")

        fragment_params = parse_qs(parsed_url.fragment)
        access_token = fragment_params.get('access_token', [None])[0]
        refresh_token = fragment_params.get('refresh_token', [None])[0]

        if not access_token or not refresh_token:
            raise Exception("Failed to extract access and refresh tokens from redirect URL")


        # 12. Update Account record in DB
        account.status = 'verified'
        account.access_token = access_token
        account.refresh_token = refresh_token
        # Optionally remove password if no longer needed after verification
        account.password = "" # Set to empty string instead of None
        db.commit()


        # 13. Final Push SSE update: verified
        await sse_queue.put(json.dumps({
            "accountId": account.id,
            "email": account.email,
            "status": "verified",
            "message": "Account successfully verified!"
        }))

    except Exception as e:
        error_message = str(e)
        error_trace = traceback.format_exc()
        full_error_log = f"{error_message}\n\nTrace:\n{error_trace}"
        print(f"Error during account signup/verification for email {email}: {full_error_log}")
        
        if account:
            account.status = 'failed'
            account.error_log = full_error_log # Store the full error log
            db.commit()
            await sse_queue.put(json.dumps({
                "accountId": account.id,
                "email": account.email,
                "status": "failed",
                "message": error_message # Send concise message to frontend
            }))
        else:
            # This case handles failure before an account object is even created
            await sse_queue.put(json.dumps({
                 "accountId": -1, # Use a placeholder ID
                 "email": email,
                 "status": "failed",
                 "message": error_message
            }))
    finally:
        # Ensure the database session is closed
        if db:
            db.close()
