import React,{useState} from 'react';import{createRoot}from'react-dom/client';
import{AssetInnerCanvas}from'../src/components/AssetInnerCanvas';
import{createTextBlockItem,toCanvasTextBlock}from'../src/data/innerCanvasText';
import'../src/theme.css';import'../src/styles.css';
window.__TAURI_INTERNALS__={convertFileSrc:()=> 'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260"><rect width="400" height="260" fill="#c4cbd2"/><path d="M0 210L125 80l95 105 85-120 95 160" fill="#72818d"/><circle cx="295" cy="62" r="25" fill="#eef1df"/></svg>')};
const theme={surface:'#20252b',text:'#e8edf2',border:'#363e47'};
const base=['plain','sticky','card','panel'].map((type,i)=>{const item=createTextBlockItem('verification',{x:i%2*350+50,y:Math.floor(i/2)*240+70},type,i+2,theme);return toCanvasTextBlock({...item,objectId:type,width:300,height:180,fontSize:type==='plain'?48:16,textColor:type==='plain'?'#ff2222':item.textColor,textValue:type==='panel'?'这是信息面板的正文。':'',title:type==='panel'?'项目信息':''});});
const objects=[{objectId:'sample',objectType:'sample',sourcePromptId:'p',fieldKey:'',x:750,y:70,width:240,height:156,zIndex:1,locked:false},{objectId:'prompt',objectType:'prompt',sourcePromptId:'p',fieldKey:'positivePrompt',x:750,y:260,width:240,height:130,zIndex:1},{objectId:'note',objectType:'note',sourcePromptId:'p',fieldKey:'notes',x:750,y:420,width:240,height:120,zIndex:1},{objectId:'locked',objectType:'note',sourcePromptId:'p',fieldKey:'notes',x:50,y:555,width:240,height:80,zIndex:1,locked:true}];
const prompts=[{id:'p',title:'独立测试样图',sampleImagePath:'fixture.svg',positivePrompt:'示例 Prompt / 保持关联数据',notes:'独立验收备注'}];
const nextFrame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
const close=(a,b,label)=>{if(Math.abs(a-b)>.08)throw Error(label+': '+a+' != '+b);};
function Fixture(){
 const [data,setData]=useState(()=>JSON.parse(localStorage.getItem('inner-canvas-isolated-verification')||'null')||{objects,textBlocks:base});
 const[view,setView]=useState({viewportX:30,viewportY:25,zoom:1});const[ui,setUi]=useState('1');const[report,setReport]=useState('准备');const[narrow,setNarrow]=useState(false);const[mode,setMode]=useState('dark');
 const themeMode=(value)=>{setMode(value);document.documentElement.dataset.theme=value;document.documentElement.dataset.effectiveTheme=value;};
 const uiMode=(value)=>{setUi(value);document.documentElement.style.setProperty('--ui-scale',value);};
 const save=(entries,options)=>{const next={objects:entries,textBlocks:options.textBlocks.map(toCanvasTextBlock)};localStorage.setItem('inner-canvas-isolated-verification',JSON.stringify(next));setData(next);};
 const perform=async()=>{let checks=0;try{
  for(const scale of [.75,1,1.5])for(const zoom of [.83,1,1.19]){
   uiMode(String(scale));setView({viewportX:-37,viewportY:25,zoom});await nextFrame();
   const element=document.querySelector('[data-object-id="plain"]');element.focus();await nextFrame();
   const control=element.querySelector('.inner-resize-handle.se'), cs=getComputedStyle(element), r=control.getBoundingClientRect();
   close(r.width,20,'hit width');close(r.height,20,'hit height');close(parseFloat(getComputedStyle(control,'::after').width)*scale*zoom*parseFloat(cs.getPropertyValue('--inner-control-scale')),6,'square size');
   close(parseFloat(getComputedStyle(element.querySelector('.inner-object-outline')).boxShadow.match(/ ([\d.]+)px$/)[1])*scale*zoom,1,'outline');
   const old={x:parseFloat(element.style.left),y:parseFloat(element.style.top),w:parseFloat(element.style.width),h:parseFloat(element.style.height)};
   const b=element.getBoundingClientRect();const start={clientX:b.left+45*zoom*scale,clientY:b.top+30*zoom*scale,pointerId:33,bubbles:true,button:0};
   element.dispatchEvent(new PointerEvent('pointerdown',start));window.dispatchEvent(new PointerEvent('pointermove',{...start,clientX:start.clientX+4}));await nextFrame();if(element.classList.contains('moving'))throw Error('early activation');
   window.dispatchEvent(new PointerEvent('pointermove',{...start,clientX:start.clientX+40*zoom*scale,clientY:start.clientY+25*zoom*scale}));await nextFrame();
   close(parseFloat(element.style.left),old.x+40,'drag x');close(parseFloat(element.style.top),old.y+25,'drag y');if(element.querySelector('.inner-resize-handle'))throw Error('moving handles');
   window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await nextFrame();close(parseFloat(element.style.left),old.x,'escape restore');
   for(const corner of ['nw','ne','sw','se']){
    const handle=element.querySelector('.inner-resize-handle.'+corner);const hb=handle.getBoundingClientRect();const hstart={clientX:hb.left+10,clientY:hb.top+10,pointerId:34,bubbles:true,button:0};
    if(document.elementFromPoint(hstart.clientX,hstart.clientY)!==handle)throw Error('handle hit blocked '+corner);
    handle.dispatchEvent(new PointerEvent('pointerdown',hstart));window.dispatchEvent(new PointerEvent('pointermove',{...hstart,clientX:hstart.clientX+20*zoom*scale,clientY:hstart.clientY+15*zoom*scale}));await nextFrame();
    if(!element.classList.contains('resizing')||element.classList.contains('moving'))throw Error('resize state');
    if([...element.querySelectorAll('.inner-resize-handle')].filter(e=>getComputedStyle(e).visibility!=='hidden').length!==1)throw Error('active corner count');
    close(parseFloat(element.style.width),old.w+(corner.includes('e')?20:-20),'width');close(parseFloat(element.style.height),old.h+(corner.includes('s')?15:-15),'height');
    if(getComputedStyle(element).transform!=='none')throw Error('resize scale');window.dispatchEvent(new PointerEvent('pointercancel',hstart));await nextFrame();close(parseFloat(element.style.width),old.w,'cancel width');close(parseFloat(element.style.top),old.y,'cancel y');checks++;
   }
   const surface=document.querySelector('.asset-inner-canvas'),sb=surface.getBoundingClientRect(),world=document.querySelector('.inner-canvas-world');
   // Synthetic pointer IDs are not registered by the browser; native capture is covered by real-pointer tests.
   const nativeCapture=surface.setPointerCapture;surface.setPointerCapture=()=>{};
   const panstart={clientX:sb.left+10,clientY:sb.bottom-10,button:1,buttons:4,pointerId:35,bubbles:true};surface.dispatchEvent(new PointerEvent('pointerdown',panstart));surface.setPointerCapture=nativeCapture;window.dispatchEvent(new PointerEvent('pointermove',{...panstart,clientX:panstart.clientX+40*scale,clientY:panstart.clientY-30*scale}));await nextFrame();
   const matrix=new DOMMatrix(getComputedStyle(world).transform);close(matrix.e,3,'pan x');close(matrix.f,-5,'pan y');window.dispatchEvent(new PointerEvent('pointercancel',panstart));await nextFrame();
   const anchor={x:420,y:610},before=new DOMMatrix(getComputedStyle(world).transform);surface.dispatchEvent(new WheelEvent('wheel',{clientX:sb.left+anchor.x*scale,clientY:sb.top+anchor.y*scale,deltaY:100,bubbles:true,cancelable:true}));await nextFrame();const after=new DOMMatrix(getComputedStyle(world).transform);close((anchor.x-after.e)/after.a,(anchor.x-before.e)/before.a,'wheel anchor');
   checks+=4;
  }
  uiMode('1');setView({viewportX:30,viewportY:25,zoom:1});await nextFrame();setReport('PASS '+checks+' 组合、拖动、四角缩放、取消、平移、缩放锚点检查');
 }catch(e){setReport('FAIL '+e.message);}};

 const extras=async()=>{let checks=0;try{
  uiMode('1');setView({viewportX:30,viewportY:25,zoom:1});themeMode('dark');await nextFrame();const surface=document.querySelector('.asset-inner-canvas');
  for(const type of ['sample','prompt','note','plain','sticky','card','panel']) {
   window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await nextFrame();const el=document.querySelector('[data-object-id="'+type+'"]');
   el.dispatchEvent(new PointerEvent('pointerover',{bubbles:true,pointerId:55}));await nextFrame();if(el.querySelector('.inner-resize-handle'))throw Error('hover controls '+type);
   surface.focus();el.focus();await nextFrame();if(el.querySelectorAll('.inner-resize-handle').length!==4)throw Error('selected controls '+type);
   const b=el.getBoundingClientRect(),old={x:parseFloat(el.style.left),y:parseFloat(el.style.top),w:parseFloat(el.style.width),h:parseFloat(el.style.height)};
   const start={clientX:b.left+35,clientY:b.top+25,pointerId:55,bubbles:true,button:0};el.dispatchEvent(new PointerEvent('pointerdown',start));window.dispatchEvent(new PointerEvent('pointermove',{...start,clientX:start.clientX+20,clientY:start.clientY+15}));await nextFrame();
   if(!el.classList.contains('moving')||el.querySelector('.inner-resize-handle'))throw Error('moving state '+type);window.dispatchEvent(new PointerEvent('pointercancel',start));await nextFrame();close(parseFloat(el.style.left),old.x,'cancel move '+type);
   const handle=el.querySelector('.inner-resize-handle.nw'),hb=handle.getBoundingClientRect(),hs={...start,clientX:hb.left+10,clientY:hb.top+10};handle.dispatchEvent(new PointerEvent('pointerdown',hs));window.dispatchEvent(new PointerEvent('pointermove',{...hs,clientX:hs.clientX-30,clientY:hs.clientY-20}));await nextFrame();
   if([...el.querySelectorAll('.inner-resize-handle')].filter(h=>getComputedStyle(h).visibility!=='hidden').length!==1)throw Error('resize count '+type);
   if(type==='sample')close(parseFloat(el.style.width)/parseFloat(el.style.height),old.w/old.h,'sample ratio');window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await nextFrame();close(parseFloat(el.style.width),old.w,'cancel resize '+type);checks+=4;
  }
  const locked=document.querySelector('[data-object-id="locked"]');surface.focus();locked.focus();await nextFrame();if(locked.querySelector('.inner-resize-handle'))throw Error('locked handles');
  const sb=surface.getBoundingClientRect(),start={clientX:sb.left+60,clientY:sb.top+75,button:0,pointerId:56,bubbles:true};surface.dispatchEvent(new PointerEvent('pointerdown',start));window.dispatchEvent(new PointerEvent('pointermove',{...start,clientX:sb.left+390,clientY:sb.top+290}));await nextFrame();
  if([...document.querySelectorAll('.inner-canvas-object.selected')].map(e=>e.dataset.objectId).join(',')!=='plain')throw Error('marquee selection');window.dispatchEvent(new PointerEvent('pointercancel',start));await nextFrame();if(!locked.classList.contains('selected'))throw Error('marquee restore');checks+=3;
  const plain=document.querySelector('[data-object-id="plain"]'),oldMatrix=new DOMMatrix(getComputedStyle(document.querySelector('.inner-canvas-world')).transform),b=plain.getBoundingClientRect(),ps={clientX:b.left+30,clientY:b.top+25,button:0,pointerId:57,bubbles:true};
  window.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space',bubbles:true}));plain.dispatchEvent(new PointerEvent('pointerdown',ps));window.dispatchEvent(new PointerEvent('pointermove',{...ps,clientX:ps.clientX+40,clientY:ps.clientY+30}));await nextFrame();const matrix=new DOMMatrix(getComputedStyle(document.querySelector('.inner-canvas-world')).transform);close(matrix.e,oldMatrix.e+40,'space pan over object');window.dispatchEvent(new PointerEvent('pointercancel',ps));window.dispatchEvent(new KeyboardEvent('keyup',{key:' ',code:'Space',bubbles:true}));await nextFrame();checks++;
  setReport('PASS '+checks+' 对象类型、操作状态、锁定、框选与空格平移检查');
 }catch(e){setReport('FAIL '+e.message);}};
 return <main style={{height:'calc(100vh / var(--ui-scale,1))',padding:16,display:'flex',flexDirection:'column',gap:12,width:narrow?340:'calc(100vw / var(--ui-scale,1))',zoom:'var(--ui-scale,1)'}}>
 <nav style={{display:'flex',flexWrap:'wrap',gap:8}}><strong>内画布独立验收</strong><select aria-label="界面缩放" value={ui} onChange={e=>uiMode(e.target.value)}>{[.75,1,1.5].map(s=><option key={s} value={s}>{s*100}%</option>)}</select><select aria-label="画布缩放" value={view.zoom} onChange={e=>setView({...view,zoom:+e.target.value})}>{[.83,1,1.19].map(s=><option key={s} value={s}>{Math.round(s*100)}%</option>)}</select><button onClick={()=>themeMode(mode==='dark'?'light':'dark')}>切换主题</button><button onClick={()=>setNarrow(!narrow)}>窄窗口</button><button onClick={perform}>运行组合验收</button><button onClick={extras}>运行对象验收</button><button onClick={()=>{localStorage.removeItem('inner-canvas-isolated-verification');setData({objects,textBlocks:base});}}>重置测试数据</button><output>{report}</output></nav>
 <AssetInnerCanvas assetId="verification" objects={data.objects} textBlocks={data.textBlocks} prompts={prompts} initialViewport={view} onSaveObjects={save} onSaveViewport={()=>{}} onAddSample={()=>{}} onEditPrompt={()=>setReport('关联编辑入口正常')}/></main>;
}
document.documentElement.dataset.theme='dark';document.documentElement.dataset.effectiveTheme='dark';
const root=import.meta.hot?.data.root || createRoot(document.getElementById('root'));
if(import.meta.hot)import.meta.hot.data.root=root;
root.render(<Fixture/>);
