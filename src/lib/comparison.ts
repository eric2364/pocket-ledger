import type {Transaction} from './types';
import {reportHkd} from './domain';
import {shiftReportMonth} from './periods';
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
 const names=new Map<string,string>();
 for(const t of transactions)if(!t.deletedAt&&t.kind==='income')names.set(t.category.toLocaleLowerCase(),t.category);
 return [...names.values()].sort((a,b)=>a.localeCompare(b));
}
export function buildComparison(transactions:Transaction[],periods:string[],categories?:string[]){
 const selected=categories&&new Set(categories.map(c=>c.toLocaleLowerCase()));
 const source=selected?transactions.filter(t=>t.kind==='income'&&selected.has(t.category.toLocaleLowerCase())):transactions;
 const totals=periods.map(p=>reportHkd(source,p));
 const rows:{label:string;values:number[]}[]=selected?[]:[
  {label:'Income',values:totals.map(t=>t.incomeMinor)},
  {label:'Expenses',values:totals.map(t=>t.expenseMinor)},
  {label:'Net saving',values:totals.map(t=>t.netMinor)},
 ];
 const income=incomeCategories(source.filter(t=>periods.some(p=>t.reportingPeriod.startsWith(p))));
 for(const category of income)rows.push({label:selected?category:`Income · ${category}`,values:periods.map(p=>reportHkd(source.filter(t=>t.category.toLocaleLowerCase()===category.toLocaleLowerCase()&&t.kind==='income'),p).incomeMinor)});
 if(selected)rows.push({label:'Total salary',values:totals.map(t=>t.incomeMinor)});
 else{
  const names=new Map<string,string>();
  for(const total of totals)for(const category of Object.keys(total.categories))names.set(category.toLocaleLowerCase(),category);
  for(const [key,label] of [...names].sort((a,b)=>a[1].localeCompare(b[1])))rows.push({label:`Expense · ${label}`,values:totals.map(t=>Object.entries(t.categories).filter(([k])=>k.toLocaleLowerCase()===key).reduce((sum,[,v])=>sum+v,0))});
 }
 return {rows,excluded:totals.map(t=>t.unconvertedCount)};
}
