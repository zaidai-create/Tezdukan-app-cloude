import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', "system-ui", "-apple-system", "sans-serif"],
        display: ['"SF Pro Display"', '"Inter"', "system-ui", "sans-serif"],
      },
      colors: {
        ink: {
          DEFAULT: "#0A0A0C",
          muted: "#6E6E73",
          soft: "#1C1C1E",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          elevated: "#FAFAFA",
          panel: "#F5F5F7",
        },
        line: "#E5E5EA",
        accent: {
          DEFAULT: "#0A84FF",
          soft: "#E8F2FF",
        },
        success: "#30D158",
        warning: "#FF9F0A",
        danger: "#FF3B30",
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04)",
        raised: "0 4px 16px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
        float: "0 12px 40px rgba(0,0,0,0.12)",
      },
      borderRadius: {
        xl: "14px",
        "2xl": "18px",
        "3xl": "22px",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        pulseDot: { "0%,100%": { opacity: ".35" }, "50%": { opacity: "1" } },
      },
      animation: {
        "fade-in": "fade-in 180ms ease-out",
        "pulse-dot": "pulseDot 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
