# Service logo audit — 4 November 2026

The five visible service brands now use local official publisher assets rather
than Simple Icons recoloured by the application. SOURCE_SERVICES and every
Spotify account, preview, result, status and action icon share the same assets.
The unused YouTube (video) icon import was removed.

- Spotify: official 2024 icon kit; unmodified black/white/green SVGs retained.
- Apple Music: official apple.com Music app PNG.
- YouTube Music: official music.youtube.com 144px icon.
- TIDAL: native black mask icon and white logo SVG from tidal.com. No cyan tint.
- Deezer: DEEZER SA official App Store artwork (id 292738169), with current purple
  heart instead of the legacy equalizer. The official newsroom confirms the
  November 2023 rebrand; its downloadable logo ZIP returned HTTP 403 here.

`client/public/brands/sources.json` records exact source URLs and SHA-256 hashes.
The logo components preserve native colours and proportions, use supplied
monochrome variants across themes and enforce Spotify's 21px minimum.

Validation: production build, 55 existing tests (after building the static
fixtures), design token/required contrast/component-spec gates, new-file
hardcode and emoji gates. Local responsive, keyboard, target-size and intent render gates reported SKIPPED
without Playwright. The mobile-first gate could not import Playwright. These are
unavailable measurements, not passes; hosted visual QA belongs to the release owner.
