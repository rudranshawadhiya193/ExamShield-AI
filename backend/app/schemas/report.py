from pydantic import BaseModel


class ReportResponse(BaseModel):
    status: str

    report_type: str

    generated_at: str

    scope: dict

    operational_summary: dict

    prediction_summary: dict

    anomaly_summary: dict

    fairness_summary: dict

    response_integrity: dict

    audit_integrity: dict

    overall_trust_status: str