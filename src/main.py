import asyncio
import json
from typing import List, Optional

from fastapi import FastAPI, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import select
from fastapi.middleware.cors import CORSMiddleware

from database import SessionLocal, engine, Account, Base
from worker import signup_and_verify_account
from temp_mail_client import TempMailClient
from config import TEMP_MAIL_API_BASE_URL, TEMP_MAIL_DOMAINS
from schemas import Account as AccountSchema # Import pydantic schema

# Initialize database tables
Base.metadata.create_all(bind=engine)

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)


# Initialize TempMailClient
temp_mail_client = TempMailClient(base_url=TEMP_MAIL_API_BASE_URL)

# Queue for Server-Sent Events
progress_queue = asyncio.Queue()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def send_progress_update(data: dict):
    """Pushes a progress update to the SSE queue."""
    await progress_queue.put(json.dumps(data))

@app.post("/api/start-signups")
async def start_signups(count: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Initiates the mass account signup process."""
    async def run_signups():
        for _ in range(count):
            # Get a new DB session for each worker task
            db_session = SessionLocal()
            try:
                background_tasks.add_task(signup_and_verify_account, db_session, temp_mail_client, progress_queue)
                # Give a slight delay between starting tasks to avoid overwhelming
                await asyncio.sleep(0.1) # Adjust as needed
            finally:
                # The worker task is responsible for closing the session
                pass


    background_tasks.add_task(run_signups)

    return {"message": f"Initiated signup process for {count} accounts."}

@app.get("/api/stream-progress")
async def stream_progress():
    """Streams real-time signup progress updates via Server-Sent Events."""
    async def event_generator():
        while True:
            try:
                # Wait for a new item in the queue
                message = await progress_queue.get()
                yield f"data: {message}\n\n"
                progress_queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Error in SSE generator: {e}")
                yield f"data: {json.dumps({'status': 'error', 'message': str(e)})}\n\n"
                await asyncio.sleep(1) # Prevent tight loop on errors

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/api/accounts", response_model=List[AccountSchema])
def get_all_accounts(db: Session = Depends(get_db)):
    """Fetches all accounts from the database."""
    accounts = db.execute(
        select(
            Account.id,
            Account.email,
            Account.full_name,
            Account.status,
            Account.error_log.label("errorLog")  # Alias error_log to errorLog
        )
    ).mappings().all() # Use .mappings().all() to get a list of dicts
    return accounts


@app.get("/api/account/{account_id}/login-details")
def get_account_login_details(account_id: int, db: Session = Depends(get_db)):
    """Fetches login tokens for a specific account."""
    account = db.execute(
        select(Account.access_token, Account.refresh_token, Account.status)
        .where(Account.id == account_id)
    ).first()

    if account and account.access_token and account.status == 'verified':
        return {"access_token": account.access_token, "refresh_token": account.refresh_token}
    else:
        raise HTTPException(status_code=404, detail="Account not found or not verified.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
