import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { mockIPC } from '@tauri-apps/api/mocks';
import { AssetCanvas } from '../src/components/AssetCanvas';
import { AssetTextSurface } from '../src/components/AssetTextSurface';
import '../src/theme.css';
import '../src/styles.css';

document.documentElement.dataset.theme = 'dark';
document.documentElement.dataset.effectiveTheme = 'dark';
let drawers = [{ id: 'qa-drawer', assetId: 'qa-asset', text: '备注', mode: 'docked-expanded', side: 'right', offset: 0, width: 240, height: 150, orderIndex: 0, locked: false, createdAt: 1, updatedAt: 1 }];
mockIPC(async (command, args) => {
  if ((command === 'list_asset_note_drawers' || command === 'list_category_note_drawers')) return drawers;
  if (command === 'save_asset_note_drawer') { drawers = drawers.map(item => item.id === args.drawer.id ? args.drawer : item); return args.drawer; }
  if (command === 'set_asset_text_close_guard') return;
  throw Error('Unexpected IPC ' + command);
});
const objects = [
  { objectId: 'sample', objectType: 'sample', sourcePromptId: 'qa-prompt', x: -600, y: -300, width: 400, height: 300, zIndex: 1, groupId: 'inner-group' },
  { objectId: 'note', objectType: 'note', sourcePromptId: 'qa-prompt', x: 380, y: 90, width: 260, height: 160, zIndex: 2 },
];
const initialText = { id: 'qa-text', categoryId: 'qa-category', content: '小地图文字', styleType: 'plain', x: 80, y: 500, width: 240, height: 100, zIndex: 2, fontFamily: 'system-ui', fontSize: 16, color: '#ffffff', opacity: 1, createdAt: 1, updatedAt: 1 };
function Fixture() {
  const [mode, setMode] = useState('outer'), [search, setSearch] = useState('');
  const [category, setCategory] = useState({ id: 'qa-category', viewportX: 0, viewportY: 0, zoom: 1, canvasColor: '#000000', canvasPattern: 'grid' });
  const [assets, setAssets] = useState([{ id: 'qa-asset', name: '图片', x: -600, y: -300, width: 400, height: 300, tags: [], zIndex: 1, groupId: 'qa-group' }, { id: 'far-asset', name: '远处', x: 14000, y: -5000, width: 240, height: 180, tags: [], zIndex: 2 }]);
  const [groups, setGroups] = useState([{ id: 'qa-group', name: '素材组', x: -624, y: -334, width: 448, height: 390, borderColor: '#79898d', zIndex: 1, collapsed: false }]);
  const [text, setText] = useState([initialText]), [innerObjects, setInnerObjects] = useState(objects);
  const outerRef = useRef(null);
  window.minimapQA = {
    mode, category, assets, groups, text, innerObjects, setMode, setSearch, setAssets, setGroups, setInnerObjects, setText,
    setView: change => setCategory(value => ({ ...value, ...change })),
    setTheme: value => { document.documentElement.dataset.theme = value; document.documentElement.dataset.effectiveTheme = value; },
    scene: id => setCategory(value => ({ ...value, id })),
    fit: () => outerRef.current?.fitAll(),
  };
  const saveText = async changes => setText(current => [...current.filter(item => !changes.deleteIds.includes(item.id) && !changes.upserts.some(next => next.id === item.id)), ...changes.upserts]);
  return <main className="app-shell" style={{ padding: 12 }}>
    {mode === 'outer' ? <AssetCanvas ref={outerRef} assets={assets} groups={groups} textBlocks={text} activeCategory={category} search={search} categories={[]}
      settings={{ autoSave: true, showAssetTags: true }} onAssetsChange={setAssets} onGroupsChange={setGroups} onViewportChange={change => setCategory(value => ({ ...value, ...change }))}
      onOpen={() => {}} onSaveText={saveText} onCanvasAppearance={({ color, pattern }) => setCategory(value => ({ ...value, canvasColor: color, canvasPattern: pattern }))} />
      : <AssetTextSurface viewMode={mode === 'standard' ? 'standard' : 'canvas'} assetId="qa-inner" objects={innerObjects} textBlocks={[]}
        prompts={[{ id: 'qa-prompt', notes: '备注', title: '样图' }]} initialViewport={category} onSaveObjects={setInnerObjects} onSaveViewport={view => setCategory(value => ({ ...value, viewportX: view.x, viewportY: view.y, zoom: view.zoom }))} onAddSample={() => {}} onEditPrompt={() => {}} />}
  </main>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
