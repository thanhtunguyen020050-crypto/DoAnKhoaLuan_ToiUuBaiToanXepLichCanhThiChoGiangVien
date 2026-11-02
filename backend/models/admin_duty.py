from fastapi import HTTPException

try:
    from ..ketnoi_sql import get_connection
    from ..schemas.admin import TrucDeImportIn
    from .admin_helpers import dict_rows
except ImportError:
    from ketnoi_sql import get_connection
    from schemas.admin import TrucDeImportIn
    from models.admin_helpers import dict_rows


def _ensure_table(cur):
    cur.execute('''
        IF OBJECT_ID(N'dbo.PhanCongTrucDe', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.PhanCongTrucDe (
                ID BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PhanCongTrucDe PRIMARY KEY,
                MaDot VARCHAR(20) NOT NULL,
                MaHP NVARCHAR(30) NOT NULL,
                MonThi NVARCHAR(300) NOT NULL,
                NgayThi DATE NOT NULL,
                Thu NVARCHAR(20) NOT NULL,
                TuTiet INT NOT NULL,
                DenTiet INT NOT NULL,
                MaGV VARCHAR(20) NOT NULL,
                SoDienThoai NVARCHAR(30) NULL,
                GhiChu NVARCHAR(255) NULL,
                NguonFile NVARCHAR(255) NULL,
                ThoiGianImport DATETIME2 NOT NULL CONSTRAINT DF_PhanCongTrucDe_Time DEFAULT SYSDATETIME(),
                CONSTRAINT FK_PhanCongTrucDe_Dot FOREIGN KEY(MaDot) REFERENCES dbo.DotThi(MaDot) ON DELETE CASCADE,
                CONSTRAINT FK_PhanCongTrucDe_GV FOREIGN KEY(MaGV) REFERENCES dbo.GiangVien(MaGV),
                CONSTRAINT CK_PhanCongTrucDe_Tiet CHECK(TuTiet BETWEEN 1 AND 16 AND DenTiet BETWEEN TuTiet AND 16)
            );
        END;
    ''')
    cur.execute('''
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'UX_PhanCongTrucDe_ImportKey' AND object_id=OBJECT_ID(N'dbo.PhanCongTrucDe'))
            CREATE UNIQUE INDEX UX_PhanCongTrucDe_ImportKey ON dbo.PhanCongTrucDe(MaDot,MaHP,NgayThi,TuTiet,DenTiet,MaGV)
    ''')


