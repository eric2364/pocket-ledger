import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function pickFile(type='*/*'):Promise<{name:string;bytes:Uint8Array}|null>{
  const result=await DocumentPicker.getDocumentAsync({type,copyToCacheDirectory:true});
  if(result.canceled)return null;
  const item=result.assets[0];
  return {name:item.name,bytes:await new File(item.uri).bytes()};
}
export async function shareFile(name:string,bytes:Uint8Array,mimeType:string){
  const file=new File(Paths.cache,name);file.create({overwrite:true});file.write(bytes);
  if(!await Sharing.isAvailableAsync())throw new Error('File sharing is unavailable on this device');
  await Sharing.shareAsync(file.uri,{mimeType,dialogTitle:name});
}
