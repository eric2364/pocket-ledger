export function entryReportingPeriod({annual,year,date,originalPeriod,sourceSheet,existingId,duplicate=false,periodTouched=false}:{annual:boolean;year:string;date:string;originalPeriod?:string;sourceSheet?:string;existingId?:string;duplicate?:boolean;periodTouched?:boolean}):string{
 if(annual){if(!/^\d{4}$/.test(year))throw new Error('Choose a reporting year.');return year;}
 if(!date&&(!existingId||duplicate||periodTouched))throw new Error('Choose a date for this monthly entry.');
 if(sourceSheet&&existingId&&!duplicate&&!periodTouched&&originalPeriod)return originalPeriod;
 return date.slice(0,7);
}
