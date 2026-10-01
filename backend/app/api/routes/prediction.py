from datetime import datetime, timezone
import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.health_metric import HealthMetric
from app.models.incident import Incident
from app.schemas.prediction import (
    PredictionHistoryResponse,
    PredictionRequest,
    PredictionResponse,
)
from app.services.audit_service import (
    create_audit_event,
)
from app.services.prediction_service import (
    collect_live_metrics,
    generate_prediction,
    model_info,
)


router = APIRouter(
    prefix="/prediction",
    tags=["AI Failure Prediction"],
)


def sync_predictive_incident(
    db: Session,
    risk_level: str,
    failure_probability: float,
    factors: list[str],
) -> dict:
    """
    Synchronize the AI prediction state with the
    incident-management system.

    A single open predictive incident is maintained
    so repeated polling does not create duplicates.
    """

    predictive_type = (
        "PREDICTIVE_FAILURE_RISK"
    )

    existing_incident = (
        db.query(Incident)
        .filter(
            Incident.type == predictive_type,
            Incident.status == "OPEN",
        )
        .order_by(
            Incident.id.desc()
        )
        .first()
    )

    if risk_level in {
        "HIGH",
        "CRITICAL",
    }:

        severity = (
            "CRITICAL"
            if risk_level == "CRITICAL"
            else "HIGH"
        )

        probability_percent = (
            failure_probability * 100
        )

        message = (
            f"AI predicts a "
            f"{probability_percent:.2f}% "
            f"failure risk within the next "
            f"5 minutes. "
            f"Primary factors: "
            f"{'; '.join(factors[:4])}"
        )

        if existing_incident:

            existing_incident.severity = (
                severity
            )

            existing_incident.message = (
                message
            )

            db.commit()

            return {
                "action":
                    "EXISTING_PREDICTIVE_INCIDENT_UPDATED",
                "incident_id":
                    existing_incident.id,
                "severity":
                    existing_incident.severity,
                "status":
                    existing_incident.status,
            }

        new_incident = Incident(
            type=predictive_type,
            severity=severity,
            message=message,
            status="OPEN",
        )

        db.add(new_incident)
        db.flush()

        create_audit_event(
            db=db,
            event_type=(
                "PREDICTIVE_INCIDENT_CREATED"
            ),
            actor="AI_PREDICTION_ENGINE",
            entity_type="INCIDENT",
            entity_id=str(
                new_incident.id
            ),
            payload={
                "risk_level":
                    risk_level,
                "failure_probability":
                    round(
                        failure_probability,
                        4,
                    ),
                "factors":
                    factors,
                "incident_type":
                    predictive_type,
                "action":
                    "PREDICTIVE_ALERT_ESCALATED",
            },
        )

        db.commit()

        return {
            "action":
                "NEW_PREDICTIVE_INCIDENT_CREATED",
            "incident_id":
                new_incident.id,
            "severity":
                new_incident.severity,
            "status":
                new_incident.status,
        }

    # If the prediction has returned below HIGH,
    # resolve a previously-open predictive incident.
    if existing_incident:

        existing_incident.status = (
            "RESOLVED"
        )

        existing_incident.resolved_at = (
            datetime.now(
                timezone.utc
            ).replace(
                tzinfo=None
            )
        )

        create_audit_event(
            db=db,
            event_type=(
                "PREDICTIVE_INCIDENT_RESOLVED"
            ),
            actor="AI_PREDICTION_ENGINE",
            entity_type="INCIDENT",
            entity_id=str(
                existing_incident.id
            ),
            payload={
                "risk_level":
                    risk_level,
                "failure_probability":
                    round(
                        failure_probability,
                        4,
                    ),
                "action":
                    "PREDICTIVE_RISK_RETURNED_TO_SAFE_RANGE",
            },
        )

        db.commit()

        return {
            "action":
                "EXISTING_PREDICTIVE_INCIDENT_RESOLVED",
            "incident_id":
                existing_incident.id,
            "severity":
                existing_incident.severity,
            "status":
                existing_incident.status,
        }

    return {
        "action":
            "NO_PREDICTIVE_INCIDENT_REQUIRED",
        "incident_id":
            None,
        "severity":
            None,
        "status":
            None,
    }


@router.post(
    "/forecast",
    response_model=PredictionResponse,
)
async def failure_forecast(
    request: PredictionRequest,
    db: Session = Depends(get_db),
):
    live_metrics = (
        collect_live_metrics(
            db
        )
    )

    if request.mode == "SIMULATED":

        metrics = {
            "cpu_percent": (
                request.cpu_percent
                if request.cpu_percent is not None
                else live_metrics[
                    "cpu_percent"
                ]
            ),
            "memory_percent": (
                request.memory_percent
                if request.memory_percent is not None
                else live_metrics[
                    "memory_percent"
                ]
            ),
            "disk_percent": (
                request.disk_percent
                if request.disk_percent is not None
                else live_metrics[
                    "disk_percent"
                ]
            ),
            "db_latency_ms": (
                request.db_latency_ms
                if request.db_latency_ms is not None
                else live_metrics[
                    "db_latency_ms"
                ]
            ),
            "open_incidents": (
                request.open_incidents
                if request.open_incidents is not None
                else live_metrics[
                    "open_incidents"
                ]
            ),
        }

        source = "SIMULATED"

    else:

        metrics = live_metrics

        source = "LIVE"


    prediction = generate_prediction(
        db=db,
        metrics=metrics,
        source=source,
    )


    incident_sync = (
        sync_predictive_incident(
            db=db,
            risk_level=
                prediction[
                    "risk_level"
                ],
            failure_probability=
                prediction[
                    "failure_probability"
                ],
            factors=
                prediction[
                    "factors"
                ],
        )
    )


    return {
        "status": "success",

        "forecast_window_minutes":
            prediction["model"][
                "forecast_window_minutes"
            ],

        "failure_probability":
            prediction[
                "failure_probability"
            ],

        "risk_level":
            prediction[
                "risk_level"
            ],

        "factors":
            prediction["factors"],

        "current_metrics":
            prediction[
                "current_metrics"
            ],

        "trend":
            prediction["trend"],

        "model":
            prediction["model"],

        "source":
            source,

        "timestamp":
            datetime.now(
                timezone.utc
            ).isoformat(),
    }


@router.get(
    "/history",
    response_model=PredictionHistoryResponse,
)
async def prediction_history(
    db: Session = Depends(get_db),
):
    records = (
        db.query(HealthMetric)
        .order_by(
            HealthMetric.id.desc()
        )
        .limit(50)
        .all()
    )


    return {
        "status": "success",

        "total":
            len(records),

        "records": [
            {
                "id":
                    record.id,

                "cpu_percent":
                    record.cpu_percent,

                "memory_percent":
                    record.memory_percent,

                "disk_percent":
                    record.disk_percent,

                "db_latency_ms":
                    record.db_latency_ms,

                "open_incidents":
                    record.open_incidents,

                "cpu_slope":
                    record.cpu_slope,

                "memory_slope":
                    record.memory_slope,

                "latency_slope":
                    record.latency_slope,

                "failure_probability":
                    record.failure_probability,

                "risk_level":
                    record.risk_level,

                "factors":
                    json.loads(
                        record.factors
                    ),

                "source":
                    record.source,

                "created_at":
                    (
                        record.created_at.isoformat()
                        if record.created_at
                        else ""
                    ),
            }
            for record in records
        ],
    }


@router.get(
    "/model-info",
)
async def prediction_model_info():
    return {
        "status": "success",

        "model":
            model_info(),

        "timestamp":
            datetime.now(
                timezone.utc
            ).isoformat(),
    }