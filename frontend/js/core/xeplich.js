/* ========= Lõi xếp lịch ========= */
function targets(){
  const tot=S.exams.reduce((n,e)=>n+e.need,0),act=S.lecs.filter(l=>l.pct>0),pUnits=new Map(act.map(l=>[String(l.id),Math.round(Number(l.pct)*100)])),sp=act.reduce((n,l)=>n+pUnits.get(String(l.id)),0),t={};
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
const tg=targets;
async function persistAssignments(){
  const maDot=S.exams.find(e=>e.ma_dot)?.ma_dot||window.__MA_DOT;
  if(!maDot)throw new Error('Không xác định được đợt thi để lưu phân công.');
  const assignments=S.exams.flatMap(e=>e.asg.map(a=>({ma_ca:e.ma_ca,ma_gv:String(a.l)})));
  return API.saveAssignments(maDot,assignments);
}
function syncQuota(){if(!S.exams.length)return;const T=targets();S.lecs.forEach(l=>l.quota=T[l.id]??0)}
function loadOf(lid,except){let n=0;S.exams.forEach(e=>{if(e.id!==except)n+=e.asg.filter(a=>a.l===lid).length});return n}
function rangeFor(e){if(e.period){const m=String(e.period).match(/(\d+)\s*[→>-]\s*(\d+)/);if(m)return[+m[1],+m[2]]}return({1:[1,2],2:[3,4],3:[7,8],4:[9,10]})[e.ses]||[0,0]}
function overlaps(a,b){const x=rangeFor(a),y=rangeFor(b);return x[0]<=y[1]&&y[0]<=x[1]}
function dupSlot(ex,lid){return S.exams.some(e=>e.id!==ex.id&&e.date===ex.date&&overlaps(e,ex)&&e.asg.some(a=>a.l===lid))}
function mixKind(ex,lid){return S.exams.some(e=>e.id!==ex.id&&e.date===ex.date&&e.half===ex.half&&e.kind!==ex.kind&&e.asg.some(a=>a.l===lid))}
function busyInfo(l,e){
  const r=rangeFor(e),day=e.date;
  const arr=l.busy||[];
  return arr.map(b=>typeof b==='string'?{key:b,priority:3,reason:null}:b).find(b=>{
    if(!b||!String(b.key||'').startsWith(day+'|'))return false;
    const block=String(b.key).split('|')[1],br=block==='S'?[1,6]:[7,12];
    return r[0]<=br[1]&&br[0]<=r[1];
  })||null;
}
function busyHard(l,e){const b=busyInfo(l,e);return !!b&&Number(b.priority)===1}
function busyPenalty(l,e){const b=busyInfo(l,e);if(!b)return 0;const p=Number(b.priority);if(p===1)return 10000000;if(!S.soft.S2.on)return 0;return p===2?6:p===3?2:2}
function isTeach(l,e){const r=rangeFor(e);return(l.teach||[]).some(t=>{const p=String(t).split('|'),d=p[0],v=p[1]||'';if(d!==e.date)return false;const m=v.match(/^(\d+)\s*[→>-]\s*(\d+)$/);if(m)return r[0]<=+m[2]&&+m[1]<=r[1];const c=+v,cr=({1:[1,2],2:[3,4],3:[7,8],4:[9,10]})[c];return!!cr&&r[0]<=cr[1]&&cr[0]<=r[1]})}
function hardIssues(ex,lid){
  const l=lec(lid),out=[];if(!l)return out;
  if(dupSlot(ex,lid))out.push('Trùng ca');
  if(isTeach(l,ex))out.push('Có lịch dạy');
  if(busyHard(l,ex))out.push('Bận mức 1 - phải né');
  if(mixKind(ex,lid))out.push('Khác loại ca trong buổi');
  const q=tg()[lid]||0,max=q>0?q+1:0;
  if(loadOf(lid,ex.id)+1>max)out.push(q>0?'Vượt định mức cho phép':'Định mức 0 ca');
  return out;
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
  const payload={
    lecturers:S.lecs,
    exams:S.exams.map(e=>({...e,asg:e.asg.map(a=>({...a,lock:!!a.lock&&!invalidLocks.has(String(e.id)+'|'+String(a.l))}))})),
    soft:S.soft,
    time_limit_seconds:30
  };
  try{
    toast('Đang xếp lịch bằng Google OR-Tools CP-SAT...');
    const result=await API.solveSchedule(payload);
    if(!['OPTIMAL','FEASIBLE'].includes(result.status)){
      toast(result.message||'CP-SAT không tìm được lịch phù hợp.');
      return;
    }
    S.exams.forEach(e=>{e.asg=[]});
    result.assignments.forEach(a=>{
      const e=S.exams.find(x=>String(x.id)===String(a.exam_id));
      if(e)e.asg.push({l:a.lecturer_id,lock:!!a.locked});
    });
    snapshot('Google OR-Tools CP-SAT');
    pre=null;save();render();
    const report=analyze();
    const gap=report.S1;
    const elapsed=Number(result.wall_time_seconds||0).toFixed(2);
    let saved='';
    try{await persistAssignments();saved=' Đã lưu phân công lên SQL Server để trang giảng viên xem được.'}
    catch(e){saved=' Lịch hiện mới nằm trên trình duyệt này, chưa lưu được vào SQL Server: '+(e.message||e)}
    toast((result.status==='OPTIMAL'?'Đã tìm được nghiệm tối ưu. ':'Đã tìm được nghiệm khả thi. ')+
      (invalidLocks.size?'Đã mở khóa '+invalidLocks.size+' phân công vi phạm ràng buộc để xếp lại. ':'')+
      'CP-SAT chạy '+elapsed+' giây; '+report.assigned+' lượt phân công; điểm đánh giá '+(report.overall==null?'—':report.overall+'%')+'. '+
      'Tổng lượt ngày giảng viên lên trường: '+gap.total+'.'+saved);
  }catch(e){
    toast('Không gọi được thuật toán CP-SAT: '+(e.message||e));
  }
}

function analyze(){
  const asg=[];S.exams.forEach(e=>e.asg.forEach(a=>asg.push({e:e,a:a})));
  const r={},so=S.soft,T=tg(),cnt=f=>asg.filter(f).length;
  const ls=S.lecs.filter(l=>T[l.id]>0||loadOf(l.id,null)>0);
  r.H1={ok:ls.filter(l=>{const q=T[l.id]||0,n=loadOf(l.id,null);return q>0?n>=Math.max(0,q-1)&&n<=q+1:n===0}).length,total:ls.length};
  r.H2={ok:S.exams.filter(e=>e.asg.length>=e.need).length,total:S.exams.length};
  r.H3={ok:asg.length-cnt(x=>dupSlot(x.e,x.a.l)),total:asg.length};
  r.H4={ok:asg.length-cnt(x=>{const l=lec(x.a.l);return l&&isTeach(l,x.e)}),total:asg.length};
  r.H5={ok:asg.length-cnt(x=>mixKind(x.e,x.a.l)),total:asg.length};
  r.H6={ok:asg.length-cnt(x=>busyHard(lec(x.a.l),x.e)),total:asg.length};
  const byLecturerDay={};asg.forEach(x=>{const k=x.a.l+'|'+x.e.date;(byLecturerDay[k]=byLecturerDay[k]||[]).push(x.e)});
  let fragmentedDays=0,gapEvents=0,idlePeriods=0,sessionBreaks=0,penaltyUnits=0,multiShiftDays=0;
  Object.values(byLecturerDay).forEach(shifts=>{
    const ordered=shifts.slice().sort((a,b)=>rangeFor(a)[0]-rangeFor(b)[0]||rangeFor(a)[1]-rangeFor(b)[1]);
    if(ordered.length>1)multiShiftDays++;
    let fragmented=false;
    for(let i=1;i<ordered.length;i++){
      const prev=ordered[i-1],cur=ordered[i],p=rangeFor(prev),c=rangeFor(cur);
      if(p[1]>=c[0])continue;
      const emptyPeriods=Math.max(0,c[0]-p[1]-1),crossesSession=(p[0]<=6?1:2)!==(c[0]<=6?1:2);
      const gapSize=Math.max(emptyPeriods,crossesSession?1:0);
      if(!gapSize)continue;
      fragmented=true;gapEvents++;idlePeriods+=emptyPeriods;penaltyUnits+=gapSize;
      if(crossesSession)sessionBreaks++;
    }
    if(fragmented)fragmentedDays++;
  });
  const dayCount=Object.keys(byLecturerDay).length,s1=so.S1||{},gapWeight=Math.max(0,Number(s1.w)||0);
  r.S1={ok:dayCount-fragmentedDays,total:dayCount,fragmentedDays:fragmentedDays,gapEvents:gapEvents,idlePeriods:idlePeriods,sessionBreaks:sessionBreaks,penaltyUnits:penaltyUnits,weight:gapWeight,enabled:!!s1.on,penalty:s1.on?gapWeight*penaltyUnits:0,multiShiftDays:multiShiftDays};
  const blocks=new Set(S.exams.map(e=>e.date+'|'+e.half));
  let bt=0,bo=0,hardBusy=0;
  S.lecs.forEach(l=>(l.busy||[]).forEach(raw=>{
    const b=typeof raw==='string'?{key:raw,priority:3}:raw;
    if(blocks.has(b.key)){bt++;const used=asg.some(x=>x.a.l===l.id&&x.e.date+'|'+x.e.half===b.key);if(!used)bo++;if(Number(b.priority)===1)hardBusy++}
  }));
  r.S2={ok:bo,total:bt};r.H6={ok:r.H6.ok,total:r.H6.total};r.busyHardTotal=hardBusy;
  const list=[];let sw=0,sp=0;
  HARD.forEach(h=>{const x=r[h.id];const p=x.total?Math.round(x.ok/x.total*100):null;list.push({id:h.id,name:h.name,hard:true,pct:p,ok:x.ok,total:x.total});if(p!=null){sw+=10;sp+=10*p}});
  SOFT.forEach(s=>{if(!so[s.id].on)return;const x=r[s.id];const p=x.total?Math.round(x.ok/x.total*100):null;list.push({id:s.id,name:s.id==='S2'?s.name+' (mục tiêu '+so.S2.n+'%)':s.name,hard:false,pct:p,ok:x.ok,total:x.total});if(p!=null){sw+=so[s.id].w;sp+=so[s.id].w*p}});
  return{list:list,overall:asg.length&&sw?Math.round(sp/sw):null,assigned:asg.length,S1:r.S1};
}
function precheck(){
  const out=[];const add=(lv,t)=>out.push({lv:lv,t:t});
  if(!S.lecs.length)add('bad','Chưa có giảng viên nào. Hãy thêm hoặc import ở mục 2.');else add('ok','Có '+S.lecs.length+' giảng viên trong danh sách.');
  if(!S.exams.length)add('bad','Chưa có ca thi nào. Hãy import lịch thi ở mục 3.');else add('ok','Có '+S.exams.length+' ca thi cần xếp.');
  if(S.lecs.length&&S.exams.length){
    const need=S.exams.reduce((n,e)=>n+e.need,0),T=tg(),act=S.lecs.filter(l=>l.pct>0);
    if(!act.length)add('bad','Chưa có giảng viên nào có định mức lớn hơn 0%.');
    else add('ok','Chia '+need+' lượt gác cho '+act.length+' giảng viên theo phần trăm định mức; mỗi người được lệch tối đa 1 ca.');
    const zero=S.lecs.filter(l=>l.pct===0);
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

