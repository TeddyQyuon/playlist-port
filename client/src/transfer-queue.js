// Empty sources are terminal outcomes for one playlist, not for the whole queue.
export async function transferQueue({ playlists, transfer, onActive, onResult, shouldCancel }) {
  const results = [];
  const completed = [];
  const skipped = [];
  let error = null;

  for (const [index, playlist] of playlists.entries()) {
    if (shouldCancel()) break;
    onActive(index);
    try {
      const result = await transfer(playlist);
      completed.push(result);
      results.push(result);
    } catch (failure) {
      if (failure.status === 422 && ['EMPTY_PLAYLIST', 'NO_TRANSFERABLE_ITEMS'].includes(failure.code)) {
        const result = { id: playlist.id, name: playlist.name, status: 'skipped', message: failure.message };
        skipped.push(result);
        results.push(result);
      } else {
        error = failure;
        results.push(failure.partial || { status: 'failed', message: failure.message });
        onResult([...results]);
        break;
      }
    }
    onResult([...results]);
  }

  return { completed, skipped, error, cancelled: shouldCancel() };
}
