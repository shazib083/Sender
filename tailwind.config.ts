import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
        display: ["var(--font-space-grotesk)", "sans-serif"],
      },

      colors: {
        brand: {
          50: "#f0f4ff",
          100: "#e0e9ff",
          200: "#c7d7fe",
          300: "#a5bbfc",
          400: "#8196f8",
          500: "#6470f1",
          600: "#5254e5",
          700: "#4542ca",
          800: "#3938a3",
          900: "#333481",
          950: "#1e1d4b",
        },

        accent: {
          purple: "#7c3aed",
          pink: "#db2777",
          cyan: "#0891b2",
          emerald: "#059669",
        },

        // ✅ FIX: make surface safer (no DEFAULT nesting issues)
        surface: {
          DEFAULT: "#0d0f1a",
          50: "#12141f",
          100: "#161824",
          200: "#1c1f2e",
          300: "#232638",
          400: "#2d3048",
          500: "#373b58",
        },
      },

      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "mesh-gradient":
          "radial-gradient(at 40% 20%, hsla(240,100%,74%,0.15) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(189,100%,56%,0.1) 0px, transparent 50%), radial-gradient(at 0% 50%, hsla(355,100%,93%,0.05) 0px, transparent 50%)",
      },

      animation: {
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-up": "slideUp 0.4s ease-out",
        "slide-in": "slideIn 0.3s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        shimmer: "shimmer 2s linear infinite",
        "spin-slow": "spin 3s linear infinite",
      },

      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(16px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideIn: {
          "0%": { transform: "translateX(-16px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },

      borderRadius: {
        "4xl": "2rem",
      },

      boxShadow: {
        glow: "0 0 30px rgba(100, 112, 241, 0.3)",
        "glow-sm": "0 0 15px rgba(100, 112, 241, 0.2)",
        "inner-glow": "inset 0 0 20px rgba(100, 112, 241, 0.1)",
      },
    },
  },

  plugins: [],
};

export default config;
