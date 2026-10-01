from fastapi import Depends, FastAPI

from app.api.routes.anomaly import (
    router as anomaly_router,
)
from app.api.routes.audit import (
    router as audit_router,
)


from fastapi.middleware.cors import CORSMiddleware
from app.api.routes.auth import (
    router as auth_router,
)
from app.api.routes.disruption import (
    router as disruption_router,
)
from app.api.routes.exam import (
    router as exam_router,
)
from app.api.routes.fairness import (
    router as fairness_router,
)
from app.api.routes.health import (
    router as health_router,
)
from app.api.routes.incident import (
    router as incident_router,
)
from app.api.routes.prediction import (
    router as prediction_router,
)
from app.api.routes.proctoring import (
    router as proctoring_router,
)
from app.api.routes.report import (
    router as report_router,
)

from app.core.database import (
    Base,
    engine,
)

from app.core.security import (
    require_admin,
    require_candidate,
)

from app.models.audit_event import (
    AuditEvent,
)
from app.models.behavior_event import (
    BehaviorEvent,
)
from app.models.candidate_response import (
    CandidateResponse,
)
from app.models.disruption_event import (
    DisruptionEvent,
)
from app.models.health_metric import (
    HealthMetric,
)
from app.models.incident import (
    Incident,
)
from app.models.proctoring_event import (
    ProctoringEvent,
)
from app.models.user import (
    User,
)


Base.metadata.create_all(
    bind=engine
)


app = FastAPI(
    title="ExamShield AI",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def seed_demo_users():
    db = SessionLocal()
    try:
        demo_users = [
            {
                "username": "admin",
                "password": "Admin@123",
                "role": "ADMIN",
                "full_name": "ExamShield Administrator",
            },
            {
                "username": "candidate",
                "password": "Candidate@123",
                "role": "CANDIDATE",
                "full_name": "Demo Candidate",
            },
        ]

        for item in demo_users:
            existing = (
                db.query(User)
                .filter(User.username == item["username"])
                .first()
            )

            if existing:
                continue

            db.add(
                User(
                    username=item["username"],
                    password_hash=hash_password(item["password"]),
                    role=item["role"],
                    full_name=item["full_name"],
                    is_active=1,
                )
            )

        db.commit()
    finally:
        db.close()


seed_demo_users()


# ---------------------------------------------------------
# PUBLIC AUTH ROUTES
# ---------------------------------------------------------

app.include_router(
    auth_router
)


# ---------------------------------------------------------
# ADMIN-ONLY ROUTES
# ---------------------------------------------------------

app.include_router(
    health_router,
    dependencies=[
        Depends(require_admin)
    ],
)

app.include_router(
    incident_router,
    dependencies=[
        Depends(require_admin)
    ],
)

app.include_router(
    audit_router,
    dependencies=[
        Depends(require_admin)
    ],
)

app.include_router(
    anomaly_router,
    dependencies=[
        Depends(require_admin)
    ],
)

app.include_router(
    fairness_router,
    dependencies=[
        Depends(require_admin)
    ],
)

app.include_router(
    prediction_router,
    dependencies=[
        Depends(require_admin)
    ],
)

app.include_router(
    report_router,
    dependencies=[
        Depends(require_admin)
    ],
)

app.include_router(
    proctoring_router,
)


# ---------------------------------------------------------
# CANDIDATE-ONLY ROUTES
# ---------------------------------------------------------

app.include_router(
    exam_router,
    dependencies=[
        Depends(require_candidate)
    ],
)

app.include_router(
    disruption_router,
    dependencies=[
        Depends(require_candidate)
    ],
)


# ---------------------------------------------------------
# ROOT
# ---------------------------------------------------------

@app.get("/")
async def root():
    return {
        "message": (
            "ExamShield AI Backend is running"
        ),
        "status": "healthy",
        "version": "1.0.0",
    }