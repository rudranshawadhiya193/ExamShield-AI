import json
import math
import time

import psutil
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.health_metric import HealthMetric
from app.models.incident import Incident


FORECAST_WINDOW_MINUTES = 5

MODEL_NAME = "ExamShield Early Failure Risk Engine"
MODEL_VERSION = "1.0"


def _sigmoid(value: float) -> float:
    """
    Convert a raw risk value into a probability-like
    score between 0 and 1.
    """
    value = max(-60.0, min(60.0, value))
    return 1.0 / (1.0 + math.exp(-value))


def _calculate_slope(
    values: list[float],
) -> float:
    if len(values) < 2:
        return 0.0

    return (
        values[-1] - values[0]
    ) / max(
        len(values) - 1,
        1,
    )


def _get_recent_values(
    db: Session,
    limit: int = 10,
) -> list[HealthMetric]:

    records = (
        db.query(HealthMetric)
        .order_by(
            HealthMetric.id.desc()
        )
        .limit(limit)
        .all()
    )

    return list(reversed(records))


def _measure_database_latency(
    db: Session,
) -> float:

    start = time.perf_counter()

    db.execute(
        text("SELECT 1")
    )

    elapsed = (
        time.perf_counter()
        - start
    )

    return round(
        elapsed * 1000,
        3,
    )


def collect_live_metrics(
    db: Session,
) -> dict:

    cpu_percent = psutil.cpu_percent(
        interval=0.3
    )

    memory_percent = (
        psutil.virtual_memory().percent
    )

    disk_percent = (
        psutil.disk_usage("/").percent
    )

    db_latency_ms = (
        _measure_database_latency(db)
    )

    open_incidents = (
        db.query(Incident)
        .filter(
            Incident.status == "OPEN"
        )
        .count()
    )

    return {
        "cpu_percent": round(
            float(cpu_percent),
            2,
        ),
        "memory_percent": round(
            float(memory_percent),
            2,
        ),
        "disk_percent": round(
            float(disk_percent),
            2,
        ),
        "db_latency_ms": round(
            float(db_latency_ms),
            3,
        ),
        "open_incidents": int(
            open_incidents
        ),
    }


def calculate_trends(
    db: Session,
    current_metrics: dict,
) -> dict:

    history = _get_recent_values(
        db,
        limit=10,
    )

    cpu_values = [
        float(record.cpu_percent)
        for record in history
    ]

    memory_values = [
        float(record.memory_percent)
        for record in history
    ]

    latency_values = [
        float(record.db_latency_ms)
        for record in history
    ]

    cpu_values.append(
        float(
            current_metrics["cpu_percent"]
        )
    )

    memory_values.append(
        float(
            current_metrics["memory_percent"]
        )
    )

    latency_values.append(
        float(
            current_metrics["db_latency_ms"]
        )
    )

    return {
        "cpu_slope": round(
            _calculate_slope(
                cpu_values
            ),
            4,
        ),
        "memory_slope": round(
            _calculate_slope(
                memory_values
            ),
            4,
        ),
        "latency_slope": round(
            _calculate_slope(
                latency_values
            ),
            4,
        ),
        "samples_considered": len(
            cpu_values
        ),
    }


def _normalize(
    value: float,
    warning: float,
    critical: float,
) -> float:

    if value <= warning:
        return 0.0

    if value >= critical:
        return 1.0

    return (
        (value - warning)
        / (critical - warning)
    )


def _normalize_slope(
    value: float,
    warning: float,
    critical: float,
) -> float:

    if value <= warning:
        return 0.0

    if value >= critical:
        return 1.0

    return (
        (value - warning)
        / (critical - warning)
    )


def _build_risk_components(
    metrics: dict,
    trends: dict,
) -> dict:

    cpu_component = _normalize(
        metrics["cpu_percent"],
        70.0,
        95.0,
    )

    memory_component = _normalize(
        metrics["memory_percent"],
        75.0,
        95.0,
    )

    disk_component = _normalize(
        metrics["disk_percent"],
        80.0,
        98.0,
    )

    latency_component = _normalize(
        metrics["db_latency_ms"],
        150.0,
        1000.0,
    )

    incident_component = min(
        metrics["open_incidents"] / 10.0,
        1.0,
    )

    cpu_trend_component = _normalize_slope(
        trends["cpu_slope"],
        2.0,
        8.0,
    )

    memory_trend_component = _normalize_slope(
        trends["memory_slope"],
        2.0,
        7.0,
    )

    latency_trend_component = _normalize_slope(
        trends["latency_slope"],
        20.0,
        150.0,
    )

    return {
        "cpu_pressure": cpu_component,
        "memory_pressure": memory_component,
        "disk_pressure": disk_component,
        "database_latency_pressure": latency_component,
        "incident_pressure": incident_component,
        "cpu_trend_pressure": cpu_trend_component,
        "memory_trend_pressure": memory_trend_component,
        "latency_trend_pressure": latency_trend_component,
    }


