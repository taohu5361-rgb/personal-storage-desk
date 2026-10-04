import { call, id as makeId } from "./database";

const saveQueues = new Map();
const confirmedOwners = new Map();

export function flushAssetNoteDrawerSaves() { return Promise.all([...saveQueues.values()]); }

export async function listCategoryNoteDrawers(categoryId) {
  await Promise.allSettled([...saveQueues.values()]);
  const items = await call("list_category_note_drawers", { categoryId });
  for (const item of items) confirmedOwners.set(item.id, item.assetId ?? null);
  return items;
}

export async function listAssetNoteDrawers(assetIds) {
  if (!assetIds.length) return [];
  await Promise.allSettled([...saveQueues.values()]);
  return call("list_asset_note_drawers", { assetIds });
}

export function createAssetNoteDrawer(asset, placement) {
  const now = Date.now();
  const drawer = {
    ...placement,
    id: makeId("asset-note-drawer"),
    assetId: asset.id,
    categoryId: asset.categoryId,
    text: "",
    createdAt: now,
    updatedAt: now,
  };
  return call("create_asset_note_drawer", { drawer }).then((saved) => {
    confirmedOwners.set(saved.id, saved.assetId ?? null);
    return saved;
  });
}

export function createIndependentNoteDrawer(categoryId, point) {
  return createAssetNoteDrawer({ id: null, categoryId }, {
    mode: "floating", side: "right", offset: 0, floatingX: point.x, floatingY: point.y,
    width: 240, height: 150, orderIndex: 0, locked: false, textScale: 1, styleVariant: "default",
  });
}

export function saveAssetNoteDrawer(drawer, previousDrawer) {
  const payload = { ...drawer, updatedAt: Date.now() };
  const previous = saveQueues.get(drawer.id) || Promise.resolve();
  const next = previous.catch(() => {}).then(async () => {
    // Choose the command only once earlier writes have completed. A failed
    // transfer leaves the confirmed owner unchanged for subsequent queued edits.
    const expectedAssetId = confirmedOwners.has(drawer.id) ? confirmedOwners.get(drawer.id) : previousDrawer?.assetId ?? payload.assetId ?? null;
    const transferring = expectedAssetId !== (payload.assetId ?? null);
    const saved = await call(transferring ? "transfer_asset_note_drawer" : "save_asset_note_drawer",
      transferring ? { drawer: payload, expectedAssetId } : { drawer: payload });
    confirmedOwners.set(saved.id, saved.assetId ?? null);
    return saved;
  });
  saveQueues.set(drawer.id, next);
  const cleanup = () => {
    if (saveQueues.get(drawer.id) === next) saveQueues.delete(drawer.id);
  };
  void next.then(cleanup, cleanup);
  return next;
}

export async function deleteAssetNoteDrawer(drawer) {
  await saveQueues.get(drawer.id)?.catch(() => {});
  await call("delete_asset_note_drawer", { id: drawer.id, assetId: confirmedOwners.has(drawer.id) ? confirmedOwners.get(drawer.id) : drawer.assetId ?? null });
  confirmedOwners.delete(drawer.id);
}
