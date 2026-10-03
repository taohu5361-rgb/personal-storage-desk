import { call } from './data/database';

const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
const validTheme = value => ['system', 'light', 'dark'].includes(value) ? value : 'system';

export function applyTheme(preference) {
  const theme = validTheme(preference);
  const effective = theme === 'system' ? (systemDark.matches ? 'dark' : 'light') : theme;
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.effectiveTheme = effective;
  root.style.colorScheme = effective;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(root).getPropertyValue('--bg-titlebar').trim();
  return theme;
}

systemDark.addEventListener('change', () => {
  if (document.documentElement.dataset.theme === 'system') applyTheme('system');
});

export async function initializeTheme() {
  try { applyTheme(await call('get_startup_theme')); }
  catch { applyTheme('system'); }
  document.documentElement.dataset.themeReady = 'true';
}
