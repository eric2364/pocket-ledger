import { reportHkd } from './domain';
import type { ModuleRecord, Transaction } from './types';

export type ReconciliationTotals = { incomeMinor:number; expenseMinor:number; netMinor:number; incomeCount:number; expenseCount:number; unconvertedCount:number };
export type ReconciliationSnapshot = Pick<Transaction,'id'|'reportingPeriod'|'kind'|'currency'|'amountMinor'|'personalShareMinor'> & Partial<Pick<Transaction,'date'|'category'|'description'|'account'|'hkdAmountMinor'|'hkdPersonalShareMinor'|'project'|'notes'|'deletedAt'>>;
export type MonthlyReconciliation = {
  period:string;
  status:'missing-baseline'|'incomplete'|'matched'|'different';
  current:ReconciliationTotals;
  personal:ReturnType<typeof reportHkd>;
  baseline:{incomeMinor:number;expenseMinor:number;netMinor:number;incomeCount:number|null;expenseCount:number|null}|null;
  differences:{incomeMinor:number;expenseMinor:number;netMinor:number;incomeCount:number|null;expenseCount:number|null}|null;
  changes:{added:string[];edited:string[];deleted:string[]}|null;
  sourceReferences:unknown;
};
const isMonthly=(tx:ReconciliationSnapshot,period:string)=>tx.reportingPeriod===period&&['income','expense'].includes(tx.kind);
const safe=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value);
const checked=(value:number)=>{if(!Number.isSafeInteger(value))throw new Error('Reconciliation exceeds safe money range');return value;};
const fingerprint=(tx:ReconciliationSnapshot)=>JSON.stringify([tx.reportingPeriod,tx.kind,tx.currency,tx.amountMinor,tx.personalShareMinor,tx.hkdAmountMinor??null,tx.hkdPersonalShareMinor??null,tx.date??null,tx.category??null,tx.description??null,tx.account??null,tx.project??null,tx.notes??null]);

/** Compare gross monthly workbook totals; personal share is reported separately.
 * Reporting period, rather than calendar date, is authoritative for migrated rows.
 * Missing baselines/conversions are explicit and never treated as a match.
 */
export function reconcileMonth(transactions:Transaction[],records:ModuleRecord[],period:string):MonthlyReconciliation {
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))throw new Error('Select a valid month');
  const monthly=transactions.filter(tx=>isMonthly(tx,period)&&!tx.deletedAt);
  const current:ReconciliationTotals={incomeMinor:0,expenseMinor:0,netMinor:0,incomeCount:0,expenseCount:0,unconvertedCount:0};
  for(const tx of monthly){
    const income=tx.kind==='income';
    current[income?'incomeCount':'expenseCount']++;
    const amount=tx.currency==='HKD'?tx.amountMinor:tx.hkdAmountMinor;
    if(!safe(amount)){current.unconvertedCount++;continue;}
    const key=income?'incomeMinor':'expenseMinor';current[key]=checked(current[key]+amount);
  }
  current.netMinor=checked(current.incomeMinor-current.expenseMinor);
  const result:MonthlyReconciliation={period,status:'missing-baseline',current,personal:reportHkd(monthly),baseline:null,differences:null,changes:null,sourceReferences:null};
  const matches=records.filter(row=>row.type==='reconciliation'&&row.fields.period===period);
  if(matches.length>1)throw new Error('Multiple workbook baselines exist for this month');
  const row=matches[0];if(!row)return result;
  const f=row.fields;
  result.sourceReferences=f.refs??f.sourceReferences??null;
  if(!safe(f.incomeMinor)||!safe(f.expenseMinor)||!safe(f.netMinor)){result.status='incomplete';return result;}
  if(f.netMinor!==checked(f.incomeMinor-f.expenseMinor)){result.status='incomplete';return result;}
  const count=(n:unknown)=>safe(n)&&n>=0?n:null;
  const baseline={incomeMinor:f.incomeMinor,expenseMinor:f.expenseMinor,netMinor:f.netMinor,incomeCount:count(f.incomeCount),expenseCount:count(f.expenseCount)};
  result.baseline=baseline;
  result.differences={incomeMinor:checked(current.incomeMinor-baseline.incomeMinor),expenseMinor:checked(current.expenseMinor-baseline.expenseMinor),netMinor:checked(current.netMinor-baseline.netMinor),incomeCount:baseline.incomeCount===null?null:current.incomeCount-baseline.incomeCount,expenseCount:baseline.expenseCount===null?null:current.expenseCount-baseline.expenseCount};
  if(Array.isArray(f.baselineTransactions)){
    const snapshots=f.baselineTransactions as ReconciliationSnapshot[];
    if(snapshots.some(tx=>!tx||typeof tx.id!=='string'||!safe(tx.amountMinor)||!safe(tx.personalShareMinor)||typeof tx.reportingPeriod!=='string')||new Set(snapshots.map(tx=>tx.id)).size!==snapshots.length){result.status='incomplete';return result;}
    const before=new Map(snapshots.filter(tx=>isMonthly(tx,period)&&!tx.deletedAt).map(tx=>[tx.id,tx]));
    const after=new Map(transactions.map(tx=>[tx.id,tx]));
    const changes={added:[] as string[],edited:[] as string[],deleted:[] as string[]};
    for(const tx of monthly)if(!before.has(tx.id))changes.added.push(tx.id);
    for(const [id,tx] of before){const now=after.get(id);if(!now||now.deletedAt)changes.deleted.push(id);else if(fingerprint(tx)!==fingerprint(now))changes.edited.push(id);}
    result.changes=changes;
  }
  result.status=current.unconvertedCount||result.personal.unconvertedCount?'incomplete':Object.values(result.differences).every(value=>value===null||value===0)?'matched':'different';
  return result;
}
