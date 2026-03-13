/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "var(--bg-base)",
                foreground: "var(--text-primary)",

                // Semantic Colors
                // Semantic Colors
                'base': 'var(--bg-base)',
                'surface': 'var(--bg-surface)',
                'subtle': 'var(--bg-subtle)',
                'muted': 'var(--bg-muted)',
                'text-primary': 'var(--text-primary)',
                'text-secondary': 'var(--text-secondary)',
                'text-muted': 'var(--text-muted)',
                'text-inverse': 'var(--text-inverse)',
                'border-default': 'var(--border-default)',
                'border-strong': 'var(--border-strong)',
                'accent': 'var(--accent-primary)',
                'accent-hover': 'var(--accent-hover)',
                'accent-subtle': 'var(--accent-subtle)',
                'success': 'var(--success)',
                'success-subtle': 'var(--success-subtle)',
                'warning': 'var(--warning)',
                'warning-subtle': 'var(--warning-subtle)',
                'danger': 'var(--danger)',
                'danger-subtle': 'var(--danger-subtle)',

                // Brand Colors — E.M. Cayetano Hardware
                brand: {
                    yellow: "#F6C90E",
                    'yellow-dark': "#D4A90C",
                    'yellow-light': "#FEF3C7",
                    gray: "#4A4E5A",
                    'gray-light': "#6B7280",
                    charcoal: "#252627",
                    white: "#FFFFFF",
                    red: "#E21D1D",
                    'red-dark': "#B91C1C",
                    'red-light': "#FEE2E2",
                    orange: "#EE6C0E",
                    'orange-light': "#FEF0E7",
                    'slate-blue': "#5A6E8C",
                    'slate-blue-light': "#EEF2F7",
                },
                primary: {
                    DEFAULT: "var(--accent-primary)",
                    foreground: "var(--text-inverse)",
                },
                secondary: {
                    DEFAULT: "var(--bg-muted)",
                    foreground: "var(--text-secondary)",
                },
                destructive: {
                    DEFAULT: "var(--danger)",
                    foreground: "var(--text-inverse)",
                },
                muted: {
                    DEFAULT: "var(--bg-muted)",
                    foreground: "var(--text-muted)",
                },
                accent: {
                    DEFAULT: "var(--accent-primary)",
                    foreground: "var(--text-inverse)",
                },
                popover: {
                    DEFAULT: "var(--bg-surface)",
                    foreground: "var(--text-primary)",
                },
                card: {
                    DEFAULT: "var(--bg-surface)",
                    foreground: "var(--text-primary)",
                },
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            fontFamily: {
                sans: ['Inter', 'Roboto', 'Open Sans', 'system-ui', 'sans-serif'],
                data: ['JetBrains Mono', 'monospace'],
                mono: ['Fira Code', 'JetBrains Mono', 'monospace'],
            },
            boxShadow: {
                'bento': '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.06)',
                'bento-hover': '0 4px 16px 0 rgba(0,0,0,0.10), 0 2px 4px -1px rgba(0,0,0,0.06)',
                'yellow': '0 4px 14px 0 rgba(246,201,14,0.25)',
            },
            animation: {
                'shimmer': 'shimmer 1.5s infinite',
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-up': 'slideUp 0.3s ease-out',
            },
            keyframes: {
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(8px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
            },
        },
    },
    plugins: [],
}
