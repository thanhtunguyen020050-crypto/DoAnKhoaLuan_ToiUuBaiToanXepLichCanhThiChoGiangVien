"""Router xác thực quản trị viên."""

import hashlib

import secrets

from fastapi import APIRouter, HTTPException, Body

try:
    from ..ketnoi_sql import get_connection
    from ..auth_utils import create_token
except ImportError:
    from ketnoi_sql import get_connection
    from auth_utils import create_token

def _hash_password(password: str, salt: str) -> str:
    dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 260000)
    return dk.hex()

def _ensure_admin_table(cur):
    """Tạo bảng TaiKhoanAdmin nếu chưa tồn tại và seed tài khoản admin mặc định."""
    cur.execute("""
        IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='TaiKhoanAdmin' AND schema_id=SCHEMA_ID('dbo'))
        CREATE TABLE dbo.TaiKhoanAdmin (
            TenDangNhap NVARCHAR(120) PRIMARY KEY,
            MatKhauHash NVARCHAR(200) NOT NULL,
            Salt        NVARCHAR(64)  NOT NULL,
            TaoLuc      DATETIME      DEFAULT GETDATE()
        )
    """)
    # Older project databases already have TaiKhoanAdmin but predate salted
    # password hashes. Add the nullable column so the admin reset can migrate it.
    cur.execute("""
        IF COL_LENGTH(N'dbo.TaiKhoanAdmin', N'Salt') IS NULL
            ALTER TABLE dbo.TaiKhoanAdmin ADD Salt NVARCHAR(64) NULL
    """)
    cur.execute("SELECT 1 FROM dbo.TaiKhoanAdmin WHERE TenDangNhap=N'admin'")
    if not cur.fetchone():
        salt = secrets.token_hex(16)
        pw_hash = _hash_password('admin123', salt)
        cur.execute("INSERT INTO dbo.TaiKhoanAdmin (TenDangNhap,MatKhauHash,Salt) VALUES (N'admin',?,?)", pw_hash, salt)

def admin_login(payload: dict=None):
    username = str(payload.get('username', '')).strip()
    password = str(payload.get('password', ''))
    if not username or not password:
        raise HTTPException(status_code=400, detail='Vui lòng nhập tên đăng nhập và mật khẩu.')
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            _ensure_admin_table(cur)
            cn.commit()
            cur.execute('SELECT MatKhauHash, Salt FROM dbo.TaiKhoanAdmin WHERE TenDangNhap=?', username)
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=401, detail='Tên đăng nhập hoặc mật khẩu không đúng.')
            pw_hash, salt = row
            if not secrets.compare_digest(_hash_password(password, salt), pw_hash):
                raise HTTPException(status_code=401, detail='Tên đăng nhập hoặc mật khẩu không đúng.')
            token = create_token({'sub': username, 'username': username, 'role': 'admin'})
            return {'ok': True, 'role': 'admin', 'username': username, 'token': token}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f'Không kết nối được cơ sở dữ liệu: {e}')

def admin_change_password(payload: dict=None):
    username = str(payload.get('username', '')).strip()
    current_password = str(payload.get('current_password', ''))
    new_password = str(payload.get('new_password', ''))
    import re
    if len(new_password) < 8 or len(new_password) > 16 or (not re.search('[A-Z]', new_password)) or (not re.search('[^A-Za-z0-9]', new_password)):
        raise HTTPException(status_code=400, detail='Mật khẩu mới phải dài 8–16 ký tự, có ít nhất một chữ in hoa và một ký tự đặc biệt.')
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            _ensure_admin_table(cur)
            cur.execute('SELECT MatKhauHash, Salt FROM dbo.TaiKhoanAdmin WHERE TenDangNhap=?', username)
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail='Không tìm thấy tài khoản Admin.')
            pw_hash, salt = row
            if not secrets.compare_digest(_hash_password(current_password, salt), pw_hash):
                raise HTTPException(status_code=401, detail='Mật khẩu hiện tại không đúng.')
            new_salt = secrets.token_hex(16)
            new_hash = _hash_password(new_password, new_salt)
            cur.execute('UPDATE dbo.TaiKhoanAdmin SET MatKhauHash=?, Salt=? WHERE TenDangNhap=?', new_hash, new_salt, username)
            cn.commit()
            return {'ok': True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f'Không kết nối được cơ sở dữ liệu: {e}')
