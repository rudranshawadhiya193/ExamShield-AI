import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.behavior_event import BehaviorEvent
from app.schemas.anomaly import AnomalyAnalysisRequest
from app.services.anomaly_service import (
    build_candidate_summary,
    calculate_behavior_risk,
)
from app.services.audit_service import create_audit_event


router = APIRouter(
    prefix="/anomaly",
    tags=["AI Anomaly Detection"]
)


@router.post("/analyze")
async def analyze_behavior(
    data: AnomalyAnalysisRequest,
    db: Session = Depends(get_db)
):
    existing_event = (
        db.query(BehaviorEvent)
        .filter(
            BehaviorEvent.event_id
            == data.event_id
        )
        .first()
    )

    if existing_event:
        return {
            "status": "success",
            "message": (
                "Behavior event already analyzed"
            ),
            "action": "EXISTING_EVENT_RETURNED",
            "analysis": {
                "event_id": (
                    existing_event.event_id
                ),
                "candidate_id": (
                    existing_event.candidate_id
                ),
                "question_id": (
                    existing_event.question_id
                ),
                "risk_score": (
                    existing_event.risk_score
                ),
                "risk_level": (
                    existing_event.risk_level
                ),
                "flags": json.loads(
                    existing_event.flags
                ),
            }
        }

    score, risk_level, flags = (
        calculate_behavior_risk(
            answer_time_ms=data.answer_time_ms,
            answer_changes=data.answer_changes,
            focus_changes=data.focus_changes,
            offline_duration_ms=(
                data.offline_duration_ms
            ),
            navigation_count=(
                data.navigation_count
            ),
        )
    )

    event = BehaviorEvent(
        event_id=data.event_id,
        exam_id=data.exam_id,
        candidate_id=data.candidate_id,
        question_id=data.question_id,
        answer_time_ms=data.answer_time_ms,
        answer_changes=data.answer_changes,
        focus_changes=data.focus_changes,
        offline_duration_ms=(
            data.offline_duration_ms
        ),
        navigation_count=(
            data.navigation_count
        ),
        risk_score=score,
        risk_level=risk_level,
        flags=json.dumps(
            flags
        ),
    )

    db.add(event)

    create_audit_event(
        db=db,
        event_type="BEHAVIOR_ANALYSIS",
        actor="AI_ENGINE",
        entity_type="BEHAVIOR_EVENT",
        entity_id=data.event_id,
        payload={
            "exam_id": data.exam_id,
            "candidate_id": data.candidate_id,
            "question_id": data.question_id,
            "risk_score": score,
            "risk_level": risk_level,
            "flags": flags,
            "human_review_required": (
                risk_level
                == "REVIEW_REQUIRED"
            ),
        },
    )

    db.commit()
    db.refresh(event)

    return {
        "status": "success",
        "message": (
            "Behavior analyzed successfully"
        ),
        "action": "NEW_ANALYSIS_CREATED",
        "analysis": {
            "event_id": event.event_id,
            "candidate_id": (
                event.candidate_id
            ),
            "question_id": (
                event.question_id
            ),
            "risk_score": event.risk_score,
            "risk_level": event.risk_level,
            "flags": flags,
            "human_review_required": (
                event.risk_level
                == "REVIEW_REQUIRED"
            ),
            "created_at": (
                event.created_at.isoformat()
            ),
        },
    }


@router.get(
    "/candidate/{candidate_id}"
)
async def get_candidate_anomaly_summary(
    candidate_id: str,
    db: Session = Depends(get_db)
):
    events = (
        db.query(BehaviorEvent)
        .filter(
            BehaviorEvent.candidate_id
            == candidate_id
        )
        .order_by(
            BehaviorEvent.id.desc()
        )
        .all()
    )

    summary = build_candidate_summary(
        events
    )

    recent_events = []

    for event in events[:20]:
        recent_events.append(
            {
                "event_id": event.event_id,
                "question_id": event.question_id,
                "risk_score": event.risk_score,
                "risk_level": event.risk_level,
                "flags": json.loads(
                    event.flags
                ),
                "answer_time_ms": (
                    event.answer_time_ms
                ),
                "answer_changes": (
                    event.answer_changes
                ),
                "focus_changes": (
                    event.focus_changes
                ),
                "offline_duration_ms": (
                    event.offline_duration_ms
                ),
                "navigation_count": (
                    event.navigation_count
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
        "recent_events": recent_events,
        "policy_note": (
            "Risk signals are intended for "
            "human review and should not be "
            "treated as an automatic cheating verdict."
        ),
        "timestamp": (
            datetime.now(
                timezone.utc
            ).isoformat()
        ),
    }