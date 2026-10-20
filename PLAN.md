# Playlist Port: UI/UX Audit & Redesign Plan

## 1. Executive Summary

This plan audits the current user experience of Playlist Port (a playlist migration application for Spotify and upcoming music platforms) and details the transformation from an overloaded two-column asynchronous workspace into an effortless, guided 6-step stepper experience.

---

## 2. Current User Flow (As It Exists Today)

```
[ Landing Page ]
      │
      ├── Top Navigation (Brand, How it works, FAQ, Theme toggle, CTA)
      ├── Marketing Hero (Headline, value props, live preview card)
      ├── Proof Strip (Order, Private, 0 stored, Free)
      │
      ▼
[ Transfer Workspace (#workspace) ]
      │
      ├── Stepper Header (3 steps: 1 Connect, 2 Choose playlist, 3 Copy)
      ├── 2-Column Asynchronous Workspace:
      │     ├── LEFT COLUMN:
      │     │     ├── Step 1: Connect your account (Expandable / Collapse)
      │     │     └── Step 2: Choose a playlist (Search, Tabs, List, Load More)
      │     │
      │     └── RIGHT COLUMN:
      │           ├── Step 3: Destination account (Same account vs Another account)
      │           └── Review & Copy Form (Selected playlist card, new name input, Copy button)
      │
      ├── Transfer State: Replaces workspace with TransferPanel (Indeterminate spinner + timer)
      │
      └── Result State: Replaces workspace with ResultPanel (Success or Partial)
```

### Flow Friction Points:
1. **Parallel Visual Overload**: Steps 1, 2, and 3 are displayed simultaneously in a dense two-column layout. Users who have not yet connected an account or selected a playlist are confronted with empty destination controls, review cards, and disabled action buttons.
2. **Ambiguous Progression**: The stepper at the top indicates 3 steps, but the form controls are scattered across two columns with differing visual hierarchy.
3. **No Multi-Select or Batch Visibility**: Step 2 only permits single-item selection without aggregate track counters across multiple playlists.

---

## 3. Top 10 Usability Problems (Ranked by Impact)

| Rank | Problem | Severity | User Impact | Code / UI Evidence |
|---|---|---|---|---|
| **1** | **Severe Horizontal Text Overflow & Clipping on Mobile (<375px)** | **Critical (Blocker)** | Mobile users see severed hero headings (`"Move your playli without losing th order."`) and cut-off cards. CTA button in header gets pushed off-viewport. | `hero-copy h1` uses non-wrapping clamp font sizes with overflow margins; viewport width at 375px forces horizontal scroll or clipping. |
| **2** | **Simultaneous 3-Step Information Overload** | **High** | Users arrive at the workspace and see Step 1 (Connect), Step 2 (Playlist list), and Step 3 (Destination & Review) all in one screen. Unclear which action comes next. | `.workflow-grid` renders `.workflow-main` (Steps 1 & 2) and `.workflow-side` (Step 3 & Review) simultaneously. |
| **3** | **Unclear Service Ecosystem & Missing Service Cards** | **High** | Site claims to move playlists between services, but Connect UI only shows a single green button for Spotify. No visual representation of supported or upcoming platforms (Apple Music, YouTube Music). | Step 1 only renders `<Account>` for Spotify. Service list is banished to a decorative section below the workspace. |
| **4** | **No Multi-Playlist Selection or Bulk Live Summary** | **High** | Users migrating their library can only select a single playlist at a time. No "Select All", "Deselect All", or live summary ("3 playlists, 412 tracks"). | State only holds a scalar `selectedId`; clicking any row immediately deselects previous choice. |
| **5** | **Hidden Free-Tier Limits & Pre-Flight Constraints** | **Medium-High** | Users learn about local file exclusions, API rate limits, or embed fallbacks only after an error or partial transfer occurs, wasting time. | Limits are relegated to the FAQ at the bottom of the page or triggered in `TransferPanel` error states. |
| **6** | **Displaced Destination Configuration** | **Medium-High** | Destination account choice (Same account vs Second account) is located in the right sidebar before the user has even chosen what they want to copy. | The radio group for destination sits directly above the review form in `.workflow-side`. |
| **7** | **Indeterminate Transfer Progress & Ambiguous Tab Safety** | **Medium** | During transfers, progress is shown via an indeterminate shimmer bar with no item-level percentage or estimated time remaining. The tab warning note is ambiguous. | `progress-track` has animated gradient width without actual percentage; `progressMessage` is based solely on elapsed seconds. |
| **8** | **All-or-Nothing Result without Item-Level Reconciliation** | **Medium** | Completed screen only lists numbers ("45 copied, 3 skipped"). Users cannot see *which* songs were skipped, cannot accept close-match suggestions, and cannot download a CSV log. | `ResultPanel` only displays `result.copied` and `result.skipped` without item details or export capability. |
| **9** | **Sub-44px Touch Targets & Mobile Ergonomics** | **Medium** | Filter tabs, sort dropdowns, search clear buttons, and pagination controls are under 36px in height, failing WCAG touch target standards on mobile touchscreens. | `.filter-tabs button`, `.sort-control`, `.icon-button` have padding yielding 32px height. |
| **10** | **Keyboard Focus & Screen Reader Status Announcement Gaps** | **Medium** | Transitioning between steps doesn't move programmatic focus to step headings; screen reader users are not proactively notified of search filter changes or active step shifts. | Stepper is rendered as a presentational list; missing `aria-live` dynamic announcements during list pagination and tab switching. |

