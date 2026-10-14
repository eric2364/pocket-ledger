import test from 'node:test';
import assert from 'node:assert/strict';
import {appearanceMode,palettes,resolvedTheme} from '../src/lib/theme';
function luminance(hex:string){const rgb=hex.slice(1).match(/../g)!.map(part=>parseInt(part,16)/255).map(n=>n<=.04045?n/12.92:Math.pow((n+.055)/1.055,2.4));return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];}
function contrast(a:string,b:string){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}

test('saved appearance resolves system changes and explicit user choices safely',()=>{
 assert.equal(appearanceMode('dark'),'dark');assert.equal(appearanceMode('light'),'light');assert.equal(appearanceMode('unknown'),'system');
 assert.equal(resolvedTheme('system','dark'),'dark');assert.equal(resolvedTheme('system','light'),'light');assert.equal(resolvedTheme('system',null),'light');assert.equal(resolvedTheme('light','dark'),'light');assert.equal(resolvedTheme('dark','light'),'dark');
});
test('light and dark palettes keep body, field, button, error and hero text readable',()=>{
 for(const [name,p] of Object.entries(palettes))for(const [foreground,background] of [[p.ink,p.bg],[p.ink,p.white],[p.muted,p.white],[p.green,p.bg],[p.green,p.pale],[p.red,p.white],[p.onAccent,p.green],[p.heroInk,p.hero],[p.heroMuted,p.hero]])assert.ok(contrast(foreground,background)>=4.5,`${name} contrast ${foreground}/${background}`);
});
