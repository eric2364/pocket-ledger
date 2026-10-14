import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarDays,dateParts,dateString} from '../src/lib/dates';
test('entry calendar accepts leap days and rejects impossible original input without timezone shifts',()=>{
 assert.deepEqual(dateParts('2024-02-29'),{year:2024,month:2,day:29});assert.equal(dateParts('2023-02-29'),null);assert.equal(dateParts('2026-04-31'),null);assert.equal(dateParts('2026-00-01'),null);assert.equal(dateParts(''),null);assert.equal(dateString(2026,1,9),'2026-01-09');
});
test('calendar weeks start Monday and include every day once for leap and short months',()=>{
 const leap=calendarDays(2024,2);assert.deepEqual(leap.slice(0,4),[null,null,null,1]);assert.equal(leap.filter(day=>day!==null).length,29);assert.equal(calendarDays(2026,2).filter(day=>day!==null).length,28);assert.equal(calendarDays(2026,6)[0],1);
});
