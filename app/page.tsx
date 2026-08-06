'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import RuvyxaRunner, { type DuoConfig } from './components/ruvyxa-runner'
import { RtcPeer } from './components/rtc-peer'

/* ─────────────────────────────────────────────────────────────────────────────
   Helper: generate a 6-char alphanumeric room code
───────────────────────────────────────────────────────────────────────────── */
function makeCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

/* ─────────────────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────────────── */
type DuoStep = 'off' | 'menu' | 'local' | 'hosting' | 'joining' | 'connected'

export default function Home() {
  const shellRef = useRef<HTMLDivElement>(null)

  /* HUD state synced from the game loop via CustomEvent */
  const [score,      setScore]      = useState(0)
  const [best,       setBest]       = useState(0)
  const [ammo,       setAmmo]       = useState(3)
  const [ammo2,      setAmmo2]      = useState(3)
  const [bossName,   setBossName]   = useState<string | null>(null)
  const [bossHp,     setBossHp]     = useState(0)
  const [bossMaxHp,  setBossMaxHp]  = useState(0)
  const [bossTierN,  setBossTierN]  = useState(0)
  const [isNewBest,  setIsNewBest]  = useState(false)
  const [isDuo,      setIsDuo]      = useState(false)
  const [remoteScore, setRemoteScore] = useState(0)

  /* DUO modal state */
  const [duoStep,    setDuoStep]    = useState<DuoStep>('off')
  const [roomCode,   setRoomCode]   = useState('')
  const [joinInput,  setJoinInput]  = useState('')
  const [peerStatus, setPeerStatus] = useState<
    'idle' | 'creating' | 'signaling' | 'connecting' | 'connected' | 'error'
  >('idle')

  /* Peer ref — holds RtcPeer for online or nothing for local */
  const peerRef = useRef<{ close(): void } | null>(null)
  const [duoConfig, setDuoConfig]   = useState<DuoConfig | null>(null)

  /* ── Listen to game-loop events ── */
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail
      if (d.score  !== undefined) setScore(d.score)
      if (d.best   !== undefined) {
        setBest(prev => {
          if (d.best > prev) {
            setIsNewBest(true)
            setTimeout(() => setIsNewBest(false), 1400)
          }
          return d.best
        })
      }
      if (d.ammo      !== undefined) setAmmo(d.ammo)
      if (d.ammo2     !== undefined) setAmmo2(d.ammo2)
      if (d.duo       !== undefined) setIsDuo(!!d.duo)
      if (d.bossName  !== undefined) setBossName(d.bossName as string | null)
      if (d.bossHp    !== undefined) setBossHp(d.bossHp as number)
      if (d.bossMaxHp !== undefined) setBossMaxHp(d.bossMaxHp as number)
      if (d.bossTier  !== undefined) setBossTierN(d.bossTier as number)
      if (d.remoteScore !== undefined) setRemoteScore(d.remoteScore as number)
      if (d.gameOver === true) {
        shellRef.current?.classList.add('flash')
        setTimeout(() => shellRef.current?.classList.remove('flash'), 500)
      }
    }
    window.addEventListener('ruvy-state', handler)
    return () => window.removeEventListener('ruvy-state', handler)
  }, [])

  /* ── WebRTC helpers ── */

  /** Close any existing peer/channel before opening a new one. */
  function closePeer() {
    peerRef.current?.close()
    peerRef.current = null
  }

  const startHost = useCallback(() => {
    const code = makeCode()
    setRoomCode(code)
    setPeerStatus('creating')
    setDuoStep('hosting')

    // Register the room on the signaling server so the joiner can find it.
    fetch('/api/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'create', code }),
    }).catch(() => {})

    closePeer()
    const peer = new RtcPeer(code, 1)
    peerRef.current = peer
    setPeerStatus('signaling')

    peer.onopen = () => {
      setPeerStatus('connected')
      setDuoConfig({ mode: 'rtc', slot: 1, channel: peer })
      setDuoStep('connected')
      setIsDuo(true)
    }
    peer.onerror = () => {
      setPeerStatus('error')
      peer.close()
    }
  }, [])

  const joinRoom = useCallback(() => {
    const code = joinInput.trim().toUpperCase()
    if (code.length < 6) return

    closePeer()
    setPeerStatus('signaling')
    setDuoStep('joining')
    setRoomCode(code)

    const peer = new RtcPeer(code, 2)
    peerRef.current = peer

    peer.onopen = () => {
      setPeerStatus('connected')
      setDuoConfig({ mode: 'rtc', slot: 2, channel: peer })
      setDuoStep('connected')
      setIsDuo(true)
    }
    peer.onerror = () => {
      setPeerStatus('error')
      peer.close()
    }
  }, [joinInput])

  const startLocalDuo = useCallback(() => {
    setDuoConfig({ mode: 'local' })
    setDuoStep('local')
    setIsDuo(true)
  }, [])

  const exitDuo = useCallback(() => {
    closePeer()
    setDuoConfig(null)
    setDuoStep('off')
    setIsDuo(false)
    setPeerStatus('idle')
    setJoinInput('')
    setRoomCode('')
  }, [])

  /* ── Derived display strings ── */
  const scoreStr = String(score).padStart(6, '0')
  const bestStr  = String(best).padStart(6, '0')
  const hpPct    = bossMaxHp > 0 ? Math.max(0, (bossHp / bossMaxHp) * 100) : 0
  const maxAmmo  = 3

  return (
    <div className="game-shell" ref={shellRef}>

      {/* ── TOP HUD ── */}
      <div className="game-hud-top">
        <div className="hud-logo">
          <div className="hud-logo-dot" />
          <span>RUVY-RUNNER</span>
          {isDuo && (
            <span className="duo-badge">
              {duoStep === 'local' ? '⚡ LOCAL DUO' : `🌐 ONLINE DUO`}
            </span>
          )}
        </div>

        <div className="hud-score-group">
          {isDuo && duoStep === 'connected' && (
            <>
              <div className="hud-stat">
                <div className="hud-stat-label" style={{ color: '#fb923c' }}>P2 SCORE</div>
                <div className="hud-stat-value" style={{ color: '#fb923c' }}>
                  {String(remoteScore).padStart(6, '0')}
                </div>
              </div>
              <div className="hud-divider" />
            </>
          )}
          <div className="hud-stat">
            <div className="hud-stat-label">Score</div>
            <div className="hud-stat-value">{scoreStr}</div>
          </div>
          <div className="hud-divider" />
          <div className="hud-stat">
            <div className="hud-stat-label">Best</div>
            <div className={`hud-stat-value${isNewBest ? ' new-best' : ''}`}>{bestStr}</div>
          </div>
        </div>
      </div>

      {/* ── CANVAS ── */}
      <div className="game-canvas-wrap">
        <div className="runner" style={{ position: 'relative' }}>
          {/* Boss HP bar */}
          <div className={`boss-hud${bossName ? ' visible' : ''}`}>
            <div className="boss-label-row">
              <span className="boss-name">{bossName ?? ''}</span>
              {bossTierN > 0 && <span className="boss-tier">TIER {bossTierN}</span>}
            </div>
            <div className="boss-hp-track">
              <div className="boss-hp-fill" style={{ width: `${hpPct}%` }} />
            </div>
          </div>

          <RuvyxaRunner key={JSON.stringify(duoConfig)} duoConfig={duoConfig} />
        </div>
      </div>

      {/* ── BOTTOM HUD ── */}
      <div className="game-hud-bottom">
        <div className="hud-controls">
          {isDuo && duoStep === 'local' ? (
            <>
              <span className="player-tag p1">P1</span>
              <div className="hud-key"><span className="key-badge">W</span> Jump</div>
              <div className="hud-key"><span className="key-badge">S</span> Duck</div>
              <div className="hud-key"><span className="key-badge">X</span> Shoot</div>
              <div className="hud-sep" />
              <span className="player-tag p2">P2</span>
              <div className="hud-key"><span className="key-badge">↑</span> Jump</div>
              <div className="hud-key"><span className="key-badge">↓</span> Duck</div>
              <div className="hud-key"><span className="key-badge">↵</span> Shoot</div>
            </>
          ) : (
            <>
              <div className="hud-key"><span className="key-badge">SPACE / W</span> Jump</div>
              <div className="hud-key"><span className="key-badge">S</span> Duck</div>
              <div className="hud-key"><span className="key-badge">X</span> Shoot</div>
              <div className="hud-key"><span className="key-badge">ESC</span> Pause</div>
              <div className="hud-key"><span className="key-badge">ALT+T</span> AI</div>
            </>
          )}
        </div>

        <div className="hud-right">
          {isDuo && duoStep === 'local' && (
            <div className="hud-ammo-group">
              <div className="hud-ammo">
                <span className="hud-ammo-label p1-label">P1</span>
                <div className="hud-ammo-pips">
                  {Array.from({ length: maxAmmo }).map((_, i) => (
                    <div key={i} className={`ammo-pip${i < ammo ? ' filled' : ' empty'}`} />
                  ))}
                </div>
              </div>
              <div className="hud-ammo">
                <span className="hud-ammo-label p2-label">P2</span>
                <div className="hud-ammo-pips">
                  {Array.from({ length: maxAmmo }).map((_, i) => (
                    <div key={i} className={`ammo-pip p2${i < ammo2 ? ' filled' : ' empty'}`} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {(!isDuo || duoStep !== 'local') && (
            <div className="hud-ammo">
              <span className="hud-ammo-label">Ammo</span>
              <div className="hud-ammo-pips">
                {Array.from({ length: maxAmmo }).map((_, i) => (
                  <div key={i} className={`ammo-pip${i < ammo ? ' filled' : ' empty'}`} />
                ))}
              </div>
            </div>
          )}

          {/* DUO button */}
          {duoStep === 'off' ? (
            <button className="duo-btn" onClick={() => setDuoStep('menu')}>
              🎮 DUO MODE
            </button>
          ) : (
            <button className="duo-btn exit" onClick={exitDuo}>
              ✕ EXIT DUO
            </button>
          )}
        </div>
      </div>

      {/* ── DUO MODAL ── */}
      {(duoStep === 'menu' || duoStep === 'hosting' || duoStep === 'joining') && (
        <div className="duo-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setDuoStep('off')}>
          <div className="duo-modal">
            <div className="duo-modal-header">
              <div className="duo-modal-title">⚡ DUO MODE</div>
              <button className="duo-modal-close" onClick={() => setDuoStep('off')}>✕</button>
            </div>

            {duoStep === 'menu' && (
              <div className="duo-modal-body">
                <p className="duo-modal-desc">Play together with a friend!</p>

                <div className="duo-option-grid">
                  <button className="duo-option-card" onClick={startLocalDuo}>
                    <div className="duo-option-icon">🎮</div>
                    <div className="duo-option-title">LOCAL CO-OP</div>
                    <div className="duo-option-desc">
                      Same keyboard<br />
                      <span className="duo-option-keys">P1: WASD+X &nbsp;·&nbsp; P2: Arrows+↵</span>
                    </div>
                  </button>

                  <button className="duo-option-card" onClick={startHost}>
                    <div className="duo-option-icon">📡</div>
                    <div className="duo-option-title">HOST A ROOM</div>
                    <div className="duo-option-desc">
                      Create a room code<br />
                      <span className="duo-option-keys">Share with your friend</span>
                    </div>
                  </button>

                  <button className="duo-option-card" onClick={() => setDuoStep('joining')}>
                    <div className="duo-option-icon">🔗</div>
                    <div className="duo-option-title">JOIN A ROOM</div>
                    <div className="duo-option-desc">
                      Enter a room code<br />
                      <span className="duo-option-keys">Get from your friend</span>
                    </div>
                  </button>
                </div>

                <div className="duo-modal-note">
                  🌐 Online rooms use WebRTC — works across devices on any network.
                  Both players open this page, then share the room code.
                </div>
              </div>
            )}

            {duoStep === 'hosting' && (
              <div className="duo-modal-body">
                <div className="duo-status-icon">📡</div>
                <div className="duo-status-text">
                  {peerStatus === 'creating'  ? 'Creating room…' :
                   peerStatus === 'signaling' ? '🔄 Waiting for friend to join…' :
                   peerStatus === 'error'     ? '❌ Connection failed. Try again.' :
                   'Waiting for friend to join…'}
                </div>
                <div className="duo-room-code">{roomCode}</div>
                <div className="duo-room-label">ROOM CODE — share with your friend</div>
                <div className="duo-pulse-ring" />
                <button className="duo-cancel-btn" onClick={() => { setDuoStep('menu'); setPeerStatus('idle'); peerRef.current?.close() }}>← Back</button>
              </div>
            )}

            {duoStep === 'joining' && (
              <div className="duo-modal-body">
                <div className="duo-status-icon">🔗</div>
                <div className="duo-status-text">
                  {peerStatus === 'signaling'   ? '🔄 Exchanging connection info…' :
                   peerStatus === 'connecting'  ? '⚡ Establishing P2P link…' :
                   peerStatus === 'error'       ? '❌ Room not found or timed out.' :
                   'Enter the room code from your friend'}
                </div>
                {(peerStatus === 'idle' || peerStatus === 'error') && (
                  <>
                    <input
                      className="duo-code-input"
                      placeholder="XXXXXX"
                      maxLength={6}
                      value={joinInput}
                      onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
                      autoFocus
                    />
                    <button className="duo-join-btn" onClick={joinRoom} disabled={joinInput.length < 6}>
                      JOIN ROOM →
                    </button>
                  </>
                )}
                {peerStatus === 'signaling' && (
                  <div className="duo-pulse-ring" />
                )}
                <button className="duo-cancel-btn" onClick={() => { setDuoStep('menu'); setPeerStatus('idle'); peerRef.current?.close() }}>
                  ← Back
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Connection success toast */}
      {peerStatus === 'connected' && duoStep === 'connected' && (
        <div className="duo-toast">🎮 DUO CONNECTED — {roomCode} — LET'S GO!</div>
      )}
    </div>
  )
}
