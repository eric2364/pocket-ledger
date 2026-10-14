import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileMonth} from '../src/lib/reconciliation';
import type {Transaction,ModuleRecord} from '../src/lib/types';
const tx=(id:string,amountMinor:number,extra:Partial<Transaction>={}):Transaction=>({id,date:'2026-09-01',reportingPeriod:'2026-09',kind:'expense',category:'Food',description:'Example',account:'Cash',currency:'HKD',amountMinor,personalShareMinor:amountMinor,createdAt:'2026-09-01',updatedAt:'2026-09-01',...extra});
const baseline=(fields:Record<string,unknown>={}):ModuleRecord=>({id:'baseline',type:'reconciliation',title:'September',fields:{period:'2026-09',incomeMinor:20000,expenseMinor:10000,netMinor:10000,incomeCount:1,expenseCount:1,...fields}});
test('gross monthly reconciliation matches while personal share remains separate',()=>{
 const rows=[tx('expense',10000,{personalShareMinor:6000,date:'2026-10-01'}),tx('income',20000,{kind:'income'}),tx('annual',100000,{kind:'adjustment',reportingPeriod:'2026'}),tx('transfer',1000,{kind:'transfer'})];
 const r=reconcileMonth(rows,[baseline()],'2026-09');assert.equal(r.status,'matched');assert.equal(r.current.expenseMinor,10000);assert.equal(r.personal.expenseMinor,6000);assert.equal(r.current.expenseCount,1);
});
test('missing baseline is explicit and foreign amounts without gross conversion are incomplete',()=>{
 assert.equal(reconcileMonth([],[],'2026-09').status,'missing-baseline');
 const r=reconcileMonth([tx('foreign',10000,{currency:'USD',hkdPersonalShareMinor:20000})],[baseline()],'2026-09');assert.equal(r.status,'incomplete');assert.equal(r.current.unconvertedCount,1);assert.equal(r.personal.expenseMinor,20000);
});
test('converted gross amounts and negative refunds are reconciled exactly',()=>{
 const r=reconcileMonth([tx('foreign',100,{currency:'USD',hkdAmountMinor:800,hkdPersonalShareMinor:800}),tx('refund',-100,{sourceSheet:'Synthetic',sourceReference:'A1'})],[baseline({incomeMinor:0,expenseMinor:700,netMinor:-700,incomeCount:0,expenseCount:2})],'2026-09');assert.equal(r.status,'matched');assert.equal(r.current.expenseMinor,700);
});
test('snapshot comparison distinguishes addition, edit, deletion and ignores sync metadata',()=>{
 const old=[tx('edit',100),tx('delete',200),tx('same',300),tx('moved',400)];
 const now=[tx('edit',150),tx('delete',200,{deletedAt:'2026-10-01'}),tx('same',300,{version:4,updatedAt:'2026-10-01'}),tx('moved',400,{reportingPeriod:'2026-10'}),tx('new',500)];
 const r=reconcileMonth(now,[baseline({incomeMinor:0,expenseMinor:1000,netMinor:-1000,incomeCount:0,expenseCount:4,baselineTransactions:old})],'2026-09');assert.deepEqual(r.changes,{added:['new'],edited:['edit','moved'],deleted:['delete']});assert.equal(r.differences?.expenseMinor,-50);assert.equal(r.status,'different');
});
test('invalid baselines, duplicate snapshots and invalid periods cannot report a match',()=>{
 assert.equal(reconcileMonth([],[baseline({incomeMinor:undefined})],'2026-09').status,'incomplete');assert.equal(reconcileMonth([],[baseline({netMinor:0})],'2026-09').status,'incomplete');assert.throws(()=>reconcileMonth([],[baseline(),baseline()],'2026-09'));assert.throws(()=>reconcileMonth([],[],'2026-13'));
});

test('canonical category casing does not create false baseline edits while a real category change does',()=>{
 const old=[tx('canonical',100,{category:' food '})];
 const records=[baseline({incomeMinor:0,expenseMinor:100,netMinor:-100,incomeCount:0,expenseCount:1,baselineTransactions:old})];
 assert.deepEqual(reconcileMonth([tx('canonical',100,{category:'FOOD',originalCategory:' food '})],records,'2026-09').changes,{added:[],edited:[],deleted:[]});
 assert.deepEqual(reconcileMonth([tx('canonical',100,{category:'TRANSPORT',originalCategory:' food '})],records,'2026-09').changes,{added:[],edited:['canonical'],deleted:[]});
 assert.equal(old[0].category,' food ');
});
