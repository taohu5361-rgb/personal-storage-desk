import { call, id as makeId } from "./database";

const saveQueues = new Map();

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
    text: "",
    createdAt: now,
    updatedAt: now,
  };
  return call("create_asset_note_drawer", { drawer });
}

export function saveAssetNoteDrawer(drawer) {
  const payload = { ...drawer, updatedAt: Date.now() };
  const previous = saveQueues.get(drawer.id) || Promise.resolve();
  const next = previous.catch(() => {}).then(() =>
    call("save_asset_note_drawer", { drawer: payload }),
  );
  saveQueues.set(drawer.id, next);
  const cleanup = () => {
    if (saveQueues.get(drawer.id) === next) saveQueues.delete(drawer.id);
  };
  void next.then(cleanup, cleanup);
  return next;
}

export async function deleteAssetNoteDrawer(drawer) {
  await saveQueues.get(drawer.id)?.catch(() => {});
  return call("delete_asset_note_drawer", { id: drawer.id, assetId: drawer.assetId });
}
