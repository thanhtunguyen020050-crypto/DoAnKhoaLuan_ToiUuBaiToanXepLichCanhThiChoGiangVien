"""FastAPI Controller: HTTP endpoint, validation and delegation to Model."""

from fastapi import APIRouter, Depends, HTTPException

try:
    from ..auth_utils import get_current_user_payload, require_admin
    from ..services.schedule_run_status import get_latest_run_status
except ImportError:
    from auth_utils import get_current_user_payload, require_admin
    from services.schedule_run_status import get_latest_run_status

try:
    from ..schemas.scheduling import ScheduleRequest, SoftRulesUpdate
except ImportError:
    from schemas.scheduling import ScheduleRequest, SoftRulesUpdate

try:
    from ..models.scheduling import (
        run_cpsat as _model_run_cpsat,
        start_cpsat as _model_start_cpsat,
        get_cpsat_result as _model_get_cpsat_result,
        get_soft_rule_config as _model_get_soft_rule_config,
        save_soft_rule_config as _model_save_soft_rule_config,
    )
except ImportError:
    from models.scheduling import (
        run_cpsat as _model_run_cpsat,
        start_cpsat as _model_start_cpsat,
        get_cpsat_result as _model_get_cpsat_result,
        get_soft_rule_config as _model_get_soft_rule_config,
        save_soft_rule_config as _model_save_soft_rule_config,
    )

router = APIRouter(prefix="/api/xep-lich", tags=["Xếp lịch CP-SAT"])

@router.post('/cpsat')
def run_cpsat(request: ScheduleRequest):
    return _model_run_cpsat(request=request)


@router.post('/cpsat/start')
def start_cpsat(request: ScheduleRequest, _admin_user: str = Depends(require_admin)):
    return _model_start_cpsat(request=request)


@router.get('/cpsat/result/{ma_dot}/{run_id}')
def cpsat_result(ma_dot: str, run_id: str, _admin_user: str = Depends(require_admin)):
    result = _model_get_cpsat_result(ma_dot=ma_dot, run_id=run_id)
    if result is None:
        raise HTTPException(status_code=404, detail='Không tìm thấy kết quả cho lần xếp lịch này.')
    return result


@router.get('/run-status')
def schedule_run_status(_current_user: dict = Depends(get_current_user_payload)):
    return {"run": get_latest_run_status()}


@router.get('/soft-config/{ma_dot}')
def get_soft_rule_config(ma_dot: str):
    return _model_get_soft_rule_config(ma_dot=ma_dot)


@router.put('/soft-config/{ma_dot}')
def save_soft_rule_config(ma_dot: str, request: SoftRulesUpdate):
    return _model_save_soft_rule_config(ma_dot=ma_dot, requested_rules=request.rules)
