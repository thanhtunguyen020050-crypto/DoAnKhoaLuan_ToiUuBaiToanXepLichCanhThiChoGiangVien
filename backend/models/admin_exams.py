"""Router quản trị - đợt thi và ca thi của API FastAPI."""

import unicodedata
import logging
from fastapi import APIRouter, HTTPException

try:
    from ..ketnoi_sql import get_connection
    from ..rb7 import read_min_travel_slots, rb7_teaching_exam_violation
    from ..schemas.admin import DotThiIn, CaThiIn, LuuPhanCongIn, DinhMucChungIn, DinhMucGiangVienIn
    from .admin_helpers import dict_rows, _thu_vn, _drain
    from .busy_requests import _calendar_date, _load_lecturer_calendar
except ImportError:
    from ketnoi_sql import get_connection
    from rb7 import read_min_travel_slots, rb7_teaching_exam_violation
    from schemas.admin import DotThiIn, CaThiIn, LuuPhanCongIn, DinhMucChungIn, DinhMucGiangVienIn
    from models.admin_helpers import dict_rows, _thu_vn, _drain
    from models.busy_requests import _calendar_date, _load_lecturer_calendar

logger = logging.getLogger(__name__)

def list_exam_periods():
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('EXEC dbo.sp_DanhSachDotThi')
            return {'items': dict_rows(cur)}
    except Exception as e:
        raise HTTPException(500, f'Lỗi đọc đợt thi: {e}')

def latest_exam_period():
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('SELECT TOP 1 MaDot,TenDot,HocKy,NamHoc,LoaiDot,NgayBatDau,NgayKetThuc,GhiChu FROM dbo.DotThi ORDER BY NgayBatDau DESC,MaDot DESC')
            r = cur.fetchone()
            return dict(zip([c[0] for c in cur.description], r)) if r else {}
    except Exception as e:
        raise HTTPException(500, str(e))

def create_exam_period(x: DotThiIn):
    ma_dot = f"{x.hoc_ky}_{x.nam_hoc.replace('-', '')}"
    ten = f'Đợt thi {x.hoc_ky} năm học {x.nam_hoc}'
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('EXEC dbo.sp_ThemDotThi ?,?,?,?,?,?,?', ma_dot, ten, x.hoc_ky, x.nam_hoc, x.ngay_bat_dau, x.ngay_ket_thuc, x.ghi_chu)
            cn.commit()
            return {'ok': True, 'ma_dot': ma_dot}
    except Exception as e:
        raise HTTPException(400, str(e))

def update_exam_period(ma_dot: str, x: DotThiIn):
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('EXEC dbo.sp_SuaDotThi ?,?,?,?,?,?,?', ma_dot, f'Đợt thi {x.hoc_ky} năm học {x.nam_hoc}', x.hoc_ky, x.nam_hoc, x.ngay_bat_dau, x.ngay_ket_thuc, x.ghi_chu)
            cn.commit()
            return {'ok': True, 'ma_dot': ma_dot}
    except Exception as e:
        raise HTTPException(400, str(e))

def delete_exam_period(ma_dot: str):
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('EXEC dbo.sp_XoaDotThi ?', ma_dot)
            cn.commit()
            return {'ok': True}
    except Exception as e:
        raise HTTPException(400, str(e))

def list_exam_shifts(ma_dot: str | None=None):
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('EXEC dbo.sp_DanhSachCaThi ?', ma_dot)
            return {'items': dict_rows(cur)}
    except Exception as e:
        raise HTTPException(500, f'Lỗi đọc ca thi: {e}')


def list_rb9_other_exam_events(ma_dot: str):
    """Read other-round assignments that SQL RB9 includes in continuous runs."""
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('''
                SELECT p.MaGV,c.MaDot,c.NgayThi AS NgayThi,c.TuTiet,c.DenTiet
                FROM dbo.PhanCongCoiThi p
                JOIN dbo.CaThi c ON c.MaCa=p.MaCa
                WHERE c.MaDot<>?
                  AND EXISTS (
                      SELECT 1 FROM dbo.DinhMucPhanCong d
                      WHERE d.MaDot=? AND d.MaGV=p.MaGV
                  )
                ORDER BY p.MaGV,c.NgayThi,c.TuTiet,c.DenTiet,c.MaCa
            ''', ma_dot, ma_dot)
            return {'items': dict_rows(cur)}
    except Exception as e:
        raise HTTPException(500, f'Lỗi đọc lịch thi các đợt khác để kiểm tra RB9: {e}')

