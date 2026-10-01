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


class DisruptionEvent(Base):
    __tablename__ = "disruption_events"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    disruption_id = Column(
        String,
        unique=True,
        nullable=False,
        index=True
    )

    exam_id = Column(
        String,
        nullable=False,
        index=True
    )

    candidate_id = Column(
        String,
        nullable=False,
        index=True
    )

    incident_id = Column(
        Integer,
        nullable=True,
        index=True
    )

    disruption_type = Column(
        String,
        nullable=False
    )

    duration_ms = Column(
        Integer,
        nullable=False
    )

    affected_questions = Column(
        Integer,
        nullable=False
    )

    pending_responses = Column(
        Integer,
        nullable=False
    )

    recovered_responses = Column(
        Integer,
        nullable=False
    )

    impact_score = Column(
        Float,
        nullable=False
    )

    impact_level = Column(
        String,
        nullable=False,
        index=True
    )

    recommendation = Column(
        String,
        nullable=False
    )

    evidence = Column(
        Text,
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )