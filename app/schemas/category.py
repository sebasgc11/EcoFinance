from pydantic import BaseModel, ConfigDict

class CategoryCreate(BaseModel):
    name: str

class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    is_default: bool
    is_active: bool