---

## 4. Proposed New User Flow: The 6-Step Guided Stepper

```
  ┌──────────────┐
  │ 1. CONNECT   │ ──► Choose & connect source service (Spotify active; others roadmap)
  │    SOURCE    │     Clear permissions & privacy note
  └──────┬───────┘
         │
  ┌──────▼───────┐
  │ 2. PICK      │ ──► Searchable playlist browser with cover art, track counts
  │  PLAYLISTS   │     Select individual or multiple playlists + Select All / None
  │              │     Live summary bar: "3 playlists, 412 tracks"
  └──────┬───────┘
         │
  ┌──────▼───────┐
  │ 3. CONNECT   │ ──► Choose destination: Same account or connect another account
  │  DESTINATION │     Clear destination permissions & privacy note
  └──────┬───────┘
         │
  ┌──────▼───────┐
  │ 4. REVIEW    │ ──► Pre-flight manifest: Source ➔ Destination
  │              │     Item count, custom playlist name(s), Free-tier limitations notice
  │              │     One clear primary "Start Transfer" action; Back always available
  └──────┬───────┘
         │
  ┌──────▼───────┐
  │ 5. TRANSFER  │ ──► Real per-playlist progress bar, processed item counts
  │              │     Estimated time remaining, Safe Cancel with confirmation modal
  │              │     Clear message: "Keep this tab open while transfer runs"
  └──────┬───────┘
         │
  ┌──────▼───────┐
  │ 6. RESULTS   │ ──► Complete reconciliation: Matched, Close matches, Skipped/Not found
  │              │     Review unmatched tracks, accept suggested close matches
  │              │     Download CSV Report, direct link to open new playlist in Spotify
  │              │     "Transfer another playlist" reset
  └──────────────┘
```

---

## 5. State Handling Matrix

| State | Visual Treatment & Behavior | Remedy / Microcopy |
|---|---|---|
| **Empty State** | Clean card with themed icon, helpful explanation, and contextual action. | "No playlists found matching your search. Clear search or paste a Spotify link." |
| **Loading State** | Smooth shimmering skeleton cards matching surface colors (no layout shift). | "Loading your Spotify playlists..." (with ARIA `aria-busy="true"` and live status). |
| **Session Expired Error** | Inline high-contrast alert banner with specific reconnect button. | "Spotify session expired. Reconnect your account to continue." [Reconnect Button] |
| **Rate Limited** | Graceful countdown indicator explaining Spotify rate limits. | "Spotify is rate limiting requests. Auto-retrying in 24 seconds..." [Retry Now Button] |
| **Offline State** | Auto-detecting offline banner via `navigator.onLine`. | "You are currently offline. Check your internet connection." |
| **Partial Success** | Warning banner with details on which items succeeded and which failed. | "18 of 25 tracks transferred. 7 items could not be copied. Review details and download report below." |
| **Safe Cancel Dialog** | Focus-trapped modal asking for confirmation before halting API transfer. | "Cancel transfer? Items already copied will remain in your destination account." |

---

## 6. Verification & Implementation Strategy

1. Maintain strict backward compatibility with existing tests (`client/test/storage.test.mjs` and `server/test/*.test.cjs`).
2. Guarantee required text strings remain present in rendered SSR markup (`Move your playlists`, `Connect your account`, `Same Spotify account`).
3. Refactor `client/src/App.jsx` to implement the 6-step guided stepper with single primary action per view and Back button navigation.
4. Enhance `client/src/styles.css` with responsive fluid typography, 44px+ touch targets, 150–250ms transitions, WCAG AA contrast tokens, and dark/light mode refinement.
5. Capture before and after viewport screenshots at 375px, 768px, and 1280px to prove resolution of all visual defects.
