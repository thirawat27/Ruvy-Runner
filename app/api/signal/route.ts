// Signaling server — ALL operations go through a single POST endpoint.
// The operation type and room code are in the JSON body, NOT in query params,
// because Ruvyxa's API route runner does not expose req.url reliably.
//
// Body shapes:
//   { op: 'create',  code }                → create empty room
//   { op: 'offer',   code, sdp }           → host posts its SDP offer
//   { op: 'answer',  code, sdp }           → joiner posts its SDP answer
//   { op: 'poll',    code, want: 'offer' | 'answer' }  → poll for the other side's SDP

type Room = {
  offer:   string | null
  answer:  string | null
  created: number
}

const g = globalThis as typeof globalThis & { __ruvy_rooms?: Map<string, Room> }
if (!g.__ruvy_rooms) g.__ruvy_rooms = new Map<string, Room>()
const rooms = g.__ruvy_rooms

function gc() {
  const cutoff = Date.now() - 15 * 60 * 1000
  for (const [k, v] of rooms) {
    if (v.created < cutoff) rooms.delete(k)
  }
}

type SignalBody =
  | { op: 'create';  code: string }
  | { op: 'offer';   code: string; sdp: string }
  | { op: 'answer';  code: string; sdp: string }
  | { op: 'poll';    code: string; want: 'offer' | 'answer' }

export async function POST({ request }: { request: Request }) {
  gc()

  let body: SignalBody
  try {
    body = (await request.json()) as SignalBody
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const code = body.code?.toUpperCase?.()
  if (!code) return Response.json({ error: 'missing code' }, { status: 400 })

  switch (body.op) {
    case 'create': {
      rooms.set(code, { offer: null, answer: null, created: Date.now() })
      return Response.json({ ok: true })
    }

    case 'offer': {
      if (!body.sdp) return Response.json({ error: 'missing sdp' }, { status: 400 })
      const existing = rooms.get(code)
      if (existing) {
        existing.offer = body.sdp
      } else {
        rooms.set(code, { offer: body.sdp, answer: null, created: Date.now() })
      }
      return Response.json({ ok: true })
    }

    case 'answer': {
      if (!body.sdp) return Response.json({ error: 'missing sdp' }, { status: 400 })
      const room = rooms.get(code)
      if (!room) return Response.json({ error: 'room not found' }, { status: 404 })
      room.answer = body.sdp
      return Response.json({ ok: true })
    }

    case 'poll': {
      const room = rooms.get(code)
      if (!room) return Response.json({ found: false })
      const sdp = body.want === 'offer' ? room.offer : room.answer
      return Response.json({ found: !!sdp, sdp: sdp ?? null })
    }

    default:
      return Response.json({ error: 'unknown op' }, { status: 400 })
  }
}
