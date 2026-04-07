from pydantic import BaseModel, ConfigDict

class UserCreate(BaseModel):
    name: str
    email: str
    phone: str | None = None
    password: str
    base_income: float | None = None
    income_frequency: str | None = None


class UserLogin(BaseModel):
    email: str
    password: str


class GoogleAuthIn(BaseModel):
    id_token: str


class PasswordResetRequest(BaseModel):
    email: str


class PasswordResetConfirm(BaseModel):
    email: str
    new_password: str


class UserUpdate(BaseModel):
    name: str
    email: str
    phone: str | None = None
    base_income: float | None = None
    income_frequency: str | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: str
    phone: str | None = None
    is_admin: bool
    base_income: float | None = None
    income_frequency: str | None = None


class AuthResponse(BaseModel):
    access_token: str
    user: UserOut


class MessageResponse(BaseModel):
    message: str
