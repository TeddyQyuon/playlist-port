# Playlist Port Design System

A minimalist, high-contrast, accessible design system engineered for music playlist migration across streaming platforms.

---

## 1. Design Philosophy

- **Professional & Calm**: Generous whitespace, refined microcopy, deliberate typography, and no flashing distractions.
- **One Accent**: Spotify green (`#1ed760`) is reserved strictly for primary actions, success states, and verified indicators.
- **Subtle Borders over Heavy Shadows**: Clean 1px borders with delicate contrast provide crisp depth in both dark and light modes without visual clutter.
- **Micro-Interactions**: Predictable 150ms–200ms cubic-bezier transitions with immediate visual feedback, respecting `prefers-reduced-motion`.
- **Accessibility by Default**: Fully keyboard navigatable, WCAG 2.1 AA compliant contrast ratios across both themes, 44px minimum touch targets, and ARIA live regions for asynchronous updates.

---

## 2. Color Palette & Tokens

### 2.1 Theme Tokens

```css
:root {
  /* Canvas & Surfaces (Dark - Default) */
  --bg-canvas: #090b0e;
  --bg-subtle: #0e1217;
  --bg-surface: #131820;
  --bg-surface-raised: #181f2a;
  --bg-surface-hover: #1f2837;
  --bg-surface-active: #253042;
  --bg-field: #11161e;

  /* Typography */
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --text-tertiary: #64748b;
  --text-disabled: #475569;
  --text-inverse: #090b0e;

  /* Borders & Dividers */
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-default: rgba(255, 255, 255, 0.14);
  --border-strong: rgba(255, 255, 255, 0.24);
  --border-focus: #1ed760;

  /* Accent (Spotify Green) */
  --accent-base: #1ed760;
  --accent-hover: #16b84f;
  --accent-active: #139a42;
  --accent-soft: rgba(30, 215, 96, 0.12);
  --accent-border: rgba(30, 215, 96, 0.32);
  --accent-contrast: #041409;

  /* Semantic Feedback */
  --success-base: #10b981;
  --success-soft: rgba(16, 185, 129, 0.12);
  --success-border: rgba(16, 185, 129, 0.32);
  --success-text: #34d399;

  --warning-base: #f59e0b;
  --warning-soft: rgba(245, 158, 11, 0.12);
  --warning-border: rgba(245, 158, 11, 0.32);
  --warning-text: #fbbf24;

  --error-base: #ef4444;
  --error-soft: rgba(239, 68, 68, 0.12);
  --error-border: rgba(239, 68, 68, 0.32);
  --error-text: #f87171;

  --info-base: #3b82f6;
  --info-soft: rgba(59, 130, 246, 0.12);
  --info-border: rgba(59, 130, 246, 0.32);
  --info-text: #60a5fa;

  /* Shadows */
  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.4);
  --shadow-sm: 0 2px 6px rgba(0, 0, 0, 0.35);
  --shadow-md: 0 8px 24px rgba(0, 0, 0, 0.45);
  --shadow-lg: 0 16px 40px rgba(0, 0, 0, 0.6);
  --shadow-modal: 0 24px 64px rgba(0, 0, 0, 0.75);
}

:root[data-theme='light'] {
  /* Canvas & Surfaces (Light) */
  --bg-canvas: #f8fafc;
  --bg-subtle: #f1f5f9;
  --bg-surface: #ffffff;
  --bg-surface-raised: #ffffff;
  --bg-surface-hover: #f1f5f9;
  --bg-surface-active: #e2e8f0;
  --bg-field: #f8fafc;

  /* Typography */
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-tertiary: #64748b;
  --text-disabled: #94a3b8;
  --text-inverse: #ffffff;

  /* Borders & Dividers */
  --border-subtle: rgba(15, 23, 42, 0.08);
  --border-default: rgba(15, 23, 42, 0.14);
  --border-strong: rgba(15, 23, 42, 0.26);
  --border-focus: #0f9f43;

  /* Accent (Spotify Green - Tuned for WCAG AA on white) */
  --accent-base: #1ed760;
  --accent-hover: #17b34e;
  --accent-active: #129440;
  --accent-soft: rgba(30, 215, 96, 0.14);
  --accent-border: rgba(15, 159, 67, 0.36);
  --accent-contrast: #041409;

  /* Semantic Feedback */
  --success-base: #059669;
  --success-soft: rgba(5, 150, 105, 0.1);
  --success-border: rgba(5, 150, 105, 0.28);
  --success-text: #065f46;

  --warning-base: #d97706;
  --warning-soft: rgba(217, 119, 6, 0.1);
  --warning-border: rgba(217, 119, 6, 0.3);
  --warning-text: #92400e;

  --error-base: #dc2626;
  --error-soft: rgba(220, 38, 38, 0.1);
  --error-border: rgba(220, 38, 38, 0.28);
  --error-text: #991b1b;

  --info-base: #2563eb;
  --info-soft: rgba(37, 99, 235, 0.1);
  --info-border: rgba(37, 99, 235, 0.28);
  --info-text: #1e40af;

  /* Shadows */
  --shadow-xs: 0 1px 2px rgba(15, 23, 42, 0.05);
  --shadow-sm: 0 2px 6px rgba(15, 23, 42, 0.06);
  --shadow-md: 0 8px 24px rgba(15, 23, 42, 0.08);
  --shadow-lg: 0 16px 40px rgba(15, 23, 42, 0.12);
  --shadow-modal: 0 24px 64px rgba(15, 23, 42, 0.18);
}
```

---

## 3. Typography Scale

