import test from 'node:test';
import assert from 'node:assert/strict';
import {availablePeriods,periodYears,periodLabel,shiftReportMonth} from '../src/lib/periods';

test('period choices preserve imported months and undated annual periods, include current and selected month',()=>{
 const periods=availablePeriods(['2024-09','2024-09','2023','2024-13','bad'], '2026-10','2027-01');
 assert.deepEqual(periods,['2027-01','2026-10','2024-09','2023']);assert.deepEqual(periodYears(periods),['2027','2026','2024','2023']);
 assert.equal(periodLabel(''),'All records');assert.equal(periodLabel('2023'),'2023 · Full year');assert.equal(periodLabel('2024-09'),'September 2024');
});
test('previous and next month cross year boundaries without changing annual and all-period semantics',()=>{
 assert.equal(shiftReportMonth('2026-01',-1,'2026-10'),'2025-12');assert.equal(shiftReportMonth('2026-12',1,'2026-10'),'2027-01');
 assert.equal(shiftReportMonth('',-1,'2026-10'),'2026-09');assert.equal(shiftReportMonth('2024',1,'2026-10'),'2026-11');
 assert.throws(()=>shiftReportMonth('2026-13',1,'invalid'));
});
