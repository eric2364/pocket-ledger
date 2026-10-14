import React,{useMemo,useState} from 'react';
import {ScrollView,Text,View} from 'react-native';
import type {ModuleRecord,Transaction} from './lib/types';
import {report,reportHkd} from './lib/domain';
import {formatAccounting} from './lib/accounting';
import {Button,Chip,useUI} from './ui';
import {PeriodPicker} from './PeriodPicker';
import {SummaryComparison} from './SummaryComparison';
import {annualItems} from './lib/comparison';
import {normalizeCategory} from './lib/categories';
const money=(n:number)=>`HKD ${formatAccounting(n)}`;
const display=(v:unknown)=>v===null||v===undefined?'':typeof v==='object'?JSON.stringify(v):String(v);
export function Summary({transactions,records,historical,onLock,extra,onAddAnnual,onEditAnnual}:{transactions:Transaction[];records:ModuleRecord[];historical:Record<string,unknown>[];reviews:Record<string,unknown>[];onLock:()=>void;extra?:React.ReactNode;onAddAnnual?:(year:string)=>void;onEditAnnual?:(transaction:Transaction)=>void}){
 const {colors,ui}=useUI();
 const [view,setView]=useState<'year'|'salary'|'annual'|'detail'>('year');
 const years=[...new Set([...transactions.map(t=>t.reportingPeriod.slice(0,4)),...historical.map(h=>String(h.year||''))])].filter(y=>/^\d{4}$/.test(y)).sort().reverse();
 const [year,setYear]=useState(years[0]||String(new Date().getFullYear())),[detail,setDetail]=useState(''),[limit,setLimit]=useState(30),[showOriginal,setShowOriginal]=useState(false);
 const annual=useMemo(()=>reportHkd(transactions,year),[transactions,year]);
 const currencies=useMemo(()=>Object.entries(report(transactions,year)).filter(([currency])=>currency!=='HKD'),[transactions,year]);
 const numeric={fontVariant:['tabular-nums'] as ('tabular-nums')[],textAlign:'right' as const};
 const annualIncome=useMemo(()=>{
  const map=new Map<string,{label:string;minor:number}>();
  for(const tx of transactions){if(tx.deletedAt||!tx.reportingPeriod.startsWith(year)||!['income','adjustment'].includes(tx.kind))continue;const total=reportHkd([tx]);if(!total.incomeMinor)continue;const key=normalizeCategory(tx.category),row=map.get(key)||{label:key,minor:0};row.minor+=total.incomeMinor;map.set(key,row);}
  return [...map.values()].sort((a,b)=>b.minor-a.minor);
 },[transactions,year]);
 const monthRows=useMemo(()=>Array.from({length:12},(_,i)=>{const period=`${year}-${String(i+1).padStart(2,'0')}`;return {period,label:new Date(Number(year),i,1).toLocaleDateString('en',{month:'long'}),...reportHkd(transactions,period)};}),[transactions,year]);
 const items=useMemo(()=>annualItems(transactions,year),[transactions,year]);
 const yearOnly=useMemo(()=>reportHkd(items),[items]);
 const taxRows=records.filter(row=>row.type==='tax'&&row.fields.isRecord&&String(row.fields.year)===year);
 const investments=records.filter(row=>row.type==='investment').flatMap(row=>(Array.isArray(row.fields.entries)?row.fields.entries:[]).filter((entry:any)=>String(entry.date||'').startsWith(year)).map((entry:any)=>({row,entry}))); 
 const originalRows=historical.filter(h=>String(h.year)===year&&h.sourceSheet==='Saving');
 const detailRows=records.filter(r=>r.type===detail);
 return <ScrollView contentContainerStyle={ui.content}>
  <View style={ui.row}><Text style={ui.title}>Summary</Text><Button title="Lock" secondary onPress={onLock}/></View>
  <View style={ui.wrap}>{([['year','Yearly comparison'],['salary','Monthly salary'],['annual','Annual & ad hoc'],['detail','Year details']] as const).map(([key,label])=><Chip key={key} title={label} active={view===key} onPress={()=>setView(key)}/>)}</View>
  {view==='year'||view==='salary'?<SummaryComparison key={view} transactions={transactions} mode={view}/>:<>
  <PeriodPicker label="Summary year" value={year} onChange={value=>{setYear(value);setDetail('');setLimit(30);}} periods={years} allowMonthly={false} allowAll={false}/>
  {view==='annual'?<>
  <View style={ui.card}><Text style={ui.heading}>Annual & ad hoc items · {year}</Text><Text style={ui.muted}>These entries belong to the year without a month. Their signed amounts are already included in annual savings: income adds to savings; expenses reduce it.</Text>{onAddAnnual&&<Button title="Add yearly item" onPress={()=>onAddAnnual(year)}/>}
   <View style={ui.row}><Text style={[ui.body,{flex:1,fontWeight:'600'}]}>Net effect on saving</Text><Text style={[ui.body,numeric]}>{money(yearOnly.netMinor)}</Text></View>
   {items.length?items.map(tx=>{const total=reportHkd([tx]),recorded=total.unconvertedCount===0;return <View key={tx.id} style={{gap:5,borderTopWidth:1,borderColor:colors.border,paddingTop:12}}><View style={ui.row}><Text style={[ui.heading,{flex:1}]}>{normalizeCategory(tx.category)}</Text><Text style={[ui.body,numeric]}>{recorded?money(total.netMinor):`${tx.currency} ${formatAccounting(tx.kind==='expense'?-tx.personalShareMinor:tx.personalShareMinor,tx.currency)}`}</Text></View>{tx.description&&normalizeCategory(tx.description)!==normalizeCategory(tx.category)&&<Text style={ui.body}>{tx.description}</Text>}<Text style={ui.muted}>{recorded?'Included in annual totals.':'Recorded in its original currency; excluded from HKD totals.'}{tx.sourceSheet?` Source: ${tx.sourceSheet}!${tx.sourceReference||''}`:''}</Text>{tx.notes&&<Text style={ui.muted}>{tx.notes}</Text>}{onEditAnnual&&<Button title="Edit annual item" secondary onPress={()=>onEditAnnual(tx)}/>}</View>;}):<Text style={ui.body}>No annual or ad hoc items recorded for this year. Add an item above to include it once in annual savings.</Text>}
  </View>
  {originalRows.length>0&&<View style={ui.card}><Text style={ui.heading}>Original yearly summary · {year}</Text><Text style={ui.muted}>Read-only workbook totals, retained as references. They are not added to the current totals again.</Text>{originalRows.map((row,i)=><View key={i} style={ui.row}><View style={{flex:1}}><Text style={ui.body}>{String(row.label)}</Text><Text style={ui.muted}>{String(row.sourceSheet)}!{String(row.sourceReference)}</Text></View><Text style={[ui.body,numeric]}>{typeof row.value==='number'?money(Math.round(row.value*100)):display(row.value)}</Text></View>)}</View>}
  {taxRows.length>0&&<View style={ui.card}><Text style={ui.heading}>Tax planning references · {year}</Text><Text style={ui.muted}>Planning figures are preserved separately and do not create additional expenses.</Text>{taxRows.map(row=><View key={row.id} style={{gap:6}}>{[['Expected annual income',row.fields.expectedAnnualIncomeMinor],['Projected tax',row.fields.projectedTaxMinor],['Monthly tax saving',row.fields.monthlyTaxSavingMinor]].filter(([,value])=>typeof value==='number').map(([label,value])=><View key={String(label)} style={ui.row}><Text style={[ui.body,{flex:1}]}>{String(label)}</Text><Text style={[ui.body,numeric]}>{money(Number(value))}</Text></View>)}<Text style={ui.muted}>{row.sourceSheet} · {row.title}</Text></View>)}</View>}
  {investments.length>0&&<View style={ui.card}><Text style={ui.heading}>Investment references · {year}</Text><Text style={ui.muted}>Original contributions are shown for reference and are excluded from spending and annual savings.</Text>{investments.map(({row,entry},i)=><View key={`${row.id}-${i}`} style={{gap:4}}><Text style={ui.body}>{String(entry.strategy)} · {String(entry.date)} · {String(entry.direction||'')}</Text>{typeof entry.hkdAmountMinor==='number'&&<Text style={[ui.body,numeric]}>{money(entry.hkdAmountMinor)}</Text>}<Text style={ui.muted}>{row.sourceSheet}!{String(entry.sourceReference||'')}</Text></View>)}</View>}
  </>:<>
  <View style={[ui.card,{backgroundColor:colors.green,borderColor:colors.green}]}>
   <Text style={[ui.label,{color:colors.onAccent}]}>NET SAVING · {year}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[ui.amount,numeric,{color:colors.onAccent}]}>{money(annual.netMinor)}</Text>
   {([['Income',annual.incomeMinor],['Expenses',annual.expenseMinor]] as const).map(([label,value])=><View key={label} style={ui.row}><Text style={[ui.muted,{color:colors.onAccent,flex:1}]}>{label}</Text><Text style={[ui.heading,numeric,{color:colors.onAccent}]}>{money(value)}</Text></View>)}
  </View>
  <Text style={ui.muted}>Totals update from your entries and include annual adjustments. Transfers, card settlements and investment contributions are excluded.</Text>
  {annual.unconvertedCount>0&&<View style={ui.card}><Text style={ui.muted}>{annual.unconvertedCount} foreign-currency {annual.unconvertedCount===1?'entry without a recorded HKD amount is':'entries without a recorded HKD amount are'} excluded from the HKD totals.</Text></View>}
  {currencies.map(([currency,total])=><View key={currency} style={ui.card}><Text style={ui.heading}>{currency} annual totals · {year}</Text>{([['Income',total.incomeMinor],['Expenses',total.expenseMinor],['Net saving',total.netMinor]] as const).map(([label,value])=><View key={label} style={ui.row}><Text style={[ui.body,{flex:1}]}>{label}</Text><Text style={[ui.body,numeric]}>{currency} {formatAccounting(value,currency)}</Text></View>)}<Text style={ui.muted}>Shown in the recorded currency.</Text></View>)}
  <View style={ui.card}><Text style={ui.heading}>Income by category · {year}</Text>{annualIncome.length?annualIncome.map(row=><View key={row.label} style={ui.row}><Text style={[ui.body,{flex:1}]}>{row.label}</Text><Text style={[ui.body,numeric,{minWidth:126}]}>{money(row.minor)}</Text></View>):<Text style={ui.muted}>No recorded income for this year.</Text>}</View>
  <View style={ui.card}><Text style={ui.heading}>Monthly breakdown · {year}</Text>{monthRows.map(row=><View key={row.period} style={{gap:5,borderTopWidth:1,borderColor:colors.border,paddingTop:10}}><View style={ui.row}><Text style={ui.heading}>{row.label}</Text><Text style={[ui.body,numeric,{fontWeight:'600'}]}>{money(row.netMinor)}</Text></View><Text style={[ui.muted,numeric]}>Income {money(row.incomeMinor)} · expenses {money(row.expenseMinor)}</Text>{row.unconvertedCount>0&&<Text style={ui.muted}>{row.unconvertedCount} foreign-currency entries without recorded HKD amounts are excluded.</Text>}</View>)}
   {(yearOnly.incomeMinor!==0||yearOnly.expenseMinor!==0)&&<View style={{gap:5,borderTopWidth:1,borderColor:colors.border,paddingTop:10}}><Text style={ui.heading}>Annual adjustments</Text><Text style={ui.muted}>Income {money(yearOnly.incomeMinor)} · expenses {money(yearOnly.expenseMinor)} · net {money(yearOnly.netMinor)}</Text><Text style={ui.muted}>These entries belong to the year without a specific month.</Text></View>}
  </View>
  </>}
  <View style={ui.card}><Button title={showOriginal?'Hide original workbook details':'Original workbook details'} secondary onPress={()=>setShowOriginal(!showOriginal)}/>{showOriginal&&<>
   <Text style={ui.muted}>Original figures and source cells are preserved as reference records. They do not create additional transactions.</Text>
   {originalRows.map((row,i)=><View key={i}><Text style={ui.body}>{String(row.label)}: {typeof row.value==='number'?money(Math.round(row.value*100)):display(row.value)}</Text><Text style={ui.muted}>{String(row.sourceSheet)}!{String(row.sourceReference)}</Text></View>)}
   <View style={ui.wrap}>{['saving','income-summary','tax','investment'].map(type=><Chip title={type.replace('-',' ')} key={type} active={detail===type} onPress={()=>{setDetail(detail===type?'':type);setLimit(30);}}/>)}</View>
   {detail&&detailRows.slice(0,limit).map(row=><View key={row.id} style={{gap:5,borderTopWidth:1,borderColor:colors.border,paddingTop:10}}><Text style={ui.heading}>{row.title}</Text><Text style={ui.muted}>{row.sourceSheet}</Text>{Array.isArray(row.fields.cells)&&row.fields.cells.map((cell:any)=><Text key={cell.reference} style={ui.body}>{cell.reference}: {display(cell.cachedValue??cell.value)}</Text>)}</View>)}
   {detail&&detailRows.length>limit&&<Button title="Show more original rows" secondary onPress={()=>setLimit(limit+30)}/>} {detail&&detailRows.length===0&&<Text style={ui.muted}>No original rows for this selection.</Text>}
  </>}</View>
  </>}
  {extra}
 </ScrollView>;
}
