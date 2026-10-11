import * as SQLite from 'expo-sqlite';
import type {ImportPayload, ModuleRecord, RecurringTemplate, Transaction} from './types';
import {validateTransaction} from './domain';
let database:Promise<SQLite.SQLiteDatabase>|undefined;
const db=()=>database??=SQLite.openDatabaseAsync('wallet.db');
export async function init(){ const d=await db();await d.execAsync(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, entity TEXT NOT NULL, payload TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL DEFAULT 'pending'); CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS conflicts (id TEXT PRIMARY KEY,record_id TEXT NOT NULL, local_payload TEXT NOT NULL,remote_payload TEXT NOT NULL,created_at TEXT NOT NULL);`); }
async function list<T>(entity:string):Promise<T[]>{await init();const rows=await(await db()).getAllAsync<{payload:string,state:string,version:number}>('SELECT payload,state,version FROM records WHERE entity=?',entity);return rows.map(r=>({...JSON.parse(r.payload),syncStatus:r.state,version:r.version}));}
async function save<T extends {id:string}>(entity:string,record:T,markPending=true){await init();await(await db()).runAsync(`INSERT INTO records(id,entity,payload,state) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,state=excluded.state`,record.id,entity,JSON.stringify(record),markPending?'pending':'synced');}
export async function listTransactions(){return (await list<Transaction>('transaction')).sort((a,b)=>(b.date??b.reportingPeriod).localeCompare(a.date??a.reportingPeriod));}
export async function saveTransaction(tx:Transaction){validateTransaction(tx);await save('transaction',{...tx,updatedAt:new Date().toISOString(),syncStatus:'pending'});}
export async function deleteTransaction(id:string){const tx=(await listTransactions()).find(x=>x.id===id);if(tx)await saveTransaction({...tx,deletedAt:new Date().toISOString()});}
export async function restoreTransaction(id:string){const tx=(await listTransactions()).find(x=>x.id===id);if(tx)await saveTransaction({...tx,deletedAt:undefined});}
export async function getSetting(key:string):Promise<string|null>{await init();return (await(await db()).getFirstAsync<{value:string}>('SELECT value FROM settings WHERE key=?',key))?.value??null;}
export async function setSetting(key:string,value:string){await init();await(await db()).runAsync('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',key,value);}
export const getModules=()=>list<ModuleRecord>('module');
export const saveModule=(item:ModuleRecord)=>save('module',item);
export const listTemplates=()=>list<RecurringTemplate>('template');
export const saveTemplate=(item:RecurringTemplate)=>save('template',item);
async function softDelete(entity:string,id:string){const records=await list<{id:string}>(entity),item=records.find(x=>x.id===id);if(item)await save(entity,{...item,deletedAt:new Date().toISOString()} as {id:string});}
export const deleteModule=(id:string)=>softDelete('module',id);
export const deleteTemplate=(id:string)=>softDelete('template',id);
export const getReviewItems=()=>list<Record<string,unknown>>('review');
export const getHistoricalSummaries=()=>list<Record<string,unknown>>('historical');
export const getCategories=async()=> (await list<{id:string;name:string}>('category')).map(x=>x.name);
export async function importData(payload:ImportPayload){
 const {validateImport}=await import('./backup');validateImport(payload);
  const marker='import:'+payload.source.sha256;if(await getSetting(marker))return {imported:0,alreadyImported:true};
  for(const tx of payload.transactions)validateTransaction(tx);
  const d=await db();await d.withExclusiveTransactionAsync(async tx=>{
    const insert=async(entity:string,item:{id:string})=>{await tx.runAsync('INSERT OR IGNORE INTO records(id,entity,payload,state) VALUES(?,?,?,\'pending\')',item.id,entity,JSON.stringify(item));};
    for(const item of payload.transactions)await insert('transaction',item);
    for(const item of payload.modules??[])await insert('module',item);
    for(const name of payload.categories??[])await insert('category',{id:'category:'+name,name} as {id:string});
    for(const [entity,items] of [['historical',payload.historicalSummaries],['review',payload.reviewItems]] as const){for(let i=0;i<(items??[]).length;i++)await insert(entity,{...(typeof items[i]==='object'&&items[i]!==null?items[i] as object:{value:items[i]}),id:`${payload.source.sha256}:${entity}:${i}`});}
    await insert('source',{id:'source:'+payload.source.sha256,...payload.source});
    await tx.runAsync('INSERT INTO settings(key,value) VALUES(?,?)',marker,new Date().toISOString());
  });return {imported:payload.transactions.length,alreadyImported:false};
}
export async function pendingRecords(){await init();return (await db()).getAllAsync<{id:string;entity:string;payload:string;version:number}>('SELECT id,entity,payload,version FROM records WHERE state=\'pending\'');}
export async function acknowledge(id:string,payload:string,version:number){await(await db()).runAsync('UPDATE records SET version=?,state=CASE WHEN payload=? THEN \'synced\' ELSE \'pending\' END WHERE id=?',version,payload,id);}
export async function acceptRemote(record:{id:string;entity:string;payload:unknown;version:number}){const d=await db();await d.withExclusiveTransactionAsync(async tx=>{const local=await tx.getFirstAsync<{state:string}>('SELECT state FROM records WHERE id=?',record.id);if(local&&local.state!=='synced')return;await tx.runAsync('INSERT INTO records(id,entity,payload,version,state) VALUES(?,?,?,?,\'synced\') ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,version=excluded.version,state=excluded.state',record.id,record.entity,JSON.stringify(record.payload),record.version);});}
export async function preserveConflict(id:string,local:string,remote:unknown){const d=await db();await d.runAsync('INSERT INTO conflicts(id,record_id,local_payload,remote_payload,created_at) VALUES(?,?,?,?,?)',`${id}:${Date.now()}`,id,local,JSON.stringify(remote),new Date().toISOString());await d.runAsync('UPDATE records SET state=\'conflict\' WHERE id=? AND payload=?',id,local);}
export async function getConflicts(){await init();return(await db()).getAllAsync<{id:string;record_id:string;local_payload:string;remote_payload:string;created_at:string}>('SELECT * FROM conflicts');}
export const repository={init,listTransactions,saveTransaction,deleteTransaction,restoreTransaction,importData,getModules,getReviewItems,getHistoricalSummaries,getCategories,getSetting,setSetting,listTemplates,saveTemplate,deleteTemplate,saveModule,deleteModule,getConflicts,resolveConflict,exportBackup,restoreBackup,saveTransactionBundle,acceptRemoteBatch};
export async function resolveConflict(conflictId:string,choice:'local'|'remote'){
  await init();const d=await db(),conflict=await d.getFirstAsync<{record_id:string;local_payload:string;remote_payload:string}>('SELECT * FROM conflicts WHERE id=?',conflictId);if(!conflict)throw new Error('Conflict not found');
  const remote=JSON.parse(conflict.remote_payload) as {version:number;payload:unknown;entity:string}|null;
  await d.withExclusiveTransactionAsync(async tx=>{
    const current=await tx.getFirstAsync<{payload:string}>('SELECT payload FROM records WHERE id=?',conflict.record_id);
    if(current?.payload!==conflict.local_payload)throw new Error('Record changed after conflict. Export the conflict and resolve the current version.');
    if(choice==='remote'&&remote)await tx.runAsync('UPDATE records SET payload=?,version=?,state=\'synced\' WHERE id=?',JSON.stringify(remote.payload),remote.version,conflict.record_id);
    else if(choice==='remote')await tx.runAsync('DELETE FROM records WHERE id=?',conflict.record_id);
    else await tx.runAsync('UPDATE records SET version=?,state=\'pending\' WHERE id=?',remote?.version??0,conflict.record_id);
    await tx.runAsync('DELETE FROM conflicts WHERE id=?',conflictId);
  });
}
export async function exportBackup():Promise<import('./types').WalletBackup>{await init();let snapshot:import('./types').WalletBackup|undefined;await(await db()).withExclusiveTransactionAsync(async tx=>{snapshot={backupVersion:1,createdAt:new Date().toISOString(),records:await tx.getAllAsync('SELECT * FROM records'),settings:await tx.getAllAsync('SELECT key,value FROM settings'),conflicts:await tx.getAllAsync('SELECT * FROM conflicts')};});return snapshot!;}
export async function restoreBackup(payload:import('./types').WalletBackup){
  const {validateBackup}=await import('./backup');validateBackup(payload);await init();let restored=0,skipped=0;await(await db()).withExclusiveTransactionAsync(async tx=>{
    for(const row of payload.records){const existing=await tx.getFirstAsync<{payload:string}>('SELECT payload FROM records WHERE id=?',row.id);if(existing){skipped++;if(existing.payload!==row.payload){const id=`backup-review:${row.id}:${payload.createdAt}`,item={id,kind:'backup-merge-conflict',title:'Backup record differs from current record',originalRecord:row,existingPayload:JSON.parse(existing.payload)};await tx.runAsync('INSERT OR IGNORE INTO records(id,entity,payload,state) VALUES(?,\'review\',?,\'pending\')',id,JSON.stringify(item));}continue;}
      await tx.runAsync('INSERT INTO records(id,entity,payload,version,state) VALUES(?,?,?,?,?)',row.id,row.entity,row.payload,row.version,row.state);restored++;
    }
    for(const item of payload.settings)await tx.runAsync('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)',item.key,item.value);
    for(const item of payload.conflicts)await tx.runAsync('INSERT OR IGNORE INTO conflicts(id,record_id,local_payload,remote_payload,created_at) VALUES(?,?,?,?,?)',item.id,item.record_id,item.local_payload,item.remote_payload,item.created_at);
  });return {restored,skipped};
}
export async function saveTransactionBundle(item:Transaction,modules:ModuleRecord[]=[],templates:RecurringTemplate[]=[]){validateTransaction(item);await init();const updated={...item,updatedAt:new Date().toISOString(),syncStatus:'pending'};await(await db()).withExclusiveTransactionAsync(async tx=>{for(const [entity,record] of [['transaction',updated],...modules.map(m=>['module',m]),...templates.map(t=>['template',t])] as [string,{id:string}][])await tx.runAsync('INSERT INTO records(id,entity,payload,state) VALUES(?,?,?,\'pending\') ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,state=\'pending\'',record.id,entity,JSON.stringify(record));});}
export async function acceptRemoteBatch(records:{id:string;entity:string;payload:unknown;version:number}[]){
 await init();await(await db()).withExclusiveTransactionAsync(async tx=>{
  for(const record of records){const local=await tx.getFirstAsync<{state:string}>('SELECT state FROM records WHERE id=?',record.id);if(local&&local.state!=='synced')continue;await tx.runAsync('INSERT INTO records(id,entity,payload,version,state) VALUES(?,?,?,?,\'synced\') ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,version=excluded.version,state=excluded.state',record.id,record.entity,JSON.stringify(record.payload),record.version);}
 });
}
