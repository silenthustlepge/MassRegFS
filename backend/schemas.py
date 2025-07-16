
from pydantic import BaseModel
from typing import Optional

# This Pydantic model is used for API response validation.
# It ensures that the data sent to the frontend matches this structure.
class Account(BaseModel):
    id: int
    email: str
    full_name: Optional[str] = None
    status: str
    errorLog: Optional[str] = None

    class Config:
        from_attributes = True # Changed from orm_mode for Pydantic v2