def save_exam_assignments(ma_dot: str, x: LuuPhanCongIn):
    """Validate and save assignments against the quotas already stored in SQL."""
    pairs = [(a.ma_ca.strip(), a.ma_gv.strip()) for a in x.assignments]
    if len(pairs) != len(set(pairs)):
        raise HTTPException(400, 'Danh sách có phân công bị lặp.')
    cn = None
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            min_travel_slots = read_min_travel_slots(cur, ma_dot)
            # Refresh integer quotas using only the persisted SQL percentages.
            # The browser payload x.dinh_muc is deliberately ignored here.
            cur.execute('EXEC dbo.sp_TinhDinhMucTheoTyLe ?', ma_dot)
            _drain(cur)
            cur.execute('''
                SELECT
                    COALESCE((SELECT SUM(SoCaQuyDinh) FROM dbo.DinhMucPhanCong WHERE MaDot=?),0),
                    COALESCE((SELECT SUM(SoGVCanCap) FROM dbo.CaThi WHERE MaDot=?),0)
            ''', ma_dot, ma_dot)
            quota_total, required_total = cur.fetchone()
            if int(quota_total or 0) != int(required_total or 0):
                raise HTTPException(409,
                    f'Định mức SQL chưa đồng bộ: tổng định mức {int(quota_total or 0)} ca, '
                    f'nhưng đợt thi cần {int(required_total or 0)} lượt. Hãy tính lại định mức trước khi công bố.')
            cur.execute('CREATE TABLE #LuuPhanCong (MaCa VARCHAR(50) COLLATE DATABASE_DEFAULT NOT NULL, MaGV VARCHAR(20) COLLATE DATABASE_DEFAULT NOT NULL, PRIMARY KEY(MaCa,MaGV))')
            if pairs:
                cur.executemany('INSERT INTO #LuuPhanCong(MaCa,MaGV) VALUES (?,?)', pairs)
            cur.execute('SELECT TOP 1 r.MaCa FROM #LuuPhanCong r LEFT JOIN dbo.CaThi c ON c.MaCa=r.MaCa AND c.MaDot=? WHERE c.MaCa IS NULL', ma_dot)
            if cur.fetchone():
                raise HTTPException(400, 'Danh sách có ca thi không thuộc đợt thi đã chọn.')
            cur.execute("SELECT TOP 1 r.MaGV FROM #LuuPhanCong r LEFT JOIN dbo.GiangVien g ON g.MaGV=r.MaGV AND g.TrangThai=N'Đang công tác' WHERE g.MaGV IS NULL")
            if cur.fetchone():
                raise HTTPException(400, 'Danh sách có giảng viên không tồn tại hoặc không còn công tác.')

            # A quota deviation is valid only when it comes from a recorded,
            # admin-approved cover and the submitted schedule still assigns
            # that exact exam shift to the approved replacement.
            cur.execute('''CREATE TABLE #ApprovedQuotaTransfers (
                               MaYeuCau BIGINT NOT NULL PRIMARY KEY,
                               MaCa VARCHAR(50) COLLATE DATABASE_DEFAULT NOT NULL,
                               MaGVTruoc VARCHAR(20) COLLATE DATABASE_DEFAULT NOT NULL,
                               MaGVSau VARCHAR(20) COLLATE DATABASE_DEFAULT NOT NULL)''')
            cur.execute(''';WITH ApprovedHistory AS (
                               SELECT ls.MaYeuCau,ls.MaCa,ls.MaGV,ls.MaGVThayThe,
                                      ROW_NUMBER() OVER(PARTITION BY ls.MaCa ORDER BY ls.MaLichSu DESC) AS RN
                               FROM dbo.LichSuDieuChinhLich ls
                               JOIN dbo.YeuCauBaoBan y ON y.MaYeuCau=ls.MaYeuCau AND y.TrangThai='APPROVED'
                               JOIN dbo.CaThi c ON c.MaCa=ls.MaCa AND c.MaDot=?
                               WHERE ls.HanhDong='DUYET_DOI_LICH'
                                 AND ls.MaGV IS NOT NULL AND ls.MaGVThayThe IS NOT NULL
                           ), EffectiveCovers AS (
                               SELECT MaCa,MaGVThayThe FROM ApprovedHistory WHERE RN=1
                           )
                           INSERT INTO #ApprovedQuotaTransfers(MaYeuCau,MaCa,MaGVTruoc,MaGVSau)
                           SELECT h.MaYeuCau,h.MaCa,h.MaGV,h.MaGVThayThe
                           FROM ApprovedHistory h
                           JOIN EffectiveCovers e ON e.MaCa=h.MaCa
                           JOIN #LuuPhanCong r ON r.MaCa=e.MaCa AND r.MaGV=e.MaGVThayThe''', ma_dot)
            cur.execute(
                """
                SELECT TOP 1 r.MaGV
                FROM #LuuPhanCong r
                LEFT JOIN dbo.DinhMucPhanCong d ON d.MaDot=? AND d.MaGV=r.MaGV
                WHERE d.MaGV IS NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM #ApprovedQuotaTransfers t
                      WHERE t.MaCa=r.MaCa AND t.MaGVSau=r.MaGV
                  )
                """,
                ma_dot,
            )
            if cur.fetchone():
                raise HTTPException(400, 'Danh sách có giảng viên chưa được chọn tham gia đợt thi.')

            # Every lecturer must match the exact stored quota, adjusted only
            # by the net effect of approved cover transfers in this schedule.
            # No browser-provided percentage and no +/-1 tolerance is used.
            cur.execute('''
                ;WITH LecturerScope AS (
                    SELECT MaGV FROM dbo.DinhMucPhanCong WHERE MaDot=?
                    UNION SELECT MaGVTruoc FROM #ApprovedQuotaTransfers
                    UNION SELECT MaGVSau FROM #ApprovedQuotaTransfers
                ), TransferDelta AS (
                    SELECT MaGV,SUM(Delta) AS Delta
                    FROM (
                        SELECT MaGVTruoc AS MaGV,-1 AS Delta FROM #ApprovedQuotaTransfers
                        UNION ALL
                        SELECT MaGVSau AS MaGV,1 AS Delta FROM #ApprovedQuotaTransfers
                    ) t
                    GROUP BY MaGV
                ), AssignmentCounts AS (
                    SELECT MaGV,COUNT(*) AS SoCaDuocXep
                    FROM #LuuPhanCong GROUP BY MaGV
                )
                SELECT TOP 1 s.MaGV,
                       ISNULL(MAX(d.SoCaQuyDinh),0)+ISNULL(MAX(td.Delta),0) AS SoCaCanXep,
                       ISNULL(MAX(ac.SoCaDuocXep),0) AS SoCaDuocXep
                FROM LecturerScope s
                LEFT JOIN dbo.DinhMucPhanCong d ON d.MaDot=? AND d.MaGV=s.MaGV
                LEFT JOIN TransferDelta td ON td.MaGV=s.MaGV
                LEFT JOIN AssignmentCounts ac ON ac.MaGV=s.MaGV
                GROUP BY s.MaGV
                HAVING ISNULL(MAX(ac.SoCaDuocXep),0)<>
                       ISNULL(MAX(d.SoCaQuyDinh),0)+ISNULL(MAX(td.Delta),0)
            ''', ma_dot, ma_dot)
            quota_mismatch = cur.fetchone()
            if quota_mismatch:
                raise HTTPException(409,
                    f"Định mức chưa khớp (định mức SQL cộng/trừ đổi ca đã duyệt): giảng viên {quota_mismatch[0]} cần đúng "
                    f"{quota_mismatch[1]} ca, hiện có {quota_mismatch[2]} ca.")

            # Fail closed unless SQL exposes the required invigilator count.
            cur.execute('''SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                           WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='CaThi'
                           ORDER BY ORDINAL_POSITION''')
            ca_columns = [r[0] for r in cur.fetchall()]
            required_aliases = {
                'sogvcancap', 'sogvcan', 'sogiamthican', 'soluonggvcancap', 'soluonggiamthican',
                'sogvyeucau', 'soluonggvcan', 'sogiangviencan', 'yeucaugiamthi',
                'sogiangvienyeucau', 'soluonggiangviencan', 'sogvyeucaucan'
            }
            normalized_columns = {
                ''.join(ch.lower() for ch in name if ch.isalnum()): name for name in ca_columns
            }
            required_column = next((normalized_columns[name] for name in required_aliases
                                    if name in normalized_columns), None)
            if not required_column:
                raise HTTPException(500,
                    'Không xác định được cột số giám thị cần cấp trong CaThi; đã hủy lưu để tránh công bố lịch thiếu giám thị.')
            cur.execute(f'''SELECT TOP 1 c.MaCa, ISNULL(c.[{required_column}],0), COUNT(r.MaGV)
                            FROM dbo.CaThi c
                            LEFT JOIN #LuuPhanCong r ON r.MaCa=c.MaCa
                            WHERE c.MaDot=?
                            GROUP BY c.MaCa,c.[{required_column}]
                            HAVING COUNT(r.MaGV)<>ISNULL(c.[{required_column}],0)''', ma_dot)
            missing_staff = cur.fetchone()
            if missing_staff:
                raise HTTPException(409,
                    f"Ca {missing_staff[0]} cần đúng {missing_staff[1]} giảng viên, "
                    f"hiện được xếp {missing_staff[2]}.")

            # Validate all hard time rules against the proposed rows before
            # replacing the current official assignments.
            cur.execute('''SELECT r.MaGV,c.MaCa,c.NgayThi,c.TuTiet,c.DenTiet,c.Buoi,
                                  c.NhomHinhThucThi,c.HinhThucThi,c.PhongThi
                           FROM #LuuPhanCong r JOIN dbo.CaThi c ON c.MaCa=r.MaCa
                           WHERE c.MaDot=?''', ma_dot)
            proposed = cur.fetchall()
            by_lecturer = {}
            for row in proposed:
                by_lecturer.setdefault(row[0], []).append(row)

            def exam_form(row):
                value = str(row[6] or row[7] or '').strip().casefold()
                normalized = ''.join(
                    ch for ch in unicodedata.normalize('NFKD', value)
                    if not unicodedata.combining(ch) and ch.isalnum()
                )
                if 'tuluan' in normalized or 'essay' in normalized:
                    return 'tuluan'
                if 'lythuyet' in normalized or 'tracnghiem' in normalized or 'multiplechoice' in normalized:
                    return 'lythuyet'
                return normalized

            for ma_gv, shifts in by_lecturer.items():
                # No overlapping exam shifts and no mixing exam forms within
                # the same date/session.
                for index, left in enumerate(shifts):
                    for right in shifts[index + 1:]:
                        if _calendar_date(left[2]) != _calendar_date(right[2]):
                            continue
                        if left[3] <= right[4] and right[3] <= left[4]:
                            raise HTTPException(409,
                                f'Giảng viên {ma_gv} bị xếp trùng giờ ở ca {left[1]} và {right[1]}.')
                        left_form, right_form = exam_form(left), exam_form(right)
                        if left_form not in {'lythuyet', 'tuluan'} or right_form not in {'lythuyet', 'tuluan'}:
                            raise HTTPException(409,
                                f'Không xác định được hình thức thi ở ca {left[1]} hoặc {right[1]}; chưa lưu phân công.')
                        if str(left[5] or '').strip().casefold() == str(right[5] or '').strip().casefold() \
                                and left_form != right_form:
                            raise HTTPException(409,
                                f'Giảng viên {ma_gv} bị xếp trộn hình thức thi trong cùng buổi ngày {left[2]}.')
                calendars = (
                    ('LichDayGV', 'lịch dạy', _load_lecturer_calendar(cur, 'LichDayGV', ma_gv)),
                    ('PhanCongTrucDe', 'lịch trực đề', _load_lecturer_calendar(cur, 'PhanCongTrucDe', ma_gv)),
                )
                for shift in shifts:
                    shift_date = _calendar_date(shift[2])
                    for table_name, label, calendar in calendars:
                        for event in calendar:
                            if event['date'] != shift_date:
                                continue
                            if event['start'] <= shift[4] and shift[3] <= event['end']:
                                raise HTTPException(409,
                                    f"Giảng viên {ma_gv} bị trùng {label} tiết {event['start']}–{event['end']} "
                                    f"với ca {shift[1]}.")
                            if table_name == 'LichDayGV' and rb7_teaching_exam_violation(
                                    event['location'], event['start'], event['end'], shift[3], shift[4],
                                    min_travel_slots):
                                raise HTTPException(409,
                                    f"[RB7] Giảng viên {ma_gv} thiếu {min_travel_slots} tiết di chuyển "
                                    f"giữa lịch dạy (tiết {event['start']}–{event['end']}, "
                                    f"phòng/cơ sở {event['location']}) và ca {shift[1]}.")
                    cur.execute('''SELECT TOP 1 b.TuTiet,b.DenTiet,b.LyDo
                                   FROM dbo.LichBanGV b
                                   WHERE b.MaGV=? AND b.UuTien=1 AND b.NgayBan=?
                                     AND b.TuTiet<=? AND ?<=b.DenTiet''',
                                ma_gv, shift[2], shift[4], shift[3])
                    busy = cur.fetchone()
                    if busy:
                        raise HTTPException(409,
                            f"Giảng viên {ma_gv} trùng lịch bận mức 1 ({busy[2]}) "
                            f"ở tiết {busy[0]}–{busy[1]} với ca {shift[1]}.")
            cur.execute('DELETE p FROM dbo.PhanCongCoiThi p INNER JOIN dbo.CaThi c ON c.MaCa=p.MaCa WHERE c.MaDot=?', ma_dot)
            cur.execute('INSERT INTO dbo.PhanCongCoiThi(MaCa,MaGV) SELECT MaCa,MaGV FROM #LuuPhanCong')
            cur.execute('EXEC dbo.sp_KiemTraRangBuoc ?,1', ma_dot)
            _drain(cur)
            cur.execute('EXEC dbo.sp_ChotXepLich ?', ma_dot)
            _drain(cur)
            cn.commit()
            return {'ok': True, 'ma_dot': ma_dot, 'assignments_saved': len(pairs)}
    except HTTPException:
        if cn is not None:
            try:
                cn.rollback()
            except Exception:
                logger.exception('Rollback failed while saving assignments for MaDot=%s', ma_dot)
        raise
    except Exception as e:
        if cn is not None:
            try:
                cn.rollback()
            except Exception:
                logger.exception('Rollback failed while saving assignments for MaDot=%s', ma_dot)
        logger.exception('Could not save assignments for MaDot=%s', ma_dot)
        raise HTTPException(400, f'Không lưu được phân công vào SQL Server: {e}')

