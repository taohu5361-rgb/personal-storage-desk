import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePropertyPanelLayout } from './propertyPanelLayout.js';

test('existing settings and unsupported values retain the original right layout', () => {
  for (const value of [undefined, null, '', 'left', 'RIGHT', 1, {}, []]) {
    assert.equal(resolvePropertyPanelLayout(value), 'right');
  }
});

test('both persisted layouts resolve consistently after loading settings snapshots', () => {
  for (const propertyPanelLayout of ['right', 'bottom']) {
    const restored = JSON.parse(JSON.stringify({ theme: 'dark', propertyPanelLayout }));
    assert.equal(resolvePropertyPanelLayout(restored.propertyPanelLayout), propertyPanelLayout);
  }
});
