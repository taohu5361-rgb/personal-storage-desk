import { useCallback, useEffect, useState } from 'react'

export function useSidebarPreference(page) {
  const key = `creative-cloth:sidebar:${page}:expanded`
  const [expanded, setExpanded] = useState(() => {
    try { return localStorage.getItem(key) !== 'false' } catch { return true }
  })
  useEffect(() => {
    try { localStorage.setItem(key, String(expanded)) } catch { /* Switching still works without storage. */ }
  }, [key, expanded])
  const toggle = useCallback(() => setExpanded(current => !current), [])
  const expand = useCallback(() => setExpanded(true), [])
  return { expanded, toggle, expand }
}
