"""Router quản trị - lịch dạy và lịch bận của API FastAPI."""

from fastapi import APIRouter, HTTPException

try:
    from ..ketnoi_sql import get_connection
    from ..schemas.admin import LichDayImportRow, LichBanImportRow
    from .admin_helpers import BUSY_REASONS, _norm_name, dict_rows
except ImportError:
    from ketnoi_sql import get_connection
    from schemas.admin import LichDayImportRow, LichBanImportRow
    from models.admin_helpers import BUSY_REASONS, _norm_name, dict_rows

def teaching_schedule(ma_gv: str):
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('SELECT ID,CONVERT(varchar(10),NgayDay,23) NgayDay,TuTiet,DenTiet,NguonFile,GhiChu FROM dbo.LichDayGV WHERE MaGV=? ORDER BY NgayDay,TuTiet,DenTiet', ma_gv)
            return {'items': dict_rows(cur)}
    except Exception as e:
        raise HTTPException(500, f'Lỗi đọc lịch dạy: {e}')

def replace_teaching(ma_gv: str, items: list[dict]):
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute("SELECT 1 FROM dbo.GiangVien WHERE MaGV=? AND TrangThai=N'Đang công tác'", ma_gv)
            if not cur.fetchone():
                raise HTTPException(404, 'Giảng viên không tồn tại hoặc không còn công tác.')
            cur.execute('DELETE FROM dbo.LichDayGV WHERE MaGV=?', ma_gv)
            for x in items:
                cur.execute('EXEC dbo.sp_ThemLichDayGV ?,?,?,?,?,?', ma_gv, x['ngay_day'], x['tu_tiet'], x['den_tiet'], x.get('nguon_file'), x.get('ghi_chu'))
            cn.commit()
            return {'ok': True, 'count': len(items)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f'Lỗi lưu lịch dạy: {e}')

def import_teaching(rows: list[LichDayImportRow], filename: str | None=None):
    if not rows:
        raise HTTPException(400, 'File không có dữ liệu lịch dạy hợp lệ.')
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute("SELECT MaGV,HoTen FROM dbo.GiangVien WHERE TrangThai=N'Đang công tác'")
            db = cur.fetchall()
            by_name = {}
            for ma, ten in db:
                by_name.setdefault(ten.strip().casefold(), []).append((ma, ten))
            grouped = {}
            errors = []
            for r in rows:
                matches = by_name.get(r.name.strip().casefold(), [])
                if not matches:
                    errors.append({'line': r.line, 'name': r.name, 'msg': 'Không tìm thấy giảng viên này trong CSDL. Hãy thêm giảng viên trước khi import lịch dạy.'})
                    continue
                if len(matches) > 1:
                    errors.append({'line': r.line, 'name': r.name, 'msg': 'Tên giảng viên bị trùng trong CSDL, không thể xác định MaGV.'})
                    continue
                grouped.setdefault(matches[0][0], []).append(r)
            if errors:
                raise HTTPException(status_code=400, detail={'message': 'Import lịch dạy bị từ chối vì có giảng viên chưa khớp CSDL.', 'errors': errors})
            total_inserted = 0
            for ma, items in grouped.items():
                cur.execute('DELETE FROM dbo.LichDayGV WHERE MaGV=?', ma)
                seen = set()
                for r in items:
                    key = (r.date, r.start, r.end)
                    if key in seen:
                        continue
                    seen.add(key)
                    cur.execute('EXEC dbo.sp_ThemLichDayGV ?,?,?,?,?,?', ma, r.date, r.start, r.end, filename, None)
                    total_inserted += 1
            cn.commit()
            return {'ok': True, 'teachers': len(grouped), 'rows': total_inserted, 'duplicates_skipped': len(rows) - total_inserted}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f'Lỗi import lịch dạy: {e}')

def busy_schedule(ma_gv: str):
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('\nSELECT ID,CONVERT(varchar(10),NgayBan,23) NgayBan,TuTiet,DenTiet,LyDo,UuTien\nFROM dbo.LichBanGV WHERE MaGV=? ORDER BY NgayBan,TuTiet\n', ma_gv)
            rows = dict_rows(cur)
            for x in rows:
                x['UuTien'] = x.get('UuTien') or BUSY_REASONS.get(x.get('LyDo'), 3)
            return {'items': rows}
    except Exception as e:
        raise HTTPException(500, f'Lỗi đọc lịch bận: {e}')

def clear_all_teaching():
    """Xóa toàn bộ lịch dạy của tất cả giảng viên."""
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('DELETE FROM dbo.LichDayGV')
            deleted = cur.rowcount
            cn.commit()
            return {'ok': True, 'deleted': deleted}
    except Exception as e:
        raise HTTPException(400, f'Lỗi xóa lịch dạy: {e}')