def remove_saved_assignments(ma_dot: str):
    """Gỡ lịch đã công bố khỏi bảng phân công, giữ nguyên các ca thi và lịch sử."""
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('SELECT 1 FROM dbo.DotThi WHERE MaDot=?', ma_dot)
            if not cur.fetchone():
                raise HTTPException(404, 'Không tìm thấy đợt thi.')
            cur.execute("""SELECT TOP 1 y.ID
                           FROM dbo.YeuCauDoiCa y
                           JOIN dbo.CaThi c ON c.MaCa=y.MaCaGui
                           WHERE c.MaDot=? AND y.TrangThai='Pending'""", ma_dot)
            if cur.fetchone():
                raise HTTPException(409, 'Đợt thi còn yêu cầu đổi ca đang chờ xử lý. Hãy xử lý các yêu cầu trước khi gỡ lịch.')
            cur.execute('SELECT COUNT(*) FROM dbo.PhanCongCoiThi p JOIN dbo.CaThi c ON c.MaCa=p.MaCa WHERE c.MaDot=?', ma_dot)
            count = int(cur.fetchone()[0] or 0)
            cur.execute('DELETE p FROM dbo.PhanCongCoiThi p JOIN dbo.CaThi c ON c.MaCa=p.MaCa WHERE c.MaDot=?', ma_dot)
            cn.commit()
            return {'ok': True, 'ma_dot': ma_dot, 'assignments_deleted': count}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f'Không gỡ được phân công đã lưu: {e}')

