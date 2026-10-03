import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cargoHome = process.env.CARGO_HOME || path.join(os.homedir(), '.cargo');
const mappings = [
  [os.homedir(), '/user'],
  [path.resolve(cargoHome), '/cargo'],
  [root, '/project'],
];
// Cargo's encoded form preserves paths containing spaces. Existing encoded flags
// remain intact; ordinary RUSTFLAGS are supported when they contain simple flags.
const existing = process.env.CARGO_ENCODED_RUSTFLAGS
  ? process.env.CARGO_ENCODED_RUSTFLAGS.split('\x1f')
  : (process.env.RUSTFLAGS || '').split(/\s+/).filter(Boolean);
// rustc uses the last matching mapping. Broad home mappings come first, and
// Windows separator variants precede the more specific project mapping.
const remapping = mappings.flatMap(([from, to]) =>
  [...new Set([from, from.replaceAll('\\', '/')])].map(prefix => `--remap-path-prefix=${prefix}=${to}`));
const flags = [...existing, ...remapping];
const result = spawnSync(process.execPath, [
  path.join(root, 'node_modules', '@tauri-apps', 'cli', 'tauri.js'),
  'build', '--no-bundle', ...process.argv.slice(2),
], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, CARGO_ENCODED_RUSTFLAGS: flags.join('\x1f') },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
