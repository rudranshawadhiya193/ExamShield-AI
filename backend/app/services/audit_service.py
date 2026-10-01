from datetime import datetime
from hashlib import sha256
import json

from sqlalchemy.orm import Session

from app.models.audit_event import AuditEvent


GENESIS_HASH = (
    "0000000000000000000000000000000000000000000000000000000000000000"
)


def canonical_payload(payload: dict) -> str:
    return json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False
    )


def calculate_event_hash(
    previous_hash: str,
    event_type: str,
    actor: str,
    entity_type: str,
    entity_id: str,
    payload: str,
    created_at: datetime
) -> str:

    timestamp = created_at.strftime(
        "%Y-%m-%dT%H:%M:%S.%f"
    )

    hash_input = (
        previous_hash
        + event_type
        + actor
        + entity_type
        + entity_id
        + payload
        + timestamp
    )

    return sha256(
        hash_input.encode("utf-8")
    ).hexdigest()


def create_audit_event(
    db: Session,
    event_type: str,
    actor: str,
    entity_type: str,
    entity_id: str,
    payload: dict
) -> AuditEvent:

    previous_event = (
        db.query(AuditEvent)
        .order_by(AuditEvent.id.desc())
        .first()
    )

    previous_hash = (
        previous_event.event_hash
        if previous_event
        else GENESIS_HASH
    )

    created_at = datetime.utcnow()

    payload_json = canonical_payload(
        payload
    )

    event_hash = calculate_event_hash(
        previous_hash=previous_hash,
        event_type=event_type,
        actor=actor,
        entity_type=entity_type,
        entity_id=entity_id,
        payload=payload_json,
        created_at=created_at
    )

    audit_event = AuditEvent(
        event_type=event_type,
        actor=actor,
        entity_type=entity_type,
        entity_id=entity_id,
        payload=payload_json,
        previous_hash=previous_hash,
        event_hash=event_hash,
        created_at=created_at
    )

    db.add(audit_event)

    return audit_event


def verify_audit_chain(
    db: Session
) -> dict:

    events = (
        db.query(AuditEvent)
        .order_by(AuditEvent.id.asc())
        .all()
    )

    if not events:
        return {
            "valid": True,
            "total_events": 0,
            "message": "Audit chain is empty."
        }

    expected_previous_hash = GENESIS_HASH

    for event in events:

        if event.previous_hash != expected_previous_hash:
            return {
                "valid": False,
                "total_events": len(events),
                "failed_event_id": event.id,
                "message": (
                    "Previous hash mismatch detected."
                )
            }

        expected_hash = calculate_event_hash(
            previous_hash=event.previous_hash,
            event_type=event.event_type,
            actor=event.actor,
            entity_type=event.entity_type,
            entity_id=event.entity_id,
            payload=event.payload,
            created_at=event.created_at
        )

        if event.event_hash != expected_hash:
            return {
                "valid": False,
                "total_events": len(events),
                "failed_event_id": event.id,
                "message": (
                    "Event hash mismatch detected."
                )
            }

        expected_previous_hash = (
            event.event_hash
        )

    return {
        "valid": True,
        "total_events": len(events),
        "message": (
            "Audit hash chain verified successfully."
        ),
        "latest_hash": expected_previous_hash
    }