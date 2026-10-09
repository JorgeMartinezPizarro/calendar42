// Caché en memoria con "servir caducado mientras se renueva" y respeto al
// presupuesto horario de la intra.
//
// Una entrada pasa por tres estados:
// - fresca: se devuelve sin más;
// - caducada: se devuelve ya, y se renueva en segundo plano (quien pide nunca
//   espera a la intra salvo la primera vez);
// - vencida: hay que esperar a la intra.
// Si el presupuesto de llamadas está justo, lo caducado y lo vencido se sirven
// tal cual y no se renueva nada: mejor datos de hace unos minutos que un 429
// para todos. Las cargas simultáneas de una misma clave se comparten.
//
// Es un Map en el proceso: con un solo contenedor sobra. Si algún día hay
// varias réplicas, basta con cambiar `entries` por un cliente Redis.

export function createCache({ isLowBudget = () => false, now = Date.now, log = console } = {}) {
  const entries = new Map() // key -> { value, freshUntil, staleUntil }
  const inFlight = new Map() // key -> Promise<value>

  function load(key, loader, { ttlMs, staleMs, store }) {
    let pending = inFlight.get(key)
    if (pending) return pending
    pending = loader()
      .then((value) => {
        if (store(value)) {
          const t = now()
          entries.set(key, { value, freshUntil: t + ttlMs, staleUntil: t + staleMs })
        }
        return value
      })
      .finally(() => inFlight.delete(key))
    inFlight.set(key, pending)
    return pending
  }

  /**
   * cached(key, opciones, loader) -> { value, state }
   * - ttlMs: tiempo en fresco; staleMs: tiempo total en el que aún se sirve
   *   caducado (por defecto, seis veces el ttl).
   * - store(value): false para no guardar un resultado (p. ej. con fallos pasajeros).
   * - state: 'fresh' | 'stale' | 'loaded' (loaded = se ha esperado a la intra).
   */
  async function cached(key, { ttlMs, staleMs = ttlMs * 6, store = () => true }, loader) {
    const t = now()
    const hit = entries.get(key)
    if (hit && hit.freshUntil > t) return { value: hit.value, state: 'fresh' }

    const lowBudget = isLowBudget()
    if (hit && (hit.staleUntil > t || lowBudget)) {
      if (!lowBudget) {
        load(key, loader, { ttlMs, staleMs, store }).catch((err) =>
          log.warn(`[cache] no se pudo renovar ${key}:`, err.message),
        )
      }
      return { value: hit.value, state: 'stale' }
    }

    const value = await load(key, loader, { ttlMs, staleMs, store })
    return { value, state: 'loaded' }
  }

  /** Olvida las entradas cuya clave cumple el predicado. */
  function forget(predicate) {
    for (const key of entries.keys()) {
      if (predicate(key)) entries.delete(key)
    }
  }

  function stats() {
    return { entries: entries.size, inFlight: inFlight.size }
  }

  return { cached, forget, stats }
}
