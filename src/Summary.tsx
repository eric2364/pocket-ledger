import React,{useMemo,useState} from 'react';
import {ScrollView,Text,View} from 'react-native';
import type {ModuleRecord,Transaction} from './lib/types';
import {report,reportHkd} from './lib/domain';
import {formatAccounting} from './lib/accounting';
import {Button,Chip,useUI} from './ui';
import {PeriodPicker} from './PeriodPicker';
import {SummaryComparison} from './SummaryComparison';
const money=(n:number)=>`HKD ${formatAccounting(n)}`;
const display=(v:unknown)=>v===null||v===undefined?'':typeof v==='object'?JSON.stringify(v):String(v);
export function Summary({transactions,records,historical,onLock,extra}:{transactions:Transaction[];records:ModuleRecord[];historical:Record<string,unknown>[];reviews:Record<string,unknown>[];onLock:()=>void;extra?:React.ReactNode}){
 const {colors,ui}=useUI();
 const [view,setView]=useState<'year'|'salary'|'detail'>('year');
 const years=[...new Set([...transactions.map(t=>t.reportingPeriod.slice(0,4)),...historical.map(h=>String(h.year||''))])].filter(y=>/^\d{4}$/.test(y)).sort().reverse();
 const [year,setYear]=useState(years[0]||String(new Date().getFullYear())),[detail,setDetail]=useState(''),[limit,setLimit]=useState(30),[showOriginal,setShowOriginal]=useState(false);
 const annual=useMemo(()=>reportHkd(transactions,year),[transactions,year]);
 const currencies=useMemo(()=>Object.entries(report(transactions,year)).filter(([currency])=>currency!=='HKD'),[transactions,year]);
 const numeric={fontVariant:['tabular-nums'] as ('tabular-nums')[],textAlign:'right' as const};
 const annualCategories=useMemo(()=>{const map=new Map<string,{label:string;amount:number}>();for(const [label,amount] of Object.entries(annual.categories)){const key=label.toLocaleLowerCase(),row=map.get(key)||{label,amount:0};row.amount+=amount;map.set(key,row);}return [...map.values()].sort((a,b)=>b.amount-a.amount);},[annual]);
 const annualIncome=useMemo(()=>{
  const map=new Map<string,{label:string;minor:number}>();
  for(const tx of transactions){if(tx.deletedAt||!tx.reportingPeriod.startsWith(year)||!['income','adjustment'].includes(tx.kind))continue;const total=reportHkd([tx]);if(!total.incomeMinor)continue;const key=tx.category.toLocaleLowerCase(),row=map.get(key)||{label:tx.category,minor:0};row.minor+=total.incomeMinor;map.set(key,row);}
  return [...map.values()].sort((a,b)=>b.minor-a.minor);
 },[transactions,year]);
 const monthRows=useMemo(()=>Array.from({length:12},(_,i)=>{const period=`${year}-${String(i+1).padStart(2,'0')}`;return {period,label:new Date(Number(year),i,1).toLocaleDateString('en',{month:'long'}),...reportHkd(transactions,period)};}),[transactions,year]);
 const yearOnly=useMemo(()=>reportHkd(transactions.filter(tx=>tx.reportingPeriod===year)),[transactions,year]);
 const originalRows=historical.filter(h=>String(h.year)===year&&h.sourceSheet==='Saving');
 const detailRows=records.filter(r=>r.type===detail);
 return <ScrollView contentContainerStyle={ui.content}>
  <View style={ui.row}><Text style={ui.title}>Summary</Text><Button title="Lock" secondary onPress={onLock}/></View>
  <View style={ui.wrap}>{([['year','Yearly comparison'],['salary','Monthly salary'],['detail','Year details']] as const).map(([key,label])=><Chip key={key} title={label} active={view===key} onPress={()=>setView(key)}/>)}</View>
  {view!=='detail'?<SummaryComparison key={view} transactions={transactions} mode={view}/>:<>
  <PeriodPicker label="Summary year" value={year} onChange={value=>{setYear(value);setDetail('');setLimit(30);}} periods={years} allowMonthly={false} allowAll={false}/>
  <View style={[ui.card,{backgroundColor:colors.green,borderColor:colors.green}]}>
   <Text style={[ui.label,{color:colors.onAccent}]}>NET SAVING · {year}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[ui.amount,numeric,{color:colors.onAccent}]}>{money(annual.netMinor)}</Text>
   {([['Income',annual.incomeMinor],['Expenses',annual.expenseMinor]] as const).map(([label,value])=><View key={label} style={ui.row}><Text style={[ui.muted,{color:colors.onAccent,flex:1}]}>{label}</Text><Text style={[ui.heading,numeric,{color:colors.onAccent}]}>{money(value)}</Text></View>)}
  </View>
  <Text style={ui.muted}>Totals update from your entries and include annual adjustments. Transfers, card settlements and investment contributions are excluded.</Text>
  {annual.unconvertedCount>0&&<View style={ui.card}><Text style={ui.muted}>{annual.unconvertedCount} foreign-currency {annual.unconvertedCount===1?'entry without a recorded HKD amount is':'entries without a recorded HKD amount are'} excluded from the HKD totals.</Text></View>}
  {currencies.map(([currency,total])=><View key={currency} style={ui.card}><Text style={ui.heading}>{currency} annual totals · {year}</Text>{([['Income',total.incomeMinor],['Expenses',total.expenseMinor],['Net saving',total.netMinor]] as const).map(([label,value])=><View key={label} style={ui.row}><Text style={[ui.body,{flex:1}]}>{label}</Text><Text style={[ui.body,numeric]}>{currency} {formatAccounting(value,currency)}</Text></View>)}<Text style={ui.muted}>Shown in the recorded currency.</Text></View>)}
  <View style={ui.card}><Text style={ui.heading}>Income by category · {year}</Text>{annualIncome.length?annualIncome.map(row=><View key={row.label} style={ui.row}><Text style={[ui.body,{flex:1}]}>{row.label}</Text><Text style={[ui.body,numeric,{minWidth:126}]}>{money(row.minor)}</Text></View>):<Text style={ui.muted}>No recorded income for this year.</Text>}</View>
  <View style={ui.card}><Text style={ui.heading}>Spending by category · {year}</Text>{annualCategories.length?annualCategories.map(({label,amount},i)=><View key={label} style={ui.row}><Text style={[ui.body,{flex:1}]}>{i+1}. {label}</Text><Text style={[ui.body,numeric,{minWidth:126}]}>{money(amount)}</Text></View>):<Text style={ui.muted}>No recorded spending for this year.</Text>}</View>
  <View style={ui.card}><Text style={ui.heading}>Monthly breakdown · {year}</Text>{monthRows.map(row=><View key={row.period} style={{gap:5,borderTopWidth:1,borderColor:colors.border,paddingTop:10}}><View style={ui.row}><Text style={ui.heading}>{row.label}</Text><Text style={[ui.body,numeric,{fontWeight:'600'}]}>{money(row.netMinor)}</Text></View><Text style={[ui.muted,numeric]}>Income {money(row.incomeMinor)} · expenses {money(row.expenseMinor)}</Text>{row.unconvertedCount>0&&<Text style={ui.muted}>{row.unconvertedCount} foreign-currency entries without recorded HKD amounts are excluded.</Text>}</View>)}
   {(yearOnly.incomeMinor!==0||yearOnly.expenseMinor!==0)&&<View style={{gap:5,borderTopWidth:1,borderColor:colors.border,paddingTop:10}}><Text style={ui.heading}>Annual adjustments</Text><Text style={ui.muted}>Income {money(yearOnly.incomeMinor)} · expenses {money(yearOnly.expenseMinor)} · net {money(yearOnly.netMinor)}</Text><Text style={ui.muted}>These entries belong to the year without a specific month.</Text></View>}
  </View>
  <View style={ui.card}><Button title={showOriginal?'Hide original workbook details':'Original workbook details'} secondary onPress={()=>setShowOriginal(!showOriginal)}/>{showOriginal&&<>
   <Text style={ui.muted}>Original figures and source cells are preserved as reference records. They do not create additional transactions.</Text>
   {originalRows.map((row,i)=><View key={i}><Text style={ui.body}>{String(row.label)}: {typeof row.value==='number'?money(Math.round(row.value*100)):display(row.value)}</Text><Text style={ui.muted}>{String(row.sourceSheet)}!{String(row.sourceReference)}</Text></View>)}
   <View style={ui.wrap}>{['saving','income-summary','expense-summary','tax','investment'].map(type=><Chip title={type.replace('-',' ')} key={type} active={detail===type} onPress={()=>{setDetail(detail===type?'':type);setLimit(30);}}/>)}</View>
   {detail&&detailRows.slice(0,limit).map(row=><View key={row.id} style={{gap:5,borderTopWidth:1,borderColor:colors.border,paddingTop:10}}><Text style={ui.heading}>{row.title}</Text><Text style={ui.muted}>{row.sourceSheet}</Text>{Array.isArray(row.fields.cells)&&row.fields.cells.map((cell:any)=><Text key={cell.reference} style={ui.body}>{cell.reference}: {display(cell.cachedValue??cell.value)}</Text>)}</View>)}
   {detail&&detailRows.length>limit&&<Button title="Show more original rows" secondary onPress={()=>setLimit(limit+30)}/>} {detail&&detailRows.length===0&&<Text style={ui.muted}>No original rows for this selection.</Text>}
  </>}</View>
  </>}
  {extra}
 </ScrollView>;
}
