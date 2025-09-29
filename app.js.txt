/* ====== 版本號：只改這裡就會更新頁面徽章 ====== */
const APP_VERSION = "2025-09-29";

/* ====== PWA Service Worker 註冊 ====== */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(console.error);
}

/* ====== 小工具 ====== */
const $  = (s,el=document)=>el.querySelector(s);
const $$ = (s,el=document)=>Array.from(el.querySelectorAll(s));

/* 版本徽章與時鐘 */
document.addEventListener('DOMContentLoaded', ()=>{
  const vb = $('#verBadge'); if(vb) vb.textContent = `v${APP_VERSION}`;
  tick(); setInterval(tick, 1000);
  bind();
  refreshSummaryAndList();
});

function tick(){
  const el = $('#clock'); if(!el) return;
  const d = new Date(), p=n=>String(n).padStart(2,'0');
  el.textContent = `🕓 現在時間：${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/* ====== 凍結遮罩 ====== */
let __freezeTimer=null, __punching=false;
function setFreeze(on,msg){
  const mask = $('#freeze-mask');
  if (msg) mask.querySelector('.box').textContent = msg;
  const inter = document.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
  if(on){
    mask.style.display='flex';
    document.body.classList.add('is-freeze');
    inter.forEach(el=>{ if(!el.dataset._prevDisabled) el.dataset._prevDisabled = el.disabled?'1':''; el.disabled=true; });
    document.documentElement.style.cursor='wait';
    clearTimeout(__freezeTimer);
    __freezeTimer = setTimeout(()=>{ __punching=false; setFreeze(false); alert('等候定位/打卡逾時，請稍後重試。'); },30000);
  }else{
    clearTimeout(__freezeTimer);
    mask.style.display='none';
    document.body.classList.remove('is-freeze');
    inter.forEach(el=>{ if(el.dataset._prevDisabled==='') el.disabled=false; delete el.dataset._prevDisabled; });
    document.documentElement.style.cursor='';
  }
}

/* ====== 打卡定位 ====== */
function ensureGeoReadyOrExplain(){
  if (!('geolocation' in navigator)) { alert('此裝置/瀏覽器不支援定位，請改用手機或支援定位的瀏覽器。'); return false; }
  if (!window.isSecureContext) { alert('此頁面不是 HTTPS，瀏覽器會封鎖定位。\n請用 https:// 開頭的網址開啟（部署網址），不要用本機或非安全連結。'); return false; }
  if (window.top !== window.self) alert('此頁面目前被嵌在 iframe，若外層未加 allow="geolocation" 會被封鎖。');
  return true;
}
function getFreshPosition(desiredAcc=60, timeoutMs=15000){
  return new Promise((resolve,reject)=>{
    if (!navigator.geolocation){ reject(new Error('此裝置不支援定位')); return; }
    let done=false;
    const finish=(pos,err)=>{ if(done) return; done=true; try{navigator.geolocation.clearWatch(wid);}catch(_){ } clearTimeout(timer); pos?resolve(pos):reject(err||new Error('定位失敗')); };
    const wid=navigator.geolocation.watchPosition(
      (pos)=>{
        const acc=(pos.coords&&pos.coords.accuracy)||Infinity;
        const fresh= Date.now()-(pos.timestamp||Date.now())<60000;
        if(fresh && acc<=desiredAcc) finish(pos);
      }, (err)=>{}, { enableHighAccuracy:true, maximumAge:0, timeout:timeoutMs }
    );
    const timer=setTimeout(()=>{
      navigator.geolocation.getCurrentPosition(
        (pos)=>finish(pos), (err)=>finish(null,err),
        { enableHighAccuracy:true, maximumAge:0, timeout:8000 }
      );
    }, timeoutMs);
  });
}

/* ====== 打卡流程（假裝呼叫後端） ====== */
async function punchNow(type){
  if(__punching) return;
  const uid=$('#uid')?.value.trim(), pass=$('#pass')?.value.trim();
  if(!uid || !pass){ alert('請先輸入 UID 與 PASSCODE'); return; }
  __punching=true; setFreeze(true,'正在取得定位…');
  try{
    const pos = await getFreshPosition(60,15000);
    setFreeze(true,'正在送出打卡…');
    // ★ 這裡原本是 google.script.run.saveEvent(payload)；
    //   在純前端/PWA 版先模擬成功回應：
    const ret = { ok:true, verdict: Math.random()<0.2 ? 'offsite' : 'ok' };
    if(!ret.ok) throw new Error('打卡失敗');
    const resp=$('#resp');
    if(resp){
      const off=String(ret.verdict||'')==='offsite';
      resp.innerHTML = `<span class="badge" style="background:${off?'#FEF3C7':'#dcfce7'};color:${off?'#92400E':'#166534'}">已${type==='in'?'上班':'下班'} · ${off?'站外⚠':'正常'}</span>`;
    }
    refreshSummaryAndList();
  }catch(err){
    let msg='無法取得即時定位。'; if(err && err.code===1) msg+='\n（請允許此網站的定位權限）';
    alert(msg);
  }finally{
    __punching=false; setFreeze(false);
  }
}

/* ====== 今日摘要/清單（先用假資料） ====== */
let SHOW_ALL=false, ALL_LIST=[];
function renderSummary(sum){
  const i=$('#sumIn'), o=$('#sumOut'), a=$('#sumAno'), b=$('#sumBadge');
  const inStr=sum?.in||''; const outStr=sum?.out||''; const anomalies=sum?.anomalies||[];
  if(i) i.innerHTML=`<span class="type-pill in">上班</span>&nbsp;<span class="muted">${inStr||'—'}</span>`;
  if(o) o.innerHTML=`<span class="type-pill out">下班</span>&nbsp;<span class="muted">${outStr||'—'}</span>`;
  if(a) a.textContent=(anomalies.length?`異常：${anomalies.join('、')}`:'');
  if(b) b.style.display=(anomalies.length?'':'none');
}
function renderTodayList(list){
  const box=$('#todayList'); if(!box) return; box.innerHTML='';
  (list||[]).forEach(it=>{
    const row=document.createElement('div'); row.className='recentItem';
    row.innerHTML=`<div class="badge">${(it.datetime||'').slice(11,16)||'--:--'}</div>
                   <div class="type-pill ${/in/i.test(it.type)?'in':'out'}">${/in/i.test(it.type)?'上班':'下班'}</div>
                   <div class="muted">${it.site_id||''}</div>
                   <div class="muted">${typeof it.distance_m==='number'? (it.distance_m+'m'):''}</div>`;
    box.appendChild(row);
  });
}
function refreshSummaryAndList(){
  // 假資料：實際上你會用 google.script.run.getTodaySummaryAndListSecure(uid, pass)
  const now=new Date(), hm= n=>String(n).padStart(2,'0');
  const inHm = `${hm(now.getHours()-9)}:${hm(now.getMinutes())}`;
  const outHm= `${hm(now.getHours())}:${hm(now.getMinutes())}`;
  renderSummary({ in:inHm, out:outHm, anomalies: Math.random()<0.3? ['站外'] : [] });
  ALL_LIST = [
    { type:'in',  datetime: new Date().toISOString(), site_id:'A', distance_m: 12 },
    { type:'out', datetime: new Date().toISOString(), site_id:'A', distance_m: 18 },
    { type:'in',  datetime: new Date().toISOString(), site_id:'B', distance_m: 36 },
  ];
  $('#limitLabel').textContent = SHOW_ALL ? ALL_LIST.length : 3;
  renderTodayList(SHOW_ALL ? ALL_LIST : ALL_LIST.slice(0,3));
}

/* ====== 綁定 ====== */
function bind(){
  $('#btn-in') ?.addEventListener('click', ()=>{ if(!ensureGeoReadyOrExplain()) return; punchNow('in'); });
  $('#btn-out')?.addEventListener('click', ()=>{ if(!ensureGeoReadyOrExplain()) return; punchNow('out'); });
  $('#btnMore')?.addEventListener('click', ()=>{ SHOW_ALL=!SHOW_ALL; $('#limitLabel').textContent=SHOW_ALL?ALL_LIST.length:3; renderTodayList(SHOW_ALL?ALL_LIST:ALL_LIST.slice(0,3)); });
  $('#btn-calendar')?.addEventListener('click', ()=>{ window.open('https://docs.google.com/spreadsheets/d/你的ID/edit#gid=月曆工作表GID','_blank'); });
  $('#btn-help')?.addEventListener('click', ()=>{ alert('快速上手：\n1. 先取得 UID 與 PASSCODE\n2. 打卡會自動取得定位\n3. 出差/補卡/請假請用右側工具'); });
}
