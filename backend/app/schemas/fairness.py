from pydantic import BaseModel, Field


class FairnessAnalysisRequest(BaseModel):
    disruption_id: str = Field(
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

    incident_id: int | None = Field(
        default=None,
        ge=1
    )

    disruption_type: str = Field(
        min_length=1,
        max_length=100
    )

    duration_ms: int = Field(
        ge=0,
        le=86400000
    )

    affected_questions: int = Field(
        ge=0,
        le=500
    )

    pending_responses: int = Field(
        ge=0,
        le=500
    )

    recovered_responses: int = Field(
        ge=0,
        le=500
    )