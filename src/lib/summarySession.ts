export const SUMMARY_SESSION_MS=10*60*1000;
export function summarySessionActive(expiresAt:number,now=Date.now()){return expiresAt>now;}
