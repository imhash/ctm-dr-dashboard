import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext({ dark: true, toggle: () => {} })

async function fetchTheme() {
  try {
    const res = await fetch('/api/theme')
    if (!res.ok) throw new Error()
    const { theme } = await res.json()
    return theme === 'dark'
  } catch {
    return true
  }
}

async function persistTheme(dark) {
  try {
    await fetch('/api/theme', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: dark ? 'dark' : 'light' }),
    })
  } catch {}
}

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(true)

  useEffect(() => {
    fetchTheme().then(setDark)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    persistTheme(dark)
  }, [dark])

  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark((p) => !p) }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)

/** Returns theme-aware Tailwind class strings */
export function useT() {
  const { dark } = useTheme()
  return {
    // Backgrounds
    pageBg:    dark ? 'bg-[#0f1117]'   : 'bg-slate-100',
    card:      dark ? 'bg-[#1a1d27]'   : 'bg-white',
    cardHover: dark ? 'hover:bg-[#1f2233]' : 'hover:bg-slate-50',
    inner:     dark ? 'bg-[#161926]'   : 'bg-slate-50',
    tableHead: dark ? 'bg-[#1f2233]'   : 'bg-slate-100',
    inputBg:   dark ? 'bg-[#161926]'   : 'bg-white',
    // Borders
    border:    dark ? 'border-[#2a2d3a]' : 'border-slate-200',
    borderDash:dark ? 'border-slate-700' : 'border-slate-300',
    // Text
    text:      dark ? 'text-white'      : 'text-slate-900',
    textSub:   dark ? 'text-slate-300'  : 'text-slate-700',
    textMuted: dark ? 'text-slate-400'  : 'text-slate-500',
    textFaint: dark ? 'text-slate-500'  : 'text-slate-400',
    textCode:  dark ? 'text-slate-400'  : 'text-slate-600',
    // Header
    header:    dark ? 'bg-[#1a1d27] border-[#2a2d3a]' : 'bg-white border-slate-200',
  }
}