Font Family: `'Inter Variable', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

| Token | Size | Line Height | Weight | Usage |
|---|---|---|---|---|
| `font-xs` | 12px (0.75rem) | 16px (1.33) | 500 / 600 | Badges, tags, eyebrow labels |
| `font-sm` | 13px (0.8125rem) | 18px (1.38) | 400 / 500 | Metadata, helper text, footnote |
| `font-base` | 15px (0.9375rem) | 22px (1.46) | 400 / 500 | Body text, inputs, button labels |
| `font-md` | 17px (1.0625rem) | 24px (1.41) | 600 | Card titles, playlist row headers |
| `font-lg` | 20px (1.25rem) | 28px (1.4) | 600 | Step titles, section headings |
| `font-xl` | 24px (1.5rem) | 32px (1.33) | 700 | Main panel headings, modal titles |
| `font-2xl` | 32px (2.0rem) | 38px (1.18) | 700 / 800 | Section hero titles |
| `font-3xl` | 44px (2.75rem) | 50px (1.14) | 800 | Landing hero title (responsive clamp) |

---

## 4. Spacing Grid (8px Base System)

| Token | Value | Rem | Typical Application |
|---|---|---|---|
| `--space-1` | 4px | 0.25rem | Icon gaps, badge padding |
| `--space-2` | 8px | 0.5rem | Button icon spacing, input padding vertical |
| `--space-3` | 12px | 0.75rem | Compact item padding, list row gap |
| `--space-4` | 16px | 1.0rem | Standard card padding, form group gap |
| `--space-5` | 20px | 1.25rem | Stepper item gap, panel header spacing |
| `--space-6` | 24px | 1.5rem | Panel body padding, modal padding |
| `--space-8` | 32px | 2.0rem | Major section margins |
| `--space-10` | 40px | 2.5rem | Section spacing |
| `--space-12` | 48px | 3.0rem | Hero padding |
| `--space-16` | 64px | 4.0rem | Major section gap |

---

## 5. Border Radii

- `--radius-xs`: 4px (tags, sub-elements)
- `--radius-sm`: 8px (inputs, badges, small buttons)
- `--radius-md`: 12px (standard buttons, playlist art, tooltips)
- `--radius-lg`: 16px (cards, dropdown menus, alert boxes)
- `--radius-xl`: 24px (major workflow panel, modal containers)
- `--radius-full`: 9999px (pills, avatar badges, toggles)

---

## 6. Component Style Specifications

### 6.1 Buttons
- **Touch Targets**: Minimum `44px x 44px` on mobile screens.
- **Primary**: Solid green `var(--accent-base)`, text `var(--accent-contrast)` with 600 font weight. Hover: `var(--accent-hover)`, transform `translateY(-1px)`. Active: `translateY(0)`.
- **Secondary**: Background `var(--bg-surface-raised)`, border `1px solid var(--border-default)`, text `var(--text-primary)`. Hover: `var(--bg-surface-hover)`.
- **Ghost**: Transparent background, text `var(--text-secondary)`, hover background `var(--bg-surface-hover)`, hover text `var(--text-primary)`.
- **Destructive / Danger**: Soft red background `var(--error-soft)`, border `var(--error-border)`, text `var(--error-text)`.
- **Focus State**: Visible `2px solid var(--border-focus)` with `2px` offset ring (`outline: 2px solid var(--border-focus); outline-offset: 2px`).

### 6.2 Service Cards (Steps 1 & 3)
- Rounded cards (`--radius-lg`), subtle border (`--border-subtle`).
- Prominent service logo (Spotify, Apple Music, YouTube Music, etc.).
- Active/Connected indicator with animated status dot.
- Explicit permissions explanation line ("Read access to playlists & write access to create new copies").
- Short privacy assurance ("Tokens held in encrypted, 24-hour HttpOnly cookies. Never stored in a permanent database").

### 6.3 Playlist Selector (Step 2)
- Fast filter tabs (All, Created by you, Followed).
- Integrated search bar with clear button (`Esc` to dismiss, `/` shortcut).
- Checkbox selection or card toggle with multi-select support ("Select All / None").
- Live counter pill: e.g. "3 playlists selected · 412 tracks".
- Visual thumbnail with fallback icon and playlist item count tag.

### 6.4 Review Card (Step 4)
- Source-to-Destination visual bridge with account avatars and service badges.
- Pre-flight checklist confirming:
  - Total playlists to copy.
  - Total tracks to process.
  - Playlist naming preview.
  - Clear statement of Free-Tier limits (e.g. "Free tier Spotify accounts can copy all tracks; local and region-restricted audio files cannot be transferred").
- Primary "Start Transfer" action with secondary "Back to Edit".

### 6.5 Transfer Progress (Step 5)
- Real per-playlist progress bar with completed/total track counter.
- Estimated time remaining calculation based on item batches.
- Unload safeguard: `beforeunload` warning.
- "Safe to leave this tab?" transparency badge: explicitly states that client keeps active session for verification.
- Cancel Transfer button with a clean, focus-trapped confirmation modal.

### 6.6 Results Breakdown (Step 6)
- Tabular breakdown cards:
  - **Matched**: Exact matches copied to destination.
  - **Close Matches**: Potential alternatives found with review & accept toggle.
  - **Not Found / Skipped**: Local files or unavailable items with exact skip reasons.
- Action toolbar:
  - "Open in Spotify" direct deep link.
  - "Download CSV Report" exporting full track list with statuses.
  - "Retry Failed Items" for transient network/rate limit issues.
  - "Transfer Another Playlist" resetting the workflow cleanly.

### 6.7 Feedback & Modals
- **Dialogs / Modals**: Centered backdrop with `backdrop-filter: blur(8px)`. Key trap on Tab, `Esc` dismisses.
- **Alerts & Inlines**: Rounded container with matching icon, soft tinted background, crisp border, and clear dismiss control.
- **Loading Skeletons**: Smooth shimmering linear-gradient animation with 1.6s cycle matching surface tones.
