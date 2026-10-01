import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.disruption_event import DisruptionEvent
from app.schemas.fairness import FairnessAnalysisRequest
from app.services.audit_service import create_audit_event
from app.services.fairness_service import (
    build_fairness_summary,
    calculate_disruption_impact,
)


router = APIRouter(
    prefix="/fairness",
    tags=["Fairness & Disruption"]
)


@router.post("/analyze")
async def analyze_disruption(
    data: FairnessAnalysisRequest,
    db: Session = Depends(get_db)
):
    existing_event = (
        db.query(DisruptionEvent)
        .filter(
            DisruptionEvent.disruption_id
            == data.disruption_id
        )
        .first()
    )

    if existing_event:
        return {
            "status": "success",
            "message": (
                "Disruption already analyzed"
            ),
            "action": (
                "EXISTING_EVENT_RETURNED"
            ),
            "analysis": {
                "disruption_id": (
                    existing_event.disruption_id
                ),
                "candidate_id": (
                    existing_event.candidate_id
                ),
                "impact_score": (
                    existing_event.impact_score
                ),
                "impact_level": (
                    existing_event.impact_level
                ),
                "recommendation": (
                    existing_event.recommendation
                ),
                "evidence": json.loads(
                    existing_event.evidence
                ),
            },
        }


    (
        impact_score,
        impact_level,
        recommendation,
        evidence
    ) = calculate_disruption_impact(
        duration_ms=data.duration_ms,
        affected_questions=(
            data.affected_questions
        ),
        pending_responses=(
            data.pending_responses
        ),
        recovered_responses=(
            data.recovered_responses
        ),
    )


    event = DisruptionEvent(
        disruption_id=data.disruption_id,
        exam_id=data.exam_id,
        candidate_id=data.candidate_id,
        incident_id=data.incident_id,
        disruption_type=(
            data.disruption_type
        ),
        duration_ms=data.duration_ms,
        affected_questions=(
            data.affected_questions
        ),
        pending_responses=(
            data.pending_responses
        ),
        recovered_responses=(
            data.recovered_responses
        ),
        impact_score=impact_score,
        impact_level=impact_level,
        recommendation=recommendation,
        evidence=json.dumps(
            evidence
        ),
    )

    db.add(event)


    create_audit_event(
        db=db,
        event_type="FAIRNESS_IMPACT_ANALYSIS",
        actor="FAIRNESS_ENGINE",
        entity_type="DISRUPTION_EVENT",
        entity_id=data.disruption_id,
        payload={
            "exam_id": data.exam_id,
            "candidate_id": (
                data.candidate_id
            ),
            "incident_id": data.incident_id,
            "disruption_type": (
                data.disruption_type
            ),
            "duration_ms": (
                data.duration_ms
            ),
            "affected_questions": (
                data.affected_questions
            ),
            "pending_responses": (
                data.pending_responses
            ),
            "recovered_responses": (
                data.recovered_responses
            ),
            "impact_score": (
                impact_score
            ),
            "impact_level": (
                impact_level
            ),
            "recommendation": (
                recommendation
            ),
        },
    )


    db.commit()
    db.refresh(event)


    return {
        "status": "success",
        "message": (
            "Disruption analyzed successfully"
        ),
        "action": (
            "NEW_DISRUPTION_ANALYSIS_CREATED"
        ),
        "analysis": {
            "disruption_id": (
                event.disruption_id
            ),
            "candidate_id": (
                event.candidate_id
            ),
            "incident_id": (
                event.incident_id
            ),
            "disruption_type": (
                event.disruption_type
            ),
            "impact_score": (
                event.impact_score
            ),
            "impact_level": (
                event.impact_level
            ),
            "recommendation": (
                event.recommendation
            ),
            "evidence": evidence,
            "created_at": (
                event.created_at.isoformat()
            ),
        },
    }


@router.get(
    "/candidate/{candidate_id}"
)
async def get_candidate_fairness(
    candidate_id: str,
    db: Session = Depends(get_db)
):
    events = (
        db.query(DisruptionEvent)
        .filter(
            DisruptionEvent.candidate_id
            == candidate_id
        )
        .order_by(
            DisruptionEvent.id.desc()
        )
        .all()
    )


    summary = build_fairness_summary(
        events
    )


    recent_events = []

    for event in events[:20]:
        recent_events.append(
            {
                "disruption_id": (
                    event.disruption_id
                ),
                "incident_id": (
                    event.incident_id
                ),
                "disruption_type": (
                    event.disruption_type
                ),
                "duration_ms": (
                    event.duration_ms
                ),
                "affected_questions": (
                    event.affected_questions
                ),
                "pending_responses": (
                    event.pending_responses
                ),
                "recovered_responses": (
                    event.recovered_responses
                ),
                "impact_score": (
                    event.impact_score
                ),
                "impact_level": (
                    event.impact_level
                ),
                "recommendation": (
                    event.recommendation
                ),
                "evidence": json.loads(
                    event.evidence
                ),
                "created_at": (
                    event.created_at.isoformat()
                ),
            }
        )


    return {
        "status": "success",
        "candidate_id": candidate_id,
        "summary": summary,
        "recent_disruptions": (
            recent_events
        ),
        "policy_note": (
            "Fairness recommendations are "
            "decision-support only. Final exam "
            "actions must be determined by "
            "authorized examination personnel "
            "using exam rules and available evidence."
        ),
        "timestamp": (
            datetime.now(
                timezone.utc
            ).isoformat()
        ),
    }