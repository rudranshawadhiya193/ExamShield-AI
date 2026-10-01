from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from app.core.database import Base


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    event_type = Column(
        String,
        nullable=False,
        index=True
    )

    actor = Column(
        String,
        nullable=False
    )

    entity_type = Column(
        String,
        nullable=False
    )

    entity_id = Column(
        String,
        nullable=False,
        index=True
    )

    payload = Column(
        Text,
        nullable=False
    )

    previous_hash = Column(
        String(64),
        nullable=False
    )

    event_hash = Column(
        String(64),
        unique=True,
        nullable=False,
        index=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )