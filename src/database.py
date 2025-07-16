import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.orm import sessionmaker
import os

DATABASE_FILE = "accounts.db"
DATABASE_URL = f"sqlite:///./{DATABASE_FILE}"

# THIS IS A TEMPORARY FIX to ensure the database is always up to date.
# In a real production scenario, you would use a migration tool like Alembic.
if os.path.exists(DATABASE_FILE):
    os.remove(DATABASE_FILE)


engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=True)
    status = Column(String, default="pending")
    access_token = Column(Text, nullable=True)
    refresh_token = Column(Text, nullable=True)
    error_log = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

# Function to create tables
def create_db_tables():
    """Creates the database tables if they don't exist."""
    Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    create_db_tables()
    print("Database tables created.")
