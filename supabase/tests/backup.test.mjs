import test from 'node:test';
import assert from 'node:assert/strict';
import {cloudBackup} from '../functions/wallet-summary/backup.mjs';
test('cloud backup preserves exact payload and supplies the restore schema',()=>{
 const source=[{id:'synthetic',entity:'module',version:2,payload:{id:'synthetic',type:'saving',fields:{amount:12345}}}];
 const backup=cloudBackup(source,[{name:'synthetic-original.xlsx'}],'2026-01-01T00:00:00.000Z');
 assert.equal(backup.backupVersion,1);assert.equal(backup.createdAt,'2026-01-01T00:00:00.000Z');
 assert.deepEqual(JSON.parse(backup.records[0].payload),source[0].payload);
 assert.equal(backup.records[0].state,'synced');assert.equal(backup.records[0].version,2);
 assert.deepEqual(backup.settings,[]);assert.deepEqual(backup.conflicts,[]);
 assert.deepEqual(backup.archives,[{name:'synthetic-original.xlsx'}]);
 assert.equal(typeof source[0].payload,'object');
});
