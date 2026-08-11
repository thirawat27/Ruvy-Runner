# Ruvy-Runner 🐙⚡

An endless cyberpunk runner where you jump, duck, and shoot your way through a pixel-art
world of bugs, errors, malware, and boss fights — solo, on a shared keyboard, or online
against a friend over a peer-to-peer WebRTC link.

Built with **[Ruvyxa](https://github.com/thirawat27/Ruvyxa/)**, a production-minded web
framework for React and TypeScript. Ruvyxa handles the file-system routing, the API route
(WebRTC signaling), SSR-first rendering, the production build, and deployment — so the game
itself can live as a single self-contained Canvas component.

---

## ✨ Features

- **Endless runner gameplay** — 60 fps canvas loop with pixel-perfect physics, parallax
  scenery, and animated sprites.
- **Shoot or dodge** — obstacles are hazards, but bosses can be fought with a regenerating
  shot meter (3 shots, auto-recharge).
- **Priority bounty loop** — shoot gold packets and link three purges quickly to earn a
  one-hit Firewall and a brief 2× score Overclock.
- **Hazards and bounty targets** — ground bugs, flying errors, and tall malware blocks force
  different responses, while gold packets create optional shooting objectives.
- **Five unique bosses** — HACKER, HUMAN ERROR, VIRUS, SYSTEM GLITCH, and HARDWARE FAULT.
  Each has its own 4-frame sprite loop, color scheme, and attack pattern.
- **Boss tier system** — bosses get tougher the longer you survive: more HP, faster fire
  rate, aggressive approach speed, and mixed-in attacks from other variants.
- **Rage mode** — bosses enrage at ≤50 % HP, boosting their fire rate and approach speed.
- **Adaptive boss AI** — bosses learn your habits, alter their attack lane, and patrol between
  flanking, rising, and diving hover points instead of parking in one position.
- **Distinct districts** — every 1,200 score opens a new map silhouette: Signal Flats,
  Ember Stacks, Night Lattice, or Tidal Mainframe. Each has a small assistive modifier
  (faster ammo, more bounties, longer Link time, or extra Firewall capacity).
- **Autopilot AI** (`Alt+T`) — a simulation-based bot that ignores harmless Bounties, plans
  jump/duck and duck-then-jump responses, and adjusts its caution level run over run.
- **DUO MODE** — local or online co-op on one shared route, with a shared score and fairer pacing (see below).
- **Saved score board** — keeps the best five completed runs in the current browser, even after refresh.
- **A real win state** — five objectives (score, boss kills, purges, overclock time, and a
  hidden marathon gate) that must be completed in a single unbroken run.

## 🎮 Controls

| Action       | Solo            | Local duo P1  | Local duo P2  |
| ------------ | --------------- | ------------- | ------------- |
| Jump / Start | `SPACE` / `W`   | `W`           | `↑`           |
| Duck         | `S`             | `S`           | `↓`           |
| Shoot        | `X`             | `X`           | `↵` (Enter)   |
| Pause        | `ESC`           | `ESC`         | `ESC`         |
| AI autopilot | `Alt+T`         | —             | —             |
| Touch        | Tap the canvas  | —             | —             |

- **Jump** — press `SPACE`/`W` to start the run; jump clears ground obstacles.
- **Duck** — hold `S` to slide under flying obstacles (a low hitbox).
- **Shoot** — press `X` to fire a bolt. Ammo regenerates over time, so spend it wisely on
  bosses and malware.
- **Pause** — `ESC` toggles pause.

## 👥 DUO MODE

Open the **🎮 DUO MODE** menu from the HUD and pick a way to play:

| Mode          | How it works                                                            |
| ------------- | ----------------------------------------------------------------------- |
| **LOCAL CO-OP** | Two runners on one keyboard. P1 uses `WASD + X`, P2 uses arrows + `↵`. Both share the same canvas and obstacles, each with their own ammo meter. |
| **HOST A ROOM** | Creates a 6-character room code. Share it with a friend; the room starts one co-op run when either player starts. |
| **JOIN A ROOM** | Enter a host's code to play the same seeded route, hazards, bosses, team score, and reset state. |

Online rooms use **WebRTC** (`RtcPeer`):

- A host creates a room on the signaling server and opens a DataChannel (`ruvy-duo`).
- The joiner polls for the host's SDP offer, answers, and both sides establish a direct
  peer-to-peer connection through public Google STUN servers.
- The DataChannel is **ordered and reliable** because start, shot, reset, and defeat actions
  must arrive in the same order for both copies of the shared route to stay in sync.
- The room code seeds the obstacle and boss stream identically for both peers. Each player
  still has an independent lane and ammo meter, while shots, hazards, team score, and a
  team defeat/reset are shared.

The peer is interface-compatible with `BroadcastChannel`, so the game can swap transports
without any code changes — same tab, two tabs, or two devices.

### 🧪 Signaling architecture

The whole signaling flow goes through one Ruvyxa API route, `app/api/signal/route.ts`
(a single `POST` endpoint with an `op` field in the JSON body):

```
{ op: 'create', code }                      → register an empty room
{ op: 'offer',  code, sdp }                 → host posts its SDP offer
{ op: 'answer', code, sdp }                 → joiner posts its SDP answer
{ op: 'poll',   code, want: 'offer'|'answer' } → poll for the other side's SDP
```

Rooms are held in a server-side in-memory map with a 15-minute garbage-collection sweep.
Once the SDP exchange completes, the signaling server is no longer involved — gameplay runs
over the peer-to-peer DataChannel.

## 👾 Enemies & Bosses

### Obstacles

| Enemy              | Type     | Response    |
| ------------------ | -------- | ----------- |
| Ground bugs        | Ground   | Jump        |
| Flying errors      | Air      | Duck        |
| Malware blocks     | Tall     | Jump (2 HP) |
| Priority bounty    | Gold packet | Shoot for a large score boost; harmless if missed |

### Bosses

| Boss            | Color             | Signature attack                                  |
| --------------- | ----------------- | ------------------------------------------------- |
| HACKER          | CRT phosphor green| **Burst** — high/low lane volleys that punish habits |
| HUMAN ERROR     | Amber             | **Drift** — arcing shots that settle into standing lane |
| VIRUS           | Magenta-pink      | **Split** — a clone shot splits off into the low lane |
| SYSTEM GLITCH   | Rose red          | **Flicker** — shots that flicker between lanes before locking in |
| HARDWARE FAULT  | Cyan              | **Slab** — a slow oversized wall you must jump     |

Every boss:

- Patrols between bounded flank, rise, and dive hover points while keeping a readable firing lane.
- Learns from you: crouch-heavy players draw low-lane fire, jump-heavy players draw high fire.
- Punishes sustained crouching with a ground-level shot that can only be jumped.
- Gains **multishot spread**, mixed attack patterns (from tier 3), and rage mode at low HP.
- Shifts through three health phases. Repeated fast hits trigger a visible **Countermeasure**
  guard: shots briefly bounce off while the boss sends a high-then-ground reply to dodge.

## 🏆 Scoring & Objectives

- **Score** climbs with distance; **Best** is saved in the current browser and flashes on new records.
- **Purges** count obstacles destroyed; **boss kills** track each variant.
- Districts rotate every `1,200` score points, with a long cross-fade before the next map.
- **Link rewards** turn three quick purges into one Firewall charge and five seconds of
  Overclocked 2× distance score. Firewall absorbs one collision and then has a short
  invulnerability window, making it a recovery tool rather than permanent safety.

There is no finish line you can run to. Winning requires completing **all five objectives in
a single unbroken life**:

| Objective                | Target        |
| ------------------------ | ------------- |
| Score                    | 1,000,000     |
| Kills of *each* boss     | 50 each       |
| Purges (obstacles shot)  | 10,000        |
| Overclocked frames       | 500,000       |
| Unbroken play time       | 10,000 hours* |

> \* A literal 10,000 hours of unpaused play in one life — effectively an endless Dino-style
> run with a real, reachable-if-absurd terminal state. The win screen shows a cosmetic
> "cipher" that is deliberately un-decodable (pure random noise with no encoded answer).

## 🤖 Autopilot AI

Press `Alt+T` to hand control to the built-in bot. Instead of rule-of-thumb timings, it:

1. Snapshots only lethal threats (obstacles + boss shots) into a simulation.
2. Evaluates candidate plans — "wait `N` frames, then commit to jump/duck or duck-then-jump" — by rolling the
   runner's real physics and hitboxes forward.
3. Picks the plan that survives the longest, mirroring split-clone and flicker behavior
   exactly so it never mispredicts.
4. Tracks a **caution** level that rises after each death and improves run over run.

## 🧱 Built with the Ruvyxa Framework

This project is built on **[Ruvyxa](https://github.com/thirawat27/Ruvyxa/)** — "Robust
Universal Validation & Yielding eXperience Application" — a production-minded web framework
built around clarity, speed, and control. Ruvyxa keeps routing, server logic, validation,
builds, and runtime output in one predictable workflow.

How this project uses it:

- **File-system routing** — `app/page.tsx` (home route) and `app/api/signal/route.ts`
  (the signaling API) are discovered automatically from the `app/` directory.
- **SSR-first React** — the page shell is server-rendered; the game uses `'use client'`
  because it is a browser-only interactive canvas.
- **API routes** — the signaling server is a plain `POST` export in `route.ts`, with
  in-memory room state stored on `globalThis`.
- **`ruvyxa.config.ts`** — server host/port, production build tuning (minify, route-level
  code splitting, tree-shaking, parallel workers), route & CSS caching, and image
  optimization (WebP, quality 82).
- **Production CLI** — `ruvyxa dev` (HMR dev server), `ruvyxa build`, `ruvyxa start`,
  `ruvyxa check`, `ruvyxa analyze`, `ruvyxa routes`, and more.

### Why Ruvyxa (highlights)

- **Rust core bundler** — TypeScript/JSX/Markdown/MDX compilation, tree-shaking, and
  Oxc-backed minification in one self-contained binary; no Rust toolchain needed.
- **Radix-trie routing** — O(path-depth) route resolution regardless of route count.
- **Persistent JS worker pool** — SSR without per-request subprocess overhead.
- **Five rendering strategies** — SSR (default), SSG, ISR, CSR, and PPR, per route.
- **Security by default** — server/client boundary enforcement, safe security headers,
  `RUVYXA_PUBLIC_`-only client env vars, action/API body limits and rate limiting.
- **11 deployment adapters** — zero-config output for Vercel, Netlify, Cloudflare, Node.js,
  Bun, Deno, Static, AWS Amplify, Firebase, Railway, and Render.
- **Diagnostics** — 60+ `RUV####` error codes with explanation and suggested fixes.

See the [Ruvyxa repository](https://github.com/thirawat27/Ruvyxa/) and its
[documentation](https://github.com/thirawat27/Ruvyxa/blob/main/docs/) for the full manual
(English and Thai editions).

## 🧰 Tech Stack

- **[Ruvyxa](https://github.com/thirawat27/Ruvyxa/)** `^1.0.27` — web framework, CLI, build
  system, API routes
- **[@ruvyxa/react](https://www.npmjs.com/package/@ruvyxa/react)** `^1.0.27` — React bindings
- **React / React DOM** `^19.2`
- **TypeScript** `^7.0`
- **WebRTC** — `RTCPeerConnection` + `RTCDataChannel` for peer-to-peer online play
- **BroadcastChannel** — same-browser tab-duo transport
- **Canvas 2D** — all rendering is hand-drawn pixel art (no game engine)

## 📁 Project Structure

```
ruvy-runner/
├── app/
│   ├── api/
│   │   └── signal/
│   │       └── route.ts          # WebRTC signaling server (create/offer/answer/poll)
│   ├── components/
│   │   ├── duo-protocol.ts       # Typed Duo transport and gameplay messages
│   │   ├── rtc-peer.ts           # WebRTC DataChannel peer (BroadcastChannel-compatible)
│   │   ├── score-storage.ts      # Browser-local top-five score persistence
│   │   └── ruvyxa-runner.tsx     # Canvas engine, rendering, and input wiring
│   ├── globals.css               # Global styles (HUD, duo modal, layout)
│   ├── layout.tsx                # Root layout + metadata
│   └── page.tsx                  # Home route: HUD, duo menu, WebRTC wiring
├── ruvyxa.config.ts              # Ruvyxa server/build/cache/image configuration
├── package.json
└── tsconfig.json
```

## 🚀 Getting Started

### Prerequisites

- **Node.js 22.12 or newer** (Ruvyxa recommends 22.13+; no Rust toolchain required)

### Install & run

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server with HMR
npm run dev
# → http://localhost:3000

# 3. Production build + preview
npm run build
npm run start      # production server
npm run preview    # serve the production output locally
```

### Verification & diagnostics

```bash
npm run typecheck   # tsc --noEmit
npm run check       # ruvyxa check (typecheck + parity + smoke render)
npm run routes      # list discovered routes
npm run analyze     # route/import/boundary diagnostics
npm run doctor      # project & environment health check
```

### All scripts

| Script               | Description                                        |
| -------------------- | -------------------------------------------------- |
| `npm run dev`        | Development server with HMR                        |
| `npm run build`      | Production build to `.ruvyxa/`                     |
| `npm run start`      | Production server                                  |
| `npm run preview`    | Serve the production output locally                |
| `npm run typecheck`  | TypeScript type check (`tsc --noEmit`)             |
| `npm run check`      | Typecheck + parity + smoke render                  |
| `npm run routes`     | Print discovered routes (`--json` for JSON)        |
| `npm run analyze`    | Route, import, and boundary diagnostics            |
| `npm run adds`       | Scaffold a framework-native feature                |
| `npm run doctor`     | Diagnose project and environment issues            |
| `npm run clean`      | Remove generated build output                      |
| `npm run trace`      | Inspect one route-manifest entry                   |
| `npm run bench`      | Benchmark discovery, analysis, and build           |
| `npm run test:parity`| Compare dev and production routes                  |
| `npm run plugin`     | Scaffold a plugin package                          |

> For `pnpm`, `yarn`, or `bun`, use the equivalent command. Pass CLI arguments after `--`,
> e.g. `npm run analyze -- --format sarif --output reports/ruvyxa.sarif`.

## ⚙️ Configuration

`ruvyxa.config.ts` controls the framework's behavior:

```ts
server: { host: 'localhost', port: 3000 },   // dev/prod server
build:  { minify, treeShake, split: 'route', workers: 4 },
cache:  { routes: true, css: true },
debug:  { overlay: true },                   // in-browser error overlay in dev
image:  { optimize: true, quality: 82 },     // WebP pipeline
```

For online duo to work, both players must reach the **same server URL** so they can poll the
same signaling room — host it (e.g. with `npm run start`) or deploy it and share the URL.

## ☁️ Deployment

Ruvyxa ships zero-config adapters for **Vercel, Netlify, Cloudflare, Node.js, Bun, Deno,
Static, AWS Amplify, Firebase, Railway, and Render**. Build with `ruvyxa build` and deploy
the generated `.ruvyxa/` output through your platform's adapter.

> Note: the in-memory signaling store means all players must hit the *same instance*.
> For a horizontally scaled deployment, back the room store with a shared cache (e.g. Redis)
> or swap the signaling route for a hosted solution.

## 📄 License

This project is licensed under the [Apache License 2.0](LICENSE).
