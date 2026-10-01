from datetime import datetime, timezone
from hashlib import sha256
import json

from sqlalchemy.orm import Session

from app.models.audit_event import AuditEvent
from app.models.behavior_event import BehaviorEvent
from app.models.candidate_response import CandidateResponse
from app.models.disruption_event import DisruptionEvent
from app.models.health_metric import HealthMetric
from app.models.incident import Incident
from app.services.audit_service import verify_audit_chain


def _response_integrity_report(
    db: Session,
    exam_id: str | None = None,
) -> dict:

    query = db.query(
        CandidateResponse
    )

    if exam_id:
        query = query.filter(
            CandidateResponse.exam_id == exam_id
        )

    responses = (
        query
        .order_by(
            CandidateResponse.id.asc()
        )
        .all()
    )

    verified = 0
    failed = 0
    failed_response_ids: list[str] = []

    for response in responses:

        calculated_hash = sha256(
            response.encrypted_response.encode(
                "utf-8"
            )
        ).hexdigest()

        if (
            calculated_hash
            == response.response_hash
        ):
            verified += 1
        else:
            failed += 1
            failed_response_ids.append(
                response.response_id
            )

    return {
        "total_responses": len(responses),
        "verified_responses": verified,
        "failed_responses": failed,
        "integrity_status": (
            "VALID"
            if failed == 0
            else "INVALID"
        ),
        "failed_response_ids":
            failed_response_ids[:20],
    }


def _operational_report(
    db: Session,
) -> dict:

    incidents = (
        db.query(Incident)
        .order_by(
            Incident.id.desc()
        )
        .all()
    )

    total = len(incidents)

    open_count = sum(
        1
        for incident in incidents
        if incident.status == "OPEN"
    )

    resolved_count = sum(
        1
        for incident in incidents
        if incident.status == "RESOLVED"
    )

    critical_count = sum(
        1
        for incident in incidents
        if incident.severity == "CRITICAL"
    )

    high_count = sum(
        1
        for incident in incidents
        if incident.severity == "HIGH"
    )

    predictive_incidents = sum(
        1
        for incident in incidents
        if incident.type
        == "PREDICTIVE_FAILURE_RISK"
    )

    return {
        "total_incidents": total,
        "open_incidents": open_count,
        "resolved_incidents": resolved_count,
        "critical_incidents": critical_count,
        "high_incidents": high_count,
        "predictive_failure_incidents":
            predictive_incidents,
        "operational_status": (
            "ATTENTION_REQUIRED"
            if open_count > 0
            else "STABLE"
        ),
    }


def _prediction_report(
    db: Session,
) -> dict:

    records = (
        db.query(HealthMetric)
        .order_by(
            HealthMetric.id.desc()
        )
        .limit(100)
        .all()
    )

    if not records:
        return {
            "predictions_evaluated": 0,
            "maximum_failure_probability": 0.0,
            "critical_predictions": 0,
            "high_predictions": 0,
            "watch_predictions": 0,
            "latest_prediction": None,
        }

    probabilities = [
        float(
            record.failure_probability
        )
        for record in records
    ]

    critical_count = sum(
        1
        for record in records
        if record.risk_level == "CRITICAL"
    )

    high_count = sum(
        1
        for record in records
        if record.risk_level == "HIGH"
    )

    watch_count = sum(
        1
        for record in records
        if record.risk_level == "WATCH"
    )

    latest = records[0]

    return {
        "predictions_evaluated":
            len(records),

        "maximum_failure_probability":
            round(
                max(probabilities),
                4,
            ),

        "critical_predictions":
            critical_count,

        "high_predictions":
            high_count,

        "watch_predictions":
            watch_count,

        "latest_prediction": {
            "failure_probability":
                latest.failure_probability,

            "risk_level":
                latest.risk_level,

            "source":
                latest.source,

            "created_at": (
                latest.created_at.isoformat()
                if latest.created_at
                else None
            ),
        },
    }


