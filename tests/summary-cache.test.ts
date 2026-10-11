import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {repository,acknowledge,pendingRecords,redactSummaryCache} from '../src/lib/repository.web';
import {isProtectedSummary,lockSummary,summaryHeaders} from '../src/summaryAccess';
test('legacy summary cache is redacted while unsynchronized edits remain recoverable and hidden',async()=>{
 await repository.saveModule({id:'old-summary',type:'saving',title:'Synthetic summary',fields:{amount:123}});
 const row=(await pendingRecords()).find(r=>r.id==='old-summary')!;await acknowledge(row.id,row.payload,1);
 await repository.saveModule({id:'unsynced-summary',type:'saving',title:'Synthetic edited summary',fields:{amount:456}});
 await redactSummaryCache();const rows=await repository.getModules();const synced=rows.find(r=>r.id==='old-summary')!;
 assert.equal((synced as any).lockedSummary,true);assert.equal(synced.fields,undefined);
 assert.equal(rows.find(r=>r.id==='unsynced-summary')!.fields.amount,456);
 assert.equal(rows.filter(r=>!isProtectedSummary('module',r)).length,0);
 assert.equal((await pendingRecords()).filter(r=>!isProtectedSummary(r.entity,JSON.parse(r.payload))).length,0);
});
test('locked summary cannot supply archive passwords and annual review aliases are protected',()=>{
 lockSummary();assert.throws(()=>summaryHeaders(),/Unlock Summary/);
 assert.equal(isProtectedSummary('review',{sourceSheet:'Saving',reconciliation:{amount:123}}),true);
 assert.equal(isProtectedSummary('review',{originalRecord:{entity:'historical',payload:{value:123}}}),true);
 assert.equal(isProtectedSummary('module',{type:'card',fields:{amount:123}}),false);
});
