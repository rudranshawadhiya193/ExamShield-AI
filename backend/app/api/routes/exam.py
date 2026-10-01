from datetime import datetime, timezone
from hashlib import sha256

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.candidate_response import CandidateResponse
from app.services.audit_service import create_audit_event


router = APIRouter(
    prefix="/exam",
    tags=["Exam & Recovery"]
)


class ResponseSyncRequest(BaseModel):
    response_id: str = Field(
        min_length=3,
        max_length=150
    )

    exam_id: str = Field(
        min_length=1,
        max_length=100
    )

    candidate_id: str = Field(
        min_length=1,
        max_length=100
    )

    question_id: str = Field(
        min_length=1,
        max_length=100
    )

    encrypted_response: str = Field(
        min_length=1
    )

    response_hash: str = Field(
        min_length=64,
        max_length=64
    )

    answered_at: datetime


@router.post("/responses/sync")
async def sync_response(
    response_data: ResponseSyncRequest,
    db: Session = Depends(get_db)
):
    calculated_hash = sha256(
        response_data.encrypted_response.encode(
            "utf-8"
        )
    ).hexdigest()

    if calculated_hash != response_data.response_hash:
        raise HTTPException(
            status_code=400,
            detail=(
                "Response integrity verification failed"
            )
        )


    existing_response = (
        db.query(CandidateResponse)
        .filter(
            CandidateResponse.response_id
            == response_data.response_id
        )
        .first()
    )


    if existing_response:

        existing_response.exam_id = (
            response_data.exam_id
        )

        existing_response.candidate_id = (
            response_data.candidate_id
        )

        existing_response.question_id = (
            response_data.question_id
        )

        existing_response.encrypted_response = (
            response_data.encrypted_response
        )

        existing_response.response_hash = (
            response_data.response_hash
        )

        existing_response.answered_at = (
            response_data.answered_at.replace(
                tzinfo=None
            )
        )

        existing_response.synced_at = (
            datetime.now(
                timezone.utc
            ).replace(
                tzinfo=None
            )
        )


        create_audit_event(
            db=db,
            event_type="EXAM_RESPONSE_UPDATED",
            actor="CANDIDATE",
            entity_type="CANDIDATE_RESPONSE",
            entity_id=existing_response.response_id,
            payload={
                "exam_id": existing_response.exam_id,
                "candidate_id": existing_response.candidate_id,
                "question_id": existing_response.question_id,
                "response_hash": existing_response.response_hash,
                "action": "EXISTING_RESPONSE_UPDATED"
            }
        )


        db.commit()
        db.refresh(existing_response)


        return {
            "status": "success",
            "message": (
                "Response synchronized successfully"
            ),
            "action": (
                "EXISTING_RESPONSE_UPDATED"
            ),
            "response": {
                "response_id": (
                    existing_response.response_id
                ),
                "candidate_id": (
                    existing_response.candidate_id
                ),
                "question_id": (
                    existing_response.question_id
                ),
                "response_hash": (
                    existing_response.response_hash
                ),
                "synced_at": (
                    existing_response.synced_at.isoformat()
                ),
            }
        }


    new_response = CandidateResponse(
        response_id=response_data.response_id,
        exam_id=response_data.exam_id,
        candidate_id=response_data.candidate_id,
        question_id=response_data.question_id,
        encrypted_response=(
            response_data.encrypted_response
        ),
        response_hash=(
            response_data.response_hash
        ),
        answered_at=(
            response_data.answered_at.replace(
                tzinfo=None
            )
        ),
        synced_at=(
            datetime.now(
                timezone.utc
            ).replace(
                tzinfo=None
            )
        )
    )


    db.add(new_response)


    create_audit_event(
        db=db,
        event_type="EXAM_RESPONSE_CREATED",
        actor="CANDIDATE",
        entity_type="CANDIDATE_RESPONSE",
        entity_id=response_data.response_id,
        payload={
            "exam_id": response_data.exam_id,
            "candidate_id": response_data.candidate_id,
            "question_id": response_data.question_id,
            "response_hash": response_data.response_hash,
            "action": "NEW_RESPONSE_STORED"
        }
    )


    db.commit()
    db.refresh(new_response)


    return {
        "status": "success",
        "message": (
            "Response synchronized successfully"
        ),
        "action": "NEW_RESPONSE_STORED",
        "response": {
            "response_id": (
                new_response.response_id
            ),
            "candidate_id": (
                new_response.candidate_id
            ),
            "question_id": (
                new_response.question_id
            ),
            "response_hash": (
                new_response.response_hash
            ),
            "synced_at": (
                new_response.synced_at.isoformat()
            ),
        }
    }


@router.get("/responses/{candidate_id}")
async def get_candidate_responses(
    candidate_id: str,
    db: Session = Depends(get_db)
):
    responses = (
        db.query(CandidateResponse)
        .filter(
            CandidateResponse.candidate_id
            == candidate_id
        )
        .order_by(CandidateResponse.id.desc())
        .all()
    )

    return {
        "status": "success",
        "candidate_id": candidate_id,
        "total_synced_responses": len(
            responses
        ),
        "responses": [
            {
                "response_id": (
                    response.response_id
                ),
                "exam_id": response.exam_id,
                "question_id": (
                    response.question_id
                ),
                "response_hash": (
                    response.response_hash
                ),
                "answered_at": (
                    response.answered_at.isoformat()
                ),
                "synced_at": (
                    response.synced_at.isoformat()
                ),
            }
            for response in responses
        ]
    }