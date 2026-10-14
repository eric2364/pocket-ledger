import type {ImportPayload, ModuleRecord, RecurringTemplate, Transaction} from './types';
import {validateTransaction} from './domain';
type RecordRow={id:string;entity:string;payload:string;version:number;state:string};
let database:Promise<IDBDatabase>|undefined;
function db(){return database??=new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open('wallet',1);req.onupgradeneeded=()=>{req.result.createObjectStore('records',{keyPath:'id'});req.result.createObjectStore('settings');req.result.createObjectStore('conflicts',{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
const result=<T>(req:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
const done=(tx:IDBTransaction)=>new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??new Error('Storage transaction aborted'));});
async function all<T>(store:string):Promise<T[]>{return result((await db()).transaction(store).objectStore(store).getAll());}
export async function init(){await db();if(navigator.storage?.persist)await navigator.storage.persist().catch(()=>false);}
async function list<T>(entity:string):Promise<T[]>{return(await all<RecordRow>('records')).filter(x=>x.entity===entity).map(r=>({...JSON.parse(r.payload),syncStatus:r.state,version:r.version}));}
async function save<T extends {id:string}>(entity:string,item:T){const tx=(await db()).transaction('records','readwrite'),finished=done(tx),store=tx.objectStore('records');const old=await result<RecordRow|undefined>(store.get(item.id));store.put({id:item.id,entity,payload:JSON.stringify(item),version:old?.version??0,state:'pending'});await finished;}
export async function listTransactions(){return(await list<Transaction>('transaction')).sort((a,b)=>(b.date??b.reportingPeriod).localeCompare(a.date??a.reportingPeriod));}
export async function saveTransaction(item:Transaction){validateTransaction(item);await save('transaction',{...item,updatedAt:new Date().toISOString(),syncStatus:'pending'});}
export async function deleteTransaction(id:string){const item=(await listTransactions()).find(x=>x.id===id);if(item)await saveTransaction({...item,deletedAt:new Date().toISOString()});}
export async function restoreTransaction(id:string){const item=(await listTransactions()).find(x=>x.id===id);if(item)await saveTransaction({...item,deletedAt:undefined});}
export async function getSetting(key:string):Promise<string|null>{return(await result<string|undefined>((await db()).transaction('settings').objectStore('settings').get(key)))??null;}
export async function setSetting(key:string,value:string){const tx=(await db()).transaction('settings','readwrite'),finished=done(tx);tx.objectStore('settings').put(value,key);await finished;}
export const getModules=()=>list<ModuleRecord>('module');
export const saveModule=(item:ModuleRecord)=>save('module',item);
export const listTemplates=()=>list<RecurringTemplate>('template');
export const saveTemplate=(item:RecurringTemplate)=>save('template',item);
async function softDelete(entity:string,id:string){const item=(await list<{id:string}>(entity)).find(x=>x.id===id);if(item)await save(entity,{...item,deletedAt:new Date().toISOString()} as {id:string});}
export const deleteModule=(id:string)=>softDelete('module',id);
export const deleteTemplate=(id:string)=>softDelete('template',id);
export const getReviewItems=()=>list<Record<string,unknown>>('review');
export const getHistoricalSummaries=()=>list<Record<string,unknown>>('historical');
export const getCategories=async()=> (await list<{id:string;name:string}>('category')).map(x=>x.name);
export async function importData(payload:ImportPayload){
 const {validateImport}=await import('./backup');validateImport(payload);
 for(const item of payload.transactions)validateTransaction(item);
 const tx=(await db()).transaction(['records','settings'],'readwrite'),finished=done(tx),settings=tx.objectStore('settings'),records=tx.objectStore('records'),marker='import:'+payload.source.sha256;
 if(await result(settings.get(marker))){await finished;return {imported:0,alreadyImported:true};}
 const items:[string,{id:string}][]=[];
 for(const item of payload.transactions)items.push(['transaction',item]);
 for(const item of payload.modules??[])items.push(['module',item]);
 for(const name of payload.categories??[])items.push(['category',{id:'category:'+name,name} as {id:string}]);
 for(const [entity,values] of [['historical',payload.historicalSummaries],['review',payload.reviewItems]] as const)for(let i=0;i<(values??[]).length;i++)items.push([entity,{...(typeof values[i]==='object'&&values[i]!==null?values[i] as object:{value:values[i]}),id:`${payload.source.sha256}:${entity}:${i}`}]);
 items.push(['source',{id:'source:'+payload.source.sha256,...payload.source}]);
 // Keep existing edits when an overlapping source has the same stable record IDs.
 for(const [entity,item] of items){const req=records.get(item.id);req.onsuccess=()=>{if(!req.result)records.put({id:item.id,entity,payload:JSON.stringify(item),version:0,state:'pending'});};}
 settings.put(new Date().toISOString(),marker);await finished;return {imported:payload.transactions.length,alreadyImported:false};
}
export async function pendingRecords(){return(await all<RecordRow>('records')).filter(x=>x.state==='pending');}
export async function acknowledge(id:string,payload:string,version:number){const tx=(await db()).transaction('records','readwrite'),finished=done(tx),store=tx.objectStore('records'),row=await result<RecordRow|undefined>(store.get(id));if(row)store.put({...row,version,state:row.payload===payload?'synced':'pending'});await finished;}
export async function acceptRemote(record:{id:string;entity:string;payload:unknown;version:number}){const tx=(await db()).transaction('records','readwrite'),finished=done(tx),store=tx.objectStore('records'),row=await result<RecordRow|undefined>(store.get(record.id));if(!row||(row.state==='synced'&&record.version>=row.version))store.put({...record,payload:JSON.stringify(record.payload),state:'synced'});await finished;}
export async function preserveConflict(id:string,local:string,remote:unknown){const tx=(await db()).transaction(['records','conflicts'],'readwrite'),finished=done(tx),store=tx.objectStore('records'),row=await result<RecordRow|undefined>(store.get(id));tx.objectStore('conflicts').put({id:`${id}:${Date.now()}`,record_id:id,local_payload:local,remote_payload:JSON.stringify(remote),created_at:new Date().toISOString()});if(row?.payload===local)store.put({...row,state:'conflict'});await finished;}
export async function getConflicts(){return all<{id:string;record_id:string;local_payload:string;remote_payload:string;created_at:string}>('conflicts');}
export const repository={init,listTransactions,saveTransaction,deleteTransaction,restoreTransaction,importData,getModules,getReviewItems,getHistoricalSummaries,getCategories,getSetting,setSetting,listTemplates,saveTemplate,deleteTemplate,saveModule,deleteModule,getConflicts,resolveConflict,exportBackup,restoreBackup,saveTransactionBundle,acceptRemoteBatch};
export async function resolveConflict(conflictId:string,choice:'local'|'remote'){
  const tx=(await db()).transaction(['records','conflicts'],'readwrite'),finished=done(tx),conflicts=tx.objectStore('conflicts'),records=tx.objectStore('records');
  const conflict=await result<{record_id:string;local_payload:string;remote_payload:string}|undefined>(conflicts.get(conflictId));if(!conflict){tx.abort();await finished.catch(()=>{});throw new Error('Conflict not found');}
  const current=await result<RecordRow|undefined>(records.get(conflict.record_id));if(current?.payload!==conflict.local_payload){tx.abort();await finished.catch(()=>{});throw new Error('Record changed after conflict. Export the conflict and resolve the current version.');}
  const remote=JSON.parse(conflict.remote_payload) as {version:number;payload:unknown;entity:string}|null;
  if(choice==='remote'&&remote)records.put({id:conflict.record_id,entity:remote.entity,payload:JSON.stringify(remote.payload),version:remote.version,state:'synced'});
  else if(choice==='remote')records.delete(conflict.record_id);
  else if(current)records.put({...current,version:remote?.version??0,state:'pending'});
  conflicts.delete(conflictId);await finished;
}
export async function exportBackup():Promise<import('./types').WalletBackup>{const tx=(await db()).transaction(['records','settings','conflicts']),finished=done(tx),settings=tx.objectStore('settings');const [records,keys,values,conflicts]=await Promise.all([result<import('./types').WalletBackup['records']>(tx.objectStore('records').getAll()),result(settings.getAllKeys()),result<string[]>(settings.getAll()),result<import('./types').WalletBackup['conflicts']>(tx.objectStore('conflicts').getAll())]);await finished;return {backupVersion:1,createdAt:new Date().toISOString(),records,settings:keys.map((key,i)=>({key:String(key),value:values[i]})),conflicts};}
export async function restoreBackup(payload:import('./types').WalletBackup){
 const {validateBackup}=await import('./backup');validateBackup(payload);const tx=(await db()).transaction(['records','settings','conflicts'],'readwrite'),finished=done(tx),records=tx.objectStore('records'),settings=tx.objectStore('settings'),conflicts=tx.objectStore('conflicts');let restored=0,skipped=0;
 for(const row of payload.records){const req=records.get(row.id);req.onsuccess=()=>{const existing=req.result;if(existing){skipped++;if(existing.payload!==row.payload){const id=`backup-review:${row.id}:${payload.createdAt}`;records.put({id,entity:'review',version:0,state:'pending',payload:JSON.stringify({id,kind:'backup-merge-conflict',title:'Backup record differs from current record',originalRecord:row,existingPayload:JSON.parse(existing.payload)})});}}else{records.put({...row,version:0,state:row.state==='conflict'?'conflict':'pending'});restored++;}};}
 for(const item of payload.settings){const req=settings.get(item.key);req.onsuccess=()=>{if(req.result===undefined)settings.put(item.value,item.key);};}
 for(const item of payload.conflicts){const req=conflicts.get(item.id);req.onsuccess=()=>{if(!req.result)conflicts.put(item);};}
 await finished;return {restored,skipped};
}
export async function saveTransactionBundle(item:Transaction,modules:ModuleRecord[]=[],templates:RecurringTemplate[]=[]){validateTransaction(item);const tx=(await db()).transaction('records','readwrite'),finished=done(tx),store=tx.objectStore('records'),updated={...item,updatedAt:new Date().toISOString(),syncStatus:'pending'};for(const [entity,record] of [['transaction',updated],...modules.map(m=>['module',m]),...templates.map(t=>['template',t])] as [string,{id:string}][]){const req=store.get(record.id);req.onsuccess=()=>store.put({id:record.id,entity,payload:JSON.stringify(record),version:req.result?.version??0,state:'pending'});}await finished;}
export async function acceptRemoteBatch(records:{id:string;entity:string;payload:unknown;version:number}[]){
 const tx=(await db()).transaction('records','readwrite'),finished=done(tx),store=tx.objectStore('records');
 for(const record of records){const req=store.get(record.id);req.onsuccess=()=>{if(!req.result||(req.result.state==='synced'&&record.version>=req.result.version))store.put({...record,payload:JSON.stringify(record.payload),state:'synced'});};}
 await finished;
}

/** Remove clear summary copies retained by older app versions. */
export async function redactSummaryCache(){
 const {isProtectedSummary}=await import('../summaryAccess');
 const snapshot=await exportBackup();const tx=(await db()).transaction(['records','conflicts'],'readwrite'),finished=done(tx);
 for(const row of snapshot.records){const p=JSON.parse(row.payload);if(row.state==='synced'&&isProtectedSummary(row.entity,p))tx.objectStore('records').put({...row,payload:JSON.stringify({id:row.id,lockedSummary:true}),state:'synced'});}
 await finished;
}
