import { useEffect, useRef, useState } from 'react'

export async function flushBeforeNavigation() {
  const detail = { promises: [] }
  window.dispatchEvent(new CustomEvent('asset-text-before-leave', { detail }))
  try { await Promise.all(detail.promises); return true } catch { return false }
}

const parse = () => {
  const raw = window.location.hash.replace(/^#\/?/, '') || 'home'
  const [path, queryString = ''] = raw.split('?')
  return { parts: path.split('/').filter(Boolean), query: new URLSearchParams(queryString) }
}

export function useHashRoute() {
  const [route, setRoute] = useState(parse)
  const acceptedHash = useRef(window.location.hash)
  useEffect(() => {
    let generation = 0
    const onChange = async () => {
      const ticket = ++generation
      const requested = window.location.hash
      const accepted = await flushBeforeNavigation()
      if (ticket !== generation) return
      if (!accepted) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search + acceptedHash.current)
        return
      }
      acceptedHash.current = requested
      setRoute(parse())
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  const go = async (path) => {
    if (await flushBeforeNavigation()) window.location.hash = path
  }
  return { ...route, go }
}
