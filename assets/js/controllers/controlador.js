/* ══ HELPERS ══ */
function nowFmt(){const n=new Date();return dateFmt(n)+' '+timeFmt(n)}
function dateFmt(d=new Date()){return d.toLocaleDateString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric'})}
function timeFmt(d=new Date()){return d.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
function ini(n){if(!n)return'??';return n.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase()}
function col(id){return COLORS[((id||1)-1)%COLORS.length]}
function $id(id){return document.getElementById(id)}
function toast(msg,type=''){const tw=$id('toast-wrap'),d=document.createElement('div');d.className='toast '+(type||'');d.textContent=msg;tw.appendChild(d);setTimeout(()=>d.remove(),3800)}
function openModal(id){$id(id).classList.add('open')}
function closeModal(id){$id(id).classList.remove('open')}
function closeOvClick(e,id){if(e.target===$id(id))closeModal(id)}
function setStatus(msg,type='ok'){$id('sys-pill').className='sys-pill '+type;$id('sys-txt').textContent=msg}
function setStatusTxt(msg){$id('sys-status-txt').textContent=msg}
function openLightbox(src){if(!src)return;$id('lightbox-img').src=src;$id('lightbox').classList.add('open')}
function closeLightbox(){$id('lightbox').classList.remove('open')}

/* ── Image auto-enhance canvas (applies at capture time for photos) ── */
function enhanceCanvas(canvas){
  if(!cfg.autoEnhance) return canvas;
  const ctx=canvas.getContext('2d');
  const imgData=ctx.getImageData(0,0,canvas.width,canvas.height);
  const data=imgData.data;
  const b=(cfg.brightness||110)/100;
  const c=((cfg.contrast||120)/100-1)*128;
  for(let i=0;i<data.length;i+=4){
    for(let k=0;k<3;k++){
      let v=data[i+k]*b;
      v=v+c;
      data[i+k]=Math.max(0,Math.min(255,v));
    }
  }
  ctx.putImageData(imgData,0,0);
  return canvas;
}

function captureHQ(video,w=800,h=600){
  if(!video||!video.videoWidth) return null;
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const ctx=c.getContext('2d');
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(video,0,0,w,h);
  enhanceCanvas(c);
  return c.toDataURL('image/jpeg',0.90);
}

/* ══ THEME ══ */
function toggleTheme(){
  const isDark=document.documentElement.getAttribute('data-theme')==='dark';
  const nt=isDark?'light':'dark';
  document.documentElement.setAttribute('data-theme',nt);
  cfg.theme=nt;$id('theme-btn').textContent=nt==='dark'?'🌙':'☀️';
  if($id('cfg-theme-btn')) $id('cfg-theme-btn').textContent=nt==='dark'?'🌙 Cambiar a claro':'☀️ Cambiar a oscuro';
  saveConfigDB();
}

/* ══ AUTH ══ */
let loggedIn=false;
function doLogin(){
  const pass=$id('login-pass').value;
  if(pass===cfg.adminPass){loggedIn=true;$id('login-screen').style.display='none';$id('main-shell').style.display='flex';toast('Bienvenido, Administrador','ok')}
  else{$id('login-err').classList.add('show');$id('login-pass').value='';setTimeout(()=>$id('login-err').classList.remove('show'),3000)}
}
function doLogout(){if(!confirm('¿Cerrar sesión?'))return;loggedIn=false;$id('main-shell').style.display='none';$id('login-screen').style.display='flex';$id('login-pass').value='';stopAllCams();stopAlarm()}
function changePassword(){
  const curr=$id('cfg-currpass').value;
  if(curr!==cfg.adminPass){toast('Contraseña actual incorrecta','err');return}
  const np=$id('cfg-newpass').value,np2=$id('cfg-newpass2').value;
  if(np.length<4){toast('Mínimo 4 caracteres','err');return}
  if(np!==np2){toast('Las contraseñas no coinciden','err');return}
  cfg.adminPass=np;saveConfigDB();
  $id('cfg-currpass').value='';$id('cfg-newpass').value='';$id('cfg-newpass2').value='';
  toast('Contraseña actualizada ✓','ok');
}

/* ══ ALARM — audio + voz continua ══ */
function startAlarm(who=''){
  if(alarmActive) return;
  alarmActive=true;
  $id('alarm-overlay').classList.add('active');
  $id('alarm-badge').classList.add('active');
  const isUnknown=!who||who==='Desconocido';
  $id('alarm-who').textContent=isUnknown?'Persona desconocida — Llamando a la policía':('Detectado fuera de horario: '+who);
  $id('btn-alarm-stop').style.display='inline-flex';
  // Show stop button in alertas page too
  const ab=$id('btn-stop-alarm-alerts');if(ab) ab.style.display='inline-flex';

  // Start voice loop
  startVoiceAlarm(who,isUnknown);

  // Audio siren — louder, more alarming
  try{
    alarmCtx=new(window.AudioContext||window.webkitAudioContext)();
    let elapsed=0;
    function sirenCycle(){
      if(!alarmActive)return;
      if(elapsed>=60){stopAlarm();return}
      elapsed+=0.7;
      const osc=alarmCtx.createOscillator();const osc2=alarmCtx.createOscillator();
      const gain=alarmCtx.createGain();
      osc.connect(gain);osc2.connect(gain);gain.connect(alarmCtx.destination);
      gain.gain.value=0.35;
      const now=alarmCtx.currentTime;
      osc.type='square';osc2.type='sawtooth';
      osc.frequency.setValueAtTime(880,now);
      osc.frequency.linearRampToValueAtTime(1760,now+0.3);
      osc.frequency.linearRampToValueAtTime(880,now+0.6);
      osc2.frequency.setValueAtTime(440,now);
      osc2.frequency.linearRampToValueAtTime(880,now+0.3);
      osc2.frequency.linearRampToValueAtTime(440,now+0.6);
      osc.start(now);osc.stop(now+0.7);
      osc2.start(now);osc2.stop(now+0.7);
      alarmOscList.push(osc,osc2);
      alarmTimer=setTimeout(sirenCycle,650);
    }
    sirenCycle();
  }catch(e){console.warn('Audio:',e)}
}

function startVoiceAlarm(who,isUnknown){
  if(!window.speechSynthesis) return;
  speechSynthesis.cancel();
  const sayMsg=()=>{
    if(!alarmActive) return;
    const utt=new SpeechSynthesisUtterance();
    utt.lang='es-PE';utt.rate=0.9;utt.pitch=1.1;utt.volume=1;
    if(isUnknown){
      utt.text='Alerta máxima de seguridad. Persona desconocida detectada fuera del horario autorizado. Llamando a la policía.';
    } else {
      utt.text=`Atención. ${who} detectado fuera del horario autorizado. Se requiere intervención inmediata.`;
    }
    utt.onend=()=>{if(alarmActive) voiceTimer=setTimeout(sayMsg,3000)};
    speechSynthesis.speak(utt);
  };
  sayMsg();
}

function stopAlarm(){
  alarmActive=false;
  $id('alarm-overlay').classList.remove('active');
  $id('alarm-badge').classList.remove('active');
  $id('btn-alarm-stop').style.display='none';
  const ab=$id('btn-stop-alarm-alerts');if(ab) ab.style.display='none';
  if(alarmTimer){clearTimeout(alarmTimer);alarmTimer=null}
  if(voiceTimer){clearTimeout(voiceTimer);voiceTimer=null}
  try{alarmOscList.forEach(o=>{try{o.stop()}catch(e){}});alarmOscList=[]}catch(e){}
  try{if(alarmCtx){alarmCtx.close();alarmCtx=null}}catch(e){}
  if(window.speechSynthesis) speechSynthesis.cancel();
}

/* ══ CONFIG ══ */
async function loadConfig(){const saved=await dbGet('config','main');if(saved) cfg={...cfg,...saved.value}}
async function saveConfigDB(){await dbPut('config',{id:'main',value:cfg})}

/* ══ HORARIO ══ */
function toMin(t){const[h,m]=(t||'00:00').split(':').map(Number);return h*60+m}
function getMode(){const n=new Date();const hm=n.getHours()*60+n.getMinutes();if(hm>=toMin(cfg.ein)&&hm<=toMin(cfg.efin))return 'entrada';if(hm>=toMin(cfg.sin)&&hm<=toMin(cfg.sfin))return 'salida';return 'ninguno'}
function isInAlarmRange(){const n=new Date();const hm=n.getHours()*60+n.getMinutes();return hm>=toMin(cfg.alarmStart)&&hm<=toMin(cfg.alarmEnd)}
function updateHorarioUI(){
  const mode=getMode();const b=$id('horario-badge');if(!b) return;
  const map={entrada:{cls:'hp-e',txt:'ENTRADA'},salida:{cls:'hp-s',txt:'SALIDA'},ninguno:{cls:'hp-n',txt:'Fuera de horario'}};
  const m=map[mode]||map.ninguno;
  b.className='horario-pill '+m.cls;b.innerHTML=`<span class="blink"></span>${m.txt}`;
  if($id('st-horario-val')) $id('st-horario-val').textContent=m.txt;
  return mode;
}

/* ══ NAVIGATION ══ */
const PAGES={dashboard:'Dashboard',cameras:'Cámaras en vivo',registros:'Registros',alertas:'Alertas',personal:'Personal',stats:'Estadísticas',config:'Configuración',reportes:'Reportes PDF'};
const SUBS={dashboard:'inicio',cameras:'live·facial-ia',registros:'logs/acceso',alertas:'seguridad',personal:'admin/personal',stats:'analíticas',config:'configuración',reportes:'pdf'};
function go(name){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  const pg=$id('page-'+name);if(pg) pg.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b=>{const title=(PAGES[name]||'').toLowerCase();if(title&&b.textContent.trim().toLowerCase().startsWith(title.split(' ')[0]))b.classList.add('active')});
  $id('tb-title').textContent=PAGES[name]||name;$id('tb-sub').textContent=SUBS[name]||name;
  if(name==='cameras'){renderCamPanel();buildCamsGrid()}
  if(name==='registros') renderRegistros();
  if(name==='alertas') renderAlertas();
  if(name==='personal') renderTable();
  if(name==='stats') renderStats();
  if(name==='config') loadConfigUI();
  if(name==='reportes') renderReportPreview();
}

/* ══ CLOCK ══ */
setInterval(()=>{$id('clock').textContent=timeFmt();updateHorarioUI()},1000);

/* ══ CAM FILTERS (with CSS filter including blur-based sharpening) ══ */
function getCamFilterCSS(isNV=false){
  if(isNV) return 'brightness(2.8) contrast(1.9) saturate(0) hue-rotate(100deg)';
  const b=(cfg.brightness||110)/100;
  const c=(cfg.contrast||120)/100;
  const s=(cfg.saturate||110)/100;
  const sh=(cfg.sharp||100);
  // Use contrast + saturate approximation for sharpness — actual unsharp mask not possible via CSS alone
  const sharpenExtra=sh>100?` contrast(${1+(sh-100)*0.003}) saturate(${1+(sh-100)*0.002})`:'';
  return `brightness(${b}) contrast(${c}) saturate(${s})${sharpenExtra}`;
}
function applyCamFilters(){
  if($id('cfg-brightness')) cfg.brightness=parseInt($id('cfg-brightness').value);
  if($id('cfg-contrast')) cfg.contrast=parseInt($id('cfg-contrast').value);
  if($id('cfg-saturate')) cfg.saturate=parseInt($id('cfg-saturate').value);
  if($id('cfg-sharp')) cfg.sharp=parseInt($id('cfg-sharp').value);
  document.querySelectorAll('.cam-wrap video').forEach(v=>{
    const wrap=v.closest('.cam-wrap');
    const isNV=wrap&&wrap.classList.contains('nv-active');
    v.style.filter=getCamFilterCSS(isNV);
  });
}
function updateCamLabel(key,val){const el=$id('lbl-'+key);if(el) el.textContent=val}

/* ══ CAMERA EFFECTS ══ */
function applyFx(i,fx){
  if(!camFx[i]) camFx[i]={};
  const vid=$id('cvid-'+i);const wrap=$id('cam-wrap-'+i);
  if(!vid||!wrap) return;
  // Toggle off if same fx
  if(camFx[i].current===fx){
    camFx[i].current=null;
    vid.style.filter=getCamFilterCSS();
    wrap.classList.remove('nv-active');
    const nb=$id('nv-badge-'+i);if(nb)nb.style.display='none';
    toast('Efecto desactivado');return;
  }
  camFx[i].current=fx;
  if(fx==='nightvision'){vid.style.filter=getCamFilterCSS(true);wrap.classList.add('nv-active');const nb=$id('nv-badge-'+i);if(nb)nb.style.display='block'}
  else if(fx==='thermal'){vid.style.filter='sepia(1) hue-rotate(300deg) saturate(2) brightness(1.3) contrast(1.4)';wrap.classList.remove('nv-active')}
  else if(fx==='highcontrast'){vid.style.filter='grayscale(1) contrast(2.5) brightness(1.2)';wrap.classList.remove('nv-active')}
  else if(fx==='enhance'){vid.style.filter=`brightness(${(cfg.brightness||110)/100}) contrast(${(cfg.contrast||120)/100}) saturate(${(cfg.saturate||110)/100})`;wrap.classList.remove('nv-active')}
  // Update fx buttons
  document.querySelectorAll(`#cam-fx-${i} .fx-btn`).forEach(b=>{
    b.classList.toggle('active',b.dataset.fx===fx);
  });
}

/* ══ NIGHT VISION AUTO ══ */
function checkNightVision(i){
  const vid=$id('cvid-'+i);const wrap=$id('cam-wrap-'+i);const nb=$id('nv-badge-'+i);
  if(!vid||!wrap||!cfg.nightVision) return;
  if(camFx[i]&&camFx[i].current) return; // manual fx active
  let activate=false;
  if(cfg.autoNV){
    try{
      const tc=document.createElement('canvas');tc.width=32;tc.height=24;
      const ctx=tc.getContext('2d');ctx.drawImage(vid,0,0,32,24);
      const data=ctx.getImageData(0,0,32,24).data;
      let lum=0;for(let k=0;k<data.length;k+=4) lum+=(0.299*data[k]+0.587*data[k+1]+0.114*data[k+2]);
      lum/=(data.length/4);activate=lum<75;
    }catch(e){}
  }
  if(!isInAlarmRange()) activate=true;
  if(activate){wrap.classList.add('nv-active');if(vid) vid.style.filter=getCamFilterCSS(true);if(nb) nb.style.display='block'}
  else{wrap.classList.remove('nv-active');if(vid) vid.style.filter=getCamFilterCSS(false);if(nb) nb.style.display='none'}
}

/* ══ BADGES ══ */
function updateBadges(){
  $id('nb-emp').textContent=employees.filter(e=>e.activo).length;
  $id('nb-regs').textContent=records.length;
  $id('nb-alerts').textContent=alerts.length;
  $id('nb-cams').textContent=Object.keys(camStreams).length;
  $id('hk-emp').textContent=employees.filter(e=>e.activo).length;
  $id('hk-hoy').textContent=records.filter(r=>r.tipo==='entrada').length;
  const den=records.filter(r=>r.tipo==='denegado').length;
  $id('hk-neg').textContent=den;$id('hk-neg-d').textContent=den>5?'↑ revisar':'↓ normal';
  $id('hk-neg-d').className='delta '+(den>5?'dn':'up');
  $id('hk-alerts').textContent=alerts.length;
  if($id('st-emp-count')) $id('st-emp-count').textContent=employees.filter(e=>e.activo).length;
  if($id('st-with-face')) $id('st-with-face').textContent=employees.filter(e=>e.activo&&e.descriptors?.length>0).length;
  if($id('st-regs-hoy')) $id('st-regs-hoy').textContent=records.length;
}

/* ══ RENDERS ══ */
function renderDash(){
  updateBadges();
  const feed=$id('dash-feed');
  feed.innerHTML=records.slice(0,8).map(r=>{
    const isE=r.tipo==='entrada',isS=r.tipo==='salida';
    const lbl=isE?'Entrada':isS?'Salida':'Denegado';
    const clr=isE?'var(--green)':isS?'var(--blue)':'var(--red)';
    return `<div class="feed-item"><div class="feed-dot" style="background:${clr}"></div>
      <div style="flex:1"><div class="fi-name">${r.nombre}</div><div class="fi-sub">${lbl} · Cam ${r.camara}</div><div class="fi-time">${r.hora} · ${r.fecha}</div></div>
      ${r.foto?`<div class="fi-photo" style="cursor:pointer" onclick="openLightbox('${r.foto}')"><img src="${r.foto}"></div>`:''}</div>`;
  }).join('')||'<div class="no-data">Sin actividad registrada</div>';
  $id('dash-horario').innerHTML=`
    <div class="info-row"><span class="k">Entrada</span><span class="v"><span class="badge b-g">${cfg.ein}–${cfg.efin}</span></span></div>
    <div class="info-row"><span class="k">Salida</span><span class="v"><span class="badge b-b">${cfg.sin}–${cfg.sfin}</span></span></div>
    <div class="info-row"><span class="k">Alarma sonora</span><span class="v"><span class="badge ${cfg.alerta?'b-r':'b-n'}">${cfg.alerta?'🔔 Activo':'Inactivo'}</span></span></div>
    <div class="info-row"><span class="k">Rango alarma</span><span class="v">${cfg.alarmStart}–${cfg.alarmEnd}</span></div>`;
  $id('dash-emp').innerHTML=employees.filter(e=>e.activo).slice(0,5).map(e=>`
    <div class="feed-item">
      <div class="emp-av" style="background:${col(e.id)}18;color:${col(e.id)};width:34px;height:34px;border-radius:7px;font-size:10px;font-family:'Share Tech Mono',monospace;display:flex;align-items:center;justify-content:center;overflow:hidden">
        ${e.photo?`<img src="${e.photo}" style="width:100%;height:100%;object-fit:cover">`:ini(e.nombre)}</div>
      <div style="flex:1"><div class="fi-name">${e.nombre}</div><div class="fi-sub">${e.rol}${e.area?' · '+e.area:''}</div></div>
      <span class="badge ${e.activo?'b-c':'b-n'}">${e.activo?'✓':''}</span>
    </div>`).join('');
}

function renderTable(){
  const q=($id('emp-search')?.value||'').toLowerCase();
  const rol=$id('emp-rol-filter')?.value||'';
  const fl=employees.filter(e=>{
    if(!showInactive&&!e.activo) return false;
    return (e.nombre.toLowerCase().includes(q)||(e.dni||'').includes(q))&&(!rol||e.rol===rol);
  });
  $id('emp-tbody').innerHTML=fl.map(e=>`<tr class="${!e.activo?'inactive-emp':''}">
    <td><div style="display:flex;align-items:center;gap:10px">
      <div class="emp-av" style="background:${col(e.id)}18;color:${col(e.id)}">
        ${e.photo?`<img src="${e.photo}">`:ini(e.nombre)}</div>
      <div><div style="font-weight:700">${e.nombre}</div><div style="font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--text3)">${e.area||'—'}</div></div>
    </div></td>
    <td style="font-family:'Share Tech Mono',monospace;font-size:11px">${e.dni}</td>
    <td><span class="badge b-n" style="text-transform:capitalize">${e.rol}</span></td>
    <td style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text3)">${e.area||'—'}</td>
    <td style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text3)">${e.cel||'—'}</td>
    <td style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text3)">${e.email||'—'}</td>
    <td style="font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--text3);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.dir||'—'}</td>
    <td><span class="badge ${e.descriptors?.length>0?'b-g':'b-n'}">${e.descriptors?.length>0?'✓ '+e.descriptors.length:'—'}</span></td>
    <td>${e.photo?`<div style="width:34px;height:34px;border-radius:6px;overflow:hidden;cursor:pointer" onclick="openLightbox('${e.photo}')"><img src="${e.photo}" style="width:100%;height:100%;object-fit:cover"></div>`:'<span style="font-family:\'Share Tech Mono\',monospace;font-size:9px;color:var(--text3)">—</span>'}</td>
    <td><span class="badge ${e.activo?'b-g':'b-n'}">${e.activo?'Activo':'Inactivo'}</span></td>
    <td><div class="tbl-actions">
      <button class="ta-btn" onclick="openEdit(${e.id})" title="Editar">✏</button>
      ${e.activo?`<button class="ta-btn del" onclick="openDelete(${e.id})" title="Desactivar">🚫</button>`:''}
      <button class="ta-btn del" onclick="hardDelete(${e.id})" title="Eliminar">🗑</button>
    </div></td>
  </tr>`).join('')||`<tr><td colspan="11" style="text-align:center;padding:24px;font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text3)">Sin resultados</td></tr>`;
  updateBadges();
}

function renderRegistros(){
  const q=($id('reg-search')?.value||'').toLowerCase();
  const dateF=$id('reg-date-filter')?.value||'';
  let fl=records.filter(r=>{
    const match=r.nombre.toLowerCase().includes(q)||(r.dni||'').includes(q);
    if(!match) return false;
    if(regFilter!=='todos'&&r.tipo!==regFilter) return false;
    if(dateF){const rd=r.rawDate||r.fecha;if(!rd||!rd.includes(dateF)) return false}
    return true;
  });
  $id('registros-list').innerHTML=fl.length?fl.map(r=>{
    const isE=r.tipo==='entrada',isS=r.tipo==='salida',isD=r.tipo==='denegado';
    const bc=isE?'b-g':isS?'b-b':isD?'b-r':'b-a';
    const lbl=isE?'ENTRADA':isS?'SALIDA':isD?'DENEGADO':'ALERTA';
    return `<div class="reg-item">
      <div class="reg-photo" onclick="${r.foto?`openLightbox('${r.foto}')`:'void(0)'}" style="${r.foto?'cursor:pointer':''}">
        ${r.foto?`<img src="${r.foto}">`:ini(r.nombre||'??')}</div>
      <div class="reg-info">
        <div class="reg-name">${r.nombre||'Desconocido'}</div>
        <div class="reg-meta">${r.dni||'—'} · ${r.rol||'—'} · <span class="badge ${bc}">${lbl}</span> · Cam ${r.camara||'?'}</div>
        ${r.similitud>0?`<div class="reg-meta" style="margin-top:2px">Similitud: ${(r.similitud*100).toFixed(1)}%</div>`:''}
      </div>
      <div class="reg-time"><div class="t">${r.hora}</div><div class="d">${r.fecha}</div></div>
    </div>`;
  }).join(''):'<div class="no-data">Sin registros</div>';
}
function setRegFilter(t,el){document.querySelectorAll('#page-registros .chip').forEach(c=>c.classList.remove('active'));el.classList.add('active');regFilter=t;renderRegistros()}

function renderAlertas(){
  $id('alertas-list').innerHTML=alerts.length?alerts.map(a=>`
    <div class="feed-item">
      <div class="feed-dot" style="background:var(--red)"></div>
      <div style="flex:1"><div class="fi-name">⚠ ${a.nombre||'Desconocido'} — Fuera de horario</div><div class="fi-sub">${a.desc}</div><div class="fi-time">${a.ts}</div></div>
      ${a.foto?`<div class="fi-photo" style="cursor:pointer" onclick="openLightbox('${a.foto}')"><img src="${a.foto}"></div>`:''}</div>`).join('')
    :'<div class="no-data">Sin alertas</div>';
}

function renderCamPanel(){
  if($id('st-emp-count')) $id('st-emp-count').textContent=employees.filter(e=>e.activo).length;
  if($id('st-with-face')) $id('st-with-face').textContent=employees.filter(e=>e.activo&&e.descriptors?.length>0).length;
  if($id('st-thresh')) $id('st-thresh').textContent=cfg.thresh.toFixed(2);
  updateHorarioUI();
}

function renderStats(){
  const ent=records.filter(r=>r.tipo==='entrada').length;
  const sal=records.filter(r=>r.tipo==='salida').length;
  const den=records.filter(r=>r.tipo==='denegado').length;
  const act=employees.filter(e=>e.activo).length;
  $id('stats-kpis').innerHTML=`
    <div class="stat s-green"><div class="stat-l">Entradas</div><div class="stat-v">${ent}</div><div class="stat-ch" style="color:var(--green)">↑ Auto</div></div>
    <div class="stat s-blue"><div class="stat-l">Salidas</div><div class="stat-v">${sal}</div><div class="stat-ch" style="color:var(--blue)">↑ Auto</div></div>
    <div class="stat s-red"><div class="stat-l">Denegados</div><div class="stat-v">${den}</div><div class="stat-ch" style="color:${den>5?'var(--red)':'var(--green)'}">${den>5?'↑ Revisar':'↓ Normal'}</div></div>
    <div class="stat s-amber"><div class="stat-l">Activos</div><div class="stat-v">${act}</div><div class="stat-ch" style="color:var(--text3)">→</div></div>`;
  const hdata=Array(24).fill(0);
  records.forEach(r=>{const h=parseInt(r.hora?.split(':')?.[0]||0);if(!isNaN(h)) hdata[h]++});
  const mx=Math.max(...hdata,1);
  $id('hour-chart').innerHTML=hdata.map((v,i)=>`<div class="bar-col"><div class="bar-fill" style="height:${(v/mx)*100}%;background:${v>0?'var(--cyan)':'var(--bg4)'}"></div></div>`).join('');
  $id('hour-labels').innerHTML=['0h','4h','8h','12h','16h','20h','23h'].map(h=>`<div style="flex:1;font-family:'Share Tech Mono',monospace;font-size:7px;color:var(--text3);text-align:center">${h}</div>`).join('');
  const cnt={};records.filter(r=>r.nombre&&r.nombre!=='Desconocido').forEach(r=>{cnt[r.nombre]=(cnt[r.nombre]||0)+1});
  const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const mx2=Math.max(...top.map(t=>t[1]),1);
  $id('top-emps').innerHTML=top.map(([n,c])=>`
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <div style="width:28px;height:28px;border-radius:5px;background:var(--bg4);color:var(--text3);font-family:'Share Tech Mono',monospace;font-size:9px;display:flex;align-items:center;justify-content:center">${ini(n)}</div>
      <div style="flex:1;font-size:12px;font-weight:600;color:var(--text)">${n}</div>
      <div style="flex:2;height:4px;background:var(--bg4);border-radius:2px;overflow:hidden"><div style="height:100%;background:var(--cyan);border-radius:2px;width:${(c/mx2)*100}%"></div></div>
      <div style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text3)">${c}</div>
    </div>`).join('')||'<div class="no-data">Sin datos</div>';
}

function loadConfigUI(){
  $id('cfg-ein').value=cfg.ein;$id('cfg-efin').value=cfg.efin;
  $id('cfg-sin').value=cfg.sin;$id('cfg-sfin').value=cfg.sfin;
  $id('cfg-alerta').checked=cfg.alerta;$id('cfg-reauth').value=cfg.reauth;
  $id('cfg-thresh').value=cfg.thresh;$id('cfg-samples').value=cfg.samples;
  $id('cfg-alarm-start').value=cfg.alarmStart||'07:00';$id('cfg-alarm-end').value=cfg.alarmEnd||'18:30';
  $id('cfg-brightness').value=cfg.brightness;$id('lbl-brightness').textContent=cfg.brightness;
  $id('cfg-contrast').value=cfg.contrast;$id('lbl-contrast').textContent=cfg.contrast;
  $id('cfg-saturate').value=cfg.saturate;$id('lbl-saturate').textContent=cfg.saturate;
  $id('cfg-sharp').value=cfg.sharp||100;$id('lbl-sharp').textContent=cfg.sharp||100;
  $id('cfg-nightvision').checked=cfg.nightVision!==false;
  $id('cfg-auto-nv').checked=cfg.autoNV!==false;
  $id('cfg-autoenhance').checked=cfg.autoEnhance!==false;
  $id('cfg-with-face').textContent=employees.filter(e=>e.descriptors?.length>0).length;
  $id('cfg-total-ev').textContent=records.length+alerts.length;
  const isDark=document.documentElement.getAttribute('data-theme')==='dark';
  $id('cfg-theme-btn').textContent=isDark?'🌙 Cambiar a claro':'☀️ Cambiar a oscuro';
}

async function saveConfig(){
  cfg.thresh=parseFloat($id('cfg-thresh').value)||0.50;
  cfg.samples=parseInt($id('cfg-samples').value)||8;
  cfg.reauth=parseInt($id('cfg-reauth').value)||5;
  cfg.ein=$id('cfg-ein').value;cfg.efin=$id('cfg-efin').value;
  cfg.sin=$id('cfg-sin').value;cfg.sfin=$id('cfg-sfin').value;
  cfg.alerta=$id('cfg-alerta').checked;
  cfg.alarmStart=$id('cfg-alarm-start').value;cfg.alarmEnd=$id('cfg-alarm-end').value;
  cfg.brightness=parseInt($id('cfg-brightness').value)||110;
  cfg.contrast=parseInt($id('cfg-contrast').value)||120;
  cfg.saturate=parseInt($id('cfg-saturate').value)||110;
  cfg.sharp=parseInt($id('cfg-sharp').value)||100;
  cfg.nightVision=$id('cfg-nightvision').checked;
  cfg.autoNV=$id('cfg-auto-nv').checked;
  cfg.autoEnhance=$id('cfg-autoenhance').checked;
  await saveConfigDB();applyCamFilters();renderDash();
  toast('Configuración guardada ✓','ok');
  if(modelsLoaded) rebuildMatcher();
}

/* ══ CAMERAS ══ */
function setCamCount(n,el){document.querySelectorAll('#page-cameras .chip').forEach(c=>c.classList.remove('active'));el.classList.add('active');numCams=n;stopAllCams();buildCamsGrid()}

function buildCamsGrid(){
  const grid=$id('cams-grid');if(!grid) return;
  grid.style.gridTemplateColumns=numCams===1?'1fr':'1fr 1fr';
  grid.innerHTML='';
  for(let i=0;i<numCams;i++){
    const card=document.createElement('div');
    card.className='cam-card';card.id='cam-card-'+i;
    card.innerHTML=`
      <div class="cam-bar">
        <div class="cam-id"><span class="led" id="led-${i}"></span>CAM ${i+1}</div>
        <div style="display:flex;gap:6px;align-items:center">
          <span class="cam-mode-tag cmt-none" id="cam-mode-${i}" style="position:relative;top:auto;left:auto;font-size:8px;padding:2px 8px">—</span>
          <button class="btn btn-primary btn-sm" id="btn-cam-${i}" onclick="toggleCam(${i})">▶ Iniciar</button>
        </div>
      </div>
      <div class="cam-wrap" id="cam-wrap-${i}">
        <div class="cam-ph" onclick="toggleCam(${i})">
          <div class="ph-icon">◉</div>
          <div class="ph-msg">Clic para iniciar<br>Cámara ${i+1}</div>
        </div>
      </div>
      <div class="cam-fx-bar" id="cam-fx-${i}">
        <span style="font-family:'Share Tech Mono',monospace;font-size:8px;color:var(--text3);margin-right:4px;letter-spacing:1px">EFECTOS:</span>
        <button class="fx-btn" data-fx="enhance" onclick="applyFx(${i},'enhance')">🔆 Mejora</button>
        <button class="fx-btn" data-fx="nightvision" onclick="applyFx(${i},'nightvision')">🌙 Nocturna</button>
        <button class="fx-btn fx-amber" data-fx="thermal" onclick="applyFx(${i},'thermal')">🌡 Térmico</button>
        <button class="fx-btn" data-fx="highcontrast" onclick="applyFx(${i},'highcontrast')">◑ Alto contraste</button>
      </div>
      <div class="manual-reg-bar">
        <span class="mlabel">Manual:</span>
        <button class="btn btn-green btn-xs" onclick="manualRegister(${i},'entrada')">↑ Registrar entrada</button>
        <button class="btn btn-cyan btn-xs" onclick="manualRegister(${i},'salida')">↓ Registrar salida</button>
        <button class="btn btn-ghost btn-xs" id="manual-emp-info-${i}" style="font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--text3)">Último: —</button>
      </div>
      <div class="cam-footer">
        <span class="cam-stat">Det: <b id="cdet-${i}">0</b></span>
        <span class="cam-stat">FPS: <b id="cfps-${i}">—</b></span>
        <span class="cam-stat">Sim: <b id="csim-${i}">—</b></span>
        <span class="cam-stat" id="cnv-${i}" style="color:var(--green);display:none">🌙 NV</span>
      </div>`;
    grid.appendChild(card);
  }
}

async function toggleCam(i){camStreams[i]?stopCam(i):await startCam(i)}

async function startCam(i){
  try{
    const stream=await navigator.mediaDevices.getUserMedia({
      video:{width:{ideal:1920,min:1280},height:{ideal:1080,min:720},frameRate:{ideal:30,min:15},facingMode:'user'}
    }).catch(()=>navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},facingMode:'user'}}));
    camStreams[i]=stream;
    const wrap=$id('cam-wrap-'+i);
    wrap.innerHTML=`
      <video id="cvid-${i}" autoplay muted playsinline style="width:100%;height:100%;object-fit:cover;filter:${getCamFilterCSS()}"></video>
      <canvas class="ov" id="ccanvas-${i}" style="position:absolute;inset:0;pointer-events:none;width:100%;height:100%"></canvas>
      <div id="cam-clock-${i}" class="cam-clock-ov"><span id="cc-time-${i}">--:--:--</span><div class="cam-date" id="cc-date-${i}"></div></div>
      <div id="nv-badge-${i}" class="nv-badge">🌙 NIGHT VISION</div>
      <div class="scan-beam"></div>
      <div class="corner-tl"></div><div class="corner-tr"></div><div class="corner-bl"></div><div class="corner-br"></div>`;
    const vid=$id('cvid-'+i);vid.srcObject=stream;
    await new Promise(r=>vid.addEventListener('loadedmetadata',r,{once:true}));
    const card=$id('cam-card-'+i);if(card) card.classList.add('active-cam');
    camClockTimers[i]=setInterval(()=>{const t=$id('cc-time-'+i),d=$id('cc-date-'+i);if(t) t.textContent=timeFmt();if(d) d.textContent=dateFmt()},1000);
    camNVTimers[i]=setInterval(()=>checkNightVision(i),5000);
    $id('btn-cam-'+i).textContent='■ Detener';$id('btn-cam-'+i).className='btn btn-ghost btn-sm';
    $id('led-'+i).className='led live';
    let fpsT=performance.now(),fpsC=0;
    camLoops[i]=setInterval(async()=>{
      fpsC++;if(performance.now()-fpsT>1000){if($id('cfps-'+i)) $id('cfps-'+i).textContent=fpsC.toFixed(0);fpsT=performance.now();fpsC=0}
      modelsLoaded?await detectOnCam(i):demoDetect(i);
    },modelsLoaded?180:2500);
    toast(`Cámara ${i+1} activa`,'ok');updateBadges();
  }catch(err){toast('Error cámara '+(i+1)+': '+err.message,'err')}
}

