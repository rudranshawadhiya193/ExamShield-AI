from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_admin, require_candidate
from app.models.proctoring_event import ProctoringEvent


router = APIRouter(
    prefix="/proctoring",
    tags=["AI Proctoring"],
)


class ProctoringEventCreate(BaseModel):
    event_id: str
    candidate_id: str
    exam_id: str
    event_type: str
    severity: str
    message: str


@router.post("/events")
async def create_proctoring_event(
    event_data: ProctoringEventCreate,
    db: Session = Depends(get_db),
    _: object = Depends(require_candidate),
):
    if event_data.severity not in {"LOW", "MEDIUM", "HIGH"}:
        raise HTTPException(
            status_code=400,
            detail="Invalid proctoring severity.",
        )

    existing = (
        db.query(ProctoringEvent)
        .filter(
            ProctoringEvent.event_id
            == event_data.event_id
        )
        .first()
    )

    if existing:
        return {
            "status": "success",
            "message": "Proctoring event already recorded.",
            "event": serialize_event(existing),
        }

    event = ProctoringEvent(
        event_id=event_data.event_id,
        candidate_id=event_data.candidate_id,
        exam_id=event_data.exam_id,
        event_type=event_data.event_type,
        severity=event_data.severity,
        message=event_data.message,
    )

    db.add(event)
    db.commit()
    db.refresh(event)

    return {
        "status": "success",
        "message": "Proctoring event recorded.",
        "event": serialize_event(event),
    }


@router.get("/events/{candidate_id}")
async def get_candidate_proctoring_events(
    candidate_id: str,
    db: Session = Depends(get_db),
    _: object = Depends(require_admin),
):
    events = (
        db.query(ProctoringEvent)
        .filter(
            ProctoringEvent.candidate_id
            == candidate_id
        )
        .order_by(
            ProctoringEvent.created_at.desc()
        )
        .limit(100)
        .all()
    )

    return {
        "status": "success",
        "candidate_id": candidate_id,
        "total": len(events),
        "events": [
            serialize_event(event)
            for event in events
        ],
        "timestamp": datetime.utcnow().isoformat(),
    }


def serialize_event(event: ProctoringEvent) -> dict:
    return {
        "id": event.event_id,
        "candidate_id": event.candidate_id,
        "exam_id": event.exam_id,
        "type": event.event_type,
        "severity": event.severity,
        "message": event.message,
        "time": (
            event.created_at.isoformat()
            if event.created_at
            else None
        ),
    }
