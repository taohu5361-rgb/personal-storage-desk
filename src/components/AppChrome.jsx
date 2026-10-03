import { useEffect, useState } from 'react'
import { ArrowLeft, Boxes, Minus, Settings, Square, X } from 'lucide-react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { displayShortcut } from '../shortcuts/registry'

const fileMenu = ["save"]
const editMenu = ["undo", "redo", null, "cut", "copy", "paste", null, "delete", null, "select-all"]

export function AppChrome({ children, canBack = false, onBack, onSettings, immersive = false, shortcuts = [], onAction }) {
  const [openMenu, setOpenMenu] = useState("")
  useEffect(() => {
    const close = (event) => {
      if (!event.target.closest?.('.titlebar-menu-wrap')) setOpenMenu("")
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [])
  const byId = new Map(shortcuts.map((item) => [item.actionId, item]))
  const windowControl = async (action) => {
    if (!window.__TAURI_INTERNALS__) return
    const appWindow = getCurrentWindow()
    if (action === 'minimize') await appWindow.minimize()
    if (action === 'toggleMaximize') await appWindow.toggleMaximize()
    if (action === 'close') await appWindow.close()
  }
  return (
    <div className={`app-shell ${immersive ? 'immersive' : ''}`}>
      <header className="titlebar">
        <div className="titlebar-left">
          <div className="titlebar-brand">
            {canBack ? <button className="icon-button back-button" onClick={onBack} aria-label="返回"><ArrowLeft size={17} /></button> : <span className="app-mark"><Boxes size={16} /></span>}
            <span>个人收纳台</span>
          </div>
          <div className="titlebar-menu-wrap">
            <button className="titlebar-menu-button" aria-haspopup="menu" aria-expanded={openMenu === "file"} onPointerDown={(event) => event.preventDefault()} onClick={() => setOpenMenu((open) => open === "file" ? "" : "file")}>文件</button>
            {openMenu === "file" && <div className="titlebar-edit-menu" role="menu" aria-label="文件">
              {fileMenu.map((actionId) => <button key={actionId} role="menuitem" onPointerDown={(event) => event.preventDefault()} onClick={() => { setOpenMenu(""); onAction?.(actionId) }}>
                <span>{byId.get(actionId)?.label || actionId}</span><kbd>{displayShortcut(byId.get(actionId)?.currentShortcut)}</kbd>
              </button>)}
            </div>}
          </div>
          <div className="titlebar-menu-wrap">
            <button className="titlebar-menu-button" aria-haspopup="menu" aria-expanded={openMenu === "edit"} onPointerDown={(event) => event.preventDefault()} onClick={() => setOpenMenu((open) => open === "edit" ? "" : "edit")}>编辑</button>
            {openMenu === "edit" && <div className="titlebar-edit-menu" role="menu" aria-label="编辑">
              {editMenu.map((actionId, index) => actionId ? <button key={actionId} role="menuitem" onPointerDown={(event) => event.preventDefault()} onClick={() => { setOpenMenu(""); onAction?.(actionId) }}>
                <span>{byId.get(actionId)?.label || actionId}</span><kbd>{displayShortcut(byId.get(actionId)?.currentShortcut)}</kbd>
              </button> : <hr key={`separator-${index}`} />)}
            </div>}
          </div>
        </div>
        <div className="window-actions">
          <button onClick={onSettings} aria-label="设置"><Settings size={14} /></button>
          <button onClick={() => windowControl('minimize')} aria-label="最小化"><Minus size={14} /></button>
          <button onClick={() => windowControl('toggleMaximize')} aria-label="最大化或还原"><Square size={11} /></button>
          <button onClick={() => windowControl('close')} aria-label="关闭"><X size={14} /></button>
        </div>
      </header>
      <main className="app-content">{children}</main>
    </div>
  )
}
