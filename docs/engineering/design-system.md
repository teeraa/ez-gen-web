# Design System — Agent C Deliverable

> Inspection date: 2026-10-12  
> Source: `index.html` CSS custom properties, class definitions, and inline styles  
> Status: Extracted — not yet implemented as Tailwind tokens

---

## 1. Color Palette

### CSS Custom Properties → Tailwind Tokens

| CSS variable | Hex / value | Tailwind name (proposed) | Role |
|---|---|---|---|
| `--bg` | `#08080d` | `bg-canvas` | Page background |
| `--surface` | `#0e0d16` | `bg-surface` | Card / sidebar surfaces |
| `--surface-2` | `#12111b` | `bg-surface-2` | Elevated surfaces |
| `--glass` | `rgba(255,255,255,.035)` | `bg-glass` | Glass panel background |
| `--glass-hover` | `rgba(255,255,255,.065)` | `bg-glass-hover` | Glass on hover |
| `--border` | `rgba(255,255,255,.085)` | `border-subtle` | Default border |
| `--border-strong` | `rgba(255,255,255,.13)` | `border-strong` | Emphasized border |
| `--purple` | `#9b6dff` | `violet-500` | Primary brand color |
| `--purple-light` | `#c4a5ff` | `violet-300` | Accent, labels |
| `--purple-dark` | `#7141d9` | `violet-700` | CTA gradient end |
| `--text` | `#f5f3fa` | `text-primary` | Body text |
| `--muted` | `#9893a8` | `text-muted` | Secondary text |
| `--subtle` | `#696477` | `text-subtle` | Tertiary / placeholder |
| `--green` | `#71d8ae` | `emerald-400` | Success / completed status |
| `--orange` | `#e9b87d` | `amber-300` | Warning / unused |

### Brand Gradients

```css
/* Primary CTA gradient */
background: linear-gradient(120deg, #a37aff, #8050e7);

/* Generate button / upgrade button */
background: linear-gradient(110deg, #8b5de8, #7043ca);

/* Sidebar active nav item */
background: linear-gradient(100deg, rgba(137,90,235,.17), rgba(137,90,235,.055));

/* Progress track fill */
background: linear-gradient(90deg, #7141d9, #b68aff);

/* Hero left fade */
background: linear-gradient(90deg, #100d1b 0%, rgba(16,13,27,.98) 26%, ...);

/* Workspace logo */
background: linear-gradient(135deg, #483477, #201832);

/* Avatar */
background: linear-gradient(135deg, #b59aff, #59419a);
```

---

## 2. Typography

### Font Families

| Family | Weights | Usage |
|---|---|---|
| `DM Sans` | 400, 450, 500, 550, 600, 650, 700 | Body, labels, inputs, captions |
| `Manrope` | 400, 500, 600, 650, 700, 750, 800 | Headings, brand name, prices |

### Type Scale (from usage in HTML)

| Class / usage | Size | Weight | Family | Letter-spacing |
|---|---|---|---|---|
| Brand name | 13px | 800 | Manrope | 1.45px |
| Hero H1 | clamp(34px,3.4vw,49px) | 750 | Manrope | -2.2px |
| Section H2 | 20px | 700 | Manrope | -0.6px |
| Generator H2 | 16px | 700 | Manrope | -0.3px |
| Panel H3 | 13px | 650 | Manrope | — |
| Card H3 | 12px | 600 | DM Sans | -0.1px |
| Body / labels | 13px | 400 | DM Sans | — |
| Small labels | 11-12px | 400-600 | DM Sans | — |
| Eyebrow / caps | 10px | 700 | DM Sans | 2px, uppercase |
| Nav items | 12px | 400 | DM Sans | — |
| Tag / badge | 9-10px | 400 | DM Sans | — |

---

## 3. Spacing & Sizing

| Token | Value | Notes |
|---|---|---|
| Sidebar width | 238px (desktop), 215px (1250px), 238px (mobile) | CSS var `--sidebar` |
| Topbar height | 66px (desktop), 58px (mobile) | |
| Content max-width | 1530px | |
| Content padding | 28px 37px 45px | Desktop |
| Content padding | 25px 25px 40px | 1250px breakpoint |
| Content padding | 18px 14px 30px | Mobile |
| Base radius | 14px | CSS var `--radius` |

---

## 4. Border Radii

| Component | Radius |
|---|---|
| Hero section | 17px |
| Generator card | 15px |
| Modals | 15px |
| Plan / tip panels | 12px |
| Project menu | 8px |
| Buttons (primary/secondary) | 8px |
| Nav items | 9px |
| Mode tabs | 6-9px |
| Segment controls | 7px |
| Creation cards | 11px |
| Tool cards | 11px |
| Toast | 10px |
| Status badge | 4px |
| Duration overlay | 4px |
| Tag badge | 5px |
| Workspace button | 11px |
| Avatar | 50% (circular) |

---

## 5. Glassmorphism Components

All glass surfaces share:
```css
background: rgba(255,255,255,.035);   /* --glass */
border: 1px solid rgba(255,255,255,.085);  /* --border */
```

The sidebar uses stronger opacity:
```css
background: rgba(10,9,15,.96);
backdrop-filter: blur(22px);   /* topbar */
backdrop-filter: blur(10px);   /* play button */
backdrop-filter: blur(18px);   /* toast */
backdrop-filter: blur(12px);   /* modal backdrop */
backdrop-filter: blur(8px);    /* creation tags */
```

