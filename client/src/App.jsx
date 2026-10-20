import { useEffect, useRef, useState } from 'react';
import { SiApplemusic, SiDeezer, SiSpotify, SiTidal, SiYoutube, SiYoutubemusic } from 'react-icons/si';
import {
  FiAlertTriangle, FiArrowRight, FiCheck, FiCheckCircle, FiChevronDown, FiCopy,
  FiExternalLink, FiInfo, FiLink2, FiLock, FiMusic, FiPlus, FiRefreshCw,
  FiSearch, FiShield, FiUser, FiUsers, FiX
} from 'react-icons/fi';
import { api } from './api.js';
import { readSessionItem, removeSessionItem, writeSessionItem } from './storage.js';

const services = [
  { name: 'Spotify', Icon: SiSpotify, ready: true },
  { name: 'Apple Music', Icon: SiApplemusic },
  { name: 'YouTube Music', Icon: SiYoutubemusic },
  { name: 'YouTube', Icon: SiYoutube },
  { name: 'Deezer', Icon: SiDeezer },
  { name: 'TIDAL', Icon: SiTidal }
];

const filters = [
  { id: 'all', label: 'All' },
  { id: 'mine', label: 'Created by you' },
  { id: 'followed', label: 'Followed' }
];

const steps = ['Connect account', 'Choose playlist', 'Review & copy', 'Result'];

function Account({ label, account, onConnect, onDisconnect, disabled, connectLabel = 'Connect Spotify', justConnected }) {
  return (
    <div className={`account-card ${account ? 'is-connected' : ''} ${justConnected ? 'just-connected' : ''}`}>
      <span className="account-icon"><SiSpotify aria-hidden="true" /></span>
      <div className="account-info">
        <span className="eyebrow">{label}</span>
        <strong>{account ? account.name : 'Spotify'}</strong>
        <span className="account-meta">
          {account ? (
            <><span className="status-dot" aria-hidden="true" />{justConnected ? 'Connected just now' : 'Connected securely'}</>
          ) : 'No account connected yet'}
        </span>
      </div>
      {account ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onDisconnect}
          disabled={disabled}
          aria-label={`Disconnect ${label.toLowerCase()}`}
        >
          Disconnect
        </button>
      ) : (
        <button type="button" className="btn btn-primary btn-sm" onClick={onConnect} disabled={disabled}>
          {connectLabel}
        </button>
      )}
    </div>
  );
}

function StepHeading({ number, title, description, id }) {
  return (
    <div className="step-heading">
      <span className="step-number" aria-hidden="true">{number}</span>
      <div>
        <h3 id={id}>{title}</h3>
        {description && <p>{description}</p>}
      </div>
    </div>
  );
}

function Stepper({ currentStep }) {
  return (
    <>
      <ol className="stepper" aria-label="Transfer progress">
        {steps.map((label, index) => {
          const number = index + 1;
          const state = number < currentStep ? 'done' : number === currentStep ? 'current' : 'upcoming';
          return (
            <li key={label} className={state} aria-current={state === 'current' ? 'step' : undefined}>
              <span className="step-marker" aria-hidden="true">{state === 'done' ? <FiCheck /> : number}</span>
              <span>{label}{state === 'done' && <span className="sr-only"> (completed)</span>}</span>
            </li>
          );
        })}
      </ol>
      <div className="stepper-compact">
        <span className="stepper-compact-label">Step {currentStep} of {steps.length}</span>
        <strong>{steps[currentStep - 1]}</strong>
        <span className="stepper-compact-track" aria-hidden="true">
          <i style={{ width: `${(currentStep / steps.length) * 100}%` }} />
        </span>
      </div>
    </>
  );
}

function PlaylistArt({ playlist, className = '' }) {
  return (
    <span className={`playlist-art ${className}`}>
      <span className="playlist-art-fallback" aria-hidden="true"><SiSpotify /></span>
      {playlist.image && (
        <img
          src={playlist.image}
          alt=""
          loading="lazy"
          onError={(event) => { event.currentTarget.remove(); }}
        />
      )}
    </span>
  );
}

