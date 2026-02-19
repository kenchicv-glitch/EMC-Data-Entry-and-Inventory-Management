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
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
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
                    DEFAULT: "#252627",
                    foreground: "#ffffff",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
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
