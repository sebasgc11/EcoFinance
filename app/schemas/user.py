from pydantic import BaseModel, ConfigDict

class UserCreate(BaseModel):
    name: str
    email: str
    phone: str | None = None
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class GoogleAuthIn(BaseModel):
    id_token: str


class UserUpdate(BaseModel):
    name: str
    email: str
    phone: str | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: str
    phone: str | None = None
    is_admin: bool


class AuthResponse(BaseModel):
    access_token: str
    user: UserOut