function stopCam(i){
  if(camLoops[i]){clearInterval(camLoops[i]);delete camLoops[i]}
  if(camClockTimers[i]){clearInterval(camClockTimers[i]);delete camClockTimers[i]}
  if(camNVTimers[i]){clearInterval(camNVTimers[i]);delete camNVTimers[i]}
  if(camStreams[i]){camStreams[i].getTracks().forEach(t=>t.stop());delete camStreams[i]}
  const wrap=$id('cam-wrap-'+i);
  if(wrap) wrap.innerHTML=`<div class="cam-ph" onclick="toggleCam(${i})"><div class="ph-icon">◉</div><div class="ph-msg">CLIC PARA INICIAR<br>CÁMARA ${i+1}</div></div>`;
  const btn=$id('btn-cam-'+i);if(btn){btn.textContent='▶ Iniciar';btn.className='btn btn-primary btn-sm'}
  const led=$id('led-'+i);if(led) led.className='led';
  const card=$id('cam-card-'+i);if(card) card.classList.remove('active-cam');
  const mt=$id('cam-mode-'+i);if(mt){mt.textContent='—';mt.className='cam-mode-tag cmt-none';mt.style.cssText='position:relative;top:auto;left:auto;font-size:8px;padding:2px 8px'}
  updateBadges();
}