def create_exam_shift(x: CaThiIn):
    import datetime
    try:
        d = datetime.date.fromisoformat(x.ngay_thi)
    except Exception:
        raise HTTPException(400, 'Ngày thi không hợp lệ.')
    ma_dot = x.ma_dot or f"{x.hoc_ky}_{x.nam_hoc.replace('-', '')}"
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('SELECT MaDot,NgayBatDau,NgayKetThuc FROM dbo.DotThi WHERE MaDot=?', (ma_dot,))
            dot = cur.fetchone()
            if not dot:
                cur.execute('SELECT MaDot,NgayBatDau,NgayKetThuc FROM dbo.DotThi WHERE HocKy=? AND NamHoc=?', (x.hoc_ky, x.nam_hoc))
                dot = cur.fetchone()
                if dot:
                    ma_dot = dot[0]
            if not dot:
                cur.execute('EXEC dbo.sp_ThemDotThi ?,?,?,?,?,?,?', ma_dot, f'Đợt thi {x.hoc_ky} năm học {x.nam_hoc}', x.hoc_ky, x.nam_hoc, x.ngay_thi, x.ngay_thi, 'Tạo tự động từ form tiếp nhận lịch thi')
                _drain(cur)
            else:
                bd, kt = (dot[1], dot[2])
                nb = min(bd, d)
                nk = max(kt, d)
                if nb != bd or nk != kt:
                    cur.execute('SELECT HocKy,NamHoc FROM dbo.DotThi WHERE MaDot=?', ma_dot)
                    rr = cur.fetchone()
                    cur.execute('EXEC dbo.sp_SuaDotThi ?,?,?,?,?,?,?', ma_dot, f'Đợt thi {x.hoc_ky} năm học {x.nam_hoc}', x.hoc_ky, x.nam_hoc, nb.isoformat(), nk.isoformat(), 'Cập nhật tự động từ form tiếp nhận lịch thi')
                    _drain(cur)
            code = f"{ma_dot}_{d.strftime('%Y%m%d')}_{x.tu_tiet:02d}_{x.den_tiet:02d}"
            cur.execute('EXEC dbo.sp_ThemCaThi ?,?,?,?,?,?,?,?,?,?', code, ma_dot, x.ngay_thi, _thu_vn(x.ngay_thi), x.tu_tiet, x.den_tiet, x.hinh_thuc_thi, x.so_gv_can_cap, None, None)
            _drain(cur)
            cn.commit()
            return {'ok': True, 'ma_ca': code, 'ma_dot': ma_dot}
    except Exception as e:
        raise HTTPException(400, str(e))

