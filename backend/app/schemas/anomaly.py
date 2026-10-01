from pydantic import BaseModel, Field


class AnomalyAnalysisRequest(BaseModel):
    event_id: str = Field(
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

    answer_time_ms: int = Field(
        ge=0,
        le=3600000
    )

    answer_changes: int = Field(
        ge=0,
        le=100
    )

    focus_changes: int = Field(
        ge=0,
        le=100
    )

    offline_duration_ms: int = Field(
        ge=0,
        le=3600000
    )

    navigation_count: int = Field(
        ge=0,
        le=200
    )