function startAllCams(){$id('btn-all-start').style.display='none';$id('btn-all-stop').style.display='inline-flex';for(let i=0;i<numCams;i++) if(!camStreams[i]) startCam(i)}
function stopAllCams(){$id('btn-all-start').style.display='inline-flex';$id('btn-all-stop').style.display='none';Object.keys(camStreams).forEach(i=>stopCam(Number(i)))}

/* ══ MANUAL REGISTER ══ */
let lastDetectedEmp={}; // per cam
async function manualRegister(camIdx,tipo){
  const now=new Date();
  const rawDate=now.toISOString().split('T')[0];
  const vid=$id('cvid-'+camIdx);
  const foto=captureHQ(vid)||null;
  // Use last detected employee if available, else show picker
  const lastEmp=lastDetectedEmp[camIdx];
  let emp=null;
  if(lastEmp){emp=employees.find(e=>e.id===lastEmp&&e.activo)}
  if(!emp){
    // Show a simple prompt picker
    const names=employees.filter(e=>e.activo).map(e=>e.nombre);
    if(names.length===0){toast('No hay empleados activos','err');return}
    const sel=prompt('Nombre del empleado:\n'+names.map((n,i)=>`${i+1}. ${n}`).join('\n')+'\n\nEscribe el número:');
    if(!sel) return;
    const idx=parseInt(sel)-1;
    if(isNaN(idx)||idx<0||idx>=names.length){toast('Selección inválida','err');return}
    emp=employees.filter(e=>e.activo)[idx];
  }
  if(!emp){toast('Empleado no encontrado','err');return}
  const rec={tipo,nombre:emp.nombre,dni:emp.dni||'—',rol:emp.rol||'—',empId:emp.id,similitud:1,fecha:dateFmt(now),hora:timeFmt(now),rawDate,camara:camIdx+1,foto,ts:nowFmt(),manual:true};
  const id=await dbAdd('records',rec);records.unshift({...rec,id});
  updateBadges();renderDash();
  const mt=$id('cam-mode-'+camIdx);
  if(mt){mt.textContent=tipo==='entrada'?'↑ MANUAL ENTRADA':'↓ MANUAL SALIDA';mt.className='cam-mode-tag '+(tipo==='entrada'?'cmt-entry':'cmt-exit');mt.style.cssText='position:relative;top:auto;left:auto;font-size:8px;padding:2px 8px'}
  const info=$id('manual-emp-info-'+camIdx);if(info) info.textContent=`Último: ${emp.nombre.split(' ')[0]} (${tipo})`;
  showCamAlert(`${tipo==='entrada'?'✅':'🏁'} MANUAL: ${emp.nombre} — ${tipo.toUpperCase()}`,'ok');
  toast(`${tipo.toUpperCase()} manual: ${emp.nombre}`,'ok');
}

