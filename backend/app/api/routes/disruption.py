from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_candidate
from app.models.incident import Incident


class NetworkDisruptionCreate(BaseModel):
    exam_id: str


router = APIRouter(
    prefix="/candidate-disruptions",
    tags=["Candidate Disruptions"],
)


DEMO_CANDIDATE_ID = "CANDIDATE-001"


@router.post("/network")
async def create_network_disruption(
    disruption_data: NetworkDisruptionCreate,
    db: Session = Depends(get_db),
    _: object = Depends(require_candidate),
):
    existing = (
        db.query(Incident)
        .filter(
            Incident.type == "NETWORK_FAILURE",
            Incident.severity == "HIGH",
            Incident.status == "OPEN",
            Incident.message.like(
                f"Candidate {DEMO_CANDIDATE_ID} "
                f"connection lost during examination "
                f"{disruption_data.exam_id}.%"
            ),
        )
        .order_by(Incident.id.desc())
        .first()
    )

    if existing:
        return {
            "status": "success",
            "message": (
                "Existing network disruption incident "
                "is already open"
            ),
            "incident": {
                "id": existing.id,
                "type": existing.type,
                "severity": existing.severity,
                "message": existing.message,
                "status": existing.status,
                "created_at": (
                    existing.created_at.isoformat()
                    if existing.created_at
                    else None
                ),
                "resolved_at": (
                    existing.resolved_at.isoformat()
                    if existing.resolved_at
                    else None
                ),
            },
        }

    incident = Incident(
        type="NETWORK_FAILURE",
        severity="HIGH",
        message=(
            f"Candidate {DEMO_CANDIDATE_ID} "
            f"connection lost during examination "
            f"{disruption_data.exam_id}. "
            "Responses moved to encrypted "
            "offline buffering."
        ),
        status="OPEN",
    )

    db.add(incident)
    db.commit()
    db.refresh(incident)

    return {
        "status": "success",
        "message": (
            "Candidate network disruption "
            "registered successfully"
        ),
        "incident": {
            "id": incident.id,
            "type": incident.type,
            "severity": incident.severity,
            "message": incident.message,
            "status": incident.status,
            "created_at": (
                incident.created_at.isoformat()
                if incident.created_at
                else None
            ),
            "resolved_at": (
                incident.resolved_at.isoformat()
                if incident.resolved_at
                else None
            ),
        },
    }


@router.patch("/network/{incident_id}/resolve")
async def resolve_network_disruption(
    incident_id: int,
    db: Session = Depends(get_db),
    _: object = Depends(require_candidate),
):
    incident = (
        db.query(Incident)
        .filter(
            Incident.id == incident_id,
            Incident.type == "NETWORK_FAILURE",
            Incident.message.like(
                f"Candidate {DEMO_CANDIDATE_ID} "
                "connection lost during examination %.%"
            ),
        )
        .first()
    )

    if not incident:
        raise HTTPException(
            status_code=404,
            detail=(
                "Candidate network disruption "
                "incident not found"
            ),
        )

    if incident.status == "RESOLVED":
        return {
            "status": "success",
            "message": (
                "Network disruption incident "
                "is already resolved"
            ),
            "incident": {
                "id": incident.id,
                "type": incident.type,
                "severity": incident.severity,
                "message": incident.message,
                "status": incident.status,
                "created_at": (
                    incident.created_at.isoformat()
                    if incident.created_at
                    else None
                ),
                "resolved_at": (
                    incident.resolved_at.isoformat()
                    if incident.resolved_at
                    else None
                ),
            },
        }

    incident.status = "RESOLVED"
    incident.resolved_at = datetime.now(
        timezone.utc
    ).replace(tzinfo=None)

    db.commit()
    db.refresh(incident)

    return {
        "status": "success",
        "message": (
            "Candidate network disruption "
            "resolved successfully"
        ),
        "incident": {
            "id": incident.id,
            "type": incident.type,
            "severity": incident.severity,
            "message": incident.message,
            "status": incident.status,
            "created_at": (
                incident.created_at.isoformat()
                if incident.created_at
                else None
            ),
            "resolved_at": (
                incident.resolved_at.isoformat()
                if incident.resolved_at
                else None
            ),
        },
    }