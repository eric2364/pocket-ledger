import {cloudBackup} from './lib/cloudBackup';
import {listPrivateArchives,summaryRequest} from './lib/cloud';
import {isProtectedSummary,summaryHeaders,summaryPasswordValue} from './summaryAccess';
import {Platform} from 'react-native';
import {acceptRemoteBatch,acknowledge,getSetting,pendingRecords,preserveConflict,setSetting} from './lib/repository';
let active=false;
let running:Promise<{uploaded:number;conflicts:number;pending:number}>|undefined;
export function isHosted(){return active;}
export async function detectHosted(){
  if(Platform.OS!=='web'||!location.hostname.endsWith('.chatgpt.site'))return false;
  try{const response=await fetch('/api/session',{credentials:'same-origin',cache:'no-store'});if(!response.ok)return false;const data=await response.json();active=data.authenticated===true;return active;}catch{return active;}
}
export async function hostedSync(){
  if(running)return running;
  running=perform();try{return await running;}finally{running=undefined;}
}
async function perform(){
  let uploaded=0,conflicts=0;
  const pending=(await pendingRecords()).filter(r=>!isProtectedSummary(r.entity,JSON.parse(r.payload)));
  for(let i=0;i<pending.length;i+=100){const batch=pending.slice(i,i+100);const response=await fetch('/api/sync',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({records:batch.map(r=>({...r,payload:JSON.parse(r.payload)}))})});if(!response.ok)throw new Error('Cloud sync unavailable; records remain saved on your phone.');const data=await response.json();for(const result of data.results){const original=batch.find(r=>r.id===result.id);if(!original)continue;if(result.status==='saved'){await acknowledge(result.id,original.payload,result.version);uploaded++;}else{await preserveConflict(result.id,original.payload,result.remote);conflicts++;}}}
  const since=await getSetting('hosted-checkpoint');let after='',checkpoint='';
  do{
    const params=new URLSearchParams({limit:'500'});if(after)params.set('after',after);if(since)params.set('since',since);if(checkpoint)params.set('until',checkpoint);
    const response=await fetch('/api/records?'+params.toString(),{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw new Error('Cannot download cloud records right now.');
    const data=await response.json();await acceptRemoteBatch(data.records);checkpoint=data.checkpoint||checkpoint;after=data.nextCursor||'';
  }while(after);
  if(checkpoint)await setSetting('hosted-checkpoint',checkpoint);
  return {uploaded,conflicts,pending:(await pendingRecords()).length};
}
export async function archiveHosted(name:string,bytes:Uint8Array){const safe=`${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const response=await fetch('/api/archive?name='+encodeURIComponent(safe),{method:'POST',credentials:'same-origin',body:bytes.slice().buffer});if(!response.ok)throw new Error('Could not save file in private cloud archive.');return response.json();}
export async function listHostedArchives():Promise<{name:string;size:number}[]>{if(!isHosted())return listPrivateArchives();const response=await fetch('/api/archive',{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw new Error('Cannot list archived files.');return (await response.json()).archives;}
export async function downloadHostedArchive(name:string):Promise<Uint8Array>{if(!isHosted())return summaryRequest('archive',{key:name,password:summaryPasswordValue()});const response=await fetch('/api/archive?name='+encodeURIComponent(name),{credentials:'same-origin',cache:'no-store',headers:summaryHeaders()});if(!response.ok)throw new Error('Cannot download archive right now.');return new Uint8Array(await response.arrayBuffer());}
export async function hostedBackup():Promise<Uint8Array>{if(!isHosted())return new TextEncoder().encode(JSON.stringify(cloudBackup((await summaryRequest('backup',{password:summaryPasswordValue()})).records)));const response=await fetch('/api/backup',{credentials:'same-origin',cache:'no-store',headers:summaryHeaders()});if(!response.ok)throw new Error('Cannot download cloud backup right now.');return new Uint8Array(await response.arrayBuffer());}
