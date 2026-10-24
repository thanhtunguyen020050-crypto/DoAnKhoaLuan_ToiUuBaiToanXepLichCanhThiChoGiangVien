"""FastAPI Controller: HTTP endpoint, validation and delegation to Model."""

from fastapi import APIRouter

try:
    from ..schemas.scheduling import ScheduleRequest
except ImportError:
    from schemas.scheduling import ScheduleRequest

try:
    from ..models.scheduling import run_cpsat as _model_run_cpsat
except ImportError:
    from models.scheduling import run_cpsat as _model_run_cpsat

router = APIRouter(prefix="/api/xep-lich", tags=["Xếp lịch CP-SAT"])

@router.post('/cpsat')
def run_cpsat(request: ScheduleRequest):
    return _model_run_cpsat(request=request)
