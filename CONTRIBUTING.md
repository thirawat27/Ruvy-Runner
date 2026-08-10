# Contributing to Ruvy-Runner

First off, thank you for taking the time to contribute! 🐙

Ruvy-Runner is an open-source endless cyberpunk runner built with the
[Ruvyxa Framework](https://github.com/thirawat27/Ruvyxa/). Contributions of all kinds are
welcome — code, bug reports, feature ideas, documentation, translations, and design polish.

By participating in this project you agree to abide by our
[Code of Conduct](CODE_OF_CONDUCT.md).

---

## Table of Contents

- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Where to Start](#where-to-start)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Checks Before Submitting](#checks-before-submitting)
- [Commit Messages](#commit-messages)
- [Opening a Pull Request](#opening-a-pull-request)
- [Reporting Bugs](#reporting-bugs)
- [Feature Requests](#feature-requests)

## Getting Started

### Prerequisites

- **Node.js 22.12 or newer** (Ruvyxa recommends 22.13+). No Rust toolchain is required —
  the Ruvyxa CLI ships prebuilt binaries.
- A package manager: `npm` (used in examples), or `pnpm` / `yarn` / `bun`.

### Install & run locally

```bash
# 1. Fork the repository and clone your fork
git clone https://github.com/<your-username>/ruvy-runner.git
cd ruvy-runner

# 2. Install dependencies
npm install

# 3. Start the dev server with HMR
npm run dev
# → http://localhost:3000
```

That's it. The game renders on the home route and the WebRTC signaling endpoint lives at
`/api/signal`.

## Project Structure

```
ruvy-runner/
├── app/
│   ├── api/
│   │   └── signal/route.ts       # WebRTC signaling server (create/offer/answer/poll)
│   ├── components/
│   │   ├── rtc-peer.ts           # WebRTC DataChannel peer (BroadcastChannel-compatible)
│   │   └── ruvyxa-runner.tsx     # The entire game: engine, sprites, bosses, AI, rendering
│   ├── globals.css               # Global styles (HUD, duo modal, layout)
│   ├── layout.tsx                # Root layout + metadata
│   └── page.tsx                  # Home route: HUD, duo menu, WebRTC wiring
├── ruvyxa.config.ts              # Ruvyxa server/build/cache/image configuration
├── AGENTS.md                     # Agent/contributor rules — read this first
├── CLAUDE.md                     # Framework command reference
└── package.json
```

## Where to Start

Looking for something to work on? A few ideas:

- **Sprites & art** — new boss variants, obstacle silhouettes, background themes. Each
  sprite is a simple array of pixel rows; look at the `*_SPRITES` / `*_FRAMES` constants in
  `app/components/ruvyxa-runner.tsx`.
- **Game balance** — difficulty tuning lives in named constants at the top of
  `ruvyxa-runner.tsx` (`MAX_AMMO`, `THEME_STEP`, `BOSS_MIX_TIER`, win objectives, etc.).
- **Polish** — animations, particles, audio hooks, HUD interactions.
- **Docs** — the README, this guide, or Thai translations of any document.
- **Infrastructure** — the in-memory signaling store in `route.ts` could be swapped for a
  shared cache so rooms survive multi-instance deployments.

If you're unsure, open an issue or a discussion first so we can align on the direction.

## Development Workflow

1. **Fork & branch** — work on a descriptively named branch, e.g. `feat/new-boss` or
   `fix/duo-timeout`. One logical change per branch.
2. **Keep changes small** — prefer minimal, focused diffs. Read `AGENTS.md` and `CLAUDE.md`
   first; they are the source of truth for project conventions.
3. **Don't surprise reviewers** — if a change is large or opinionated, discuss it in an
   issue before writing code.
4. **Open a PR** against the `main` branch (see
   [Opening a Pull Request](#opening-a-pull-request)).

## Code Style

- **TypeScript, strict mode** — the project compiles with `"strict": true`. New code must
  type-check cleanly.
- **Existing conventions over new ones** — match the surrounding code. The game engine is a
  single self-contained component with named constants, pure helper functions, and Canvas 2D
  drawing helpers (`drawSprite`, `drawOutline`); keep that shape.
- **Comments** — the codebase uses explanatory comments heavily (the *why*, not just the
  *what*). Preserve that style when touching existing logic.
- **No runtime dependencies** — the game deliberately has zero game-engine dependencies.
  Before adding a dependency, consider whether a few lines of canvas code would do.
- **Formatting** — follow the existing formatting; there is no external formatter
  configured, so match the file you're editing.

## Checks Before Submitting

Run the narrowest useful check while iterating:

```bash
npm run typecheck   # tsc --noEmit
```

Before opening a PR, run the full app-level checks:

```bash
npm run check       # ruvyxa check (typecheck + parity + smoke render)
```

If your change touches routing, rendering, styling, config, or production behavior, also
run:

```bash
npm run build       # ruvyxa build
```

**Manual testing tips**

- Solo gameplay: `SPACE`/`W` jump, `S` duck, `X` shoot, `ESC` pause, `Alt+T` autopilot.
- DUO modes: local co-op (same keyboard), Host a Room / Join a Room (WebRTC). Test the
  online flow with two browser windows or two devices reaching the same server URL.

## Commit Messages

Write concise, conventional-style commit messages:

```
feat: add new boss variant (TROJAN)
fix: resolve signaling timeout on slow networks
docs: expand contributing guide
style: align sprite constants
```

Describe *what* and *why* in the body when it isn't obvious from the subject line.

## Opening a Pull Request

1. Ensure your branch is up to date with `main`.
2. Fill out the [pull request template](.github/PULL_REQUEST_TEMPLATE.md) — describe what
   changed, why, and how you tested it.
3. Make sure `npm run typecheck` and `npm run check` pass.
4. If your change alters exported symbols, update every reference (spawn a code search for
   usages if needed).
5. A maintainer will review; expect feedback and don't take it personally. 😄

## Reporting Bugs

Before opening a bug report, please:

- Search the [issues](https://github.com/thirawat27/ruvy-runner/issues) to see if it was
  already reported.
- Check the [troubleshooting section of the Ruvyxa docs](https://github.com/thirawat27/Ruvyxa/blob/main/docs/)
  in case the symptom is framework-level.

Then use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml) and include:

- Browser, OS, and device (especially for WebRTC/duo issues).
- Steps to reproduce.
- Expected vs. actual behavior.
- Console errors, if any.

## Feature Requests

Ideas are welcome! Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.yml)
and describe the problem you're solving, not just the solution you want. This helps us
design features that fit the game's direction.
