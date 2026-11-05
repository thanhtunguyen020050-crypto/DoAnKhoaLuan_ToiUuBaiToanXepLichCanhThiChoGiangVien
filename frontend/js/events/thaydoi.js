/* ========= Thay đổi input ========= */
function syncQuotaRows(result){
  if(!Array.isArray(result?.items))throw new Error('Máy chủ không trả về định mức sau khi lưu.');
  const rows=new Map(result.items.map(x=>[String(x.MaGV??x.ma_gv??x.maGv??''),x]));
  S.lecs.forEach(l=>{
    const x=rows.get(String(l.id));if(!x)return;
    l.pct=Number(x.TyLeDinhMuc??x.ty_le??l.pct);
    l.quota=Number(x.SoCaQuyDinh??x.so_ca??l.quota);
    const manual=x.SoCaThuCong??x.so_ca_thu_cong;
    l.quota_manual=manual===true||Number(manual)===1;
    l.quota_authoritative=true;
  });
}
async function persistLecturerQuota(input,lecturer,quota,pct,manual){
  const maDot=window.__MA_DOT;
  if(!maDot){toast('Hãy chọn đợt thi trước khi cập nhật định mức.');render();return}
  const group=input.closest('.lec-quota');
  if(group)group.querySelectorAll('input').forEach(x=>x.disabled=true);
  try{
    const result=await API.updateQuota(maDot,lecturer.id,{ty_le:pct,so_ca:quota,so_ca_thu_cong:manual});
    syncQuotaRows(result);render();toast('Đã lưu định mức và số ca cho đợt thi.');
  }catch(e){render();toast(e.message||'Không lưu được định mức.')}
}
const C={
  'duty-file'(t){
    const f=t.files&&t.files[0];if(!f)return;
    readTable(f).then(rows=>{
      const norm=rows.map(r=>(r||[]).map(plain));
      const hi=norm.findIndex(r=>r.some(x=>x==='stt')&&r.some(x=>x.includes('ma hp'))&&r.some(x=>x.includes('ngay thi'))&&r.some(x=>x.includes('gv truc de')));
      if(hi<0){toast('Không tìm thấy bảng có các cột STT, Mã HP, Ngày thi và GV trực đề.');return}
      const hdr=norm[hi],col=k=>hdr.findIndex(x=>x.includes(k)),ix={id:col('stt'),code:col('ma hp'),course:col('mon thi'),weekday:col('thu'),date:col('ngay thi'),period:col('tiet'),teacher:col('gv truc de'),phone:col('so dien thoai'),note:col('ghi chu')};
      let title='',periodLabel='',dept='',last={};
      for(let i=0;i<hi;i++){const s=(rows[i]||[]).filter(Boolean).join(' '),n=plain(s);if(n.includes('phan cong'))title=s.replace(/\s+/g,' ').trim();if(n.includes('tu ngay'))periodLabel=s.replace(/\s+/g,' ').trim();if(/Khoa:/i.test(s))dept=s.replace(/^.*?Khoa:\s*/i,'').trim()}
      const records=[];
      for(let i=hi+1;i<rows.length;i++){
        const r=rows[i]||[],v=k=>String(r[ix[k]]??'').trim();if(!r.some(x=>String(x??'').trim()))continue;
        const teacher=v('teacher'),teacherPlain=plain(teacher);if(/^(tp\.?\s*hcm|nguoi lap bieu|truong khoa)\b/.test(teacherPlain))break;
        last={id:v('id')||last.id||'',code:v('code')||last.code||'',course:v('course')||last.course||'',weekday:v('weekday')||last.weekday||'',date:v('date')||last.date||'',period:v('period')||last.period||''};
        if(!teacher)continue;const d=parseDate(last.date),p=parsePeriod(last.period),note=v('note'),maCode=(note.match(/ma\s*gv\s*:\s*([a-z0-9_-]+)/i)||[])[1],lecturer=(maCode&&S.lecs.find(x=>String(x.id).toLowerCase()===maCode.toLowerCase()))||S.lecs.find(x=>plain(x.name)===plain(teacher));
        records.push({line:i+1,id:last.id,code:last.code,course:last.course,weekday:last.weekday,date:d,period:p?last.period:'',teacher,ma_gv:lecturer?String(lecturer.id):'',start:p&&p.start,end:p&&p.end,phone:v('phone'),note:note.replace(/^ma\s*gv\s*:\s*[\w-]+\s*/i,'').trim(),error:!d?'Ngày thi không hợp lệ':!p?'Tiết không hợp lệ':''});
      }
      if(!records.length){toast('Không tìm thấy lượt giảng viên trực đề hợp lệ trong file.');return}
      const groups=new Map();records.forEach(x=>{const k=[x.code,x.date,x.period].join('|');if(!groups.has(k))groups.set(k,{...x,teachers:[]});groups.get(k).teachers.push(x.teacher)});
      const courses=[...groups.values()],unmatched=[...new Set(records.filter(x=>!x.ma_gv).map(x=>x.teacher))],issueCount=records.filter(x=>x.error).length,maDot=window.__MA_DOT||''; pendDuty={name:f.name,ma_dot:maDot,rows:records.filter(x=>!x.error&&x.ma_gv).map(x=>({ma_hp:x.code,mon_thi:x.course,ngay_thi:x.date,tu_tiet:x.start,den_tiet:x.end,ma_gv:x.ma_gv,so_dien_thoai:x.phone||null,ghi_chu:x.note||null}))};
      const rowsHtml=courses.map(x=>'<tr><td>'+esc(fmtD(x.date||''))+'</td><td>'+esc(x.period)+'</td><td><b>'+esc(x.code)+'</b><small style="display:block;color:var(--muted);max-width:330px;white-space:normal">'+esc(x.course)+'</small></td><td>'+x.teachers.map(n=>'<span class="chip">'+esc(n)+'</span>').join(' ')+'</td></tr>').join('');
      const importDisabled=issueCount||unmatched.length||!maDot||!pendDuty.rows.length;
      openModal({title:'Xem tr\u01b0\u1edbc import l\u1ecbch tr\u1ef1c \u0111\u1ec1',wide:true,body:'<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px"><span class="chip ok">'+courses.length+' ca thi</span><span class="chip">'+records.length+' l\u01b0\u1ee3t tr\u1ef1c</span><span class="chip">'+new Set(records.map(x=>x.teacher)).size+' gi\u1ea3ng vi\u00ean</span></div><section class="panel" style="padding:14px 16px;margin-bottom:14px"><b>'+esc(title||f.name)+'</b><div class="muted" style="margin-top:6px">'+esc(periodLabel)+' \u00b7 '+esc(dept||'Ch\u01b0a ghi khoa')+'</div><div class="muted" style="margin-top:4px;font-size:12px">T\u1ec7p: '+esc(f.name)+'</div><div class="muted" style="margin-top:4px;font-size:12px">\u0110\u1ee3t l\u01b0u: '+esc(maDot||'Ch\u01b0a ch\u1ecdn \u0111\u1ee3t thi')+'</div></section>'+(unmatched.length?'<div style="padding:11px 13px;margin-bottom:14px;border-radius:9px;background:var(--warnbg);color:var(--warn);font-size:13px"><b>'+unmatched.length+' t\u00ean ch\u01b0a kh\u1edbp gi\u1ea3ng vi\u00ean:</b> '+unmatched.map(esc).join(', ')+'.</div>':'<div style="padding:11px 13px;margin-bottom:14px;border-radius:9px;background:var(--okbg);color:var(--ok);font-size:13px">T\u1ea5t c\u1ea3 gi\u1ea3ng vi\u00ean trong file \u0111\u1ec1u kh\u1edbp danh s\u00e1ch h\u1ec7 th\u1ed1ng.</div>')+(issueCount?'<div class="err">'+records.filter(x=>x.error).map(x=>'D\u00f2ng '+x.line+': '+esc(x.error)).join('<br>')+'</div>':'')+'<div class="tw" style="max-height:48vh;overflow:auto"><table><thead><tr><th>Ng\u00e0y thi</th><th>Ti\u1ebft</th><th>M\u00e3 HP / M\u00f4n thi</th><th>Gi\u1ea3ng vi\u00ean tr\u1ef1c</th></tr></thead><tbody>'+rowsHtml+'</tbody></table></div><p class="hint" style="margin-top:10px">Khi x\u00e1c nh\u1eadn, c\u00e1c l\u01b0\u1ee3t tr\u1ef1c s\u1ebd \u0111\u01b0\u1ee3c l\u01b0u ri\u00eang trong database. Import l\u1ea1i c\u00f9ng file s\u1ebd c\u1eadp nh\u1eadt c\u00e1c d\u00f2ng tr\u00f9ng.</p>',foot:'<button class="btn" data-act="cancel-duty">H\u1ee7y</button><button class="btn pri" data-act="apply-duty"'+(importDisabled?' disabled':'')+'>L\u01b0u '+pendDuty.rows.length+' l\u01b0\u1ee3t tr\u1ef1c \u0111\u1ec1</button>'});
    }).catch(e=>toast(e.message||'Không đọc được file Excel.')).finally(()=>t.remove());
  },
  role(t){const u=S.users.find(x=>x.id===+t.dataset.id);u.role=t.value;if(cur&&cur.id===u.id)cur=u;render()},
  active(t){S.users.find(x=>x.id===+t.dataset.id).on=t.checked;save()},
  'busy-filter'(t){busyReqFilter=t.value;A['load-busy-requests']();},
  'account-password-filter'(t){accountsPasswordFilter=t.value;refreshAccountRows()},
  'account-work-filter'(t){accountsWorkFilter=t.value;refreshAccountRows()},
  perm(t){S.perms[ROLES[+t.dataset.r]][+t.dataset.i]=t.checked?1:0;render()},
  async pct(t){
    const l=lec(t.dataset.id);if(!l)return;
    const value=Number(t.value);
    if(t.value.trim()===''||!Number.isFinite(value)||value<0||value>100){toast('Tỷ lệ định mức phải từ 0 đến 100%.');render();return}
    await persistLecturerQuota(t,l,Number(l.quota)||0,Math.round(value*100)/100,false);
  },
  async 'quota-ca'(t){
    const l=lec(t.dataset.id);if(!l)return;
    const value=Number(t.value);
    if(t.value.trim()===''||!Number.isInteger(value)||value<0){toast('Số ca định mức phải là số nguyên không âm.');render();return}
    const oldQuota=Number(l.quota)||0,oldPct=Number(l.pct)||0;
    let pct;
    if(oldQuota>0){pct=Math.round(oldPct*value/oldQuota)}
    else{
      const total=S.exams.reduce((n,e)=>n+(Number(e.need)||0),0);
      const others=S.lecs.filter(x=>inDot(x)&&String(x.id)!==String(l.id)).reduce((n,x)=>n+(Number(x.pct)||0),0);
      pct=total>value&&others>0?Math.round(value*others/(total-value)):(value>0?100:0);
    }
    pct=Math.min(100,Math.max(0,pct));
    await persistLecturerQuota(t,l,value,pct,true);
  },
  'dot-lec-one'(t){t.checked?dotPick.sel.add(t.value):dotPick.sel.delete(t.value);$('#dotLecCount').textContent=dotLecCount();updateDotLecSelectAll()},
  'dot-lec-dept'(t){dotPick.dept=t.value;$('#dotLecList').innerHTML=dotLecRows();updateDotLecSelectAll()},
  'dot-lec-all'(t){dotLecFiltered().forEach(l=>t.checked?dotPick.sel.add(String(l.id)):dotPick.sel.delete(String(l.id)));$('#dotLecList').innerHTML=dotLecRows();$('#dotLecCount').textContent=dotLecCount();updateDotLecSelectAll()},
  ld(t){F.ld=t.value;render()},ls(t){F.ls=t.value;render()},ed(t){F.ed=t.value;render()},ek(t){F.ek=t.value;render()},sd(t){F.sd=t.value;render()},lack(t){F.lack=t.checked;render()},
  s2n(t){S.soft.S2.n=+t.value;save()},
  'soft-on'(t){S.soft[t.dataset.id].on=t.checked;save();render()},
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
      let date=null,hdr=-1,ti=8,gi=9,roomIndex=-1,courseIndex=-1;

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
          roomIndex=cells.findIndex(x=>x.includes('phong')||x.includes('dia diem')||x==='room');
          courseIndex=cells.findIndex(x=>x.includes('hoc phan')||x.includes('mon hoc')||x.includes('hinh thuc'));
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
        const room=roomIndex>=0?String(r[roomIndex]||'').trim():'',courseType=courseIndex>=0?String(r[courseIndex]||'').trim():'';
        const roomCourse=plain(room+' '+courseType);
        const clockTable=/zoom|ly thuyet/.test(roomCourse)?'theory_zoom':/phong may|thuc hanh|thi nghiem|gdtc|giao duc the chat|quoc phong/.test(roomCourse)?'practical':'standard';
        out.rows.push({name:name,date:effectiveDate,period:range.key,start:range.start,end:range.end,room:room,courseType:courseType,clockTable:clockTable,line:i+1});
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
          const raw=plain(kindRow>=0?rows[kindRow][c]:''),kind=raw==='tn'||raw.includes('trac nghiem')?'TN':raw==='lt'||raw.includes('ly thuyet')?'LT':raw==='tl'||raw.includes('tu luan')?'TL':!raw&&slot?(slot.end-slot.start===1?'TN':'TL'):'';
          const half=plain(halfRow>=0?rows[halfRow][c]:''),ses=slot?(slot.start<6?1:slot.start<12?2:3):0,key=lastDate+'|'+(slot&&slot.label);
          let m='';if(!lastDate)m='Thiếu ngày thi';else if(!slot)m='Thiếu hoặc sai ca/tiết';else if(!Number.isInteger(need)||need<1||need>30)m='Số giảng viên cần phải từ 1 đến 30';else if(!kind)m='Thiếu loại ca Trắc nghiệm/Tự luận';
          if(!m&&seen[key])m='Ngày và ca/tiết bị lặp với cột '+seen[key];else if(!m)seen[key]=c+1;
          if(m){out.errors.push({line:c+1,msg:m});continue}
          out.rows.push({date:lastDate,period:slot.label,ses:ses,half:/toi|evening|night/.test(half)?'T':/chieu|afternoon/.test(half)?'C':/sang|morning/.test(half)?'S':slot.start<6?'S':slot.start<12?'C':'T',kind:kind,need:need,clockTable:'exam'});
        }
        pend=out;render();return;
      }
      let ix={date:0,slot:1,need:2,kind:3},header=-1;
      for(let i=0;i<Math.min(rows.length,12);i++){
        // SheetJS can return sparse rows or explicit undefined values for empty Excel cells.
        const cells=Array.from(rows[i]||[],v=>plain(v)),find=fn=>cells.findIndex(v=>fn(String(v??'')));
        const d=find(x=>x.includes('ngay')),s=find(x=>x.includes('ca')||x.includes('tiet')||x.includes('slot')),n=find(x=>x.includes('can')||x.includes('so gv')||x.includes('giang vien')),k=find(x=>x.includes('loai'));
        // File phân công dự kiến có thể chỉ gồm Ngày thi, Tiết và Số GV cần cấp.
        // Nếu thiếu Loại ca: ca 2 tiết mặc định Trắc nghiệm, ca dài hơn mặc định Tự luận.
        if(d>=0&&s>=0&&n>=0){ix={date:d,slot:s,need:n,kind:k};header=i;break}
      }
      rows.forEach((r,i)=>{
        if(i<=header||!r||!r.some(x=>String(x||'').trim()))return;
        const dateText=String(r[ix.date]||'').trim(),slotText=String(r[ix.slot]||'').trim(),needText=String(r[ix.need]||'').trim();
        const date=parseDate(dateText),slot=parseExamSlot(slotText);
        // Skip footer/signature rows that contain no recognizable exam data, such as
        // "TP. HCM, ngày ...". Keep rows with any date, slot, or numeric need signal
        // so malformed exam records still appear in the import error list.
        if(!date&&!slot&&!/^\d+$/.test(needText))return;
        const need=parseInt(needText.replace(/[^0-9]/g,''),10),raw=ix.kind>=0?plain(r[ix.kind]):'';
        const kind=raw==='tn'||raw.includes('trac nghiem')?'TN':raw==='lt'||raw.includes('ly thuyet')?'LT':raw==='tl'||raw.includes('tu luan')?'TL':!raw&&slot?(slot.end-slot.start===1?'TN':'TL'):'';
        let m='';
        if(!date)m='Ngày thi không hợp lệ, cần dạng dd/mm/yyyy';else if(!slot)m='Ca/tiết không hợp lệ (ví dụ Ca 1 hoặc 1 → 2)';else if(!Number.isInteger(need)||need<1||need>30)m='Số giảng viên cần phải từ 1 đến 30';else if(!kind)m='Loại ca phải là Trắc nghiệm (TN) hoặc Tự luận (TL)';
        const ses=slot?(slot.start<6?1:slot.start<12?2:3):0,key=date+'|'+(slot&&slot.label);
        if(!m&&seen[key])m='Ngày và ca/tiết bị lặp với dòng '+seen[key];else if(!m)seen[key]=i+1;
        if(m){out.errors.push({line:i+1,msg:m});return}
        out.rows.push({date:date,period:slot.label,ses:ses,half:slot.start<6?'S':slot.start<12?'C':'T',kind:kind,need:need,clockTable:'exam'});
      });
      pend=out;render();
    }).catch(er=>toast(er.message));
    t.value='';
  }
};
document.addEventListener('change',e=>{const t=e.target,f=t.dataset&&t.dataset.chg;if(f&&C[f])C[f](t,e)});
const I={
  'dot-lec-q'(t){dotPick.q=t.value;$('#dotLecList').innerHTML=dotLecRows();updateDotLecSelectAll()},
  'busy-search'(t){busyReqSearch=t.value;clearTimeout(I._busyTimer);I._busyTimer=setTimeout(()=>{A['load-busy-requests']()},300)},
  'accounts-search'(t){accountsSearch=t.value;refreshAccountRows()},
  lq(t){F.lq=t.value;$('#lecRows').innerHTML=lecRows();updateLecturerCount()},
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
