/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './app/**/*.{js,jsx}',
    './src/**/*.{js,jsx}',
  ],
  safelist: [
    // Step colors for CreatePawnFormRedesigned
    'bg-orange-50', 'dark:bg-orange-950/50', 'text-orange-700', 'dark:text-orange-300',
    'text-orange-600', 'dark:text-orange-400', 'hover:bg-orange-50', 'dark:hover:bg-orange-950/30',
    'bg-gradient-to-br', 'from-orange-500', 'to-red-600', 'bg-orange-500',
    'bg-pink-50', 'dark:bg-pink-950/50', 'text-pink-700', 'dark:text-pink-300',
    'text-pink-600', 'dark:text-pink-400', 'hover:bg-pink-50', 'dark:hover:bg-pink-950/30',
    'from-pink-500', 'to-rose-600', 'bg-pink-500',
    'bg-cyan-50', 'dark:bg-cyan-950/50', 'text-cyan-700', 'dark:text-cyan-300',
    'text-cyan-600', 'dark:text-cyan-400', 'hover:bg-cyan-50', 'dark:hover:bg-cyan-950/30',
    'from-cyan-500', 'to-teal-600', 'bg-cyan-500',
    'bg-rose-50', 'dark:bg-rose-950/50', 'text-rose-700', 'dark:text-rose-300',
    'text-rose-600', 'dark:text-rose-400', 'hover:bg-rose-50', 'dark:hover:bg-rose-950/30',
    'from-rose-500', 'to-pink-600', 'bg-rose-500',
    // Additional colors for status and inputs
    'bg-emerald-100', 'dark:bg-emerald-900/50', 'text-emerald-700', 'dark:text-emerald-300',
    'bg-amber-100', 'dark:bg-amber-900/50', 'text-amber-700', 'dark:text-amber-300',
    'border-pink-200', 'dark:border-pink-700', 'focus:border-pink-500', 'dark:focus:border-pink-400',
    'border-orange-200', 'dark:border-orange-700', 'focus:border-orange-500', 'dark:focus:border-orange-400',
    'border-cyan-200', 'dark:border-cyan-700', 'focus:border-cyan-500', 'dark:focus:border-cyan-400',
    'border-rose-200', 'dark:border-rose-700', 'focus:border-rose-500', 'dark:focus:border-rose-400'
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Modern Financial theme colors
        'pawn-dark': '#2C3E50',      // Professional navy
        'pawn-medium': '#34495E',    // Medium blue-gray
        'pawn-accent': '#E67E22',    // Warm orange (trust/value)
        'pawn-light': '#ECF0F1',     // Cool light gray
        
        // Dialog-specific color schemes (following CreatePawn pattern)
        // View Details Dialog (Emerald + Slate theme - for viewing/reading)
        'details-dark': '#0F172A',      // Deep slate
        'details-medium': '#475569',    // Medium slate  
        'details-accent': '#10B981',    // Emerald accent (success/view)
        'details-light': '#F0FDF4',     // Mint light
        'details-secondary': '#E2E8F0', // Cool silver for contrast
        
        // Payment Dialog (Neutral + Gold theme - for money transactions)
        'payment-dark': '#374151',      // Charcoal gray
        'payment-medium': '#6B7280',    // Neutral gray
        'payment-accent': '#F59E0B',    // Gold accent (wealth/value)
        'payment-light': '#F9FAFB',     // Cool white
        'payment-secondary': '#E5E7EB', // Light gray for contrast
        
        // Extension Dialog (Cool + Teal theme - for time operations)
        'extension-dark': '#1E293B',    // Cool slate  
        'extension-medium': '#64748B',  // Blue-gray
        'extension-accent': '#0D9488',  // Teal accent (calm/time)
        'extension-light': '#F1F5F9',   // Cool light
        'extension-secondary': '#CBD5E1', // Cool gray for contrast
        
        // CSS variable colors
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
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
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "shimmer": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "shimmer": "shimmer 2s infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}