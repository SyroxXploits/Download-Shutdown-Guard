import ElectronStore from 'electron-store'
import { AppSettings, DEFAULT_SETTINGS } from '../shared/types'

// Deep merge: fills in missing keys from defaults without overwriting user values
function deepMerge<T extends Record<string, unknown>>(target: T, source: T): T {
  const result = { ...source }
  for (const key of Object.keys(target) as (keyof T)[]) {
    if (
      key in target &&
      typeof target[key] === 'object' &&
      target[key] !== null &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(
        target[key] as Record<string, unknown>,
        (source[key] ?? {}) as Record<string, unknown>
      ) as T[keyof T]
    } else if (key in target) {
      result[key] = target[key]
    }
  }
  return result
}

const store = new ElectronStore<{ settings: AppSettings }>({
  name: 'config',
  defaults: { settings: DEFAULT_SETTINGS }
})

export const settingsStore = {
  get(): AppSettings {
    const saved = store.get('settings') as Partial<AppSettings>
    // Merge with defaults to handle new keys added in updates
    return deepMerge(
      saved as unknown as Record<string, unknown>,
      DEFAULT_SETTINGS as unknown as Record<string, unknown>
    ) as unknown as AppSettings
  },

  set(settings: AppSettings): void {
    store.set('settings', settings)
  },

  reset(): AppSettings {
    store.set('settings', DEFAULT_SETTINGS)
    return DEFAULT_SETTINGS
  },

  getPath(): string {
    return store.path
  }
}