def _calculate_failure_probability(
    components: dict,
) -> float:

    weighted_pressure = (
        components["cpu_pressure"] * 0.20
        + components["memory_pressure"] * 0.18
        + components["disk_pressure"] * 0.08
        + components[
            "database_latency_pressure"
        ] * 0.18
        + components[
            "incident_pressure"
        ] * 0.10
        + components[
            "cpu_trend_pressure"
        ] * 0.10
        + components[
            "memory_trend_pressure"
        ] * 0.08
        + components[
            "latency_trend_pressure"
        ] * 0.08
    )

    centered_risk = (
        weighted_pressure - 0.42
    ) * 7.0

    probability = _sigmoid(
        centered_risk
    )

    return round(
        max(
            0.0,
            min(
                probability,
                1.0,
            ),
        ),
        4,
    )


def _risk_level(
    probability: float,
) -> str:

    if probability >= 0.80:
        return "CRITICAL"

    if probability >= 0.55:
        return "HIGH"

    if probability >= 0.30:
        return "WATCH"

    return "NORMAL"


def _build_factors(
    metrics: dict,
    trends: dict,
) -> list[str]:

    factors: list[str] = []

    if metrics["cpu_percent"] >= 90:
        factors.append(
            "CPU utilization is critically high"
        )
    elif metrics["cpu_percent"] >= 75:
        factors.append(
            "CPU utilization is elevated"
        )

    if metrics["memory_percent"] >= 90:
        factors.append(
            "Memory utilization is critically high"
        )
    elif metrics["memory_percent"] >= 80:
        factors.append(
            "Memory utilization is elevated"
        )

    if metrics["disk_percent"] >= 90:
        factors.append(
            "Disk utilization is critically high"
        )
    elif metrics["disk_percent"] >= 80:
        factors.append(
            "Disk utilization is elevated"
        )

    if metrics["db_latency_ms"] >= 500:
        factors.append(
            "Database response latency is high"
        )
    elif metrics["db_latency_ms"] >= 150:
        factors.append(
            "Database response latency is elevated"
        )

    if metrics["open_incidents"] >= 5:
        factors.append(
            "Multiple open incidents are increasing operational pressure"
        )
    elif metrics["open_incidents"] >= 2:
        factors.append(
            "Open incident count is elevated"
        )

    if trends["cpu_slope"] >= 5:
        factors.append(
            "CPU utilization has a strong upward trend"
        )
    elif trends["cpu_slope"] >= 2:
        factors.append(
            "CPU utilization is trending upward"
        )

    if trends["memory_slope"] >= 4:
        factors.append(
            "Memory utilization has a strong upward trend"
        )
    elif trends["memory_slope"] >= 2:
        factors.append(
            "Memory utilization is trending upward"
        )

    if trends["latency_slope"] >= 40:
        factors.append(
            "Database latency has a strong upward trend"
        )
    elif trends["latency_slope"] >= 20:
        factors.append(
            "Database latency is trending upward"
        )

    if not factors:
        factors.append(
            "No significant failure precursor detected"
        )

    return factors


def generate_prediction(
    db: Session,
    metrics: dict,
    source: str,
) -> dict:

    trends = calculate_trends(
        db,
        metrics,
    )

    components = (
        _build_risk_components(
            metrics,
            trends,
        )
    )

    probability = (
        _calculate_failure_probability(
            components
        )
    )

    risk_level = _risk_level(
        probability
    )

    factors = _build_factors(
        metrics,
        trends,
    )

    record = HealthMetric(
        cpu_percent=metrics[
            "cpu_percent"
        ],
        memory_percent=metrics[
            "memory_percent"
        ],
        disk_percent=metrics[
            "disk_percent"
        ],
        db_latency_ms=metrics[
            "db_latency_ms"
        ],
        open_incidents=metrics[
            "open_incidents"
        ],
        cpu_slope=trends[
            "cpu_slope"
        ],
        memory_slope=trends[
            "memory_slope"
        ],
        latency_slope=trends[
            "latency_slope"
        ],
        failure_probability=probability,
        risk_level=risk_level,
        factors=json.dumps(
            factors,
            ensure_ascii=False,
        ),
        source=source,
    )

    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "failure_probability": probability,
        "risk_level": risk_level,
        "factors": factors,
        "current_metrics": metrics,
        "trend": trends,
        "risk_components": components,
        "model": {
            "type": MODEL_NAME,
            "version": MODEL_VERSION,
            "forecast_window_minutes":
                FORECAST_WINDOW_MINUTES,
            "method":
                "Telemetry-weighted predictive risk scoring",
            "dataset_type":
                "LIVE_AND_SIMULATED_OPERATIONAL_SIGNALS",
        },
        "source": source,
    }


def model_info() -> dict:
    return {
        "model_type": MODEL_NAME,
        "model_version": MODEL_VERSION,
        "method":
            "Telemetry-weighted predictive risk scoring",
        "forecast_window_minutes":
            FORECAST_WINDOW_MINUTES,
        "dataset_type":
            "LIVE_AND_SIMULATED_OPERATIONAL_SIGNALS",
        "feature_names": [
            "cpu_percent",
            "memory_percent",
            "disk_percent",
            "db_latency_ms",
            "open_incidents",
            "cpu_slope",
            "memory_slope",
            "latency_slope",
        ],
        "training_required": False,
        "note":
            (
                "This prototype uses an explainable "
                "predictive scoring engine rather than "
                "a trained statistical ML model."
            ),
    }