---

## 6. Shadows & Glows

```css
/* Brand symbol */
box-shadow: 0 0 24px rgba(125,75,240,.12), inset 0 1px rgba(255,255,255,.1);

/* Primary button */
box-shadow: 0 5px 24px rgba(127,75,236,.2), inset 0 1px rgba(255,255,255,.16);
box-shadow: 0 8px 28px rgba(127,75,236,.3);  /* hover */

/* Upgrade button */
box-shadow: 0 4px 18px rgba(104,58,200,.17), inset 0 1px rgba(255,255,255,.16);

/* Generator card */
box-shadow: 0 15px 55px rgba(0,0,0,.15), inset 0 1px rgba(255,255,255,.025);

/* Creation card hover */
box-shadow: 0 8px 28px rgba(0,0,0,.23), 0 0 20px rgba(127,78,232,.08);

/* Modal */
box-shadow: 0 25px 90px #0009;

/* Toast */
box-shadow: 0 12px 40px rgba(0,0,0,.4);
```

---

## 7. Animations & Transitions

| Name | Value |
|---|---|
| Ease curve | `cubic-bezier(.2,.8,.2,1)` (CSS var `--ease`) |
| Default transition | `0.2s` |
| Button hover translate | `translateY(-2px)` |
| Image scale on card hover | `scale(1.055)` |
| Image filter on card hover | `brightness(.8)` |
| Play button reveal | `opacity 0→1 + transform scale(.85→1)` |
| Toast in animation | `opacity 0→1 + translateY(10px→0)` over `.3s` |
| Modal fade | `opacity 0→1` over `.2s` |
| Generating spinner | `spin 1.2s linear infinite` |

**Reduced-motion:** All transitions set to `0.01ms`, animations single-iteration.

---

## 8. Status Colors

| Status | Text color | Background |
|---|---|---|
| Completed | `#71d8ae` (--green) | `rgba(113,216,174,.09)` |
| Processing | `#c4a5ff` (--purple-light) | `rgba(155,109,255,.12)` |
| Draft | `#b3adbf` | `rgba(255,255,255,.06)` |

---

## 9. Responsive Breakpoints

| Breakpoint | Width | Changes |
|---|---|---|
| Wide | ≥1600px | Increased horizontal padding |
| Medium | ≤1250px | Sidebar narrower, 2-col gallery, 2-col projects, 2-col tools |
| Tablet | ≤850px | Sidebar off-canvas, mobile menu visible, 2-col controls |
| Mobile | ≤560px | 1-col gallery, 1-col projects, search collapses, topbar compact |

---

## 10. Icon System

Icons are **inline SVG sprites** in the HTML — no icon library runtime is required.

| Symbol ID | Usage |
|---|---|
| `i-sparkles` | Brand, generate, tips |
| `i-home` | Home nav |
| `i-video` | Create Video nav, AI Video Generator tool |
| `i-compass` | Explore nav |
| `i-library` | My Library nav |
| `i-folder` | Projects nav |
| `i-heart` | Favorites nav, creation card favorite |
| `i-search` | Global search |
| `i-bell` | Notifications |
| `i-chevron` | Breadcrumb separator |
| `i-down` | Dropdowns, workspace switcher |
| `i-play` | Gallery play button |
| `i-upload` | Reference image upload |
| `i-image` | Image to Video mode |
| `i-clock` | Loading state |
| `i-check` | Success state |
| `i-more` | Context menu trigger |
| `i-settings` | Account settings |
| `i-close` | Modal close, remove image |
| `i-menu` | Mobile hamburger |
| `i-wand` | Text to Video mode |
| `i-film` | Image to Image mode |
| `i-move` | Motion Control tool |
| `i-zap` | Video Enhancer tool, AI badge |
| `i-arrow` | "View all" links |
| `i-cpu` | Model badge |

**Implementation note:** In the React implementation, use `lucide-react` for the
equivalent icons. The symbol IDs map 1-to-1 to Lucide icon names.

---

## 11. Component Variants Reference

### Button variants
- `.btn-primary`: gradient background, inner highlight, shadow
- `.btn-secondary`: glass background, white border
- `.upgrade-btn`: purple gradient, inset highlight
- `.text-link`: transparent, accent color, arrow icon

### Badge / pill variants
- `.status.completed` / `.processing` / `.draft`
- `.creation-tag`: dark glass overlay
- `.model-badge`: glass border
- `.plan-label`: purple tint

### Input variants
- `.search-wrap`: glass, collapses to icon on mobile
- `.prompt-box textarea`: dark glass, resizable, character counter
- `.select-wrap select`: dark glass, custom chevron
- `.segment-control`: pill switcher
- `.upload-zone`: dashed border, drag-and-drop states

---

## 12. Visual Regression Checklist

When converting to React, verify each section against the reference:

- [ ] Sidebar glassmorphism, purple gradient on active item
- [ ] Hero image fade from solid bg to transparent (left-to-right gradient)
- [ ] Generator card inner top glow line (`:before` linear gradient)
- [ ] Mode tabs pill indicator
- [ ] Upload zone drag-and-drop border change
- [ ] Creation card image scale + play button reveal on hover
- [ ] Favorite button filled heart state
- [ ] Toast slide-in from bottom-right
- [ ] Modal backdrop blur
- [ ] Pricing modal featured card border
- [ ] Mobile sidebar off-canvas translate
- [ ] Progress bar gradient
- [ ] Reduced-motion: no animations
