const SCORE_STORAGE_KEY = 'ruvy-runner.score-history.v1'
const SCORE_LIMIT = 5

export type ScoreMode = 'solo' | 'local-duo' | 'online-duo'

export type ScoreRecord = {
  score: number
  mode: ScoreMode
  playedAt: number
}

function isScoreRecord(value: unknown): value is ScoreRecord {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<ScoreRecord>
  return typeof candidate.score === 'number' && Number.isFinite(candidate.score) &&
    typeof candidate.playedAt === 'number' && Number.isFinite(candidate.playedAt) &&
    (candidate.mode === 'solo' || candidate.mode === 'local-duo' || candidate.mode === 'online-duo')
}

/** Reads the local, device-only score board without allowing malformed storage to break the game. */
export function loadScoreHistory(): ScoreRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(SCORE_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter(isScoreRecord).sort((a, b) => b.score - a.score || b.playedAt - a.playedAt).slice(0, SCORE_LIMIT)
      : []
  } catch {
    return []
  }
}

/** Saves a completed run locally and returns the current top-five board. */
export function saveScore(score: number, mode: ScoreMode): ScoreRecord[] {
  if (!Number.isFinite(score) || score <= 0 || typeof window === 'undefined') return loadScoreHistory()
  const records = [{ score: Math.floor(score), mode, playedAt: Date.now() }, ...loadScoreHistory()]
    .sort((a, b) => b.score - a.score || b.playedAt - a.playedAt)
    .slice(0, SCORE_LIMIT)
  try {
    window.localStorage.setItem(SCORE_STORAGE_KEY, JSON.stringify(records))
  } catch {
    // Private mode or a full quota should not prevent the run from ending normally.
  }
  return records
}

export function getSavedBest(): number {
  return loadScoreHistory()[0]?.score ?? 0
}
