"""Reset the local Admin password without email/SMTP recovery."""

import getpass
import hashlib
import secrets
import sys
from pathlib import Path

from dotenv import load_dotenv

# Load this backend's config even when the script is launched from the repo root.
load_dotenv(dotenv_path=Path(__file__).resolve().with_name('.env'))

from ketnoi_sql import get_connection


def hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac(
        'sha256', password.encode('utf-8'), salt.encode('utf-8'), 260_000
    ).hex()


def validate_password(password: str) -> str | None:
    if not password:
        return 'Mật khẩu không được để trống.'
    return None


def main() -> int:
    password = getpass.getpass('Nhập mật khẩu Admin mới: ')
    error = validate_password(password)
    if error:
        print(error, file=sys.stderr)
        return 1
    if password != getpass.getpass('Nhập lại mật khẩu Admin mới: '):
        print('Hai mật khẩu không khớp.', file=sys.stderr)
        return 1

    salt = secrets.token_hex(16)
    password_hash = hash_password(password, salt)
    try:
        with get_connection() as connection:
            cursor = connection.cursor()
            cursor.execute("""
                IF NOT EXISTS (
                    SELECT 1 FROM sys.tables
                    WHERE name='TaiKhoanAdmin' AND schema_id=SCHEMA_ID('dbo')
                )
                CREATE TABLE dbo.TaiKhoanAdmin (
                    TenDangNhap NVARCHAR(120) PRIMARY KEY,
                    MatKhauHash NVARCHAR(200) NOT NULL,
                    Salt NVARCHAR(64) NOT NULL,
                    TaoLuc DATETIME DEFAULT GETDATE()
                )
            """)
            cursor.execute("""
                IF COL_LENGTH(N'dbo.TaiKhoanAdmin', N'Salt') IS NULL
                    ALTER TABLE dbo.TaiKhoanAdmin ADD Salt NVARCHAR(64) NULL
            """)
            cursor.execute(
                "SELECT 1 FROM dbo.TaiKhoanAdmin WHERE TenDangNhap=N'admin'"
            )
            if cursor.fetchone():
                cursor.execute(
                    "SELECT COL_LENGTH(N'dbo.TaiKhoanAdmin', N'LanCapNhatMatKhau')"
                )
                has_password_updated_at = cursor.fetchone()[0] is not None
                if has_password_updated_at:
                    cursor.execute(
                        "UPDATE dbo.TaiKhoanAdmin "
                        "SET MatKhauHash=?, Salt=?, LanCapNhatMatKhau=SYSDATETIME() "
                        "WHERE TenDangNhap=N'admin'",
                        password_hash,
                        salt,
                    )
                else:
                    cursor.execute(
                        "UPDATE dbo.TaiKhoanAdmin SET MatKhauHash=?, Salt=? "
                        "WHERE TenDangNhap=N'admin'",
                        password_hash,
                        salt,
                    )
            else:
                cursor.execute(
                    "INSERT INTO dbo.TaiKhoanAdmin "
                    "(TenDangNhap, MatKhauHash, Salt) VALUES (N'admin', ?, ?)",
                    password_hash,
                    salt,
                )
            connection.commit()
    except Exception as exc:
        print(f'Không đặt lại được mật khẩu Admin: {exc}', file=sys.stderr)
        return 1

    print('Đã đặt lại mật khẩu Admin. Bạn có thể đăng nhập bằng mật khẩu mới.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
