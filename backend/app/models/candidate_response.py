from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from app.core.database import Base


class CandidateResponse(Base):
    __tablename__ = "candidate_responses"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    response_id = Column(
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

    encrypted_response = Column(
        Text,
        nullable=False
    )

    response_hash = Column(
        String(64),
        nullable=False
    )

    answered_at = Column(
        DateTime,
        nullable=False
    )

    synced_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )