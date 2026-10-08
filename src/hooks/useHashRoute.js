import { useEffect, useRef, useState } from 'react'
import { createNavigationController, parseRoutePath } from './navigationState.js'

export async function flushBeforeNavigation() {
  const detail = { promises: [] }
  window.dispatchEvent(new CustomEvent('asset-text-before-leave', { detail }))
  try { await Promise.all(detail.promises); return true } catch { return false }
}

export function useHashRoute() {
  const [route, setRoute] = useState(() => parseRoutePath(window.location.hash))
  const controllerRef = useRef(null)
  if (!controllerRef.current) controllerRef.current = createNavigationController({
    initialPath: window.location.hash,
    readPath: () => window.location.hash,
    writePath: (path, { replace }) => {
      const url = window.location.pathname + window.location.search + '#' + path
      window.history[replace ? 'replaceState' : 'pushState'](null, '', url)
    },
    commit: setRoute,
    flush: flushBeforeNavigation,
  })
  useEffect(() => {
    const controller = controllerRef.current
    controller.setActive(true)
    const onChange = () => { void controller.onHashChange() }
    window.addEventListener('hashchange', onChange)
    return () => { window.removeEventListener('hashchange', onChange); controller.setActive(false) }
  }, [])
  return { ...route, go: controllerRef.current.go }
}
