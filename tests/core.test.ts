import assert from 'node:assert/strict';
import test from 'node:test';
import {parseMoney,formatMoney,report,rowsToCsv,validateTransaction} from '../src/lib/domain';
import type {Transaction} from '../src/lib/types';
const transaction=(override:Partial<Transaction>={}):Transaction=>({id:'test',date:'2026-10-11',reportingPeriod:'2026-10',kind:'expense',category:'Food',description:'Lunch',account:'Card',currency:'HKD',amountMinor:12000,personalShareMinor:6000,createdAt:'2026-10-11T00:00:00Z',updatedAt:'2026-10-11T00:00:00Z',...override});
test('money parsing preserves exact minor units and currency precision',()=>{assert.equal(parseMoney('0.29'),29);assert.equal(parseMoney('1,234.56'),123456);assert.equal(parseMoney('-0.01'),-1);assert.equal(parseMoney('150','JPY'),150);assert.equal(formatMoney(-29),'-0.29');assert.throws(()=>parseMoney('1.001'));assert.throws(()=>parseMoney('0.5','JPY'));assert.throws(()=>parseMoney('900719925474099100'));});
test('one shared purchase counts personal share; transfers and card settlement do not count again',()=>{const totals=report([transaction(),transaction({id:'2',kind:'card_payment'}),transaction({id:'3',kind:'transfer'}),transaction({id:'4',kind:'income',personalShareMinor:20000}),transaction({id:'5',deletedAt:'2026-10-11'})]);assert.equal(totals.HKD.expenseMinor,6000);assert.equal(totals.HKD.incomeMinor,20000);assert.equal(totals.HKD.netMinor,14000);});
test('reports keep currencies distinct and support annual historical adjustments',()=>{const totals=report([transaction({currency:'JPY',amountMinor:1000,personalShareMinor:1000}),transaction({date:null,reportingPeriod:'2026',kind:'adjustment',personalShareMinor:-100}),transaction({reportingPeriod:'2025-10'})],'2026');assert.equal(totals.JPY.expenseMinor,1000);assert.equal(totals.HKD.expenseMinor,100);validateTransaction(transaction({date:null,reportingPeriod:'2026',kind:'adjustment'}));});
test('CSV preserves Chinese and newlines, escapes quotes, neutralizes formulas and keeps numeric negatives',()=>{const csv=rowsToCsv([{description:'午餐, "飯"\n食物',formula:' =SUM(A1)',negative:-123,evil:'\t@cmd'}]);assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"午餐, ""飯""\n食物"'));assert.ok(csv.includes("' =SUM(A1)"));assert.ok(csv.includes(',-123,'));assert.ok(csv.includes("'\t@cmd"));});
test('transaction validation rejects fractional minor units and invalid reporting period',()=>{assert.throws(()=>validateTransaction(transaction({amountMinor:1.2})));assert.throws(()=>validateTransaction(transaction({reportingPeriod:'2026-13'})));assert.throws(()=>validateTransaction(transaction({date:'2026-02-31'})));assert.throws(()=>validateTransaction(transaction({amountMinor:Number.MAX_SAFE_INTEGER+1})));});

test('IndexedDB import, queue acknowledgement, conflict resolution and backup restore preserve records',async()=>{
 const fake=await import('fake-indexeddb');Object.assign(globalThis,{indexedDB:fake.indexedDB,IDBKeyRange:fake.IDBKeyRange});
 const repo=await import('../src/lib/repository.web');
 const payload={schemaVersion:1 as const,source:{filename:'test.xlsx',sha256:'test-hash'},transactions:[transaction()],categories:['Food'],modules:[{id:'insurance',type:'insurance',title:'Policy',fields:{premium:100}}],historicalSummaries:[{annual:100}],reviewItems:[{reason:'Undated'}]};
 assert.equal((await repo.importData(payload)).imported,1);
 assert.equal((await repo.importData(payload)).alreadyImported,true);
 assert.equal((await repo.listTransactions()).length,1);
 assert.equal((await repo.getModules()).length,1);
 const queued=(await repo.pendingRecords()).find(x=>x.id==='test')!;
 await repo.saveTransaction(transaction({description:'Edited during sync'}));
 await repo.acknowledge('test',queued.payload,1);
 assert.equal((await repo.pendingRecords()).find(x=>x.id==='test')!.version,1);
 await repo.acceptRemote({id:'test',entity:'transaction',payload:transaction({description:'Old remote'}),version:1});
 assert.equal((await repo.listTransactions())[0].description,'Edited during sync');
 const current=(await repo.pendingRecords()).find(x=>x.id==='test')!;
 await repo.preserveConflict('test',current.payload,{id:'test',entity:'transaction',payload:transaction({description:'Other device'}),version:2});
 const conflict=(await repo.getConflicts())[0];assert.equal((await repo.listTransactions())[0].syncStatus,'conflict');
 await repo.resolveConflict(conflict.id,'local');assert.equal((await repo.pendingRecords()).find(x=>x.id==='test')!.version,2);assert.equal((await repo.getConflicts()).length,0);
 const retryPayload=(await repo.pendingRecords()).find(x=>x.id==='test')!.payload;await repo.acknowledge('test',retryPayload,3);await repo.acknowledge('test',retryPayload,3);assert.equal((await repo.listTransactions()).filter(x=>x.id==='test').length,1);assert.equal((await repo.listTransactions())[0].syncStatus,'synced');
 await repo.deleteTransaction('test');assert.ok((await repo.listTransactions())[0].deletedAt);
 const backup=await repo.exportBackup();assert.ok(backup.records.find(x=>x.id==='test')!.payload.includes('deletedAt'));
 await repo.restoreTransaction('test');assert.equal((await repo.listTransactions())[0].deletedAt,undefined);
 const merged=await repo.restoreBackup(backup);assert.ok(merged.skipped>0);assert.equal((await repo.listTransactions())[0].deletedAt,undefined);assert.ok((await repo.getReviewItems()).some(x=>x.kind==='backup-merge-conflict'));
 // Empty-device restoration restores all original deleted records, categories and modules.
 const opened=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open('wallet',1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
 const clear=opened.transaction(['records','settings','conflicts'],'readwrite');for(const name of ['records','settings','conflicts'])clear.objectStore(name).clear();await new Promise<void>((resolve,reject)=>{clear.oncomplete=()=>resolve();clear.onerror=()=>reject(clear.error);});opened.close();
 assert.equal((await repo.restoreBackup(backup)).restored,backup.records.length);assert.ok((await repo.listTransactions())[0].deletedAt);assert.equal((await repo.getCategories())[0],'FOOD');
 await assert.rejects(()=>repo.restoreBackup({...backup,records:[{...backup.records[0],payload:'invalid json'}]}));
 await repo.saveTransactionBundle(transaction({id:'bundle'}),[{id:'bundle-debt',type:'debt',title:'Friend',fields:{remainingMinor:6000}}],[{id:'bundle-template',title:'Lunch',kind:'expense',category:'Food',account:'Cash',currency:'HKD',amountMinor:12000,frequency:'monthly',nextDate:'2026-11-11'}]);assert.equal((await repo.listTemplates())[0].nextDate,'2026-11-11');assert.ok((await repo.listTransactions()).some(x=>x.id==='bundle'));assert.ok((await repo.getModules()).some(x=>x.id==='bundle-debt'));
});

test('HKD consolidation uses stored equivalents and reports unconverted entries',async()=>{
 const {reportHkd}=await import('../src/lib/domain');
 const totals=reportHkd([transaction({amountMinor:1,personalShareMinor:1}),transaction({id:'jpy',currency:'JPY',amountMinor:2,personalShareMinor:1,hkdAmountMinor:1}),transaction({id:'usd',currency:'USD',amountMinor:100,personalShareMinor:100}),transaction({id:'transfer',kind:'transfer',currency:'USD'})]);
 assert.equal(totals.expenseMinor,2);assert.equal(totals.unconvertedCount,1);
 const refunded=reportHkd([transaction({currency:'JPY',amountMinor:-2,personalShareMinor:-1,hkdAmountMinor:-1,sourceSheet:'old',sourceReference:'A1'})]);assert.equal(refunded.expenseMinor,-1);
});
test('validation preserves imported refunds and rejects invalid amounts and missing categories',()=>{
 validateTransaction(transaction({amountMinor:-100,personalShareMinor:-50,sourceSheet:'2021_01',sourceReference:'A1'}));
 assert.throws(()=>validateTransaction(transaction({amountMinor:-100,personalShareMinor:-50})));
 assert.throws(()=>validateTransaction(transaction({category:' '})));assert.throws(()=>validateTransaction(transaction({account:''})));
 assert.throws(()=>validateTransaction(transaction({personalShareMinor:12001})));assert.throws(()=>validateTransaction(transaction({amountMinor:0,personalShareMinor:0,hkdAmountMinor:1})));
 assert.equal(parseMoney('90071992547409.91'),Number.MAX_SAFE_INTEGER);assert.throws(()=>parseMoney('90071992547409.92'));
 assert.throws(()=>report([transaction({amountMinor:Number.MAX_SAFE_INTEGER,personalShareMinor:Number.MAX_SAFE_INTEGER}),transaction()]));
});
test('malformed imports and backups fail validation before changing local records',async()=>{
 const repo=await import('../src/lib/repository.web');const original=await repo.exportBackup();
 const payload={schemaVersion:1 as const,source:{filename:'bad.xlsx',sha256:'bad-source'},transactions:[transaction({id:'bad-import'})],categories:['Food'],modules:[{id:'bad-module',type:'project',title:'Bad',fields:null as any}],historicalSummaries:[],reviewItems:[]};
 await assert.rejects(()=>repo.importData(payload));assert.equal((await repo.listTransactions()).some(x=>x.id==='bad-import'),false);
 await assert.rejects(()=>repo.importData({...payload,modules:[],transactions:[transaction({id:'dup'}),transaction({id:'dup'})]}));
 await assert.rejects(()=>repo.restoreBackup({...original,records:[...original.records,{id:'bad',entity:'transaction',payload:JSON.stringify(transaction({id:'different'})),version:0,state:'pending'}]}));
 assert.equal((await repo.exportBackup()).records.length,original.records.length);
});

test('bulk cloud download atomically preserves pending and conflicting local edits',async()=>{
 const repo=await import('../src/lib/repository.web');
 await repo.saveTransaction(transaction({id:'bulk-pending',description:'My unsynced edit'}));
 await repo.saveTransaction(transaction({id:'bulk-conflict',description:'My conflicting edit'}));
 const conflicted=(await repo.pendingRecords()).find(x=>x.id==='bulk-conflict')!;await repo.preserveConflict('bulk-conflict',conflicted.payload,{payload:transaction({id:'bulk-conflict',description:'Cloud edit'}),version:4,entity:'transaction'});
 const batch=Array.from({length:500},(_,i)=>({id:`bulk-${i}`,entity:'transaction',payload:transaction({id:`bulk-${i}`,description:`Cloud row ${i}`}),version:1}));
 await repo.acceptRemoteBatch([...batch,{id:'bulk-pending',entity:'transaction',payload:transaction({id:'bulk-pending',description:'Stale cloud'}),version:9},{id:'bulk-conflict',entity:'transaction',payload:transaction({id:'bulk-conflict',description:'Cloud replacement'}),version:5}]);
 const rows=await repo.listTransactions();assert.equal(rows.filter(x=>/^bulk-\d+$/.test(x.id)).length,500);assert.equal(rows.find(x=>x.id==='bulk-pending')!.description,'My unsynced edit');assert.equal(rows.find(x=>x.id==='bulk-conflict')!.description,'My conflicting edit');assert.equal(rows.find(x=>x.id==='bulk-conflict')!.syncStatus,'conflict');
 await repo.acceptRemoteBatch([{id:'bulk-0',entity:'transaction',payload:transaction({id:'bulk-0',description:'Updated cloud'}),version:2}]);assert.equal((await repo.listTransactions()).find(x=>x.id==='bulk-0')!.description,'Updated cloud');
});

test('refund CSV exports exact negative decimal money as numbers while protecting user text',async()=>{
 const {exportTransactionsCsv}=await import('../src/lib/domain');
 const csv=exportTransactionsCsv([transaction({amountMinor:-1001,personalShareMinor:-501,description:'-danger',notes:'-2+SUM(A1)',sourceSheet:'2021_01',sourceReference:'A1'})]);
 const lines=csv.split('\r\n'),columns=lines[0].replace(/^\uFEFF/,'').split(','),values=lines[1].split(',');
 assert.equal(values[columns.indexOf('originalAmount')],'-10.01');assert.equal(values[columns.indexOf('personalShare')],'-5.01');assert.equal(values[columns.indexOf('description')],"'-danger");assert.equal(values[columns.indexOf('notes')],"'-2+SUM(A1)");
 const boundary=exportTransactionsCsv([transaction({amountMinor:-Number.MAX_SAFE_INTEGER,personalShareMinor:-Number.MAX_SAFE_INTEGER,sourceSheet:'old',sourceReference:'A1'})]);assert.ok(boundary.includes(',-90071992547409.91,'));assert.ok(!boundary.includes("'-90071992547409.91"));
});
