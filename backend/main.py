
import asyncio
import json
from typing import List, Optional

from fastapi import FastAPI, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import select
from fastapi.middleware.cors import CORSMiddleware

from database import SessionLocal, engine, Account, create_db_tables
from worker import signup_and_verify_account
from temp_mail_client import TempMailClient
from config import TEMP_MAIL_API_BASE_URL
from schemas import Account as AccountSchema
from logging_config import logger # Import the configured logger

# Initialize database tables on startup
create_db_tables()

app = FastAPI()

# Add a middleware to log all requests
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Request: {request.method} {request.url}")
    try:
        response = await call_next(request)
        logger.info(f"Response: {response.status_code}")
        return response
    except Exception as e:
        logger.exception("An unhandled exception occurred during a request.")
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal Server Error"}
        )

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins, including the Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)


# Initialize TempMailClient
temp_mail_client = TempMailClient(base_url=TEMP_MAIL_API_BASE_URL)

# Queue for Server-Sent Events
progress_queue = asyncio.Queue()

def get_db():
    logger.debug("Creating new database session for request.")
    db = SessionLocal()
    try:
        yield db
    finally:
        logger.debug("Closing database session for request.")
        db.close()

@app.post("/api/start-signups")
async def start_signups(count: int, background_tasks: BackgroundTasks):
    """Initiates the mass account signup process."""
    logger.info(f"Received request to start signup for {count} accounts.")
    async def run_signups():
        for i in range(count):
            logger.info(f"Scheduling signup task {i+1}/{count}")
            # The worker is now responsible for its own DB session.
            background_tasks.add_task(signup_and_verify_account, temp_mail_client, progress_queue)
            # Add longer delay between account creation to avoid overwhelming services
            await asyncio.sleep(5)  # Increased from 0.1 to 5 seconds


    background_tasks.add_task(run_signups)

    return {"message": f"Initiated signup process for {count} accounts."}

@app.get("/api/stream-progress")
async def stream_progress():
    """Streams real-time signup progress updates via Server-Sent Events."""
    logger.info("Client connected to progress stream.")
    async def event_generator():
        while True:
            try:
                message = await progress_queue.get()
                yield f"data: {message}\n\n"
                progress_queue.task_done()
            except asyncio.CancelledError:
                logger.warning("Progress stream cancelled by client.")
                break
            except Exception as e:
                logger.exception("Error in SSE generator.")
                yield f"data: {json.dumps({'status': 'error', 'message': str(e)})}\n\n"
                await asyncio.sleep(1) 

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/api/accounts", response_model=List[AccountSchema])
def get_all_accounts(db: Session = Depends(get_db)):
    """Fetches all accounts from the database."""
    try:
        logger.info("Fetching all accounts from the database.")
        # The frontend sorts the data, no need to sort here.
        results = db.query(Account).all()
        logger.info(f"Successfully fetched {len(results)} accounts.")
        return results
    except Exception as e:
        logger.exception("Failed to fetch accounts from database.")
        raise HTTPException(status_code=500, detail="Database query for accounts failed.")


@app.get("/api/account/{account_id}/login-details")
def get_account_login_details(account_id: int, db: Session = Depends(get_db)):
    """Fetches login tokens for a specific account."""
    logger.info(f"Fetching login details for account_id: {account_id}")
    try:
        account = db.query(Account).filter(Account.id == account_id).first()

        if not account:
            logger.warning(f"Account not found for id: {account_id}")
            raise HTTPException(status_code=404, detail="Account not found.")

        if account.status != 'verified' or not account.access_token:
            logger.warning(f"Attempted to get login details for non-verified account id: {account_id}")
            raise HTTPException(status_code=400, detail="Account not verified or tokens not available.")

        logger.info(f"Successfully fetched login details for account id: {account_id}")
        return {"access_token": account.access_token, "refresh_token": account.refresh_token}

    except Exception as e:
        logger.exception(f"Error fetching login details for account {account_id}")
        if not isinstance(e, HTTPException):
            raise HTTPException(status_code=500, detail="Failed to fetch login details.")
        raise e


if __name__ == "__main__":
    import uvicorn
    logger.info("Starting Uvicorn server.")
    uvicorn.run(app, host="0.0.0.0", port=8000)
