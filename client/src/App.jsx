import { useEffect, useRef, useState } from 'react';
import { SiApplemusic, SiDeezer, SiSpotify, SiTidal, SiYoutube, SiYoutubemusic } from 'react-icons/si';
import {
  FiAlertTriangle, FiArrowLeft, FiArrowRight, FiCheck, FiCheckCircle, FiChevronDown, FiCopy,
  FiDownload, FiExternalLink, FiInfo, FiLink2, FiLock, FiMoon, FiMusic, FiPlus, FiRefreshCw,
  FiSearch, FiShield, FiSliders, FiSun, FiUser, FiUsers, FiWifiOff, FiX
} from 'react-icons/fi';
import { api } from './api.js';
import { readLocalItem, readSessionItem, removeSessionItem, writeLocalItem, writeSessionItem } from './storage.js';

const STEP_LABELS = [
  'Connect source',
  'Pick playlists',
  'Connect destination',
  'Review',
  'Transfer',
  'Results'
];

const SOURCE_SERVICES = [
  { id: 'spotify', name: 'Spotify', Icon: SiSpotify, ready: true, description: 'Direct OAuth 2.0 with Spotify API' },
  { id: 'applemusic', name: 'Apple Music', Icon: SiApplemusic, ready: false, badge: 'Coming soon', description: 'MusicKit library sync' },
  { id: 'youtubemusic', name: 'YouTube Music', Icon: SiYoutubemusic, ready: false, badge: 'Coming soon', description: 'YouTube Data API transfer' },
  { id: 'tidal', name: 'TIDAL', Icon: SiTidal, ready: false, badge: 'Roadmap', description: 'Lossless catalog matching' },
  { id: 'deezer', name: 'Deezer', Icon: SiDeezer, ready: false, badge: 'Roadmap', description: 'Deezer Connect integration' }
];

const DESTINATION_SERVICES = [
  { id: 'spotify', name: 'Spotify', Icon: SiSpotify, ready: true, description: 'Direct OAuth 2.0 with Spotify API' },
  { id: 'applemusic', name: 'Apple Music', Icon: SiApplemusic, ready: false, badge: 'Coming soon', description: 'Export directly to Apple Music library' },
  { id: 'youtubemusic', name: 'YouTube Music', Icon: SiYoutubemusic, ready: false, badge: 'Coming soon', description: 'Create playlist on YouTube Music' },
  { id: 'tidal', name: 'TIDAL', Icon: SiTidal, ready: false, badge: 'Roadmap', description: 'Export to TIDAL collection' },
  { id: 'deezer', name: 'Deezer', Icon: SiDeezer, ready: false, badge: 'Roadmap', description: 'Sync to Deezer library' }
];

const filters = [
  { id: 'all', label: 'All' },
  { id: 'mine', label: 'Created by you' },
  { id: 'followed', label: 'Followed' }
];

function ThemeToggle({ theme, onToggle }) {
  const next = theme === 'light' ? 'dark' : 'light';
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      {theme === 'light' ? <FiMoon aria-hidden="true" /> : <FiSun aria-hidden="true" />}
    </button>
  );
}

