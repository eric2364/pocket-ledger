import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {normalizeCategory,normalizeCategories} from '../src/lib/categories';
import {normalizeCategoryRecord,report,exportTransactionsCsv} from '../src/lib/domain';
import {readFavorites,validateFavorites} from '../src/lib/quickAdd';
import {repository,acceptRemote,acceptRemoteBatch,pendingRecords,acknowledge,preserveConflict} from '../src/lib/repository.web';
import type {Transaction} from '../src/lib/types';
const transaction=(id:string,category:string,amountMinor=100):Transaction=>({id,category,date:'2026-09-01',reportingPeriod:'2026-09',kind:'expense',description:'Synthetic',account:'Cash',currency:'HKD',amountMinor,personalShareMinor:amountMinor,createdAt:'2026-09-01',updatedAt:'2026-09-01'});
test('category case variants merge into one uppercase group without changing exact money',()=>{
 const rows=[transaction('a','Food',101),transaction('b',' food ',202),transaction('c','FOOD',303)];
 assert.deepEqual(normalizeCategories(['Food',' food ','FOOD','Coffee','coffee',' ']),['COFFEE','FOOD']);
 assert.equal(normalizeCategory('  食物 '),'食物');
 assert.deepEqual(report(rows).HKD.categories,{FOOD:606});assert.equal(report(rows).HKD.expenseMinor,606);
 assert.equal(rows[0].category,'Food');
 const normalized=normalizeCategoryRecord(rows[1]);assert.equal(normalized.category,'FOOD');assert.equal(normalized.originalCategory,' food ');
 assert.equal(normalizeCategoryRecord({...normalized,category:'food'}).originalCategory,' food ');
});
test('CSV exports canonical category plus exact original spelling',()=>{
 const csv=exportTransactionsCsv([transaction('csv',' Food ')]);const lines=csv.trimEnd().split('\r\n');const keys=lines[0].replace(/^\uFEFF/,'').split(',');const values=lines[1].split(',');
 assert.equal(values[keys.indexOf('category')],'FOOD');assert.equal(values[keys.indexOf('originalCategory')],' Food ');assert.equal(values[keys.indexOf('amountMinor')],'100');
});
test('read-time canonicalization leaves raw cloud payloads, versions and sync queues untouched',async()=>{
 const raw=transaction('category-existing',' food ');
 await acceptRemote({id:raw.id,entity:'transaction',payload:raw,version:5});
 await acceptRemoteBatch([{id:'category:Food',entity:'category',payload:{id:'category:Food',name:'Food'},version:1},{id:'category:food',entity:'category',payload:{id:'category:food',name:'food'},version:1}]);
 await acceptRemote({id:'category-template',entity:'template',version:2,payload:{id:'category-template',title:'Synthetic recurring',category:' food ',kind:'expense',account:'Cash',currency:'HKD',amountMinor:100,frequency:'monthly',nextDate:'2026-10-01'}});
 const before=await repository.exportBackup();const view=(await repository.listTransactions()).find(row=>row.id===raw.id)!;
 assert.equal(view.category,'FOOD');assert.equal(view.originalCategory,' food ');assert.equal(view.version,5);assert.equal(view.syncStatus,'synced');
 assert.deepEqual(await repository.getCategories(),['FOOD']);assert.equal((await repository.listTemplates())[0].category,'FOOD');
 const after=await repository.exportBackup();assert.deepEqual(after.records,before.records);assert.equal((await pendingRecords()).length,0);
 assert.equal(JSON.parse(after.records.find(row=>row.id===raw.id)!.payload).category,' food ');
});
test('edited canonical records preserve source spelling through cloud acknowledgement and conflicts',async()=>{
 const view=(await repository.listTransactions()).find(row=>row.id==='category-existing')!;
 await repository.saveTransaction({...view,description:'Synthetic edited'});
 const row=(await pendingRecords()).find(row=>row.id===view.id)!;assert.equal(JSON.parse(row.payload).category,'FOOD');assert.equal(JSON.parse(row.payload).originalCategory,' food ');assert.equal(row.version,5);
 await acknowledge(row.id,row.payload,6);assert.equal((await repository.listTransactions()).find(tx=>tx.id===row.id)!.syncStatus,'synced');
 await repository.saveTransaction({...view,description:'Synthetic newer edit'});const next=(await pendingRecords()).find(tx=>tx.id===row.id)!;
 await preserveConflict(next.id,next.payload,{id:next.id,entity:'transaction',version:7,payload:transaction(next.id,'Food',777)});
 const conflict=(await repository.getConflicts()).find(c=>c.record_id===row.id)!;
 assert.equal(JSON.parse(conflict.local_payload).originalCategory,' food ');assert.equal(JSON.parse(conflict.remote_payload).payload.category,'Food');assert.equal(JSON.parse(conflict.remote_payload).payload.amountMinor,777);
});
test('quick favorites and template saves use uppercase without changing labels or shortcut IDs',async()=>{
 const favorites=validateFavorites([{id:'synthetic-favorite',label:'My lunch',category:' lunch ',kind:'expense'}]);assert.equal(favorites[0].category,'LUNCH');assert.equal(favorites[0].label,'My lunch');assert.equal(favorites[0].id,'synthetic-favorite');assert.deepEqual(readFavorites(JSON.stringify(favorites)),favorites);
 await repository.saveTemplate({id:'category-template-new',title:'Synthetic recurring',category:' lunch ',kind:'expense',account:'Cash',currency:'HKD',amountMinor:100,frequency:'monthly',nextDate:'2026-10-01'});
 const row=(await pendingRecords()).find(row=>row.id==='category-template-new')!;assert.equal(JSON.parse(row.payload).category,'LUNCH');assert.equal(JSON.parse(row.payload).originalCategory,' lunch ');
});
