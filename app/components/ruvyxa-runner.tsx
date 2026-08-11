'use client'

import { useEffect, useRef } from 'react'
import {
  type DuoConfig,
  type DuoAction,
  isDuoAction,
  isRunnerStateMessage,
} from './duo-protocol'
import { getSavedBest, saveScore, type ScoreMode } from './score-storage'

export type { DuoConfig } from './duo-protocol'

// Broadcast game state to the React HUD in page.tsx
function emit(detail: Record<string, unknown>) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ruvy-state', { detail }))
  }
}

/** Produces a stable room-specific random stream so online peers generate identical hazards. */
function createSeededRandom(seed: string) {
  let value = 2166136261
  for (let index = 0; index < seed.length; index++) {
    value = Math.imul(value ^ seed.charCodeAt(index), 16777619)
  }
  return () => {
    value += 0x6d2b79f5
    let mixed = value
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

const WIDTH = 760
const HEIGHT = 240
const GROUND_Y = 196
const PIXEL = 3
const GRAVITY = 0.55
const JUMP_VELOCITY = -10.5
const MAX_AMMO = 3
const AMMO_REGEN = 70

const INK = '#171717'
const ACCENT = '#7c3aed'
const SPRITE_COLOR = '#8b5cf6'
const SPRITE_COLOR_2 = '#f97316'  // P2 orange
const ACCENT_2 = '#fb923c'
const MUTED = '#a3a3a3'
const FAINT = '#e5e5e5'

// 8x8 Ruvyxa octopus runner: black eyes, a uniform purple body, and four swaying tentacles.
const RUNNER_SPRITE = [
  '00111100',
  '01111110',
  '11K11K11',
  '01111110',
  '00111100',
  '11111111',
  '10100101',
  '01011010',
]

// Lift one inner tentacle while the opposite side stays planted.
const RUNNER_SPRITE_STEP_LEFT = [
  '00111100',
  '01111110',
  '11K11K11',
  '01111110',
  '00111100',
  '11111111',
  '10100101',
  '10010101',
]

const RUNNER_SPRITE_STEP_RIGHT = [
  '00111100',
  '01111110',
  '11K11K11',
  '01111110',
  '00111100',
  '11111111',
  '10100101',
  '10101001',
]

const RUNNER_FRAMES = [
  RUNNER_SPRITE,
  RUNNER_SPRITE_STEP_LEFT,
  RUNNER_SPRITE,
  RUNNER_SPRITE_STEP_RIGHT,
]

// Crouched octopus pose — same eyes, body color, and four tentacles in a shorter hitbox.
const RUNNER_DUCK = ['0011111000', '011K11K110', '1111111110', '0111111100', '0101010100']

// Obstacles are scenery hazards, not characters, so they stay on a single static frame.
// Ground bugs — five silhouettes so a run never looks like the same three shapes repeating.
const BUG_SPRITES = [
  ['011010', '111111', '011110', '111111', '010010', '101101'],
  ['0110110', '1111111', '0111110', '1111111', '0100010', '1011101'],
  ['01101100', '11111110', '01111100', '11111110', '01000100', '10111011'],
  ['1010101', '0111110', '1111111', '0111110', '1010101'],
  ['00111100', '01111110', '11111111', '01111110', '10100101'],
]

// Flying errors — winged, forces a duck.
const ERROR_SPRITES = [
  ['10011001', '11011011', '01111110', '11111111', '01A11A10', '00100100'],
  ['01000010', '11011011', '01111110', '11A11A11', '01111110', '00100100'],
  ['10000001', '11100111', '01111110', '11A11A11', '01111110', '01011010'],
]

// Tall malware blocks — forces a jump.
const MALWARE_SPRITES = [
  ['011110', '111111', '1A11A1', '111111', '010010', '111111', '101101', '010010'],
  ['011110', '111111', '1A11A1', '111111', '111111', '101101', '111111', '010010'],
  [
    '0111110',
    '1111111',
    '11A1A11',
    '1111111',
    '0111110',
    '1111111',
    '1011101',
    '0111110',
    '0100010',
  ],
]

// Bosses. Every boss runs a four-frame loop; the frames are listed in playback order.

// Hooded hacker: hands work the keyboard while the visor flickers.
const HACKER_FRAMES = [
  [
    '0011111100',
    '0111111110',
    '1110000111',
    '110A00A011',
    '1110000111',
    '0111111110',
    '0011111100',
    '0111111110',
    '0110000110',
    '0100000010',
  ],
  [
    '0011111100',
    '0111111110',
    '1110000111',
    '110A00A011',
    '1110000111',
    '0111111110',
    '0011111100',
    '0111111110',
    '0110000110',
    '0010000100',
  ],
  [
    '0011111100',
    '0111111110',
    '1110000111',
    '1100000011',
    '111A00A111',
    '0111111110',
    '0011111100',
    '0111111110',
    '0110000110',
    '0100000010',
  ],
  [
    '0011111100',
    '0111111110',
    '1110000111',
    '110A00A011',
    '1110000111',
    '0111111110',
    '0011111100',
    '0111111110',
    '0110000110',
    '0011000110',
  ],
]

// Human error: a figure throwing its arms up mid-mistake.
const HUMAN_ERROR_FRAMES = [
  [
    '0001111000',
    '0011AA1100',
    '0011AA1100',
    '0001111000',
    '1001111001',
    '1111111111',
    '0011111100',
    '0001111000',
    '0011001100',
    '0110000110',
  ],
  [
    '1000000001',
    '1001111001',
    '0011AA1100',
    '0011AA1100',
    '0001111000',
    '0111111110',
    '0011111100',
    '0001111000',
    '0011001100',
    '0110000110',
  ],
  [
    '0001111000',
    '0011AA1100',
    '0011AA1100',
    '0001111000',
    '0111111110',
    '1111111111',
    '0011111100',
    '0001111000',
    '0110000110',
    '1100001100',
  ],
  [
    '0001111000',
    '0011AA1100',
    '0011AA1100',
    '0001111000',
    '0111111110',
    '0111111110',
    '1011111101',
    '1001111001',
    '0011001100',
    '0110000110',
  ],
]

// Virus: a spiked capsid whose spikes rotate around the core.
const VIRUS_FRAMES = [
  [
    '0001001000',
    '0010110100',
    '0101111010',
    '1011111101',
    '0111AA1110',
    '0111AA1110',
    '1011111101',
    '0101111010',
    '0010110100',
    '0001001000',
  ],
  [
    '0000110000',
    '0011111100',
    '0111111110',
    '1111111111',
    '1111AA1111',
    '1111AA1111',
    '1111111111',
    '0111111110',
    '0011111100',
    '0000110000',
  ],
  [
    '0010000100',
    '0101111010',
    '0011111100',
    '0111111110',
    '1111AA1111',
    '1111AA1111',
    '0111111110',
    '0011111100',
    '0101111010',
    '0010000100',
  ],
  [
    '0001001000',
    '0010110100',
    '1101111011',
    '0111111110',
    '0111AA1110',
    '0111AA1110',
    '0111111110',
    '1101111011',
    '0010110100',
    '0001001000',
  ],
]

// System glitch: a monitor whose scanlines tear sideways.
const SYSTEM_GLITCH_FRAMES = [
  [
    '1111111111',
    '1000000001',
    '1011111101',
    '1010A0A101',
    '1011111101',
    '1000000001',
    '1111111111',
    '0001111000',
    '0001111000',
    '0111111110',
  ],
  [
    '1111111111',
    '1000000001',
    '0110111110',
    '1010A0A101',
    '1111011011',
    '1000000001',
    '1111111111',
    '0001111000',
    '0001111000',
    '0111111110',
  ],
  [
    '1111111111',
    '1000000001',
    '1011111101',
    '0101A0A110',
    '1011111101',
    '1000000001',
    '1111111111',
    '0001111000',
    '0001111000',
    '0111111110',
  ],
  [
    '1111111111',
    '1000000001',
    '1101111011',
    '1010A0A101',
    '0111110111',
    '1000000001',
    '1111111111',
    '0001111000',
    '0001111000',
    '0111111110',
  ],
]

// Hardware fault: a chip with pins that spark on and off.
const HARDWARE_FAULT_FRAMES = [
  [
    '0010010100',
    '0111111110',
    '1100000011',
    '1101111011',
    '110A00A011',
    '1101111011',
    '1100000011',
    '0111111110',
    '0010010100',
  ],
  [
    '0100101000',
    '0111111110',
    '1100000011',
    '1101111011',
    '110A00A011',
    '1101111011',
    '1100000011',
    '0111111110',
    '0100101000',
  ],
  [
    '0010010100',
    '0111111110',
    '1100000011',
    '1101111011',
    '1100AA0011',
    '1101111011',
    '1100000011',
    '0111111110',
    '0010010100',
  ],
  [
    '0100101000',
    '0111111110',
    '1100000011',
    '1101111011',
    '110A00A011',
    '1101111011',
    '1100000011',
    '0111111110',
    '0001001010',
  ],
]

// Each boss bobs so its body crosses the runner's firing line at the bottom of the arc,
// otherwise a standing shot could never connect.
const BOSS_VARIANTS: BossVariant[] = [
  {
    label: 'HACKER',
    frames: HACKER_FRAMES,
    // Deep phosphor green with a brighter green visor glow — old CRT terminal look.
    color: '#14532d',
    accent: '#22c55e',
    hp: 3,
    spawnY: 148,
    targetX: 470,
    approachSpeed: 2.4,
    bobRate: 40,
    bobAmplitude: 16,
    fireInterval: 160,
    attack: 'burst',
  },
  {
    label: 'HUMAN ERROR',
    frames: HUMAN_ERROR_FRAMES,
    color: '#f59e0b',
    hp: 3,
    spawnY: 150,
    targetX: 500,
    approachSpeed: 2.2,
    bobRate: 30,
    bobAmplitude: 12,
    fireInterval: 140,
    attack: 'drift',
  },
  {
    label: 'VIRUS',
    frames: VIRUS_FRAMES,
    // Vivid magenta-pink capsid with a pale pink core.
    color: '#d61f8d',
    accent: '#f9a8d4',
    hp: 3,
    spawnY: 140,
    targetX: 450,
    approachSpeed: 2.6,
    bobRate: 26,
    bobAmplitude: 16,
    fireInterval: 150,
    attack: 'split',
  },
  {
    label: 'SYSTEM GLITCH',
    frames: SYSTEM_GLITCH_FRAMES,
    color: '#e11d48',
    hp: 3,
    spawnY: 146,
    targetX: 480,
    approachSpeed: 2.4,
    bobRate: 22,
    bobAmplitude: 14,
    fireInterval: 125,
    attack: 'flicker',
  },
  {
    label: 'HARDWARE FAULT',
    frames: HARDWARE_FAULT_FRAMES,
    color: '#0891b2',
    hp: 4,
    spawnY: 152,
    targetX: 505,
    approachSpeed: 2,
    bobRate: 46,
    bobAmplitude: 10,
    fireInterval: 150,
    attack: 'slab',
  },
]

const CLOUD_SPRITE = ['000111000', '011111110', '111111111', '011111110']
// A non-lethal priority packet. Shooting it feeds the short reward loop instead of adding
// another obstacle the player simply has to memorize.
const BOUNTY_SPRITE = ['000A000', '00AAA00', '0AAAAA0', '00AAA00', '000A000']

// Background palettes the run cycles through as score climbs. resolveTheme() holds each
// steady, then cross-fades into the next only in its final stretch, so the shift reads as
// gradual rather than a hard cut when the milestone hits.
type Theme = {
  skyTop: string
  skyBottom: string
  hill: string
  cloud: string
  ground: string
  pebble: string
  tower: string
  night: boolean
}

const THEMES: Theme[] = [
  {
    skyTop: '#eef2ff',
    skyBottom: '#ffffff',
    hill: '#e5e5e5',
    cloud: '#f4f4f5',
    ground: '#d4d4d4',
    pebble: '#a3a3a3',
    tower: '#e0e0e5',
    night: false,
  },
  {
    skyTop: '#fed7aa',
    skyBottom: '#fff1e6',
    hill: '#fdba74',
    cloud: '#fef3c7',
    ground: '#fb923c',
    pebble: '#c2620c',
    tower: '#fca85c',
    night: false,
  },
  {
    skyTop: '#1e1b4b',
    skyBottom: '#312e81',
    hill: '#4338ca',
    cloud: '#4f46e5',
    ground: '#818cf8',
    pebble: '#a5b4fc',
    tower: '#3730a3',
    night: true,
  },
  {
    skyTop: '#052e2b',
    skyBottom: '#0f766e',
    hill: '#115e59',
    cloud: '#2dd4bf',
    ground: '#5eead4',
    pebble: '#99f6e4',
    tower: '#134e4a',
    night: true,
  },
]

const THEME_STEP = 400

// Autopilot planner: how far ahead a committed action may be deferred, and which actions
// are worth deferring. Deferral has to cover a full jump arc (~38 frames) plus slack.
const AI_MAX_DELAY = 36
const AI_ACTIONS = ['duck', 'jump'] as const

// Tier rises with mastery (bosses beaten), raw distance (score), AND time played.
// From tier 3 onward a boss starts mixing in another variant's attack.
const BOSS_MIX_TIER = 3
// Score per distance-tier — halved from original for faster escalation.
const DISTANCE_TIER_STEP = 8_000
// Frames per time-tier (~2 min at 60 fps). Time alone pushes tier even if the
// player avoids bosses, preventing difficulty stagnation in long runs.
const TIME_TIER_FRAMES = 60 * 60 * 2   // 7 200 frames ≈ 2 minutes

// Accept frameCount so time-based tier works inside the useEffect closure.
function bossTier(score: number, bossesDefeated: number, frameCount: number) {
  return (
    bossesDefeated +
    Math.floor(score / DISTANCE_TIER_STEP) +
    Math.floor(frameCount / TIME_TIER_FRAMES)
  )
}

function scaleBoss(variant: BossVariant, tier: number) {
  return {
    // HP scales hard — bullet-sponge is fine because ammo regens during a fight.
    hp: variant.hp + Math.floor(tier * 1.8),
    // Minimum interval 40 frames (was 70) — bosses fire much faster at high tiers.
    fireInterval: Math.max(40, Math.round(variant.fireInterval - tier * 10)),
    // Boss rushes player more aggressively.
    approachSpeed: Math.min(variant.approachSpeed + tier * 0.25, variant.approachSpeed + 9),
    // Bullet speed cap raised to 3.5 (was 1.5) — fast enough to demand precision.
    shotSpeed: Math.min(3.5, tier * 0.32),
  }
}

// There is no finish line you can simply run at. Every objective has to be completed
// inside a single unbroken life — dying resets all of them, Dino-style.
//
// The targets are deliberately near-unreachable. At the pace a flawless run actually
// sustains, DISTANCE alone is on the order of ten hours of unbroken play, so in practice
// this behaves like the endless Dino game while still having a real terminal state.
const WIN_SCORE = 1_000_000
const WIN_BOSS_EACH = 50
const WIN_PURGE = 10_000
const WIN_OVERCLOCK = 500_000
const MAX_SPEED = 10

// `frame` only advances while unpaused and resets to 0 on death (see reset()), so this is
// a literal ten thousand hours of unbroken, un-paused play in one life — not accumulated
// across sessions. It is the real gate; the other four objectives are trivially satisfied
// long before a run gets anywhere near it.
const TEN_THOUSAND_HOURS_FRAMES = 10_000 * 60 * 60 * 60

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const lerpColor = (a: string, b: string, t: number) => {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  return `rgb(${Math.round(ar + (br - ar) * t)}, ${Math.round(ag + (bg - ag) * t)}, ${Math.round(ab + (bb - ab) * t)})`
}

function resolveTheme(score: number) {
  const idx = Math.floor(score / THEME_STEP) % THEMES.length
  const a = THEMES[idx]
  const b = THEMES[(idx + 1) % THEMES.length]
  const progress = (score % THEME_STEP) / THEME_STEP
  const t = Math.max(0, (progress - 0.7) / 0.3)
  return {
    skyTop: lerpColor(a.skyTop, b.skyTop, t),
    skyBottom: lerpColor(a.skyBottom, b.skyBottom, t),
    hill: lerpColor(a.hill, b.hill, t),
    cloud: lerpColor(a.cloud, b.cloud, t),
    ground: lerpColor(a.ground, b.ground, t),
    pebble: lerpColor(a.pebble, b.pebble, t),
    tower: lerpColor(a.tower, b.tower, t),
    nightLevel: (a.night ? 1 : 0) * (1 - t) + (b.night ? 1 : 0) * t,
  }
}

type ObstacleKind = 'bug' | 'error' | 'malware' | 'bounty'
type Obstacle = { x: number; y: number; sprite: string[]; kind: ObstacleKind; hp: number }
type Bolt = { x: number; y: number; owner?: 1 | 2 }
type ShotBehavior = 'straight' | 'drift' | 'split' | 'flicker'
type Shot = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  t: number
  behavior: ShotBehavior
  split: boolean
}
type Particle = { x: number; y: number; vx: number; vy: number; life: number }
// Every boss owns a different attack, so learning one fight never solves the next.
type BossAttack = 'burst' | 'drift' | 'split' | 'flicker' | 'slab'
type BossVariant = {
  label: string
  frames: string[][]
  color: string
  accent?: string
  hp: number
  spawnY: number
  targetX: number
  approachSpeed: number
  bobRate: number
  bobAmplitude: number
  fireInterval: number
  attack: BossAttack
}
type Boss = {
  x: number
  y: number
  hp: number
  maxHp: number
  t: number
  cooldown: number
  volley: number
  burst: number
  burstHigh: boolean
  animation: number
  sprite: string[]
  variant: BossVariant
  tier: number
  fireInterval: number
  approachSpeed: number
  shotSpeed: number
  attack: BossAttack
  phase: number
  hitChain: number
  hitChainTimer: number
  guardFrames: number
  /** Set to true when HP drops to ≤50 % — triggers rage-mode fire rate and approach. */
  enraged: boolean
}
type Scenery = {
  x: number
  kind: 'cloud' | 'hill' | 'pebble' | 'tower' | 'star' | 'bird'
  y: number
  size: number
}

export interface RuvyxaRunnerProps {
  duoConfig?: DuoConfig | null
}

export default function RuvyxaRunner({ duoConfig }: RuvyxaRunnerProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let running = true
    let started = false
    let gameOver = false
    let paused = false
    let score = 0
    let best = getSavedBest()
    let speed = 4.5
    let frame = 0
    let nextSpawnIn = 70
    let ammo = MAX_AMMO
    let ammoTick = 0
    let ducking = false
    let nextBossAt = 250
    let won = false
    let puzzleLines: string[] = []
    // Objective progress. All of it resets on death — that is what makes the win hard.
    let bossKills: Record<string, number> = {}
    let bossesDefeated = 0
    let purged = 0
    let overclockFrames = 0
    // Short-run variety: clearing targets in quick succession earns a forgiving shield
    // and a brief score surge. Both are derived only from shared projectile hits.
    let combo = 0
    let comboWindow = 0
    let shieldCharges = 0
    let surgeFrames = 0
    let invulnerableFrames = 0
    let rewardText = ''
    let rewardTimer = 0
    let nextBountyAt = 180
    // Boss-side learning: samples how the runner actually evades, so it can aim at the
    // habit instead of firing blind.
    let dodgeDuckFrames = 0
    let dodgeAirFrames = 0
    // Consecutive frames the runner has been crouching during this boss fight.
    // When this crosses a threshold the boss fires a low-lane punisher that MUST be jumped.
    let duckStreakFrames = 0
    let autoPlay = false
    let aiShotCooldown = 0
    let aiRestartTimer = 0
    // Persists across restarts on purpose — that is what makes the autopilot improve
    // run over run instead of repeating the same death.
    let aiCaution = 0
    let aiLastDeathScore = 0

    const runner = { x: 48, y: GROUND_Y - 8 * PIXEL, vy: 0, onGround: true }
    let obstacles: Obstacle[] = []
    let bolts: Bolt[] = []
    let shots: Shot[] = []
    let particles: Particle[] = []
    let boss: Boss | null = null
    let scenery: Scenery[] = []

    // ── DUO MODE variables ─────────────────────────────────────────────────
    const duo = duoConfig ?? null
    const isLocalDuo = duo?.mode === 'local'
    const isTabDuo   = duo?.mode === 'tab' || duo?.mode === 'rtc'
    const mySlot     = duo?.slot ?? 1

    // Online duo: each slot owns a lane. Without this both peers run at the default
    // x=48 while drawing the partner ghost at the *other* lane, so slot 2 renders its
    // own runner exactly on top of the ghost.
    if (isTabDuo && mySlot === 2) runner.x = 96

    // P2 runner (local duo — both runners share the same canvas and obstacles)
    const runner2 = { x: 96, y: GROUND_Y - 8 * PIXEL, vy: 0, onGround: true }
    let ducking2 = false
    let ammo2    = MAX_AMMO
    let ammoTick2 = 0
    let bolts2: Bolt[] = []

    // Tab duo: the partner's render state received via BroadcastChannel
    let remoteY      = GROUND_Y - 8 * PIXEL
    let remoteGround = true
    let remoteDuck   = false
    let remoteAmmo   = MAX_AMMO
    let remoteScore  = 0
    let remoteAlive  = true
    // Drives the outbound send rate on its own. `frame` stops advancing while paused,
    // which would pin `frame % 2` to a constant and make the throttle meaningless.
    let netTick      = 0
    const random = isTabDuo ? createSeededRandom(duo?.seed ?? 'ruvy-duo') : Math.random
    const scoreMode: ScoreMode = isLocalDuo ? 'local-duo' : isTabDuo ? 'online-duo' : 'solo'

    function sendDuoAction(action: DuoAction) {
      if (isTabDuo && duo?.channel) duo.channel.postMessage(action)
    }

    // Co-op keeps the original map but gives the pair more reaction time and bosses that
    // reward coordinated fire instead of turning a shared run into a punishment.
    if (isLocalDuo || isTabDuo) {
      speed = 3.9
      nextSpawnIn = 95
    }

    function seedScenery() {
      scenery = []
      for (let i = 0; i < 3; i++) {
        scenery.push({
          x: 120 + i * 260,
          kind: 'cloud',
          y: 26 + ((i * 17) % 30),
          size: 2 + (i % 2),
        })
      }
      for (let i = 0; i < 4; i++) {
        scenery.push({ x: 80 + i * 210, kind: 'hill', y: 0, size: 26 + ((i * 11) % 22) })
      }
      for (let i = 0; i < 10; i++) {
        scenery.push({ x: i * 78, kind: 'pebble', y: 0, size: 1 + (i % 3) })
      }
      for (let i = 0; i < 5; i++) {
        scenery.push({ x: i * 170, kind: 'tower', y: 0, size: 28 + ((i * 13) % 34) })
      }
      for (let i = 0; i < 14; i++) {
        scenery.push({
          x: random() * WIDTH,
          kind: 'star',
          y: 8 + random() * 70,
          size: 1 + random() * 1.5,
        })
      }
      for (let i = 0; i < 2; i++) {
        scenery.push({ x: 220 + i * 320, kind: 'bird', y: 34 + i * 22, size: 2 })
      }
    }
    seedScenery()

    function reset() {
      runner.y = GROUND_Y - 8 * PIXEL
      runner.vy = 0
      runner.onGround = true
      obstacles = []
      bolts = []
      shots = []
      particles = []
      boss = null
      score = 0
      speed = isLocalDuo || isTabDuo ? 3.9 : 4.5
      frame = 0
      nextSpawnIn = isLocalDuo || isTabDuo ? 95 : 70
      ammo = MAX_AMMO
      ammoTick = 0
      ducking = false
      nextBossAt = 250
      gameOver = false
      paused = false
      won = false
      puzzleLines = []
      bossKills = {}
      bossesDefeated = 0
      purged = 0
      overclockFrames = 0
      combo = 0
      comboWindow = 0
      shieldCharges = 0
      surgeFrames = 0
      invulnerableFrames = 0
      rewardText = ''
      rewardTimer = 0
      nextBountyAt = 180
      dodgeDuckFrames = 0
      dodgeAirFrames = 0
      duckStreakFrames = 0
      aiShotCooldown = 0
      aiRestartTimer = 0
      seedScenery()
      // Reset P2 state
      runner2.y = GROUND_Y - 8 * PIXEL
      runner2.vy = 0
      runner2.onGround = true
      ducking2  = false
      ammo2     = MAX_AMMO
      ammoTick2 = 0
      bolts2    = []
      emit({ gameOver: false, score: 0, best, ammo: MAX_AMMO, bossName: null, duo: isLocalDuo || isTabDuo })
    }

    // Cosmetic-only "cipher" shown on the win screen. It is pure Math.random() noise with
    // no encoded message and no verification function anywhere in this file — there is
    // nothing to decode, by construction, because that is the only honest way to hand
    // someone a puzzle no solver (human or LLM) can crack: don't give it an answer.
    function generatePuzzle(): string[] {
      const hex = () =>
        Math.floor(Math.random() * 0x10000)
          .toString(16)
          .toUpperCase()
          .padStart(4, '0')
      const glyphs = '∴∵⌬⟁⟡⧉⧫⨳⩣⫷⫸'.split('')
      const glyph = () => glyphs[Math.floor(Math.random() * glyphs.length)]
      const block = () => `${hex()}-${hex()}${glyph()}${hex()}-${hex()}`
      return [block(), block(), block()]
    }

    function objectivesDone() {
      const bossesCleared = BOSS_VARIANTS.every((v) => (bossKills[v.label] ?? 0) >= WIN_BOSS_EACH)
      return (
        score >= WIN_SCORE &&
        bossesCleared &&
        purged >= WIN_PURGE &&
        overclockFrames >= WIN_OVERCLOCK &&
        frame >= TEN_THOUSAND_HOURS_FRAMES
      )
    }

    function jump() {
      if (!started) {
        started = true
        sendDuoAction({ type: 'duo-action', action: 'start' })
        return
      }
      if (gameOver || won) {
        reset()
        sendDuoAction({ type: 'duo-action', action: 'reset' })
        return
      }
      if (paused) return
      if (runner.onGround) {
        runner.vy = JUMP_VELOCITY
        runner.onGround = false
      }
    }

    function shoot() {
      if (!started || gameOver || won || paused || ammo <= 0) return
      ammo--
      const y = runner.y + (ducking ? 6 : 10)
      bolts.push({ x: runner.x + 8 * PIXEL, y, owner: mySlot })
      sendDuoAction({ type: 'duo-action', action: 'shoot', y, owner: mySlot })
      emit({ ammo })
    }

    function shootPartner(y: number, owner: 1 | 2) {
      const partnerX = owner === 1 ? 48 : 96
      bolts.push({ x: partnerX + 8 * PIXEL, y, owner })
    }

    // ── P2 controls (local duo) ────────────────────────────────────────────
    function jump2() {
      if (!isLocalDuo) return
      if (!started) { started = true; return }
      if (gameOver || won) { reset(); return }
      if (paused) return
      if (runner2.onGround) { runner2.vy = JUMP_VELOCITY; runner2.onGround = false }
    }

    function shoot2() {
      if (!isLocalDuo || !started || gameOver || won || paused || ammo2 <= 0) return
      ammo2--
      bolts2.push({ x: runner2.x + 8 * PIXEL, y: runner2.y + (ducking2 ? 6 : 10) })
      emit({ ammo2 })
    }

    function runner2Box(): Box {
      const sp = ducking2 && runner2.onGround ? RUNNER_DUCK : RUNNER_SPRITE
      return { x: runner2.x + 3, y: GROUND_Y - sprH(sp) + 3, w: sprW(sp) - 6, h: sprH(sp) - 6 }
    }
    function airborne2Box(): Box {
      return { x: runner2.x + 3, y: runner2.y + 3, w: 8 * PIXEL - 6, h: 8 * PIXEL - 6 }
    }
    function activeRunner2Box(): Box {
      return runner2.onGround ? runner2Box() : airborne2Box()
    }

    function burst(x: number, y: number, n: number) {
      for (let i = 0; i < n; i++) {
        particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 5,
          vy: -Math.random() * 3.5,
          life: 18 + Math.random() * 12,
        })
      }
    }

    // Standing clears a high shot only by crouching; a low shot has to be jumped.
    const HIGH_LANE = GROUND_Y - 26
    const LOW_LANE = GROUND_Y - 14
    // Shots that travel along the ground itself — only a jump clears them AND they
    // cannot be crouched (hitbox is at knee level). Used as the crouch-punish lane.
    const GROUND_LANE = GROUND_Y - 10

    function makeShot(
      x: number,
      y: number,
      opts: { vx?: number; vy?: number; size?: number; behavior?: ShotBehavior } = {},
    ): Shot {
      return {
        x,
        y,
        vx: opts.vx ?? 5.5,
        vy: opts.vy ?? 0,
        size: opts.size ?? 9,
        t: 0,
        behavior: opts.behavior ?? 'straight',
        split: false,
      }
    }

    // Reads how the runner has been evading this fight and returns the lane that punishes
    // that habit: a crouch-heavy player gets the low lane (a crouch cannot clear it), an
    // air-heavy player gets the high lane. Kept partly random so it stays unpredictable.
    function adaptiveHigh(b: Boss) {
      // Remote player movement arrives asynchronously, so it cannot safely steer a shared
      // boss. A deterministic volley pattern keeps the online map identical on both peers.
      if (isTabDuo || b.tier < 1 || random() < 0.3) return b.volley % 2 === 0
      return dodgeDuckFrames <= dodgeAirFrames
    }

    // Returns true when the runner has been crouching long enough that the boss should
    // punish it with a GROUND_LANE shot that cannot be crouched through.
    function shouldPunishCrouch(): boolean {
      // 40 frames (~0.67 s) of sustained crouching triggers a punisher.
      return duckStreakFrames >= 40
    }

    // How many extra parallel shots a boss fires per volley based on tier.
    // Gives high-tier bosses genuine pressure even against experienced players.
    function extraShotCount(b: Boss): number {
      const base = b.tier >= 9 ? 2 : b.tier >= 5 ? 1 : 0
      return b.enraged ? base + 1 : base
    }

    // Early fights teach a boss's signature. Once a phase has broken, the same boss starts
    // borrowing patterns so a player cannot solve the whole fight with one rhythm.
    function pickAttack(b: Boss): BossAttack {
      if (b.phase === 0 && b.tier < BOSS_MIX_TIER) return b.variant.attack
      if (b.volley % 2 === 0) return b.variant.attack
      return BOSS_VARIANTS[Math.floor(random() * BOSS_VARIANTS.length)].attack
    }

    function fireBoss(b: Boss) {
      const attack = pickAttack(b)
      b.attack = attack
      // Enraged bosses shoot faster — multiply base speed.
      const boost = b.enraged ? b.shotSpeed * 1.35 : b.shotSpeed

      // ── Universal crouch-punish override ─────────────────────────────────
      // If the runner has been holding a crouch for too long, every boss fires a
      // GROUND_LANE shot regardless of its normal attack pattern. The runner must jump
      // or take the hit — crouching no longer saves them.
      if (shouldPunishCrouch()) {
        duckStreakFrames = 0
        shots.push(makeShot(b.x, GROUND_LANE, { vx: 5 + boost, size: 10 }))
        b.cooldown = Math.max(30, b.fireInterval - 20)
        b.volley++
        return
      }

      if (attack === 'burst') {
        // Burst now alternates lanes every volley:
        // — Even volleys: HIGH_LANE burst (duck to survive)
        // — Odd volleys: LOW_LANE burst (jump to survive)
        // This means a player cannot stay crouched through consecutive bursts.
        if (b.burst <= 0) {
          b.burst = b.tier >= 2 ? 3 : 2
          // Three-round volley: alternate high/low across the sequence instead of
          // locking to one lane, so none of the three rounds can be ignored.
          if (b.burst >= 3) {
            // First round high, middle round low (ground-level), last round high again.
            b.burstHigh = true  // overridden per-shot below
          } else {
            // Two rounds: volley parity decides the lane, punishing the dominant habit.
            b.burstHigh = adaptiveHigh(b)
          }
        }
        // Per-round lane decision for the 3-round sequence:
        let shotY: number
        if (b.burst === 2) {
          // Round 1 of 3 — high, duck to clear
          shotY = HIGH_LANE
        } else if (b.burst === 1) {
          // Round 2 of 3 — low/ground, must jump (cannot be crouched)
          shotY = GROUND_LANE
        } else {
          // Round 3 (last) of 3, or round 2 of 2 — adaptive
          shotY = b.burstHigh ? HIGH_LANE : LOW_LANE
        }
        shots.push(makeShot(b.x, shotY, { vx: 5.5 + boost }))
        b.burst--
        b.cooldown = b.burst > 0 ? Math.max(18, 22 - b.tier) : b.fireInterval
      } else if (attack === 'drift') {
        // Drift: high arcing shot that settles into standing lane (duck to clear).
        // Follow up immediately with a GROUND_LANE shot after a short delay so the
        // runner cannot just stay crouched — they must stand to let the drift pass,
        // then jump the ground shot.
        shots.push(makeShot(b.x, GROUND_Y - 64, { vx: 4.6 + boost, vy: 0.42, behavior: 'drift' }))
        // Second low shot fired 28 frames behind the drift — when the drift is already
        // committed to the standing lane the low arrives, forcing a late jump.
        shots.push(makeShot(b.x - 28 * (4.6 + boost), GROUND_LANE, { vx: 4.2 + boost, size: 8 }))
        b.cooldown = b.fireInterval
      } else if (attack === 'split') {
        // Split: the clone arrives in LOW_LANE. Add a leading HIGH_LANE shot so the
        // sequence is: duck the leader → land → jump the clone. Crouching through
        // everything is no longer safe because the clone occupies LOW_LANE.
        shots.push(makeShot(b.x, HIGH_LANE, { vx: 5 + boost, behavior: 'split' }))
        // Extra trailing LOW shot arrives after the clone — forces a second jump.
        if (b.tier >= 2) {
          shots.push(makeShot(b.x - 60 * (5 + boost), GROUND_LANE, { vx: 4.8 + boost, size: 8 }))
        }
        b.cooldown = b.fireInterval
      } else if (attack === 'flicker') {
        // Flicker now always fires TWO shots: one high (flicker) and one delayed low.
        // The player must respond to the flicker's final lock-in AND then jump the low.
        const high = adaptiveHigh(b)
        shots.push(
          makeShot(b.x, high ? HIGH_LANE : LOW_LANE, { vx: 5 + boost, behavior: 'flicker' }),
        )
        // Low follow-up fires 36 frames staggered — arrives just as the flicker lands.
        shots.push(
          makeShot(b.x - 36 * (5 + boost), GROUND_LANE, { vx: 4.5 + boost, size: 8 }),
        )
        b.cooldown = b.fireInterval
      } else {
        // Slab: a slow, oversized wall that must be jumped. Now followed by a fast LOW
        // shot timed to arrive as the runner is descending — they cannot crouch-land
        // safely because the low shot is already there.
        shots.push(makeShot(b.x, GROUND_Y - 22, { vx: 3 + boost * 0.5, size: 18 }))
        // Fast low punisher arrives ~40 frames after the slab — when the jump is over.
        shots.push(
          makeShot(b.x - 40 * (3 + boost * 0.5), GROUND_LANE, { vx: 5.2 + boost, size: 9 }),
        )
        b.cooldown = b.fireInterval
      }
      // ── Multishot: high-tier / enraged bosses add spread shots ──────────
      // Fired AFTER the primary shot so the primary attack logic is unchanged.
      const extras = extraShotCount(b)
      if (extras > 0) {
        const offsets = [20, -20, 36, -36]
        for (let i = 0; i < extras; i++) {
          const oy  = offsets[i % offsets.length]
          const raw = (b.attack === 'slab' ? GROUND_Y - 22 : HIGH_LANE) + oy
          const y   = Math.max(GROUND_Y - 60, Math.min(GROUND_Y - 8, raw))
          shots.push(makeShot(b.x, y, { vx: 4.8 + boost + i * 0.5, size: 7 }))
        }
      }
      b.volley++
    }

    /** Fires a readable two-lane reply after players try to stun-lock the boss. */
    function triggerCountermeasure(b: Boss) {
      const boost = b.enraged ? b.shotSpeed * 1.35 : b.shotSpeed
      b.guardFrames = 42
      b.hitChain = 0
      b.hitChainTimer = 0
      shots.push(makeShot(b.x, HIGH_LANE, { vx: 5.2 + boost, size: 8 }))
      shots.push(makeShot(b.x - 26 * (4.8 + boost), GROUND_LANE, { vx: 4.8 + boost, size: 8 }))
      b.cooldown = Math.max(24, Math.floor(b.fireInterval * 0.65))
      b.volley++
      rewardText = 'COUNTERMEASURE — DUCK, THEN JUMP'
      rewardTimer = 105
    }

    /** Applies boss damage without allowing hits to indefinitely cancel its offense. */
    function damageBoss(b: Boss, bolt: Bolt) {
      bolt.x = WIDTH + 999
      if (b.guardFrames > 0) {
        burst(b.x + sprW(b.sprite) / 2, b.y + sprH(b.sprite) / 2, 4)
        return
      }

      b.hp--
      burst(b.x + sprW(b.sprite) / 2, b.y + sprH(b.sprite) / 2, 12)
      b.hitChain = b.hitChainTimer > 0 ? b.hitChain + 1 : 1
      b.hitChainTimer = 84
      // A hit earns a brief stagger, not the old one-second attack cancel.
      b.cooldown = Math.max(b.cooldown, 16)

      if (b.hp > 0 && b.hitChain >= 3) triggerCountermeasure(b)

      const nextPhase = Math.min(2, Math.floor((1 - b.hp / b.maxHp) * 3))
      if (b.hp > 0 && nextPhase > b.phase) {
        b.phase = nextPhase
        b.fireInterval = Math.max(24, Math.floor(b.fireInterval * 0.86))
        b.cooldown = Math.min(b.cooldown, 10)
        rewardText = `BOSS PHASE ${b.phase + 1} — PATTERN SHIFT`
        rewardTimer = 120
      }

      if (b.hp <= 0) defeatBoss(b)
    }

    /** Resolves the one shared boss defeat path for solo and local-Duo projectiles. */
    function defeatBoss(defeatedBoss: Boss) {
      score += 150
      burst(defeatedBoss.x + sprW(defeatedBoss.sprite) / 2, defeatedBoss.y + sprH(defeatedBoss.sprite) / 2, 24)
      const label = defeatedBoss.variant.label
      bossKills[label] = (bossKills[label] ?? 0) + 1
      bossesDefeated++
      boss = null
      emit({ bossName: null, score })
      nextBossAt = score + Math.max(140, 350 - Math.floor(score / 20_000) * 5)
      shots = []
    }

    function togglePause() {
      if (!started || gameOver || won) return
      paused = !paused
      ducking = false
      sendDuoAction({ type: 'duo-action', action: 'pause' })
    }

    function drawSprite(
      sprite: string[],
      x: number,
      y: number,
      scale = PIXEL,
      color = INK,
      accentColor = ACCENT,
    ) {
      for (let row = 0; row < sprite.length; row++) {
        const line = sprite[row]
        for (let col = 0; col < line.length; col++) {
          const cell = line[col]
          if (cell === '0') continue
          ctx!.fillStyle = cell === 'A' ? accentColor : cell === 'K' ? INK : color
          ctx!.fillRect(x + col * scale, y + row * scale, scale, scale)
        }
      }
    }

    // A 1px rim in a background-contrasting color, drawn behind a sprite so it never
    // blends into a same-hue theme (e.g. a purple runner over a purple night sky).
    function drawOutline(sprite: string[], x: number, y: number, scale: number, color: string) {
      ctx!.fillStyle = color
      const offsets: Array<[number, number]> = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]
      for (let row = 0; row < sprite.length; row++) {
        const line = sprite[row]
        for (let col = 0; col < line.length; col++) {
          if (line[col] === '0') continue
          for (const [dx, dy] of offsets) {
            ctx!.fillRect(x + col * scale + dx, y + row * scale + dy, scale, scale)
          }
        }
      }
    }

    const sprH = (s: string[]) => s.length * PIXEL
    const sprW = (s: string[]) => s[0].length * PIXEL
    const pick = <T,>(list: readonly T[]): T => list[Math.floor(random() * list.length)]

    type Box = { x: number; y: number; w: number; h: number }
    const overlap = (a: Box, b: Box) =>
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

    function runnerBox(): Box {
      const sprite = ducking && runner.onGround ? RUNNER_DUCK : RUNNER_SPRITE
      const h = sprH(sprite)
      return { x: runner.x + 3, y: GROUND_Y - h + 3, w: sprW(sprite) - 6, h: h - 6 }
    }

    function airborneBox(): Box {
      return { x: runner.x + 3, y: runner.y + 3, w: 8 * PIXEL - 6, h: 8 * PIXEL - 6 }
    }

    function activeRunnerBox(): Box {
      return runner.onGround ? runnerBox() : airborneBox()
    }

    function obstacleBox(o: Obstacle): Box {
      return { x: o.x + 2, y: o.y + 2, w: sprW(o.sprite) - 4, h: sprH(o.sprite) - 4 }
    }

    function spawnObstacle() {
      const roll = random()
      if (roll < 0.55) {
        const sprite = pick(BUG_SPRITES)
        obstacles.push({ x: WIDTH + 10, y: GROUND_Y - sprH(sprite), sprite, kind: 'bug', hp: 1 })
      } else if (roll < 0.8) {
        const sprite = pick(ERROR_SPRITES)
        obstacles.push({ x: WIDTH + 10, y: GROUND_Y - 36, sprite, kind: 'error', hp: 1 })
      } else {
        const sprite = pick(MALWARE_SPRITES)
        obstacles.push({
          x: WIDTH + 10,
          y: GROUND_Y - sprH(sprite),
          sprite,
          kind: 'malware',
          hp: 2,
        })
      }
    }

    function spawnBounty() {
      obstacles.push({
        x: WIDTH + 12,
        // Standard bolts travel through the runner's mid/low lane (~GROUND_Y - 14).
        // Keep the packet inside that lane so it is a deliberate, reachable shot.
        y: GROUND_Y - 24,
        sprite: BOUNTY_SPRITE,
        kind: 'bounty',
        hp: 1,
      })
    }

    /** Records a shot-down target and unlocks the short reward cadence. */
    function registerPurge(kind: ObstacleKind) {
      const isBounty = kind === 'bounty'
      score += isBounty ? 100 : 25
      purged++
      combo = comboWindow > 0 ? combo + 1 : 1
      comboWindow = 210
      rewardText = isBounty ? 'PRIORITY PURGED +100' : `LINK ${combo}/3`
      rewardTimer = 75

      if (combo >= 3) {
        combo = 0
        comboWindow = 0
        shieldCharges = Math.min(2, shieldCharges + 1)
        surgeFrames = Math.max(surgeFrames, 300)
        rewardText = 'FIREWALL ONLINE · OVERCLOCK'
        rewardTimer = 150
      }
    }

    /** Returns true when a limited firewall charge absorbs the current collision. */
    function absorbHit(x: number, y: number): boolean {
      if (invulnerableFrames > 0) return true
      if (shieldCharges <= 0) return false
      shieldCharges--
      invulnerableFrames = 50
      rewardText = 'FIREWALL BLOCKED HIT'
      rewardTimer = 120
      burst(x, y, 18)
      return true
    }

    function drawScenery(theme: ReturnType<typeof resolveTheme>) {
      // Drawn back-to-front by kind (not array order) so depth stays correct regardless
      // of spawn sequence: sky sparkle, then clouds, skyline, hills, birds, ground grit.
      for (const s of scenery) {
        if (s.kind !== 'star') continue
        if (theme.nightLevel < 0.05) continue
        const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(frame / 20 + s.x))
        ctx!.fillStyle = `rgba(255, 255, 255, ${(theme.nightLevel * twinkle).toFixed(2)})`
        ctx!.fillRect(s.x, s.y, s.size, s.size)
      }
      for (const s of scenery) {
        if (s.kind === 'cloud') drawSprite(CLOUD_SPRITE, s.x, s.y, s.size, theme.cloud)
      }
      for (const s of scenery) {
        if (s.kind !== 'tower') continue
        ctx!.fillStyle = theme.tower
        const w = Math.max(10, Math.floor(s.size * 0.55))
        ctx!.fillRect(s.x, GROUND_Y - s.size, w, s.size)
      }
      for (const s of scenery) {
        if (s.kind !== 'hill') continue
        ctx!.fillStyle = theme.hill
        const steps = 5
        const stepW = Math.max(4, Math.floor(s.size / steps))
        for (let i = 0; i < steps; i++) {
          const h = Math.round((s.size * (i + 1)) / steps)
          ctx!.fillRect(s.x + i * stepW, GROUND_Y - h, stepW, h)
          ctx!.fillRect(s.x + (steps * 2 - i - 1) * stepW, GROUND_Y - h, stepW, h)
        }
      }
      for (const s of scenery) {
        if (s.kind !== 'bird') continue
        ctx!.fillStyle = theme.hill
        ctx!.fillRect(s.x, s.y, s.size, s.size)
        ctx!.fillRect(s.x - s.size * 2, s.y + s.size, s.size, s.size)
        ctx!.fillRect(s.x + s.size * 2, s.y + s.size, s.size, s.size)
      }
      for (const s of scenery) {
        if (s.kind !== 'pebble') continue
        ctx!.fillStyle = theme.pebble
        ctx!.fillRect(s.x, GROUND_Y + 8, s.size * PIXEL, PIXEL)
      }
    }

    function endGame(shareWithPartner = true) {
      if (gameOver) return
      gameOver = true
      const scoreHistory = saveScore(score, scoreMode)
      best = Math.max(best, scoreHistory[0]?.score ?? 0)
      burst(runner.x + 12, runner.y + 12, 14)
      emit({ gameOver: true, score, best, scoreHistory })
      if (shareWithPartner) sendDuoAction({ type: 'duo-action', action: 'down' })
      if (autoPlay) {
        aiRestartTimer = 45
        aiCaution = Math.min(4, aiCaution + 1)
        aiLastDeathScore = 0
      }
    }

    // A threat snapshot the planner can fast-forward without touching live game state.
    type SimThreat = {
      x: number
      y: number
      w: number
      h: number
      vx: number
      vy: number
      t: number
      size: number
      behavior: ShotBehavior
      split: boolean
    }

    function snapshotThreats(): SimThreat[] {
      const list: SimThreat[] = []
      for (const o of obstacles) {
        if (o.hp <= 0) continue
        list.push({
          x: o.x + 2,
          y: o.y + 2,
          w: sprW(o.sprite) - 4,
          h: sprH(o.sprite) - 4,
          vx: speed,
          vy: 0,
          t: 0,
          size: 0,
          behavior: 'straight',
          split: true,
        })
      }
      for (const s of shots) {
        list.push({
          x: s.x,
          y: s.y,
          w: s.size + 1,
          h: s.size + 1,
          vx: s.vx,
          vy: s.vy,
          t: s.t,
          size: s.size,
          behavior: s.behavior,
          split: s.split,
        })
      }
      return list
    }

    // Mirrors the real shot/obstacle update exactly, including the split clone, so the
    // planner never mispredicts where a threat will actually be.
    function advanceThreats(list: SimThreat[]): SimThreat[] {
      const born: SimThreat[] = []
      for (const th of list) {
        th.t++
        th.x -= th.vx
        if (th.behavior === 'drift') {
          th.y = Math.min(th.y + th.vy, GROUND_Y - 22)
        } else if (th.behavior === 'flicker') {
          if (th.x > 220 && th.t % 26 === 0) th.y = th.y < GROUND_Y - 20 ? LOW_LANE : HIGH_LANE
        } else if (th.behavior === 'split' && !th.split && th.x < 220) {
          th.split = true
          born.push({
            x: th.x + 100,
            y: LOW_LANE,
            w: th.size + 1,
            h: th.size + 1,
            vx: th.vx,
            vy: 0,
            t: 0,
            size: th.size,
            behavior: 'straight',
            split: true,
          })
        }
      }
      return born.length ? list.concat(born) : list
    }

    type AiAction = 'none' | 'jump' | 'duck'

    function cloneThreats(base: SimThreat[]): SimThreat[] {
      const out: SimThreat[] = new Array(base.length)
      for (let i = 0; i < base.length; i++) {
        const t = base[i]
        out[i] = {
          x: t.x,
          y: t.y,
          w: t.w,
          h: t.h,
          vx: t.vx,
          vy: t.vy,
          t: t.t,
          size: t.size,
          behavior: t.behavior,
          split: t.split,
        }
      }
      return out
    }

    // Evaluates a plan — "wait `delay` frames, then commit to `action` and hold it" — by
    // rolling the runner's real physics and hitboxes forward, returning frames survived.
    //
    // The delay is the whole point. A planner that can only hold an action from right now
    // cannot express "wait, THEN jump", so it takes the first jump that looks marginally
    // better and lands straight onto a tall obstacle. Searching the delay lets it hold
    // position and jump on the frame that actually clears.
    function simulatePlan(
      base: SimThreat[],
      action: AiAction,
      delay: number,
      horizon: number,
      pad: number,
    ): number {
      if (action === 'jump' && delay === 0 && !runner.onGround) return -1
      let ry = runner.y
      let rvy = runner.vy
      let onGround = runner.onGround
      let jumped = false
      let threats = cloneThreats(base)

      for (let f = 0; f < horizon; f++) {
        const active = f >= delay
        if (action === 'jump' && active && !jumped && onGround) {
          rvy = JUMP_VELOCITY
          onGround = false
          jumped = true
        }
        const duckHeld = action === 'duck' && active
        rvy += GRAVITY
        if (duckHeld && !onGround) rvy += 0.7
        ry += rvy
        if (ry >= GROUND_Y - 8 * PIXEL) {
          ry = GROUND_Y - 8 * PIXEL
          rvy = 0
          onGround = true
        }
        threats = advanceThreats(threats)

        let box: Box
        if (onGround) {
          const sprite = duckHeld ? RUNNER_DUCK : RUNNER_SPRITE
          const h = sprH(sprite)
          box = { x: runner.x + 3, y: GROUND_Y - h + 3, w: sprW(sprite) - 6, h: h - 6 }
        } else {
          box = { x: runner.x + 3, y: ry + 3, w: 8 * PIXEL - 6, h: 8 * PIXEL - 6 }
        }
        const padded = {
          x: box.x - pad,
          y: box.y - pad,
          w: box.w + pad * 2,
          h: box.h + pad * 2,
        }
        for (const th of threats) {
          if (th.x > WIDTH) continue
          if (overlap(padded, th)) return f
        }
      }
      return horizon
    }

    // Would a bolt fired right now actually connect? Keeps the AI from dumping ammo into
    // empty track and arriving at a boss with nothing loaded.
    function boltWouldHit(): boolean {
      const boltY = runner.y + (ducking ? 6 : 10)
      let bx = runner.x + 8 * PIXEL
      const targets = obstacles
        .filter((o) => o.hp > 0)
        .map((o) => ({
          x: o.x + 2,
          y: o.y + 2,
          w: sprW(o.sprite) - 4,
          h: sprH(o.sprite) - 4,
        }))
      const b = boss
      let bossX = b ? b.x : 0
      let bossT = b ? b.t : 0

      for (let f = 0; f < 60; f++) {
        bx += 15
        if (bx > WIDTH + 20) break
        for (const t of targets) t.x -= speed
        const bolt = { x: bx, y: boltY, w: 10, h: 4 }
        for (const t of targets) {
          if (overlap(bolt, t)) return true
        }
        if (b && b.hp > 0) {
          bossT++
          if (bossX > b.variant.targetX) bossX -= b.variant.approachSpeed
          const bossY =
            b.variant.spawnY + Math.sin(bossT / b.variant.bobRate) * b.variant.bobAmplitude
          const bossBox = {
            x: bossX,
            y: bossY,
            w: sprW(b.sprite),
            h: sprH(b.sprite),
          }
          if (overlap(bolt, bossBox)) return true
        }
      }
      return false
    }

    // Alt+T autopilot. Each frame it plans by simulation rather than by rule-of-thumb
    // timings, then adapts its safety margin from how the previous runs actually ended.
    function autoPilot() {
      if (!autoPlay || paused || won) return
      if (!started) {
        jump()
        return
      }
      if (gameOver) {
        if (aiRestartTimer > 0) {
          aiRestartTimer--
          return
        }
        jump()
        return
      }

      // Caution is the learned part: every death widens the margin and lookahead, and a
      // long clean stretch narrows them again, so the AI settles on the least-twitchy
      // margin that still survives the speed it is currently running at.
      if (score - aiLastDeathScore > 500 && aiCaution > 0) {
        aiCaution = Math.max(0, aiCaution - 1)
        aiLastDeathScore = score
      }
      // The horizon tracks track speed only. Letting caution stretch it too was a trap: a
      // boss firing every ~70 frames means no plan can ever stay clean for 90, so the
      // planner sat permanently in "doomed" mode and lost its stay-put tie-break.
      const pad = 2 + aiCaution
      const horizon = Math.round(46 + speed * 1.6)
      const base = snapshotThreats()

      // Searches every plan and keeps the best, but only ever executes its FIRST frame —
      // next frame it re-plans from scratch against whatever actually happened.
      function planBest(padding: number) {
        let bestAction: AiAction = 'none'
        let bestScore = simulatePlan(base, 'none', 0, horizon, padding)
        let bestPref = 0
        for (let delay = 0; delay <= AI_MAX_DELAY; delay++) {
          for (const action of AI_ACTIONS) {
            const score = simulatePlan(base, action, delay, horizon, padding)
            if (score < 0) continue
            const immediate: AiAction = delay === 0 ? action : 'none'
            const pref = immediate === 'none' ? 0 : immediate === 'duck' ? 1 : 2
            if (score > bestScore || (score === bestScore && pref < bestPref)) {
              bestScore = score
              bestAction = immediate
              bestPref = pref
            }
            // A clean run that needs nothing this frame is the ideal outcome; stop early.
            if (bestScore >= horizon && bestPref === 0) {
              return { action: bestAction, score: bestScore }
            }
          }
        }
        return { action: bestAction, score: bestScore }
      }

      let best = planBest(pad)
      // Nothing survives the comfortable margin — step the margin down rather than jumping
      // straight to tight play, so the AI keeps as much clearance as the situation allows.
      if (best.score < horizon) {
        for (let relax = pad - 1; relax >= 0; relax--) {
          const looser = planBest(relax)
          if (looser.score > best.score) best = looser
          if (best.score >= horizon) break
        }
      }
      // Only a genuine near-miss raises caution. Merely not seeing a spotless 60-frame
      // future is normal under boss fire and must not ratchet the margin up forever.
      if (best.score < 14) aiCaution = Math.min(4, aiCaution + 1)

      ducking = best.action === 'duck'
      if (best.action === 'jump' && runner.onGround) jump()

      if (aiShotCooldown > 0) aiShotCooldown--
      // Only shoot from a stable pose; firing mid-dodge is what wastes the clip.
      if (ammo > 0 && aiShotCooldown <= 0 && best.action === 'none' && boltWouldHit()) {
        shoot()
        aiShotCooldown = 8
      }
    }

    function step() {
      if (!running) return
      if (!paused) frame++
      autoPilot()

      ctx!.clearRect(0, 0, WIDTH, HEIGHT)
      const theme = resolveTheme(score)
      const sky = ctx!.createLinearGradient(0, 0, 0, HEIGHT)
      sky.addColorStop(0, theme.skyTop)
      sky.addColorStop(1, theme.skyBottom)
      ctx!.fillStyle = sky
      ctx!.fillRect(0, 0, WIDTH, HEIGHT)
      drawScenery(theme)
      // Tracks the sky's light/dark balance continuously, so the runner, boss, and
      // shots stay readable through a theme cross-fade instead of flipping at a hard cutoff.
      const outline = lerpColor('#171717', '#fafafa', theme.nightLevel)
      // HUD text sitting directly on the live sky (no white backdrop behind it) needs the
      // same treatment — a fixed dark-gray label reads fine on the day theme and nearly
      // vanishes on the night/aurora skies. hudPrimary/hudMuted swap toward light readouts
      // as the theme darkens; text over the paused/won white overlays stays fixed since
      // that backdrop is bright regardless of theme.
      const hudPrimary = outline
      const hudMuted = lerpColor('#525252', '#d4d4d4', theme.nightLevel)

      ctx!.strokeStyle = theme.ground
      ctx!.lineWidth = 2
      ctx!.beginPath()
      ctx!.moveTo(0, GROUND_Y + 2)
      ctx!.lineTo(WIDTH, GROUND_Y + 2)
      ctx!.stroke()

      if (started && !gameOver && !won && !paused) {
        if (comboWindow > 0) {
          comboWindow--
        } else {
          combo = 0
        }
        if (surgeFrames > 0) surgeFrames--
        if (invulnerableFrames > 0) invulnerableFrames--
        if (rewardTimer > 0) rewardTimer--

        for (const s of scenery) {
          const factor =
            s.kind === 'star'
              ? 0.04
              : s.kind === 'tower'
                ? 0.12
                : s.kind === 'cloud'
                  ? 0.18
                  : s.kind === 'hill'
                    ? 0.35
                    : s.kind === 'bird'
                      ? 0.6
                      : 1
          s.x -= speed * factor
          if (s.x < -80) s.x = WIDTH + random() * 120
        }

        runner.vy += GRAVITY
        if (ducking && !runner.onGround) runner.vy += 0.7
        runner.y += runner.vy
        if (runner.y >= GROUND_Y - 8 * PIXEL) {
          runner.y = GROUND_Y - 8 * PIXEL
          runner.vy = 0
          runner.onGround = true
        }

        ammoTick++
        // Refill faster during a boss fight so the player is never stuck empty.
        if (ammoTick >= (boss ? 40 : AMMO_REGEN)) {
          ammoTick = 0
          const prevAmmo = ammo
          ammo = Math.min(MAX_AMMO, ammo + 1)
          if (ammo !== prevAmmo) emit({ ammo })
        }

        // ── P2 physics (local duo) ─────────────────────────────────────────
        if (isLocalDuo) {
          runner2.vy += GRAVITY
          if (ducking2 && !runner2.onGround) runner2.vy += 0.7
          runner2.y += runner2.vy
          if (runner2.y >= GROUND_Y - 8 * PIXEL) {
            runner2.y = GROUND_Y - 8 * PIXEL
            runner2.vy = 0
            runner2.onGround = true
          }
          ammoTick2++
          if (ammoTick2 >= (boss ? 40 : AMMO_REGEN)) {
            ammoTick2 = 0
            ammo2 = Math.min(MAX_AMMO, ammo2 + 1)
            emit({ ammo2 })
          }
        }

        if (!boss && score >= nextBossAt) {
          // Prefer a variant the run still needs for its objective, so progress is
          // reachable without grinding on random draws.
          const owed = BOSS_VARIANTS.filter((v) => (bossKills[v.label] ?? 0) < WIN_BOSS_EACH)
          const variant = pick(owed.length ? owed : BOSS_VARIANTS)
          const tier = bossTier(score, bossesDefeated, frame)
          const baseScale = scaleBoss(variant, tier)
          const scaled = isLocalDuo || isTabDuo
            ? {
                ...baseScale,
                hp: Math.max(2, Math.ceil(baseScale.hp * 0.7)),
                fireInterval: Math.round(baseScale.fireInterval * 1.18),
              }
            : baseScale
          boss = {
            x: WIDTH + 40,
            y: variant.spawnY,
            hp: scaled.hp,
            maxHp: scaled.hp,
            t: 0,
            cooldown: scaled.fireInterval,
            volley: 0,
            burst: 0,
            burstHigh: false,
            animation: 0,
            sprite: variant.frames[0],
            variant,
            tier,
            fireInterval: scaled.fireInterval,
            approachSpeed: scaled.approachSpeed,
            shotSpeed: scaled.shotSpeed,
            attack: variant.attack,
            phase: 0,
            hitChain: 0,
            hitChainTimer: 0,
            guardFrames: 0,
            enraged: false,
          }
          dodgeDuckFrames = 0
          dodgeAirFrames = 0
          duckStreakFrames = 0
          emit({ bossName: variant.label, bossHp: scaled.hp, bossMaxHp: scaled.hp, bossTier: tier })
        }

        if (!boss) {
          nextSpawnIn--
          if (nextSpawnIn <= 0) {
            spawnObstacle()
            nextSpawnIn = (isLocalDuo || isTabDuo ? 85 : 60) + Math.floor(random() * 45)
          }
          if (score >= nextBountyAt) {
            spawnBounty()
            nextBountyAt = score + 210 + Math.floor(random() * 110)
          }
        }

        for (const o of obstacles) o.x -= speed
        obstacles = obstacles.filter((o) => o.x > -40)

        // boss behaviour
        if (boss) {
          const v = boss.variant
          boss.t++
          if (boss.hitChainTimer > 0) boss.hitChainTimer--
          else boss.hitChain = 0
          if (boss.guardFrames > 0) boss.guardFrames--
          // Four-frame loop, advanced on the fixed step so every boss idles at the same tempo.
          boss.animation = (boss.animation + 0.12) % v.frames.length
          boss.sprite = v.frames[Math.floor(boss.animation)]
          if (boss.x > v.targetX) boss.x -= boss.approachSpeed
          // Sample the runner's evasion habit for adaptiveHigh() and crouch-punish detection.
          if (runner.onGround) {
            if (ducking) {
              dodgeDuckFrames++
              duckStreakFrames++
            } else {
              // Standing resets the streak — only sustained crouching is punished.
              duckStreakFrames = 0
            }
          } else {
            dodgeAirFrames++
            // Jumping also resets the streak.
            duckStreakFrames = 0
          }
          boss.y = v.spawnY + Math.sin(boss.t / v.bobRate) * v.bobAmplitude

          // ── Rage mode: triggers once when HP drops to ≤50 % ───────────────
          if (!boss.enraged && boss.hp <= Math.floor(boss.maxHp * 0.5)) {
            boss.enraged = true
            // Rush the player harder in rage phase.
            boss.approachSpeed = Math.min(boss.approachSpeed * 1.45, boss.approachSpeed + 5)
            // Fire interval drops by 35 % in rage phase.
            boss.fireInterval  = Math.max(28, Math.floor(boss.fireInterval * 0.65))
            // Clear any pending cooldown so the rage burst fires immediately.
            boss.cooldown = Math.min(boss.cooldown, 10)
          }

          boss.cooldown--
          if (boss.guardFrames === 0 && boss.cooldown <= 0) fireBoss(boss)
          const bBox = {
            x: boss.x + 4,
            y: boss.y + 4,
            w: sprW(boss.sprite) - 8,
            h: sprH(boss.sprite) - 8,
          }
          if (overlap(activeRunnerBox(), bBox) && !absorbHit(runner.x + 12, runner.y + 12)) endGame()
        }

        const spawnedShots: Shot[] = []
        for (const s of shots) {
          s.t++
          s.x -= s.vx
          if (s.behavior === 'drift') {
            s.y = Math.min(s.y + s.vy, GROUND_Y - 22)
          } else if (s.behavior === 'flicker') {
            // Stops swapping well before it arrives, so the final lane is always readable.
            if (s.x > 220 && s.t % 26 === 0) s.y = s.y < GROUND_Y - 20 ? LOW_LANE : HIGH_LANE
          } else if (s.behavior === 'split' && !s.split && s.x < 220) {
            s.split = true
            // The clone trails the parent so the pair arrives as two separate reactions.
            spawnedShots.push(makeShot(s.x + 100, LOW_LANE, { vx: s.vx }))
          }
        }
        shots = shots.concat(spawnedShots).filter((s) => s.x > -30)

        for (const b of bolts) b.x += 15
        bolts = bolts.filter((b) => b.x < WIDTH + 20)

        // bolts vs obstacles
        for (const b of bolts) {
          const bBox = { x: b.x, y: b.y, w: 10, h: 4 }
          for (const o of obstacles) {
            if (o.hp > 0 && overlap(bBox, obstacleBox(o))) {
              o.hp--
              b.x = WIDTH + 999
              burst(o.x + sprW(o.sprite) / 2, o.y + sprH(o.sprite) / 2, 8)
              if (o.hp <= 0) {
                registerPurge(o.kind)
              }
            }
          }
          if (
            boss &&
            overlap(bBox, { x: boss.x, y: boss.y, w: sprW(boss.sprite), h: sprH(boss.sprite) })
          ) {
            damageBoss(boss, b)
          }
        }
        bolts = bolts.filter((b) => b.x < WIDTH + 20)
        obstacles = obstacles.filter((o) => o.hp > 0)

        // collisions against the runner
        const rBox = activeRunnerBox()
        for (const o of obstacles) {
          if (o.kind !== 'bounty' && overlap(rBox, obstacleBox(o)) && !absorbHit(runner.x + 12, runner.y + 12)) endGame()
        }
        for (const s of shots) {
          if (overlap(rBox, { x: s.x, y: s.y, w: s.size + 1, h: s.size + 1 }) && !absorbHit(runner.x + 12, runner.y + 12)) endGame()
        }

        if (frame % 6 === 0) {
          score += surgeFrames > 0 ? 2 : 1
          // Emit score every 10 pts to keep HUD updated without flooding events
          if (score % 10 === 0) emit({ score, best })
        }
        if (boss && frame % 4 === 0) {
          emit({ bossHp: boss.hp, bossMaxHp: boss.maxHp })
        }
        if (frame % 260 === 0) speed = Math.min(speed + 0.35, MAX_SPEED)
        if (speed >= MAX_SPEED) overclockFrames++
        if (objectivesDone()) {
          // Generated once, at the instant of the win — not derived from anything
          // recoverable afterward. There is nothing here to solve; that is the point.
          if (!won) puzzleLines = generatePuzzle()
          won = true
          best = Math.max(best, score)
        }
        // ── P2 bolts vs obstacles/boss (local duo) ────────────────────────
        if (isLocalDuo) {
          for (const b of bolts2) b.x += 15
          bolts2 = bolts2.filter((b) => b.x < WIDTH + 20)

          for (const b of bolts2) {
            const bBox = { x: b.x, y: b.y, w: 10, h: 4 }
            for (const o of obstacles) {
              if (o.hp > 0 && overlap(bBox, obstacleBox(o))) {
                o.hp--
                b.x = WIDTH + 999
                burst(o.x + sprW(o.sprite) / 2, o.y + sprH(o.sprite) / 2, 8)
                if (o.hp <= 0) registerPurge(o.kind)
              }
            }
            if (boss && overlap(bBox, { x: boss.x, y: boss.y, w: sprW(boss.sprite), h: sprH(boss.sprite) })) {
              damageBoss(boss, b)
            }
          }
          bolts2 = bolts2.filter((b) => b.x < WIDTH + 20)

          // P2 collision check
          const r2Box = activeRunner2Box()
          for (const o of obstacles) { if (o.kind !== 'bounty' && overlap(r2Box, obstacleBox(o)) && !absorbHit(runner2.x + 12, runner2.y + 12)) endGame() }
          for (const s of shots) { if (overlap(r2Box, { x: s.x, y: s.y, w: s.size + 1, h: s.size + 1 }) && !absorbHit(runner2.x + 12, runner2.y + 12)) endGame() }
          if (boss) {
            const bBoxB = { x: boss.x + 4, y: boss.y + 4, w: sprW(boss.sprite) - 8, h: sprH(boss.sprite) - 8 }
            if (overlap(r2Box, bBoxB) && !absorbHit(runner2.x + 12, runner2.y + 12)) endGame()
          }
        }
      }

      // ── Tab-duo: broadcast own runner state every other frame ────────────
      // Deliberately outside the started/gameOver/paused gate above: a peer that is
      // still on the title screen, dead, or paused must keep publishing, otherwise the
      // partner's ghost freezes on the last frame it happened to receive.
      if (isTabDuo && duo?.channel && netTick++ % 2 === 0) {
        duo.channel.postMessage({
          type: 'runner-state',
          slot: mySlot,
          y: runner.y,
          onGround: runner.onGround,
          ducking,
          ammo,
          score,
          alive: started && !gameOver,
        })
      }

      // particles
      if (!paused) {
        for (const p of particles) {
          p.x += p.vx
          p.y += p.vy
          p.vy += 0.2
          p.life--
        }
        particles = particles.filter((p) => p.life > 0)
      }
      ctx!.fillStyle = MUTED
      for (const p of particles) ctx!.fillRect(p.x, p.y, PIXEL, PIXEL)

      // entities
      for (const o of obstacles) {
        if (o.kind === 'bounty') {
          drawOutline(o.sprite, o.x, o.y, PIXEL, outline)
          drawSprite(o.sprite, o.x, o.y, PIXEL, '#fbbf24', '#fff7ed')
        } else {
          drawSprite(o.sprite, o.x, o.y)
        }
      }
      if (boss) {
        if (boss.guardFrames > 0) {
          ctx!.strokeStyle = '#22d3ee'
          ctx!.lineWidth = 2
          ctx!.strokeRect(boss.x - 5, boss.y - 5, sprW(boss.sprite) + 10, sprH(boss.sprite) + 10)
        }
        drawOutline(boss.sprite, boss.x, boss.y, PIXEL, outline)
        drawSprite(boss.sprite, boss.x, boss.y, PIXEL, boss.variant.color, boss.variant.accent)
      }

      for (const b of bolts) {
        ctx!.fillStyle = b.owner === 2 ? ACCENT_2 : ACCENT
        ctx!.fillRect(b.x, b.y, 10, 4)
      }
      for (const s of shots) {
        const core = Math.max(3, Math.round(s.size / 3))
        ctx!.fillStyle = outline
        ctx!.fillRect(s.x - 1, s.y - 1, s.size + 2, s.size + 2)
        ctx!.fillStyle = INK
        ctx!.fillRect(s.x, s.y, s.size, s.size)
        ctx!.fillStyle = ACCENT
        ctx!.fillRect(s.x + core, s.y + core, core, core)
      }

      const duckNow = ducking && runner.onGround
      const gaitFrame = Math.floor(frame / 8) % RUNNER_FRAMES.length
      const runSprite = duckNow
        ? RUNNER_DUCK
        : !started || !runner.onGround
          ? RUNNER_SPRITE
          : RUNNER_FRAMES[gaitFrame]
      const gaitBob =
        !duckNow && started && runner.onGround && (gaitFrame === 1 || gaitFrame === 3) ? -1 : 0
      const runnerDrawY = (duckNow ? GROUND_Y - sprH(RUNNER_DUCK) : runner.y) + gaitBob
      // Colour follows the slot, not the viewer. Drawing the local runner purple on both
      // peers made slot 2 see two purple runners while slot 1 saw purple + orange — the
      // same room described two different ways.
      const meIsP2 = isTabDuo && mySlot === 2
      drawOutline(runSprite, runner.x, runnerDrawY, PIXEL, outline)
      drawSprite(runSprite, runner.x, runnerDrawY, PIXEL,
        meIsP2 ? SPRITE_COLOR_2 : SPRITE_COLOR,
        meIsP2 ? ACCENT_2 : ACCENT)

      // ── Draw P2 runner (local duo) ─────────────────────────────────────
      if (isLocalDuo) {
        const duck2Now = ducking2 && runner2.onGround
        const g2Frame  = Math.floor(frame / 8) % RUNNER_FRAMES.length
        const run2Sprite = duck2Now
          ? RUNNER_DUCK
          : !started || !runner2.onGround
            ? RUNNER_SPRITE
            : RUNNER_FRAMES[g2Frame]
        const gait2Bob = !duck2Now && started && runner2.onGround && (g2Frame === 1 || g2Frame === 3) ? -1 : 0
        const r2DrawY = (duck2Now ? GROUND_Y - sprH(RUNNER_DUCK) : runner2.y) + gait2Bob
        drawOutline(run2Sprite, runner2.x, r2DrawY, PIXEL, outline)
        drawSprite(run2Sprite, runner2.x, r2DrawY, PIXEL, SPRITE_COLOR_2, ACCENT_2)
        // P2 bolts
        ctx!.fillStyle = ACCENT_2
        for (const b of bolts2) ctx!.fillRect(b.x, b.y, 10, 4)
        // P2 label
        ctx!.fillStyle = SPRITE_COLOR_2
        ctx!.font = "9px 'SFMono-Regular', Consolas, monospace"
        ctx!.textAlign = 'center'
        ctx!.fillText('P2', runner2.x + 12, r2DrawY - 10)
        ctx!.textAlign = 'left'
      }

      // ── Draw remote partner ghost (tab duo) ───────────────────────────
      if (isTabDuo) {
        const ghostX   = mySlot === 1 ? 96 : 48
        const ghostY   = remoteGround ? GROUND_Y - 8 * PIXEL : remoteY
        const ghostDuck = remoteDuck && remoteGround
        // Run the same gait cycle the local runner uses. Pinning the ghost to the idle
        // sprite made a partner who was actually sprinting look frozen in place.
        const ghostFrame = Math.floor(frame / 8) % RUNNER_FRAMES.length
        const ghostSp  = ghostDuck
          ? RUNNER_DUCK
          : remoteAlive && remoteGround
            ? RUNNER_FRAMES[ghostFrame]
            : RUNNER_SPRITE
        const ghostBob = !ghostDuck && remoteAlive && remoteGround && (ghostFrame === 1 || ghostFrame === 3) ? -1 : 0
        const ghostDrawY = (ghostDuck ? GROUND_Y - sprH(RUNNER_DUCK) : ghostY) + ghostBob
        ctx!.globalAlpha = remoteAlive ? 0.55 : 0.25
        drawOutline(ghostSp, ghostX, ghostDrawY, PIXEL, outline)
        drawSprite(ghostSp, ghostX, ghostDrawY, PIXEL, mySlot === 1 ? SPRITE_COLOR_2 : SPRITE_COLOR,
          mySlot === 1 ? ACCENT_2 : ACCENT)
        ctx!.globalAlpha = 1
        // Partner label + score
        ctx!.fillStyle = mySlot === 1 ? SPRITE_COLOR_2 : SPRITE_COLOR
        ctx!.font = "9px 'SFMono-Regular', Consolas, monospace"
        ctx!.textAlign = 'center'
        ctx!.fillText(`P${mySlot === 1 ? 2 : 1} ${String(remoteScore).padStart(5,'0')}`, ghostX + 12, ghostDrawY - 10)
        ctx!.textAlign = 'left'
      }

      // HUD
      ctx!.fillStyle = hudMuted
      ctx!.font = "13px 'SFMono-Regular', Consolas, monospace"
      ctx!.textBaseline = 'top'
      ctx!.textAlign = 'right'
      ctx!.fillText(`SCORE ${String(score).padStart(5, '0')}`, WIDTH - 20, 14)
      if (best > 0) ctx!.fillText(`BEST ${String(best).padStart(5, '0')}`, WIDTH - 20, 32)
      if (autoPlay) {
        ctx!.fillStyle = ACCENT
        ctx!.fillText(`AUTO · CAUTION ${aiCaution}`, WIDTH - 20, best > 0 ? 50 : 32)
      }

      ctx!.textAlign = 'left'
      ctx!.fillStyle = hudMuted
      ctx!.fillText('FIX', 20, 14)
      for (let i = 0; i < MAX_AMMO; i++) {
        ctx!.fillStyle = i < ammo ? ACCENT : FAINT
        ctx!.fillRect(52 + i * 12, 15, 8, 10)
      }

      if (comboWindow > 0) {
        ctx!.fillStyle = '#fbbf24'
        ctx!.font = "10px 'SFMono-Regular', Consolas, monospace"
        ctx!.fillText(`LINK ${combo}/3`, 20, 54)
      }
      if (shieldCharges > 0) {
        ctx!.fillStyle = '#22d3ee'
        ctx!.font = "10px 'SFMono-Regular', Consolas, monospace"
        ctx!.fillText(`FIREWALL ${'▣'.repeat(shieldCharges)}`, 20, 68)
      }
      if (surgeFrames > 0) {
        ctx!.fillStyle = '#fbbf24'
        ctx!.font = "10px 'SFMono-Regular', Consolas, monospace"
        ctx!.fillText(`OVERCLOCK ×2 ${Math.ceil(surgeFrames / 60)}s`, 20, 82)
      }
      if (rewardTimer > 0) {
        ctx!.fillStyle = rewardText.includes('FIREWALL') ? '#22d3ee' : '#fbbf24'
        ctx!.font = "11px 'SFMono-Regular', Consolas, monospace"
        ctx!.textAlign = 'center'
        ctx!.fillText(rewardText, WIDTH / 2, 28)
        ctx!.textAlign = 'left'
      }

      if (boss) {
        const title = `${boss.variant.label} P${boss.phase + 1}${boss.tier > 0 ? ` T${boss.tier}` : ''}`
        ctx!.fillStyle = hudMuted
        ctx!.fillText(title, 20, 36)
        // Boss names vary in length, so measure rather than assume a fixed bar offset.
        const barX = 20 + Math.ceil(ctx!.measureText(title).width) + 12
        for (let i = 0; i < boss.maxHp; i++) {
          ctx!.fillStyle = i < boss.hp ? boss.variant.color : FAINT
          ctx!.fillRect(barX + i * 12, 37, 8, 10)
        }
        if (boss.guardFrames > 0) {
          ctx!.fillStyle = '#22d3ee'
          ctx!.font = "9px 'SFMono-Regular', Consolas, monospace"
          ctx!.fillText('COUNTERMEASURE', 20, 50)
        }
      }

      if (!started || gameOver) {
        // No backdrop behind this block — it sits straight on the live sky, so it needs
        // the same theme-aware colors as the HUD above, not the fixed INK/#525252 pair.
        ctx!.fillStyle = hudPrimary
        ctx!.font = "15px 'SFMono-Regular', Consolas, monospace"
        ctx!.textAlign = 'center'
        ctx!.fillText(
          gameOver ? 'SYSTEM DOWN — SPACE TO RESTART' : 'PRESS SPACE OR TAP TO PLAY',
          WIDTH / 2,
          86,
        )
        ctx!.fillStyle = hudMuted
        ctx!.font = "12px 'SFMono-Regular', Consolas, monospace"
        ctx!.fillText('SPACE/W JUMP   S DUCK   X/ARROWS SHOOT   ESC PAUSE', WIDTH / 2, 110)
        ctx!.fillText('PURGE 3 TARGETS FAST — EARN FIREWALL + OVERCLOCK', WIDTH / 2, 126)
        ctx!.fillText('ALT+T TOGGLE AI AUTOPLAY', WIDTH / 2, 142)
      }
      if (paused && !gameOver && !won) {
        ctx!.fillStyle = 'rgba(255, 255, 255, 0.82)'
        ctx!.fillRect(0, 0, WIDTH, HEIGHT)
        ctx!.fillStyle = INK
        ctx!.font = "18px 'SFMono-Regular', Consolas, monospace"
        ctx!.textAlign = 'center'
        ctx!.fillText('PAUSED', WIDTH / 2, 82)
        ctx!.fillStyle = '#525252'
        ctx!.font = "12px 'SFMono-Regular', Consolas, monospace"
        ctx!.fillText('PRESS ESC TO RESUME', WIDTH / 2, 108)
      }
      if (won) {
        ctx!.fillStyle = 'rgba(255, 255, 255, 0.9)'
        ctx!.fillRect(0, 0, WIDTH, HEIGHT)
        ctx!.fillStyle = ACCENT
        ctx!.font = "20px 'SFMono-Regular', Consolas, monospace"
        ctx!.textAlign = 'center'
        ctx!.fillText('SYSTEM SECURED', WIDTH / 2, 40)
        ctx!.fillStyle = INK
        ctx!.font = "12px 'SFMono-Regular', Consolas, monospace"
        ctx!.fillText(`SCORE ${score}   FRAME ${frame}`, WIDTH / 2, 64)
        ctx!.fillStyle = '#525252'
        ctx!.font = "11px 'SFMono-Regular', Consolas, monospace"
        ctx!.fillText('FINAL TRANSMISSION', WIDTH / 2, 88)
        ctx!.fillStyle = ACCENT
        ctx!.font = "13px 'SFMono-Regular', Consolas, monospace"
        puzzleLines.forEach((line, i) => ctx!.fillText(line, WIDTH / 2, 106 + i * 18))
        ctx!.fillStyle = '#737373'
        ctx!.font = "10px 'SFMono-Regular', Consolas, monospace"
        ctx!.fillText('UNREADABLE — NO SYSTEM HAS EVER PARSED THIS', WIDTH / 2, 168)
        ctx!.fillStyle = '#525252'
        ctx!.font = "12px 'SFMono-Regular', Consolas, monospace"
        ctx!.fillText('SPACE TO RUN AGAIN', WIDTH / 2, 192)
      }
      ctx!.textAlign = 'left'

      raf = requestAnimationFrame(step)
    }

    // In local duo, P1 = WASD+X only; P2 = Arrows+Enter
    const JUMP_KEYS  = isLocalDuo ? new Set(['Space', 'KeyW']) : new Set(['Space', 'ArrowUp', 'KeyW'])
    const DUCK_KEYS  = isLocalDuo ? new Set(['KeyS'])          : new Set(['ArrowDown', 'KeyS'])
    const SHOOT_KEYS = isLocalDuo ? new Set(['KeyX', 'KeyF'])  : new Set(['KeyX', 'KeyF', 'ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'])
    const PAUSE_KEYS = new Set(['Escape'])
    // P2 keys (local duo only)
    const JUMP_KEYS_2  = new Set(['ArrowUp'])
    const DUCK_KEYS_2  = new Set(['ArrowDown'])
    const SHOOT_KEYS_2 = new Set(['Enter', 'NumpadEnter', 'ArrowLeft', 'ArrowRight'])

    function toggleAutoPlay() {
      autoPlay = !autoPlay
      ducking = false
      aiRestartTimer = 0
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.altKey && e.code === 'KeyT') {
        e.preventDefault()
        if (!e.repeat) toggleAutoPlay()
        return
      }
      if (PAUSE_KEYS.has(e.code)) {
        e.preventDefault()
        togglePause()
        return
      }
      // The AI drives jump/duck/shoot itself; manual input would only fight it.
      if (autoPlay) return
      if (JUMP_KEYS.has(e.code)) {
        e.preventDefault(); jump()
      } else if (DUCK_KEYS.has(e.code)) {
        e.preventDefault(); ducking = true
      } else if (SHOOT_KEYS.has(e.code)) {
        e.preventDefault(); shoot()
      }
      // P2 local duo controls
      if (isLocalDuo) {
        if (JUMP_KEYS_2.has(e.code)) { e.preventDefault(); jump2() }
        else if (DUCK_KEYS_2.has(e.code)) { e.preventDefault(); ducking2 = true }
        else if (SHOOT_KEYS_2.has(e.code)) { e.preventDefault(); shoot2() }
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (autoPlay) return
      if (DUCK_KEYS.has(e.code)) ducking = false
      if (isLocalDuo && DUCK_KEYS_2.has(e.code)) ducking2 = false
    }

    function onPointerDown() {
      if (autoPlay) return
      jump()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    canvas.addEventListener('pointerdown', onPointerDown)

    // ── Tab-duo: listen to partner state from BroadcastChannel ────────────
    let channelCleanup: (() => void) | null = null
    if (isTabDuo && duo?.channel) {
      const ch = duo.channel
      const onMsg = (e: MessageEvent) => {
        if (isRunnerStateMessage(e.data)) {
          remoteY      = e.data.y
          remoteGround = e.data.onGround
          remoteDuck   = e.data.ducking
          remoteAmmo   = e.data.ammo
          remoteScore  = e.data.score
          remoteAlive  = e.data.alive
          emit({ remoteAmmo, remoteScore })
          return
        }
        if (!isDuoAction(e.data)) return
        if (e.data.action === 'start') {
          started = true
        } else if (e.data.action === 'reset') {
          reset()
        } else if (e.data.action === 'pause') {
          paused = !paused
          ducking = false
        } else if (e.data.action === 'down') {
          endGame(false)
        } else if (e.data.action === 'shoot' && e.data.owner !== mySlot) {
          shootPartner(e.data.y, e.data.owner)
        }
      }
      ch.addEventListener('message', onMsg)
      channelCleanup = () => ch.removeEventListener('message', onMsg)
    }

    raf = requestAnimationFrame(step)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('pointerdown', onPointerDown)
      channelCleanup?.()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="runner-canvas"
      width={WIDTH}
      height={HEIGHT}
      role="img"
      aria-label="Ruvy-Runner: endless cyberpunk runner. Jump, duck, and shoot while dodging enemies and defeating bosses. Alt+T toggles AI autopilot."
    />
  )
}
