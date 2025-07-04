/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#6d4f3e',
        accent: '#722f37',
        background: '#fafaf9',
        surface: '#ffffff',
        neutral: '#374151',
        info: '#2563eb',
        success: '#3bb273',
      },
      fontFamily: {
        satoshi: ['Satoshi', 'sans-serif'],
        bricolage: ['Bricolage Grotesque', 'serif'],
        'geist-mono': ['Geist Mono', 'monospace'],
      },
      fontSize: {
        'display-xl': ['3.75rem', { lineHeight: '1.25', letterSpacing: '-0.02em' }],
        'display-lg': ['3rem', { lineHeight: '1.25', letterSpacing: '-0.02em' }],
        'display-md': ['2.25rem', { lineHeight: '1.25', letterSpacing: '-0.01em' }],
        'display-sm': ['1.875rem', { lineHeight: '1.25', letterSpacing: '-0.01em' }],
        'heading-xl': ['1.875rem', { lineHeight: '1.25', letterSpacing: '-0.01em' }],
        'heading-lg': ['1.5rem', { lineHeight: '1.25', letterSpacing: '-0.01em' }],
        'heading-md': ['1.25rem', { lineHeight: '1.375' }],
        'heading-sm': ['1.125rem', { lineHeight: '1.375' }],
        'body-xl': ['1.25rem', { lineHeight: '1.625' }],
        'body-lg': ['1.125rem', { lineHeight: '1.625' }],
        'body-md': ['1rem', { lineHeight: '1.625' }],
        'body-sm': ['0.875rem', { lineHeight: '1.5' }],
      },
      backdropBlur: {
        'xs': '2px',
      },
    },
  },
  plugins: [],
} 