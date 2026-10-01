from typing import Literal

from pydantic import BaseModel, Field


class PredictionRequest(BaseModel):
    mode: Literal[
        "LIVE",
        "SIMULATED",
    ] = "LIVE"

    cpu_percent: float | None = Field(
        default=None,
        ge=0,
        le=100,
    )

    memory_percent: float | None = Field(
        default=None,
        ge=0,
        le=100,
    )

    disk_percent: float | None = Field(
        default=None,
        ge=0,
        le=100,
    )

    db_latency_ms: float | None = Field(
        default=None,
        ge=0,
        le=60000,
    )

    open_incidents: int | None = Field(
        default=None,
        ge=0,
        le=1000,
    )


class PredictionResponse(BaseModel):
    status: str

    forecast_window_minutes: int

    failure_probability: float

    risk_level: str

    factors: list[str]

    current_metrics: dict

    trend: dict

    model: dict

    source: str

    timestamp: str


class PredictionHistoryItem(BaseModel):
    id: int

    cpu_percent: float

    memory_percent: float

    disk_percent: float

    db_latency_ms: float

    open_incidents: int

    cpu_slope: float

    memory_slope: float

    latency_slope: float

    failure_probability: float

    risk_level: str

    factors: list[str]

    source: str

    created_at: str


class PredictionHistoryResponse(BaseModel):
    status: str

    total: int

    records: list[
        PredictionHistoryItem
    ]