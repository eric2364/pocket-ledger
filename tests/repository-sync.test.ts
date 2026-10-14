import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {repository,acceptRemote,acceptRemoteBatch,pendingRecords} from '../src/lib/repository.web';
test('a delayed lower-version cloud read cannot overwrite a confirmed newer record',async()=>{
 await acceptRemote({id:'synthetic-versioned',entity:'module',version:3,payload:{id:'synthetic-versioned',type:'project',title:'newer'}});
 await acceptRemote({id:'synthetic-versioned',entity:'module',version:2,payload:{id:'synthetic-versioned',type:'project',title:'older'}});
 await acceptRemoteBatch([{id:'synthetic-versioned',entity:'module',version:1,payload:{id:'synthetic-versioned',type:'project',title:'oldest'}}]);
 const record=(await repository.getModules()).find(row=>row.id==='synthetic-versioned')!;assert.equal(record.title,'newer');assert.equal((record as any).version,3);
});
test('newly restored synced backup rows are queued for cloud save while existing records stay unchanged',async()=>{
 const backup={backupVersion:1 as const,createdAt:'2026-01-01T00:00:00Z',records:[{id:'synthetic-restored',entity:'module',payload:JSON.stringify({id:'synthetic-restored',type:'project',title:'restored'}),version:9,state:'synced'}],settings:[],conflicts:[]};
 await repository.restoreBackup(backup);const row=(await pendingRecords()).find(row=>row.id==='synthetic-restored')!;assert.equal(row.version,0);assert.equal(row.state,'pending');assert.equal(JSON.parse(row.payload).title,'restored');
 await repository.restoreBackup({...backup,records:[{...backup.records[0],payload:JSON.stringify({id:'synthetic-restored',type:'project',title:'different'})}]});
 assert.equal((await repository.getModules()).find(row=>row.id==='synthetic-restored')!.title,'restored');
});
