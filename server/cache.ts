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

import type { CacheState } from '../shared/types.ts'
import { asHttpError } from './types.ts'

interface Entry {
  value: unknown
  freshUntil: number
  staleUntil: number
}

export interface CachedOptions<T> {
  /** Tiempo en fresco. */
  ttlMs: number
  /** Tiempo total en el que aún se sirve caducado (por defecto, seis veces el ttl). */
  staleMs?: number
  /** false para no guardar un resultado (p. ej. con fallos pasajeros). */
  store?: (value: T) => boolean
}

export interface Cached<T> {
  value: T
  /** 'loaded' = se ha esperado a la intra. */
  state: CacheState
}

export interface CacheOptions {
  /** true si quedan pocas llamadas a la intra en la hora. */
  isLowBudget?: () => boolean
  now?: () => number
  log?: Pick<Console, 'warn'>
}

export function createCache({ isLowBudget = () => false, now = Date.now, log = console }: CacheOptions = {}) {
  const entries = new Map<string, Entry>()
  const inFlight = new Map<string, Promise<unknown>>()

  function load<T>(
    key: string,
    loader: () => Promise<T>,
    { ttlMs, staleMs, store }: { ttlMs: number; staleMs: number; store: (value: T) => boolean },
  ): Promise<T> {
    const pending = inFlight.get(key) as Promise<T> | undefined
    if (pending) return pending
    const next = loader()
      .then((value) => {
        if (store(value)) {
          const t = now()
          entries.set(key, { value, freshUntil: t + ttlMs, staleUntil: t + staleMs })
        }
        return value
      })
      .finally(() => inFlight.delete(key))
    inFlight.set(key, next)
    return next
  }

  /**
   * El valor de `key`: de la caché si está fresco o se puede servir caducado;
   * si no, el de `loader()`. Quien llama decide el tipo T y es responsable de
   * usar siempre el mismo para la misma clave.
   */
  async function cached<T>(key: string, options: CachedOptions<T>, loader: () => Promise<T>): Promise<Cached<T>> {
    const { ttlMs, staleMs = ttlMs * 6, store = () => true } = options
    const t = now()
    const hit = entries.get(key)
    if (hit && hit.freshUntil > t) return { value: hit.value as T, state: 'fresh' }

    const lowBudget = isLowBudget()
    if (hit && (hit.staleUntil > t || lowBudget)) {
      if (!lowBudget) {
        load(key, loader, { ttlMs, staleMs, store }).catch((err: unknown) =>
          log.warn(`[cache] no se pudo renovar ${key}:`, asHttpError(err).message),
        )
      }
      return { value: hit.value as T, state: 'stale' }
    }

    const value = await load(key, loader, { ttlMs, staleMs, store })
    return { value, state: 'loaded' }
  }

  /** Olvida las entradas cuya clave cumple el predicado. */
  function forget(predicate: (key: string) => boolean): void {
    for (const key of entries.keys()) {
      if (predicate(key)) entries.delete(key)
    }
  }

  function stats() {
    return { entries: entries.size, inFlight: inFlight.size }
  }

  return { cached, forget, stats }
}

export type Cache = ReturnType<typeof createCache>
