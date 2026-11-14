const STORAGE_KEY = 'bounceback-tour-scores';
let memoryScores = [];

export function loadScores() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryScores = parsed
          .filter(item => item && typeof item === 'object')
          .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))
          .slice(0, 10);
      }
    }
  } catch (e) {}
  return memoryScores.map(item => ({ ...item }));
}

export function saveScore(entry) {
  const current = loadScores();
  const item = {
    name: String(entry.name || 'CROWD').trim().slice(0, 12),
    score: Number(entry.score) || 0,
    venue: String(entry.venue || ''),
    date: entry.date || new Date().toISOString().slice(0, 10)
  };

  current.push(item);
  current.sort((a, b) => b.score - a.score);

  const rank = current.indexOf(item);
  if (rank >= 0 && rank < 10) {
    memoryScores = current.slice(0, 10);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryScores));
    } catch (e) {}
    return rank;
  }

  return -1;
}

export function clearScores() {
  memoryScores = [];
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
}
