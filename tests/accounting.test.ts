import test from 'node:test';
import assert from 'node:assert/strict';
import {formatAccounting} from '../src/lib/accounting';
import {formatMoney,exportTransactionsCsv} from '../src/lib/domain';
test('accounting display groups exact cents and formats negatives without changing editable money or CSV',()=>{
 assert.equal(formatAccounting(123456789),'1,234,567.89');assert.equal(formatAccounting(-123456),'(1,234.56)');assert.equal(formatAccounting(0),'—');assert.equal(formatAccounting(123456,'JPY'),'123,456');assert.equal(formatAccounting(-123456,'JPY'),'(123,456)');assert.equal(formatMoney(-123456),'-1234.56');
 const csv=exportTransactionsCsv([{id:'synthetic-refund',date:'2026-10-14',reportingPeriod:'2026-10',kind:'expense',category:'Test',description:'',account:'Test',currency:'HKD',amountMinor:-123456,personalShareMinor:-123456,createdAt:'',updatedAt:''}]);assert.match(csv,/-1234\.56/);assert.doesNotMatch(csv,/\(1,234\.56\)/);
});
