import type {Transaction} from './types';
import {reportHkd} from './domain';
import {shiftReportMonth} from './periods';
import {normalizeCategory,normalizeCategories} from './categories';
export function comparisonPeriods(end:string,count:number,unit:'year'|'month'):string[]{
 if(!Number.isInteger(count)||count<1||count>(unit==='year'?10:36))throw new Error('Choose a valid number of periods');
 if(unit==='year'){
  if(!/^\d{4}$/.test(end)||Number(end)-count+1<0)throw new Error('Choose a valid ending year');
  return Array.from({length:count},(_,i)=>String(Number(end)-count+1+i).padStart(4,'0'));
 }
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(end))throw new Error('Choose a valid ending month');
 return Array.from({length:count},(_,i)=>shiftReportMonth(end,i-count+1,end));
}
export function incomeCategories(transactions:Transaction[]):string[]{
 return normalizeCategories(transactions.filter(t=>!t.deletedAt&&t.kind==='income').map(t=>t.category));
}
export function annualItems(transactions:Transaction[],year?:string):Transaction[]{
 return transactions.filter(t=>!t.deletedAt&&/^\d{4}$/.test(t.reportingPeriod)&&(!year||t.reportingPeriod===year)&&['income','expense','adjustment'].includes(t.kind));
}
export function buildComparison(transactions:Transaction[],periods:string[],categories?:string[]){
 const selected=categories&&new Set(categories.map(normalizeCategory));
 const source=selected?transactions.filter(t=>t.kind==='income'&&selected.has(normalizeCategory(t.category))):transactions;
 const totals=periods.map(p=>reportHkd(source,p));
 const rows:{label:string;values:number[]}[]=selected?[]:[
  {label:'Income',values:totals.map(t=>t.incomeMinor)},
  {label:'Expenses',values:totals.map(t=>t.expenseMinor)},
  {label:'Net saving',values:totals.map(t=>t.netMinor)},
 ];
 const income=incomeCategories(source.filter(t=>periods.some(p=>t.reportingPeriod.startsWith(p))&&(selected||t.reportingPeriod.length===7)));
 for(const category of income)rows.push({label:selected?category:`Income · ${category}`,values:periods.map(p=>reportHkd(source.filter(t=>normalizeCategory(t.category)===category&&t.kind==='income'&&(selected||t.reportingPeriod.length===7)),p).incomeMinor)});
 if(selected)rows.push({label:'Total salary',values:totals.map(t=>t.incomeMinor)});
 else{
  const items=annualItems(transactions).filter(t=>periods.includes(t.reportingPeriod));
  for(const category of normalizeCategories(items.map(t=>t.category)))rows.push({label:`Annual · ${category}`,values:periods.map(p=>reportHkd(items.filter(t=>t.reportingPeriod===p&&normalizeCategory(t.category)===category)).netMinor)});
 }
 return {rows,excluded:totals.map(t=>t.unconvertedCount)};
}
