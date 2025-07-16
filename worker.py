import asyncio
import re
import aiohttp
from faker import Faker
from sqlalchemy.orm import Session
from datetime import datetime
import json
from urllib.parse import parse_qs, urlparse

from .database import Account
from .temp_mail_client import TempMailClient
from .config import TEMP_MAIL_DOMAINS

# Supabase details - ideally these would be in a config file or environment variables
SUPABASE_URL = "https://snksxwkyumhdykyrhhch.supabase.co/auth/v1/signup"
SUPABASE_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNua3N4d2t5dW1oZHlreXJoaGNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQ3NzI2NDYsImV4cCI6MjA0MDM0ODY0Nn0.3unO6zdz2NilPL2xdxt7OjvZA19copj3Q7ulIjPVDLQ"
REDIRECT_TO = "https://app.emergent.sh/activate" # Supabase redirect URL

fake = Faker()

async def signup_and_verify_account(db: Session, temp_mail_client: TempMailClient, sse_queue: asyncio.Queue):
    account = None
    try:
        # 1. Generate email
        email_data = await temp_mail_client.generate_email(name=fake.user_name().lower(), domain=fake.random_element(elements=TEMP_MAIL_DOMAINS))
        account_name = email_data.get("email", "").split("@")[0] # Extract name before @
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
            full_name=account_name, # Use the extracted name
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
                response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)

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
            messages = await temp_mail_client.get_messages(email)
            for message in messages:
                # Look for the verification link in the email body (adjust regex based on actual email content)
                match = re.search(r'(https:\/\/snksxwkyumhdykyrhhch\.supabase\.co\/auth\/v1\/verify\?token=[^&]+&type=signup&redirect_to=[^"]+)', message.get('text', ''))
                if match:
                    verification_link = match.group(1)
                    break
            if verification_link:
                break
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
                     raise Exception(f"Verification link did not return 302 redirect. Status: {response.status}")

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
        account.password = None
        db.commit()


        # 13. Final Push SSE update: verified
        await sse_queue.put(json.dumps({
            "accountId": account.id,
            "email": account.email,
            "status": "verified",
            "message": "Account successfully verified!"
        }))

    except Exception as e:
        print(f"Error during account signup/verification for account ID {account.id if account else 'N/A'}: {e}")
        if account and account.status != 'verified':
            account.status = 'failed'
            # Optionally store error message in DB
            db.commit()
        if account:
            await sse_queue.put(json.dumps({
                "accountId": account.id,
                "email": account.email,
                "status": "failed",
                "message": f"Signup/Verification failed: {e}"
            }))
        else:
            await sse_queue.put(json.dumps({
                 "accountId": "N/A",
                 "email": email if 'email' in locals() else 'N/A',
                 "status": "failed",
                 "message": f"Signup/Verification failed: {e}"
            }))
    finally:
        # Ensure the database session is closed in the calling context (e.g., FastAPI dependency)
        pass
