import test from 'node:test';
import assert from 'node:assert/strict';
import { clientToSurface, surfaceToWorld, clientWorldDelta, zoomViewportAt, resizeInnerObject } from './innerCanvasGeometry.js';
import { textBlockPreset, placeholderColor, colorHex } from '../data/textBlockAppearance.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
for(const zoom of [.83,1,1.19]) for(const uiScale of [.75,1,1.5]) test(`coordinate roundtrip, drag and anchored zoom ${zoom}/${uiScale}`,()=>{
 const rect={left:33,top:71}, view={x:-47,y:83,zoom}, world={x:215,y:139};
 const client={clientX:rect.left+(view.x+world.x*zoom)*uiScale,clientY:rect.top+(view.y+world.y*zoom)*uiScale};
 const local=clientToSurface(client,rect,uiScale),actual=surfaceToWorld(local,view);close(actual.x,world.x);close(actual.y,world.y);
 for(const grab of [{x:5,y:8},{x:150,y:36}]) {
  const start={startX:client.clientX+grab.x*zoom*uiScale,startY:client.clientY+grab.y*zoom*uiScale};
  const moved={clientX:start.startX+60*zoom*uiScale,clientY:start.startY-40*zoom*uiScale};
  const delta=clientWorldDelta(moved,start,view,uiScale);close(delta.x,60);close(delta.y,-40);
 }
 const next=zoomViewportAt(view,1.7,local);const anchored=surfaceToWorld(local,next);close(anchored.x,world.x);close(anchored.y,world.y);
 const pan={...view,x:view.x+80/uiScale,y:view.y-50/uiScale};close(pan.x-view.x,80/uiScale);close(pan.y-view.y,-50/uiScale);
});
for(const corner of ['nw','ne','sw','se']) test(`resize opposite anchor and sample aspect ${corner}`,()=>{
 const source={x:100,y:200,width:240,height:150,objectType:'textBlock',textValue:'保留正文'};
 const next=resizeInnerObject(source,corner,30,20);assert.equal(next.textValue,source.textValue);
 close(corner.includes('w')?next.x+next.width:next.x,corner.includes('w')?340:100);
 close(corner.includes('n')?next.y+next.height:next.y,corner.includes('n')?350:200);
 for(const dx of [-10000,30,10000]) {const sample=resizeInnerObject({...source,objectType:'sample'},corner,dx,20);close(sample.width/sample.height,1.6);assert.ok(sample.width>=80&&sample.height>0&&sample.width<=3000);}
 assert.deepEqual(source,{x:100,y:200,width:240,height:150,objectType:'textBlock',textValue:'保留正文'});
});
test('text resize constraints do not move the opposite corner',()=>{const r=resizeInnerObject({x:10,y:20,width:240,height:150,objectType:'note'},'nw',10000,10000);assert.deepEqual([r.width,r.height,r.x,r.y],[80,60,170,110]);});
test('explicit dark/light presets and contrast are separate from body color',()=>{
 for(const theme of [{surface:'#20252b',text:'#edf1f5',border:'rgb(50, 60, 70)'},{surface:'#ffffff',text:'#222222',border:'#ddd'}]) for(const type of ['plain','card','sticky','panel']) {
  const preset=textBlockPreset(type,theme);assert.equal(preset.backgroundOpacity,type==='plain'?0:100);assert.equal(preset.borderRadius,type==='plain'?0:8);assert.equal(preset.backgroundColor,type==='sticky'?'#f6e9ad':theme.surface);assert.equal(preset.textColor,type==='sticky'?'#3d392b':theme.text);
 }
 assert.equal(colorHex('rgba(50, 60, 70, .3)'),'#323c46');assert.equal(colorHex('#AbC'),'#aabbcc');
 assert.equal(textBlockPreset('card',{surface:'#20242a',border:'rgba(255, 255, 255, 0.08)'}).borderColor,'#32363b');
 assert.equal(placeholderColor({backgroundColor:'#f6e9ad',backgroundOpacity:100,textColor:'#ff0000'}),'#625d4c');
 assert.equal(placeholderColor({backgroundColor:'#20252b',backgroundOpacity:100}),'#bbc3ce');
 assert.equal(placeholderColor({backgroundColor:'#fff',backgroundOpacity:0}),'var(--text-muted)');
 assert.equal(placeholderColor({backgroundColor:'#ffffff',backgroundOpacity:10},'#191d21'),'#bbc3ce');
});

const { createTextBlockItem, applyTextBlockStyle, toCanvasTextBlock, fromCanvasTextBlock } = await import('../data/innerCanvasText.js');
test('new objects apply explicit themes; user-applied presets preserve contents, fonts and geometry',()=>{
 const theme={surface:'#20242a',text:'#eeeeee',border:'rgba(255,255,255,.08)'};
 for(const type of ['plain','card','sticky','panel']) {
  const item=createTextBlockItem('isolated',{x:123,y:-47},type,7,theme);
  assert.equal(item.styleType,type);assert.equal(item.x,123);assert.equal(item.y,-47);assert.equal(item.zIndex,7);
  const old={...item,textValue:'旧的中文正文',fontSize:48,fontFamily:'Custom font',width:420,height:320,groupId:'g'};
  const changed={...old,...applyTextBlockStyle(old,'panel',theme)};
  for(const key of ['textValue','fontSize','fontFamily','x','y','width','height','groupId'])assert.equal(changed[key],old[key]);
  const reloaded=fromCanvasTextBlock(toCanvasTextBlock(changed));for(const key of ['textValue','fontSize','fontFamily','x','y','width','height','groupId','backgroundColor','borderColor'])assert.equal(reloaded[key],changed[key]);
 }
});
