import React from 'react';
import {Pressable,StyleSheet,Text,TextInput,View, type TextInputProps} from 'react-native';
export const colors={bg:'#F5F4EF',ink:'#202F28',muted:'#737E75',green:'#2D654E',pale:'#E4EDE3',border:'#DDDFD6',white:'#FFFFFF',red:'#AA4939'};
export const ui=StyleSheet.create({
  page:{flex:1,backgroundColor:colors.bg},content:{padding:20,gap:16,paddingBottom:110},
  title:{fontSize:30,fontWeight:'700',color:colors.ink,letterSpacing:-1},subtitle:{fontSize:14,color:colors.muted,lineHeight:21},
  heading:{fontSize:18,fontWeight:'600',color:colors.ink},body:{fontSize:15,color:colors.ink,lineHeight:22},muted:{fontSize:13,color:colors.muted,lineHeight:19},
  card:{backgroundColor:colors.white,padding:18,borderRadius:20,gap:10,borderWidth:1,borderColor:colors.border},
  row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},wrap:{flexDirection:'row',flexWrap:'wrap',gap:8},
  input:{backgroundColor:colors.white,borderWidth:1,borderColor:colors.border,borderRadius:12,padding:13,fontSize:16,color:colors.ink,minHeight:48},
  label:{fontSize:13,fontWeight:'600',color:colors.muted,marginBottom:6},button:{backgroundColor:colors.green,paddingHorizontal:18,paddingVertical:14,borderRadius:13,alignItems:'center',justifyContent:'center',minHeight:48},
  buttonText:{color:colors.white,fontSize:15,fontWeight:'600'},chip:{borderWidth:1,borderColor:colors.border,borderRadius:24,paddingVertical:9,paddingHorizontal:14,backgroundColor:colors.white},chipActive:{backgroundColor:colors.pale,borderColor:colors.green},
  chipText:{fontSize:13,color:colors.ink},divider:{height:1,backgroundColor:colors.border},amount:{fontSize:36,fontWeight:'700',color:colors.ink,letterSpacing:-1},
});
export function Button({title,onPress,secondary=false,disabled=false}:{title:string;onPress:()=>void;secondary?:boolean;disabled?:boolean}){
  return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled} onPress={onPress} style={[ui.button,secondary&&{backgroundColor:colors.pale},disabled&&{opacity:.5}]}><Text style={[ui.buttonText,secondary&&{color:colors.green}]}>{title}</Text></Pressable>;
}
export function Chip({title,onPress,active=false}:{title:string;onPress:()=>void;active?:boolean}){return <Pressable accessibilityRole="button" accessibilityState={{selected:active}} onPress={onPress} style={[ui.chip,active&&ui.chipActive]}><Text style={ui.chipText}>{title}</Text></Pressable>;}
export function Field({label,...props}:TextInputProps&{label:string}){return <View><Text style={ui.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} style={ui.input} {...props}/></View>;}