def update_exam_shift(ma_ca: str, x: CaThiIn):
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('EXEC dbo.sp_SuaCaThi ?,?,?,?,?,?,?,?,?', ma_ca, x.ngay_thi, _thu_vn(x.ngay_thi), x.tu_tiet, x.den_tiet, x.hinh_thuc_thi, x.so_gv_can_cap, None, None)
            _drain(cur)
            cn.commit()
            return {'ok': True}
    except Exception as e:
        raise HTTPException(400, str(e))

def clear_all_exams():
    """Xóa ca thi và dữ liệu yêu cầu đổi ca phụ thuộc trong một transaction."""
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('EXEC dbo.sp_XoaTatCaCaThi')
            row = cur.fetchone()
            deleted = int(row[0]) if row and row[0] is not None else 0
            _drain(cur)
            cn.commit()
            return {'ok': True, 'deleted': deleted}
    except Exception as e:
        raise HTTPException(400, f'Lỗi xóa ca thi: {e}')

def delete_exam_shift(ma_ca: str):
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('EXEC dbo.sp_XoaCaThi ?', ma_ca)
            _drain(cur)
            cn.commit()
            return {'ok': True}
    except Exception as e:
        raise HTTPException(400, str(e))

def set_common_quota(x: DinhMucChungIn):
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            cur.execute('SELECT 1 FROM dbo.DotThi WHERE MaDot=?', x.ma_dot)
            if not cur.fetchone():
                raise HTTPException(404, 'Đợt thi không tồn tại.')
            if x.ma_khoa:
                cur.execute('SELECT 1 FROM dbo.Khoa WHERE MaKhoa=?', x.ma_khoa)
                if not cur.fetchone():
                    raise HTTPException(404, 'Khoa không tồn tại.')
            khoa_filter = ' AND bm.MaKhoa=?' if x.ma_khoa else ''
            scope_params = (x.ma_dot, x.ma_khoa) if x.ma_khoa else (x.ma_dot,)
            # DinhMucPhanCong is the membership list for a lecturer in an exam
            # period. Updating a common quota must never create membership rows
            # for every active lecturer; only update the already selected set.
            cur.execute('''SELECT COUNT(*)
                           FROM dbo.DinhMucPhanCong d
                           JOIN dbo.GiangVien g ON g.MaGV=d.MaGV
                           JOIN dbo.BoMon bm ON bm.MaBoMon=g.MaBoMon
                           WHERE d.MaDot=? AND g.TrangThai=N'Đang công tác' ''' + khoa_filter,
                        *scope_params)
            lecturer_count = int(cur.fetchone()[0] or 0)
            if not lecturer_count:
                raise HTTPException(400, 'Đợt thi chưa có giảng viên tham gia trong phạm vi đã chọn.')

            cur.execute('''UPDATE d SET TyLeDinhMuc=?,GhiChu=N'Đặt định mức chung'
                           FROM dbo.DinhMucPhanCong d
                           JOIN dbo.GiangVien g ON g.MaGV=d.MaGV
                           JOIN dbo.BoMon bm ON bm.MaBoMon=g.MaBoMon
                           WHERE d.MaDot=? AND g.TrangThai=N'Đang công tác' ''' + khoa_filter,
                        x.ty_le, *scope_params)
            cur.execute('EXEC dbo.sp_TinhDinhMucTheoTyLe ?', x.ma_dot)
            while cur.nextset():
                pass
            cur.execute('''SELECT ? AS MaDot,
                                  ISNULL((SELECT SUM(SoGVCanCap) FROM dbo.CaThi WHERE MaDot=?),0) AS TongNhuCau,
                                  ISNULL((SELECT SUM(SoCaQuyDinh) FROM dbo.DinhMucPhanCong WHERE MaDot=?),0) AS TongDinhMuc''',
                        x.ma_dot, x.ma_dot, x.ma_dot)
            row = cur.fetchone()
            result = dict(zip([c[0] for c in cur.description], row)) if row else {}
            result['GiangVienCapNhat'] = lecturer_count
            result['ChenhLech'] = result.get('TongNhuCau', 0) - result.get('TongDinhMuc', 0)
            cn.commit()
            return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, str(e))


