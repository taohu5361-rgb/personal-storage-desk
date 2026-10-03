import { convertFileSrc, invoke } from '@tauri-apps/api/core'

export const legacyKeys = {
  workspaces: 'script-collection.image-models-v3',
  assets: 'script-collection.assets-v3',
  categories: 'script-collection.asset-categories-v3',
  scriptCategories: 'script-collection.custom-script-categories',
}

export const id = (prefix) => `${prefix}-${crypto.randomUUID()}`
export const fileUrl = (path) => path ? convertFileSrc(path) : ''
export const call = (command, args = {}) => invoke(command, args)

const readLegacy = (key) => {
  try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : [] } catch { return [] }
}

export async function bootDatabase() {
  const current = await call('load_app_state')
  if (!current.settings.migrationCompleted) {
    const payload = {
      workspaces: readLegacy(legacyKeys.workspaces),
      assets: readLegacy(legacyKeys.assets),
      categories: readLegacy(legacyKeys.categories),
      scriptCategories: readLegacy(legacyKeys.scriptCategories),
    }
    const result = await call('migrate_legacy_data', { payload })
    if (result.success) Object.values(legacyKeys).forEach((key) => localStorage.removeItem(key))
    else throw new Error(`旧数据迁移未完成：${result.errors.join('；')}。日志：${result.logPath}`)
  }
  return call('load_app_state')
}
