from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.audit_event import AuditEvent
from app.services.audit_service import verify_audit_chain


router = APIRouter(
    prefix="/audit",
    tags=["Audit & Trust"]
)


@router.get("/events")
async def get_audit_events(
    db: Session = Depends(get_db)
):
    events = (
        db.query(AuditEvent)
        .order_by(AuditEvent.id.desc())
        .all()
    )

    return {
        "status": "success",
        "total_events": len(events),
        "events": [
            {
                "id": event.id,
                "event_type": event.event_type,
                "actor": event.actor,
                "entity_type": event.entity_type,
                "entity_id": event.entity_id,
                "payload": event.payload,
                "previous_hash": event.previous_hash,
                "event_hash": event.event_hash,
                "created_at": (
                    event.created_at.isoformat()
                    if event.created_at
                    else None
                ),
            }
            for event in events
        ],
        "timestamp": (
            datetime.now(timezone.utc).isoformat()
        )
    }


@router.get("/verify")
async def verify_audit(
    db: Session = Depends(get_db)
):
    verification = verify_audit_chain(db)

    return {
        "status": "success",
        "audit_verification": verification,
        "timestamp": (
            datetime.now(timezone.utc).isoformat()
        )
    }