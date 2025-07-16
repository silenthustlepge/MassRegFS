import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite:///./accounts.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    full_name = Column(String)
    status = Column(String, default="pending")
    access_token = Column(Text)
    refresh_token = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

# Function to create tables
def create_db_tables():
    Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    # This part is optional and can be used to create the database file if you run this script directly
    create_db_tables()
    print("Database tables created.")