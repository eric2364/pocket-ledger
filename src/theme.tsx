import React,{createContext,useContext,useEffect,useMemo,useRef,useState} from 'react';
import {Platform,useColorScheme} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import {repository} from './lib/repository';
import {appearanceMode,palettes,resolvedTheme,type AppearanceMode,type Palette} from './lib/theme';
interface ThemeValue{mode:AppearanceMode;scheme:'light'|'dark';colors:Palette;setMode:(mode:AppearanceMode)=>Promise<void>;}
const ThemeContext=createContext<ThemeValue|undefined>(undefined);
export function ThemeProvider({children}:{children:React.ReactNode}){
 const preferenceGeneration=useRef(0);
 const [mode,setModeState]=useState<AppearanceMode>('system'),system=useColorScheme(),scheme=resolvedTheme(mode,system);
 useEffect(()=>{let alive=true;void(async()=>{try{await repository.init();const saved=await repository.getSetting('appearance');if(alive&&preferenceGeneration.current===0)setModeState(appearanceMode(saved));}catch{}})();return()=>{alive=false;};},[]);
 async function setMode(next:AppearanceMode){preferenceGeneration.current++;setModeState(next);await repository.setSetting('appearance',next);}
 const colors=palettes[scheme],value=useMemo(()=>({mode,scheme,colors,setMode}),[mode,scheme]);
 useEffect(()=>{if(Platform.OS!=='web')return;document.documentElement.style.colorScheme=scheme;document.documentElement.style.backgroundColor=colors.bg;document.body.style.backgroundColor=colors.bg;const meta=document.querySelector('meta[name="theme-color"]');meta?.setAttribute('content',colors.bg);},[scheme,colors]);
 return <ThemeContext.Provider value={value}><StatusBar style={scheme==='dark'?'light':'dark'}/>{children}</ThemeContext.Provider>;
}
export function useTheme(){const value=useContext(ThemeContext);if(!value)throw new Error('Theme provider is missing');return value;}
