import fs from 'node:fs';
import postcss from 'postcss';

const styles = postcss.parse(fs.readFileSync('src/styles.css', 'utf8'));
const theme = postcss.parse(fs.readFileSync('src/theme.css', 'utf8'));
const defined = new Set();
theme.walkDecls(declaration => { if (declaration.prop.startsWith('--')) defined.add(declaration.prop); });
styles.walkDecls(declaration => { if (declaration.prop.startsWith('--')) defined.add(declaration.prop); });
const runtimeTokens = new Set(['--ui-scale','--background-opacity','--canvas-background','--canvas-grid-rgb','--inner-font-size','--drawer-inverse-zoom','--drawer-retract-x','--drawer-retract-y','--asset-radius-nw','--asset-radius-ne','--asset-radius-sw','--asset-radius-se']);
const issues = [];
styles.walkDecls(declaration => {
  const selector = declaration.parent.selector || '';
  const isArtwork = /(?:^|[\s,.])\.(?:artwork|art-|tone-)/.test(selector);
  const themedProperty = /^(?:color|background(?:-.*)?|border(?:-.*)?|box-shadow|outline(?:-.*)?|fill|stroke|text-shadow)$/.test(declaration.prop);
  if (!isArtwork && themedProperty && /#[\da-f]{3,8}\b|\brgba?\(\s*(?:\d|#)|\b(?:white|black)\b/i.test(declaration.value)) {
    issues.push(`${declaration.source.start.line}: literal UI color in ${selector}: ${declaration.prop}: ${declaration.value}`);
  }
  for (const match of declaration.value.matchAll(/var\((--[\w-]+)\s*(,)?/g)) {
    // Component-local custom properties and explicit CSS fallbacks are valid.
    if (!defined.has(match[1]) && !runtimeTokens.has(match[1]) && !match[2]) issues.push(`${declaration.source.start.line}: undefined ${match[1]}`);
  }
});
for (const path of ['src/App.jsx','src/components/AppChrome.jsx','src/components/AssetCanvas.jsx','src/components/AssetInnerCanvas.jsx','src/components/AssetSidebar.jsx','src/components/SettingsPage.jsx']) {
  const source = fs.readFileSync(path,'utf8');
  if (/#[\da-f]{3,8}\b|\brgba?\(/i.test(source)) issues.push(`${path}: hardcoded UI color`);
}
if (issues.length) { console.error(issues.join('\n')); process.exitCode = 1; }
else console.log(`Theme audit passed: ${defined.size} tokens; UI colors reside in theme.css.`);