/* ══ REAL DETECTION ══ */
async function detectOnCam(i){
  const vid=$id('cvid-'+i),canvas=$id('ccanvas-'+i);
  if(!vid||!canvas||!vid.srcObject||vid.paused||vid.readyState<2) return;
  try{
    const opts=new faceapi.SsdMobilenetv1Options({minConfidence:0.50});
    const dets=await faceapi.detectAllFaces(vid,opts).withFaceLandmarks().withFaceDescriptors();
    const ctx=canvas.getContext('2d');
    canvas.width=vid.videoWidth||1280;canvas.height=vid.videoHeight||720;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if($id('cdet-'+i)) $id('cdet-'+i).textContent=dets.length;
    if(!dets.length) return;
    const dims=faceapi.matchDimensions(canvas,vid,true);
    const resized=faceapi.resizeResults(dets,dims);
    const now=Date.now();let bestSim=0;
    for(const det of resized){
      let label='Desconocido',similitud=0,empId=null,emp=null;
      if(faceMatcher){
        const match=faceMatcher.findBestMatch(det.descriptor);
        if(match.label!=='unknown'){
          const p=match.label.split('::');label=p[0];empId=parseInt(p[1]);
          similitud=1-match.distance;
          emp=employees.find(e=>e.id===empId&&e.activo);
          if(!emp){label='Desconocido';similitud=0;empId=null}
        }
      }
      const isKnown=label!=='Desconocido';
      drawBox(ctx,det.detection.box,label,similitud,isKnown);
      bestSim=Math.max(bestSim,similitud);
      if(empId) lastDetectedEmp[i]=empId;
      if(isKnown&&empId&&(!lastAuth[empId]||now-lastAuth[empId]>cfg.reauth*1000)){
        lastAuth[empId]=now;
        const foto=captureHQ(vid);
        await registerAccess(emp,similitud,foto,getMode(),i);
      } else if(!isKnown&&Math.random()<0.10){
        const foto=captureHQ(vid);await registerDenied(foto,i);
      }
    }
    if($id('csim-'+i)) $id('csim-'+i).textContent=bestSim>0?(bestSim*100).toFixed(0)+'%':'—';
  }catch(e){console.error('Detection:',e)}
}

