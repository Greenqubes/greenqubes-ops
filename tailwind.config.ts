import type { Config } from 'tailwindcss'
import defaultTheme from 'tailwindcss/defaultTheme'

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        paper: 'var(--paper)',
        ink: 'var(--ink)',
        ink2: 'var(--ink2)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        terracotta: {
          DEFAULT: 'var(--terracotta)',
          soft: 'var(--terracotta-soft)',
        },
        'brand-green': {
          DEFAULT: 'var(--green)',
          soft: 'var(--green-soft)',
        },
        'brand-blue': {
          DEFAULT: 'var(--blue)',
          soft: 'var(--blue-soft)',
        },
        'brand-amber': {
          DEFAULT: 'var(--amber)',
          soft: 'var(--amber-soft)',
        },
        bad: {
          DEFAULT: 'var(--bad)',
          soft: 'var(--bad-soft)',
        },
      },
      fontFamily: {
        display: ['var(--font-fraunces)', ...defaultTheme.fontFamily.serif],
        body: ['var(--font-ibm-plex-sans)', ...defaultTheme.fontFamily.sans],
      },
      borderRadius: {
        card: '14px',
      },
    },
  },
  plugins: [],
}

export default config
