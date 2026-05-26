import { ref } from 'vue'

export interface AppSettings {
  closeAfterCopy: boolean
  autoFocus: boolean
}

const DEFAULT_SETTINGS: AppSettings = {
  closeAfterCopy: true,
  autoFocus: true,
}

const settings = ref<AppSettings>({ ...DEFAULT_SETTINGS })

export function useAppSettings() {
  async function load() {
    try {
      const ds = (window as any).ztools?.dbStorage
      if (!ds) return
      const saved = ds.getItem('promptforge:settings')
      if (saved && typeof saved === 'object') {
        if (typeof saved.closeAfterCopy === 'boolean') settings.value.closeAfterCopy = saved.closeAfterCopy
        if (typeof saved.autoFocus === 'boolean') settings.value.autoFocus = saved.autoFocus
      }
    } catch (e) {
      console.error('Failed to load settings:', e)
    }
  }

  async function save() {
    try {
      const ds = (window as any).ztools?.dbStorage
      if (ds) ds.setItem('promptforge:settings', { ...settings.value })
    } catch (e) {
      console.error('Failed to save settings:', e)
    }
  }

  return { settings, load, save }
}
