"use client";

/**
 * Inline script that runs during HTML parsing (before first paint). On the client it renders as
 * text/plain so React does not warn about rendering <script>; suppressHydrationWarning covers the type swap.
 * Only pass constant strings — never user input.
 */
export function InlineScript({ html }: { html: string }) {
  return <script type={typeof window === "undefined" ? "text/javascript" : "text/plain"} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: html }} />;
}
