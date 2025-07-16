from pydantic import BaseModel
from typing import Optional

class Account(BaseModel):
    id: int
    email: str
    full_name: Optional[str] = None
    status: str
    errorLog: Optional[str] = None

    class Config:
        orm_mode = True
        # Pydantic V2 uses 'from_attributes' instead of 'orm_mode'
        # from_attributes = True 
        # This alias allows pydantic to map the 'error_log' db field to the 'errorLog' model field
        @classmethod
        def from_orm(cls, obj):
            # This is a simple way to handle the alias for older Pydantic versions
            # For Pydantic v2, you'd use Field(alias='error_log')
            data = super().from_orm(obj)
            if hasattr(obj, 'error_log'):
                data.errorLog = obj.error_log
            return data
