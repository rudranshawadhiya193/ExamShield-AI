from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.incident import Incident
from app.schemas.incident import IncidentCreate


router = APIRouter(
    prefix="/incidents",
    tags=["Incident Management"]
)


@router.get("/")
async def get_incidents(db: Session = Depends(get_db)):
    incidents = (
        db.query(Incident)
        .order_by(Incident.id.desc())
        .all()
    )

    return {
        "status": "success",
        "total_incidents": len(incidents),
        "incidents": [
            {
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
            }
            for incident in incidents
        ],
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/summary")
async def get_incident_summary(
    db: Session = Depends(get_db)
):
    total_incidents = db.query(Incident).count()

    open_incidents = (
        db.query(Incident)
        .filter(Incident.status == "OPEN")
        .count()
    )

    resolved_incidents = (
        db.query(Incident)
        .filter(Incident.status == "RESOLVED")
        .count()
    )

    critical_incidents = (
        db.query(Incident)
        .filter(Incident.severity == "CRITICAL")
        .count()
    )

    high_incidents = (
        db.query(Incident)
        .filter(Incident.severity == "HIGH")
        .count()
    )

    warning_incidents = (
        db.query(Incident)
        .filter(Incident.severity == "WARNING")
        .count()
    )

    low_incidents = (
        db.query(Incident)
        .filter(Incident.severity == "LOW")
        .count()
    )

    open_critical_incidents = (
        db.query(Incident)
        .filter(
            Incident.status == "OPEN",
            Incident.severity == "CRITICAL"
        )
        .count()
    )

    severity_results = (
        db.query(
            Incident.severity,
            func.count(Incident.id)
        )
        .group_by(Incident.severity)
        .all()
    )

    type_results = (
        db.query(
            Incident.type,
            func.count(Incident.id)
        )
        .group_by(Incident.type)
        .all()
    )

    severity_breakdown = {
        severity: count
        for severity, count in severity_results
    }

    type_breakdown = {
        incident_type: count
        for incident_type, count in type_results
    }

    return {
        "status": "success",
        "summary": {
            "total_incidents": total_incidents,
            "open_incidents": open_incidents,
            "resolved_incidents": resolved_incidents,
            "critical_incidents": critical_incidents,
            "high_incidents": high_incidents,
            "warning_incidents": warning_incidents,
            "low_incidents": low_incidents,
            "open_critical_incidents": open_critical_incidents,
        },
        "severity_breakdown": severity_breakdown,
        "type_breakdown": type_breakdown,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.post("/")
async def create_incident(
    incident_data: IncidentCreate,
    db: Session = Depends(get_db)
):
    incident = Incident(
        type=incident_data.type,
        severity=incident_data.severity,
        message=incident_data.message
    )

    db.add(incident)
    db.commit()
    db.refresh(incident)

    return {
        "status": "success",
        "message": "Incident created successfully",
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
        }
    }


@router.patch("/{incident_id}/resolve")
async def resolve_incident(
    incident_id: int,
    db: Session = Depends(get_db)
):
    incident = (
        db.query(Incident)
        .filter(Incident.id == incident_id)
        .first()
    )

    if not incident:
        raise HTTPException(
            status_code=404,
            detail="Incident not found"
        )

    if incident.status == "RESOLVED":
        return {
            "status": "success",
            "message": "Incident is already resolved",
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
            }
        }

    incident.status = "RESOLVED"
    incident.resolved_at = datetime.now(timezone.utc).replace(
        tzinfo=None
    )

    db.commit()
    db.refresh(incident)

    return {
        "status": "success",
        "message": "Incident resolved successfully",
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
        }
    }