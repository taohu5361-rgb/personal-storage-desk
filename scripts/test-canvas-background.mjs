import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { canvasSurfaceStyle, resolveCanvasAppearance, normalizeCanvasColor } from '../src/canvasAppearance.js';

const checks = [];
for (const zoom of [.1,.2,.51,.83,1,1.5,2,5]) {
  const s = canvasSurfaceStyle({color:'#ffffff'},{x:-1234567.5,y:987654.25,zoom});
  const spacing = parseFloat(s.backgroundSize);
  assert.ok(spacing >= 40 && spacing < 80.00001);
  for(const v of s.backgroundPosition.split(' ')) assert.ok(parseFloat(v)>=0 && parseFloat(v)<spacing);
}
assert.equal(normalizeCanvasColor('#f7f7f7'),'#ffffff');
assert.equal(normalizeCanvasColor('#3b3d42'),'#000000');
assert.deepEqual(resolveCanvasAppearance({},{canvasBackgroundColor:'#000000',canvasBackground:'solid'}),{color:'#000000',pattern:'solid'});
checks.push('旧颜色兼容、默认继承、10%–500% 网格间距与负坐标相位');
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const output = path.resolve(process.argv[2] || '.canvas-background-qa');mkdirSync(output,{recursive:true});
const browser = await chromium.launch({channel:'msedge',headless:true});
const page = await browser.newPage({viewport:{width:1280,height:820}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const surface = () => page.locator('.asset-canvas, .asset-inner-canvas');
const paint = () => surface().evaluate(node=>{const s=getComputedStyle(node);return {color:s.backgroundColor,image:s.backgroundImage,size:s.backgroundSize,position:s.backgroundPosition,rect:{width:node.clientWidth,height:node.clientHeight},text:s.getPropertyValue('--canvas-foreground').trim()};});
try {
  await page.goto('http://127.0.0.1:5193/scripts/verify-canvas-background.html');
  await page.waitForSelector('.asset-canvas');
  await page.getByRole('button',{name:'画布背景',exact:true}).click();
  assert.equal(await page.locator('.canvas-appearance-panel select, .canvas-appearance-panel input[type=color]').count(),0);
  for(const theme of ['dark','light']) {
    await page.evaluate(t=>window.canvasQA.setTheme(t),theme);
    for(const [label,color] of [['黑色','rgb(24, 27, 32)'],['白色','rgb(255, 255, 255)']]) {
      await page.getByRole('button',{name:label,exact:true}).click();
      assert.equal((await paint()).color,color);
      assert.equal(await page.getByRole('button',{name:label,exact:true}).getAttribute('aria-pressed'),'true');
      for(const [label,pattern] of [['无网格','solid'],['柔和点阵','dots'],['轻网格','grid']]) {
        await page.getByRole('button',{name:label,exact:true}).click();
        const p=await paint();assert.equal(p.color,color);
        assert.equal(p.image==='none',pattern==='solid');
        if(pattern==='dots')assert.match(p.image,/radial-gradient/);
        if(pattern==='grid')assert.match(p.image,/linear-gradient/);
      }
    }
  }
  checks.push('深浅应用主题 × 黑白画布 × 三种网格，实际 CSS 渲染与按钮状态一致');
  await page.evaluate(()=>window.canvasQA.setTheme('dark'));
  await page.getByRole('button',{name:'柔和点阵',exact:true}).click();
  await page.screenshot({path:path.join(output,'white-dots.png')});
  await page.getByRole('button',{name:'黑色',exact:true}).click();
  await page.screenshot({path:path.join(output,'black-dots.png')});
  for(const mode of ['outer','inner']) {
    await page.evaluate(m=>window.canvasQA.setMode(m),mode);
    await page.waitForSelector(mode==='outer'?'.asset-canvas':'.asset-inner-canvas');
    for(const zoom of [.1,.51,1,2,5]) {
      await page.evaluate(z=>window.canvasQA.update({viewportX:-10021.5,viewportY:9023.25,zoom:z}),zoom);
      await page.waitForTimeout(50);
      const p=await paint();assert.equal(p.color,'rgb(24, 27, 32)');assert.ok(parseFloat(p.size)>=40 && parseFloat(p.size)<=80);
    }
    const rect=await surface().boundingBox();
    const before=await paint();await page.mouse.move(rect.x+100,rect.y+110);await page.mouse.down({button:'middle'});
    await page.mouse.move(rect.x+247,rect.y+199,{steps:8});await page.mouse.up({button:'middle'});await page.waitForTimeout(280);
    assert.notEqual((await paint()).position,before.position);
    await page.mouse.wheel(0,-200);await page.waitForTimeout(300);
    assert.equal((await paint()).color,'rgb(24, 27, 32)');
    await page.screenshot({path:path.join(output,`${mode}-pan-zoom.png`)});
  }
  checks.push('内外画布 10%–500% 缩放、大幅正负平移、真实中键平移与滚轮缩放');
  await page.reload();await page.waitForSelector('.asset-canvas');
  assert.equal((await paint()).color,'rgb(24, 27, 32)');
  checks.push('浏览器隔离存储重载恢复');
  await page.setViewportSize({width:800,height:600});
  await page.getByRole('button',{name:'画布背景',exact:true}).click();
  await page.getByRole('button',{name:'白色',exact:true}).focus();await page.keyboard.press('Space');
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.asset-canvas')).backgroundColor==='rgb(255, 255, 255)');
  assert.equal((await paint()).color,'rgb(255, 255, 255)');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);checks.push('键盘切换、800px 宽度无溢出、无页面运行错误');
  writeFileSync(path.join(output,'result.json'),JSON.stringify({checks,errors},null,2));
  console.log(JSON.stringify({checks,errors},null,2));
} finally {await browser.close();}
