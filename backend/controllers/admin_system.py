"""FastAPI Controller: HTTP endpoint, validation and delegation to Model."""

from fastapi import APIRouter

try:
    from ..schemas.admin import GiangVienIn
except ImportError:
    from schemas.admin import GiangVienIn

try:
    from ..models.admin_system import health as _model_health, list_departments as _model_list_departments, resolve_khoa as _model_resolve_khoa, list_lecturers as _model_list_lecturers, create_lecturer as _model_create_lecturer, update_lecturer as _model_update_lecturer, delete_lecturer as _model_delete_lecturer
except ImportError:
    from models.admin_system import health as _model_health, list_departments as _model_list_departments, resolve_khoa as _model_resolve_khoa, list_lecturers as _model_list_lecturers, create_lecturer as _model_create_lecturer, update_lecturer as _model_update_lecturer, delete_lecturer as _model_delete_lecturer

router = APIRouter(tags=['Quản trị - hệ thống và giảng viên'])

@router.get('/api/kiem-tra-ket-noi')
def health():
    return _model_health()

@router.get('/api/bo-mon')
def list_departments(ma_khoa: str='CNTT'):
    return _model_list_departments(ma_khoa=ma_khoa)

@router.get('/api/khoa/resolve')
def resolve_khoa(ten: str):
    return _model_resolve_khoa(ten=ten)

@router.get('/api/giang-vien')
def list_lecturers(ma_dot: str | None=None):
    return _model_list_lecturers(ma_dot=ma_dot)

@router.post('/api/giang-vien')
def create_lecturer(x: GiangVienIn):
    return _model_create_lecturer(x=x)

@router.put('/api/giang-vien/{ma_gv}')
def update_lecturer(ma_gv: str, x: GiangVienIn):
    return _model_update_lecturer(ma_gv=ma_gv, x=x)

@router.delete('/api/giang-vien/{ma_gv}')
def delete_lecturer(ma_gv: str):
    return _model_delete_lecturer(ma_gv=ma_gv)


try:
    from ..schemas.admin import GVThamGiaDotIn
    from ..models.admin_system import set_dot_lecturers as _model_set_dot_lecturers
except ImportError:
    from schemas.admin import GVThamGiaDotIn
    from models.admin_system import set_dot_lecturers as _model_set_dot_lecturers

@router.put('/api/dot-thi/{ma_dot}/giang-vien-tham-gia')
def set_dot_lecturers(ma_dot: str, x: GVThamGiaDotIn):
    return _model_set_dot_lecturers(ma_dot=ma_dot, x=x)
