/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Legacy dark theme (admin UI)
        primary: {
          DEFAULT: '#6366F1', // Indigo - main actions
          dark: '#4F46E5',
          light: '#818CF8',
        },
        dark: {
          bg: '#1A1A1A',
          card: '#2A2A2A',
          border: '#3A3A3A',
          text: '#E5E5E5',
          'text-muted': '#A0A0A0',
        },
        blue: {
          primary: '#2B6CB0',
          light: '#4299E1',
        },
        // Mobile Light Theme - Premium Learning App
        light: {
          bg: '#F8FAFC',              // Soft off-white background
          'bg-elevated': '#FFFFFF',    // Pure white elevated surfaces
          card: '#FFFFFF',             // White card background
          'card-hover': '#F1F5F9',     // Subtle hover state
          border: '#E2E8F0',           // Light gray borders
          'border-light': '#CBD5E1',   // Slightly darker borders
          text: '#0F172A',             // Dark navy text
          'text-secondary': '#475569', // Medium gray text
          'text-muted': '#94A3B8',     // Light muted text
        },
        // Course card gradient colors (softer for light mode)
        course: {
          blue: '#3B82F6',       // Vibrant blue
          purple: '#8B5CF6',     // Rich purple
          orange: '#F97316',     // Warm orange
          pink: '#EC4899',       // Hot pink
          teal: '#14B8A6',       // Fresh teal
          green: '#22C55E',      // Success green
        },
        // Semantic colors
        accent: '#8B5CF6',       // Purple accent
        success: '#22C55E',      // Green
        streak: '#F59E0B',       // Golden amber
        warning: '#F97316',      // Orange
        error: '#EF4444',        // Red
        info: '#3B82F6',         // Blue
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['SF Pro Display', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'card': '24px',
        'card-sm': '20px',
        'card-xs': '16px',
        'button': '16px',
        'pill': '9999px',
        'xl': '20px',
        '2xl': '24px',
        '3xl': '28px',
      },
      boxShadow: {
        'card': '0 4px 24px -4px rgba(0, 0, 0, 0.08), 0 2px 8px -2px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 8px 32px -4px rgba(0, 0, 0, 0.12), 0 4px 12px -2px rgba(0, 0, 0, 0.06)',
        'card-lg': '0 12px 40px -8px rgba(0, 0, 0, 0.15)',
        'soft': '0 2px 12px -2px rgba(0, 0, 0, 0.06)',
        'inner-soft': 'inset 0 2px 4px rgba(0, 0, 0, 0.04)',
        'glow-blue': '0 0 24px rgba(59, 130, 246, 0.25)',
        'glow-purple': '0 0 24px rgba(139, 92, 246, 0.25)',
        'glow-orange': '0 0 24px rgba(249, 115, 22, 0.25)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-card-blue': 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
        'gradient-card-purple': 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
        'gradient-card-orange': 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
        'gradient-card-pink': 'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)',
        'gradient-card-teal': 'linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)',
        'gradient-hero-blue': 'linear-gradient(135deg, #60A5FA 0%, #3B82F6 50%, #2563EB 100%)',
        'gradient-hero-purple': 'linear-gradient(135deg, #A78BFA 0%, #8B5CF6 50%, #7C3AED 100%)',
        'gradient-hero-orange': 'linear-gradient(135deg, #FDBA74 0%, #F97316 50%, #EA580C 100%)',
        'gradient-subtle': 'linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'zoom-in': 'zoomIn 0.2s ease-out',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        zoomIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
