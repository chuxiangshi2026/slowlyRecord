const LAZY_LOAD_ERROR_RE = /failed to fetch dynamically imported module|error loading dynamically imported module|loading chunk .* failed/i

export function isLazyRouteLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '')
  return LAZY_LOAD_ERROR_RE.test(message)
}

export function lazyRouteRetryKey(path: string): string {
  return `slowlyrecord-route-retry:${path}`
}

export function consumeLazyRouteRetry(path: string, storage: Storage): boolean {
  const key = lazyRouteRetryKey(path)
  if (storage.getItem(key) === '1') return false
  storage.setItem(key, '1')
  return true
}

export function clearLazyRouteRetry(path: string, storage: Storage): void {
  storage.removeItem(lazyRouteRetryKey(path))
}
