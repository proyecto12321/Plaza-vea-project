'use strict';
/* ══ DB ══ */
const DB_NAME='plazavea_biosec_v7';
const DB_VER=1;
let db=null;
let dbFallback=false;
function _lsKey(store){return `${DB_NAME}_${store}`}
function _lsRead(store){try{return JSON.parse(localStorage.getItem(_lsKey(store))||'[]')}catch(e){return []}}
function _lsWrite(store,data){localStorage.setItem(_lsKey(store),JSON.stringify(data))}
function _nextId(arr){return arr.length?Math.max(...arr.map(x=>Number(x.id)||0))+1:1}
function openDB(){return new Promise((resolve)=>{if(!window.indexedDB){dbFallback=true;resolve(null);return}try{const req=indexedDB.open(DB_NAME,DB_VER);req.onupgradeneeded=e=>{const d=e.target.result;['employees','records','alerts','config'].forEach(s=>{if(!d.objectStoreNames.contains(s))d.createObjectStore(s,{keyPath:'id',autoIncrement:s!=='config'})})};req.onsuccess=e=>{db=e.target.result;resolve(db)};req.onerror=()=>{dbFallback=true;resolve(null)};req.onblocked=()=>{dbFallback=true;resolve(null)}}catch(e){dbFallback=true;resolve(null)}})}
function dbGet(store,key){if(dbFallback||!db){const arr=_lsRead(store);return Promise.resolve(arr.find(x=>x.id===key)||null)}return new Promise((resolve)=>{try{const t=db.transaction(store,'readonly');const q=t.objectStore(store).get(key);q.onsuccess=()=>resolve(q.result||null);q.onerror=()=>resolve(null)}catch(e){resolve(null)}})}
function dbGetAll(store){if(dbFallback||!db)return Promise.resolve(_lsRead(store));return new Promise((resolve)=>{try{const t=db.transaction(store,'readonly');const q=t.objectStore(store).getAll();q.onsuccess=()=>resolve(q.result||[]);q.onerror=()=>resolve([])}catch(e){resolve([])}})}
function dbPut(store,obj){if(dbFallback||!db){const arr=_lsRead(store);const i=arr.findIndex(x=>x.id===obj.id);if(i>=0)arr[i]=obj;else arr.push(obj);_lsWrite(store,arr);return Promise.resolve(obj.id)}return new Promise((resolve)=>{try{const t=db.transaction(store,'readwrite');const q=t.objectStore(store).put(obj);q.onsuccess=()=>resolve(q.result);q.onerror=()=>resolve(obj.id)}catch(e){resolve(obj.id)}})}
function dbAdd(store,obj){if(dbFallback||!db){const arr=_lsRead(store);const id=obj.id||_nextId(arr);arr.push({...obj,id});_lsWrite(store,arr);return Promise.resolve(id)}return new Promise((resolve)=>{try{const t=db.transaction(store,'readwrite');const q=t.objectStore(store).add(obj);q.onsuccess=()=>resolve(q.result);q.onerror=()=>resolve(obj.id||Date.now())}catch(e){resolve(obj.id||Date.now())}})}
function dbDelete(store,key){if(dbFallback||!db){_lsWrite(store,_lsRead(store).filter(x=>x.id!==key));return Promise.resolve()}return new Promise((resolve)=>{try{const t=db.transaction(store,'readwrite');const q=t.objectStore(store).delete(key);q.onsuccess=()=>resolve();q.onerror=()=>resolve()}catch(e){resolve()}})}
function dbClear(store){if(dbFallback||!db){_lsWrite(store,[]);return Promise.resolve()}return new Promise((resolve)=>{try{const t=db.transaction(store,'readwrite');const q=t.objectStore(store).clear();q.onsuccess=()=>resolve();q.onerror=()=>resolve()}catch(e){resolve()}})}
/* ══ STATE ══ */
let employees=[],records=[],alerts=[];
let cfg={
  thresh:0.50,reauth:5,samples:8,
  ein:'07:00',efin:'07:30',sin:'18:00',sfin:'18:30',
  alarmStart:'07:00',alarmEnd:'18:30',
  alerta:true,adminPass:'2005',
  brightness:110,contrast:120,saturate:110,sharp:100,
  nightVision:true,autoNV:true,autoEnhance:true,
  theme:'dark'
};
let modelsLoaded=false,faceMatcher=null;
let camStreams={},camLoops={},camClockTimers={},camNVTimers={};
let lastAuth={};
let numCams=1,regFilter='todos';
let deleteId=null,editId=null,editPhotoData=null;
let showInactive=false;
let regStream=null,regInterval=null,regDescriptors=[],regCapCount=0,regSource='cam';
let uploadedImageDescriptors=[],uploadedPhotoData=null;
let alarmActive=false,alarmCtx=null,alarmOscList=[],alarmTimer=null,voiceTimer=null;
let reportPeriod='dia';
let camFx={}; // per-cam effect
const COLORS=['#FF1A0F','#00FFB2','#00AAFF','#FFB800','#A855F7','#EC4899','#06B6D4','#F97316'];
