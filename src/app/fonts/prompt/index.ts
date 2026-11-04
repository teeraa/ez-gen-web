import localFont from "next/font/local"

// Prompt (SIL OFL 1.1, from @fontsource/prompt 5.3.0) is bundled in the repo instead of using
// next/font/google, so builds and dev servers never depend on reaching fonts.googleapis.com.
// When that download failed the app silently rendered "Prompt Fallback" (a system font).

// next/font requires literal options, so the subset ranges (from @fontsource/prompt unicode.json) are inlined.

const promptThai = localFont({
  src: [
    { path: "./prompt-thai-300-normal.woff2", weight: "300", style: "normal" },
    { path: "./prompt-thai-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./prompt-thai-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./prompt-thai-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./prompt-thai-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./prompt-thai-800-normal.woff2", weight: "800", style: "normal" },
  ],
  display: "swap",
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+02D7,U+0303,U+0331,U+0E01-0E5B,U+200C-200D,U+25CC" }],
})

const promptLatin = localFont({
  src: [
    { path: "./prompt-latin-300-normal.woff2", weight: "300", style: "normal" },
    { path: "./prompt-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./prompt-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./prompt-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./prompt-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./prompt-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
  display: "swap",
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" }],
})

/** Value for the --font-prompt variable that globals.css and the CSS modules already read. */
export const promptFontFamily = `${promptLatin.style.fontFamily}, ${promptThai.style.fontFamily}`
