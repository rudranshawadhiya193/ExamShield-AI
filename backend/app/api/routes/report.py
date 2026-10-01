from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.report import ReportResponse
from app.services.report_service import generate_trust_report


router = APIRouter(
    prefix="/reports",
    tags=["Post-Exam Evidence"],
)


@router.get(
    "/trust",
    response_model=ReportResponse,
)
async def generate_report(
    exam_id: str | None = None,
    candidate_id: str | None = None,
    db: Session = Depends(get_db),
):
    return generate_trust_report(
        db=db,
        exam_id=exam_id,
        candidate_id=candidate_id,
    )