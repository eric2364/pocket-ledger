import test from 'node:test';
import assert from 'node:assert/strict';
import {entryReportingPeriod} from '../src/lib/entryPeriod';
import {annualItems,buildComparison} from '../src/lib/comparison';
import {report} from '../src/lib/domain';
import type {Transaction} from '../src/lib/types';
const base={annual:false,year:'2026',date:'2026-08-20',sourceSheet:'2026_09',existingId:'imported',originalPeriod:'2026-09'};
test('annual entry keeps chosen year without inventing a monthly date and preserves imported periods until changed',()=>{
 assert.equal(entryReportingPeriod({...base,annual:true,date:''}),'2026');
 assert.equal(entryReportingPeriod(base),'2026-09');
 assert.equal(entryReportingPeriod({...base,periodTouched:true}),'2026-08');
 assert.equal(entryReportingPeriod({...base,duplicate:true}),'2026-08');
 assert.throws(()=>entryReportingPeriod({...base,date:'',periodTouched:true}),/Choose a date/);
 assert.throws(()=>entryReportingPeriod({...base,annual:true,year:'2026-01'}),/reporting year/);
});
test('annual ad hoc items are included once in annual totals, excluded from months, and replace expense detail rows',()=>{
 const tx=(id:string,period:string,kind:Transaction['kind'],amount:number,category:string):Transaction=>({id,date:null,reportingPeriod:period,kind,amountMinor:amount,personalShareMinor:amount,currency:'HKD',category,description:'',account:'Test',createdAt:'',updatedAt:''});
 const rows=[tx('a','2026','expense',100,'Annual fee'),tx('b','2026','income',500,'Annual bonus'),tx('c','2026-01','expense',200,'Food'),tx('d','2026-01','card_payment',200,'CARD PAYMENT')];
 assert.equal(report(rows,'2026').HKD.netMinor,200);
 assert.equal(report(rows,'2026-01').HKD.netMinor,-200);
 assert.equal(annualItems(rows,'2026').length,2);
 const comparison=buildComparison(rows,['2026']).rows;
 assert.deepEqual(comparison.find(r=>r.label==='Annual · ANNUAL FEE')?.values,[-100]);
 assert.deepEqual(comparison.find(r=>r.label==='Annual · ANNUAL BONUS')?.values,[500]);
 assert.equal(comparison.some(r=>r.label.startsWith('Expense ·')),false);
});