def import_duty(x: TrucDeImportIn):
    assignments = x.assignments
    keys = [(a.ma_hp.strip().casefold(), a.ngay_thi, a.tu_tiet, a.den_tiet, a.ma_gv.strip().casefold()) for a in assignments]
    if len(keys) != len(set(keys)):
        raise HTTPException(400, 'File contains duplicate lecturer assignments for the same course, date and period.')
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            _ensure_table(cur)
            cur.execute('SELECT NgayBatDau,NgayKetThuc FROM dbo.DotThi WHERE MaDot=?', x.ma_dot)
            dot = cur.fetchone()
            if not dot:
                raise HTTPException(404, 'The selected exam period does not exist in the database.')
            if any(a.ngay_thi < dot[0] or a.ngay_thi > dot[1] for a in assignments):
                raise HTTPException(400, 'At least one exam date is outside the selected exam period.')

            lecturer_ids = list(dict.fromkeys(a.ma_gv.strip() for a in assignments))
            placeholders = ','.join('?' for _ in lecturer_ids)
            cur.execute(
                "SELECT MaGV FROM dbo.GiangVien WHERE TrangThai=N'Đang công tác' AND MaGV IN (" + placeholders + ')',
                lecturer_ids,
            )
            active = {str(row[0]).casefold() for row in cur.fetchall()}
            missing = [code for code in lecturer_ids if code.casefold() not in active]
            if missing:
                raise HTTPException(400, 'Lecturers are missing or inactive: ' + ', '.join(missing))

            weekdays = ['Th\u1ee9 2', 'Th\u1ee9 3', 'Th\u1ee9 4', 'Th\u1ee9 5', 'Th\u1ee9 6', 'Th\u1ee9 7', 'Ch\u1ee7 nh\u1eadt']
            staged = [(
                a.ma_hp.strip(), a.mon_thi.strip(), a.ngay_thi,
                weekdays[a.ngay_thi.weekday()], a.tu_tiet, a.den_tiet,
                a.ma_gv.strip(), a.so_dien_thoai, a.ghi_chu, x.nguon_file,
            ) for a in assignments]
            cur.execute('''
                CREATE TABLE #ImportTrucDe (
                    MaHP NVARCHAR(30) COLLATE DATABASE_DEFAULT NOT NULL,
                    MonThi NVARCHAR(300) COLLATE DATABASE_DEFAULT NOT NULL,
                    NgayThi DATE NOT NULL,
                    Thu NVARCHAR(20) COLLATE DATABASE_DEFAULT NOT NULL,
                    TuTiet INT NOT NULL,
                    DenTiet INT NOT NULL,
                    MaGV VARCHAR(20) COLLATE DATABASE_DEFAULT NOT NULL,
                    SoDienThoai NVARCHAR(30) NULL,
                    GhiChu NVARCHAR(255) NULL,
                    NguonFile NVARCHAR(255) NULL,
                    PRIMARY KEY(MaHP,NgayThi,TuTiet,DenTiet,MaGV)
                )
            ''')
            cur.executemany('''
                INSERT INTO #ImportTrucDe(MaHP,MonThi,NgayThi,Thu,TuTiet,DenTiet,MaGV,SoDienThoai,GhiChu,NguonFile)
                VALUES (?,?,?,?,?,?,?,?,?,?)
            ''', staged)
            cur.execute('''
                SELECT COUNT(*) FROM #ImportTrucDe i JOIN dbo.PhanCongTrucDe d
                  ON d.MaDot=? AND d.MaHP=i.MaHP AND d.NgayThi=i.NgayThi
                 AND d.TuTiet=i.TuTiet AND d.DenTiet=i.DenTiet AND d.MaGV=i.MaGV
            ''', x.ma_dot)
            updated = int(cur.fetchone()[0])
            cur.execute('''
                UPDATE d SET MonThi=i.MonThi,Thu=i.Thu,SoDienThoai=i.SoDienThoai,
                    GhiChu=i.GhiChu,NguonFile=i.NguonFile,ThoiGianImport=SYSDATETIME()
                FROM dbo.PhanCongTrucDe d JOIN #ImportTrucDe i
                  ON d.MaDot=? AND d.MaHP=i.MaHP AND d.NgayThi=i.NgayThi
                 AND d.TuTiet=i.TuTiet AND d.DenTiet=i.DenTiet AND d.MaGV=i.MaGV
            ''', x.ma_dot)
            cur.execute('''
                INSERT INTO dbo.PhanCongTrucDe(MaDot,MaHP,MonThi,NgayThi,Thu,TuTiet,DenTiet,MaGV,SoDienThoai,GhiChu,NguonFile)
                SELECT ?,i.MaHP,i.MonThi,i.NgayThi,i.Thu,i.TuTiet,i.DenTiet,i.MaGV,i.SoDienThoai,i.GhiChu,i.NguonFile
                FROM #ImportTrucDe i
                WHERE NOT EXISTS (
                    SELECT 1 FROM dbo.PhanCongTrucDe d
                    WHERE d.MaDot=? AND d.MaHP=i.MaHP AND d.NgayThi=i.NgayThi
                      AND d.TuTiet=i.TuTiet AND d.DenTiet=i.DenTiet AND d.MaGV=i.MaGV
                )
            ''', x.ma_dot, x.ma_dot)
            inserted = len(assignments) - updated
            cn.commit()
            return {'ok': True, 'ma_dot': x.ma_dot, 'inserted': inserted, 'updated': updated, 'total': len(assignments)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f'Could not import exam-paper duty into SQL Server: {e}')


def list_duty(ma_dot: str):
    try:
        with get_connection() as cn:
            cur = cn.cursor()
            _ensure_table(cur)
            cur.execute('''
                SELECT d.ID,d.MaDot,d.MaHP,d.MonThi,d.NgayThi,d.Thu,d.TuTiet,d.DenTiet,
                       d.MaGV,g.HoTen,d.SoDienThoai,d.GhiChu,d.NguonFile,d.ThoiGianImport
                FROM dbo.PhanCongTrucDe d JOIN dbo.GiangVien g ON g.MaGV=d.MaGV
                WHERE d.MaDot=? ORDER BY d.NgayThi,d.TuTiet,d.MaHP,g.HoTen
            ''', ma_dot)
            return {'items': dict_rows(cur)}
    except Exception as e:
        raise HTTPException(500, f'Could not read exam-paper duty: {e}')
