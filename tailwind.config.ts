import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        kairo: {
          DEFAULT: "#C2410C", // warm orange — Kairo brand primary
          ink: "#1F1B16",
          paper: "#FBF8F3",
          line: "#E7E1D6",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "Inter", "sans-serif"],
        serif: ["ui-serif", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
