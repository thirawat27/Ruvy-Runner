// rtc-peer.ts — WebRTC DataChannel peer helper (no 'use client' needed, pure TS class)

// WebRTC DataChannel peer helper.
// Interface is intentionally duck-typed to match BroadcastChannel so the game runner
// can use either transport without any code changes.
//
// Connection flow (non-trickle ICE — gather all candidates before posting SDP):
//   slot 1 (host)  : createDataChannel → createOffer → POST offer → poll answer → DataChannel opens
//   slot 2 (joiner): ondatachannel     → poll offer  → createAnswer → POST answer → DataChannel opens

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
]

export class RtcPeer {
  private pc: RTCPeerConnection
  private dc: RTCDataChannel | null = null
  private msgListeners = new Set<(e: MessageEvent) => void>()
  private polling = false
  private closed  = false

  /** Fires when the DataChannel is open and the game can start. */
  onopen:    (() => void) | null = null
  /** Fires when connection fails or times out. */
  onerror:   ((err: Error) => void) | null = null
  /** Fires on every inbound message (BroadcastChannel-compatible). */
  onmessage: ((e: MessageEvent) => void) | null = null

  constructor(private code: string, private slot: 1 | 2) {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    void this.init()
  }

  private async init() {
    try {
      if (this.slot === 1) await this.initHost()
      else                 await this.initJoiner()
    } catch (err) {
      if (!this.closed) this.onerror?.(err instanceof Error ? err : new Error(String(err)))
    }
  }

  // ── Host side ──────────────────────────────────────────────────────────────
  private async initHost() {
    // A shared deterministic world must receive every start, shot, restart, and defeat
    // action in order. The payload is tiny, so correctness beats lossy state updates.
    const dc = this.pc.createDataChannel('ruvy-duo', { ordered: true })
    this.setupDc(dc)

    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)
    await this.waitForIceGathering()

    await this.postSdp('offer', this.pc.localDescription!.sdp)

    this.polling = true
    const answerSdp = await this.pollFor('answer')
    if (!answerSdp || this.closed) return
    await this.pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })
  }

  // ── Joiner side ────────────────────────────────────────────────────────────
  private async initJoiner() {
    this.pc.ondatachannel = (e) => this.setupDc(e.channel)

    this.polling = true
    const offerSdp = await this.pollFor('offer')
    if (!offerSdp || this.closed) return

    await this.pc.setRemoteDescription({ type: 'offer', sdp: offerSdp })
    const answer = await this.pc.createAnswer()
    await this.pc.setLocalDescription(answer)
    await this.waitForIceGathering()

    await this.postSdp('answer', this.pc.localDescription!.sdp)
    // DataChannel will arrive via ondatachannel callback above.
  }

  // ── Shared helpers ──────────────────────────────────────────────────────────
  private setupDc(dc: RTCDataChannel) {
    this.dc = dc
    dc.binaryType = 'arraybuffer'
    dc.onopen = () => this.onopen?.()
    dc.onerror = () => this.onerror?.(new Error('DataChannel error'))
    dc.onmessage = (e) => {
      let data: unknown = e.data
      if (typeof data === 'string') {
        try { data = JSON.parse(data) as unknown } catch { /* keep raw string */ }
      }
      const ev = new MessageEvent('message', { data })
      this.onmessage?.(ev)
      this.msgListeners.forEach(cb => cb(ev))
    }
  }

  private waitForIceGathering(): Promise<void> {
    return new Promise(resolve => {
      if (this.pc.iceGatheringState === 'complete') { resolve(); return }
      const onStateChange = () => {
        if (this.pc.iceGatheringState === 'complete') {
          this.pc.removeEventListener('icegatheringstatechange', onStateChange)
          resolve()
        }
      }
      this.pc.addEventListener('icegatheringstatechange', onStateChange)
      // Safety timeout — some networks are slow to gather.
      setTimeout(resolve, 9000)
    })
  }

  private async postSdp(type: 'offer' | 'answer', sdp: string) {
    await fetch('/api/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: type, code: this.code, sdp }),
    })
  }

  private async pollFor(want: 'offer' | 'answer', timeoutMs = 35_000): Promise<string | null> {
    const deadline = Date.now() + timeoutMs
    while (this.polling && !this.closed) {
      if (Date.now() >= deadline) {
        this.onerror?.(new Error('Signaling timeout — check that both devices use the same server URL'))
        return null
      }
      try {
        const res  = await fetch('/api/signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ op: 'poll', code: this.code, want }),
        })
        if (res.ok) {
          const data = (await res.json()) as { found: boolean; sdp?: string | null }
          if (data.found && data.sdp) return data.sdp
        }
      } catch { /* network hiccup — retry */ }
      await new Promise(r => setTimeout(r, 700))
    }
    return null
  }

  // ── BroadcastChannel-compatible public API ─────────────────────────────────
  postMessage(data: unknown) {
    if (this.dc?.readyState === 'open') {
      try { this.dc.send(JSON.stringify(data)) } catch { /* channel closing */ }
    }
  }

  addEventListener(_type: string, listener: (e: MessageEvent) => void) {
    this.msgListeners.add(listener)
  }

  removeEventListener(_type: string, listener: (e: MessageEvent) => void) {
    this.msgListeners.delete(listener)
  }

  close() {
    this.closed  = true
    this.polling = false
    try { this.dc?.close()  } catch { /* already closed */ }
    try { this.pc.close()   } catch { /* already closed */ }
  }
}
