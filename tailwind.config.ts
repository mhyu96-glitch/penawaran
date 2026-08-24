import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
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
        // Existing shadcn colors (keep for compatibility)
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
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Glass Morphism Color System
        glass: {
          bg: {
            light: "rgba(255, 255, 255, 0.05)",
            medium: "rgba(255, 255, 255, 0.08)",
            heavy: "rgba(255, 255, 255, 0.12)",
            ultra: "rgba(255, 255, 255, 0.18)",
          },
          border: {
            DEFAULT: "rgba(218, 226, 253, 0.15)",
            glow: "rgba(173, 198, 255, 0.3)",
            accent: "rgba(75, 142, 255, 0.5)",
          },
        },
        "glass-accent": {
          primary: "#4b8eff",
          secondary: "#4edea3",
          tertiary: "#ffdea4",
          error: "#ffb4ab",
          warning: "#ffb86c",
        },
        "glass-text": {
          primary: "#e4ecfa",
          secondary: "#a8b4ca",
          tertiary: "#6b7893",
        },
        status: {
          draft: "#64748b",
          sent: "#4b8eff",
          accepted: "#4edea3",
          rejected: "#ffb4ab",
          paid: "#22c55e",
          overdue: "#ef4444",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // Glass specific
        "glass-sm": "8px",
        "glass-md": "12px",
        "glass-lg": "16px",
        "glass-xl": "20px",
        "glass-2xl": "24px",
      },
      backdropBlur: {
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "20px",
        xl: "24px",
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
        "glass-sm": "0 2px 8px 0 rgba(0, 0, 0, 0.12)",
        "glass-md": "0 4px 16px 0 rgba(0, 0, 0, 0.16)",
        "glass-lg": "0 8px 24px 0 rgba(0, 0, 0, 0.20)",
        "glass-xl": "0 12px 32px 0 rgba(0, 0, 0, 0.24)",
        "glow-blue": "0 0 20px rgba(75, 142, 255, 0.4)",
        "glow-green": "0 0 20px rgba(78, 222, 163, 0.4)",
        "glow-yellow": "0 0 20px rgba(255, 222, 164, 0.4)",
        "glow-red": "0 0 20px rgba(255, 180, 171, 0.4)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
        "glow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        "pulse-slow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "float": "float 6s ease-in-out infinite",
        "glow": "glow 2s ease-in-out infinite",
        "pulse-slow": "pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    // Glass Morphism Plugin
    plugin(function ({ addUtilities, addComponents }) {
      // Glass Utilities
      addUtilities({
        ".glass-light": {
          background: "rgba(255, 255, 255, 0.05)",
          backdropFilter: "blur(8px) saturate(180%)",
          WebkitBackdropFilter: "blur(8px) saturate(180%)",
          border: "1px solid rgba(218, 226, 253, 0.15)",
        },
        ".glass-medium": {
          background: "rgba(255, 255, 255, 0.08)",
          backdropFilter: "blur(12px) saturate(180%)",
          WebkitBackdropFilter: "blur(12px) saturate(180%)",
          border: "1px solid rgba(218, 226, 253, 0.15)",
        },
        ".glass-heavy": {
          background: "rgba(255, 255, 255, 0.12)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          border: "1px solid rgba(218, 226, 253, 0.15)",
        },
        ".glass-ultra": {
          background: "rgba(255, 255, 255, 0.18)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          border: "1px solid rgba(218, 226, 253, 0.2)",
        },
      });

      // Glass Components
      addComponents({
        ".glass-card": {
          background: "rgba(255, 255, 255, 0.08)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          border: "1px solid rgba(218, 226, 253, 0.15)",
          borderRadius: "16px",
          boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
          transition: "all 300ms cubic-bezier(0.16, 1, 0.3, 1)",
        },
        ".glass-card:hover": {
          transform: "translateY(-2px)",
          borderColor: "rgba(173, 198, 255, 0.3)",
          boxShadow: "0 12px 40px 0 rgba(31, 38, 135, 0.45)",
        },
      });
    }),
  ],
} satisfies Config;
