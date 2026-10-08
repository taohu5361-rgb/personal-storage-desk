export const normalizeRoutePath = (path = '') =>
  String(path).replace(/^#\/?/, '').replace(/^\/+/, '') || 'home';

export function parseRoutePath(path) {
  const normalized = normalizeRoutePath(path);
  const separator = normalized.indexOf('?');
  const pathname = separator < 0 ? normalized : normalized.slice(0, separator);
  return {
    path: normalized,
    parts: pathname.split('/').filter(Boolean),
    query: new URLSearchParams(separator < 0 ? '' : normalized.slice(separator + 1)),
  };
}

export function routeDomain(path) {
  const [page] = parseRoutePath(path).parts;
  if (page === 'scripts') return 'scripts';
  if (['models', 'assets', 'asset', 'add-example'].includes(page)) return 'canvas';
  return '';
}

// Resolve a real parent when the page was opened directly or its source vanished.
export function parentRoutePath(path, data = {}) {
  const { parts } = parseRoutePath(path);
  const [page, workspaceId, assetId] = parts;
  const asset = (data.assets || []).find(item => item.id === assetId && item.workspaceId === workspaceId);
  const workspace = (data.workspaces || []).find(item => item.id === workspaceId);
  if (page === 'add-example' && asset) return `asset/${workspaceId}/${assetId}`;
  if (page === 'asset' && asset) {
    return `assets/${workspaceId}?${new URLSearchParams({ category: asset.categoryId })}`;
  }
  if (['asset', 'add-example'].includes(page) && workspace) return `assets/${workspaceId}`;
  if (['assets', 'asset', 'add-example'].includes(page)) return 'models';
  return 'home';
}

export function isAvailableRoute(path, data = {}) {
  const { parts, query } = parseRoutePath(path);
  const [page, workspaceId, assetId] = parts;
  if (['home', 'scripts', 'models', 'settings'].includes(page)) return true;
  if (!['assets', 'asset', 'add-example'].includes(page)) return false;
  if (!(data.workspaces || []).some(item => item.id === workspaceId)) return false;
  if (page !== 'assets') return (data.assets || []).some(item => item.id === assetId && item.workspaceId === workspaceId);
  const categoryId = query.get('category');
  return !categoryId || (data.categories || []).some(item => item.id === categoryId && item.workspaceId === workspaceId);
}

export function returnRoutePath(source, currentPath, data = {}) {
  if (source && normalizeRoutePath(source) !== normalizeRoutePath(currentPath)) {
    return isAvailableRoute(source, data) ? normalizeRoutePath(source) : parentRoutePath(source, data);
  }
  return parentRoutePath(currentPath, data);
}

export function createNavigationContext() {
  return { settingsSource: '', recent: { scripts: 'scripts', canvas: 'models' }, assetSources: {} };
}

// Call only after go() succeeds (or for an accepted browser-history route).
export function recordNavigation(context, from, to) {
  const source = normalizeRoutePath(from);
  const destination = normalizeRoutePath(to);
  const next = { ...context, recent: { ...context.recent }, assetSources: { ...context.assetSources } };
  const fromDomain = routeDomain(source);
  const toDomain = routeDomain(destination);
  if (fromDomain) next.recent[fromDomain] = source;
  if (toDomain) next.recent[toDomain] = destination;
  if (parseRoutePath(destination).parts[0] === 'settings' && parseRoutePath(source).parts[0] !== 'settings') next.settingsSource = source;
  const [page, workspaceId, assetId] = parseRoutePath(destination).parts;
  const [sourcePage, sourceWorkspaceId] = parseRoutePath(source).parts;
  if (page === 'asset' && sourcePage === 'assets' && workspaceId === sourceWorkspaceId) next.assetSources[assetId] = source;
  return next;
}

export function contextualBackPath(context, currentPath, data = {}) {
  const [page, , assetId] = parseRoutePath(currentPath).parts;
  const source = page === 'settings' ? context.settingsSource : page === 'asset' ? context.assetSources[assetId] : '';
  return returnRoutePath(source, currentPath, data);
}

export function recentDomainPath(context, domain, data = {}) {
  const fallback = domain === 'scripts' ? 'scripts' : 'models';
  const path = context.recent[domain] || fallback;
  return isAvailableRoute(path, data) ? path : parentRoutePath(path, data);
}

// A URL is accepted only after its save guard resolves. Programmatic writes use
// pushState/replaceState, so they do not cause a second hashchange save cycle.
export function createNavigationController({ initialPath, readPath, writePath, commit, flush }) {
  let acceptedPath = normalizeRoutePath(initialPath);
  let generation = 0;
  let active = true;
  const restore = () => {
    if (normalizeRoutePath(readPath()) !== acceptedPath) writePath(acceptedPath, { replace: true });
  };
  const accept = async (requested, { external = false, replace = false } = {}) => {
    if (!active) return false;
    const path = normalizeRoutePath(requested);
    const ticket = ++generation;
    if (path === acceptedPath) { restore(); return true; }
    let saved = false;
    try { saved = await flush(); } catch { saved = false; }
    if (ticket !== generation || !active) return false;
    if (!saved) { restore(); return false; }
    if (!external) writePath(path, { replace });
    acceptedPath = path;
    commit(parseRoutePath(path));
    return true;
  };
  return {
    go: (path, options = {}) => accept(path, options),
    onHashChange: () => accept(readPath(), { external: true }),
    acceptedPath: () => acceptedPath,
    cancel: () => { generation++; },
    setActive: value => { active = Boolean(value); },
  };
}
