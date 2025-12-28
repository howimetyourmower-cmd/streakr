import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],

  theme: {
    extend: {
      /* ─────────────────────────────────────────────
         STREAKr Theme Tokens (CSS Variable Mapped)
         DO NOT hardcode hex colours in components
         ───────────────────────────────────────────── */

      colors: {
        /* Backgrounds */
        bg: {
          void: "var(--bg-void)",
          primary: "var(--bg-primary)",
          elevated: "var(--bg-elevated)",
          card: "var(--bg-card)",
        },

        /* Brand */
        brand: {
          900: "var(--orange-900)",
          600: "var(--orange-600)",
          500: "var(--orange-500)",
          400: "var(--orange-400)",
          DEFAULT: "var(--orange-600)",
        },

        /* Accent neons */
        neon: {
          cyan: "var(--cyan-glow)",
          green: "var(--acid-green)",
          pink: "var(--hot-pink)",
          purple: "var(--laser-purple)",
          yellow: "var(--warning-yellow)",
        },

        /* States */
        success: "var(--success)",
        error: "var(--error)",
        warning: "var(--warning)",
        info: "var(--info)",

        /* Text */
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary: "var(--text-tertiary)",
        },

        /* Borders */
        border: {
          subtle: "var(--border-subtle)",
          DEFAULT: "var(--border-default)",
          strong: "var(--border-strong)",
        },
      },

      /* ─────────────────────────────────────────────
         Shadows (Neon-aware)
         ───────────────────────────────────────────── */
      boxShadow: {
        cyan: "0 0 16px rgba(0,229,255,0.55)",
        orange: "0 0 18px rgba(255,61,0,0.55)",
        pink: "0 0 18px rgba(245,0,87,0.55)",
        green: "0 0 18px rgba(118,255,3,0.55)",
        red: "0 0 18px rgba(255,7,58,0.55)",
      },

      /* ─────────────────────────────────────────────
         Animations (mapped to globals.css keyframes)
         ───────────────────────────────────────────── */
      animation: {
        streak: "streakGradientShift 2.8s ease-in-out infinite",
        pulseSuccess: "pulseGlowGreen 1.2s ease-in-out infinite",
        shakeError: "pulseGlowRed 0.6s ease-in-out 1",
        blinkWarning: "blinkWarning 1s linear infinite",
      },

      /* ─────────────────────────────────────────────
         Border Radius (Cyberpunk feel)
         ───────────────────────────────────────────── */
      borderRadius: {
        xl: "16px",
        "2xl": "18px",
      },

      /* ─────────────────────────────────────────────
         Font Weight Bias (Fantasy emphasis)
         ───────────────────────────────────────────── */
      fontWeight: {
        heavy: "800",
        black: "900",
      },
    },
  },

  plugins: [],
} satisfies Config;
