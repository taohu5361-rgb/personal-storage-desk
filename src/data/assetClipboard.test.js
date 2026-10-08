import test from 'node:test';
import assert from 'node:assert/strict';
import {pasteAssetClipboard} from './assetClipboard.js';
test('cut retains identities and never creates replacements or deletes its sources', async()=>{
  const clipboard=[{id:'a',promptId:'p'},{id:'b'}];clipboard.cutIds=['a','b'];const moves=[];
  const result=await pasteAssetClipboard(clipboard,()=>assert.fail('cut must not create a replacement'),async asset=>{moves.push(asset.id);return asset.id});
  assert.deepEqual(result,['a','b']);assert.deepEqual(moves,['a','b']);assert.equal(clipboard[0].promptId,'p');
});
test('a failed move resumes remaining identities without duplicating acknowledged moves',async()=>{
  const clipboard=[{id:'a'},{id:'b'}];clipboard.cutIds=['a','b'];let fail=true;const moved=[];
  const move=async asset=>{if(asset.id==='b'&&fail)throw Error('move failed');moved.push(asset.id);return asset.id};
  await assert.rejects(pasteAssetClipboard(clipboard,()=>assert.fail('cut must not copy'),move));
  fail=false;await pasteAssetClipboard(clipboard,()=>assert.fail('cut must not copy'),move);assert.deepEqual(moved,['a','b']);
});
test('copy can be pasted repeatedly and never invokes a move',async()=>{
  const clipboard=[{id:'a'}];let created=0;
  const create=async()=>++created;const move=()=>assert.fail('copy must not move');
  await pasteAssetClipboard(clipboard,create,move);await pasteAssetClipboard(clipboard,create,move);assert.equal(created,2);
});
