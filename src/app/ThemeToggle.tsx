import { useState } from 'react'
import { applyTheme, loadTheme, saveTheme, THEME_NAMES, THEMES, type Theme } from '../lib/theme'

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(loadTheme)

  function choose(next: Theme) {
    setTheme(next)
    saveTheme(next)
    applyTheme(next)
  }

  return (
    <fieldset className="fixed right-3 top-3 z-10 flex gap-1 rounded-full bg-surface/90 p-1 text-xs shadow-md ring-1 ring-line">
      <legend className="sr-only">美術風格</legend>
      {THEMES.map((t) => (
        <label
          key={t}
          data-testid={`theme-${t}`}
          className="cursor-pointer rounded-full px-3 py-1 font-semibold text-ink-muted transition hover:text-ink has-[:checked]:bg-accent has-[:checked]:text-on-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent"
        >
          <input type="radio" name="theme" value={t} checked={theme === t} onChange={() => choose(t)} className="sr-only" />
          {THEME_NAMES[t]}
        </label>
      ))}
    </fieldset>
  )
}
