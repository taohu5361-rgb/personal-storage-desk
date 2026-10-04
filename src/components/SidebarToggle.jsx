import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

export function SidebarToggle({ expanded, onToggle, controls, showLabel = false, hidden = false }) {
  const label = expanded ? '收起侧边栏' : '展开侧边栏'
  const Icon = expanded ? PanelLeftClose : PanelLeftOpen
  const toggle = () => {
    onToggle()
    requestAnimationFrame(() => {
      const next = [...document.querySelectorAll('.sidebar-toggle')].find(button =>
        button.getAttribute('aria-controls') === controls && !button.hidden && !button.closest('[inert]'))
      next?.focus({ preventScroll: true })
    })
  }
  return <button type="button" hidden={hidden} className={`sidebar-toggle${showLabel ? ' sidebar-toggle-with-label' : ''}`} onClick={toggle}
    aria-label={label} title={label} aria-expanded={expanded} aria-controls={controls}>
    <Icon size={16} strokeWidth={1.7} />
    {showLabel && <span>{expanded ? '收起' : '展开'}</span>}
  </button>
}
