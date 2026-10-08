import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Boxes, ChevronRight, Grid2X2, Home, Layers3, Minus, Settings, Square, X } from 'lucide-react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { displayShortcut } from '../shortcuts/registry'

const menus = { file: ['save'], edit: ['undo', 'redo', null, 'cut', 'copy', 'paste', null, 'delete', null, 'select-all'] }
const labels = { save: '保存', undo: '撤销', redo: '重做', cut: '剪切', copy: '复制', paste: '粘贴', delete: '删除', 'select-all': '全选' }

export function AppChrome({ children, canBack = false, onBack, onSettings, immersive = false, shortcuts = [], onAction, canAction = () => true, activeDomain = '', page = '', breadcrumbs = [], onNavigate }) {
  const [openMenu, setOpenMenu] = useState('')
  const menuRef = useRef(null)
  const triggerRef = useRef(null)
  useEffect(() => {
    const close = event => { if (!event.target.closest?.('.titlebar-menu-wrap')) setOpenMenu('') }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [])
  useEffect(() => { setOpenMenu('') }, [page, activeDomain])
  const byId = new Map(shortcuts.map(item => [item.actionId, item]))
  const windowControl = async action => {
    if (!window.__TAURI_INTERNALS__) return
    const appWindow = getCurrentWindow()
    if (action === 'minimize') await appWindow.minimize()
    if (action === 'toggleMaximize') await appWindow.toggleMaximize()
    if (action === 'close') await appWindow.close()
  }
  const menuKeyboard = event => {
    if (event.key === 'Escape') { event.preventDefault(); setOpenMenu(''); triggerRef.current?.focus(); return }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const items = [...menuRef.current.querySelectorAll('button:not(:disabled)')]
    let index = items.indexOf(document.activeElement)
    index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length
    items[index]?.focus()
  }
  return <div className={`app-shell ui-shell ${immersive ? 'immersive' : ''}`}>
    <header className="titlebar ui-titlebar">
      <div className="titlebar-left">
        <div className="titlebar-brand"><span className="app-mark"><Boxes size={16} /></span><span>脚本集合器</span></div>
        {Object.keys(menus).map(name => <div className="titlebar-menu-wrap" key={name}>
          <button className="titlebar-menu-button" aria-haspopup="menu" aria-expanded={openMenu === name}
            onPointerDown={event => event.preventDefault()}
            onClick={event => { triggerRef.current = event.currentTarget; setOpenMenu(open => open === name ? '' : name) }}
            onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); triggerRef.current = event.currentTarget; setOpenMenu(name); requestAnimationFrame(() => menuRef.current?.querySelector('button:not(:disabled)')?.focus()) } }}>
            {name === 'file' ? '文件' : '编辑'}
          </button>
          {openMenu === name && <div ref={menuRef} className="titlebar-edit-menu ui-menu" role="menu" aria-label={name === 'file' ? '文件' : '编辑'} onKeyDown={menuKeyboard}>
            {menus[name].map((actionId, index) => actionId ? <button key={actionId} role="menuitem" disabled={!canAction(actionId)}
              onPointerDown={event => event.preventDefault()} onClick={() => { setOpenMenu(''); onAction?.(actionId) }}>
              <span>{byId.get(actionId)?.label || labels[actionId]}</span><kbd>{displayShortcut(byId.get(actionId)?.currentShortcut)}</kbd>
            </button> : <hr key={index} />)}
          </div>}
        </div>)}
      </div>
      <div className="titlebar-drag-region" data-tauri-drag-region />
      <div className="window-actions">
        <button onClick={() => windowControl('minimize')} aria-label="最小化"><Minus size={14} /></button>
        <button onClick={() => windowControl('toggleMaximize')} aria-label="最大化或还原"><Square size={11} /></button>
        <button onClick={() => windowControl('close')} aria-label="关闭"><X size={14} /></button>
      </div>
    </header>
    <nav className="ui-primary-nav" aria-label="主导航">
      <button className="ui-icon-button" onClick={() => onNavigate?.('home')} aria-label="首页" aria-current={page === 'home' ? 'page' : undefined}><Home size={17} /></button>
      <div className="ui-domain-nav">
        <button onClick={() => onNavigate?.('scripts')} aria-current={activeDomain === 'scripts' ? 'page' : undefined}><Grid2X2 size={16} />排列模式</button>
        <button onClick={() => onNavigate?.('canvas')} aria-current={activeDomain === 'canvas' ? 'page' : undefined}><Layers3 size={16} />画布模式</button>
      </div>
      <div className="ui-nav-spacer" />
      <button className="ui-nav-settings" onClick={onSettings} aria-current={page === 'settings' ? 'page' : undefined}><Settings size={16} /><span>设置</span></button>
    </nav>
    {breadcrumbs.length > 0 && <nav className="ui-breadcrumbs" aria-label="当前位置">
      <button className="ui-icon-button" disabled={!canBack} onClick={onBack} aria-label="返回上一层"><ArrowLeft size={16} /></button>
      <ol>{breadcrumbs.map((item, index) => <li key={`${item.label}-${index}`}>
        {index > 0 && <ChevronRight size={12} aria-hidden="true" />}
        {item.path ? <button onClick={() => onNavigate?.(item.path)}>{item.label}</button> : <span aria-current="page">{item.label}</span>}
      </li>)}</ol>
    </nav>}
    <main className="app-content" id="main-content">{children}</main>
    {immersive && <button className="ui-immersive-exit ui-button" onClick={()=>onAction?.('canvas-immersive')} title="返回界面（Tab）"><ArrowLeft size={15}/>返回界面</button>}
  </div>
}
