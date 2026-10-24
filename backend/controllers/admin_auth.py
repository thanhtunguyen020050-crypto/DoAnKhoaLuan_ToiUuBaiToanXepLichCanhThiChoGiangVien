"""FastAPI Controller: HTTP endpoint, validation and delegation to Model."""

from fastapi import APIRouter, Body

try:
    from ..models.admin_auth import admin_login as _model_admin_login, admin_change_password as _model_admin_change_password
except ImportError:
    from models.admin_auth import admin_login as _model_admin_login, admin_change_password as _model_admin_change_password

router = APIRouter(tags=["Xác thực quản trị"])

@router.post('/api/auth/admin-login')
def admin_login(payload: dict=Body(...)):
    return _model_admin_login(payload=payload)

@router.post('/api/auth/admin-change-password')
def admin_change_password(payload: dict=Body(...)):
    return _model_admin_change_password(payload=payload)
