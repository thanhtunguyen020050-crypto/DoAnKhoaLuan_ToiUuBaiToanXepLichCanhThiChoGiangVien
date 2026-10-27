"""FastAPI Controller: HTTP endpoint, validation and delegation to Model."""

from fastapi import APIRouter, Depends

try:
    from ..auth_utils import require_admin
except ImportError:
    from auth_utils import require_admin

try:
    from ..schemas.admin import DotThiIn, CaThiIn, LuuPhanCongIn, DinhMucChungIn
except ImportError:
    from schemas.admin import DotThiIn, CaThiIn, LuuPhanCongIn, DinhMucChungIn

try:
    from ..models.admin_exams import list_exam_periods as _model_list_exam_periods, latest_exam_period as _model_latest_exam_period, create_exam_period as _model_create_exam_period, update_exam_period as _model_update_exam_period, delete_exam_period as _model_delete_exam_period, list_exam_shifts as _model_list_exam_shifts, save_exam_assignments as _model_save_exam_assignments, remove_saved_assignments as _model_remove_saved_assignments, create_exam_shift as _model_create_exam_shift, update_exam_shift as _model_update_exam_shift, clear_all_exams as _model_clear_all_exams, delete_exam_shift as _model_delete_exam_shift, set_common_quota as _model_set_common_quota
except ImportError:
    from models.admin_exams import list_exam_periods as _model_list_exam_periods, latest_exam_period as _model_latest_exam_period, create_exam_period as _model_create_exam_period, update_exam_period as _model_update_exam_period, delete_exam_period as _model_delete_exam_period, list_exam_shifts as _model_list_exam_shifts, save_exam_assignments as _model_save_exam_assignments, remove_saved_assignments as _model_remove_saved_assignments, create_exam_shift as _model_create_exam_shift, update_exam_shift as _model_update_exam_shift, clear_all_exams as _model_clear_all_exams, delete_exam_shift as _model_delete_exam_shift, set_common_quota as _model_set_common_quota

router = APIRouter(tags=['Quản trị - đợt thi và ca thi'])

@router.get('/api/dot-thi')
def list_exam_periods():
    return _model_list_exam_periods()

@router.get('/api/dot-thi/moi-nhat')
def latest_exam_period():
    return _model_latest_exam_period()

@router.post('/api/dot-thi')
def create_exam_period(x: DotThiIn):
    return _model_create_exam_period(x=x)

@router.put('/api/dot-thi/{ma_dot}')
def update_exam_period(ma_dot: str, x: DotThiIn):
    return _model_update_exam_period(ma_dot=ma_dot, x=x)

@router.delete('/api/dot-thi/{ma_dot}')
def delete_exam_period(ma_dot: str):
    return _model_delete_exam_period(ma_dot=ma_dot)

@router.get('/api/ca-thi')
def list_exam_shifts(ma_dot: str | None=None):
    return _model_list_exam_shifts(ma_dot=ma_dot)

@router.post('/api/dot-thi/{ma_dot}/phan-cong')
def save_exam_assignments(ma_dot: str, x: LuuPhanCongIn):
    return _model_save_exam_assignments(ma_dot=ma_dot, x=x)

@router.delete('/api/dot-thi/{ma_dot}/phan-cong')
def remove_saved_assignments(ma_dot: str, admin_user: str = Depends(require_admin)):
    return _model_remove_saved_assignments(ma_dot=ma_dot)

@router.post('/api/ca-thi')
def create_exam_shift(x: CaThiIn):
    return _model_create_exam_shift(x=x)

@router.put('/api/ca-thi/{ma_ca}')
def update_exam_shift(ma_ca: str, x: CaThiIn):
    return _model_update_exam_shift(ma_ca=ma_ca, x=x)

@router.delete('/api/ca-thi/all')
def clear_all_exams():
    return _model_clear_all_exams()

@router.delete('/api/ca-thi/{ma_ca}')
def delete_exam_shift(ma_ca: str):
    return _model_delete_exam_shift(ma_ca=ma_ca)

@router.post('/api/dinh-muc/dat-chung')
def set_common_quota(x: DinhMucChungIn):
    return _model_set_common_quota(x=x)