/* DEMO DETECT */
function demoDetect(i){
  const canvas=$id('ccanvas-'+i),vid=$id('cvid-'+i);
  if(!canvas||!vid) return;
  canvas.width=vid.videoWidth||1280;canvas.height=vid.videoHeight||720;
  const W=canvas.width,H=canvas.height;
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,W,H);
  const activeEmps=employees.filter(e=>e.activo);
  if(!activeEmps.length) return;
  const isKnown=Math.random()<0.72;
  const sim=isKnown?(0.65+Math.random()*0.30):Math.random()*0.28;
  const emp=activeEmps[Math.floor(Math.random()*activeEmps.length)];
  const label=isKnown?emp.nombre:'Desconocido';const empId=isKnown?emp.id:null;
  const bx=W*.22,by=H*.06,bw=W*.56,bh=H*.86;
  drawBox(ctx,{x:bx,y:by,width:bw,height:bh},label,sim,isKnown);
  if($id('cdet-'+i)) $id('cdet-'+i).textContent=1;
  if($id('csim-'+i)) $id('csim-'+i).textContent=isKnown?(sim*100).toFixed(0)+'%':'—';
  if(empId) lastDetectedEmp[i]=empId;
  const now=Date.now();
  if(isKnown&&empId&&(!lastAuth[empId]||now-lastAuth[empId]>cfg.reauth*1000)){
    lastAuth[empId]=now;const foto=captureHQ(vid);registerAccess(emp,sim,foto,getMode(),i);
  } else if(!isKnown&&Math.random()<0.12){registerDenied(captureHQ(vid),i)}
}

function drawBox(ctx,box,label,sim,isKnown){
  const c=isKnown?'#00FFB2':'#FF1A0F';
  ctx.fillStyle=isKnown?'rgba(0,255,178,.04)':'rgba(255,26,15,.05)';
  ctx.fillRect(box.x,box.y,box.width,box.height);
  ctx.strokeStyle=c;ctx.lineWidth=2;ctx.strokeRect(box.x,box.y,box.width,box.height);
  const txt=isKnown?`${label.split(' ')[0].toUpperCase()}  ${(sim*100).toFixed(0)}%`:'⚠ DESCONOCIDO';
  ctx.font='bold 12px "Share Tech Mono",monospace';
  const tw=ctx.measureText(txt).width+14;
  ctx.fillStyle=c;ctx.fillRect(box.x,box.y-26,tw,20);
  ctx.fillStyle=isKnown?'#000':'#fff';ctx.fillText(txt,box.x+7,box.y-12);
  const cs=16,lw=2;ctx.strokeStyle=c;ctx.lineWidth=lw;
  [[0,0,1,1],[1,0,-1,1],[0,1,1,-1],[1,1,-1,-1]].forEach(([fx,fy,dx,dy])=>{
    const cx=box.x+fx*box.width,cy=box.y+fy*box.height;
    ctx.beginPath();ctx.moveTo(cx,cy+cs*dy);ctx.lineTo(cx,cy);ctx.lineTo(cx+cs*dx,cy);ctx.stroke();
  });
}

/* ══ REGISTER ACCESS ══ */
async function registerAccess(emp,sim,foto,mode,camIdx){
  const now=new Date();
  const mt=$id('cam-mode-'+camIdx);
  const outsideAlarm=cfg.alerta&&!isInAlarmRange();
  if(mode==='ninguno'||outsideAlarm){
    if(cfg.alerta){
      const alerta={nombre:emp.nombre,desc:`Cám ${camIdx+1} · Fuera de horario · ${(sim*100).toFixed(1)}%`,ts:nowFmt(),foto};
      await dbAdd('alerts',alerta);alerts.unshift({...alerta,id:alerts.length+1});
      showCamAlert(`⚠ ${emp.nombre} — FUERA DE HORARIO`,'err');
      startAlarm(emp.nombre);updateBadges();
    }
    addDetLog(emp.nombre,sim,false,'fuera de horario');
    if(mt){mt.textContent='⚠ ALERTA';mt.className='cam-mode-tag cmt-alert';mt.style.cssText='position:relative;top:auto;left:auto;font-size:8px;padding:2px 8px'}
    return;
  }
  const tipo=mode;
  const rawDate=now.toISOString().split('T')[0];
  const rec={tipo,nombre:emp.nombre,dni:emp.dni||'—',rol:emp.rol||'—',empId:emp.id,similitud:sim,fecha:dateFmt(now),hora:timeFmt(now),rawDate,camara:camIdx+1,foto,ts:nowFmt()};
  const id=await dbAdd('records',rec);records.unshift({...rec,id});
  updateBadges();renderDash();
  addDetLog(emp.nombre,sim,true,tipo);
  const lbl=tipo==='entrada'?'↑ ENTRADA':'↓ SALIDA';
  if(mt){mt.textContent=lbl;mt.className='cam-mode-tag '+(tipo==='entrada'?'cmt-entry':'cmt-exit');mt.style.cssText='position:relative;top:auto;left:auto;font-size:8px;padding:2px 8px'}
  showCamAlert(`${tipo==='entrada'?'✅':'🏁'} ${emp.nombre} — ${tipo.toUpperCase()}`,'ok');
  setStatus(`${lbl}: ${emp.nombre.split(' ')[0]}`,'ok');
  setTimeout(()=>setStatus('ACTIVO','ok'),3000);
}

async function registerDenied(foto,camIdx){
  const now=new Date();const rawDate=now.toISOString().split('T')[0];
  const rec={tipo:'denegado',nombre:'Desconocido',dni:'—',rol:'—',empId:null,similitud:0,fecha:dateFmt(now),hora:timeFmt(now),rawDate,camara:camIdx+1,foto,ts:nowFmt()};
  const id=await dbAdd('records',rec);records.unshift({...rec,id});
  updateBadges();renderDash();addDetLog('Desconocido',0,false,'denegado');
  if(cfg.alerta&&!isInAlarmRange()){
    const alerta={nombre:'Desconocido',desc:`Cám ${camIdx+1} · Persona desconocida fuera de horario`,ts:nowFmt(),foto};
    await dbAdd('alerts',alerta);alerts.unshift({...alerta,id:alerts.length+1});
    startAlarm('Desconocido');updateBadges();
  }
}

