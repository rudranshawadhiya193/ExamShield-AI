from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String, Text

from app.core.database import Base


class BehaviorEvent(Base):
    __tablename__ = "behavior_events"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    event_id = Column(
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

    question_id = Column(
        String,
        nullable=False
    )

    answer_time_ms = Column(
        Integer,
        nullable=False
    )

    answer_changes = Column(
        Integer,
        nullable=False,
        default=0
    )

    focus_changes = Column(
        Integer,
        nullable=False,
        default=0
    )

    offline_duration_ms = Column(
        Integer,
        nullable=False,
        default=0
    )

    navigation_count = Column(
        Integer,
        nullable=False,
        default=0
    )

    risk_score = Column(
        Float,
        nullable=False
    )

    risk_level = Column(
        String,
        nullable=False,
        index=True
    )

    flags = Column(
        Text,
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )