import { useEffect, useRef, useState } from 'react';
import { SiApplemusic, SiDeezer, SiSpotify, SiTidal, SiYoutube, SiYoutubemusic } from 'react-icons/si';
import {
  FiArrowRight, FiCheck, FiCheckCircle, FiChevronDown, FiCopy, FiExternalLink,
  FiHeart, FiInfo, FiLink2, FiMusic, FiRefreshCw, FiSearch, FiShield, FiX
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

function Account({ label, account, onConnect, onDisconnect, disabled, buttonText }) {
  return (
    <div className={`account ${account ? 'account-connected' : ''}`}>
      <div className="account-icon"><SiSpotify aria-hidden="true" /></div>
      <div className="account-copy">
        <span className="eyebrow">{label}</span>
        <strong>{account ? account.name : 'Spotify account'}</strong>
        <span className="account-detail">{account ? 'Connected securely' : 'Connect to continue'}</span>
      </div>
      {account ? (
        <button className="text-button" onClick={onDisconnect} aria-label={`Disconnect ${label.toLowerCase()}`}>Disconnect</button>
      ) : (
        <button className="small-button" onClick={onConnect} disabled={disabled}>{buttonText || 'Connect'}</button>
      )}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState({ configured: false, source: null, destination: null });
  const [sessionLoading, setSessionLoading] = useState(true);
  const [serviceQuery, setServiceQuery] = useState('');
  const [playlistQuery, setPlaylistQuery] = useState('');
  const [playlists, setPlaylists] = useState([]);
  const [nextOffset, setNextOffset] = useState(null);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(() => readSessionItem('playlist-port.selected'));
  const [newName, setNewName] = useState(() => readSessionItem('playlist-port.name'));
  const [pastedUrl, setPastedUrl] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [copiedLink, setCopiedLink] = useState(false);
  const [useSecondAccount, setUseSecondAccount] = useState(() => readSessionItem('playlist-port.second') === 'true');
  const [error, setError] = useState('');
  const [partial, setPartial] = useState(null);
  const [result, setResult] = useState(null);
  const [transferring, setTransferring] = useState(false);
  const workflowRef = useRef(null);
  const transferLock = useRef(false);

  const selected = selectedId === 'liked-songs'
    ? { id: 'liked-songs', name: 'Liked Songs', count: null, owner: session.source?.name || 'You', canCopy: true, isOwner: true, url: 'https://open.spotify.com/collection/tracks' }
    : playlists.find((playlist) => playlist.id === selectedId);
  const selectedIsEmpty = selected?.count === 0;
  const shownServices = services.filter((service) => service.name.toLowerCase().includes(serviceQuery.toLowerCase()));

  const mineCount = playlists.filter((p) => p.isOwner).length;
  const followedCount = playlists.filter((p) => !p.isOwner).length;
  const filteredByTab = playlists.filter((playlist) => {
    if (activeTab === 'mine') return playlist.isOwner;
    if (activeTab === 'followed') return !playlist.isOwner;
    return true;
  });
  const shownPlaylists = filteredByTab.filter((playlist) =>
    playlist.name.toLowerCase().includes(playlistQuery.toLowerCase())
  );
  const currentStep = result ? 4 : !session.source ? 1 : !selected ? 2 : 3;
  function openWorkflow() {
    workflowRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    workflowRef.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('authError')) setError(params.get('authError'));
    if (params.has('connected')) {
      setTimeout(() => workflowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 180);
    }
    if (params.has('authError') || params.has('connected')) window.history.replaceState({}, '', window.location.pathname);
    api('/session').then(setSession).catch((err) => setError(err.message)).finally(() => setSessionLoading(false));
  }, []);

  useEffect(() => {
    if (!session.source) {
      setPlaylists([]);
      setNextOffset(null);
      return;
    }
    loadPlaylists(0, true);
  }, [session.source?.id]);

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
  }

  function selectLikedSongs() {
    setSelectedId('liked-songs');
    writeSessionItem('playlist-port.selected', 'liked-songs');
    setNewName('Liked Songs');
    writeSessionItem('playlist-port.name', 'Liked Songs');
    setError('');
    setPartial(null);
    setResult(null);
  }

  async function loadPastedPlaylist(event) {
    event.preventDefault();
    const trimmed = pastedUrl.trim();
    if (!trimmed) return;
    const match = trimmed.match(/(?:playlist\/|playlist:)([a-zA-Z0-9]{1,64})/);
    if (!match) {
      setError('Please enter a valid Spotify playlist URL (e.g. https://open.spotify.com/playlist/...)');
      return;
    }
    const playlistId = match[1];
    setUrlLoading(true);
    setError('');
    try {
      const data = await api(`/playlist/${playlistId}`);
      setPlaylists((current) => {
        if (current.some((p) => p.id === data.id)) return current;
        return [data, ...current];
      });
      choosePlaylist(data);
      setPastedUrl('');
    } catch (err) {
      setError(err.message || 'Could not load playlist from that URL.');
    } finally {
      setUrlLoading(false);
    }
  }

  function chooseDestination(second) {
    setUseSecondAccount(second);
    writeSessionItem('playlist-port.second', String(second));
  }

  async function startTransfer(event) {
    event.preventDefault();
    if (transferLock.current || !selected || selectedIsEmpty) return;
    transferLock.current = true;
    setTransferring(true);
    setError('');
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
    } finally {
      transferLock.current = false;
      setTransferring(false);
    }
  }

  return (
    <div className="page-shell">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <header className="site-header content-width">
        <a className="brand" href="#top" aria-label="Playlist Port home">
          <span className="brand-mark"><FiLink2 aria-hidden="true" /></span>
          <span>playlist<span className="brand-light">port</span></span>
        </a>
        <span className="header-badge"><span className="badge-dot" /> Spotify first release</span>
      </header>

      <main id="top" className="content-width">
        <section className="intro">
          <div className="intro-kicker"><span className="kicker-line" /> YOUR MUSIC, YOUR WAY</div>
          <h1>Move your playlists.<br /><span>Keep every beat.</span></h1>
          <p>Choose your music service, connect Spotify, and make a new copy of your playlist in the same account or another one.</p>
          <div className="intro-meta"><FiShield aria-hidden="true" /> Your playlists stay on Spotify. Nothing is deleted.</div>
          <button type="button" className="start-button" onClick={openWorkflow}>Start with Spotify <FiArrowRight aria-hidden="true" /></button>
        </section>

        <section className="services-section" aria-labelledby="services-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">PICK YOUR SOURCE</span>
              <h2 id="services-title">Where is your music?</h2>
            </div>
            <span className="section-aside">More services on the way</span>
          </div>
          <label className="search-field">
            <FiSearch aria-hidden="true" />
            <span className="sr-only">Search services</span>
            <input value={serviceQuery} onChange={(event) => setServiceQuery(event.target.value)} placeholder="Search services" />
            {serviceQuery && <button type="button" onClick={() => setServiceQuery('')} aria-label="Clear service search"><FiX /></button>}
          </label>
          <div className="service-grid">
            {shownServices.map(({ name, Icon, ready }) => (
              <button
                key={name}
                type="button"
                className={`service-card service-${name.toLowerCase().replaceAll(' ', '-')} ${ready ? 'service-ready' : 'service-later'}`}
                onClick={ready ? openWorkflow : undefined}
                disabled={!ready}
                aria-label={ready ? `Choose ${name}` : `${name}, coming later`}
              >
                <span className="service-content"><Icon aria-hidden="true" /><strong>{name}</strong></span>
                <span className="service-label">{ready ? 'TRANSFER WITH SPOTIFY' : 'COMING LATER'}</span>
                {ready && <span className="service-arrow"><FiArrowRight aria-hidden="true" /></span>}
              </button>
            ))}
          </div>
          {shownServices.length === 0 && <p className="empty-search">No matching service yet. Spotify is available in this release.</p>}
        </section>

        <section className="workspace" ref={workflowRef} tabIndex={-1} aria-labelledby="workspace-title">
          <div className="workspace-title-row">
            <div>
              <span className="eyebrow">SPOTIFY → SPOTIFY</span>
              <h2 id="workspace-title">Make your first move.</h2>
              <p>Copy a playlist into this account or another one. Spotify Free and Premium accounts are supported.</p>
            </div>
            <div className="workspace-stamp"><SiSpotify aria-hidden="true" /> SPOTIFY</div>
          </div>

          <ol className="workflow-progress" aria-label="Playlist copy progress">
            {['Connect account', 'Choose playlist', 'Review & copy', 'Complete'].map((label, index) => (
              <li key={label} className={index + 1 < currentStep ? 'done' : index + 1 === currentStep ? 'current' : ''} aria-current={index + 1 === currentStep ? 'step' : undefined}>
                <span aria-hidden="true">{index + 1 < currentStep ? <FiCheck /> : index + 1}</span>{label}
              </li>
            ))}
          </ol>
          {sessionLoading && <p className="connection-status" role="status">Checking your Spotify connection…</p>}

          {!sessionLoading && !session.configured && (
            <div className="setup-note" role="status">
              <FiInfo aria-hidden="true" />
              <div><strong>Spotify sign-in is being set up.</strong><span>The site owner needs to connect a Spotify developer app before transfers are available.</span></div>
            </div>
          )}

          {error && <div className="alert alert-error" role="alert"><FiInfo aria-hidden="true" /><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><FiX /></button></div>}
          {partial && <div className="alert alert-partial" role="status"><FiInfo aria-hidden="true" /><span>{partial.copied} of {partial.total} items copied. The partial playlist is saved. <a href={partial.url} target="_blank" rel="noreferrer">Open it in Spotify <FiExternalLink aria-hidden="true" /></a></span></div>}

          <div className="workflow-grid">
            <div className="workflow-main">
              <div className="step-heading"><span className="step-number">01</span><div><h3>Connect your account</h3><p>Approve playlist access on Spotify. During testing, both accounts must be approved by the site owner.</p></div></div>
              <Account
                label="SOURCE ACCOUNT"
                account={session.source}
                onConnect={() => connect('source')}
                onDisconnect={() => disconnect('source')}
                disabled={sessionLoading || !session.configured}
              />

              <div className="step-heading second-step"><span className="step-number">02</span><div><h3>Choose a playlist</h3><p>Select any playlist you own or follow, your Liked Songs, or paste a public Spotify playlist link.</p></div></div>
              {session.source ? (
                <div className="playlist-panel">
                  <div className="playlist-panel-header">
                    <button
                      type="button"
                      className={`liked-songs-btn ${selectedId === 'liked-songs' ? 'selected' : ''}`}
                      onClick={selectLikedSongs}
                    >
                      <span className="liked-art">♥</span>
                      <div className="liked-info">
                        <strong>Liked Songs</strong>
                        <span>Transfer your saved tracks to a new playlist</span>
                      </div>
                      <span className="liked-badge">
                        {selectedId === 'liked-songs' ? <FiCheck aria-hidden="true" /> : <FiArrowRight aria-hidden="true" />}
                      </span>
                    </button>

                    <form onSubmit={loadPastedPlaylist} className="url-search-form">
                      <div className="search-field url-search">
                        <FiLink2 aria-hidden="true" />
                        <input
                          value={pastedUrl}
                          onChange={(event) => setPastedUrl(event.target.value)}
                          placeholder="Paste any Spotify playlist link…"
                        />
                        {pastedUrl && (
                          <button type="button" className="clear-inline-btn" onClick={() => setPastedUrl('')} aria-label="Clear URL">
                            <FiX />
                          </button>
                        )}
                        <button type="submit" className="small-button" disabled={urlLoading || !pastedUrl.trim()}>
                          {urlLoading ? 'Loading…' : 'Load URL'}
                        </button>
                      </div>
                    </form>

                    <div className="filter-row">
                      <div className="playlist-tabs">
                        <button
                          type="button"
                          className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                          onClick={() => setActiveTab('all')}
                        >
                          All ({playlists.length})
                        </button>
                        <button
                          type="button"
                          className={`tab-btn ${activeTab === 'mine' ? 'active' : ''}`}
                          onClick={() => setActiveTab('mine')}
                        >
                          Created by You ({mineCount})
                        </button>
                        <button
                          type="button"
                          className={`tab-btn ${activeTab === 'followed' ? 'active' : ''}`}
                          onClick={() => setActiveTab('followed')}
                        >
                          Followed ({followedCount})
                        </button>
                      </div>
                    </div>

                    <div className="search-field playlist-search">
                      <FiSearch aria-hidden="true" />
                      <span className="sr-only">Search loaded playlists</span>
                      <input
                        value={playlistQuery}
                        onChange={(event) => setPlaylistQuery(event.target.value)}
                        placeholder="Search your playlists…"
                      />
                      {playlistQuery && (
                        <button type="button" className="clear-inline-btn" onClick={() => setPlaylistQuery('')} aria-label="Clear search">
                          <FiX />
                        </button>
                      )}
                    </div>

                    <button type="button" className="refresh-playlists" onClick={refreshPlaylists} disabled={playlistsLoading}>
                      <FiRefreshCw className={playlistsLoading ? 'spin-icon' : ''} /> {playlistsLoading ? 'Refreshing playlists…' : 'Refresh playlists'}
                    </button>
                  </div>

                  <div className="playlist-list">
                    {shownPlaylists.map((playlist) => (
                      <button
                        key={playlist.id}
                        type="button"
                        className={`playlist-row ${selectedId === playlist.id ? 'selected' : ''}`}
                        onClick={() => choosePlaylist(playlist)}
                        aria-pressed={selectedId === playlist.id}
                      >
                        <span className="playlist-art">
                          {playlist.image ? (
                            <img
                              src={playlist.image}
                              alt=""
                              loading="lazy"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : null}
                          <span className="playlist-art-fallback">
                            <SiSpotify aria-hidden="true" />
                          </span>
                        </span>
                        <span className="playlist-info">
                          <span className="playlist-title-line">
                            <strong>{playlist.name}</strong>
                            {playlist.isOwner ? (
                              <span className="tag-badge tag-mine">You</span>
                            ) : (
                              <span className="tag-badge tag-followed">Followed</span>
                            )}
                          </span>
                          <span>
                            {playlist.count == null ? 'Items verified at transfer' : `${playlist.count} tracks`} · by {playlist.owner}
                          </span>
                        </span>
                        <span className="playlist-check">
                          {selectedId === playlist.id ? <FiCheck aria-hidden="true" /> : <FiArrowRight aria-hidden="true" />}
                        </span>
                      </button>
                    ))}
                    {!playlistsLoading && shownPlaylists.length === 0 && (
                      <p className="list-empty">{playlistQuery ? 'No playlists match your search.' : 'No playlists found in this category.'}</p>
                    )}
                    {playlistsLoading && <p className="list-empty">Loading playlists…</p>}
                  </div>
                  {nextOffset !== null && (
                    <button className="load-more" disabled={playlistsLoading} onClick={() => loadPlaylists(nextOffset)}>
                      Load more playlists <FiChevronDown aria-hidden="true" />
                    </button>
                  )}
                </div>
              ) : <div className="locked-step">Connect Spotify to see your playlists.</div>}
            </div>

            <div className="workflow-side">
              <div className="destination-card">
                <div className="step-heading"><span className="step-number">03</span><div><h3>Choose a destination</h3><p>Your copy stays off your public profile. Anyone with its link can view it until you choose “Make private” in Spotify.</p></div></div>
                <label className={`destination-option ${!useSecondAccount ? 'active' : ''}`}>
                  <input type="radio" name="destination" checked={!useSecondAccount} onChange={() => chooseDestination(false)} />
                  <span className="radio-ui" />
                  <span><strong>Same Spotify account</strong><small>Create a new playlist here</small></span>
                </label>
                <label className={`destination-option ${useSecondAccount ? 'active' : ''}`}>
                  <input type="radio" name="destination" checked={useSecondAccount} onChange={() => chooseDestination(true)} />
                  <span className="radio-ui" />
                  <span><strong>Another Spotify account</strong><small>Connect the account receiving it</small></span>
                </label>
                {useSecondAccount && <Account
                  label="DESTINATION ACCOUNT"
                  account={session.destination}
                  onConnect={() => connect('destination')}
                  onDisconnect={() => disconnect('destination')}
                  disabled={sessionLoading || !session.configured}
                  buttonText="Connect"
                />}
              </div>

              <form className="transfer-card" onSubmit={startTransfer}>
                <div className="transfer-card-top">
                  <span className="eyebrow">{selectedIsEmpty ? 'EMPTY PLAYLIST' : 'READY TO COPY'}</span>
                  <SiSpotify aria-hidden="true" />
                </div>

                {selected ? (
                  <div className="selected-preview-card">
                    <div className="selected-art-box">
                      {selected.id === 'liked-songs' ? (
                        <div className="liked-art-sq">♥</div>
                      ) : selected.image ? (
                        <img src={selected.image} alt={selected.name} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      ) : null}
                      <span className="art-sq-fallback"><SiSpotify /></span>
                    </div>
                    <div className="selected-text-box">
                      <h3>{selected.name}</h3>
                      <div className="selected-meta-tags">
                        <span className="meta-pill">{selected.count == null ? 'Ready to transfer' : `${selected.count} tracks`}</span>
                        <span className="meta-pill">by {selected.owner}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="no-selection-preview">
                    <h3>Your playlist</h3>
                    <p>Choose a playlist to see it here.</p>
                  </div>
                )}

                {selected && (
                  <div className="transfer-route-box">
                    <div className="route-step">
                      <span className="route-sub">SOURCE</span>
                      <strong className="route-name">{session.source?.name}</strong>
                    </div>
                    <div className="route-connector"><FiArrowRight /></div>
                    <div className="route-step">
                      <span className="route-sub">DESTINATION</span>
                      <strong className="route-name">{useSecondAccount ? (session.destination?.name || 'Second account') : `${session.source?.name} (New)`}</strong>
                    </div>
                  </div>
                )}

                {selected && (
                  <a className="source-link" href={selected.url} target="_blank" rel="noreferrer">
                    <SiSpotify aria-hidden="true" /> View original in Spotify <FiExternalLink aria-hidden="true" />
                  </a>
                )}

                <label className="name-label" htmlFor="new-name">New playlist name</label>
                <input
                  id="new-name"
                  className="name-input"
                  maxLength={100}
                  required
                  value={newName}
                  onChange={(event) => { setNewName(event.target.value); writeSessionItem('playlist-port.name', event.target.value); }}
                  placeholder="Select a playlist first"
                  disabled={!selected || transferring}
                />

                <button
                  className={`transfer-button ${transferring ? 'transferring' : ''}`}
                  type="submit"
                  disabled={!session.configured || !selected || selectedIsEmpty || !newName.trim() || (useSecondAccount && !session.destination) || transferring}
                >
                  {transferring ? (
                    <>
                      <span className="inline-spinner" />
                      <span>Copying tracks & verifying…</span>
                    </>
                  ) : selectedIsEmpty ? (
                    'Playlist is empty'
                  ) : (
                    <>
                      <span>Copy playlist</span>
                      <FiArrowRight aria-hidden="true" />
                    </>
                  )}
                </button>
                {selected && useSecondAccount && !session.destination && (
                  <p className="transfer-guidance">Connect the destination account above to enable copying.</p>
                )}
                <span className="transfer-footnote"><FiShield aria-hidden="true" /> Original playlist stays untouched</span>
              </form>
            </div>
          </div>

          {result && (
            <div className="success-card" role="status">
              <div className="success-icon"><FiCheckCircle aria-hidden="true" /></div>
              <div className="success-body">
                <span className="eyebrow">TRANSFER COMPLETE</span>
                <h3>{result.name} is ready!</h3>
                <p>{result.copied} tracks successfully copied{result.skipped ? ` · ${result.skipped} unavailable or local items skipped` : ''}.</p>
                <div className="success-btn-group">
                  <a href={result.url} target="_blank" rel="noreferrer" className="success-btn-primary">
                    <SiSpotify aria-hidden="true" /> Open in Spotify <FiExternalLink aria-hidden="true" />
                  </a>
                  <button
                    type="button"
                    className="success-btn-secondary"
                    onClick={() => {
                      if (navigator?.clipboard?.writeText) {
                        navigator.clipboard.writeText(result.url);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2500);
                      }
                    }}
                  >
                    {copiedLink ? <><FiCheck /> Copied!</> : <><FiCopy /> Copy Link</>}
                  </button>
                  <button
                    type="button"
                    className="success-btn-tertiary"
                    onClick={() => {
                      setResult(null);
                      setSelectedId('');
                      removeSessionItem('playlist-port.selected');
                      workflowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                  >
                    <FiRefreshCw /> Transfer another
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="site-footer content-width"><span className="brand footer-brand"><span className="brand-mark"><FiLink2 aria-hidden="true" /></span> playlist<span className="brand-light">port</span></span><span>Made for moving playlists, one service at a time.</span><span>Spotify account required · Not affiliated with Spotify</span></footer>
    </div>
  );
}
