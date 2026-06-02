import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // One clean sans-serif font family — TODO: swap to Innovera brand font if specified
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
        },
        // Innovera brand tokens
        // To swap the brand color: update the CSS variables in globals.css (:root)
        brand: {
          orange:        "var(--brand-orange)",        // primary → bg-brand-orange
          "orange-hover":"var(--brand-orange-hover)",  // hover   → bg-brand-orange-hover
          "orange-light":"var(--brand-orange-light)",  // tint    → bg-brand-orange-light
          "orange-fg":   "var(--brand-orange-fg)",     // on-brand text → text-brand-orange-fg
          "orange-ring": "var(--brand-orange-ring)",   // focus ring    → ring-brand-orange-ring
          "orange-border":"var(--brand-orange-border)",// accent border → border-brand-orange-border
        },
        // Status tokens — scores and alerts only
        status: {
          green: "var(--status-green)",
          "green-bg": "var(--status-green-bg)",
          amber: "var(--status-amber)",
          "amber-bg": "var(--status-amber-bg)",
          red: "var(--status-red)",
          "red-bg": "var(--status-red-bg)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};
export default config;
