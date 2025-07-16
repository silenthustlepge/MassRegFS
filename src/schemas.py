from pydantic import BaseModel
from typing import Optional

class Account(BaseModel):
    id: int
    email: str
    full_name: Optional[str] = None
    status: str
    errorLog: Optional[str] = None
