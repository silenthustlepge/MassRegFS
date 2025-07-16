
import requests
import json
import time
import sseclient
from requests.exceptions import ConnectionError, ReadTimeout
import os
from loguru import logger

BASE_URL = "http://127.0.0.1:8000"
SIGNUP_COUNT = 3

def check_server_is_ready():
    """Checks if the FastAPI server is responsive."""
    try:
        # A simple health check endpoint would be better, but this works.
        response = requests.get(f"{BASE_URL}/api/accounts", timeout=2)
        if response.status_code in (200, 404): # 200 OK or 404 Not Found are acceptable initial states
            logger.info("✅ Backend server is up and running.")
            return True
        logger.warning(f"Backend server responded with status: {response.status_code}")
        return False
    except ConnectionError:
        logger.error("❌ Backend server is not running. Please start the server with 'python -m backend.main'.")
        return False
    except ReadTimeout:
        logger.error("❌ Backend server is not responding.")
        return False


def run_test():
    """Runs a full end-to-end test of the account creation workflow."""
    if not check_server_is_ready():
        return

    logger.info(f"🚀 Starting test: Initiating signup for {SIGNUP_COUNT} accounts...")

    # Step 1: Start the signup process
    try:
        start_response = requests.post(f"{BASE_URL}/api/start-signups?count={SIGNUP_COUNT}")
        start_response.raise_for_status()
        logger.info(f"✅ Signup process initiated successfully: {start_response.json()['message']}")
    except Exception as e:
        logger.exception(f"❌ FAILED: Could not start the signup process. Error: {e}")
        return

    # Step 2: Stream progress updates
    verified_accounts = []
    failed_accounts = []
    completed_count = 0
    
    logger.info("🎧 Listening for real-time progress updates...")
    try:
        # Set a generous timeout for the entire streaming process
        response = requests.get(f"{BASE_URL}/api/stream-progress", stream=True, timeout=180)
        client = sseclient.SSEClient(response)

        for event in client.events():
            if not event.data:
                continue
            
            progress = json.loads(event.data)
            status = progress.get('status', 'unknown').upper()
            email = progress.get('email', 'N/A')
            
            if status == 'VERIFIED':
                logger.success(f"📈 Progress: Account {email} is VERIFIED.")
                verified_accounts.append(progress)
                completed_count +=1
            elif status == 'FAILED':
                logger.error(f"📈 Progress: Account {email} FAILED. Reason: {progress.get('message')}")
                failed_accounts.append(progress)
                completed_count += 1
            else:
                 logger.info(f"📈 Progress: Account {email} status is {status}.")

            if completed_count >= SIGNUP_COUNT:
                logger.info("🏁 All tasks accounted for. Closing stream.")
                break
        
        logger.info("✅ Progress stream finished.")
        
    except ReadTimeout:
        logger.error(f"❌ FAILED: Timed out waiting for progress stream to complete after {180} seconds.")
        return
    except Exception as e:
        logger.exception(f"❌ FAILED: An error occurred while streaming progress. Error: {e}")
        return

    # Step 3: Verify results
    logger.info("\n" + "="*50)
    logger.info("📊 Test Summary:")
    logger.info(f"   - Requested Signups: {SIGNUP_COUNT}")
    logger.info(f"   - Verified Accounts: {len(verified_accounts)}")
    logger.info(f"   - Failed Accounts: {len(failed_accounts)}")
    logger.info("="*50 + "\n")

    if len(verified_accounts) + len(failed_accounts) != SIGNUP_COUNT:
        logger.warning("⚠️ The number of completed accounts does not match the requested count.")

    # Step 4: Final verification via API endpoints
    logger.info("🔎 Verifying created accounts via API...")
    try:
        accounts_response = requests.get(f"{BASE_URL}/api/accounts")
        accounts_response.raise_for_status()
        all_accounts = accounts_response.json()
        logger.info(f"✅ Successfully fetched {len(all_accounts)} total accounts from the database.")

        verified_ids_from_api = {acc['id'] for acc in all_accounts if acc['status'] == 'verified'}
        
        for acc in verified_accounts:
            acc_id = acc['accountId']
            if acc_id not in verified_ids_from_api:
                logger.error(f"❌ FAILED: Account ID {acc_id} was reported as VERIFIED in stream, but not in final API call.")
            else:
                 logger.success(f"✅ PASSED: Account ID {acc_id} is verified in the database.")
    
    except Exception as e:
        logger.exception(f"❌ FAILED: Could not get final account list from API. Error: {e}")

    if not failed_accounts and len(verified_accounts) == SIGNUP_COUNT:
        logger.success("\n🎉🎉🎉 ALL TESTS PASSED! The backend appears to be working correctly. 🎉🎉🎉")
    else:
        logger.error("\n🔥🔥🔥 SOME TESTS FAILED. Please review the logs above. 🔥🔥🔥")


if __name__ == "__main__":
    run_test()
