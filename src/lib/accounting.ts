import {formatMoney} from './domain';
/** Display only: editing and export must continue using formatMoney. */
export function formatAccounting(minor:number,currency='HKD'):string{
 const decimal=formatMoney(minor,currency);if(minor===0)return '—';
 const negative=decimal.startsWith('-'),unsigned=negative?decimal.slice(1):decimal;
 const [whole,fraction]=unsigned.split('.'),grouped=whole.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(fraction===undefined?'':`.${fraction}`);
 return negative?`(${grouped})`:grouped;
}
