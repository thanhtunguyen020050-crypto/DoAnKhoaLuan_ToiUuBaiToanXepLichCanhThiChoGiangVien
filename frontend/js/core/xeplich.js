/* ========= Lõi xếp lịch ========= */
function targets(){
  const lecturers=S.lecs.filter(inDot);
  const tot=S.exams.reduce((n,e)=>n+e.need,0),act=lecturers.filter(l=>l.pct>0),pUnits=new Map(act.map(l=>[String(l.id),Math.round(Number(l.pct)*100)])),sp=act.reduce((n,l)=>n+pUnits.get(String(l.id)),0),t={};
  S.lecs.forEach(l=>t[l.id]=0);
  if(!sp)return t;
  let used=0;const fr=[];
  act.forEach(l=>{const p=pUnits.get(String(l.id)),numerator=tot*p,f=Math.floor(numerator/sp),r=numerator-f*sp;t[l.id]=f;used+=f;fr.push({l:l,p:p,r:r})});
  // Match SQL sp_TinhDinhMucTheoTyLe: fractional remainder DESC,
  // percentage DESC, then lecturer ID ASC.
  fr.sort((a,b)=>b.r-a.r||b.p-a.p||(String(a.l.id)<String(b.l.id)?-1:String(a.l.id)>String(b.l.id)?1:0));
  for(let i=0;used<tot;i=(i+1)%fr.length,used++)t[fr[i].l.id]++;
  return t;
}
const tg=()=>{const M=S.lecs.filter(inDot);return M.length&&M.every(l=>l.quota_authoritative)?Object.fromEntries(S.lecs.map(l=>[String(l.id),inDot(l)?(Number(l.quota)||0):0])):targets()};
async function persistAssignments(){
  const maDot=S.exams.find(e=>e.ma_dot)?.ma_dot||window.__MA_DOT;
  if(!maDot)throw new Error('Không xác định được đợt thi để lưu phân công.');
  const assignments=S.exams.flatMap(e=>e.asg.map(a=>({ma_ca:e.ma_ca,ma_gv:String(a.l)})));
  return API.saveAssignments(maDot,assignments);
}
function syncQuota(){if(!S.exams.length)return;const T=targets();S.lecs.forEach(l=>{if(!l.quota_authoritative)l.quota=T[l.id]??0})}
function loadOf(lid,except){let n=0;S.exams.forEach(e=>{if(e.id!==except)n+=e.asg.filter(a=>a.l===lid).length});return n}
function rangeFor(e){if(e.period){const m=String(e.period).match(/(\d+)\s*[→>-]\s*(\d+)/);if(m)return[+m[1],+m[2]]}return({1:[1,2],2:[3,4],3:[7,8],4:[9,10]})[e.ses]||[0,0]}
function overlaps(a,b){const x=rangeFor(a),y=rangeFor(b);return x[0]<=y[1]&&y[0]<=x[1]}
function dupSlot(ex,lid){return S.exams.some(e=>e.id!==ex.id&&e.date===ex.date&&overlaps(e,ex)&&e.asg.some(a=>a.l===lid))}
function sessionCode(e){
  const label=String(e&&(e.buoi||e.Buoi||e.session_label||e.time_of_day)||'').toLowerCase();
  if(['sáng','sang','morning'].some(word=>label.includes(word)))return 'S';
  if(['chiều','chieu','afternoon'].some(word=>label.includes(word)))return 'C';
  if(['tối','toi','night','evening'].some(word=>label.includes(word)))return 'T';
  const start=rangeFor(e)[0];
  return start<=6?'S':start<=12?'C':'T';
}
function mixKind(ex,lid){return S.exams.some(e=>e.id!==ex.id&&e.date===ex.date&&sessionCode(e)===sessionCode(ex)&&e.kind!==ex.kind&&e.asg.some(a=>a.l===lid))}
function busyInfo(l,e){
  if(!l||!e)return null;
  const r=rangeFor(e),day=e.date;
  const arr=l.busy||[];
  return arr.map(b=>typeof b==='string'?{key:b,priority:3,reason:null}:b).find(b=>{
    if(!b||!String(b.key||'').startsWith(day+'|'))return false;
    const block=String(b.key).split('|')[1],br=block==='S'?[1,6]:[7,12];
    return r[0]<=br[1]&&br[0]<=r[1];
  })||null;
}
function busyHard(l,e){const b=busyInfo(l,e);return !!b&&Number(b.priority)===1}
function busyPenalty(l,e){
  const b=busyInfo(l,e);if(!b)return 0;
  const p=Number(b.priority);if(p===1)return 10000000;
  const id=p===2?'S6':'S7',rule=S.soft?.[id];
  return rule?.on?SOFT_POINTS[id]:0;
}
function isTeach(l,e){const r=rangeFor(e);return(l.teach||[]).some(raw=>{const t=teachingEntry(raw);if(t.date!==e.date)return false;return r[0]<=t.end&&t.start<=r[1]})}
function minTravelSlotsFor(ex){
  const dotId=ex&&((ex.ma_dot??ex.MaDot)??window.__MA_DOT);
  const dot=(S.dots||[]).find(x=>String(x.MaDot)===String(dotId));
  const configured=ex?.SoTietDiChuyenToiThieu??dot?.SoTietDiChuyenToiThieu;
  const slots=RB7.minTravelSlots(configured);
  if(slots===null)console.error('RB7: SoTietDiChuyenToiThieu không hợp lệ; bỏ qua kiểm tra RB7 cho ca '+String(ex?.ma_ca??ex?.id??''));
  return slots;
}
function rb7TeachingComparisons(l,e){
  if(!l||!e)return {eligible:0,violation:false};
  const examRange=rangeFor(e),minSlots=minTravelSlotsFor(e);
  if(minSlots===null)return {eligible:0,violation:false};
  let eligible=0,violation=false;
  (l.teach||[]).forEach(raw=>{
    const t=teachingEntry(raw);
    if(t.date!==e.date)return;
    const result=RB7.teachingExamResult(t.room,t.start,t.end,examRange[0],examRange[1],minSlots);
    if(!result.eligible)return;
    eligible++;
    if(result.violation)violation=true;
  });
  return {eligible:eligible,violation:violation};
}
function rb9CalendarEntry(raw){
  if(typeof raw==='string'){
    const [date,detail='']=raw.split('|'),match=detail.match(/(\d+)\s*[→>-]\s*(\d+)/);
    const single=Number(detail);
    if(!date)return null;
    return {date:String(date).slice(0,10),start:match?Number(match[1]):(Number.isFinite(single)?single:NaN),end:match?Number(match[2]):(Number.isFinite(single)?single:NaN)};
  }
  const date=String(raw&&(raw.date??raw.NgayDay??raw.NgayThi??raw.Ngay)||'').slice(0,10);
  const startRaw=raw&&(raw.start??raw.TuTiet),endRaw=raw&&(raw.end??raw.DenTiet);
  if(!date||startRaw==null||endRaw==null||startRaw===''||endRaw==='')return null;
  const start=Number(startRaw),end=Number(endRaw);
  return Number.isFinite(start)&&Number.isFinite(end)?{date:date,start:start,end:end}:null;
}
function rb9ExamType(ex){
  const [start,end]=rangeFor(ex),kind=plain(ex&&(ex.kind??ex.HinhThucThi??ex.LoaiCa)||'');
  return end-start+1===2||['tn','lt','trac nghiem','ly thuyet','multiple choice','theory'].includes(kind)?'TN':'TL';
}
function h8DailyLoad(l,ex,lid){
  if(!l||!ex)return {applicable:false,violation:false,total:0};
  const [start]=rangeFor(ex);
  if(start<13)return {applicable:false,violation:false,total:0};
  const day=String(ex.date??ex.NgayThi??'').slice(0,10);
  const baseEvents=[...(l?.teach||[]),...(l?.duty||[])].map(rb9CalendarEntry).filter(event=>event&&event.date===day);
  const baseLoad=baseEvents.reduce((sum,event)=>sum+event.end-event.start+1,0);
  const examDot=item=>String(item.ma_dot??item.MaDot??window.__MA_DOT??'');
  const assigned=S.exams.filter(item=>String(item.date??item.NgayThi??'').slice(0,10)===day
    &&String(item.id)!==String(ex.id)
    &&examDot(item)===examDot(ex)
    &&(item.asg||[]).some(assignment=>String(assignment.l)===String(lid)));
  const dayExams=[...assigned,ex];
  const examLoad=dayExams.reduce((sum,item)=>{const [from,to]=rangeFor(item);return sum+to-from+1},0);
  const total=baseLoad+examLoad;
  return {applicable:true,violation:total>12,total:total};
}
function rb9DayViolation(l,ex,lid){
  if(!l||!ex)return false;
  const day=String(ex.date??ex.NgayThi??'').slice(0,10);
  const baseEvents=[...(l.teach||[]),...(l.duty||[])].map(rb9CalendarEntry).filter(event=>event&&event.date===day);
  const basePeriods=baseEvents.reduce((sum,event)=>sum+Math.max(0,event.end-event.start+1),0);
  const baseBlocks=baseEvents.length;
  let maxTN=Number.MAX_SAFE_INTEGER,maxTL=Number.MAX_SAFE_INTEGER;
  if(basePeriods>=5&&basePeriods<=6){maxTN=3;maxTL=2}
  else if(baseBlocks===1){maxTN=4;maxTL=3}
  else if(baseBlocks===2){maxTN=2;maxTL=2}
  else if(baseBlocks>=3){maxTN=1;maxTL=1}

  const examDot=item=>String(item.ma_dot??item.MaDot??window.__MA_DOT??'');
  const sameDayAssigned=S.exams.filter(item=>String(item.date??item.NgayThi??'').slice(0,10)===day
    &&String(item.id)!==String(ex.id)
    &&(item.asg||[]).some(assignment=>String(assignment.l)===String(lid)));
  const dayAssigned=[...sameDayAssigned,ex];
  const sameDotAssigned=dayAssigned.filter(item=>examDot(item)===examDot(ex));
  const tn=sameDotAssigned.filter(item=>rb9ExamType(item)==='TN').length;
  const tl=sameDotAssigned.length-tn;
  if(tn>maxTN||tl>maxTL)return true;

  if(!sameDotAssigned.some(item=>rangeFor(item)[0]>=13))return false;
  const externalEvents=(l.rb9OtherExams||[]).map(rb9CalendarEntry).filter(event=>event&&event.date===day);
  const events=baseEvents.concat(externalEvents,dayAssigned.map(item=>{
    const [start,end]=rangeFor(item);return {start:start,end:end};
  })).sort((a,b)=>a.start-b.start||a.end-b.end);
  let reach=null,count=0,maxContinuous=0;
  events.forEach(event=>{
    if(reach===null||event.start>reach+1){reach=event.end;count=1}
    else{reach=Math.max(reach,event.end);count++}
    maxContinuous=Math.max(maxContinuous,count);
  });
  return maxContinuous>=3;
}
function hardIssues(ex,lid){
  const l=lec(lid),out=[];if(!l)return ['Giảng viên không còn trong danh sách hiện tại'];
  if(dupSlot(ex,lid))out.push('Trùng ca');
  if(isTeach(l,ex))out.push('Có lịch dạy');
  if(rb7TeachingComparisons(l,ex).violation)out.push('Thiếu thời gian di chuyển khác cơ sở');
  if(rb9DayViolation(l,ex,lid))out.push('Giới hạn ca trong ngày và lịch nối tiếp');
  if(busyHard(l,ex))out.push('Bận mức 1 - phải né');
  if(mixKind(ex,lid))out.push('Khác loại ca trong buổi');
  const q=Number(tg()[lid])||0;
  if(q<=0||loadOf(lid,ex.id)+1>q)out.push(q>0?'Vượt định mức cho phép':'Định mức 0 ca');
  return out;
}
function solverSoftConfig(){
  const soft={},soft_weights={};
  SOFT.forEach((item,index)=>{
    const saved=S.soft?.[item.id]||{},on=saved.on!==false;
    const configured=SOFT_POINTS[item.id],penalty=typeof configured==='number'?configured:configured.perDay;
    const weight=on?penalty:0;
    soft[item.id]={on:on,enabled:on,w:weight,weight:weight,priority:index+1};
    soft_weights[item.id]=weight;
  });
  return{soft:soft,soft_weights:soft_weights};
}
async function waitForScheduleResult(maDot,runId,timeLimitSeconds=120){
  const deadline=Date.now()+(Math.max(30,Number(timeLimitSeconds)||120)+120)*1000;
  let lastError=null;
  while(Date.now()<deadline){
    try{
      const state=await API.scheduleResult(maDot,runId);
      lastError=null;
      if(state.status==='FAILED'||state.error){const error=new Error(state.error||'Backend không hoàn tất được lần xếp lịch.');error.terminal=true;throw error;}
      if(!state.running&&state.result)return state.result;
      if(!state.running){const error=new Error('Lần xếp lịch đã kết thúc nhưng máy chủ không lưu được kết quả.');error.terminal=true;throw error;}
    }catch(error){
      if([401,403,404].includes(error.status)||error.terminal)throw error;
      lastError=error;
    }
    await new Promise(resolve=>setTimeout(resolve,1200));
  }
  throw new Error(lastError
    ?'Mất kết nối khi đang lấy kết quả: '+(lastError.message||lastError)
    :'Bộ giải vẫn chưa trả kết quả sau 5 phút. Hãy xem trạng thái lần chạy và thử lại.');
}
async function autoRun(){
  // Thuật toán chính chạy ở backend Python bằng Google OR-Tools CP-SAT.
  // A lock cannot be honored when that assignment already violates a hard
  // constraint (for example, two inclusive lesson ranges overlap). Make only
  // those invalid locks movable so CP-SAT can repair the schedule.
  const invalidLocks=new Set();
  S.exams.forEach(e=>e.asg.forEach(a=>{
    if(a.lock&&hardIssues(e,a.l).length)invalidLocks.add(String(e.id)+'|'+String(a.l));
  }));
  const softConfig=solverSoftConfig();
  const timeLimitSeconds=[30,120,300].includes(Number(S.scheduleTimeLimit))?Number(S.scheduleTimeLimit):120;
  const quickMode=timeLimitSeconds===30;
  const payload={
    lecturers:S.lecs.filter(inDot),
    exams:S.exams.map(e=>({...e,asg:e.asg.map(a=>({...a,lock:!!a.lock&&!invalidLocks.has(String(e.id)+'|'+String(a.l))}))})),
    soft:softConfig.soft,
    soft_weights:softConfig.soft_weights,
    ma_dot:window.__MA_DOT,
    time_limit_seconds:timeLimitSeconds
  };
  try{
    S.scheduleRunError=null;save();
    toast('Đang gửi yêu cầu xếp lịch. Bạn có thể theo dõi tiến trình ở khung trạng thái.');
    const run=await API.startSchedule(payload);
    const result=await waitForScheduleResult(run.ma_dot,run.run_id,timeLimitSeconds);
    if(!['OPTIMAL','FEASIBLE'].includes(result.status)){
      S.scheduleRunError=result.message||'CP-SAT không tìm được lịch phù hợp.';save();render();
      toast(S.scheduleRunError);
      return;
    }
    S.exams.forEach(e=>{e.asg=[]});
    result.assignments.forEach(a=>{
      const e=S.exams.find(x=>String(x.id)===String(a.exam_id));
      if(e)e.asg.push({l:a.lecturer_id,lock:!!a.locked});
    });
    if(result.quotas){
      S.lecs.forEach(l=>{l.quota=Number(result.quotas[String(l.id)]||0);l.quota_authoritative=true});
    }
    S.solverPenaltyReport={
      at:new Date().toISOString(),
      total:result.soft_penalty_total??result.objective_value??null,
      objectiveValue:result.objective_value??null,
      penalties:result.soft_penalties||{},
      violations:result.soft_violations||{},
      details:result.soft_details||{},
      weights:result.soft_weights||{}
    };
    S.scheduleRunError=null;
    S.schedulePublished=false;S.scheduleDraftDirty=true;
    snapshot('Google OR-Tools CP-SAT');
    pre=null;save();render();
    const report=analyze();
    const hardFailures=hardConstraintFailures(report);
    if(hardFailures.length){
      toast('Chưa xếp lịch thành công: còn vi phạm ràng buộc cứng — '+hardFailures.map(x=>x.name+' '+x.pct+'%').join(', ')+'.');
      return;
    }
    // Xếp tự động chỉ cập nhật bản nháp trong phiên admin.
    // Chỉ nút “Lưu và Công bố lịch” mới ghi phân công lên máy chủ.
    toast(quickMode
      ?'Xếp nhanh đã tìm được lịch hợp lệ và thử cải thiện ràng buộc mềm trong giới hạn 30 giây. Đây là bản nháp; nhấn “Lưu và Công bố lịch” để giảng viên xem.'
      :'Xếp lịch thành công. Đây là bản nháp; nhấn “Lưu và Công bố lịch” để giảng viên xem.');
  }catch(e){
    S.scheduleRunError='Không nhận được kết quả xếp lịch: '+(e.message||e);
    save();render();toast(S.scheduleRunError);
  }
}