function showCamAlert(msg,type='ok'){
  const area=$id('cam-alerts');if(!area) return;
  const d=document.createElement('div');d.className=`alert-banner ${type}`;d.textContent=msg;
  area.prepend(d);setTimeout(()=>{if(d.parentNode) d.remove()},5000);
}

function addDetLog(nombre,sim,ok,extra=''){
  const wrap=$id('det-log');if(!wrap) return;
  const d=document.createElement('div');d.className='det-item';
  d.innerHTML=`<div class="det-dot" style="background:${ok?'var(--green)':'var(--red)'}"></div>
    <div><div class="det-name">${nombre}</div><div class="det-meta">${ok?extra.toUpperCase():'DENEGADO'} · ${sim>0?(sim*100).toFixed(0)+'%':'—'} · ${timeFmt()}</div></div>`;
  wrap.insertBefore(d,wrap.firstChild);
  while(wrap.children.length>50) wrap.removeChild(wrap.lastChild);
  if($id('st-detected')) $id('st-detected').textContent=parseInt($id('st-detected').textContent||0)+1;
}

/* ══ FACE-API MODELS ══ */
const MODEL_URLS=[
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model',
  'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights',
];
async function loadModels(){
  for(const baseUrl of MODEL_URLS){
    try{
      $id('ls-msg').textContent=`Cargando modelos IA...`;$id('ls-fill').style.width='30%';
      await faceapi.nets.ssdMobilenetv1.loadFromUri(baseUrl);
      $id('ls-fill').style.width='60%';
      await faceapi.nets.faceLandmark68Net.loadFromUri(baseUrl);
      $id('ls-fill').style.width='85%';
      await faceapi.nets.faceRecognitionNet.loadFromUri(baseUrl);
      modelsLoaded=true;
      if($id('model-badge')){$id('model-badge').textContent='IA FaceNet 128D ✓';$id('model-badge').style.cssText='background:var(--green-dim);color:var(--green);border:1px solid rgba(0,255,178,.2)'}
      toast('Modelos IA cargados ✓ — Reconocimiento real activo','ok');
      rebuildMatcher();return;
    }catch(err){console.warn(`CDN failed:`,err.message)}
  }
  if($id('model-badge')){$id('model-badge').textContent='Modo Demo (sin conexión)';$id('model-badge').style.cssText='background:var(--amber-dim);color:var(--amber);border:1px solid rgba(255,184,0,.2)'}
  toast('Modelos no disponibles — modo demo activo','warn');
}
function rebuildMatcher(){
  if(!modelsLoaded) return;
  const labeled=employees.filter(e=>e.activo&&e.descriptors?.length>0).map(e=>{
    const descs=e.descriptors.map(d=>new Float32Array(d));
    return new faceapi.LabeledFaceDescriptors(e.nombre+'::'+e.id,descs);
  });
  faceMatcher=labeled.length>0?new faceapi.FaceMatcher(labeled,cfg.thresh):null;
}

/* ══ REGISTRATION SOURCE ══ */
function setRegSource(src){
  regSource=src;
  document.querySelectorAll('.ist').forEach(t=>t.classList.remove('active'));
  $id('src-'+src).classList.add('active');
  if(src==='cam'){$id('reg-cam-section').style.display='block';$id('reg-img-section').style.display='none';$id('reg-prog-area').style.display=regStream?'block':'none'}
  else{stopRegCam();$id('reg-cam-section').style.display='none';$id('reg-img-section').style.display='block';$id('reg-prog-area').style.display='none'}
}

/* ══ IMAGE UPLOAD ══ */
async function handleImageUpload(file){
  if(!file) return;
  if(file.size>10*1024*1024){toast('Imagen muy grande','err');return}
  $id('img-status').textContent='Procesando imagen...';
  const url=URL.createObjectURL(file);
  uploadedPhotoData=await fileToBase64(file);
  $id('img-preview-wrap').style.display='block';$id('img-preview-el').src=url;
  if(!modelsLoaded){
    uploadedImageDescriptors=[];const count=cfg.samples||8;
    for(let i=0;i<count;i++) uploadedImageDescriptors.push(Array.from({length:128},()=>Math.random()*2-1));
    $id('img-status').textContent=`✓ ${count} descriptores (modo demo)`;
    regDescriptors=uploadedImageDescriptors;regCapCount=count;
    toast(`Imagen procesada · ${count} descriptores demo`,'ok');return;
  }
  try{
    const img=await faceapi.fetchImage(url);
    $id('img-status').textContent='Detectando cara...';
    const det=await faceapi.detectSingleFace(img,new faceapi.SsdMobilenetv1Options({minConfidence:0.45})).withFaceLandmarks().withFaceDescriptor();
    if(!det){$id('img-status').textContent='⚠ No se detectó cara — foto de frente, buena luz';toast('No se detectó cara','err');return}
    uploadedImageDescriptors=[];
    for(let aug=0;aug<(cfg.samples||8);aug++){
      const noise=0.012;
      uploadedImageDescriptors.push(Array.from(det.descriptor).map(v=>v+(Math.random()*2-1)*noise));
    }
    regDescriptors=uploadedImageDescriptors;regCapCount=uploadedImageDescriptors.length;
    $id('img-status').textContent=`✓ ${uploadedImageDescriptors.length} descriptores extraídos`;
    toast('Cara detectada ✓','ok');
  }catch(e){$id('img-status').textContent='Error: '+e.message;toast('Error al procesar imagen','err')}
}
function fileToBase64(file){return new Promise((r,j)=>{const fr=new FileReader();fr.onload=e=>r(e.target.result);fr.onerror=j;fr.readAsDataURL(file)})}
async function handleEditPhotoUpload(file){if(!file) return;editPhotoData=await fileToBase64(file);$id('edit-photo-preview').style.display='flex';$id('edit-photo-img').src=editPhotoData}

/* ══ CAMERA REGISTRATION ══ */
async function startRegCam(){
  if(regStream) return;
  try{
    regStream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:960},facingMode:'user'}});
    const vid=$id('reg-video');vid.srcObject=regStream;vid.style.display='block';
    $id('reg-cam-ph').style.display='none';$id('reg-scan-ov').style.display='block';
    $id('reg-prog-area').style.display='block';$id('reg-cam-frame').classList.add('scanning');
    regDescriptors=[];regCapCount=0;updateRegProg();
    if(modelsLoaded){
      $id('reg-status-txt').textContent='Coloca tu cara en el recuadro...';
      regInterval=setInterval(captureDescriptor,650);
    } else {
      $id('reg-status-txt').textContent='Modo demo — capturando...';
      regInterval=setInterval(()=>{
        regCapCount++;regDescriptors.push(Array.from({length:128},()=>Math.random()*2-1));updateRegProg();
        if(regCapCount>=cfg.samples){clearInterval(regInterval);$id('reg-cam-frame').classList.remove('scanning');$id('reg-cam-frame').classList.add('done');$id('reg-status-txt').textContent='✓ Captura completa';toast(`${cfg.samples} descriptores listos`,'ok')}
      },320);
    }
  }catch(err){toast('No se pudo acceder a la cámara: '+err.message,'err')}
}
async function captureDescriptor(){
  const vid=$id('reg-video');if(!vid||!vid.srcObject||vid.readyState<2) return;
  try{
    const det=await faceapi.detectSingleFace(vid,new faceapi.SsdMobilenetv1Options({minConfidence:0.55})).withFaceLandmarks().withFaceDescriptor();
    if(det){
      regDescriptors.push(Array.from(det.descriptor));regCapCount++;
      $id('reg-status-txt').textContent=`✓ Cara detectada · ${regCapCount}/${cfg.samples}`;
      updateRegProg();
      if(regCapCount>=cfg.samples){clearInterval(regInterval);$id('reg-cam-frame').classList.remove('scanning');$id('reg-cam-frame').classList.add('done');$id('reg-status-txt').textContent='✓ Completo — completa los datos';toast(`${cfg.samples} descriptores capturados ✓`,'ok')}
    } else {$id('reg-status-txt').textContent='Buscando cara... centra bien tu rostro'}
  }catch(e){}
}
function updateRegProg(){
  const pct=Math.min((regCapCount/cfg.samples)*100,100);
  if($id('reg-prog-txt')) $id('reg-prog-txt').textContent=`${regCapCount}/${cfg.samples}`;
  if($id('reg-prog-fill')) $id('reg-prog-fill').style.width=pct+'%';
}
function stopRegCam(){
  if(regInterval){clearInterval(regInterval);regInterval=null}
  if(regStream){regStream.getTracks().forEach(t=>t.stop());regStream=null}
  const vid=$id('reg-video');if(vid){vid.style.display='none';vid.srcObject=null}
  const ph=$id('reg-cam-ph');if(ph) ph.style.display='flex';
  const so=$id('reg-scan-ov');if(so) so.style.display='none';
  const pa=$id('reg-prog-area');if(pa) pa.style.display='none';
  const cf=$id('reg-cam-frame');if(cf) cf.classList.remove('scanning','done');
  regDescriptors=[];regCapCount=0;
}

