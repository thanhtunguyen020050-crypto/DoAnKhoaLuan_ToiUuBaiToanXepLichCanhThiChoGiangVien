"""Xác thực và phân quyền bằng HMAC Token cho Giảng viên và Quản trị viên.
Tự động bảo vệ API, xác định danh tính phía server, ngăn chặn giả mạo MaGV.
"""
import os
import json
import time
import hmac
import base64
import hashlib
from fastapi import Header, HTTPException

SECRET_KEY = os.getenv("AUTH_SECRET_KEY", "huit-gacthi-secret-key-2026-very-secure-random-bytes-512")
TOKEN_TTL_SECONDS = 7 * 24 * 3600  # 7 ngày

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')

def _b64url_decode(s: str) -> bytes:
    padding = 4 - (len(s) % 4)
    if padding != 4:
        s += '=' * padding
    return base64.urlsafe_b64decode(s.encode('ascii'))

def create_token(payload: dict) -> str:
    """Tạo token được ký số bằng HMAC-SHA256."""
    header = {"alg": "HS256", "typ": "JWT"}
    p = dict(payload)
    now = int(time.time())
    p.setdefault("iat", now)
    p.setdefault("exp", now + TOKEN_TTL_SECONDS)
    
    hdr_b64 = _b64url_encode(json.dumps(header, separators=(',', ':')).encode('utf-8'))
    pay_b64 = _b64url_encode(json.dumps(p, separators=(',', ':')).encode('utf-8'))
    signing_input = f"{hdr_b64}.{pay_b64}".encode('ascii')
    
    sig = hmac.new(SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
    sig_b64 = _b64url_encode(sig)
    return f"{hdr_b64}.{pay_b64}.{sig_b64}"

def verify_token(token: str) -> dict:
    """Xác thực chữ ký số và thời hạn của token. Báo lỗi nếu không hợp lệ."""
    if not token or not isinstance(token, str):
        raise HTTPException(401, "Thiếu token xác thực.")
    parts = token.strip().split('.')
    if len(parts) != 3:
        raise HTTPException(401, "Định dạng token không hợp lệ.")
    
    hdr_b64, pay_b64, sig_b64 = parts
    signing_input = f"{hdr_b64}.{pay_b64}".encode('ascii')
    expected_sig = hmac.new(SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
    
    try:
        actual_sig = _b64url_decode(sig_b64)
    except Exception:
        raise HTTPException(401, "Chữ ký token không hợp lệ.")
        
    if not hmac.compare_digest(actual_sig, expected_sig):
        raise HTTPException(401, "Chữ ký token không hợp lệ.")
        
    try:
        payload = json.loads(_b64url_decode(pay_b64).decode('utf-8'))
    except Exception:
        raise HTTPException(401, "Dữ liệu token bị lỗi.")
        
    now = int(time.time())
    if "exp" in payload and now > payload["exp"]:
        raise HTTPException(401, "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.")
        
    return payload

def _extract_token_from_header(authorization: str | None = None, x_auth_token: str | None = None) -> str:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    if x_auth_token:
        return x_auth_token.strip()
    return ""

def get_current_user_payload(authorization: str | None = Header(default=None),
                             x_auth_token: str | None = Header(default=None)) -> dict:
    """Lấy payload người dùng từ Header Authorization. Bắt buộc đã đăng nhập."""
    token = _extract_token_from_header(authorization, x_auth_token)
    if not token:
        raise HTTPException(401, "Chưa đăng nhập. Vui lòng đăng nhập để tiếp tục.")
    return verify_token(token)

def require_lecturer(authorization: str | None = Header(default=None),
                     x_auth_token: str | None = Header(default=None)) -> str:
    """Xác thực giảng viên từ token phía server. Trả về MaGV hợp lệ.
    Tuyệt đối không tin mã giảng viên gửi từ client.
    """
    payload = get_current_user_payload(authorization, x_auth_token)
    role = payload.get("role")
    ma_gv = payload.get("sub") or payload.get("ma_gv")
    if role != "user" or not ma_gv:
        raise HTTPException(403, "Quyền truy cập bị từ chối. Chỉ giảng viên mới được thao tác.")
    return str(ma_gv).strip()

def require_admin(authorization: str | None = Header(default=None),
                  x_auth_token: str | None = Header(default=None)) -> str:
    """Xác thực quyền Admin từ token phía server. Trả về tên đăng nhập Admin."""
    payload = get_current_user_payload(authorization, x_auth_token)
    role = payload.get("role")
    username = payload.get("sub") or payload.get("username")
    if role != "admin" or not username:
        raise HTTPException(403, "Quyền truy cập bị từ chối. Chỉ quản trị viên mới có quyền thực hiện.")
    return str(username).strip()
