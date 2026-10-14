export type AppearanceMode='system'|'light'|'dark';
export function appearanceMode(value:unknown):AppearanceMode{return value==='light'||value==='dark'?value:'system';}
export function resolvedTheme(mode:AppearanceMode,system:string|null|undefined):'light'|'dark'{return mode==='system'?(system==='dark'?'dark':'light'):mode;}
export const palettes={
 light:{bg:'#F5F4EF',ink:'#202F28',muted:'#657268',green:'#2D654E',pale:'#E4EDE3',border:'#DDDFD6',white:'#FFFFFF',red:'#AA4939',onAccent:'#FFFFFF',hero:'#2D654E',heroInk:'#FFFFFF',heroMuted:'#D2E5D5'},
 dark:{bg:'#111914',ink:'#E8F0E9',muted:'#A7B7AC',green:'#9DD7AF',pale:'#263C2E',border:'#3A4D40',white:'#1C2820',red:'#F3A59A',onAccent:'#13251A',hero:'#244B34',heroInk:'#F1F8F2',heroMuted:'#C2DDCC'},
};
export type Palette=typeof palettes.light;