function analyze(){
  const asg=[];S.exams.forEach(e=>e.asg.forEach(a=>asg.push({e:e,a:a})));
  const r={},so=S.soft,T=tg(),cnt=f=>asg.filter(f).length;
  const ls=S.lecs.filter(l=>T[l.id]>0||loadOf(l.id,null)>0);
  const missingLecturerAssignments=asg.filter(x=>!lec(x.a.l)).length;
  r.H1={ok:ls.filter(l=>loadOf(l.id,null)===(Number(T[l.id])||0)).length,total:ls.length+missingLecturerAssignments};
  r.H2={ok:S.exams.filter(e=>e.asg.length>=e.need).length,total:S.exams.length};
  r.H3={ok:asg.length-cnt(x=>dupSlot(x.e,x.a.l)),total:asg.length};
  r.H4={ok:asg.length-cnt(x=>{const l=lec(x.a.l);return l&&isTeach(l,x.e)}),total:asg.length};
  r.H5={ok:asg.length-cnt(x=>mixKind(x.e,x.a.l)),total:asg.length};
  r.H6={ok:asg.length-cnt(x=>busyHard(lec(x.a.l),x.e)),total:asg.length};
  const h7Checks=asg.map(x=>rb7TeachingComparisons(lec(x.a.l),x.e)).filter(x=>x.eligible>0);
  r.H7={ok:h7Checks.filter(x=>!x.violation).length,total:h7Checks.length};
  r.H9={ok:asg.length-cnt(x=>rb9DayViolation(lec(x.a.l),x.e,x.a.l)),total:asg.length};
  const byLecturerDay={};asg.forEach(x=>{const k=x.a.l+'|'+x.e.date;(byLecturerDay[k]=byLecturerDay[k]||[]).push(x.e)});
  const lecturerDayGroups=Object.entries(byLecturerDay).map(([key,shifts])=>({key:key,shifts:shifts})),examLecturerDays=Object.keys(byLecturerDay).length;
  const dayEventCounts={};
  S.lecs.filter(inDot).forEach(l=>[...(l.teach||[]),...(l.duty||[])].map(rb9CalendarEntry).filter(Boolean).forEach(event=>{
    const key=String(l.id)+'|'+event.date;dayEventCounts[key]=(dayEventCounts[key]||0)+1;
  }));
  asg.forEach(x=>{const key=String(x.a.l)+'|'+String(x.e.date).slice(0,10);dayEventCounts[key]=(dayEventCounts[key]||0)+1});
  const lecturerDays=Object.keys(dayEventCounts).length;
  const fixedDays=new Set(),examCounts={};
  S.lecs.filter(inDot).forEach(l=>[...(l.teach||[]),...(l.duty||[])].map(rb9CalendarEntry).filter(Boolean).forEach(event=>fixedDays.add(String(l.id)+'|'+event.date)));
  asg.forEach(x=>{const key=String(x.a.l)+'|'+String(x.e.date).slice(0,10);examCounts[key]=(examCounts[key]||0)+1});
  const singletonDays=Object.entries(examCounts).filter(([key,count])=>count===1&&!fixedDays.has(key)).length;
  const assignmentsOnSharedDays=asg.filter(x=>dayEventCounts[String(x.a.l)+'|'+String(x.e.date).slice(0,10)]>1).length;
  const s1Rule=so.S1||{},s1Points=SOFT_POINTS.S1.perDay*lecturerDays+SOFT_POINTS.S1.singletonExtra*singletonDays;
  r.S1={ok:assignmentsOnSharedDays,total:asg.length,
    pct:asg.length?Math.round(assignmentsOnSharedDays/asg.length*100):null,
    lecturerDays:lecturerDays,singletonDays:singletonDays,penaltyUnits:lecturerDays+singletonDays,
    weight:SOFT_POINTS.S1.perDay,penalty:s1Points,enabled:!!s1Rule.on};
  const rb8Days=new Set(asg.filter(x=>rangeFor(x.e)[0]>=13).map(x=>String(x.a.l)+'|'+String(x.e.date).slice(0,10)));
  const rb8ViolationDays=new Set(asg.filter(x=>rangeFor(x.e)[0]>=13&&h8DailyLoad(lec(x.a.l),x.e,x.a.l).violation)
    .map(x=>String(x.a.l)+'|'+String(x.e.date).slice(0,10)));
  r.RB8={ok:Math.max(0,rb8Days.size-rb8ViolationDays.size),total:rb8Days.size,
    violations:rb8ViolationDays.size,weight:SOFT_POINTS.RB8,
    penalty:rb8ViolationDays.size*SOFT_POINTS.RB8,enabled:!!so.RB8?.on};
  let fragmentedDays=0,gapEvents=0,idlePeriods=0,sessionBreaks=0,penaltyUnits=0,multiShiftDays=0;
  lecturerDayGroups.forEach(({key,shifts})=>{
    const split=key.lastIndexOf('|'),lid=key.slice(0,split),day=key.slice(split+1),lecturer=lec(lid);
    const fixed=[];
    [...(lecturer?.teach||[]),...(lecturer?.duty||[])].map(rb9CalendarEntry)
      .filter(event=>event&&event.date===day).sort((a,b)=>a.start-b.start||a.end-b.end).forEach(event=>{
        const previous=fixed[fixed.length-1];
        if(previous&&event.start<=previous.end+1)previous.end=Math.max(previous.end,event.end);
        else fixed.push({...event,isExam:false});
      });
    const ordered=fixed.concat(shifts.map(item=>{const [start,end]=rangeFor(item);return{start:start,end:end,isExam:true}}))
      .sort((a,b)=>a.start-b.start||a.end-b.end);
    if(shifts.length>1)multiShiftDays++;
    let fragmented=false;
    for(let i=1;i<ordered.length;i++){
      const prev=ordered[i-1],cur=ordered[i];
      if((!prev.isExam&&!cur.isExam)||prev.end>=cur.start)continue;
      const emptyPeriods=cur.start-prev.end-1;
      if(emptyPeriods<1||emptyPeriods>2)continue;
      fragmented=true;gapEvents++;idlePeriods+=emptyPeriods;penaltyUnits+=emptyPeriods;
    }
    if(fragmented)fragmentedDays++;
  });
  const gapRule=so.S3||{},gapWeight=gapRule.on?SOFT_POINTS.S3:0;
  r.S3={ok:examLecturerDays-fragmentedDays,total:examLecturerDays,fragmentedDays:fragmentedDays,gapEvents:gapEvents,idlePeriods:idlePeriods,sessionBreaks:sessionBreaks,penaltyUnits:penaltyUnits,weight:gapWeight,enabled:!!gapRule.on,penalty:gapWeight*penaltyUnits,multiShiftDays:multiShiftDays};
  const activeLecturers=S.lecs.filter(l=>loadOf(l.id,null)>0);
  const dayParts=activeLecturers.map(l=>{
    let morning=0,evening=0;
    asg.filter(x=>x.a.l===l.id).forEach(x=>rangeFor(x.e)[0]>=7?evening++:morning++);
    return{morning:morning,evening:evening};
  });
  const eveningCounts=dayParts.map(x=>x.evening),eveningMean=eveningCounts.length?eveningCounts.reduce((a,b)=>a+b,0)/eveningCounts.length:0;
  r.S2={ok:dayParts.filter(x=>x.morning>0&&x.evening>0&&Math.abs(x.evening-eveningMean)<=1).length,total:dayParts.length};
  r.S4={ok:Math.max(0,asg.length-gapEvents),total:asg.length};
  const theoryKinds=new Set(['LT','LY_THUYET','TRAC_NGHIEM','TRẮC NGHIỆM','LÝ THUYẾT']);
  const kindCounts=activeLecturers.map(l=>{
    const own=asg.filter(x=>x.a.l===l.id);
    const theory=own.filter(x=>theoryKinds.has(String(x.e.kind||'').trim().toUpperCase())).length;
    return{theory:theory,essay:own.length-theory};
  });
  r.S5={ok:kindCounts.filter(x=>Math.abs(x.theory-x.essay)<=1).length,total:kindCounts.length};
  const blocks=new Set(S.exams.map(e=>e.date+'|'+e.half));
  const busyCounts={2:{total:0,ok:0},3:{total:0,ok:0}};let hardBusy=0;
  S.lecs.forEach(l=>(l.busy||[]).forEach(raw=>{
    const b=typeof raw==='string'?{key:raw,priority:3}:raw;
    if(blocks.has(b.key)){
      const priority=Number(b.priority),used=asg.some(x=>x.a.l===l.id&&x.e.date+'|'+x.e.half===b.key);
      if(priority===1)hardBusy++;
      if(busyCounts[priority]){busyCounts[priority].total++;if(!used)busyCounts[priority].ok++}
    }
  }));
  r.S6=busyCounts[2];r.S7=busyCounts[3];r.H6={ok:r.H6.ok,total:r.H6.total};r.busyHardTotal=hardBusy;
  const list=[];let sw=0,sp=0;
  HARD.forEach(h=>{const x=r[h.id]||{ok:0,total:0};const p=x.total?Math.round(x.ok/x.total*100):null;list.push({id:h.id,name:h.name,hard:true,pct:p,ok:x.ok,total:x.total});if(p!=null){sw+=10;sp+=10*p}});
  SOFT.forEach(s=>{if(!so[s.id]?.on)return;const x=r[s.id]||{ok:0,total:0};const p=s.id==='S1'?x.pct:(x.total?Math.round(x.ok/x.total*100):null);list.push({id:s.id,name:s.name,hard:false,pct:p,ok:x.ok,total:x.total});if(p!=null){sw+=so[s.id].w;sp+=so[s.id].w*p}});
  return{list:list,overall:asg.length&&sw?Math.round(sp/sw):null,assigned:asg.length,RB8:r.RB8,S1:r.S1,S3:r.S3};
}
function hardConstraintFailures(report=analyze()){
  return report.list.filter(item=>item.hard&&item.pct!==null&&item.pct<100);
}
function precheck(){
  const out=[];const add=(lv,t)=>out.push({lv:lv,t:t});
  const missingLecturerAssignments=S.exams.reduce((n,e)=>n+e.asg.filter(a=>!lec(a.l)).length,0);
  if(missingLecturerAssignments)add('bad',missingLecturerAssignments+' phân công đang trỏ tới giảng viên không còn trong danh sách hiện tại. Hãy gỡ các phân công đó rồi xếp lại.');
  const lecturers=S.lecs.filter(inDot);
  if(!lecturers.length)add('bad','Chưa có giảng viên nào được chọn tham gia đợt thi. Hãy chọn giảng viên ở mục 2.');else add('ok','Có '+lecturers.length+' giảng viên được chọn tham gia đợt thi.');
  if(!S.exams.length)add('bad','Chưa có ca thi nào. Hãy import lịch thi ở mục 3.');else add('ok','Có '+S.exams.length+' ca thi cần xếp.');
  if(lecturers.length&&S.exams.length){
    const need=S.exams.reduce((n,e)=>n+e.need,0),T=tg(),act=lecturers.filter(l=>l.pct>0);
    if(!act.length)add('bad','Chưa có giảng viên nào có định mức lớn hơn 0%.');
    else add('ok','Chia '+need+' lượt gác cho '+act.length+' giảng viên đúng tuyệt đối theo định mức đã lưu.');
    const zero=lecturers.filter(l=>l.pct===0);
    if(zero.length)add('warn',zero.length+' giảng viên có định mức 0% nên sẽ không được xếp: '+zero.slice(0,4).map(l=>l.name).join(', ')+(zero.length>4?'...':'')+'.');
    const slots=new Set(S.exams.map(e=>e.date+'|'+e.ses)).size,over=act.filter(l=>T[l.id]>slots);
    if(over.length)add('bad',over.length+' giảng viên được chia nhiều ca hơn số khung giờ thi ('+slots+'), không thể xếp mà không trùng giờ.');
    const tight=S.exams.filter(e=>act.filter(l=>!isTeach(l,e)).length<e.need);
    if(tight.length)add('bad',tight.length+' ca thi không đủ giảng viên rảnh lịch dạy (ví dụ '+tight[0].code+' ngày '+fmtD(tight[0].date)+'). Kiểm tra lại lịch dạy.');
    const locked=S.exams.reduce((n,e)=>n+e.asg.filter(a=>a.lock).length,0);
    if(locked)add('info','Có '+locked+' phân công đã khóa, thuật toán sẽ giữ nguyên các phân công này.');
    const lv=S.exams.reduce((n,e)=>n+e.asg.filter(a=>a.lock&&hardIssues(e,a.l).length).length,0);
    if(lv)add('warn',lv+' phân công đã khóa đang vi phạm ràng buộc cứng.');
    add('info',SOFT.filter(s=>S.soft[s.id].on).length+' ràng buộc mềm đang bật, cả '+HARD.length+' ràng buộc cứng luôn được áp dụng.');
  }
  return out;
}
