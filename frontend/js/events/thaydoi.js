/* ========= Thay đổi input ========= */
const C={
  role(t){const u=S.users.find(x=>x.id===+t.dataset.id);u.role=t.value;if(cur&&cur.id===u.id)cur=u;render()},
  active(t){S.users.find(x=>x.id===+t.dataset.id).on=t.checked;save()},
  'busy-filter'(t){busyReqFilter=t.value;A['load-busy-requests']();},
  perm(t){S.perms[ROLES[+t.dataset.r]][+t.dataset.i]=t.checked?1:0;render()},
  async pct(t){const l=lec(t.dataset.id),v=parseInt(t.value,10);if(!l)return;const q=isNaN(v)||v<0?0:Math.min(v,100);l.pct=q;S.lecs.forEach(x=>x.quota_authoritative=false);try{if(window.__MA_DOT)await API.updateLecturer(l.id,{ho_ten:l.name,don_vi:l.dept,ty_le:q,ma_dot:window.__MA_DOT});render();toast('Đã cập nhật định mức.')}catch(e){toast(e.message);render()}},
  'dot-lec-one'(t){t.checked?dotPick.sel.add(t.value):dotPick.sel.delete(t.value);$('#dotLecCount').textContent=dotLecCount()},
  'dot-lec-all'(t){dotLecFiltered().forEach(l=>t.checked?dotPick.sel.add(String(l.id)):dotPick.sel.delete(String(l.id)));$('#dotLecList').innerHTML=dotLecRows();$('#dotLecCount').textContent=dotLecCount()},
  ld(t){F.ld=t.value;render()},ed(t){F.ed=t.value;render()},sd(t){F.sd=t.value;render()},lack(t){F.lack=t.checked;render()},
  s2n(t){S.soft.S2.n=+t.value;save()},
  'soft-on'(t){S.soft[t.dataset.id].on=t.checked;render()},
  'busy-file'(t){
    const f=t.files[0];if(!f)return;
    readTable(f).then(rows=>{
      const out={name:f.name,rows:[],errors:[]};
      let header=-1,ci={name:-1,date:-1,session:-1,reason:-1};
      for(let i=0;i<Math.min(rows.length,20);i++){
        const cells=(rows[i]||[]).map(plain);
        const find=(...keys)=>cells.findIndex(x=>keys.some(k=>x===k||x.includes(k)));
        const name=find('ho ten'),date=find('ngay'),session=find('buoi'),reason=find('ly do');
        if(name>=0&&date>=0&&session>=0&&reason>=0){header=i;ci={name,date,session,reason};break}
      }
      if(header<0){toast('Không tìm thấy tiêu đề Họ tên, Ngày, Buổi, Lý do trong file.');return}
      const sessions=new Set(['sang','chieu','ca ngay']);
      const reasonMap={
        'di cong tac, hop theo quyet dinh cua truong':'Đi công tác, họp theo quyết định của Trường',
        'ban viec gia dinh (hieu, hy)':'Bận việc gia đình (Hiếu, hỷ)',
        'su co suc khoe / ban viec khan cap dot xuat (uu tien sau cung - trao doi giua gv)':'Sự cố sức khỏe / Bận việc khẩn cấp đột xuất (Ưu tiên sau cùng - trao đổi giữa GV)'
      };
      for(let i=header+1;i<rows.length;i++){
        const r=rows[i]||[]; if(![ci.name,ci.date,ci.session,ci.reason].some(k=>String(r[k]??'').trim()))continue;
        const name=String(r[ci.name]??'').trim();
        const date=parseDate(r[ci.date]);
        const sessionRaw=String(r[ci.session]??'').trim();
        const sessionPlain=plain(sessionRaw);
        const reason=String(r[ci.reason]??'').trim();
        let m='';
        if(!name)m='Thiếu Họ tên giảng viên';
        else if(!date)m='Ngày không hợp lệ (chấp nhận 22/1/2026 hoặc 22/01/2026)';
        else if(!sessions.has(sessionPlain))m='Buổi phải là Sáng, Chiều hoặc Cả ngày';
        else if(!reasonMap[plain(reason)])m='Lý do không đúng danh sách 3 lý do cố định';
        if(m){out.errors.push({line:i+1,msg:m});continue}
        const canonicalSession=sessionPlain==='sang'?'Sáng':sessionPlain==='chieu'?'Chiều':'Cả ngày';
        const canonicalReason=reasonMap[plain(reason)];
        out.rows.push({name,date,session:canonicalSession,reason:canonicalReason,line:i+1});
      }
      if(!out.rows.length){toast('Không tìm thấy dòng lịch bận hợp lệ trong file.');return}
      pendBusy=out;render();
    }).catch(er=>toast(er.message));
    t.value='';
  },
  'teach-file'(t){
    const f=t.files[0];if(!f)return;
    readTable(f).then(rows=>{
      const out={name:f.name,rows:[],errors:[],teachers:[]};
      let date=null,hdr=-1,ti=8,gi=9;

      // Bước 1: Tìm ngày mặc định từ các dòng tiêu đề phía trên header
      // (ví dụ: "Ngày 08/12/2026" hoặc "Từ ngày 01/12/2026 đến...") cho file 1 ngày
      let defaultDate=null;
      for(let i=0;i<Math.min(rows.length,8);i++){
        const cell0=String(rows[i]&&rows[i][0]||'').trim();
        const dm=cell0.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
        if(dm){const pd=parseDate(dm[1]);if(pd&&!defaultDate)defaultDate=pd;}
      }

      // Bước 2: Tìm hàng tiêu đề chứa "Tiết" và "Giảng viên"
      for(let i=0;i<rows.length;i++){
        const cells=rows[i].map(plain);
        if(cells.some(x=>x.includes('giang vien'))&&cells.some(x=>x==='tiet'||x.startsWith('tiet '))){
          hdr=i;
          ti=cells.findIndex(x=>x==='tiet'||x.startsWith('tiet '));
          gi=cells.findIndex(x=>x.includes('giang vien'));
          break;
        }
      }
      if(hdr<0){toast('Không tìm thấy hàng tiêu đề "Tiết" và "Giảng viên" trong file.');return}

      // Bước 3: Parse từng dòng, cập nhật ngày khi gặp date separator row.
      // Date separator row: chỉ cột đầu có dữ liệu VÀ parse được thành ngày
      // (hỗ trợ cả text "dd/mm/yyyy" lẫn Excel date serial số 5+ chữ số như "46034").
      for(let i=hdr+1;i<rows.length;i++){
        const r=rows[i]||[];
        const r0str=String(r[0]||'').trim();
        const nonEmpty=r.filter(x=>String(x||'').trim()).length;
        // Ưu tiên phát hiện date separator row (chỉ có cột 0 có dữ liệu)
        if(nonEmpty<=1&&r0str){const d=parseDate(r0str);if(d){date=d;continue;}}
        // Fallback: nếu r[0] parse được ngày và không có GV/Tiết ở dòng đó
        else if(r0str){const d=parseDate(r0str);if(d&&!String(r[gi]||'').trim()&&!parsePeriod(r[ti])){date=d;continue;}}

        const name=String(r[gi]||'').trim(),range=parsePeriod(r[ti]);
        if(!name||!range)continue;
        // Dùng defaultDate nếu chưa gặp date separator row nào (file 1 ngày không có separator)
        const effectiveDate=date||defaultDate;
        if(!effectiveDate){out.errors.push({line:i+1,msg:'Không xác định được ngày học cho dòng này. Hãy kiểm tra file có dòng ngày phân cách giữa các nhóm ngày không?'});continue;}
        out.rows.push({name:name,date:effectiveDate,period:range.key,start:range.start,end:range.end,line:i+1});
      }
      out.teachers=[...new Set(out.rows.map(r=>r.name))];
      if(!out.rows.length){toast('Không tìm thấy dòng lịch dạy hợp lệ trong file. Kiểm tra lại cấu trúc file hoặc định dạng ngày.');return}
      pendTeach=out;render();
    }).catch(er=>toast(er.message));t.value='';
  },
  'file-exam'(t){
    const f=t.files[0];if(!f)return;
    readTable(f).then(rows=>{
      const out={name:f.name,rows:[],errors:[]},seen={};
      const labelRow=key=>rows.findIndex(r=>plain(r&&r[0]).includes(key));
      const dateRow=labelRow('ngay thi'),periodRow=labelRow('tiet'),needRow=rows.findIndex(r=>plain(r&&r[0]).includes('so gv can'));
      if(dateRow>=0&&periodRow>=0&&needRow>=0){
        const halfRow=labelRow('buoi'),kindRow=labelRow('loai ca');let lastDate='';
        for(let c=1;c<Math.max(...rows.map(r=>r.length));c++){
          const d=parseDate(rows[dateRow][c]);if(d)lastDate=d;
          const slot=parseExamSlot(rows[periodRow][c]),need=parseInt(String(rows[needRow][c]||'').replace(/[^0-9]/g,''),10);
          if(!slot&&!rows[dateRow][c])continue;
          const raw=plain(kindRow>=0?rows[kindRow][c]:''),kind=raw==='lt'||raw.includes('ly thuyet')?'LT':raw==='tl'||raw.includes('tu luan')?'TL':'';
          const half=plain(halfRow>=0?rows[halfRow][c]:''),ses=slot?(slot.start<3?1:slot.start<6?2:slot.start<9?3:4):0,key=lastDate+'|'+(slot&&slot.label);
          let m='';if(!lastDate)m='Thiếu ngày thi';else if(!slot)m='Thiếu hoặc sai ca/tiết';else if(!Number.isInteger(need)||need<1||need>30)m='Số giảng viên cần phải từ 1 đến 30';else if(!kind)m='Thiếu loại ca Lý thuyết/Tự luận';
          if(!m&&seen[key])m='Ngày và ca/tiết bị lặp với cột '+seen[key];else if(!m)seen[key]=c+1;
          if(m){out.errors.push({line:c+1,msg:m});continue}
          out.rows.push({date:lastDate,period:slot.label,ses:ses,half:/chieu|afternoon/.test(half)?'C':/sang|morning/.test(half)?'S':slot.start<=6?'S':'C',kind:kind,need:need});
        }
        pend=out;render();return;
      }
      let ix={date:0,slot:1,need:2,kind:3},header=-1;
      for(let i=0;i<Math.min(rows.length,12);i++){
        const cells=(rows[i]||[]).map(plain),find=fn=>cells.findIndex(fn);
        const d=find(x=>x.includes('ngay')),s=find(x=>x.includes('ca')||x.includes('tiet')||x.includes('slot')),n=find(x=>x.includes('can')||x.includes('so gv')||x.includes('giang vien')),k=find(x=>x.includes('loai'));
        if(d>=0&&s>=0&&n>=0&&k>=0){ix={date:d,slot:s,need:n,kind:k};header=i;break}
      }
      rows.forEach((r,i)=>{
        if(i<=header||!r||!r.some(x=>String(x||'').trim()))return;
        const date=parseDate(r[ix.date]),slot=parseExamSlot(r[ix.slot]),need=parseInt(String(r[ix.need]||'').replace(/[^0-9]/g,''),10),raw=plain(r[ix.kind]);
        const kind=raw==='lt'||raw.includes('ly thuyet')?'LT':raw==='tl'||raw.includes('tu luan')?'TL':'';
        let m='';
        if(!date)m='Ngày thi không hợp lệ, cần dạng dd/mm/yyyy';else if(!slot)m='Ca/tiết không hợp lệ (ví dụ Ca 1 hoặc 1 → 2)';else if(!Number.isInteger(need)||need<1||need>30)m='Số giảng viên cần phải từ 1 đến 30';else if(!kind)m='Loại ca phải là Lý thuyết (LT) hoặc Tự luận (TL)';
        const ses=slot?(slot.start<3?1:slot.start<6?2:slot.start<9?3:4):0,key=date+'|'+(slot&&slot.label);
        if(!m&&seen[key])m='Ngày và ca/tiết bị lặp với dòng '+seen[key];else if(!m)seen[key]=i+1;
        if(m){out.errors.push({line:i+1,msg:m});return}
        out.rows.push({date:date,period:slot.label,ses:ses,half:slot.start<=6?'S':'C',kind:kind,need:need});
      });
      pend=out;render();
    }).catch(er=>toast(er.message));
    t.value='';
  }
};
document.addEventListener('change',e=>{const t=e.target,f=t.dataset&&t.dataset.chg;if(f&&C[f])C[f](t,e)});
const I={
  'dot-lec-q'(t){dotPick.q=t.value;$('#dotLecList').innerHTML=dotLecRows()},
  'busy-search'(t){busyReqSearch=t.value;clearTimeout(I._busyTimer);I._busyTimer=setTimeout(()=>{A['load-busy-requests']()},300)},
  'accounts-search'(t){accountsSearch=t.value;const tbody=$('#userAccountRows'),count=$('#accountSearchCount'),result=accountRows();if(tbody)tbody.innerHTML=result.rows;if(count)count.textContent=result.count+' / '+adminAccounts.length+' tài khoản'},
  lq(t){F.lq=t.value;$('#lecRows').innerHTML=lecRows()},
  eq(t){F.eq=t.value;$('#examRows').innerHTML=examRows()},
  'pick-q'(t){pick.q=t.value;$('#pickList').innerHTML=pickList()},
  'soft-w'(t){S.soft[t.dataset.id].w=+t.value;t.nextElementSibling.textContent=t.value;save()}
};
document.addEventListener('input',e=>{const t=e.target,f=t.dataset&&t.dataset.inp;if(f&&I[f])I[f](t,e)});
$('#logoFile').addEventListener('change',e=>{
  const f=e.target.files[0];if(!f)return;
  const fr=new FileReader();
  fr.onload=()=>{const im=new Image();im.onload=()=>{
    const s=Math.min(1,256/Math.max(im.width,im.height)),c=document.createElement('canvas');
    c.width=Math.max(1,Math.round(im.width*s));c.height=Math.max(1,Math.round(im.height*s));
    c.getContext('2d').drawImage(im,0,0,c.width,c.height);S.logo=c.toDataURL('image/png');render();toast('Đã cập nhật logo trường.');
  };im.onerror=()=>toast('Không đọc được ảnh logo.');im.src=fr.result};
  fr.readAsDataURL(f);e.target.value='';
});
render();
bootSQL();