def _anomaly_report(
    db: Session,
    candidate_id: str | None = None,
) -> dict:

    query = db.query(
        BehaviorEvent
    )

    if candidate_id:
        query = query.filter(
            BehaviorEvent.candidate_id
            == candidate_id
        )

    events = (
        query
        .order_by(
            BehaviorEvent.id.desc()
        )
        .all()
    )

    scores = [
        float(event.risk_score)
        for event in events
    ]

    review_required = sum(
        1
        for event in events
        if event.risk_level
        == "REVIEW_REQUIRED"
    )

    high_risk = sum(
        1
        for event in events
        if event.risk_level
        in {
            "HIGH",
            "REVIEW_REQUIRED",
        }
    )

    return {
        "events_evaluated":
            len(events),

        "average_risk_score": (
            round(
                sum(scores)
                / len(scores),
                2,
            )
            if scores
            else 0.0
        ),

        "maximum_risk_score": (
            max(scores)
            if scores
            else 0.0
        ),

        "review_required_events":
            review_required,

        "high_risk_events":
            high_risk,

        "policy": (
            "Risk signals are review "
            "indicators and are not automatic "
            "cheating verdicts."
        ),
    }


def _fairness_report(
    db: Session,
    candidate_id: str | None = None,
) -> dict:

    query = db.query(
        DisruptionEvent
    )

    if candidate_id:
        query = query.filter(
            DisruptionEvent.candidate_id
            == candidate_id
        )

    events = (
        query
        .order_by(
            DisruptionEvent.id.desc()
        )
        .all()
    )

    scores = [
        float(event.impact_score)
        for event in events
    ]

    severe = sum(
        1
        for event in events
        if event.impact_level
        == "SEVERE"
    )

    high = sum(
        1
        for event in events
        if event.impact_level
        == "HIGH"
    )

    affected_questions = sum(
        int(event.affected_questions)
        for event in events
    )

    recovered_responses = sum(
        int(event.recovered_responses)
        for event in events
    )

    return {
        "disruptions_evaluated":
            len(events),

        "average_impact_score": (
            round(
                sum(scores)
                / len(scores),
                2,
            )
            if scores
            else 0.0
        ),

        "maximum_impact_score": (
            max(scores)
            if scores
            else 0.0
        ),

        "severe_disruptions":
            severe,

        "high_impact_disruptions":
            high,

        "total_affected_questions":
            affected_questions,

        "total_recovered_responses":
            recovered_responses,

        "policy": (
            "Fairness recommendations support "
            "authorized human decision-making."
        ),
    }


def _audit_report(
    db: Session,
) -> dict:

    verification = (
        verify_audit_chain(db)
    )

    total_events = (
        db.query(AuditEvent).count()
    )

    return {
        "total_audit_events":
            total_events,

        "chain_valid":
            verification["valid"],

        "verification_message":
            verification["message"],

        "latest_hash":
            verification.get(
                "latest_hash"
            ),

        "failed_event_id":
            verification.get(
                "failed_event_id"
            ),
    }


def generate_trust_report(
    db: Session,
    exam_id: str | None = None,
    candidate_id: str | None = None,
) -> dict:

    operational = (
        _operational_report(db)
    )

    prediction = (
        _prediction_report(db)
    )

    anomaly = (
        _anomaly_report(
            db,
            candidate_id,
        )
    )

    fairness = (
        _fairness_report(
            db,
            candidate_id,
        )
    )

    response_integrity = (
        _response_integrity_report(
            db,
            exam_id,
        )
    )

    audit_integrity = (
        _audit_report(db)
    )

    trust_checks = [
        response_integrity[
            "integrity_status"
        ] == "VALID",

        audit_integrity[
            "chain_valid"
        ],

        response_integrity[
            "failed_responses"
        ] == 0,
    ]

    overall_trust_status = (
        "TRUST_VERIFIED"
        if all(trust_checks)
        else "REVIEW_REQUIRED"
    )

    return {
        "status":
            "success",

        "report_type":
            "EXAMSHIELD_POST_EXAM_TRUST_REPORT",

        "generated_at":
            datetime.now(
                timezone.utc
            ).isoformat(),

        "scope": {
            "exam_id":
                exam_id,

            "candidate_id":
                candidate_id,

            "note": (
                "Incident and prediction records "
                "are system-level operational evidence "
                "in the current MVP."
            ),
        },

        "operational_summary":
            operational,

        "prediction_summary":
            prediction,

        "anomaly_summary":
            anomaly,

        "fairness_summary":
            fairness,

        "response_integrity":
            response_integrity,

        "audit_integrity":
            audit_integrity,

        "overall_trust_status":
            overall_trust_status,
    }