def clear_all_busy():
    """Xóa toàn bộ lịch bận của tất cả giảng viên."""
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('DELETE FROM dbo.LichBanGV')
            deleted = cur.rowcount
            cn.commit()
            return {'ok': True, 'deleted': deleted}
    except Exception as e:
        raise HTTPException(400, f'Lỗi xóa lịch bận: {e}')

def replace_busy(ma_gv: str, items: list[dict]):
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute("SELECT 1 FROM dbo.GiangVien WHERE MaGV=? AND TrangThai=N'Đang công tác'", ma_gv)
            if not cur.fetchone():
                raise HTTPException(404, 'Giảng viên không tồn tại hoặc không còn công tác.')
            cur.execute('DELETE FROM dbo.LichBanGV WHERE MaGV=?', ma_gv)
            for x in items:
                ly_do = x.get('ly_do')
                if ly_do not in BUSY_REASONS and ly_do is not None:
                    raise HTTPException(400, 'Lý do lịch bận không hợp lệ.')
                uu_tien = BUSY_REASONS.get(ly_do, 3)
                cur.execute('EXEC dbo.sp_ThemLichBanGV ?,?,?,?,?,?', ma_gv, x['ngay_ban'], x['tu_tiet'], x['den_tiet'], ly_do, uu_tien)
            cn.commit()
            return {'ok': True, 'count': len(items)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f'Lỗi lưu lịch bận: {e}')

def import_busy(rows: list[LichBanImportRow], filename: str | None=None):
    import datetime
    if not rows:
        raise HTTPException(400, 'File không có dữ liệu lịch bận hợp lệ.')
    allowed_sessions = {'Sáng': (1, 6), 'Chiều': (7, 12), 'Cả ngày': (1, 12)}
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute("SELECT MaGV,HoTen FROM dbo.GiangVien WHERE TrangThai=N'Đang công tác'")
            db = cur.fetchall()
            by_name = {}
            for ma, ten in db:
                by_name.setdefault(_norm_name(ten), []).append((ma, ten))
            errors = []
            parsed = []
            for r in rows:
                try:
                    d = datetime.date.fromisoformat(r.date)
                except Exception:
                    errors.append({'line': r.line, 'name': r.name, 'msg': 'Ngày không hợp lệ. Hệ thống cần ngày thực tế, ví dụ 22/1/2026 hoặc 22/01/2026.'})
                    continue
                if r.session not in allowed_sessions:
                    errors.append({'line': r.line, 'name': r.name, 'msg': 'Buổi phải là Sáng, Chiều hoặc Cả ngày.'})
                    continue
                if r.reason not in BUSY_REASONS:
                    errors.append({'line': r.line, 'name': r.name, 'msg': 'Lý do không nằm trong 3 lý do được phép.'})
                    continue
                matches = by_name.get(_norm_name(r.name), [])
                if not matches:
                    errors.append({'line': r.line, 'name': r.name, 'msg': 'Không tìm thấy giảng viên này trong CSDL. Kiểm tra lại Họ tên.'})
                    continue
                if len(matches) > 1:
                    errors.append({'line': r.line, 'name': r.name, 'msg': 'Tên giảng viên bị trùng trong CSDL, không thể xác định MaGV.'})
                    continue
                parsed.append((matches[0][0], matches[0][1], d, r.session, r.reason, r.line))
            if errors:
                raise HTTPException(status_code=400, detail={'message': 'Import lịch bận bị từ chối vì có dòng không hợp lệ. Không thay đổi dữ liệu SQL.', 'errors': errors})
            grouped = {}
            for ma, ten, d, session, reason, line in parsed:
                sessions = ['Sáng', 'Chiều'] if session == 'Cả ngày' else [session]
                for ses in sessions:
                    key = (ma, d.isoformat(), ses)
                    old = grouped.get(key)
                    if old is None or BUSY_REASONS[reason] < BUSY_REASONS[old[4]]:
                        grouped[key] = (ma, ten, d, ses, reason, line)
            teachers = sorted({x[0] for x in grouped.values()})
            for ma in teachers:
                cur.execute('DELETE FROM dbo.LichBanGV WHERE MaGV=?', ma)
            for ma, ten, d, ses, reason, line in grouped.values():
                start, end = allowed_sessions[ses]
                cur.execute('EXEC dbo.sp_ThemLichBanGV ?,?,?,?,?,?', ma, d.isoformat(), start, end, reason, BUSY_REASONS[reason])
            cn.commit()
            return {'ok': True, 'teachers': len(teachers), 'rows': len(grouped), 'input_rows': len(rows), 'matched_names': len({x[1] for x in grouped.values()}), 'message': 'Import lịch bận thành công. Chỉ thay thế lịch bận của các giảng viên có trong file.'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f'Lỗi import lịch bận: {e}')
