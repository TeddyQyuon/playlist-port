// Vendor artwork is bundled locally. See public/brands/sources.json.
// Use supplied light/dark variants, never CSS recolouring or hand-drawn paths.
import './brand-icons.css';

function BrandIcon({ name, file, className = '', ...props }) {
  return <img {...props} src={`/brands/${file}`} alt="" aria-hidden="true"
    className={`official-brand-icon official-brand-${name} ${className}`.trim()} decoding="async" />;
}

export function SpotifyIcon(props) {
  return <span {...props} className={`official-brand-pair ${props.className || ''}`.trim()} aria-hidden="true">
    <BrandIcon name="spotify" file="spotify-black.svg" className="brand-on-light" />
    <BrandIcon name="spotify" file="spotify-white.svg" className="brand-on-dark" />
  </span>;
}

export const AppleMusicIcon = (props) => <BrandIcon {...props} name="apple-music" file="apple-music.png" />;
export const YouTubeMusicIcon = (props) => <BrandIcon {...props} name="youtube-music" file="youtube-music.png" />;
export const DeezerIcon = (props) => <BrandIcon {...props} name="deezer" file="deezer.jpg" />;
export const TidalIcon = (props) => <span {...props} className={`official-brand-pair ${props.className || ''}`.trim()} aria-hidden="true">
  <BrandIcon name="tidal" file="tidal.svg" className="brand-on-light" />
  <BrandIcon name="tidal" file="tidal-white.svg" className="brand-on-dark" />
</span>;
