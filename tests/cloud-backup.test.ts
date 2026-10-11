import test from 'node:test';
import assert from 'node:assert/strict';
import {cloudBackup} from '../src/lib/cloudBackup';
import {validateBackup} from '../src/lib/backup';

test('decrypted cloud backup is a restorable versioned backup preserving source payloads',()=>{
  const payload={id:'summary-test',type:'saving',fields:{formula:'=SUM(A1:A2)',value:'synthetic'},unknownOriginal:{a:[1,null,'原文']}};
  const backup=cloudBackup([{id:payload.id,entity:'module',payload,version:3}]);
  validateBackup(backup);assert.equal(backup.backupVersion,1);assert.deepEqual(JSON.parse(backup.records[0].payload),payload);assert.equal(backup.records[0].version,3);assert.equal(backup.records[0].state,'synced');assert.deepEqual(backup.settings,[]);assert.deepEqual(backup.conflicts,[]);
});
