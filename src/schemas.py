from pydantic import BaseModel
from typing import Optional

class Account(BaseModel):
    id: int
    email: str
    full_name: Optional[str] = None
    status: str
    errorLog: Optional[str] = None

    class Config:
        # Pydantic V2 uses 'from_attributes' instead of 'orm_mode'
        # from_attributes = True is the modern equivalent
        orm_mode = True
