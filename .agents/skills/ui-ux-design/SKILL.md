---
name: ui-ux-design
description: Guides the creation of state-of-the-art, premium UI/UX designs and modern frontend experiences. Use when building components, pages, styling CSS, designing user flows, or polishing visual aesthetics, animations, and responsive layouts.
---

# UI/UX Design & Visual Excellence

This skill sets the standard for creating high-end, responsive, visually stunning, and frictionless user interfaces.

---

## 🎨 1. Color Palette & Theming

- **Curated Theme Tokens:** Use CSS variables for all color tokens (`--bg-primary`, `--bg-secondary`, `--bg-card`, `--text-primary`, `--text-secondary`, `--accent-primary`, `--border-color`).
- **Avoid Default Generic Colors:** Never use raw `#ff0000`, `#00ff00`, `#0000ff`, or harsh stark black `#000000`. Use tailored HSL/Hex tones (e.g. rich slates `#0f172a`, deep indigos `#1e1b4b`, emerald greens `#10b981`, electric blues `#2563eb`).
- **Cohesive Light & Dark Modes:** Ensure both dark and light modes look intentional, with balanced contrast ratios (WCAG AA minimum 4.5:1 for body text) and soft ambient borders.
- **Surface Layering & Depth:** Create depth using multi-layered backgrounds, subtle border highlights (`1px solid rgba(255, 255, 255, 0.08)` in dark mode), and soft diffuse drop-shadows.

---

## 🔤 2. Typography & Visual Hierarchy

- **Modern Type System:** Use clean, readable geometric or grotesque sans-serif fonts (e.g. Inter, Outfit, Segoe UI, Roboto) with balanced line-heights (`1.4` to `1.6` for body, `1.1` to `1.25` for headings).
- **Clear Typographic Scale:** Maintain a strict hierarchy (`h1` 28-32px, `h2` 20-24px, `h3` 16-18px, body 14-15px, captions 12-13px).
- **Monospace for Numbers & Codes:** Use `font-variant-numeric: tabular-nums` or monospace fonts for prices, barcodes, quantities, and numeric tables so values align vertically without jitter.

---

## ✨ 3. Micro-Interactions & Motion

- **Smooth State Transitions:** Apply snappy transitions (`transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1)`) on buttons, cards, tabs, and interactive elements.
- **Tactile Feedback:** Buttons should have subtle hover states (brightness lift/border glow) and a tactile press state (`transform: scale(0.98)`).
- **Dynamic Data Animations:** Use animated counters (`AnimatedNumber`), sparkline trends, and progress bars to make dashboard metrics feel alive.
- **Skeleton Loading States:** Always provide animated skeleton loaders (`Skeleton.tsx`) matching the layout geometry during async data fetches instead of sudden layout shifts or blank screens.

---

## 🌐 4. Layout Rhythm & RTL/Bilingual Support

- **Consistent Spacing Grid:** Stick to a 4px/8px spacing scale (`0.25rem`, `0.5rem`, `0.75rem`, `1rem`, `1.5rem`, `2rem`).
- **RTL-Safe CSS:** Use logical properties or flexbox/grid layout (`gap`, `justify-content`, `align-items`, `margin-inline-start`) so interfaces mirror naturally between Arabic (RTL) and English (LTR).
- **Keyboard Navigation & Accessibility:** Ensure all forms, modals, and tables are navigable via keyboard shortcuts (`Enter`, `Tab`, `Escape`, `F1-F12`) with visible, stylish focus rings (`outline: 2px solid var(--accent-primary)`).

---

## 🧩 5. Modal & Notification UX

- **Contextual Toasts:** Never use native blocking `alert()` or `confirm()`. Use non-intrusive toast notifications for feedback and styled confirmation modals (`ConfirmDialog.tsx`) for destructive actions.
- **Clear Empty & Error States:** Empty tables and lists must include a helpful icon, a friendly explanation, and a direct primary action button (e.g. "Add your first product").
