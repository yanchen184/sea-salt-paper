export const THEMES = ['paper', 'night'] as const
export type Theme = (typeof THEMES)[number]

export const THEME_NAMES: Record<Theme, string> = {
  paper: '紙藝海岸',
  night: '深海夜航',
}

const STORAGE_KEY = 'sea-salt-paper:theme'
const DEFAULT_THEME: Theme = 'paper'

export function isTheme(value: unknown): value is Theme {
  return THEMES.includes(value as Theme)
}

export function loadTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isTheme(stored) ? stored : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // 無法寫入 localStorage 時本次仍套用主題，只是重整後回到預設
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
}
