// 小工具
const $  = (s,el=document)=>el.querySelector(s);

// 顯示版本
document.addEventListener('DOMContentLoaded', ()=>{
  const vb = $('#verBadge');
  if (vb) vb.textContent = `版本 ${window.APP_VERSION || '-'}`;
});

/** 統一呼叫後端（把 action 跟 payload 丟給 GAS） */
async function api(action, payload={}){
  const res = await fetch(window.BACKEND_URL, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ action, payload })
  });
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

/** 你原本用的兩個工具（若你的頁面已有就保留原本的） */
async function getFreshPosition(desiredAcc=60, timeoutMs=15000){
  return new Promise((resolve, reject)=>{
    if (!navigator.geolocation) { reject(new Error('此裝置不支援定位')); return; }
    let done=false;
    const finish=(pos,err)=>{
      if(done) return; done=true;
      try{ navigator.geolocation.clearWatch(wid); }catch(_){}
      clearTimeout(timer);
      pos ? resolve(pos) : reject(err||new Error('定位失敗'));
    };
    const wid = navigator.geolocation.watchPosition(
      (pos)=>{
        const acc=(pos.coords && pos.coords.accuracy)||Infinity;
        const fresh = Date.now() - (pos.timestamp || Date.now()) < 60000;
        if(fresh && acc <= desiredAcc) finish(pos);
      },
      (err)=>{},
      { enableHighAccuracy:true, maximumAge:0, timeout:timeoutMs }
    );
    const timer=setTimeout(()=>{
      navigator.geolocation.getCurrentPosition(
        (pos)=>finish(pos),
        (err)=>finish(null,err),
        { enableHighAccuracy:true, maximumAge:0, timeout:8000 }
      );
    }, timeoutMs);
  });
}

function setFreeze(on, msg){
  // 這裡用你原本的凍結遮罩函式即可。暫時給個簡單版：
  document.documentElement.style.cursor = on ? 'wait' : '';
}

/** === 將原本 google.script.run 呼叫換成 api() ===
 * 下面示範三個你一定會用到的：打卡、刷新今日摘要、請假送出。
 * 其他（出差、補卡、審核）用同樣方式改：api('<你的 action>', payload)
 */

// 打卡
async function punchNow(type){
  const uid  = $('#uid')?.value.trim();
  const pass = $('#pass')?.value.trim();
  if(!uid || !pass){ alert('請先輸入 UID 與 PASSCODE'); return; }

  setFreeze(true, '定位中…');
  try{
    const pos = await getFreshPosition(60,15000);
    setFreeze(true, '送出打卡…');
    const { latitude, longitude, accuracy } = pos.coords || {};
    const payload = {
      uid, passcode: pass, type,
      lat: Number(latitude).toFixed(6),
      lng: Number(longitude).toFixed(6),
      note: '', userAgent: navigator.userAgent,
      geo_at_iso: new Date().toISOString(),
      accuracy: Math.round(accuracy||0)
    };
    const ret = await api('saveEvent', payload);
    if(!ret || !ret.ok){
      alert('打卡失敗：' + (ret && ret.message || '未知錯誤'));
      return;
    }
    // 你原本更新畫面的方法照用
    // renderSummary(...)
    // renderTodayList(...)
    alert('打卡成功');
  }catch(err){
    let msg='無法取得即時定位。';
    if (err && err.code===1) msg += '\n（請允許此網站的定位權限）';
    else if (err && err.code===3) msg += '\n（等待逾時，請移至空曠處重試）';
    alert(msg);
  }finally{
    setFreeze(false);
  }
}

// 今日摘要（把你原本的 refreshSummaryAndList 改為如下）
async function refreshSummaryAndList(){
  const uid=$('#uid')?.value.trim(), pass=$('#pass')?.value.trim();
  if(!uid || !pass){ /* 清空畫面 */ return; }
  try{
    const ret = await api('getTodaySummaryAndListSecure', { uid, passcode: pass });
    // renderSummary(ret.summary)
    // renderTodayList(ret.list)
  }catch(e){
    console.error(e);
  }
}

// 請假送出（你原本的 saveLeave 前端呼叫改成這樣）
async function submitLeave(form){
  const p = {
    uid: form.uid, passcode: form.pass,
    type: form.type,
    start_date: form.start,
    end_date: form.end || form.start,
    part: form.full ? 'FULL' : '',
    mode: form.full ? 'full' : 'hours',
    hours: form.full ? '' : form.hours,
    note : form.note || ''
  };
  const ret = await api('saveLeave', p);
  if(!ret || !ret.ok){
    alert('請假申請失敗：' + (ret && ret.message || '未知錯誤'));
    return;
  }
  alert('請假已送出（待審）');
}