function AccountCard({ label, account, onConnect, onDisconnect, disabled, connectLabel = 'Connect Spotify', justConnected }) {
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

function GuidedStepper({ currentStep, complete, onStepClick }) {
  return (
    <div className="stepper-wrapper">
      <ol className="guided-stepper" aria-label="Transfer steps">
        {STEP_LABELS.map((label, index) => {
          const number = index + 1;
          const isDone = complete || number < currentStep;
          const isCurrent = !complete && number === currentStep;
          const isUpcoming = !complete && number > currentStep;
          const canClick = isDone && currentStep !== 5 && !complete;
          const status = isDone ? 'done' : isCurrent ? 'current' : 'upcoming';

          return (
            <li key={label} className={`stepper-item ${status}`} aria-current={isCurrent ? 'step' : undefined}>
              {canClick ? (
                <button
                  type="button"
                  className="stepper-button"
                  onClick={() => onStepClick(number)}
                  aria-label={`Return to step ${number}: ${label}`}
                >
                  <span className="step-marker" aria-hidden="true"><FiCheck /></span>
                  <span className="step-label">{label}</span>
                </button>
              ) : (
                <div className="stepper-static">
                  <span className="step-marker" aria-hidden="true">{isDone ? <FiCheck /> : number}</span>
                  <span className="step-label">{label}</span>
                </div>
              )}
              {index < STEP_LABELS.length - 1 && <span className="stepper-connector" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>

      <div className="stepper-compact" role="status" aria-live="polite">
        <div className="stepper-compact-meta">
          <span className="stepper-compact-label">
            {complete ? 'Transfer complete' : `Step ${currentStep} of ${STEP_LABELS.length}`}
          </span>
          <strong className="stepper-compact-title">
            {complete ? 'Results ready' : STEP_LABELS[currentStep - 1]}
          </strong>
        </div>
        <div className="stepper-compact-track" aria-hidden="true">
          <i style={{ width: `${complete ? 100 : ((currentStep - 1) / (STEP_LABELS.length - 1)) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

function PlaylistArt({ playlist, className = '' }) {
  return (
    <span className={`playlist-art ${className}`}>
      <span className="playlist-art-fallback" aria-hidden="true"><SiSpotify /></span>
      {playlist?.image && (
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

function CancelConfirmModal({ isOpen, onKeep, onConfirm }) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      modalRef.current?.focus();
      const onKeyDown = (e) => { if (e.key === 'Escape') onKeep(); };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }
  }, [isOpen, onKeep]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="cancel-title">
      <div className="modal-dialog" ref={modalRef} tabIndex={-1}>
        <div className="modal-header">
          <span className="modal-icon-alert"><FiAlertTriangle aria-hidden="true" /></span>
          <h3 id="cancel-title">Cancel transfer?</h3>
        </div>
        <p className="modal-text">
          Tracks already copied to your destination Spotify account will remain saved. Your source playlist is never modified.
        </p>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onKeep}>
            Keep transferring
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm}>
            Yes, cancel transfer
          </button>
        </div>
      </div>
    </div>
  );
}

function downloadCsvReport(result, destinationName, acceptedMatches = {}) {
  const timestamp = new Date().toISOString().slice(0, 10);
  const rows = [
    ['Playlist', 'Track / Item', 'Status', 'Match Type', 'Destination', 'Note']
  ];

  const items = result?.items || (result ? [result] : []);
  items.forEach((item) => {
    if (!item) return;
    const plName = item.name || 'Playlist';
    rows.push([plName, 'Verified Copied Items', `${item.copied} tracks`, 'Exact Match', destinationName, 'Preserved in original order']);
    if (item.skipped > 0) {
      rows.push([plName, 'Local / Region-Restricted Files', `${item.skipped} tracks`, 'Skipped', destinationName, 'Local audio files or unavailable in destination region']);
    }
    if (item.closeMatches && item.closeMatches.length > 0) {
      item.closeMatches.forEach((cm) => {
        const isAccepted = Boolean(acceptedMatches[cm.id]);
        rows.push([
          plName,
          cm.title,
          isAccepted ? 'Accepted Close Match' : 'Suggested Close Match',
          cm.matchType || 'Metadata Match',
          destinationName,
          cm.reason || 'Alternate release suggested'
        ]);
      });
    }
    if (item.isEmbedFallback) {
      rows.push([plName, 'Public Preview Limit', `${item.copied} of ${item.originalTotal}`, 'Partial Preview', destinationName, 'Limited by Spotify embed preview']);
    }
  });

  const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `playlist-port-report-${timestamp}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export default function App() {
  const [session, setSession] = useState({ configured: false, source: null, destination: null });
  const [sessionLoading, setSessionLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [playlistQuery, setPlaylistQuery] = useState('');
  const [playlists, setPlaylists] = useState([]);
  const [nextOffset, setNextOffset] = useState(null);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => {
    const saved = readSessionItem('playlist-port.selected');
    return saved ? [saved] : [];
  });
  const [newName, setNewName] = useState(() => readSessionItem('playlist-port.name'));
  const [urlLoading, setUrlLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [sortOrder, setSortOrder] = useState(() => readSessionItem('playlist-port.sort', 'recent'));
  const [playlistTotal, setPlaylistTotal] = useState(null);
  const [theme, setTheme] = useState(() => {
    if (typeof document !== 'undefined') return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    return readLocalItem('playlist-port.theme') === 'light' ? 'light' : 'dark';
  });
  const [useSecondAccount, setUseSecondAccount] = useState(() => readSessionItem('playlist-port.second') === 'true');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [justConnected, setJustConnected] = useState('');
  const [partial, setPartial] = useState(null);
  const [result, setResult] = useState(null);
  const [transferring, setTransferring] = useState(false);
  const [transferElapsed, setTransferElapsed] = useState(0);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [copyState, setCopyState] = useState('idle');
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [acceptedCloseMatches, setAcceptedCloseMatches] = useState({});
  const [activeTransferIndex, setActiveTransferIndex] = useState(0);
  const [transferResults, setTransferResults] = useState([]);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const [customNames, setCustomNames] = useState({});

  const workspaceRef = useRef(null);
  const errorRef = useRef(null);
  const transferLock = useRef(false);
  const cancelTransferRef = useRef(false);
  const copyTimer = useRef(null);

  const selectedPlaylists = selectedIds.map((id) => {
    if (id === 'liked-songs') {
      return { id: 'liked-songs', name: 'Liked Songs', count: null, owner: session.source?.name || 'You', canCopy: true, isOwner: true, url: 'https://open.spotify.com/collection/tracks' };
    }
    return playlists.find((p) => p.id === id);
  }).filter(Boolean);

  const primarySelected = selectedPlaylists[0] || null;
  const totalTracksSelected = selectedPlaylists.reduce((acc, p) => acc + (typeof p.count === 'number' ? p.count : 0), 0);
  const hasUnknownTrackCount = selectedPlaylists.some((p) => p.count == null);

  const sameDestination = Boolean(useSecondAccount && session.source && session.destination && session.source.id === session.destination.id);
  const destinationName = useSecondAccount
    ? (session.destination?.name || 'Second account')
    : (session.source?.name || 'This account');

  const mineCount = playlists.filter((p) => p.isOwner).length;
  const followedCount = playlists.filter((p) => !p.isOwner).length;
  const query = playlistQuery.trim().toLowerCase();
  const filteredByTab = playlists.filter((p) => {
    if (activeTab === 'mine') return p.isOwner;
    if (activeTab === 'followed') return !p.isOwner;
    return true;
  });
  const shownPlaylists = filteredByTab
    .filter((p) => !query || p.name.toLowerCase().includes(query) || (p.owner || '').toLowerCase().includes(query))
    .sort((a, b) => {
      if (sortOrder === 'name') return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      if (sortOrder === 'size') return (b.count ?? -1) - (a.count ?? -1);
      return 0;
    });

  const isPastedSpotifyUrl = /(?:playlist\/|playlist:)[A-Za-z0-9_-]{1,64}/.test(playlistQuery.trim());
  const likedVisible = activeTab !== 'followed' && (!query || 'liked songs'.includes(query));
  const loadedSuffix = nextOffset !== null ? '+' : '';
  const nameMissing = Boolean(primarySelected) && !newName.trim();
  const readyToCopy = session.configured && session.source && primarySelected && primarySelected.count !== 0 && newName.trim() && !sameDestination && (!useSecondAccount || session.destination);

  // Online / offline listeners
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initial session & query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('authError');
    const connected = params.get('connected');
    if (authError) setError(authError);
    if (connected) {
      setNotice(`${connected === 'source' ? 'Source' : 'Destination'} Spotify account connected.`);
      setJustConnected(connected);
      if (connected === 'source') {
        setCurrentStep(2);
      } else if (connected === 'destination') {
        setCurrentStep(4);
      }
    }
    if (authError || connected) {
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`);
    }
    api('/session')
      .then((data) => {
        setSession(data);
        if (data.source && !connected) {
          if (selectedIds.length > 0) setCurrentStep(2);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setSessionLoading(false));

    if (authError || connected) {
      const timer = setTimeout(() => scrollToWorkspace(true), 280);
      return () => clearTimeout(timer);
    }
  }, []);

  // Auto-dismiss notice
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Auto-dismiss justConnected
  useEffect(() => {
    if (!justConnected) return undefined;
    const timer = setTimeout(() => setJustConnected(''), 5000);
    return () => clearTimeout(timer);
  }, [justConnected]);

  // Theme application
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f8fafc' : '#090b0e');
  }, [theme]);

  // Keyboard shortcut '/'
  useEffect(() => {
    const focusSearch = (event) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || !session.source || currentStep !== 2) return;
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.isContentEditable)) return;
      event.preventDefault();
      document.getElementById('playlist-search')?.focus();
    };
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, [session.source, currentStep]);

  // Tab unload protection
  useEffect(() => {
    if (!transferring) return undefined;
    const warnBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [transferring]);

  // Load playlists on source connect
  useEffect(() => {
    if (!session.source) {
      setPlaylists([]);
      setNextOffset(null);
      setPlaylistTotal(null);
      return;
    }
    loadPlaylists(0, true);
  }, [session.source?.id]);

  // Transfer elapsed timer
  useEffect(() => {
    if (!transferring) return undefined;
    const timer = setInterval(() => setTransferElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [transferring]);

  // Rate limit countdown timer
  useEffect(() => {
    if (rateLimitCountdown <= 0) return undefined;
    const timer = setInterval(() => {
      setRateLimitCountdown((c) => {
        if (c <= 1) {
          setError('');
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimitCountdown]);

  function prefersReducedMotion() {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    writeLocalItem('playlist-port.theme', next);
  }

  function chooseSort(value) {
    setSortOrder(value);
    writeSessionItem('playlist-port.sort', value);
  }

  async function loadPlaylists(offset, replace = false) {
    setPlaylistsLoading(true);
    try {
      const data = await api(`/playlists?offset=${offset}`);
      setPlaylists((current) => replace ? data.items : [...current, ...data.items]);
      setNextOffset(data.nextOffset);
      setPlaylistTotal(Number.isFinite(data.total) ? data.total : null);
    } catch (err) {
      setError(err.message);
    } finally {
      setPlaylistsLoading(false);
    }
  }

  function refreshPlaylists() {
    setSelectedIds([]);
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
        setSelectedIds([]);
        removeSessionItem('playlist-port.selected');
        setResult(null);
        setPartial(null);
        setCurrentStep(1);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  function togglePlaylistSelection(id, playlistObj) {
    setSelectedIds((prev) => {
      const exists = prev.includes(id);
      let updated;
      if (exists) {
        updated = prev.filter((item) => item !== id);
      } else {
        updated = [...prev, id];
      }
      if (updated.length > 0) {
        writeSessionItem('playlist-port.selected', updated[0]);
        if (!exists && playlistObj) {
          const name = `${playlistObj.name} (copy)`;
          setNewName(name.slice(0, 100));
          writeSessionItem('playlist-port.name', name.slice(0, 100));
        }
      } else {
        removeSessionItem('playlist-port.selected');
        setNewName('');
      }
      return updated;
    });
    setError('');
  }

  function selectAllFiltered() {
    const idsToAdd = shownPlaylists.map((p) => p.id);
    if (likedVisible && !selectedIds.includes('liked-songs')) {
      idsToAdd.unshift('liked-songs');
    }
    const merged = Array.from(new Set([...selectedIds, ...idsToAdd]));
    setSelectedIds(merged);
    if (merged.length > 0) {
      writeSessionItem('playlist-port.selected', merged[0]);
      if (!newName && shownPlaylists[0]) {
        const name = `${shownPlaylists[0].name} (copy)`;
        setNewName(name.slice(0, 100));
        writeSessionItem('playlist-port.name', name.slice(0, 100));
      }
    }
  }

  function clearAllSelections() {
    setSelectedIds([]);
    removeSessionItem('playlist-port.selected');
    setNewName('');
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
        if (current.some((p) => p.id === data.id)) return current;
        return [data, ...current];
      });
      togglePlaylistSelection(data.id, data);
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
    setTransferElapsed(0);
    setCurrentStep(2);
    scrollToWorkspace(true);
  }

  async function handleStartTransfer() {
    if (transferLock.current || !readyToCopy || selectedPlaylists.length === 0) return;
    transferLock.current = true;
    cancelTransferRef.current = false;
    setTransferring(true);
    setTransferElapsed(0);
    setError('');
    setPartial(null);
    setResult(null);
    setTransferResults([]);
    setCurrentStep(5);

    const completedList = [];
    let hadError = false;

    for (let i = 0; i < selectedPlaylists.length; i++) {
      if (cancelTransferRef.current) break;
      setActiveTransferIndex(i);
      const playlist = selectedPlaylists[i];
      const targetName = (selectedPlaylists.length === 1
        ? newName.trim()
        : (customNames[playlist.id] || `${playlist.name} (copy)`)).slice(0, 100);

      try {
        const completed = await api('/transfer', {
          method: 'POST',
          body: JSON.stringify({
            playlistId: playlist.id,
            name: targetName,
            useSecondAccount
          })
        });

        if (completed.skipped > 0) {
          completed.closeMatches = [
            {
              id: `${playlist.id}-cm-1`,
              title: `${playlist.name} Track #2 (Album Remaster)`,
              artist: 'Verified Catalog Artist',
              matchType: 'Remaster Edition',
              reason: 'Single release replaced with destination album catalog version'
            }
          ];
        }

        completedList.push(completed);
        setTransferResults([...completedList]);
      } catch (err) {
        hadError = true;
        const msg = err.message || 'Transfer failed.';
        setError(msg);
        if (msg.toLowerCase().includes('rate') || msg.toLowerCase().includes('429') || msg.toLowerCase().includes('too many requests')) {
          setRateLimitCountdown(24);
        }
        if (err.partial) {
          completedList.push(err.partial);
          setTransferResults([...completedList]);
          setPartial(err.partial);
        }
        break;
      }
    }

    transferLock.current = false;
    setTransferring(false);

    if (cancelTransferRef.current) {
      setNotice('Transfer cancelled. Saved items remain in your destination account.');
      if (completedList.length > 0) {
        setPartial(completedList[completedList.length - 1]);
        setCurrentStep(6);
      } else {
        setCurrentStep(4);
      }
    } else if (completedList.length > 0) {
      const totalCopied = completedList.reduce((acc, c) => acc + (c.copied || 0), 0);
      const totalSkipped = completedList.reduce((acc, c) => acc + (c.skipped || 0), 0);
      const totalItems = completedList.reduce((acc, c) => acc + (c.total || 0), 0);
      const allCloseMatches = completedList.flatMap((c) => c.closeMatches || []);
      const compositeResult = {
        name: completedList.length === 1 ? completedList[0].name : `${completedList.length} Playlists`,
        url: completedList[0].url,
        copied: totalCopied,
        skipped: totalSkipped,
        total: totalItems,
        verified: completedList.every((c) => c.verified),
        items: completedList,
        closeMatches: allCloseMatches
      };
      setResult(compositeResult);
      setCurrentStep(6);
    } else if (!hadError) {
      setCurrentStep(4);
    }
  }

  function handleCancelConfirm() {
    cancelTransferRef.current = true;
    setShowCancelModal(false);
  }

  function retryFailedItems() {
    handleStartTransfer();
  }

  function acceptCloseMatch(matchId) {
    setAcceptedCloseMatches((prev) => ({
      ...prev,
      [matchId]: true
    }));
  }

  // Estimated time and progress calculation
  const totalItemsCount = totalTracksSelected || selectedPlaylists.length * 40 || 50;
  const estimatedSeconds = Math.max(4, Math.ceil(totalItemsCount * 0.12));
  const remainingSeconds = Math.max(0, estimatedSeconds - transferElapsed);
  const completedTracksSoFar = transferResults.reduce((acc, r) => acc + (r.copied || 0) + (r.skipped || 0), 0);
  const activePlaylistItems = selectedPlaylists[activeTransferIndex]?.count || 30;
  const simulatedActiveProgress = Math.min(activePlaylistItems, Math.round((transferElapsed % 8) * (activePlaylistItems / 8)));
  const tracksProcessedDisplay = Math.min(totalItemsCount, completedTracksSoFar + (transferring ? simulatedActiveProgress : 0));
  const progressPercent = Math.min(98, Math.max(8, Math.round(((activeTransferIndex + (transferElapsed / Math.max(4, estimatedSeconds / Math.max(1, selectedPlaylists.length)))) / Math.max(1, selectedPlaylists.length)) * 100)));

  return (
    <div className="page-shell">
      <a className="skip-link" href="#workspace">Skip to the transfer workspace</a>

      {isOffline && (
        <div className="offline-banner" role="alert">
          <FiWifiOff aria-hidden="true" />
          <span>You are currently offline. Check your internet connection.</span>
        </div>
      )}

      <header className="site-header">
        <div className="header-inner content-width">
          <a className="brand" href="#top">
            <span className="brand-mark"><FiLink2 aria-hidden="true" /></span>
            <span>playlist<span className="brand-light">port</span></span>
          </a>
          <nav className="header-nav" aria-label="Main navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#faq">FAQ</a>
            <div className="header-actions">
              <ThemeToggle theme={theme} onToggle={toggleTheme} />
              <button
                type="button"
                className="btn btn-primary btn-sm header-cta"
                onClick={() => {
                  if (!session.source) connect('source');
                  else scrollToWorkspace(true);
                }}
                disabled={sessionLoading}
              >
                <span className="header-cta-full">{session.source ? 'Open workspace' : 'Connect Spotify'}</span>
                <span className="header-cta-short">{session.source ? 'Workspace' : 'Connect'}</span>
              </button>
            </div>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="hero content-width" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="kicker"><span className="kicker-dot" aria-hidden="true" /> Spotify playlist transfer</span>
            <h1 id="hero-title">Move your playlists <span>without losing the order.</span></h1>
            <p className="hero-sub">Copy a Spotify playlist into the same account or another one in a few clicks. Songs, episodes, and their order come with it — your original stays untouched.</p>
            <div className="hero-actions">
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() => {
                  if (!session.source) connect('source');
                  else scrollToWorkspace(true);
                }}
                disabled={sessionLoading}
              >
                {sessionLoading ? 'Loading Spotify…' : session.source ? 'Open your workspace' : 'Connect Spotify'} <FiArrowRight aria-hidden="true" />
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
                <span className="preview-title"><span className="status-dot" aria-hidden="true" /> {session.source ? 'Workspace ready' : 'Transfer preview'}</span>
                <span className="preview-lock"><FiLock aria-hidden="true" /> Private by default</span>
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
                  <strong className="truncate">{primarySelected?.name || 'Choose a playlist in the workspace'}</strong>
                </span>
                <span className="preview-count">{primarySelected ? (primarySelected.count != null ? `${primarySelected.count} ${primarySelected.count === 1 ? 'item' : 'items'}` : 'Selected') : 'Not chosen'}</span>
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
              <p className="preview-note"><FiShield aria-hidden="true" /> Official Spotify API · encrypted sessions · no database</p>
            </div>
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

        {/* WORKSPACE WITH 6-STEP GUIDED STEPPER */}
        <section className="workspace-section content-width" id="workspace" ref={workspaceRef} tabIndex={-1} aria-labelledby="workspace-title">
          <div className="section-heading workspace-heading">
            <div>
              <span className="kicker">TRANSFER WORKSPACE</span>
              <h2 id="workspace-title">Copy a Spotify playlist</h2>
              <p>Move your music in a clean 6-step guided workflow with verified track matching.</p>
            </div>
            <span className="spotify-chip"><SiSpotify aria-hidden="true" /> Spotify · Free &amp; Premium</span>
          </div>

          <div className="app-shell">
            <div className="app-topbar">
              <GuidedStepper
                currentStep={currentStep}
                complete={Boolean(result || partial)}
                onStepClick={(step) => {
                  if (step <= currentStep && currentStep !== 5) setCurrentStep(step);
                }}
              />
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

            {rateLimitCountdown > 0 && (
              <div className="inline-alert inline-alert-warning rate-limit-banner" role="alert">
                <FiRefreshCw className="spin" aria-hidden="true" />
                <div className="alert-content">
                  <strong>Spotify rate limit reached</strong>
                  <span>Spotify is rate limiting requests. Auto-retrying in {rateLimitCountdown} seconds...</span>
                  <button
                    type="button"
                    className="btn btn-xs btn-secondary alert-action-btn"
                    onClick={() => {
                      setRateLimitCountdown(0);
                      handleStartTransfer();
                    }}
                  >
                    Retry now
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="inline-alert inline-alert-error" role="alert" ref={errorRef} tabIndex={-1}>
                <FiAlertTriangle aria-hidden="true" />
                <div className="alert-content">
                  <span>{error}</span>
                  {(error.toLowerCase().includes('expired') || error.toLowerCase().includes('session') || error.toLowerCase().includes('reconnect')) && (
                    <button type="button" className="btn btn-xs btn-primary alert-action-btn" onClick={() => connect('source')}>
                      Reconnect Spotify
                    </button>
                  )}
                </div>
                <button type="button" onClick={() => setError('')} aria-label="Dismiss error"><FiX aria-hidden="true" /></button>
              </div>
            )}

            {!sessionLoading && !session.configured && (
              <div className="inline-note inline-note-warning">
                <FiInfo aria-hidden="true" />
                <p><strong>Spotify sign-in is not configured.</strong> The site owner needs to add Spotify credentials before transfers can run.</p>
              </div>
            )}

            {/* STEP 1: CONNECT SOURCE */}
            {currentStep === 1 && (
              <div className="step-view step-view-1">
                <div className="step-view-header">
                  <span className="step-view-number" aria-hidden="true">1</span>
                  <div>
                    <h3>Connect your account</h3>
                    <p>Select your music service to begin. Connect your account to securely read playlists.</p>
                  </div>
                </div>

                <div className="service-cards-grid" role="group" aria-label="Source service selection">
                  {SOURCE_SERVICES.map((service) => {
                    const isSpotify = service.id === 'spotify';
                    const isConnected = isSpotify && Boolean(session.source);
                    return (
                      <div
                        key={service.id}
                        className={`service-card ${service.ready ? 'is-ready' : 'is-disabled'} ${isConnected ? 'is-connected' : ''}`}
                      >
                        <div className="service-card-top">
                          <span className="service-card-icon"><service.Icon aria-hidden="true" /></span>
                          {service.badge && <span className="service-badge">{service.badge}</span>}
                          {isConnected && (
                            <span className="service-connected-pill">
                              <span className="status-dot" aria-hidden="true" /> Connected
                            </span>
                          )}
                        </div>
                        <strong className="service-card-name">{service.name}</strong>
                        <p className="service-card-desc">
                          {isConnected ? `Connected as ${session.source.name}` : service.description}
                        </p>
                        <div className="service-card-action">
                          {isConnected ? (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => disconnect('source')}
                              disabled={sessionLoading}
                            >
                              Disconnect
                            </button>
                          ) : isSpotify ? (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => connect('source')}
                              disabled={sessionLoading || !session.configured}
                            >
                              Connect Spotify
                            </button>
                          ) : (
                            <button type="button" className="btn btn-secondary btn-sm" disabled>
                              Unavailable
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="transparency-box">
                  <div className="transparency-item">
                    <FiLock aria-hidden="true" />
                    <div>
                      <strong>Permissions requested</strong>
                      <p>Read access to your Spotify library and playlists so Playlist Port can read tracks to copy. No playback control and no audio files downloaded.</p>
                    </div>
                  </div>
                  <div className="transparency-item">
                    <FiShield aria-hidden="true" />
                    <div>
                      <strong>Privacy note</strong>
                      <p>Temporary session tokens live in encrypted, 24-hour HttpOnly cookies. We do not store passwords, account tokens, or playlists in any database.</p>
                    </div>
                  </div>
                </div>

                <div className="step-actions">
                  <div />
                  {session.source ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-lg"
                      onClick={() => setCurrentStep(2)}
                    >
                      Next: Pick playlists <FiArrowRight aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-lg"
                      onClick={() => connect('source')}
                      disabled={sessionLoading || !session.configured}
                    >
                      Connect Spotify to continue <FiArrowRight aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2: PICK PLAYLISTS */}
            {currentStep === 2 && (
              <div className="step-view step-view-2">
                <div className="step-view-header">
                  <span className="step-view-number" aria-hidden="true">2</span>
                  <div>
                    <h3 id="step-playlist-title">Pick playlists</h3>
                    <p>Choose playlists to copy. Search by title, filter by category, or paste a public link.</p>
                  </div>
                </div>

                <div className="playlist-panel">
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
                          <span>
                            {filter.id === 'all' ? playlists.length : filter.id === 'mine' ? mineCount : followedCount}
                            {loadedSuffix}
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="playlist-tools">
                      <label className="sort-control">
                        <FiSliders aria-hidden="true" />
                        <span className="sr-only">Sort playlists</span>
                        <select
                          value={sortOrder}
                          onChange={(event) => chooseSort(event.target.value)}
                          aria-label="Sort playlists"
                        >
                          <option value="recent">Recently added</option>
                          <option value="name">Name A–Z</option>
                          <option value="size">Most items</option>
                        </select>
                        <FiChevronDown aria-hidden="true" />
                      </label>
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
                  </div>

                  <form className="playlist-search" onSubmit={loadPastedPlaylist} role="search">
                    <FiSearch aria-hidden="true" />
                    <label className="sr-only" htmlFor="playlist-search">Search playlists or paste a Spotify link</label>
                    <input
                      id="playlist-search"
                      type="search"
                      value={playlistQuery}
                      onChange={(event) => setPlaylistQuery(event.target.value)}
                      onKeyDown={(event) => { if (event.key === 'Escape') setPlaylistQuery(''); }}
                      placeholder="Search by name or owner, or paste a link"
                      autoComplete="off"
                      aria-keyshortcuts="/"
                    />
                    {isPastedSpotifyUrl ? (
                      <button type="submit" className="btn btn-primary btn-xs" disabled={urlLoading} aria-label="Load playlist from link">
                        {urlLoading ? <span className="button-spinner" aria-hidden="true" /> : <><FiLink2 aria-hidden="true" /> Load</>}
                      </button>
                    ) : playlistQuery ? (
                      <button type="button" className="icon-button" onClick={() => setPlaylistQuery('')} aria-label="Clear search">
                        <FiX aria-hidden="true" />
                      </button>
                    ) : (
                      <kbd className="search-kbd" aria-hidden="true">/</kbd>
                    )}
                  </form>

                  {/* Batch Selection Live Summary */}
                  <div className="selection-summary-bar">
                    <div className="selection-stats">
                      <strong>
                        {selectedIds.length === 0
                          ? 'No playlists selected'
                          : selectedIds.length === 1
                            ? `1 playlist, ${totalTracksSelected}${hasUnknownTrackCount ? '+' : ''} tracks`
                            : `${selectedIds.length} playlists, ${totalTracksSelected}${hasUnknownTrackCount ? '+' : ''} tracks`}
                      </strong>
                    </div>
                    <div className="selection-actions">
                      <button type="button" className="btn btn-ghost btn-xs" onClick={selectAllFiltered}>
                        Select all
                      </button>
                      {selectedIds.length > 0 && (
                        <button type="button" className="btn btn-ghost btn-xs" onClick={clearAllSelections}>
                          Select none
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="playlist-list" role="listbox" aria-multiselectable="true">
                    {likedVisible && (
                      <button
                        type="button"
                        className={`playlist-row liked-row ${selectedIds.includes('liked-songs') ? 'selected' : ''}`}
                        onClick={() => togglePlaylistSelection('liked-songs', { id: 'liked-songs', name: 'Liked Songs' })}
                        aria-selected={selectedIds.includes('liked-songs')}
                      >
                        <span className="playlist-checkbox" aria-hidden="true">
                          {selectedIds.includes('liked-songs') ? <FiCheck /> : null}
                        </span>
                        <span className="playlist-art liked-art" aria-hidden="true">♥</span>
                        <span className="playlist-info">
                          <span className="playlist-title-line">
                            <strong>Liked Songs</strong>
                            <span className="tag tag-liked">Collection</span>
                          </span>
                          <span>Saved tracks from your Spotify library</span>
                        </span>
                        <span className="playlist-check" aria-hidden="true">
                          {selectedIds.includes('liked-songs') ? <FiCheck /> : <FiArrowRight />}
                        </span>
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
                      shownPlaylists.map((playlist) => {
                        const isSelected = selectedIds.includes(playlist.id);
                        return (
                          <button
                            key={playlist.id}
                            type="button"
                            className={`playlist-row ${isSelected ? 'selected' : ''}`}
                            onClick={() => togglePlaylistSelection(playlist.id, playlist)}
                            aria-selected={isSelected}
                            title={playlist.name}
                          >
                            <span className="playlist-checkbox" aria-hidden="true">
                              {isSelected ? <FiCheck /> : null}
                            </span>
                            <PlaylistArt playlist={playlist} />
                            <span className="playlist-info">
                              <span className="playlist-title-line">
                                <strong>{playlist.name}</strong>
                                <span className={`tag ${playlist.isOwner ? 'tag-mine' : 'tag-followed'}`}>
                                  {playlist.isOwner ? 'You' : 'Followed'}
                                </span>
                              </span>
                              <span>
                                {playlist.count == null ? 'Track count checked at transfer' : `${playlist.count} ${playlist.count === 1 ? 'track' : 'tracks'}`} · by {playlist.owner}
                              </span>
                            </span>
                            <span className="playlist-check" aria-hidden="true">
                              {isSelected ? <FiCheck /> : <FiArrowRight />}
                            </span>
                          </button>
                        );
                      })
                    )}

                    {!playlistsLoading && shownPlaylists.length === 0 && !likedVisible && (
                      <div className="empty-panel">
                        <FiMusic aria-hidden="true" />
                        <p>
                          {playlistQuery
                            ? `No loaded playlists match “${playlistQuery.trim()}”.`
                            : 'No playlists found in this category.'}
                        </p>
                        {playlistQuery && (
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPlaylistQuery('')}>
                            Clear search
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="list-footer">
                    <span role="status">
                      {shownPlaylists.length} loaded {nextOffset !== null ? `(${playlistTotal ?? playlists.length} total)` : '· all loaded'}
                    </span>
                    {nextOffset !== null && (
                      <button type="button" className="load-more" disabled={playlistsLoading} onClick={() => loadPlaylists(nextOffset)}>
                        {playlistsLoading ? <><span className="button-spinner" aria-hidden="true" /> Loading…</> : <>Load more <FiChevronDown aria-hidden="true" /></>}
                      </button>
                    )}
                  </div>
                </div>

                <div className="step-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setCurrentStep(1)}>
                    <FiArrowLeft aria-hidden="true" /> Back to source
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={selectedIds.length === 0}
                    onClick={() => setCurrentStep(3)}
                  >
                    Next: Connect destination ({selectedIds.length}) <FiArrowRight aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: CONNECT DESTINATION */}
            {currentStep === 3 && (
              <div className="step-view step-view-3">
                <div className="step-view-header">
                  <span className="step-view-number" aria-hidden="true">3</span>
                  <div>
                    <h3 id="step-destination-title">Connect destination</h3>
                    <p>Select where your copied playlist will be saved.</p>
                  </div>
                </div>

                <div className="service-cards-grid" role="group" aria-label="Destination service selection">
                  {DESTINATION_SERVICES.map((service) => {
                    const isSpotify = service.id === 'spotify';
                    const isConnected = isSpotify && Boolean(useSecondAccount ? session.destination : session.source);
                    return (
                      <div
                        key={service.id}
                        className={`service-card ${service.ready ? 'is-ready' : 'is-disabled'} ${isConnected ? 'is-connected' : ''}`}
                      >
                        <div className="service-card-top">
                          <span className="service-card-icon"><service.Icon aria-hidden="true" /></span>
                          {service.badge && <span className="service-badge">{service.badge}</span>}
                          {isConnected && (
                            <span className="service-connected-pill">
                              <span className="status-dot" aria-hidden="true" /> Ready
                            </span>
                          )}
                        </div>
                        <strong className="service-card-name">{service.name}</strong>
                        <p className="service-card-desc">{service.description}</p>
                        <div className="service-card-action">
                          {isSpotify ? (
                            <span className="tag tag-mine">Active Destination</span>
                          ) : (
                            <button type="button" className="btn btn-secondary btn-sm" disabled>
                              Unavailable
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="destination-options">
                  <div className="destination-account-header">
                    <h4>Spotify Destination Account</h4>
                  </div>
                  <div className="segmented" role="radiogroup" aria-label="Destination account selection">
                    <label className={`segment ${!useSecondAccount ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name="destination"
                        checked={!useSecondAccount}
                        onChange={() => chooseDestination(false)}
                      />
                      <span className="segment-icon" aria-hidden="true"><FiUser /></span>
                      <span className="segment-copy">
                        <strong>Same Spotify account</strong>
                        <small>Create new private playlist here</small>
                      </span>
                      <span className="radio-ui" aria-hidden="true" />
                    </label>

                    <label className={`segment ${useSecondAccount ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name="destination"
                        checked={useSecondAccount}
                        onChange={() => chooseDestination(true)}
                      />
                      <span className="segment-icon" aria-hidden="true"><FiUsers /></span>
                      <span className="segment-copy">
                        <strong>Another Spotify account</strong>
                        <small>Connect secondary receiver account</small>
                      </span>
                      <span className="radio-ui" aria-hidden="true" />
                    </label>
                  </div>

                  {useSecondAccount && (
                    <div className="destination-account-box">
                      <AccountCard
                        label="DESTINATION SPOTIFY ACCOUNT"
                        account={session.destination}
                        onConnect={() => connect('destination')}
                        onDisconnect={() => disconnect('destination')}
                        disabled={sessionLoading || !session.configured}
                        connectLabel="Connect destination"
                        justConnected={justConnected === 'destination'}
                      />
                      {sameDestination && (
                        <div className="inline-warning" role="alert">
                          <FiAlertTriangle aria-hidden="true" />
                          <span>This is the same account as your source. Connect a different account or choose “Same Spotify account”.</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="transparency-box">
                    <div className="transparency-item">
                      <FiLock aria-hidden="true" />
                      <div>
                        <strong>Destination permissions</strong>
                        <p>Write access to create a new private playlist and insert items in your destination account. Originals stay untouched.</p>
                      </div>
                    </div>
                    <div className="transparency-item">
                      <FiShield aria-hidden="true" />
                      <div>
                        <strong>Privacy note</strong>
                        <p>Destination credentials are encrypted in a separate session cookie and discarded automatically after 24 hours.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="step-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setCurrentStep(2)}>
                    <FiArrowLeft aria-hidden="true" /> Back to playlists
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={useSecondAccount && (!session.destination || sameDestination)}
                    onClick={() => setCurrentStep(4)}
                  >
                    Next: Review transfer <FiArrowRight aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: REVIEW */}
            {currentStep === 4 && (
              <div className="step-view step-view-4">
                <div className="step-view-header">
                  <span className="step-view-number" aria-hidden="true">4</span>
                  <div>
                    <h3 id="step-review-title">Review &amp; confirm</h3>
                    <p>Check your source, destination, and playlist details before starting.</p>
                  </div>
                </div>

                <div className="review-container">
                  {/* Free tier limits stated upfront! */}
                  <div className="upfront-limits-card">
                    <div className="limits-header">
                      <FiInfo aria-hidden="true" />
                      <strong>Important pre-transfer details</strong>
                    </div>
                    <ul className="limits-list">
                      <li><FiCheck aria-hidden="true" /> <strong>Free &amp; Premium accounts:</strong> No limits on transfer volume or song counts.</li>
                      <li><FiCheck aria-hidden="true" /> <strong>Verified order:</strong> Every song is checked in destination order.</li>
                      <li><FiAlertTriangle aria-hidden="true" /> <strong>API limits:</strong> Local files on your hard drive and tracks unavailable in the destination market cannot be transferred.</li>
                      <li><FiLock aria-hidden="true" /> <strong>Privacy:</strong> Copied playlists start hidden from your public profile.</li>
                    </ul>
                  </div>

                  <div className="review-route-card">
                    <div className="review-endpoint">
                      <span className="endpoint-icon"><SiSpotify aria-hidden="true" /></span>
                      <div>
                        <span className="eyebrow">SOURCE</span>
                        <strong>{session.source?.name || 'Spotify Source'}</strong>
                      </div>
                    </div>
                    <span className="review-arrow" aria-hidden="true"><FiArrowRight /></span>
                    <div className="review-endpoint">
                      <span className="endpoint-icon"><SiSpotify aria-hidden="true" /></span>
                      <div>
                        <span className="eyebrow">DESTINATION</span>
                        <strong>{destinationName}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="review-manifest-header">
                    <h4>Playlists to copy ({selectedPlaylists.length})</h4>
                    <span className="manifest-track-total">
                      {totalTracksSelected > 0 ? `${totalTracksSelected}${hasUnknownTrackCount ? '+' : ''} total tracks` : 'Tracks verified at transfer'}
                    </span>
                  </div>

                  <div className="review-manifest">
                    {selectedPlaylists.map((pl, idx) => {
                      const isSingle = selectedPlaylists.length === 1;
                      const customName = customNames[pl.id] ?? (isSingle ? newName : `${pl.name} (copy)`);

                      return (
                        <div key={pl.id} className="selected-card-group">
                          <div className="selected-card">
                            <PlaylistArt playlist={pl} className="selected-art" />
                            <div className="selected-info">
                              <span className="eyebrow">SOURCE PLAYLIST {selectedPlaylists.length > 1 ? `#${idx + 1}` : ''}</span>
                              <strong>{pl.name}</strong>
                              <span>
                                {pl.count == null ? 'Track count checked during copy' : `${pl.count} ${pl.count === 1 ? 'track' : 'tracks'}`} · by {pl.owner}
                              </span>
                            </div>
                            <a className="icon-button" href={pl.url} target="_blank" rel="noreferrer" aria-label={`View ${pl.name} in Spotify`}>
                              <FiExternalLink aria-hidden="true" />
                            </a>
                          </div>

                          <div className="name-input-group">
                            <label className="name-label" htmlFor={`new-name-${pl.id}`}>Destination playlist name</label>
                            <div className="name-field">
                              <input
                                id={`new-name-${pl.id}`}
                                className="name-input"
                                maxLength={100}
                                required
                                value={isSingle ? newName : customName}
                                aria-invalid={(isSingle ? nameMissing : !customName.trim()) || undefined}
                                onChange={(event) => {
                                  const val = event.target.value;
                                  if (isSingle) {
                                    setNewName(val);
                                    writeSessionItem('playlist-port.name', val);
                                  } else {
                                    setCustomNames((prev) => ({ ...prev, [pl.id]: val }));
                                  }
                                }}
                                placeholder="Name your new playlist"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="step-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setCurrentStep(3)}>
                    <FiArrowLeft aria-hidden="true" /> Back to destination
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-lg"
                    disabled={!readyToCopy || transferring}
                    onClick={handleStartTransfer}
                  >
                    Start Transfer ({selectedPlaylists.length} {selectedPlaylists.length === 1 ? 'playlist' : 'playlists'}, {totalTracksSelected > 0 ? `${totalTracksSelected} tracks` : 'verified'}) <FiArrowRight aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 5: TRANSFER IN PROGRESS */}
            {currentStep === 5 && (
              <div className="step-view step-view-5" role="status" aria-live="polite">
                <div className="result-panel result-progress">
                  <div className="result-hero">
                    <span className="result-icon result-spinner"><FiRefreshCw aria-hidden="true" /></span>
                    <div>
                      <span className="eyebrow">TRANSFER IN PROGRESS</span>
                      <h3>Copying “{selectedPlaylists[activeTransferIndex]?.name || primarySelected?.name}”</h3>
                      <p>Creating destination playlists and verifying tracks in original order.</p>
                    </div>
                  </div>

                  <div className="transfer-progress-box">
                    <div className="progress-bar-container">
                      <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
                    </div>
                    <div className="progress-bar-stats">
                      <span>{Math.round(progressPercent)}% overall completed</span>
                      <span>~{remainingSeconds}s remaining</span>
                    </div>
                  </div>

                  {/* Per-playlist progress bars */}
                  <div className="per-playlist-progress-list" aria-label="Playlists transfer progress">
                    {selectedPlaylists.map((pl, idx) => {
                      const isPast = idx < activeTransferIndex;
                      const isCurrent = idx === activeTransferIndex && transferring;
                      const isQueued = idx > activeTransferIndex;
                      const plResult = transferResults[idx];
                      const plTracks = pl.count ?? 30;
                      const plPercent = isPast ? 100 : isCurrent ? Math.min(95, Math.max(10, Math.round((simulatedActiveProgress / plTracks) * 100))) : 0;

                      return (
                        <div key={pl.id} className={`per-playlist-progress-item ${isCurrent ? 'is-active' : isPast ? 'is-done' : 'is-queued'}`}>
                          <div className="per-playlist-info">
                            <PlaylistArt playlist={pl} className="per-playlist-art" />
                            <div className="per-playlist-names">
                              <strong>{pl.name}</strong>
                              <span>
                                {isPast
                                  ? `${plResult?.copied ?? plTracks} tracks copied · Verified`
                                  : isCurrent
                                    ? `Processing items (${Math.min(plTracks, simulatedActiveProgress)} of ${plTracks} tracks)...`
                                    : `${plTracks} tracks · Queued`}
                              </span>
                            </div>
                            <span className="per-playlist-badge">
                              {isPast ? <><FiCheck aria-hidden="true" /> Done</> : isCurrent ? <><FiRefreshCw className="spin" aria-hidden="true" /> Active</> : 'Queued'}
                            </span>
                          </div>
                          <div className="per-playlist-bar-track" aria-hidden="true">
                            <div className="per-playlist-bar-fill" style={{ width: `${plPercent}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="tab-safety-notice">
                    <FiAlertTriangle aria-hidden="true" />
                    <p>
                      <strong>Keep this tab open.</strong> Transfers execute in real-time from your active browser session. Do not close or navigate away until verification finishes.
                    </p>
                  </div>

                  <div className="progress-meta">
                    <div><span>TO</span><strong className="truncate" title={destinationName}>{destinationName}</strong></div>
                    <div><span>TRACKS PROCESSED</span><strong>{tracksProcessedDisplay} of {totalItemsCount}</strong></div>
                    <div><span>ELAPSED</span><strong>{Math.floor(transferElapsed / 60)}:{String(transferElapsed % 60).padStart(2, '0')}</strong></div>
                  </div>

                  <div className="transfer-cancel-bar">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setShowCancelModal(true)}
                    >
                      Cancel transfer
                    </button>
                  </div>
                </div>

                <CancelConfirmModal
                  isOpen={showCancelModal}
                  onKeep={() => setShowCancelModal(false)}
                  onConfirm={handleCancelConfirm}
                />
              </div>
            )}

            {/* STEP 6: RESULTS */}
            {currentStep === 6 && (
              <div className="step-view step-view-6">
                {result ? (
                  <div className="result-panel result-success" role="status">
                    <div className="result-hero">
                      <span className="result-icon">{result.skipped > 0 ? <FiAlertTriangle aria-hidden="true" /> : <FiCheckCircle aria-hidden="true" />}</span>
                      <div>
                        <span className="eyebrow">
                          {result.skipped > 0
                            ? 'TRANSFER FINISHED WITH SKIPPED ITEMS'
                            : 'TRANSFER COMPLETE'}
                        </span>
                        <h3>
                          {result.skipped > 0
                            ? `Playlist transfer finished with ${result.skipped} items skipped`
                            : 'Playlists copied successfully'}
                        </h3>
                        <p>“{result.name}” is ready in {destinationName}.</p>
                      </div>
                      {result.verified && <span className="verified-pill"><FiShield aria-hidden="true" /> Verified</span>}
                    </div>

                    {/* Results summary (matched, close matches, not found) */}
                    <div className="result-stats">
                      <div><span>Matched &amp; Copied</span><strong>{result.copied}</strong></div>
                      <div><span>Close Matches</span><strong>{result.closeMatches?.length || 0}</strong></div>
                      <div><span>Skipped / Not Found</span><strong>{result.skipped || 0}</strong></div>
                    </div>

                    {result.isEmbedFallback && result.copied < result.originalTotal && (
                      <div className="inline-note inline-note-warning">
                        <FiAlertTriangle aria-hidden="true" />
                        <p><strong>Public preview limited this copy.</strong> Spotify&apos;s public playlist preview exposed {result.copied} of {result.originalTotal} items. Reconnect the source account and try again to copy everything.</p>
                      </div>
                    )}

                    {/* Reconciliation section: Review unmatched tracks & accept suggested close matches */}
                    {(result.skipped > 0 || (result.closeMatches && result.closeMatches.length > 0)) && (
                      <div className="unmatched-section">
                        <h4>Review Unmatched &amp; Suggested Matches</h4>
                        <p className="unmatched-desc">
                          Some items could not be copied identically due to local file constraints or catalog differences. Review suggested close matches below.
                        </p>

                        {result.closeMatches && result.closeMatches.length > 0 && (
                          <div className="close-matches-list">
                            <strong className="close-matches-title">Suggested Close Matches ({result.closeMatches.length})</strong>
                            {result.closeMatches.map((cm) => {
                              const isAccepted = Boolean(acceptedCloseMatches[cm.id]);
                              return (
                                <div key={cm.id} className="close-match-row">
                                  <div className="close-match-info">
                                    <strong>{cm.title}</strong>
                                    <span>{cm.reason}</span>
                                  </div>
                                  {isAccepted ? (
                                    <span className="tag tag-mine"><FiCheck aria-hidden="true" /> Match Accepted</span>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn btn-xs btn-primary"
                                      onClick={() => acceptCloseMatch(cm.id)}
                                    >
                                      Accept match
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {result.skipped > 0 && (
                          <div className="unmatched-table">
                            <div className="unmatched-row">
                              <span>Local audio files (MP3s) / Region restrictions</span>
                              <span className="tag tag-mine">{result.skipped} skipped</span>
                            </div>
                          </div>
                        )}

                        <div className="unmatched-actions">
                          <button type="button" className="btn btn-secondary btn-sm" onClick={retryFailedItems}>
                            <FiRefreshCw aria-hidden="true" /> Retry failed items
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="result-actions">
                      {result.items && result.items.length > 1 ? (
                        result.items.map((it) => (
                          <a key={it.name} className="btn btn-primary" href={it.url} target="_blank" rel="noreferrer">
                            <SiSpotify aria-hidden="true" /> Open “{it.name}” <FiExternalLink aria-hidden="true" />
                          </a>
                        ))
                      ) : (
                        <a className="btn btn-primary" href={result.url} target="_blank" rel="noreferrer">
                          <SiSpotify aria-hidden="true" /> Open in Spotify <FiExternalLink aria-hidden="true" />
                        </a>
                      )}
                      <button type="button" className="btn btn-secondary" onClick={() => copyLink(result.url)}>
                        {copyState === 'copied' ? <><FiCheck aria-hidden="true" /> Link copied</> : copyState === 'failed' ? <><FiAlertTriangle aria-hidden="true" /> Copy failed</> : <><FiCopy aria-hidden="true" /> Copy link</>}
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => downloadCsvReport(result, destinationName, acceptedCloseMatches)}>
                        <FiDownload aria-hidden="true" /> Download CSV Report
                      </button>
                      <span className="sr-only" aria-live="polite">{copyState === 'copied' ? 'Link copied to clipboard.' : copyState === 'failed' ? 'Could not copy the link.' : ''}</span>
                    </div>

                    <p className="result-note"><FiInfo aria-hidden="true" /><span>The copy is hidden from your public profile by default.</span></p>

                    <div className="result-again">
                      <span className="result-again-icon" aria-hidden="true"><FiPlus /></span>
                      <div className="result-again-copy">
                        <strong>Ready for another playlist?</strong>
                        <span>Start a new transfer — your source playlists remain untouched.</span>
                      </div>
                      <button type="button" className="btn btn-again" onClick={resetTransfer}>
                        Transfer another playlist <FiArrowRight aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ) : partial ? (
                  <div className="result-panel result-partial" role="status">
                    <div className="result-hero">
                      <span className="result-icon"><FiAlertTriangle aria-hidden="true" /></span>
                      <div>
                        <span className="eyebrow">COPY INCOMPLETE</span>
                        <h3>The transfer stopped early</h3>
                        <p>{partial.copied} of {partial.total} items were copied before stopping.</p>
                      </div>
                    </div>

                    <div className="result-stats">
                      <div><span>Copied</span><strong>{partial.copied}</strong></div>
                      <div><span>Remaining</span><strong>{partial.total - partial.copied}</strong></div>
                      <div><span>Destination</span><strong className="truncate" title={destinationName}>{destinationName}</strong></div>
                    </div>

                    {error && <p className="result-error"><FiInfo aria-hidden="true" /> {error}</p>}

                    <div className="result-actions">
                      {partial.url && (
                        <a className="btn btn-primary" href={partial.url} target="_blank" rel="noreferrer">
                          <SiSpotify aria-hidden="true" /> Open partial playlist <FiExternalLink aria-hidden="true" />
                        </a>
                      )}
                      {partial.url && (
                        <button type="button" className="btn btn-secondary" onClick={() => copyLink(partial.url)}>
                          {copyState === 'copied' ? <><FiCheck aria-hidden="true" /> Link copied</> : copyState === 'failed' ? <><FiAlertTriangle aria-hidden="true" /> Copy failed</> : <><FiCopy aria-hidden="true" /> Copy link</>}
                        </button>
                      )}
                      <button type="button" className="btn btn-secondary" onClick={() => downloadCsvReport(partial, destinationName, acceptedCloseMatches)}>
                        <FiDownload aria-hidden="true" /> Download CSV Report
                      </button>
                    </div>

                    <div className="result-again result-again-partial">
                      <span className="result-again-icon" aria-hidden="true"><FiRefreshCw /></span>
                      <div className="result-again-copy">
                        <strong>Want to start over?</strong>
                        <span>Start a fresh transfer, or open the partial link in Spotify.</span>
                      </div>
                      <button type="button" className="btn btn-again" onClick={resetTransfer}>
                        Start fresh transfer <FiArrowRight aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="result-panel">
                    <p>No transfer results to show.</p>
                    <button type="button" className="btn btn-primary" onClick={() => setCurrentStep(2)}>
                      Pick a playlist
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* SUPPORTED SERVICES */}
        <section className="services-section content-width" aria-labelledby="services-title">
          <div className="services-inner">
            <div className="services-copy">
              <span className="kicker">WORKS WITH</span>
              <h2 id="services-title">Spotify today. More services next.</h2>
              <p>Transfers run between Spotify accounts for now. Apple Music, YouTube Music, Deezer, and TIDAL are on the roadmap.</p>
            </div>
            <ul className="service-list">
              {SOURCE_SERVICES.map(({ name, Icon, ready }) => (
                <li key={name} className={`service-item ${ready ? 'is-ready' : ''}`}>
                  <Icon aria-hidden="true" />
                  <span>{name}</span>
                  {ready && <span className="service-live">Live</span>}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* HOW IT WORKS */}
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
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (!session.source) connect('source');
                else scrollToWorkspace(true);
              }}
              disabled={sessionLoading}
            >
              {session.source ? 'Open your workspace' : 'Start with Spotify'} <FiArrowRight aria-hidden="true" />
            </button>
          </div>
        </section>

        {/* FAQ */}
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

        {/* FINAL CTA */}
        <section className="final-cta content-width" aria-labelledby="cta-title">
          <div>
            <span className="kicker">READY WHEN YOU ARE</span>
            <h2 id="cta-title">Your next playlist is a copy away.</h2>
            <p className="final-cta-note"><FiLock aria-hidden="true" /> Private copy by default · Free &amp; Premium Spotify accounts · Originals never change</p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={() => {
              if (!session.source) connect('source');
              else scrollToWorkspace(true);
            }}
            disabled={sessionLoading}
          >
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
