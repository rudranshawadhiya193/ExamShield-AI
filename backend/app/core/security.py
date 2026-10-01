import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Callable

import jwt

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer


SECRET_KEY = os.getenv(
    "EXAMSHIELD_SECRET_KEY",
    "examshield-local-demo-secret-change-in-production"
)

ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = 60

bearer_scheme = HTTPBearer(
    auto_error=False
)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)

    derived_key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        310000
    )

    return (
        salt.hex()
        + "$"
        + derived_key.hex()
    )


def verify_password(
    password: str,
    stored_hash: str
) -> bool:
    try:
        salt_hex, key_hex = stored_hash.split(
            "$",
            1
        )

        salt = bytes.fromhex(
            salt_hex
        )

        expected_key = bytes.fromhex(
            key_hex
        )

        actual_key = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            310000
        )

        return hmac.compare_digest(
            actual_key,
            expected_key
        )

    except (ValueError, TypeError):
        return False


def create_access_token(
    user_id: int,
    username: str,
    role: str
) -> str:
    expires_at = (
        datetime.now(timezone.utc)
        + timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        )
    )

    payload = {
        "sub": str(user_id),
        "username": username,
        "role": role,
        "exp": expires_at
    }

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


def decode_access_token(
    token: str
) -> dict:
    try:
        return jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired"
        )

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token"
        )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    )
):
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    return decode_access_token(
        credentials.credentials
    )


def require_role(
    required_role: str
) -> Callable:

    def role_dependency(
        current_user: dict = Depends(
            get_current_user
        )
    ):
        actual_role = current_user.get(
            "role"
        )

        if actual_role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"{required_role} role is required"
                )
            )

        return current_user

    return role_dependency


def require_admin(
    current_user: dict = Depends(
        get_current_user
    )
):
    if current_user.get("role") != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ADMIN role is required"
        )

    return current_user


def require_candidate(
    current_user: dict = Depends(
        get_current_user
    )
):
    if current_user.get("role") != "CANDIDATE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CANDIDATE role is required"
        )

    return current_user