/* ══ SAVE EMPLOYEE ══ */
async function saveEmployee(){
  const nombre=$id('r-name').value.trim();const dni=$id('r-dni').value.trim();
  const rol=$id('r-rol').value;const area=$id('r-area').value.trim();
  const cel=$id('r-cel').value.trim();const email=$id('r-email').value.trim();
  const dir=$id('r-dir').value.trim();
  if(!nombre){toast('El nombre es requerido','err');return}
  if(!/^\d{8}$/.test(dni)){toast('DNI inválido — 8 dígitos','err');return}
  if(employees.find(e=>e.dni===dni&&e.activo)){toast('Este DNI ya está registrado','err');return}
  if(regDescriptors.length===0){toast('Se necesita registrar el rostro','err');return}
  let photo=null;
  if(regSource==='img'&&uploadedPhotoData) photo=uploadedPhotoData;
  else if(regSource==='cam'){const vid=$id('reg-video');photo=captureHQ(vid)||null}
  const emp={nombre,dni,rol,area,cel,email,dir,activo:true,fecha:dateFmt(),descriptors:regDescriptors,photo};
  const id=await dbAdd('employees',emp);employees.unshift({...emp,id});
  stopRegCam();closeModal('m-emp');
  ['r-name','r-dni','r-area','r-cel','r-email','r-dir'].forEach(f=>{const el=$id(f);if(el) el.value=''});
  uploadedImageDescriptors=[];uploadedPhotoData=null;regDescriptors=[];regCapCount=0;
  if($id('img-preview-wrap')) $id('img-preview-wrap').style.display='none';
  if($id('img-status')) $id('img-status').textContent='';
  renderTable();renderDash();toast(`${nombre} registrado ✓`,'ok');
  if(modelsLoaded) rebuildMatcher();
}

/* ══ DELETE / EDIT ══ */
function openDelete(id){deleteId=id;const e=employees.find(e=>e.id===id);$id('del-name-txt').textContent=e?.nombre||'este empleado';$id('del-hard').checked=false;openModal('m-del')}
async function confirmDelete(){
  const emp=employees.find(e=>e.id===deleteId);const hardDel=$id('del-hard').checked;
  if(emp){
    if(hardDel){await dbDelete('employees',deleteId);employees=employees.filter(e=>e.id!==deleteId);toast(`${emp.nombre} eliminado permanentemente`,'warn')}
    else{emp.activo=false;await dbPut('employees',emp);toast(`${emp.nombre} desactivado`,'warn')}
    renderTable();renderDash();if(modelsLoaded) rebuildMatcher();
  }
  closeModal('m-del');deleteId=null;
}
async function hardDelete(id){
  const emp=employees.find(e=>e.id===id);if(!emp) return;
  if(!confirm(`¿Eliminar permanentemente a "${emp.nombre}"?`)) return;
  await dbDelete('employees',id);employees=employees.filter(e=>e.id!==id);
  renderTable();renderDash();if(modelsLoaded) rebuildMatcher();
  toast(`${emp.nombre} eliminado`,'warn');
}
function openEdit(id){
  editId=id;const e=employees.find(e=>e.id===id);if(!e) return;
  $id('e-name').value=e.nombre;$id('e-dni').value=e.dni;$id('e-rol').value=e.rol;$id('e-area').value=e.area||'';
  $id('e-cel').value=e.cel||'';$id('e-email').value=e.email||'';$id('e-dir').value=e.dir||'';
  editPhotoData=null;$id('edit-photo-preview').style.display='none';openModal('m-edit');
}
async function saveEdit(){
  const emp=employees.find(e=>e.id===editId);
  if(emp){
    emp.nombre=$id('e-name').value.trim();emp.dni=$id('e-dni').value.trim();
    emp.rol=$id('e-rol').value;emp.area=$id('e-area').value.trim();
    emp.cel=$id('e-cel').value.trim();emp.email=$id('e-email').value.trim();emp.dir=$id('e-dir').value.trim();
    if(editPhotoData) emp.photo=editPhotoData;
    await dbPut('employees',emp);renderTable();renderDash();
    toast(`${emp.nombre} actualizado ✓`,'ok');if(modelsLoaded) rebuildMatcher();
  }
  closeModal('m-edit');editId=null;editPhotoData=null;
}

/* ══ SECURE DELETE ══ */
function checkAdminPass(p){return p===cfg.adminPass}
async function secureDeleteRecords(type){
  const pass=$id('del-rec-pass').value;if(!checkAdminPass(pass)){toast('Contraseña incorrecta','err');return}
  if(type==='today'){const today=new Date().toISOString().split('T')[0];const toDelete=records.filter(r=>r.rawDate===today);for(const r of toDelete) await dbDelete('records',r.id);records=records.filter(r=>r.rawDate!==today);toast('Registros de hoy eliminados','warn')}
  else if(type==='all'){await dbClear('records');records=[];toast('Todos los registros eliminados','warn')}
  else if(type==='photos'){for(const r of records){if(r.foto){r.foto=null;await dbPut('records',r)}}toast('Fotos eliminadas','warn')}
  else if(type==='alerts'){await dbClear('alerts');alerts=[];toast('Alertas eliminadas','warn')}
  closeModal('m-del-records');renderRegistros();renderAlertas();renderDash();updateBadges();
}
async function secureDeletePersonal(type){
  const pass=$id('del-per-pass').value;if(!checkAdminPass(pass)){toast('Contraseña incorrecta','err');return}
  if(type==='inactive'){const inact=employees.filter(e=>!e.activo);for(const e of inact) await dbDelete('employees',e.id);employees=employees.filter(e=>e.activo);toast('Empleados inactivos eliminados','warn')}
  else if(type==='faces'){for(const e of employees){e.descriptors=[];await dbPut('employees',e)}faceMatcher=null;toast('Descriptores eliminados','warn')}
  else if(type==='photos'){for(const e of employees){e.photo=null;await dbPut('employees',e)}toast('Fotos de perfil eliminadas','warn')}
  else if(type==='all'){if(!confirm('¿Eliminar TODOS los empleados?')) return;await dbClear('employees');employees=[];faceMatcher=null;toast('Todo el personal eliminado','warn')}
  closeModal('m-del-personal');renderTable();renderDash();updateBadges();if(modelsLoaded) rebuildMatcher();
}
async function wipeAll(){
  const pass=$id('wipe-pass').value;const conf=$id('wipe-confirm').value;
  if(!checkAdminPass(pass)){toast('Contraseña incorrecta','err');return}
  if(conf!=='CONFIRMAR'){toast('Escribe CONFIRMAR exactamente','err');return}
  await dbClear('employees');await dbClear('records');await dbClear('alerts');
  employees=[];records=[];alerts=[];faceMatcher=null;closeModal('m-wipe');
  renderAll();toast('Sistema reseteado','warn');
}
async function clearAlertas(){if(!confirm('¿Eliminar todas las alertas?'))return;await dbClear('alerts');alerts=[];renderAlertas();updateBadges();toast('Alertas eliminadas','warn')}
function renderAll(){renderDash();renderTable();renderRegistros();renderAlertas();updateBadges()}
function toggleShowInactive(){showInactive=!showInactive;$id('btn-show-inactive').textContent=showInactive?'Ocultar inactivos':'Mostrar inactivos';renderTable()}

/* ══ REPORTS ══ */
function setPeriod(p,el){
  document.querySelectorAll('.pt').forEach(t=>t.classList.remove('active'));el.classList.add('active');reportPeriod=p;
  const now=new Date();let from=new Date(),to=new Date();
  if(p==='dia'){from=new Date(now.toDateString())}
  else if(p==='semana'){from=new Date(now);from.setDate(now.getDate()-7)}
  else if(p==='mes'){from=new Date(now.getFullYear(),now.getMonth(),1)}
  else if(p==='trimestre'){from=new Date(now.getFullYear(),Math.floor(now.getMonth()/3)*3,1)}
  else if(p==='anual'){from=new Date(now.getFullYear(),0,1)}
  $id('pdf-from').value=from.toISOString().split('T')[0];$id('pdf-to').value=to.toISOString().split('T')[0];
  $id('pdf-period-txt').value={dia:'Hoy',semana:'Últimos 7 días',mes:'Este mes',trimestre:'Este trimestre',anual:'Este año'}[p];
  renderReportPreview();
}
function getRecordsForPeriod(){
  const from=$id('pdf-from')?.value;const to=$id('pdf-to')?.value;const tf=$id('pdf-type-filter')?.value||'';
  return records.filter(r=>{const d=r.rawDate||'';return(!from||d>=from)&&(!to||d<=to)&&(!tf||r.tipo===tf)});
}
function renderReportPreview(){
  const fl=getRecordsForPeriod();
  const ent=fl.filter(r=>r.tipo==='entrada').length;const sal=fl.filter(r=>r.tipo==='salida').length;
  const from=$id('pdf-from')?.value||'—';const to=$id('pdf-to')?.value||'—';
  $id('pdf-preview-stats').innerHTML=`
    <div class="info-row"><span class="k">Período</span><span class="v">${from} — ${to}</span></div>
    <div class="info-row"><span class="k">Total registros</span><span class="v">${fl.length}</span></div>
    <div class="info-row"><span class="k">Entradas</span><span class="v" style="color:var(--green)">${ent}</span></div>
    <div class="info-row"><span class="k">Salidas</span><span class="v" style="color:var(--blue)">${sal}</span></div>
    <div class="info-row"><span class="k">Con captura</span><span class="v">${fl.filter(r=>r.foto).length}</span></div>
    <div style="margin-top:12px"><button class="btn btn-primary" style="width:100%;justify-content:center" onclick="genPDF()">↓ Generar PDF</button></div>`;
}

