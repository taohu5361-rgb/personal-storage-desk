// Cut moves existing identities so prompts, text and notes keep their ownership.
// Successful moves are remembered when a later operation needs retrying.
export async function pasteAssetClipboard(clipboard, create, move) {
  const moving = Boolean(clipboard.cutIds?.length);
  const copies = moving ? (clipboard.completedMoves ||= new Map()) : new Map();
  for (const [index, asset] of clipboard.entries()) {
    if (!copies.has(asset.id)) copies.set(asset.id, await (moving ? move : create)(asset, index));
  }
  return [...copies.values()];
}
