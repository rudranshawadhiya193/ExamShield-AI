from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(
        min_length=3,
        max_length=100
    )

    password: str = Field(
        min_length=3,
        max_length=200
    )


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    expires_in_seconds: int


class UserResponse(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    is_active: bool