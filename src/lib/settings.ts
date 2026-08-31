export interface HardwareSettings {
  // Hinges
  hingeSoftCloseEur: number
  hingeNormalEur: number
  useNormalHinge: boolean // false = soft-close (default), true = normal
  
  // Screws
  hingeScrew1000PackEur: number
  
  // Assembly screws
  screw5x60_500PackEur: number
  
  // Shelf pins
  shelfPinEur: number
}

export const DEFAULT_HARDWARE_SETTINGS: HardwareSettings = {
  hingeSoftCloseEur: 0.70,
  hingeNormalEur: 0.20,
  useNormalHinge: false,
  hingeScrew1000PackEur: 5.00,
  screw5x60_500PackEur: 13.00,
  shelfPinEur: 0.05,
}

const SETTINGS_KEY = 'sketchcut-hardware-settings'

export function loadSettings(): HardwareSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<HardwareSettings>
      return { ...DEFAULT_HARDWARE_SETTINGS, ...parsed }
    }
  } catch (e) {
    console.error('Failed to load settings:', e)
  }
  return { ...DEFAULT_HARDWARE_SETTINGS }
}

export function saveSettings(settings: HardwareSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch (e) {
    console.error('Failed to save settings:', e)
  }
}

export function resetSettings(): HardwareSettings {
  const defaults = { ...DEFAULT_HARDWARE_SETTINGS }
  saveSettings(defaults)
  return defaults
}
