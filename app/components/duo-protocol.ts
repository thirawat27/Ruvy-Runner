/** Transport and gameplay messages shared by the page and canvas runner. */
export interface ChannelLike {
  postMessage(data: unknown): void
  onmessage: ((e: MessageEvent) => void) | null
  addEventListener(type: string, listener: (e: MessageEvent) => void): void
  removeEventListener(type: string, listener: (e: MessageEvent) => void): void
  close(): void
}

export interface DuoConfig {
  mode: 'local' | 'tab' | 'rtc'
  slot?: 1 | 2
  channel?: ChannelLike | null
  /** A room-derived seed makes hazards deterministic on both peers. */
  seed?: string
}

export type DuoAction =
  | { type: 'duo-action'; action: 'start' | 'reset' | 'pause' | 'down' }
  | { type: 'duo-action'; action: 'shoot'; y: number; owner: 1 | 2 }

export type RunnerStateMessage = {
  type: 'runner-state'
  slot: 1 | 2
  y: number
  onGround: boolean
  ducking: boolean
  ammo: number
  score: number
  alive: boolean
}

export function isDuoAction(message: unknown): message is DuoAction {
  if (typeof message !== 'object' || message === null) return false
  const candidate = message as Partial<DuoAction>
  if (candidate.type !== 'duo-action') return false
  if (candidate.action === 'start' || candidate.action === 'reset' || candidate.action === 'pause' || candidate.action === 'down') {
    return true
  }
  return candidate.action === 'shoot' &&
    typeof (candidate as { y?: unknown }).y === 'number' && Number.isFinite((candidate as { y: number }).y) &&
    ((candidate as { owner?: unknown }).owner === 1 || (candidate as { owner?: unknown }).owner === 2)
}

export function isRunnerStateMessage(message: unknown): message is RunnerStateMessage {
  if (typeof message !== 'object' || message === null) return false
  const candidate = message as Partial<RunnerStateMessage>
  return candidate.type === 'runner-state' &&
    (candidate.slot === 1 || candidate.slot === 2) &&
    typeof candidate.y === 'number' && Number.isFinite(candidate.y) &&
    typeof candidate.onGround === 'boolean' &&
    typeof candidate.ducking === 'boolean' &&
    typeof candidate.ammo === 'number' && Number.isFinite(candidate.ammo) &&
    typeof candidate.score === 'number' && Number.isFinite(candidate.score) &&
    typeof candidate.alive === 'boolean'
}
