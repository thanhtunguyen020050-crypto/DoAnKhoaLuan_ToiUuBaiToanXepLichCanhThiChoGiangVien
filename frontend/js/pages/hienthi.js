/* ========= Render ========= */
function render(){
  syncQuota();save();
  const app=$('#app');
  if(!cur){app.innerHTML=loginView();return}
  if(!canSee(view))view='home';
  const pages={home:homeView,sys:sysView,lec:lecView,exam:examView,cons:consView,sched:schedView,rep:repView,accounts:accountsView,busy_reqs:busyReqsView};
  app.innerHTML=topbar()+'<div class="shell">'+sidebar()+'<main class="main">'+pages[view]()+'</main></div>';
  const lc=$('#lcount');if(lc)lc.textContent=S.lecs.length+' giảng viên';refreshAdminBell();
}
function snapshot(mode){
  const a=analyze();
  S.hist.push({id:S.nid++,time:new Date().toLocaleString('vi-VN'),mode:mode,count:a.assigned,pct:a.overall,s1:{on:a.S1.enabled,weight:a.S1.weight,gapDays:a.S1.fragmentedDays,gapEvents:a.S1.gapEvents,idlePeriods:a.S1.idlePeriods,sessionBreaks:a.S1.sessionBreaks,penaltyUnits:a.S1.penaltyUnits,penalty:a.S1.penalty,lecturerDays:a.S1.total,multiShiftDays:a.S1.multiShiftDays},snap:S.exams.map(e=>[e.id,e.asg.map(x=>[x.l,x.lock?1:0])])});
  if(S.hist.length>20)S.hist.shift();
}
function lecForm(l){
  const bms=window.__BOMON||[],bm=l&&l.ma_bo_mon||((bms[0]||{}).MaBoMon||'');
  openModal({title:l?'Sửa giảng viên':'Thêm giảng viên',body:'<label class="f"><span>Họ tên</span><input type="text" id="fn" value="'+esc(l?l.name:'')+'"></label><label class="f"><span>Khoa</span><input type="text" id="fd" value="Khoa Công nghệ Thông tin" readonly></label><label class="f"><span>Bộ môn</span><select id="fbm">'+bms.map(x=>'<option value="'+esc(x.MaBoMon)+'"'+(bm===x.MaBoMon?' selected':'')+'>'+esc(x.TenBoMon)+'</option>').join('')+'</select></label><label class="f"><span>Định mức (%)</span><input type="number" id="fq" min="0" max="100" value="'+(l?l.pct:100)+'"></label><div class="err" id="ferr"></div>',foot:'<button class="btn" data-act="close">Hủy</button><button class="btn pri" data-act="save-lec" data-id="'+(l?l.id:'')+'">Lưu</button>'});
}
function pickList(){
  const ex=exm(pick.ex),q=(pick.q||'').trim().toLowerCase();
  const L=S.lecs.filter(l=>!ex.asg.some(a=>a.l===l.id)&&(!q||l.name.toLowerCase().indexOf(q)>=0)).map(l=>({l:l,iss:hardIssues(ex,l.id),ld:loadOf(l.id,null)})).sort((a,b)=>a.iss.length-b.iss.length||a.ld/Math.max(a.l.quota,1)-b.ld/Math.max(b.l.quota,1));
  return L.length?L.map(x=>'<div class="pi"><div class="t"><b>'+esc(x.l.name)+'</b><span>'+esc(x.l.dept)+', đã gác '+x.ld+'/'+x.l.quota+' ca</span></div>'+x.iss.map(i=>'<span class="chip bad">'+i+'</span>').join('')+'<button class="btn sm '+(x.iss.length?'':'pri')+'" data-act="pick-ok" data-l="'+x.l.id+'">'+(x.iss.length?'Vẫn chọn':'Chọn')+'</button></div>').join(''):'<p class="muted" style="padding:14px 0">Không có giảng viên phù hợp.</p>';
}
function doPre(){
  const list=precheck();pre={list:list,blocked:list.some(x=>x.lv==='bad')};return pre;
}
async function runAuto(){
  const p=doPre();
  if(p.blocked){render();toast('Dữ liệu chưa đủ điều kiện xếp, xem kết quả kiểm tra bên dưới.');return}
  await autoRun();
}

function copyText(t){
  const p=(navigator.clipboard&&navigator.clipboard.writeText)?navigator.clipboard.writeText(t):Promise.reject();
  p.then(()=>toast('Đã sao chép. Mở Excel và dán để dùng.')).catch(()=>{
    openModal({title:'Sao chép lịch',body:'<p class="muted" style="margin-bottom:8px">Chọn toàn bộ nội dung bên dưới, sao chép rồi dán vào Excel.</p><textarea id="cp" class="ta" readonly>'+esc(t)+'</textarea>',foot:'<button class="btn" data-act="close">Đóng</button>'});
    setTimeout(()=>{const a=$('#cp');if(a)a.select()},30);
  });
}