def set_lecturer_quota(ma_dot: str, ma_gv: str, x: DinhMucGiangVienIn):
    """Persist a lecturer's percentage or exact manual quota for one exam period."""
    ma_dot = str(ma_dot or '').strip()
    ma_gv = str(ma_gv or '').strip()
    if not ma_dot or not ma_gv:
        raise HTTPException(400, 'Thiếu mã đợt thi hoặc mã giảng viên.')

    try:
        with get_connection() as cn:
            try:
                cur = cn.cursor()
                cur.execute('''
                    SELECT g.TrangThai
                    FROM dbo.DinhMucPhanCong d
                    JOIN dbo.GiangVien g ON g.MaGV=d.MaGV
                    WHERE d.MaDot=? AND d.MaGV=?
                ''', ma_dot, ma_gv)
                lecturer = cur.fetchone()
                if not lecturer:
                    raise HTTPException(404, 'Giảng viên chưa được chọn tham gia đợt thi này.')
                if str(lecturer[0] or '').strip() != 'Đang công tác':
                    raise HTTPException(400, 'Chỉ cập nhật định mức cho giảng viên đang công tác.')

                manual = 1 if x.so_ca_thu_cong else 0
                cur.execute('''
                    UPDATE dbo.DinhMucPhanCong
                    SET TyLeDinhMuc=?,
                        SoCaThuCong=?,
                        SoCaQuyDinh=CASE WHEN ?=1 THEN ? ELSE 0 END,
                        GhiChu=CASE WHEN ?=1 THEN N'Định mức nhập số ca' ELSE N'Định mức theo tỷ lệ' END
                    WHERE MaDot=? AND MaGV=?
                ''', x.ty_le, manual, manual, x.so_ca, manual, ma_dot, ma_gv)

                # Recalculate the non-manual rows from SQL percentages while
                # preserving the exact count on manually locked rows.
                cur.execute('EXEC dbo.sp_TinhDinhMucTheoTyLe ?', ma_dot)
                _drain(cur)
                cur.execute('''
                    SELECT d.MaDot,d.MaGV,g.HoTen,d.TyLeDinhMuc,
                           d.SoCaQuyDinh,d.SoCaThuCong
                    FROM dbo.DinhMucPhanCong d
                    JOIN dbo.GiangVien g ON g.MaGV=d.MaGV
                    WHERE d.MaDot=?
                    ORDER BY d.TyLeDinhMuc DESC,d.MaGV
                ''', ma_dot)
                items = dict_rows(cur)
                cn.commit()
                return {'ok': True, 'ma_dot': ma_dot, 'items': items}
            except Exception:
                cn.rollback()
                raise
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f'Lỗi lưu định mức giảng viên: {e}')
