from pydantic import BaseModel


class IncidentCreate(BaseModel):
    type: str
    severity: str
    message: str