function ResultPanel({ result, destinationName, onReset, copyState, onCopy }) {
  const panelRef = useRef(null);
  useEffect(() => { panelRef.current?.focus(); }, []);

  return (
    <div className="result-panel result-success" ref={panelRef} tabIndex={-1} role="status">
      <div className="result-hero">
        <span className="result-icon"><FiCheckCircle aria-hidden="true" /></span>
        <div>
          <span className="eyebrow">TRANSFER COMPLETE</span>
          <h3>Playlist copied</h3>
          <p>“{result.name}” is ready in {destinationName}.</p>
        </div>
        {result.verified && <span className="verified-pill"><FiShield aria-hidden="true" /> Verified</span>}
      </div>

      <div className="result-stats">
        <div><span>Items copied</span><strong>{result.copied}</strong></div>
        <div><span>Skipped</span><strong>{result.skipped || 0}</strong></div>
        <div><span>Destination</span><strong className="truncate" title={destinationName}>{destinationName}</strong></div>
      </div>

      {result.isEmbedFallback && result.copied < result.originalTotal && (
        <div className="inline-note inline-note-warning">
          <FiAlertTriangle aria-hidden="true" />
          <p><strong>Public preview limited this copy.</strong> Spotify&apos;s public playlist preview exposed {result.copied} of {result.originalTotal} items. Reconnect the source account and try again to copy everything.</p>
        </div>
      )}

      <div className="result-actions">
        <a className="btn btn-primary" href={result.url} target="_blank" rel="noreferrer">
          <SiSpotify aria-hidden="true" /> Open in Spotify <FiExternalLink aria-hidden="true" />
        </a>
        <button type="button" className="btn btn-secondary" onClick={() => onCopy(result.url)}>
          {copyState === 'copied' ? <><FiCheck aria-hidden="true" /> Link copied</> : copyState === 'failed' ? <><FiAlertTriangle aria-hidden="true" /> Copy failed</> : <><FiCopy aria-hidden="true" /> Copy link</>}
        </button>
        <span className="sr-only" aria-live="polite">{copyState === 'copied' ? 'Link copied to clipboard.' : copyState === 'failed' ? 'Could not copy the link.' : ''}</span>
      </div>
      <p className="result-note"><FiInfo aria-hidden="true" /><span>The copy is hidden from your public profile. Anyone with its link can open it until you choose <strong>Make private</strong> in Spotify.</span></p>
      <div className="result-again">
        <span className="result-again-icon" aria-hidden="true"><FiPlus /></span>
        <div className="result-again-copy">
          <strong>Ready for another playlist?</strong>
          <span>Start a new copy in this workspace — your source playlists stay untouched.</span>
        </div>
        <button type="button" className="btn btn-again" onClick={onReset}>
          Transfer another playlist <FiArrowRight aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function PartialPanel({ partial, error, onReset, copyState, onCopy }) {
  const panelRef = useRef(null);
  useEffect(() => { panelRef.current?.focus(); }, []);

  return (
    <div className="result-panel result-partial" ref={panelRef} tabIndex={-1} role="status">
      <div className="result-hero">
        <span className="result-icon"><FiAlertTriangle aria-hidden="true" /></span>
        <div>
          <span className="eyebrow">COPY INCOMPLETE</span>
          <h3>The copy stopped early</h3>
          <p>{partial.copied} of {partial.total} items were copied before Spotify stopped the transfer.</p>
        </div>
      </div>
      {error && <p className="result-error"><FiInfo aria-hidden="true" /> {error}</p>}
      <div className="result-actions">
        <a className="btn btn-primary" href={partial.url} target="_blank" rel="noreferrer">
          <SiSpotify aria-hidden="true" /> Open partial playlist <FiExternalLink aria-hidden="true" />
        </a>
        <button type="button" className="btn btn-secondary" onClick={() => onCopy(partial.url)}>
          {copyState === 'copied' ? <><FiCheck aria-hidden="true" /> Link copied</> : copyState === 'failed' ? <><FiAlertTriangle aria-hidden="true" /> Copy failed</> : <><FiCopy aria-hidden="true" /> Copy link</>}
        </button>
        <span className="sr-only" aria-live="polite">{copyState === 'copied' ? 'Link copied to clipboard.' : copyState === 'failed' ? 'Could not copy the link.' : ''}</span>
      </div>
      <p className="result-note"><FiInfo aria-hidden="true" /><span>A partial playlist already exists in Spotify. Starting over will not delete it, so check the link before copying again.</span></p>
      <div className="result-again result-again-partial">
        <span className="result-again-icon" aria-hidden="true"><FiRefreshCw /></span>
        <div className="result-again-copy">
          <strong>Want to copy a different playlist?</strong>
          <span>Start a fresh transfer, or open the partial link above before trying again.</span>
        </div>
        <button type="button" className="btn btn-again" onClick={onReset}>
          Transfer another playlist <FiArrowRight aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function progressMessage(elapsed) {
  if (elapsed < 6) return 'Creating the private playlist and adding the first items.';
  if (elapsed < 18) return 'Copying items in their original order. Large playlists can take a little while.';
  if (elapsed < 40) return 'Spotify is still saving items. Keep this tab open while the copy finishes.';
  return 'Spotify is taking longer than usual. Keep this tab open — the copy is still running.';
}

function TransferPanel({ selected, destinationName }) {
  const panelRef = useRef(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    panelRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    const focusTimer = setTimeout(() => panelRef.current?.focus({ preventScroll: true }), reduced ? 0 : 350);
    return () => clearTimeout(focusTimer);
  }, []);

  const elapsedLabel = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;

  return (
    <div className="result-panel result-progress" ref={panelRef} tabIndex={-1} role="status" aria-live="polite">
      <div className="result-hero">
        <span className="result-icon result-spinner"><FiRefreshCw aria-hidden="true" /></span>
        <div>
          <span className="eyebrow">TRANSFER IN PROGRESS</span>
          <h3>Copying “{selected?.name}”</h3>
          <p>Keep this tab open while Spotify saves and verifies the playlist.</p>
        </div>
      </div>
      <div className="progress-track" aria-hidden="true"><span /></div>
      <p className="progress-status"><span className="progress-dot" aria-hidden="true" />{progressMessage(elapsed)}</p>
      <ol className="transfer-stages">
        <li className="done"><span><FiCheck aria-hidden="true" /></span> Connected to Spotify</li>
        <li className="current"><span><FiRefreshCw aria-hidden="true" /></span> Creating playlist and copying items</li>
        <li><span>3</span> Verifying the saved order</li>
      </ol>
      <div className="progress-meta">
        <div><span>TO</span><strong className="truncate" title={destinationName}>{destinationName}</strong></div>
        <div><span>ITEMS</span><strong>{selected?.count == null ? 'Checking' : selected.count}</strong></div>
        <div><span>ELAPSED</span><strong aria-hidden="true">{elapsedLabel}</strong></div>
      </div>
      <p className="result-note"><FiShield aria-hidden="true" /><span>Your source playlist is never modified.</span></p>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState({ configured: false, source: null, destination: null });
  const [sessionLoading, setSessionLoading] = useState(true);
  const [playlistQuery, setPlaylistQuery] = useState('');
  const [playlists, setPlaylists] = useState([]);
  const [nextOffset, setNextOffset] = useState(null);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(() => readSessionItem('playlist-port.selected'));
  const [newName, setNewName] = useState(() => readSessionItem('playlist-port.name'));
  const [urlLoading, setUrlLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [useSecondAccount, setUseSecondAccount] = useState(() => readSessionItem('playlist-port.second') === 'true');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [justConnected, setJustConnected] = useState('');
  const [partial, setPartial] = useState(null);
  const [result, setResult] = useState(null);
  const [transferring, setTransferring] = useState(false);
  const [copyState, setCopyState] = useState('idle');
  const [focusError, setFocusError] = useState(false);
  const [summaryInView, setSummaryInView] = useState(false);
  const [workspaceInView, setWorkspaceInView] = useState(false);
  const workspaceRef = useRef(null);
  const summaryPanelRef = useRef(null);
  const errorRef = useRef(null);
  const transferLock = useRef(false);
  const copyTimer = useRef(null);

  const selected = selectedId === 'liked-songs'
    ? { id: 'liked-songs', name: 'Liked Songs', count: null, owner: session.source?.name || 'You', canCopy: true, isOwner: true, url: 'https://open.spotify.com/collection/tracks' }
    : playlists.find((playlist) => playlist.id === selectedId);
  const selectedIsEmpty = selected?.count === 0;
  const sameDestination = Boolean(useSecondAccount && session.source && session.destination && session.source.id === session.destination.id);
  const destinationName = useSecondAccount
    ? (session.destination?.name || 'Second account')
    : (session.source?.name || 'This account');
  const mineCount = playlists.filter((playlist) => playlist.isOwner).length;
  const followedCount = playlists.filter((playlist) => !playlist.isOwner).length;
  const filteredByTab = playlists.filter((playlist) => {
    if (activeTab === 'mine') return playlist.isOwner;
    if (activeTab === 'followed') return !playlist.isOwner;
    return true;
  });
  const shownPlaylists = filteredByTab.filter((playlist) =>
    playlist.name.toLowerCase().includes(playlistQuery.toLowerCase())
  );
  const isPastedSpotifyUrl = /(?:playlist\/|playlist:)[A-Za-z0-9_-]{1,64}/.test(playlistQuery.trim());
  const likedVisible = activeTab !== 'followed' && (!playlistQuery || 'liked songs'.includes(playlistQuery.toLowerCase()));
  const currentStep = result || partial ? 4 : !session.source ? 1 : !selected ? 2 : 3;
  const nameMissing = Boolean(selected) && !newName.trim();
  const readyToCopy = session.configured && session.source && selected && !selectedIsEmpty && newName.trim() && !sameDestination && (!useSecondAccount || session.destination);
  const showQuickCopy = Boolean(selected && !result && !partial && !transferring && workspaceInView && !summaryInView);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('authError');
    const connected = params.get('connected');
    if (authError) setError(authError);
    if (connected) {
      setNotice(`${connected === 'source' ? 'Source' : 'Destination'} Spotify account connected.`);
      setJustConnected(connected);
    }
    if (authError || connected) {
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`);
    }
    api('/session')
      .then(setSession)
      .catch((err) => setError(err.message))
      .finally(() => setSessionLoading(false));
    if (authError || connected) {
      const timer = setTimeout(() => scrollToWorkspace(true), 280);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!justConnected) return undefined;
    const timer = setTimeout(() => setJustConnected(''), 5000);
    return () => clearTimeout(timer);
  }, [justConnected]);

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  useEffect(() => {
    if (!transferring) return undefined;
    const warnBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [transferring]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const workspace = workspaceRef.current;
    const summary = summaryPanelRef.current;
    if (!workspace) return undefined;
    const workspaceObserver = new IntersectionObserver(([entry]) => setWorkspaceInView(entry.isIntersecting), { threshold: 0 });
    workspaceObserver.observe(workspace);
    let summaryObserver = null;
    if (summary) {
      summaryObserver = new IntersectionObserver(([entry]) => setSummaryInView(entry.isIntersecting), { threshold: 0.2 });
      summaryObserver.observe(summary);
    }
    return () => {
      workspaceObserver.disconnect();
      summaryObserver?.disconnect();
    };
  }, [result, partial, transferring, session.source?.id]);

  useEffect(() => {
    if (!focusError || !errorRef.current) return;
    const reduced = prefersReducedMotion();
    errorRef.current.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    errorRef.current.focus({ preventScroll: true });
    setFocusError(false);
  }, [focusError]);

  useEffect(() => {
    if (!session.source) {
      setPlaylists([]);
      setNextOffset(null);
      return;
    }
    loadPlaylists(0, true);
  }, [session.source?.id]);

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function scrollToWorkspace(focus = false) {
    workspaceRef.current?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'start'
    });
    if (focus) {
      setTimeout(() => workspaceRef.current?.focus({ preventScroll: true }), 320);
    }
  }

  function reviewCopy() {
    const reduced = prefersReducedMotion();
    summaryPanelRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    setTimeout(() => document.getElementById('new-name')?.focus({ preventScroll: true }), reduced ? 0 : 360);
  }

  function changePlaylist() {
    const reduced = prefersReducedMotion();
    document.getElementById('step-playlist-title')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    setTimeout(() => document.getElementById('playlist-search')?.focus({ preventScroll: true }), reduced ? 0 : 360);
  }

  function startFlow() {
    if (!sessionLoading && session.configured && !session.source) {
      connect('source');
      return;
    }
    scrollToWorkspace(true);
  }

  async function loadPlaylists(offset, replace = false) {
    setPlaylistsLoading(true);
    try {
      const data = await api(`/playlists?offset=${offset}`);
      setPlaylists((current) => replace ? data.items : [...current, ...data.items]);
      setNextOffset(data.nextOffset);
    } catch (err) {
      setError(err.message);
    } finally {
      setPlaylistsLoading(false);
    }
  }

  function refreshPlaylists() {
    setSelectedId('');
    removeSessionItem('playlist-port.selected');
    setResult(null);
    setPartial(null);
    loadPlaylists(0, true);
  }

  function connect(slot) {
    window.location.assign(`/api/auth/start/${slot}`);
  }

  async function disconnect(slot) {
    setError('');
    try {
      await api(`/auth/disconnect/${slot}`, { method: 'POST' });
      setSession((current) => ({ ...current, [slot]: null }));
      if (slot === 'source') {
        setSelectedId('');
        removeSessionItem('playlist-port.selected');
        setResult(null);
        setPartial(null);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  function choosePlaylist(playlist) {
    setSelectedId(playlist.id);
    writeSessionItem('playlist-port.selected', playlist.id);
    const name = `${playlist.name} (copy)`;
    setNewName(name.slice(0, 100));
    writeSessionItem('playlist-port.name', name.slice(0, 100));
    setError('');
    setPartial(null);
    setResult(null);
    setCopyState('idle');
  }

  function selectLikedSongs() {
    setSelectedId('liked-songs');
    writeSessionItem('playlist-port.selected', 'liked-songs');
    setNewName('Liked Songs');
    writeSessionItem('playlist-port.name', 'Liked Songs');
    setError('');
    setPartial(null);
    setResult(null);
    setCopyState('idle');
  }

  async function loadPastedPlaylist(event) {
    event?.preventDefault();
    const trimmed = playlistQuery.trim();
    if (!trimmed) return;
    const match = trimmed.match(/(?:playlist\/|playlist:)([A-Za-z0-9_-]{1,64})/);
    if (!match) {
      if (/(open\.spotify\.com|spotify:)/i.test(trimmed)) {
        setError('That link does not look like a Spotify playlist. Try a link such as https://open.spotify.com/playlist/…');
      }
      return;
    }
    setUrlLoading(true);
    setError('');
    try {
      const data = await api(`/playlist/${match[1]}`);
      setPlaylists((current) => {
        if (current.some((playlist) => playlist.id === data.id)) return current;
        return [data, ...current];
      });
      choosePlaylist(data);
      setPlaylistQuery('');
    } catch (err) {
      setError(err.message || 'Could not load that playlist.');
    } finally {
      setUrlLoading(false);
    }
  }

  function chooseDestination(second) {
    setUseSecondAccount(second);
    writeSessionItem('playlist-port.second', String(second));
  }

  function announceCopy(state) {
    setCopyState(state);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopyState('idle'), 2600);
  }

  async function copyLink(url) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      announceCopy('copied');
    } catch {
      try {
        const area = document.createElement('textarea');
        area.value = url;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
        announceCopy('copied');
      } catch {
        announceCopy('failed');
      }
    }
  }

  function resetTransfer() {
    setResult(null);
    setPartial(null);
    setError('');
    setCopyState('idle');
    setSelectedId('');
    setNewName('');
    removeSessionItem('playlist-port.selected');
    scrollToWorkspace(true);
  }

  async function startTransfer(event) {
    event.preventDefault();
    if (transferLock.current || !readyToCopy) return;
    transferLock.current = true;
    setTransferring(true);
    setError('');
    setFocusError(false);
    setPartial(null);
    setResult(null);
    try {
      const completed = await api('/transfer', {
        method: 'POST',
        body: JSON.stringify({ playlistId: selected.id, name: newName.trim(), useSecondAccount })
      });
      setResult(completed);
    } catch (err) {
      setError(err.message);
      setPartial(err.partial || null);
      setFocusError(!err.partial);
    } finally {
      transferLock.current = false;
      setTransferring(false);
    }
  }

  const heroPrimary = sessionLoading
    ? 'Loading Spotify…'
    : !session.configured
      ? 'View setup status'
      : !session.source
        ? 'Connect Spotify'
        : 'Open your workspace';

  return (
    <div className="page-shell">
      <a className="skip-link" href="#workspace">Skip to the transfer workspace</a>

      <header className="site-header">
        <div className="header-inner content-width">
          <a className="brand" href="#top">
            <span className="brand-mark"><FiLink2 aria-hidden="true" /></span>
            <span>playlist<span className="brand-light">port</span></span>
          </a>
          <nav className="header-nav" aria-label="Main navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#faq">FAQ</a>
            <button type="button" className="btn btn-primary btn-sm header-cta" onClick={startFlow} disabled={sessionLoading}>
              {session.source ? 'Open workspace' : 'Connect Spotify'}
            </button>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="hero content-width" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="kicker"><span className="kicker-dot" aria-hidden="true" /> Spotify → Spotify</span>
            <h1 id="hero-title">Move your playlists <span>without losing the order.</span></h1>
            <p className="hero-sub">Copy a Spotify playlist into the same account or another one in a few clicks. Songs, episodes, and their order come with it — your original stays untouched.</p>
            <div className="hero-actions">
              <button type="button" className="btn btn-primary btn-lg" onClick={startFlow} disabled={sessionLoading}>
                {heroPrimary} <FiArrowRight aria-hidden="true" />
              </button>
              <a className="btn btn-secondary btn-lg" href="#how-it-works">See how it works</a>
            </div>
            {!session.source && session.configured && (
              <p className="hero-permission"><FiLock aria-hidden="true" /> Spotify will ask you to read playlists and create a private copy. No playback control.</p>
            )}
            <ul className="trust-list">
              <li><FiCheck aria-hidden="true" /> Free &amp; Premium accounts</li>
              <li><FiCheck aria-hidden="true" /> Originals never change</li>
              <li><FiCheck aria-hidden="true" /> Private copy by default</li>
            </ul>
          </div>

          <div className="hero-visual">
            <div className="preview-card preview-live">
              <div className="preview-head">
                <span className="preview-title"><span className="status-dot" aria-hidden="true" /> {session.source ? 'Workspace ready' : 'Start a transfer'}</span>
                <span className="preview-lock"><FiLock aria-hidden="true" /> Private</span>
              </div>
              <div className="preview-route">
                <div className="preview-account">
                  <span className="preview-avatar"><SiSpotify aria-hidden="true" /></span>
                  <span>
                    <small>FROM</small>
                    <strong>{session.source?.name || 'Spotify account'}</strong>
                    <em>{session.source ? 'Connected' : 'Not connected'}</em>
                  </span>
                </div>
                <span className="preview-arrow" aria-hidden="true"><FiArrowRight /></span>
                <div className="preview-account">
                  <span className="preview-avatar preview-avatar-alt"><SiSpotify aria-hidden="true" /></span>
                  <span>
                    <small>TO</small>
                    <strong className="truncate">{useSecondAccount ? (session.destination?.name || 'Second account') : 'New private playlist'}</strong>
                    <em>{useSecondAccount ? (session.destination ? 'Connected' : 'Not connected') : 'Same Spotify account'}</em>
                  </span>
                </div>
              </div>
              <div className="preview-selected">
                <span className="preview-selected-icon" aria-hidden="true"><FiMusic /></span>
                <span className="preview-selected-copy">
                  <small>PLAYLIST</small>
                  <strong className="truncate">{selected?.name || 'Choose a playlist in the workspace'}</strong>
                </span>
                <span className="preview-count">{selected ? (selected.count != null ? `${selected.count} ${selected.count === 1 ? 'item' : 'items'}` : 'Selected') : 'Not chosen'}</span>
              </div>
              <div className="preview-list" aria-hidden="true">
                {[0, 1, 2].map((item) => (
                  <div className="preview-item" key={item}>
                    <span className={`preview-art art-${item}`} />
                    <span className="preview-lines"><i /><i /></span>
                    <FiCheck />
                  </div>
                ))}
              </div>
              <div className="preview-footer">
                <span><FiCheckCircle aria-hidden="true" /> Order preserved</span>
                <span><FiShield aria-hidden="true" /> Verified copy</span>
              </div>
              <button type="button" className="btn btn-primary btn-block preview-cta" onClick={startFlow} disabled={sessionLoading}>
                {heroPrimary} <FiArrowRight aria-hidden="true" />
              </button>
              <p className="preview-note"><FiShield aria-hidden="true" /> Official Spotify API · encrypted sessions · no database</p>
            </div>
            <div className="preview-badge"><FiCheckCircle aria-hidden="true" /> Ready to port</div>
          </div>
        </section>

        <section className="proof-strip" aria-label="Playlist Port at a glance">
          <div className="proof-inner content-width">
            <div><strong>Order</strong><span>Every copied item keeps its place</span></div>
            <div><strong>Private</strong><span>Copies start hidden from your profile</span></div>
            <div><strong>0</strong><span>Playlists stored on our servers</span></div>
            <div><strong>Free</strong><span>For Free &amp; Premium Spotify accounts</span></div>
          </div>
        </section>

        <section className="workspace-section content-width" id="workspace" ref={workspaceRef} tabIndex={-1} aria-labelledby="workspace-title">
          <div className="section-heading workspace-heading">
            <div>
              <span className="kicker">TRANSFER WORKSPACE</span>
              <h2 id="workspace-title">Copy a Spotify playlist</h2>
              <p>Connect your account, choose a playlist, and send a copy wherever you want it.</p>
            </div>
            <span className="spotify-chip"><SiSpotify aria-hidden="true" /> Spotify · Free &amp; Premium</span>
          </div>

          <div className="app-shell">
            <div className="app-topbar">
              <Stepper currentStep={currentStep} />
              <span className={`connection-pill ${session.source ? 'is-online' : ''}`}>
                <span className="status-dot" aria-hidden="true" />
                {sessionLoading ? 'Checking connection' : session.source ? 'Source connected' : 'Not connected'}
              </span>
            </div>

            {notice && (
              <div className="inline-alert inline-alert-success" role="status">
                <FiCheckCircle aria-hidden="true" />
                <span>{notice}</span>
                <button type="button" onClick={() => setNotice('')} aria-label="Dismiss notice"><FiX aria-hidden="true" /></button>
              </div>
            )}

            {error && !partial && (
              <div className="inline-alert inline-alert-error" role="alert" ref={errorRef} tabIndex={-1}>
                <FiAlertTriangle aria-hidden="true" />
                <span>{error}</span>
                <button type="button" onClick={() => setError('')} aria-label="Dismiss error"><FiX aria-hidden="true" /></button>
              </div>
            )}

            {!sessionLoading && !session.configured && (
              <div className="inline-note inline-note-warning">
                <FiInfo aria-hidden="true" />
                <p><strong>Spotify sign-in is not configured.</strong> The site owner needs to add Spotify credentials before transfers can run.</p>
              </div>
            )}

            {result ? (
              <ResultPanel
                result={result}
                destinationName={destinationName}
                onReset={resetTransfer}
                copyState={copyState}
                onCopy={copyLink}
              />
            ) : partial ? (
              <PartialPanel
                partial={partial}
                error={error}
                onReset={resetTransfer}
                copyState={copyState}
                onCopy={copyLink}
              />
            ) : transferring ? (
              <TransferPanel selected={selected} destinationName={destinationName} />
            ) : (
              <div className="workflow-grid" aria-busy={playlistsLoading || urlLoading}>
                <div className="workflow-main">
                  <section className="panel" aria-labelledby="step-connect-title">
                    <StepHeading
                      number="01"
                      title="Connect your account"
                      description="Approve read access and permission to create a private copy. Free and Premium accounts both work."
                      id="step-connect-title"
                    />
                    <Account
                      label="SOURCE ACCOUNT"
                      account={session.source}
                      onConnect={() => connect('source')}
                      onDisconnect={() => disconnect('source')}
                      disabled={sessionLoading || !session.configured || transferring}
                      justConnected={justConnected === 'source'}
                    />
                    <details className="access-details">
                      <summary>What access does Playlist Port need? <FiChevronDown aria-hidden="true" /></summary>
                      <p>Read access to your playlists and Liked Songs, plus permission to create a new private playlist. Tokens stay in encrypted, HttpOnly cookies and expire after 24 hours.</p>
                    </details>

                    <div className="panel-rule" />

                    <StepHeading
                      number="02"
                      title="Choose a playlist"
                      description="Pick a playlist you own or follow, your Liked Songs, or paste a public Spotify link."
                      id="step-playlist-title"
                    />

                    {session.source ? (
                      <div className="playlist-panel">
                        <span className="sr-only" aria-live="polite">
                          {selected ? `Selected ${selected.name}. Review the copy settings below.` : ''}
                        </span>
                        <div className="playlist-toolbar">
                          <div className="filter-tabs" role="group" aria-label="Filter playlists">
                            {filters.map((filter) => (
                              <button
                                key={filter.id}
                                type="button"
                                className={activeTab === filter.id ? 'active' : ''}
                                aria-pressed={activeTab === filter.id}
                                onClick={() => setActiveTab(filter.id)}
                              >
                                {filter.label}
                                <span>{filter.id === 'all' ? playlists.length : filter.id === 'mine' ? mineCount : followedCount}</span>
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            className="icon-button"
                            onClick={refreshPlaylists}
                            disabled={playlistsLoading}
                            title="Refresh playlists"
                            aria-label="Refresh playlists"
                          >
                            <FiRefreshCw className={playlistsLoading ? 'spin' : ''} aria-hidden="true" />
                          </button>
                        </div>

                        <form className="playlist-search" onSubmit={loadPastedPlaylist} role="search">
                          <FiSearch aria-hidden="true" />
                          <label className="sr-only" htmlFor="playlist-search">Search playlists or paste a Spotify link</label>
                          <input
                            id="playlist-search"
                            type="search"
                            value={playlistQuery}
                            onChange={(event) => setPlaylistQuery(event.target.value)}
                            placeholder="Search playlists or paste a Spotify link…"
                            autoComplete="off"
                          />
                          {isPastedSpotifyUrl ? (
                            <button type="submit" className="btn btn-primary btn-xs" disabled={urlLoading} aria-label="Load playlist from link">
                              {urlLoading ? <span className="button-spinner" aria-hidden="true" /> : <><FiLink2 aria-hidden="true" /> Load</>}
                            </button>
                          ) : playlistQuery ? (
                            <button type="button" className="icon-button" onClick={() => setPlaylistQuery('')} aria-label="Clear search">
                              <FiX aria-hidden="true" />
                            </button>
                          ) : null}
                        </form>

                        <div className="playlist-list">
                          {likedVisible && (
                            <button
                              type="button"
                              className={`playlist-row liked-row ${selectedId === 'liked-songs' ? 'selected' : ''}`}
                              onClick={selectLikedSongs}
                              aria-pressed={selectedId === 'liked-songs'}
                            >
                              <span className="playlist-art liked-art" aria-hidden="true">♥</span>
                              <span className="playlist-info">
                                <span className="playlist-title-line"><strong>Liked Songs</strong><span className="tag tag-liked">Collection</span></span>
                                <span>Saved tracks from your Spotify library</span>
                              </span>
                              <span className="playlist-check" aria-hidden="true">{selectedId === 'liked-songs' ? <FiCheck /> : <FiArrowRight />}</span>
                            </button>
                          )}

                          {playlistsLoading && playlists.length === 0 ? (
                            <div className="skeleton-list" aria-label="Loading playlists" role="status">
                              {[0, 1, 2, 3].map((item) => (
                                <div className="skeleton-row" key={item}>
                                  <span className="skeleton-art" />
                                  <span className="skeleton-lines"><i /><i /></span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            shownPlaylists.map((playlist) => (
                              <button
                                key={playlist.id}
                                type="button"
                                className={`playlist-row ${selectedId === playlist.id ? 'selected' : ''}`}
                                onClick={() => choosePlaylist(playlist)}
                                aria-pressed={selectedId === playlist.id}
                                title={playlist.name}
                              >
                                <PlaylistArt playlist={playlist} />
                                <span className="playlist-info">
                                  <span className="playlist-title-line">
                                    <strong>{playlist.name}</strong>
                                    <span className={`tag ${playlist.isOwner ? 'tag-mine' : 'tag-followed'}`}>{playlist.isOwner ? 'You' : 'Followed'}</span>
                                  </span>
                                  <span>
                                    {playlist.count == null ? 'Item count checked at transfer' : `${playlist.count} ${playlist.count === 1 ? 'item' : 'items'}`} · by {playlist.owner}
                                  </span>
                                </span>
                                <span className="playlist-check" aria-hidden="true">{selectedId === playlist.id ? <FiCheck /> : <FiArrowRight />}</span>
                              </button>
                            ))
                          )}

                          {!playlistsLoading && shownPlaylists.length === 0 && !likedVisible && (
                            <p className="list-empty">{playlistQuery ? 'No playlists match your search.' : 'No playlists in this category yet.'}</p>
                          )}
                        </div>

                        {nextOffset !== null && (
                          <button type="button" className="load-more" disabled={playlistsLoading} onClick={() => loadPlaylists(nextOffset)}>
                            {playlistsLoading ? <><span className="button-spinner" aria-hidden="true" /> Loading…</> : <>Load more playlists <FiChevronDown aria-hidden="true" /></>}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="empty-panel">
                        <span className="empty-icon"><FiMusic aria-hidden="true" /></span>
                        <p>Connect Spotify to browse your playlists or paste a public link.</p>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => connect('source')}
                          disabled={sessionLoading || !session.configured}
                        >
                          Connect Spotify
                        </button>
                      </div>
                    )}
                  </section>
                </div>

                <aside className="workflow-side" aria-label="Destination and copy summary">
                  <section className="panel destination-panel" aria-labelledby="step-destination-title">
                    <StepHeading
                      number="03"
                      title="Choose a destination"
                      description="Create the copy here or connect a second Spotify account."
                      id="step-destination-title"
                    />
                    <div className="segmented" role="radiogroup" aria-label="Destination account">
                      <label className={`segment ${!useSecondAccount ? 'active' : ''}`}>
                        <input type="radio" name="destination" checked={!useSecondAccount} onChange={() => chooseDestination(false)} disabled={transferring} />
                        <span className="segment-icon" aria-hidden="true"><FiUser /></span>
                        <span className="segment-copy"><strong>Same Spotify account</strong><small>Create a new playlist here</small></span>
                        <span className="radio-ui" aria-hidden="true" />
                      </label>
                      <label className={`segment ${useSecondAccount ? 'active' : ''}`}>
                        <input type="radio" name="destination" checked={useSecondAccount} onChange={() => chooseDestination(true)} disabled={transferring} />
                        <span className="segment-icon" aria-hidden="true"><FiUsers /></span>
                        <span className="segment-copy"><strong>Another Spotify account</strong><small>Connect the receiving account</small></span>
                        <span className="radio-ui" aria-hidden="true" />
                      </label>
                    </div>

                    {useSecondAccount && (
                      <div className="destination-account">
                        <Account
                          label="DESTINATION ACCOUNT"
                          account={session.destination}
                          onConnect={() => connect('destination')}
                          onDisconnect={() => disconnect('destination')}
                          disabled={sessionLoading || !session.configured || transferring}
                          connectLabel="Connect destination"
                          justConnected={justConnected === 'destination'}
                        />
                        {sameDestination && (
                          <p className="inline-warning" role="alert"><FiAlertTriangle aria-hidden="true" /> This is the same account as your source. Connect a different account or choose “Same Spotify account”.</p>
                        )}
                      </div>
                    )}

                    <p className="panel-note"><FiLock aria-hidden="true" /> New copies are hidden from your public profile by default.</p>
                  </section>

                  <form className="panel summary-panel" ref={summaryPanelRef} aria-labelledby="step-copy-title" onSubmit={startTransfer}>
                    <div className="summary-head">
                      <StepHeading
                        number="04"
                        title="Review &amp; copy"
                        description="Name the new playlist and start the transfer."
                        id="step-copy-title"
                      />
                    </div>

                    {selected ? (
                      <>
                        <div className="selected-card">
                          <PlaylistArt playlist={selected} className="selected-art" />
                          <div className="selected-info">
                            <div className="selected-label-row">
                              <span className="selected-label">SELECTED PLAYLIST</span>
                              <button type="button" className="selected-change" onClick={changePlaylist}>Change</button>
                            </div>
                            <strong className="truncate" title={selected.name}>{selected.name}</strong>
                            <span>{selected.count == null ? 'Items verified at transfer' : `${selected.count} ${selected.count === 1 ? 'item' : 'items'}`} · by {selected.owner}</span>
                          </div>
                          <a className="icon-button" href={selected.url} target="_blank" rel="noreferrer" aria-label={`View ${selected.name} in Spotify`}>
                            <FiExternalLink aria-hidden="true" />
                          </a>
                        </div>

                        <div className="route-box">
                          <div className="route-node"><span>FROM</span><strong className="truncate" title={session.source?.name}>{session.source?.name || 'Source account'}</strong></div>
                          <span className="route-arrow" aria-hidden="true"><FiArrowRight /></span>
                          <div className="route-node"><span>TO</span><strong className="truncate" title={destinationName}>{destinationName}{!useSecondAccount ? ' · New playlist' : ''}</strong></div>
                        </div>

                        <label className="name-label" htmlFor="new-name">New playlist name</label>
                        <div className="name-field">
                          <input
                            id="new-name"
                            className="name-input"
                            maxLength={100}
                            required
                            value={newName}
                            aria-invalid={nameMissing || undefined}
                            aria-describedby={nameMissing ? 'new-name-error' : undefined}
                            onChange={(event) => { setNewName(event.target.value); writeSessionItem('playlist-port.name', event.target.value); }}
                            placeholder="Name your new playlist"
                          />
                          {newName.length > 80 && <span className="name-count">{newName.length}/100</span>}
                        </div>
                        {nameMissing && (
                          <p className="name-hint" id="new-name-error"><FiAlertTriangle aria-hidden="true" /> Enter a name to continue.</p>
                        )}
                      </>
                    ) : (
                      <div className="summary-empty">
                        <span className="empty-icon"><FiCheckCircle aria-hidden="true" /></span>
                        <p>Choose a playlist and your copy summary will appear here.</p>
                      </div>
                    )}

                    {!session.source ? (
                      <button type="button" className="btn btn-primary btn-block" onClick={() => connect('source')} disabled={sessionLoading || !session.configured}>
                        Connect Spotify <FiArrowRight aria-hidden="true" />
                      </button>
                    ) : !selected ? (
                      <button type="button" className="btn btn-primary btn-block" disabled>Choose a playlist</button>
                    ) : useSecondAccount && !session.destination ? (
                      <button type="button" className="btn btn-primary btn-block" onClick={() => connect('destination')} disabled={!session.configured}>
                        Connect destination account <FiArrowRight aria-hidden="true" />
                      </button>
                    ) : sameDestination ? (
                      <button type="button" className="btn btn-primary btn-block" disabled>Connect a different account</button>
                    ) : (
                      <button type="submit" className="btn btn-primary btn-block" disabled={!readyToCopy}>
                        {selectedIsEmpty ? 'Playlist is empty' : nameMissing ? 'Enter a playlist name' : <>Copy playlist <FiArrowRight aria-hidden="true" /></>}
                      </button>
                    )}
                    <p className="summary-footnote"><FiShield aria-hidden="true" /> Original untouched · Order verified · No audio copied</p>
                  </form>
                </aside>
              </div>
            )}

            {showQuickCopy && (
              <div className="quick-copy" role="region" aria-label="Selected playlist">
                <PlaylistArt playlist={selected} className="quick-copy-art" />
                <div className="quick-copy-info">
                  <span>{selected.count != null ? `${selected.count} ${selected.count === 1 ? 'item' : 'items'} selected` : 'Selected playlist'}</span>
                  <strong className="truncate" title={selected.name}>{selected.name}</strong>
                </div>
                <button type="button" className="btn btn-primary quick-copy-btn" onClick={reviewCopy}>
                  Review copy <FiArrowRight aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="services-section content-width" aria-labelledby="services-title">
          <div className="section-heading section-heading-centered">
            <span className="kicker">WORKS WITH</span>
            <h2 id="services-title">Spotify today. More services next.</h2>
            <p>Playlist Port is built specifically for Spotify. Apple Music, YouTube Music, YouTube, Deezer, and TIDAL are on the roadmap.</p>
          </div>
          <ul className="service-grid">
            {services.map(({ name, Icon, ready }) => (
              <li key={name} className={`service-tile ${ready ? 'is-ready' : ''}`}>
                {ready && <span className="service-flag"><FiCheck aria-hidden="true" /> Live</span>}
                <span className="service-logo"><Icon aria-hidden="true" /></span>
                <strong>{name}</strong>
                <span className="service-status">{ready ? 'Available now' : 'Coming soon'}</span>
              </li>
            ))}
          </ul>
          <p className="services-note"><FiInfo aria-hidden="true" /> Transfers currently run between Spotify accounts only. New services will appear here when they ship.</p>
        </section>

        <section className="how-section content-width" id="how-it-works" aria-labelledby="how-title">
          <div className="section-heading section-heading-centered">
            <span className="kicker">HOW IT WORKS</span>
            <h2 id="how-title">Three steps. One clean copy.</h2>
            <p>No downloads, no rebuilding playlists by hand, and no changes to the original.</p>
          </div>
          <div className="how-grid">
            <article className="how-card">
              <div className="how-card-top"><span className="how-icon"><FiLink2 aria-hidden="true" /></span><span className="how-index">STEP 01</span></div>
              <h3>Connect Spotify</h3>
              <p>Approve playlist access so Playlist Port can read the source and create a private copy for the destination.</p>
            </article>
            <article className="how-card">
              <div className="how-card-top"><span className="how-icon"><FiMusic aria-hidden="true" /></span><span className="how-index">STEP 02</span></div>
              <h3>Pick a playlist</h3>
              <p>Choose something you own or follow, grab your Liked Songs, or paste a public Spotify playlist link.</p>
            </article>
            <article className="how-card">
              <div className="how-card-top"><span className="how-icon"><FiCopy aria-hidden="true" /></span><span className="how-index">STEP 03</span></div>
              <h3>Copy and go</h3>
              <p>Every available song and episode is copied in its original order, then verified before we show the link.</p>
            </article>
          </div>
          <p className="how-note"><FiInfo aria-hidden="true" /> Local files and unavailable items cannot be copied. They are counted as skipped and never break the rest of the transfer.</p>
          <div className="how-cta">
            <button type="button" className="btn btn-primary" onClick={startFlow} disabled={sessionLoading}>
              {session.source ? 'Open your workspace' : 'Start with Spotify'} <FiArrowRight aria-hidden="true" />
            </button>
          </div>
        </section>

        <section className="faq-section content-width" id="faq" aria-labelledby="faq-title">
          <div className="faq-intro">
            <span className="kicker">GOOD TO KNOW</span>
            <h2 id="faq-title">Questions, answered.</h2>
            <p>Everything you need to know before moving a playlist.</p>
          </div>
          <div className="faq-list">
            <details>
              <summary>Will my original playlist change?<span className="faq-icon" aria-hidden="true"><FiPlus /></span></summary>
              <p>No. Playlist Port only reads the source playlist. It creates a brand-new playlist in the destination account and never deletes or edits the original.</p>
            </details>
            <details>
              <summary>How long does a copy take?<span className="faq-icon" aria-hidden="true"><FiPlus /></span></summary>
              <p>Most playlists finish in seconds. Very large playlists can take a minute or two, and Spotify occasionally takes longer. Keep this tab open — the progress panel shows the current stage and elapsed time.</p>
            </details>
            <details>
              <summary>Can I copy a playlist I do not own?<span className="faq-icon" aria-hidden="true"><FiPlus /></span></summary>
              <p>Yes. Paste a public Spotify playlist link into the search box in the workspace. Private playlists from other accounts cannot be read through Spotify's API, so the owner would need to make the playlist public first.</p>
            </details>
            <details>
              <summary>What happens to local files and unavailable tracks?<span className="faq-icon" aria-hidden="true"><FiPlus /></span></summary>
              <p>Spotify does not allow those items to be copied through its API. They are counted as skipped, and every available song or episode around them is still copied in order.</p>
            </details>
            <details>
              <summary>Who can see the new playlist?<span className="faq-icon" aria-hidden="true"><FiPlus /></span></summary>
              <p>The copy is created private, so it does not appear on your public profile or in Spotify search. Anyone with the link can still open it, so share it only with people you trust.</p>
            </details>
            <details>
              <summary>Where is my Spotify data stored?<span className="faq-icon" aria-hidden="true"><FiPlus /></span></summary>
              <p>Playlist Port does not keep a database. Spotify tokens live in encrypted, HttpOnly cookies that expire after 24 hours. You can disconnect either account at any time from the workspace.</p>
            </details>
            <details>
              <summary>Why do both accounts need to be approved?<span className="faq-icon" aria-hidden="true"><FiPlus /></span></summary>
              <p>This app runs in Spotify's Development Mode, which limits access to an allowlist of accounts. Both the source and destination accounts must be approved in the Spotify Developer Dashboard before they can connect.</p>
            </details>
          </div>
        </section>

        <section className="final-cta content-width" aria-labelledby="cta-title">
          <div>
            <span className="kicker">READY WHEN YOU ARE</span>
            <h2 id="cta-title">Your next playlist is a copy away.</h2>
            <p className="final-cta-note"><FiLock aria-hidden="true" /> Private copy by default · Free &amp; Premium Spotify accounts · Originals never change</p>
          </div>
          <button type="button" className="btn btn-primary btn-lg" onClick={startFlow} disabled={sessionLoading}>
            {session.source ? 'Open your workspace' : 'Connect Spotify'} <FiArrowRight aria-hidden="true" />
          </button>
        </section>
      </main>

      <footer className="site-footer content-width">
        <div className="footer-brand">
          <a className="brand" href="#top">
            <span className="brand-mark"><FiLink2 aria-hidden="true" /></span>
            <span>playlist<span className="brand-light">port</span></span>
          </a>
          <p>Copy playlists. Keep the music.</p>
        </div>
        <nav className="footer-nav" aria-label="Footer navigation">
          <a href="#workspace">Workspace</a>
          <a href="#how-it-works">How it works</a>
          <a href="#faq">FAQ</a>
          <a href="https://github.com/TeddyQyuon/playlist-port" target="_blank" rel="noreferrer">GitHub <FiExternalLink aria-hidden="true" /></a>
        </nav>
        <p className="footer-legal">© 2026 Playlist Port · Not affiliated with Spotify</p>
      </footer>
    </div>
  );
}
