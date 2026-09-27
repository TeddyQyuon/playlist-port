import { useEffect, useRef, useState } from 'react';
import { SiApplemusic, SiDeezer, SiSpotify, SiTidal, SiYoutube, SiYoutubemusic } from 'react-icons/si';
import {
  FiArrowRight, FiCheck, FiCheckCircle, FiChevronDown, FiExternalLink,
  FiInfo, FiLink2, FiSearch, FiShield, FiX
} from 'react-icons/fi';
import { api } from './api.js';

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
  const [selectedId, setSelectedId] = useState(() => sessionStorage.getItem('playlist-port.selected') || '');
  const [newName, setNewName] = useState(() => sessionStorage.getItem('playlist-port.name') || '');
  const [useSecondAccount, setUseSecondAccount] = useState(() => sessionStorage.getItem('playlist-port.second') === 'true');
  const [error, setError] = useState('');
  const [partial, setPartial] = useState(null);
  const [result, setResult] = useState(null);
  const [transferring, setTransferring] = useState(false);
  const workflowRef = useRef(null);
  const transferLock = useRef(false);

  const selected = playlists.find((playlist) => playlist.id === selectedId);
  const selectedIsEmpty = selected?.count === 0;
  const shownServices = services.filter((service) => service.name.toLowerCase().includes(serviceQuery.toLowerCase()));
  const shownPlaylists = playlists.filter((playlist) => playlist.name.toLowerCase().includes(playlistQuery.toLowerCase()));

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
        sessionStorage.removeItem('playlist-port.selected');
        setResult(null);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  function choosePlaylist(playlist) {
    setSelectedId(playlist.id);
    sessionStorage.setItem('playlist-port.selected', playlist.id);
    const name = `${playlist.name} (copy)`;
    setNewName(name.slice(0, 100));
    sessionStorage.setItem('playlist-port.name', name.slice(0, 100));
    setError('');
    setPartial(null);
    setResult(null);
  }

  function chooseDestination(second) {
    setUseSecondAccount(second);
    sessionStorage.setItem('playlist-port.second', String(second));
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
          <p>Choose your music service, connect Spotify, and make a private copy of your playlist in the same account or another one.</p>
          <div className="intro-meta"><FiShield aria-hidden="true" /> Your playlists stay on Spotify. Nothing is deleted.</div>
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
                className={`service-card ${ready ? 'service-ready' : 'service-later'}`}
                onClick={ready ? () => workflowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : undefined}
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

        <section className="workspace" ref={workflowRef} aria-labelledby="workspace-title">
          <div className="workspace-title-row">
            <div>
              <span className="eyebrow">SPOTIFY → SPOTIFY</span>
              <h2 id="workspace-title">Make your first move.</h2>
              <p>Copy a playlist into this account or another Spotify account.</p>
            </div>
            <div className="workspace-stamp"><SiSpotify aria-hidden="true" /> SPOTIFY</div>
          </div>

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
              <div className="step-heading"><span className="step-number">01</span><div><h3>Connect your account</h3><p>Spotify asks for playlist and profile access.</p></div></div>
              <Account
                label="SOURCE ACCOUNT"
                account={session.source}
                onConnect={() => connect('source')}
                onDisconnect={() => disconnect('source')}
                disabled={sessionLoading || !session.configured}
              />

              <div className="step-heading second-step"><span className="step-number">02</span><div><h3>Choose a playlist</h3><p>Only playlists you own or collaborate on appear.</p></div></div>
              {session.source ? (
                <div className="playlist-panel">
                  <label className="search-field playlist-search"><FiSearch aria-hidden="true" /><span className="sr-only">Search loaded playlists</span><input value={playlistQuery} onChange={(event) => setPlaylistQuery(event.target.value)} placeholder="Search your playlists" /></label>
                  <div className="playlist-list">
                    {shownPlaylists.map((playlist) => (
                      <button key={playlist.id} className={`playlist-row ${selectedId === playlist.id ? 'selected' : ''}`} onClick={() => choosePlaylist(playlist)} aria-pressed={selectedId === playlist.id}>
                        <span className="playlist-art"><SiSpotify aria-hidden="true" /></span>
                        <span className="playlist-info"><strong>{playlist.name}</strong><span>{playlist.count == null ? 'Item count unavailable' : `${playlist.count} items`} · by {playlist.owner}</span></span>
                        <span className="playlist-check">{selectedId === playlist.id ? <FiCheck aria-hidden="true" /> : <FiArrowRight aria-hidden="true" />}</span>
                      </button>
                    ))}
                    {!playlistsLoading && shownPlaylists.length === 0 && <p className="list-empty">{playlistQuery ? 'No loaded playlists match this search.' : 'No transferable playlists on this account.'}</p>}
                    {playlistsLoading && <p className="list-empty">Loading playlists…</p>}
                  </div>
                  {nextOffset !== null && <button className="load-more" disabled={playlistsLoading} onClick={() => loadPlaylists(nextOffset)}>Load more playlists <FiChevronDown aria-hidden="true" /></button>}
                </div>
              ) : <div className="locked-step">Connect Spotify to see your playlists.</div>}
            </div>

            <div className="workflow-side">
              <div className="destination-card">
                <div className="step-heading"><span className="step-number">03</span><div><h3>Choose a destination</h3><p>Your copy will be private.</p></div></div>
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
                <div className="transfer-card-top"><span className="eyebrow">{selectedIsEmpty ? 'EMPTY PLAYLIST' : 'READY TO COPY'}</span><SiSpotify aria-hidden="true" /></div>
                <h3>{selected ? selected.name : 'Your playlist'}</h3>
                <p>{selectedIsEmpty ? 'Choose a playlist with tracks or episodes. An empty playlist cannot be copied.' : selected ? selected.count == null ? 'Items will be checked when you copy.' : `${selected.count} items ready to transfer` : 'Choose a playlist to see it here.'}</p>
                {selected && <a className="source-link" href={selected.url} target="_blank" rel="noreferrer"><SiSpotify aria-hidden="true" /> View original in Spotify <FiExternalLink aria-hidden="true" /></a>}
                <label className="name-label" htmlFor="new-name">New playlist name</label>
                <input id="new-name" className="name-input" maxLength={100} required value={newName} onChange={(event) => { setNewName(event.target.value); sessionStorage.setItem('playlist-port.name', event.target.value); }} placeholder="Select a playlist first" disabled={!selected || transferring} />
                <button className="transfer-button" type="submit" disabled={!session.configured || !selected || selectedIsEmpty || !newName.trim() || (useSecondAccount && !session.destination) || transferring}>
                  {transferring ? 'Copying your playlist…' : selectedIsEmpty ? 'Playlist is empty' : 'Copy playlist'}
                  {!transferring && <FiArrowRight aria-hidden="true" />}
                </button>
                <span className="transfer-footnote"><FiShield aria-hidden="true" /> Original playlist stays untouched</span>
              </form>
            </div>
          </div>

          {result && <div className="success-card" role="status"><div className="success-icon"><FiCheckCircle aria-hidden="true" /></div><div><span className="eyebrow">TRANSFER COMPLETE</span><h3>{result.name} is ready.</h3><p>{result.copied} items copied{result.skipped ? ` · ${result.skipped} unavailable or local items skipped` : ''}.</p></div><a href={result.url} target="_blank" rel="noreferrer">Open in Spotify <FiExternalLink aria-hidden="true" /></a></div>}
        </section>
      </main>

      <footer className="site-footer content-width"><span className="brand footer-brand"><span className="brand-mark"><FiLink2 aria-hidden="true" /></span> playlist<span className="brand-light">port</span></span><span>Made for moving playlists, one service at a time.</span><span>Spotify account required · Not affiliated with Spotify</span></footer>
    </div>
  );
}
