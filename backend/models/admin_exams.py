"""Router quản trị - đợt thi và ca thi của API FastAPI."""

from fastapi import APIRouter, HTTPException

try:
    from ..ketnoi_sql import get_connection
    from ..schemas.admin import DotThiIn, CaThiIn, LuuPhanCongIn, DinhMucChungIn
    from .admin_helpers import dict_rows, _thu_vn, _drain
except ImportError:
    from ketnoi_sql import get_connection
    from schemas.admin import DotThiIn, CaThiIn, LuuPhanCongIn, DinhMucChungIn
    from models.admin_helpers import dict_rows, _thu_vn, _drain

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

def save_exam_assignments(ma_dot: str, x: LuuPhanCongIn):
    """Persist the visible quota weights, recalculate SQL quotas, then save assignments."""
    pairs = [(a.ma_ca.strip(), a.ma_gv.strip()) for a in x.assignments]
    if len(pairs) != len(set(pairs)):
        raise HTTPException(400, 'Danh sách có phân công bị lặp.')
    weights = [(q.ma_gv.strip(), q.ty_le) for q in x.dinh_muc]
    if len(weights) != len({ma_gv for ma_gv, _ in weights}):
        raise HTTPException(400, 'Danh sách định mức có giảng viên bị lặp.')
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            if weights:
                cur.execute('CREATE TABLE #LuuDinhMuc (MaGV VARCHAR(20) COLLATE DATABASE_DEFAULT NOT NULL PRIMARY KEY, TyLeDinhMuc DECIMAL(5,2) NOT NULL)')
                cur.executemany('INSERT INTO #LuuDinhMuc(MaGV,TyLeDinhMuc) VALUES (?,?)', weights)
                cur.execute("SELECT TOP 1 r.MaGV FROM #LuuDinhMuc r LEFT JOIN dbo.GiangVien g ON g.MaGV=r.MaGV AND g.TrangThai=N'Đang công tác' WHERE g.MaGV IS NULL")
                if cur.fetchone():
                    raise HTTPException(400, 'Danh sách định mức có giảng viên không tồn tại hoặc không còn công tác.')
                cur.execute('\n                    UPDATE d SET TyLeDinhMuc=r.TyLeDinhMuc\n                    FROM dbo.DinhMucPhanCong d\n                    JOIN #LuuDinhMuc r ON r.MaGV=d.MaGV\n                    WHERE d.MaDot=?\n                ', ma_dot)
            cur.execute('EXEC dbo.sp_TinhDinhMucTheoTyLe ?', ma_dot)
            _drain(cur)
            cur.execute('CREATE TABLE #LuuPhanCong (MaCa VARCHAR(50) COLLATE DATABASE_DEFAULT NOT NULL, MaGV VARCHAR(20) COLLATE DATABASE_DEFAULT NOT NULL, PRIMARY KEY(MaCa,MaGV))')
            if pairs:
                cur.executemany('INSERT INTO #LuuPhanCong(MaCa,MaGV) VALUES (?,?)', pairs)
            cur.execute('SELECT TOP 1 r.MaCa FROM #LuuPhanCong r LEFT JOIN dbo.CaThi c ON c.MaCa=r.MaCa AND c.MaDot=? WHERE c.MaCa IS NULL', ma_dot)
            if cur.fetchone():
                raise HTTPException(400, 'Danh sách có ca thi không thuộc đợt thi đã chọn.')
            cur.execute("SELECT TOP 1 r.MaGV FROM #LuuPhanCong r LEFT JOIN dbo.GiangVien g ON g.MaGV=r.MaGV AND g.TrangThai=N'Đang công tác' WHERE g.MaGV IS NULL")
            if cur.fetchone():
                raise HTTPException(400, 'Danh sách có giảng viên không tồn tại hoặc không còn công tác.')
            cur.execute(
                """
                SELECT TOP 1 r.MaGV
                FROM #LuuPhanCong r
                LEFT JOIN dbo.DinhMucPhanCong d ON d.MaDot=? AND d.MaGV=r.MaGV
                WHERE d.MaGV IS NULL
                """,
                ma_dot,
            )
            if cur.fetchone():
                raise HTTPException(400, 'Danh sách có giảng viên chưa được chọn tham gia đợt thi.')
            cur.execute('DELETE p FROM dbo.PhanCongCoiThi p INNER JOIN dbo.CaThi c ON c.MaCa=p.MaCa WHERE c.MaDot=?', ma_dot)
            cur.execute('INSERT INTO dbo.PhanCongCoiThi(MaCa,MaGV) SELECT MaCa,MaGV FROM #LuuPhanCong')
            cur.execute('EXEC dbo.sp_KiemTraRangBuoc ?,1', ma_dot)
            _drain(cur)
            cur.execute('EXEC dbo.sp_ChotXepLich ?', ma_dot)
            _drain(cur)
            cn.commit()
            return {'ok': True, 'ma_dot': ma_dot, 'assignments_saved': len(pairs)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f'Không lưu được phân công vào SQL Server: {e}')

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
            cur.execute('EXEC dbo.sp_DatDinhMucChung ?,?,?', x.ma_dot, x.ty_le, x.ma_khoa)
            result = {}
            while True:
                if cur.description:
                    cols = [c[0] for c in cur.description]
                    rows = cur.fetchall()
                    if rows and 'TongNhuCau' in cols:
                        result = dict(zip(cols, rows[-1]))
                if not cur.nextset():
                    break
            cn.commit()
            return result or {'MaDot': x.ma_dot}
    except Exception as e:
        raise HTTPException(400, str(e))
