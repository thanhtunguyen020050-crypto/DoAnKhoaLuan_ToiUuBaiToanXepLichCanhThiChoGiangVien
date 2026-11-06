/* ========= Render ========= */
function render(){
  syncQuota();save();
  const app=$('#app');
  if(!cur){app.innerHTML=loginView();return}
  if(!canSee(view))view='home';
  const pages={home:homeView,sys:sysView,lec:lecView,exam:examView,cons:consView,sched:schedView,rep:repView,accounts:accountsView,busy_reqs:busyReqsView};
  app.innerHTML=topbar()+'<div class="shell">'+sidebar()+'<main class="main">'+pages[view]()+'</main></div>';
  updateLecturerCount();refreshAdminBell();refreshAdminBusyCount();ensureAdminRequestPolling();
  if(view==='sched'){
    loadScheduleSharingStatus();
    startScheduleRunStatusPolling();
  }else stopScheduleRunStatusPolling();
}
let scheduleRunStatusTimer=null,scheduleRunStatusLoading=false;
function scheduleRunDuration(seconds){
  const elapsed=Math.max(0,Number(seconds)||0),total=elapsed?Math.ceil(elapsed):0,h=Math.floor(total/3600),m=Math.floor(total%3600/60),s=total%60;
  return [h,m,s].map(x=>String(x).padStart(2,'0')).join(':');
}
function scheduleRunStatusHtml(run){
  if(!run){
    if(S.scheduleRunError)return '<div class="sched-run-empty"><b>Lần xếp lịch chưa nhận được kết quả.</b><span class="sched-run-result-error" role="alert">'+esc(S.scheduleRunError)+'</span></div>';
    return '<div class="sched-run-empty"><b>Chưa có lần xếp lịch tự động nào gần đây.</b><span>Khi quản trị viên chạy xếp lịch, trạng thái và thời gian sẽ hiện ở đây.</span></div>';
  }
  const running=run.status==='RUNNING',phase=run.phase||'',phaseIndex=phase==='preparing'?0:phase==='finding_feasible'?1:phase==='optimizing_soft'?2:3;
  const steps=['Chuẩn bị dữ liệu','Tìm lịch thỏa ràng buộc cứng','Tối ưu ràng buộc mềm'];
  const started=run.started_at?new Date(run.started_at).toLocaleString('vi-VN'):'';
  const completed=run.completed_at?new Date(run.completed_at).toLocaleString('vi-VN'):'';
  const resultLabels={OPTIMAL:'Đã tìm được lịch tối ưu',FEASIBLE:'Đã tìm được lịch phù hợp',INFEASIBLE:'Không tìm được lịch thỏa ràng buộc cứng',UNKNOWN:'Hết thời gian trước khi tìm được lịch',INVALID:'Dữ liệu xếp lịch chưa hợp lệ',ERROR:'Có lỗi khi xếp lịch'};
  const progress=running?'<div class="sched-run-steps">'+steps.map((label,index)=>'<span class="'+(index<phaseIndex?'done':index===phaseIndex?'current':'')+'"><i>'+(index<phaseIndex?'✓':index+1)+'</i>'+label+'</span>').join('')+'</div><div class="sched-run-track"><i></i></div>':'';
  const solverStats=Number(run.solutions_found)>0?'<span>Đã tìm thấy '+Number(run.solutions_found).toLocaleString('vi-VN')+' phương án</span>':'';
  const objective=run.best_objective!=null?'<span>Điểm đánh giá tốt nhất: '+Number(run.best_objective).toLocaleString('vi-VN')+'</span>':'';
  const heading=running?'Đang xếp lịch tự động':run.status==='FAILED'?'Lần xếp lịch gần nhất bị lỗi':'Lần xếp lịch gần nhất đã hoàn tất';
  const detail=running?(run.phase_label||'Bộ giải đang xử lý lịch'):(resultLabels[run.result_status]||run.result_status||'Đã kết thúc');
  const solverMode=Number(run.time_limit_seconds)<=30?'Xếp nhanh · 30 giây':Number(run.time_limit_seconds)>=300?'Tối ưu sâu · 5 phút':'Tiêu chuẩn · 2 phút';
  const modeSummary='<span>Chế độ: '+solverMode+'</span>';
  const assignmentSummary=run.assigned_count==null?'':'<span>Đã xếp '+Number(run.assigned_count).toLocaleString('vi-VN')+' / '+Number(run.needed_count||0).toLocaleString('vi-VN')+' lượt · Còn thiếu '+Number(run.missing_count||0).toLocaleString('vi-VN')+'</span>';
  const localError=S.scheduleRunError?'<p class="sched-run-result-error" role="alert">'+esc(S.scheduleRunError)+'</p>':'';
  return '<div class="sched-run-head"><div><b>'+heading+'</b><span>Đợt thi '+esc(run.ma_dot||'')+' · Bắt đầu '+esc(started)+'</span></div><strong class="sched-run-clock">'+scheduleRunDuration(run.elapsed_seconds)+'</strong></div>'+(running?progress:'')+'<div class="sched-run-meta">'+modeSummary+(running?'<span>'+esc(detail)+'</span>'+solverStats+objective:'<span>Kết quả: '+esc(detail)+'</span>'+assignmentSummary+'<span>Thời gian chạy: '+scheduleRunDuration(run.elapsed_seconds)+'</span><span>Hoàn tất: '+esc(completed)+'</span>')+'</div>'+(running?'<p class="sched-run-note">Điểm đánh giá càng thấp thì lịch càng tốt. Bộ giải chưa thể đưa ra phần trăm hoàn thành chính xác.</p>':'')+localError;
}
function updateScheduleRunStatus(run){
  const node=$('#scheduleRunStatus');
  if(node)node.innerHTML=scheduleRunStatusHtml(run);
}
async function pollScheduleRunStatus(){
  if(view!=='sched'||!cur||scheduleRunStatusLoading)return;
  scheduleRunStatusLoading=true;
  try{const result=await API.scheduleRunStatus();updateScheduleRunStatus(result.run||null)}
  catch(error){
    if(S.scheduleRunError)updateScheduleRunStatus(null);
    else{
      const node=$('#scheduleRunStatus');
      if(node)node.innerHTML='<div class="sched-run-empty"><b>Không kết nối được để lấy trạng thái xếp lịch.</b><span class="sched-run-result-error" role="alert">'+esc(error.message||error)+'</span></div>';
    }
  }
  finally{scheduleRunStatusLoading=false}
}
function startScheduleRunStatusPolling(){
  if(!scheduleRunStatusTimer){pollScheduleRunStatus();scheduleRunStatusTimer=setInterval(pollScheduleRunStatus,1500)}
}
function stopScheduleRunStatusPolling(){
  if(scheduleRunStatusTimer){clearInterval(scheduleRunStatusTimer);scheduleRunStatusTimer=null}
}
function updateScheduleSharingControls(){
  const status=$('#scheduleSharingStatus'),badge=$('#scheduleSharingBadge'),toggle=document.querySelector('[data-act="toggle-schedule-sharing"]'),reload=document.querySelector('[data-act="refresh-schedule-sharing"]');
  if(!status||!toggle)return;
  if(scheduleSharingLoading){status.textContent='Đang tải trạng thái chia sẻ…';if(badge)badge.textContent='Đang tải…';toggle.innerHTML='<span class="sched-switch" aria-hidden="true"><i></i></span><span>Đang đọc…</span>';toggle.className='btn sched-share-toggle';toggle.disabled=true;if(reload)reload.disabled=true;return}
  if(scheduleSharingError){status.textContent='Không tải được: '+scheduleSharingError;if(badge)badge.textContent='Chưa sẵn sàng';toggle.innerHTML='<span class="sched-switch" aria-hidden="true"><i></i></span><span>Chưa sẵn sàng</span>';toggle.className='btn sched-share-toggle';toggle.disabled=true;if(reload)reload.disabled=false;return}
  const enabled=!!scheduleSharingEnabled;
  status.textContent=enabled?'Đang bật — giảng viên có thể chọn xem lịch của nhau.':'Đang tắt — giảng viên chỉ xem lịch cá nhân.';
  if(badge){badge.textContent=enabled?'Đang bật · Xem lịch chung':'Đang tắt · Chỉ xem cá nhân';badge.classList.toggle('is-on',enabled)}
  toggle.innerHTML='<span class="sched-switch" aria-hidden="true"><i></i></span><span>Cho phép xem chung</span>';
  toggle.className='btn sched-share-toggle'+(enabled?' is-on':'');
  toggle.setAttribute('aria-pressed',String(enabled));
  toggle.disabled=false;
  if(reload)reload.disabled=false;
}
function loadScheduleSharingStatus(force=false){
  if(view!=='sched'||!cur)return;
  if(force){scheduleSharingEnabled=null;scheduleSharingError=''}
  if(scheduleSharingLoading){updateScheduleSharingControls();return}
  if(scheduleSharingEnabled!==null&&!scheduleSharingError){updateScheduleSharingControls();return}
  if(scheduleSharingError&&!force){updateScheduleSharingControls();return}
  scheduleSharingLoading=true;updateScheduleSharingControls();
  API.scheduleSharing().then(result=>{
    scheduleSharingEnabled=!!result.enabled;scheduleSharingError=result.migration_required?'Cần chạy database/migrations/20261027_schedule_sharing.sql trước khi bật.':'';
  }).catch(error=>{
    scheduleSharingEnabled=null;scheduleSharingError=error.message||'Hãy áp dụng migration SQL chia sẻ lịch.';
  }).finally(()=>{
    scheduleSharingLoading=false;
    if(view==='sched')updateScheduleSharingControls();
  });
}
function snapshot(mode){
  const a=analyze();
  const score=mode==='Google OR-Tools CP-SAT'?S.solverPenaltyReport:null,scoreS1=score?.details?.S1;
  const s1={version:2,on:score?(score.penalties?.S1!=null):!!a.S1.enabled,
    penalty:score?score.penalties?.S1:a.S1.penalty,
    lecturerDays:scoreS1?.lecturer_days??a.S1.lecturerDays,
    singletonDays:scoreS1?.singleton_exam_days??a.S1.singletonDays,pct:a.S1.pct};
  S.hist.push({id:S.nid++,time:new Date().toLocaleString('vi-VN'),mode:mode,count:a.assigned,pct:a.overall,s1:s1,solverPenaltyReport:score,snap:S.exams.map(e=>[e.id,e.asg.map(x=>[x.l,x.lock?1:0])])});
  if(S.hist.length>20)S.hist.shift();
}
function lecForm(l){
  const bms=window.__BOMON||[],bm=l&&l.ma_bo_mon||((bms[0]||{}).MaBoMon||'');
  openModal({title:l?'Sửa giảng viên':'Thêm giảng viên',body:'<label class="f"><span>Họ tên</span><input type="text" id="fn" maxlength="120" value="'+esc(l?l.name:'')+'" required></label><label class="f"><span>Khoa</span><input type="text" id="fd" value="Khoa Công nghệ Thông tin" readonly></label><label class="f"><span>Bộ môn</span><select id="fbm">'+bms.map(x=>'<option value="'+esc(x.MaBoMon)+'"'+(bm===x.MaBoMon?' selected':'')+'>'+esc(x.TenBoMon)+'</option>').join('')+'</select></label><label class="f"><span>Email <small class="muted">(không bắt buộc)</small></span><input type="email" id="femail" maxlength="150" value="'+esc(l?l.email||'':'')+'" placeholder="name@huit.edu.vn"></label><label class="f"><span>Định mức (%)</span><input type="number" id="fq" min="0" max="100" value="'+(l?l.pct:100)+'"></label><div class="err" id="ferr"></div>',foot:'<button class="btn" data-act="close">Hủy</button><button class="btn pri" data-act="save-lec" data-id="'+(l?l.id:'')+'">Lưu</button>'});
}
function pickList(){
  const ex=exm(pick.ex),q=(pick.q||'').trim().toLowerCase();
  const L=S.lecs.filter(l=>inDot(l)&&!ex.asg.some(a=>a.l===l.id)&&(!q||l.name.toLowerCase().indexOf(q)>=0)).map(l=>({l:l,iss:hardIssues(ex,l.id),ld:loadOf(l.id,null)})).sort((a,b)=>a.iss.length-b.iss.length||a.ld/Math.max(a.l.quota,1)-b.ld/Math.max(b.l.quota,1));
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

/* ===== Chọn giảng viên tham gia đợt gác thi ===== */
let dotPick=null;
function dotLecFiltered(){
  const q=plain(dotPick.q||''),dept=dotPick.dept||'';
  return S.lecs.filter(l=>(!dept||l.dept===dept)&&(!q||plain([l.name,l.id,l.bomon,l.ma_bo_mon,l.dept].join(' ')).includes(q)));
}
function dotLecCount(){return dotPick.sel.size+' / '+S.lecs.length+' giảng viên được chọn'}
function updateDotLecSelectAll(){
  const control=document.querySelector('[data-chg="dot-lec-all"]');if(!control)return;
  const visible=dotLecFiltered(),selected=visible.filter(l=>dotPick.sel.has(String(l.id))).length;
  control.checked=visible.length>0&&selected===visible.length;
  control.indeterminate=selected>0&&selected<visible.length;
}
function dotLecRows(){
  const L=dotLecFiltered();
  if(!L.length)return '<p class="muted" style="padding:14px 0">Không có giảng viên phù hợp.</p>';
  return '<div class="bz" style="grid-template-columns:36px minmax(180px,1.35fr) minmax(180px,1.2fr)"><span class="c hd"></span><span class="hd">Giảng viên</span><span class="hd">Bộ môn / Khoa</span>'+L.map(l=>
    '<span class="c"><input type="checkbox" value="'+esc(l.id)+'"'+(dotPick.sel.has(String(l.id))?' checked':'')+' data-chg="dot-lec-one" aria-label="Chọn '+esc(l.name)+'"></span>'+
    '<span class="dot-lec-person"><b>'+esc(l.name)+'</b><small>'+esc(l.id)+'</small></span><span class="dot-lec-unit"><b>'+esc(l.bomon||'Chưa phân bộ môn')+'</b><small>'+esc(l.dept||'Chưa phân khoa')+'</small></span>').join('')+'</div>';
}
function dotLecForm(){
  dotPick={q:'',dept:'',sel:new Set(S.lecs.filter(inDot).map(l=>String(l.id)))};
  openModal({title:'Chọn giảng viên tham gia đợt gác thi',wide:true,className:'dot-lecturer-picker',
    body:'<p class="hint">Chọn giảng viên theo bộ môn. Sau khi lưu danh sách, nhập định mức (%) cho từng người ngay trong bảng.</p>'+
      '<div class="tools dot-picker-toolbar"><div class="grow"><input type="text" data-inp="dot-lec-q" placeholder="Tìm tên, mã giảng viên hoặc bộ môn"></div>'+
      '<select data-chg="dot-lec-dept" aria-label="Lọc theo khoa"><option value="">Tất cả khoa</option>'+depts().map(d=>'<option value="'+esc(d)+'"'+(dotPick.dept===d?' selected':'')+'>'+esc(d)+'</option>').join('')+'</select>'+
      '<label class="muted"><input type="checkbox" data-chg="dot-lec-all"> Chọn tất cả đang hiển thị</label></div>'+
      '<div id="dotLecList">'+dotLecRows()+'</div><p class="muted" id="dotLecCount">'+dotLecCount()+'</p><div class="err" id="ferr"></div>',
    foot:'<button class="btn" data-act="close">Hủy</button><button class="btn pri" data-act="save-dot-lec">Lưu danh sách</button>'});
  updateDotLecSelectAll();
}
