import { useState } from 'react';
import { FiCheck, FiChevronDown, FiChevronLeft, FiChevronRight, FiInfo, FiMusic, FiRefreshCw, FiSearch } from 'react-icons/fi';
import './transfer-progress.css';

const PAGE_SIZE = 6;

function statusFor(result, index, activeIndex) {
  if (result?.status === 'skipped') return 'skipped';
  if (result?.status === 'failed') return 'failed';
  if (result) return 'done';
  return index === activeIndex ? 'active' : 'queued';
}

export default function TransferProgress({ playlists, activeIndex, results, elapsed, destination, cancelRequested, onCancel, Art }) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const rows = playlists.map((playlist, index) => ({ playlist, index, result: results[index], status: statusFor(results[index], index, activeIndex) }));
  const counts = rows.reduce((all, row) => ({ ...all, [row.status]: (all[row.status] || 0) + 1 }), {});
  const finished = (counts.done || 0) + (counts.skipped || 0);
  const percent = playlists.length ? Math.round(finished / playlists.length * 100) : 0;
  const active = playlists[activeIndex];
  const copied = results.reduce((sum, result) => sum + (result.copied || 0), 0);
  const filtered = rows.filter((row) => (filter === 'all' || row.status === filter) && row.playlist.name.toLowerCase().includes(query.trim().toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const filters = [['all', 'All', playlists.length], ['queued', 'Queued', counts.queued || 0], ['done', 'Done', counts.done || 0], ['skipped', 'Skipped', counts.skipped || 0], ...(counts.failed ? [['failed', 'Failed', counts.failed]] : [])];

  return (
    <section className="transfer-monitor" aria-labelledby="transfer-monitor-title">
      <div className="transfer-monitor-summary">
        <div className="transfer-monitor-heading">
          <div>
            <span className="eyebrow">TRANSFER IN PROGRESS</span>
            <h3 id="transfer-monitor-title">{cancelRequested ? 'Finishing current playlist' : 'Moving your music'}</h3>
          </div>
          <button type="button" className="transfer-stop" disabled={cancelRequested} onClick={onCancel}>
            {cancelRequested ? 'Stopping…' : 'Cancel transfer'}
          </button>
        </div>
        <div className="transfer-monitor-counts" role="status" aria-live="polite" aria-atomic="true">
          <strong>{finished} of {playlists.length} playlists processed</strong>
          <span>{percent}%</span>
        </div>
        <div className="transfer-meter" role="progressbar" aria-label="Playlists processed" aria-valuemin={0} aria-valuemax={playlists.length} aria-valuenow={finished}>
          <span style={{ width: `${percent}%` }} />
        </div>
        <div className="transfer-monitor-meta">
          <span>{copied.toLocaleString()} tracks copied</span>
          <span>Elapsed {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</span>
        </div>
        <p className="transfer-destination">To <strong title={destination}>{destination}</strong></p>
      </div>

      {active && (
        <div className="transfer-now" role="status" aria-live="polite" aria-atomic="true">
          <span className="transfer-now-label"><FiRefreshCw className="spin" aria-hidden="true" /> Playlist {activeIndex + 1} of {playlists.length}</span>
          <div className="transfer-now-content">
            {Art ? <Art playlist={active} className="transfer-cover" /> : <FiMusic aria-hidden="true" />}
            <div>
              <strong className="transfer-now-title" title={active.name}>{active.name}</strong>
              <span>{active.count == null ? 'Reading tracks, copying and verifying order' : `${active.count.toLocaleString()} tracks · Copying and verifying order`}</span>
            </div>
          </div>
        </div>
      )}

      <p className="transfer-open-note"><FiInfo aria-hidden="true" /><span>{cancelRequested ? 'The transfer will stop after the current playlist. Copies already made will stay saved.' : 'Keep this tab open until the transfer finishes.'}</span></p>

      <button type="button" className="transfer-queue-toggle" aria-expanded={expanded} aria-controls="transfer-queue-details" onClick={() => setExpanded(!expanded)}>
        <span><strong>{expanded ? 'Hide playlist queue' : 'View playlist queue'}</strong><span>{counts.done || 0} done · {counts.queued || 0} queued · {counts.skipped || 0} skipped</span></span>
        <FiChevronDown aria-hidden="true" />
      </button>

      <div id="transfer-queue-details" hidden={!expanded}>
        {expanded && (
          <div className="transfer-queue-details">
            <div className="transfer-queue-filters" role="group" aria-label="Filter transfer queue">
              {filters.map(([id, label, count]) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => { setFilter(id); setPage(0); }}>{label} <span>{count}</span></button>)}
            </div>
            <label className="transfer-queue-search">
              <FiSearch aria-hidden="true" />
              <input type="search" aria-label="Search transfer queue" placeholder="Find a playlist" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} />
            </label>
            <ul className="transfer-queue-rows" aria-label="Playlist queue">
              {visible.map(({ playlist, index, result, status }) => (
                <li key={playlist.id} className={`transfer-queue-row is-${status}`}>
                  <span className="transfer-queue-number">{index + 1}</span>
                  <div className="transfer-queue-copy">
                    <strong title={playlist.name}>{playlist.name}</strong>
                    <span title={result?.message}>{status === 'skipped' || status === 'failed' ? result.message : status === 'done' ? `${result.copied || 0} tracks copied${result.verified ? ' · Verified' : ''}` : playlist.count == null ? 'Track count checked during transfer' : `${playlist.count.toLocaleString()} tracks`}</span>
                  </div>
                  <span className="transfer-queue-status">{status === 'done' && <FiCheck aria-hidden="true" />}{status === 'active' && <FiRefreshCw className="spin" aria-hidden="true" />}{status === 'active' ? 'Copying' : status.charAt(0).toUpperCase() + status.slice(1)}</span>
                </li>
              ))}
            </ul>
            {!visible.length && <p className="transfer-queue-empty">{query ? 'No playlists match your search.' : `No ${filter === 'all' ? '' : `${filter} `}playlists yet.`}</p>}
            <nav className="transfer-queue-pagination" aria-label="Transfer queue pages">
              <span>{filtered.length ? `${currentPage * PAGE_SIZE + 1}-${Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} of ${filtered.length}` : '0 playlists'}</span>
              <button type="button" aria-label="Previous queue page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><FiChevronLeft aria-hidden="true" /></button>
              <span>Page {currentPage + 1} of {pages}</span>
              <button type="button" aria-label="Next queue page" disabled={currentPage === pages - 1} onClick={() => setPage(currentPage + 1)}><FiChevronRight aria-hidden="true" /></button>
            </nav>
          </div>
        )}
      </div>
    </section>
  );
}
