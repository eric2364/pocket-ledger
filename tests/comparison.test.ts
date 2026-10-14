import test from 'node:test';
import assert from 'node:assert/strict';
import {comparisonPeriods,buildComparison} from '../src/lib/comparison';
import type {Transaction} from '../src/lib/types';
const tx=(id:string,reportingPeriod:string,kind:Transaction['kind'],category:string,n:number):Transaction=>({id,reportingPeriod,kind,category,amountMinor:n,personalShareMinor:n,currency:'HKD',date:null,description:'',account:'Test',createdAt:'',updatedAt:''});
test('comparison columns are chronological and cross year boundaries',()=>{
 assert.deepEqual(comparisonPeriods('2026',5,'year'),['2022','2023','2024','2025','2026']);
 assert.deepEqual(comparisonPeriods('2026-02',3,'month'),['2025-12','2026-01','2026-02']);
 assert.equal(comparisonPeriods('2026-09',9,'month')[0],'2026-01');
 assert.throws(()=>comparisonPeriods('2026-13',3,'month'));
 assert.throws(()=>comparisonPeriods('2026',11,'year'));
});
test('year comparison retains annual adjustments and excludes transfers/deleted rows',()=>{
 const items=[tx('a','2026-01','income','Salary',10000),tx('b','2026-01','expense','Food',2000),tx('c','2026','adjustment','Adjustment',500),tx('d','2026-01','transfer','Transfer',3000),{...tx('e','2026-01','income','Salary',100),deletedAt:'removed'}];
 const result=buildComparison(items,['2025','2026']);
 assert.deepEqual(result.rows.slice(0,3).map(r=>r.values),[[0,10500],[0,2000],[0,8500]]);
});
test('salary uses selected income categories only, groups case and flags missing recorded HKD',()=>{
 const items=[tx('a','2026-01','income','Salary',10000),tx('b','2026-01','income','salary',2000),tx('c','2026-01','income','Other',3000),tx('d','2026-01','expense','Salary',100),{...tx('e','2026-02','income','Salary',500),currency:'USD'}];
 const result=buildComparison(items,['2026-01','2026-02'],['Salary']);
 assert.deepEqual(result.rows.at(-1)?.values,[12000,0]);
 assert.deepEqual(result.excluded,[0,1]);
 assert.equal(result.rows.length,2);
 assert.deepEqual(buildComparison(items,['2026-01'],[]).rows.at(-1)?.values,[0]);
});
