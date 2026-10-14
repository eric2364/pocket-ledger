const monthPattern=/^\d{4}-(0[1-9]|1[0-2])$/;
const yearPattern=/^\d{4}$/;
export const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
export function availablePeriods(periods:string[],currentMonth:string,selected=''){
  return [...new Set([...periods,currentMonth,selected].filter(p=>monthPattern.test(p)||yearPattern.test(p)))].sort().reverse();
}
export function periodYears(periods:string[]){return [...new Set(periods.map(p=>p.slice(0,4)).filter(p=>yearPattern.test(p)))].sort().reverse();}
export function periodLabel(period:string){if(!period)return 'All records';if(yearPattern.test(period))return `${period} · Full year`;if(monthPattern.test(period))return `${monthNames[Number(period.slice(5))-1]} ${period.slice(0,4)}`;return period;}
export function shiftReportMonth(period:string,step:number,currentMonth:string){
 const source=monthPattern.test(period)?period:currentMonth;
 if(!monthPattern.test(source)||!Number.isInteger(step))throw new Error('Choose a valid month');
 const total=Number(source.slice(0,4))*12+Number(source.slice(5))-1+step,year=Math.floor(total/12);
 if(year<0||year>9999)throw new Error('Month is outside supported years');
 return `${String(year).padStart(4,'0')}-${String(total%12+1).padStart(2,'0')}`;
}
