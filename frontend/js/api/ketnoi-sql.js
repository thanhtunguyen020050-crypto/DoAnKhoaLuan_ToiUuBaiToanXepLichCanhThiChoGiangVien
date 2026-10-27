/* ========= Kết nối SQL Server ========= */
async function refreshBoMon(){try{const r=await API.boMon('CNTT');window.__BOMON=r.items||[]}catch(_){window.__BOMON=[]}}

async function refreshLecturers(showToast=true){
  try{
    await refreshBoMon();
    const dot=await API.latestDot();
    window.__MA_DOT=dot&&dot.MaDot||null;
    const data=await API.lecturers(window.__MA_DOT);
    const items=data.items||[];
    const old=new Map(S.lecs.map(l=>[String(l.id),l]));
    S.lecs=items.map(x=>{
      const o=old.get(String(x.MaGV))||{};
      return {id:x.MaGV,name:x.HoTen,dept:x.TenKhoa||x.TenBoMon||'Khoa CNTT',ma_bo_mon:x.MaBoMon,pct:Number(x.TyLeDinhMuc??o.pct??0),quota:Number(x.SoCaQuyDinh??o.quota??0),quota_authoritative:x.SoCaQuyDinh!=null,inDot:window.__MA_DOT?x.MaDot!=null:true,busy:o.busy||[],teach:o.teach||[]};
    });
    for(const l of S.lecs){
      try{
        const b=await API.busy(l.id),br=b.items||[];
        const t=await API.teaching(l.id),tr=t.items||[];
        l.busy=[];l.teach=[];
        br.forEach(x=>{
          const d=String(x.NgayBan).slice(0,10), block=Number(x.TuTiet)<=6?'S':'C';
          l.busy.push({key:d+'|'+block,priority:Number(x.UuTien)||3,reason:x.LyDo||null});
        });
        tr.forEach(x=>{const d=String(x.NgayDay).slice(0,10);l.teach.push(d+'|'+Number(x.TuTiet)+'-'+Number(x.DenTiet))});
      }catch(_){ }
    }
    save();render();
    if(showToast)toast('Đã tải '+S.lecs.length+' giảng viên từ SQL Server.');
    return true;
  }catch(e){if(showToast)toast('SQL Server chưa kết nối: '+e.message);return false}
}

async function refreshExamData(showToast=false){
  try{
    const d=await API.dots();
    S.dots=d.items||[];
    const latest=S.dots[0]||await API.latestDot();
    window.__MA_DOT=latest&&latest.MaDot||null;
    const r=await API.exams(window.__MA_DOT);
    const old=new Map(S.exams.map(e=>[e.ma_ca||String(e.id),e]));
    S.exams=(r.items||[]).map((x,i)=>{
      const oldE=old.get(x.MaCa); const slot=EXAM_SLOTS.find(s=>s[1]===Number(x.TuTiet)&&s[2]===Number(x.DenTiet));
      return {id:oldE?oldE.id:(S.nid++),ma_ca:x.MaCa,code:x.MaCa,name:'Ca thi',dept:'',room:x.PhongThi||'',asg:oldE?oldE.asg:[],date:String(x.NgayThi).slice(0,10),ses:Number(x.Buoi)||1,half:Number(x.Buoi)<=1?'S':'C',period:slot?slot[0]:Number(x.TuTiet)+' → '+Number(x.DenTiet),need:Number(x.SoGVCanCap),kind:x.HinhThucThi==='Tự luận'?'TL':'LT',ma_dot:x.MaDot,hoc_ky:x.HocKy,nam_hoc:x.NamHoc,so_da_cap:Number(x.SoGVDaCap||0)};
    });
    save();render();if(showToast)toast('Đã tải '+S.exams.length+' ca thi từ SQL Server.');return true;
  }catch(e){if(showToast)toast('Không tải được ca thi: '+e.message);return false}
}

async function bootSQL(){
  try{const h=await API.health();await refreshLecturers(false);await refreshExamData(false);toast('Đã kết nối '+h.database+' trên '+h.server+'.')}catch(e){toast('Chưa kết nối SQL Server. Hãy chạy backend rồi tải lại trang.')}}

