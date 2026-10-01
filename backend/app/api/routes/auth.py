from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    TokenResponse,
    UserResponse,
)


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


@router.post(
    "/login",
    response_model=TokenResponse
)
async def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    user = (
        db.query(User)
        .filter(
            User.username
            == login_data.username
        )
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="User account is inactive"
        )

    if not verify_password(
        login_data.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )

    access_token = create_access_token(
        user_id=user.id,
        username=user.username,
        role=user.role
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in_seconds": (
            ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
    }


@router.get(
    "/me",
    response_model=UserResponse
)
async def get_me(
    current_user: dict = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db)
):
    user_id = int(
        current_user["sub"]
    )

    user = (
        db.query(User)
        .filter(
            User.id == user_id
        )
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role,
        "is_active": bool(
            user.is_active
        )
    }


@router.post(
    "/seed-demo-users"
)
async def seed_demo_users(
    db: Session = Depends(get_db)
):
    demo_users = [
        {
            "username": "admin",
            "password": "Admin@123",
            "role": "ADMIN",
            "full_name": "ExamShield Administrator"
        },
        {
            "username": "candidate",
            "password": "Candidate@123",
            "role": "CANDIDATE",
            "full_name": "Demo Candidate"
        }
    ]

    created_users = []

    for demo_user in demo_users:
        existing = (
            db.query(User)
            .filter(
                User.username
                == demo_user["username"]
            )
            .first()
        )

        if existing:
            continue

        user = User(
            username=demo_user["username"],
            password_hash=hash_password(
                demo_user["password"]
            ),
            role=demo_user["role"],
            full_name=demo_user["full_name"],
            is_active=1,
            created_at=datetime.utcnow()
        )

        db.add(user)
        created_users.append(
            demo_user["username"]
        )

    if created_users:
        db.commit()

    return {
        "status": "success",
        "message": "Demo users initialized",
        "created_users": created_users,
        "demo_accounts": [
            {
                "username": "admin",
                "password": "Admin@123",
                "role": "ADMIN"
            },
            {
                "username": "candidate",
                "password": "Candidate@123",
                "role": "CANDIDATE"
            }
        ],
        "timestamp": (
            datetime.now(
                timezone.utc
            ).isoformat()
        )
    }