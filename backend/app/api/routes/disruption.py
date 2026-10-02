import json

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_candidate
from app.models.disruption_event import DisruptionEvent
from app.models.incident import Incident
from app.services.audit_service import create_audit_event
from app.services.fairness_service import calculate_disruption_impact


class NetworkDisruptionCreate(BaseModel):
    exam_id: str


class NetworkDisruptionResolve(BaseModel):
    exam_id: str = "EXAM-DEMO-001"
    affected_questions: int = 0
    pending_responses: int = 0
    recovered_responses: int = 0


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
    resolve_data: NetworkDisruptionResolve | None = None,
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
        existing_event = (
            db.query(DisruptionEvent)
            .filter(
                DisruptionEvent.incident_id == incident.id
            )
            .first()
        )

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
            "fairness": (
                {
                    "disruption_id": existing_event.disruption_id,
                    "impact_score": existing_event.impact_score,
                    "impact_level": existing_event.impact_level,
                    "affected_questions": existing_event.affected_questions,
                    "pending_responses": existing_event.pending_responses,
                    "recovered_responses": existing_event.recovered_responses,
                }
                if existing_event
                else None
            ),
        }

    incident.status = "RESOLVED"
    incident.resolved_at = datetime.now(
        timezone.utc
    ).replace(tzinfo=None)

    resolve_data = (
        resolve_data
        or NetworkDisruptionResolve()
    )

    duration_ms = 0
    if incident.created_at:
        duration_ms = max(
            0,
            int(
                (
                    incident.resolved_at
                    - incident.created_at
                ).total_seconds()
                * 1000
            )
        )

    duration_ms = min(
        duration_ms,
        86400000
    )

    disruption_id = (
        f"DISRUPTION-INCIDENT-{incident.id}"
    )

    (
        impact_score,
        impact_level,
        recommendation,
        evidence,
    ) = calculate_disruption_impact(
        duration_ms=duration_ms,
        affected_questions=max(
            0,
            resolve_data.affected_questions
        ),
        pending_responses=max(
            0,
            resolve_data.pending_responses
        ),
        recovered_responses=max(
            0,
            resolve_data.recovered_responses
        ),
    )

    fairness_event = (
        db.query(DisruptionEvent)
        .filter(
            DisruptionEvent.disruption_id
            == disruption_id
        )
        .first()
    )

    if not fairness_event:
        fairness_event = DisruptionEvent(
            disruption_id=disruption_id,
            exam_id=(
                resolve_data.exam_id
                or "EXAM-DEMO-001"
            ),
            candidate_id=DEMO_CANDIDATE_ID,
            incident_id=incident.id,
            disruption_type="NETWORK_FAILURE",
            duration_ms=duration_ms,
            affected_questions=max(
                0,
                resolve_data.affected_questions
            ),
            pending_responses=max(
                0,
                resolve_data.pending_responses
            ),
            recovered_responses=max(
                0,
                resolve_data.recovered_responses
            ),
            impact_score=impact_score,
            impact_level=impact_level,
            recommendation=recommendation,
            evidence=json.dumps(evidence),
        )

        db.add(fairness_event)

        create_audit_event(
            db=db,
            event_type="FAIRNESS_IMPACT_ANALYSIS",
            actor="FAIRNESS_ENGINE",
            entity_type="DISRUPTION_EVENT",
            entity_id=disruption_id,
            payload={
                "incident_id": incident.id,
                "candidate_id": DEMO_CANDIDATE_ID,
                "duration_ms": duration_ms,
                "affected_questions": max(
                    0,
                    resolve_data.affected_questions
                ),
                "pending_responses": max(
                    0,
                    resolve_data.pending_responses
                ),
                "recovered_responses": max(
                    0,
                    resolve_data.recovered_responses
                ),
                "impact_score": impact_score,
                "impact_level": impact_level,
                "recommendation": recommendation,
            },
        )

    db.commit()
    db.refresh(incident)
    db.refresh(fairness_event)

    return {
        "status": "success",
        "message": (
            "Candidate network disruption "
            "resolved successfully"
        ),
        "fairness": {
            "disruption_id": fairness_event.disruption_id,
            "impact_score": fairness_event.impact_score,
            "impact_level": fairness_event.impact_level,
            "affected_questions": (
                fairness_event.affected_questions
            ),
            "pending_responses": (
                fairness_event.pending_responses
            ),
            "recovered_responses": (
                fairness_event.recovered_responses
            ),
            "recommendation": (
                fairness_event.recommendation
            ),
            "evidence": evidence,
        },
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
        "fairness": {
            "disruption_id": fairness_event.disruption_id,
            "impact_score": fairness_event.impact_score,
            "impact_level": fairness_event.impact_level,
            "affected_questions": (
                fairness_event.affected_questions
            ),
            "pending_responses": (
                fairness_event.pending_responses
            ),
            "recovered_responses": (
                fairness_event.recovered_responses
            ),
            "recommendation": (
                fairness_event.recommendation
            ),
            "evidence": evidence,
        },
    }