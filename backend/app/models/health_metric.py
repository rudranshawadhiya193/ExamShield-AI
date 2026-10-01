from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    Integer,
    String,
    Text,
)

from app.core.database import Base


class HealthMetric(Base):
    __tablename__ = "health_metrics"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    cpu_percent = Column(
        Float,
        nullable=False,
    )

    memory_percent = Column(
        Float,
        nullable=False,
    )

    disk_percent = Column(
        Float,
        nullable=False,
    )

    db_latency_ms = Column(
        Float,
        nullable=False,
    )

    open_incidents = Column(
        Integer,
        nullable=False,
        default=0,
    )

    cpu_slope = Column(
        Float,
        nullable=False,
        default=0.0,
    )

    memory_slope = Column(
        Float,
        nullable=False,
        default=0.0,
    )

    latency_slope = Column(
        Float,
        nullable=False,
        default=0.0,
    )

    failure_probability = Column(
        Float,
        nullable=False,
        default=0.0,
    )

    risk_level = Column(
        String(30),
        nullable=False,
        default="NORMAL",
        index=True,
    )

    factors = Column(
        Text,
        nullable=False,
        default="[]",
    )

    source = Column(
        String(30),
        nullable=False,
        default="LIVE",
        index=True,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
        index=True,
    )