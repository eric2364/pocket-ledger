import test from 'node:test';
import assert from 'node:assert/strict';
import {exportLedgerCsv,importTransactionsCsv,parseCsv} from '../src/lib/csv';
import {exportTransactionsCsv} from '../src/lib/domain';
import type {Transaction,WalletBackup} from '../src/lib/types';
const tx:Transaction={id:'one',date:null,reportingPeriod:'2026',kind:'adjustment',category:'TEST',description:'=漢字,"test"\nnext',account:'Cash',currency:'HKD',amountMinor:-1001,personalShareMinor:-501,notes:'\t@formula',createdAt:'',updatedAt:''};
test('transaction CSV imports quoted Unicode and exact signed amounts',()=>{
 assert.deepEqual(importTransactionsCsv(exportTransactionsCsv([tx])),[tx]);
});
test('complete snapshot preserves original text, supporting records, versions, and tombstones',()=>{
 const deleted={...tx,deletedAt:'2026-10-15T00:00:00Z',description:"'=literal"};
 const backup:WalletBackup={backupVersion:1,createdAt:'now',records:[{id:tx.id,entity:'transaction',payload:JSON.stringify(deleted),version:3,state:'pending'},{id:'m',entity:'module',payload:JSON.stringify({id:'m',fields:{note:'hello,\n世界'}}),version:2,state:'conflict'}],settings:[],conflicts:[]};
 const csv=exportLedgerCsv(backup),rows=parseCsv(csv);
 assert.equal(rows.length,2);assert.equal(rows[0].recordVersion,'3');assert.equal(rows[0].recordState,'pending');assert.equal(rows[1].recordType,'module');
 assert.deepEqual(importTransactionsCsv(csv),[deleted]);assert.deepEqual(JSON.parse(rows[1].payloadJson),JSON.parse(backup.records[1].payload));
});
test('CSV rejects invalid quoting, duplicate IDs, unsafe minor amounts, malformed dates',()=>{
 for(const text of ['a,a\n1,2','a,b\n1','a\n"unclosed','a\n"x"tail'])assert.throws(()=>parseCsv(text));
 assert.throws(()=>importTransactionsCsv(exportTransactionsCsv([tx,tx])),/duplicate/);
 assert.throws(()=>importTransactionsCsv(exportTransactionsCsv([tx]).replace('-1001','9007199254740992')),/Invalid CSV/);
 assert.throws(()=>importTransactionsCsv(exportTransactionsCsv([{...tx,date:'2026-02-31'}])),/calendar date/);
});
