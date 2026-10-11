export function pickFile(type='*/*'):Promise<{name:string;bytes:Uint8Array}|null>{
  return new Promise(resolve=>{
    const input=document.createElement('input');input.type='file';input.accept=type==='*/*'?'':type;
    input.onchange=async()=>{const file=input.files?.[0];resolve(file?{name:file.name,bytes:new Uint8Array(await file.arrayBuffer())}:null);};
    input.oncancel=()=>resolve(null);input.click();
  });
}
export async function shareFile(name:string,bytes:Uint8Array,mimeType:string){
  const file=new globalThis.File([bytes.slice().buffer],name,{type:mimeType});
  if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file]});return;}catch(error){if(error instanceof DOMException&&error.name==='AbortError')return;}}
  const url=URL.createObjectURL(file),link=document.createElement('a');link.href=url;link.download=name;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