/* ══ PDF (simplified: hora, nombre, captura automática) ══ */
function genPDF(){
  const{jsPDF}=window.jspdf;if(!jsPDF){toast('PDF no disponible','err');return}
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const W=210,H=297,now=new Date();
  const filteredRecs=getRecordsForPeriod();
  const periodLabel=$id('pdf-period-txt')?.value||'Personalizado';
  const fromD=$id('pdf-from')?.value||'';const toD=$id('pdf-to')?.value||'';

  // Header
  doc.setFillColor(3,5,10);doc.rect(0,0,W,34,'F');
  doc.setFillColor(255,26,15);doc.rect(0,34,W,2,'F');
  doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(22);
  doc.text('PLAZA',12,20);doc.setTextColor(255,26,15);doc.text('VEA',42,20);
  doc.setTextColor(120,140,160);doc.setFont('helvetica','normal');doc.setFontSize(7);
  doc.text('SISTEMA BIOMÉTRICO v7 · BioSec · Control de Acceso',12,27);
  doc.text(`Generado: ${dateFmt(now)} ${timeFmt(now)}`,W-12,27,{align:'right'});
  doc.setTextColor(20,20,20);doc.setFont('helvetica','bold');doc.setFontSize(14);doc.text(`Informe de Control de Acceso — ${periodLabel}`,12,48);
  doc.setTextColor(100,100,100);doc.setFont('helvetica','normal');doc.setFontSize(7.5);
  doc.text(`Período: ${fromD||'inicio'} → ${toD||'hoy'}  ·  Entrada: ${cfg.ein}–${cfg.efin}  ·  Salida: ${cfg.sin}–${cfg.sfin}`,12,55);

  // KPIs
  const ent=filteredRecs.filter(r=>r.tipo==='entrada').length;
  const sal=filteredRecs.filter(r=>r.tipo==='salida').length;
  const act=employees.filter(e=>e.activo).length;
  const kpis=[{l:'Entradas',v:ent,c:[0,180,100]},{l:'Salidas',v:sal,c:[0,100,200]},{l:'Total',v:filteredRecs.length,c:[60,60,60]},{l:'Empleados',v:act,c:[150,100,0]}];
  kpis.forEach((k,idx)=>{
    const kx=12+idx*47;
    doc.setFillColor(248,250,252);doc.roundedRect(kx,61,43,18,2,2,'F');
    doc.setDrawColor(...k.c);doc.setLineWidth(0.5);doc.roundedRect(kx,61,43,18,2,2,'D');
    doc.setTextColor(...k.c);doc.setFont('helvetica','bold');doc.setFontSize(16);
    doc.text(String(k.v),kx+21.5,70.5,{align:'center'});
    doc.setFont('helvetica','normal');doc.setFontSize(6);doc.setTextColor(100,100,100);
    doc.text(k.l,kx+21.5,75,{align:'center'});
  });

  // Access records table (Nombre, Tipo, Hora Entrada, Hora Salida, Fecha)
  doc.setFillColor(10,10,10);doc.rect(12,83,186,7,'F');
  doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(8.5);
  doc.text(`Registros de Acceso — ${periodLabel} (${filteredRecs.length})`,16,87.5);

  doc.autoTable({
    startY:91,
    head:[['Nombre','DNI','Hora Entrada','Hora Salida','Fecha','Cámara']],
    body:filteredRecs.slice(0,80).map(r=>[
      r.nombre.substring(0,22),r.dni||'—',
      r.tipo==='entrada'?r.hora:'—',
      r.tipo==='salida'?r.hora:'—',
      r.fecha,
      'Cam.'+r.camara
    ]),
    headStyles:{fillColor:[255,26,15],textColor:255,fontStyle:'bold',fontSize:7,cellPadding:2},
    bodyStyles:{fontSize:7,textColor:[30,30,30],cellPadding:2.2},
    alternateRowStyles:{fillColor:[250,250,252]},
    columnStyles:{0:{cellWidth:45},1:{cellWidth:22},2:{cellWidth:25},3:{cellWidth:25},4:{cellWidth:28},5:{cellWidth:20}},
    margin:{left:12,right:12},
    styles:{lineColor:[220,225,230],lineWidth:0.2},
    didParseCell:d=>{
      if(d.column.index===2&&d.cell.raw!=='—') d.cell.styles.textColor=[0,150,80];
      if(d.column.index===3&&d.cell.raw!=='—') d.cell.styles.textColor=[0,100,200];
    }
  });

  // Photo gallery (automatic captures)
  const withFotos=filteredRecs.filter(r=>r.foto).slice(0,30);
  if(withFotos.length>0){
    doc.addPage();let curY=15;
    doc.setFillColor(10,10,10);doc.rect(12,curY,186,7,'F');
    doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(8.5);
    doc.text(`Capturas Automáticas — ${periodLabel} (${withFotos.length})`,16,curY+4.5);
    curY+=10;
    const photoW=44,photoH=33,cols=4,gap=3;let col2=0;
    for(const r of withFotos){
      if(curY+photoH+18>H-15){doc.addPage();curY=15}
      const px=12+col2*(photoW+gap);
      try{
        doc.addImage(r.foto,'JPEG',px,curY,photoW,photoH,undefined,'MEDIUM');
        doc.setFillColor(0,0,0);doc.rect(px,curY+photoH-9,photoW,9,'F');
        doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(5.5);
        doc.text((r.nombre||'').substring(0,16),px+1.5,curY+photoH-5.5);
        doc.setFont('helvetica','normal');doc.setFontSize(5);
        const tipoLabel=r.tipo==='entrada'?'ENTRADA':r.tipo==='salida'?'SALIDA':'DENEGADO';
        doc.text(`${r.hora} · ${tipoLabel}`,px+1.5,curY+photoH-1.5);
        doc.setTextColor(100,100,100);doc.setFontSize(5.5);doc.text(r.fecha||'',px,curY+photoH+4);
      }catch(e){
        doc.setFillColor(240,240,240);doc.rect(px,curY,photoW,photoH,'F');
        doc.setTextColor(150,150,150);doc.setFontSize(6);doc.text('Captura',px+photoW/2,curY+photoH/2,{align:'center'});
      }
      col2++;if(col2>=cols){col2=0;curY+=photoH+15}
    }
  }

  // Footer
  const totalPages=doc.internal.getNumberOfPages();
  for(let p=1;p<=totalPages;p++){
    doc.setPage(p);
    doc.setFillColor(248,250,252);doc.rect(0,H-10,W,10,'F');
    doc.setDrawColor(220,225,230);doc.setLineWidth(0.2);doc.line(0,H-10,W,H-10);
    doc.setTextColor(160,160,160);doc.setFont('helvetica','normal');doc.setFontSize(6);
    doc.text('PlazaVea · BioSec v7 · Documento Confidencial',12,H-3.5);
    doc.text(`Página ${p} / ${totalPages}`,W-12,H-3.5,{align:'right'});
  }
  const suffix=fromD?`_${fromD}_${toD}`:`_${reportPeriod}`;
  doc.save(`PlazaVea_BioSec_v7${suffix}_${now.toISOString().split('T')[0]}.pdf`);
  toast('Reporte PDF generado ✓','ok');
}

/* ══ DRAG & DROP ══ */
function setupDragDrop(){
  const area=$id('img-drop-area');if(!area) return;
  area.addEventListener('dragover',e=>{e.preventDefault();area.style.borderColor='var(--cyan)'});
  area.addEventListener('dragleave',()=>area.style.borderColor='');
  area.addEventListener('drop',e=>{e.preventDefault();area.style.borderColor='';const f=e.dataTransfer.files[0];if(f&&f.type.startsWith('image/')) handleImageUpload(f)});
}

/* ══ INIT ══ */
async function init(){
  try {
  const fill=$id('ls-fill');
  $id('ls-msg').textContent='Abriendo base de datos...';
  await openDB();fill.style.width='15%';
  await loadConfig();fill.style.width='25%';
  document.documentElement.setAttribute('data-theme',cfg.theme||'dark');
  $id('theme-btn').textContent=cfg.theme==='light'?'☀️':'🌙';
  const rawEmps=await dbGetAll('employees');
  const rawRecs=await dbGetAll('records');
  const rawAlerts=await dbGetAll('alerts');
  fill.style.width='45%';
  employees=rawEmps;records=rawRecs;alerts=rawAlerts;
  if(window.faceapi){await loadModels()}
  else{await new Promise(r=>{const chk=setInterval(()=>{if(window.faceapi){clearInterval(chk);r()}},300);setTimeout(()=>{clearInterval(chk);r()},10000)});if(window.faceapi) await loadModels();else{if($id('model-badge')){$id('model-badge').textContent='Sin IA';$id('model-badge').style.color='var(--red)'}}}
  fill.style.width='100%';
  buildCamsGrid();renderAll();updateHorarioUI();setupDragDrop();
  setPeriod('dia',document.querySelector('.pt.active'));
  setTimeout(()=>{
    $id('ls').classList.add('hide');
    setTimeout(()=>{$id('ls').style.display='none';$id('login-screen').style.display='flex';setTimeout(()=>$id('login-pass').focus(),100)},600);
  },500);

  } catch (e) {
    console.error('Error al iniciar BioSec:', e);
    const ls=$id('ls');
    const login=$id('login-screen');
    const shell=$id('main-shell');
    if(ls) ls.style.display='none';
    if(shell) shell.style.display='none';
    if(login) login.style.display='flex';
    setTimeout(()=>{try{toast('El sistema abrió en modo seguro. Revisa consola si algo no carga.','warn')}catch(_){}} ,300);
  }
}
document.addEventListener('DOMContentLoaded',init);
