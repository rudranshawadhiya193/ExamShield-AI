from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from app.core.database import Base


class ProctoringEvent(Base):
    __tablename__ = "proctoring_events"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    event_id = Column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
    )

    candidate_id = Column(
        String(100),
        nullable=False,
        index=True,
    )

    exam_id = Column(
        String(100),
        nullable=False,
        index=True,
    )

    event_type = Column(
        String(100),
        nullable=False,
        index=True,
    )

    severity = Column(
        String(20),
        nullable=False,
        index=True,
    )

    message = Column(
        Text,
        nullable=False,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
        index=True,
    )
