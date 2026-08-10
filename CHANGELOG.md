# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial open-source documentation set: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
  `SECURITY.md`, `CHANGELOG.md`, and GitHub issue/PR templates.

## [0.1.0] - 2026-08-10

### Added

- **Endless runner gameplay** — 60 fps Canvas 2D engine with pixel-perfect physics,
  jump / duck / shoot mechanics, and a regenerating ammo meter.
- **Obstacles** — ground bugs, flying errors, and tall malware blocks (2 HP).
- **Five bosses** — HACKER, HUMAN ERROR, VIRUS, SYSTEM GLITCH, and HARDWARE FAULT, each
  with a unique 4-frame sprite animation, color scheme, and attack pattern
  (burst / drift / split / flicker / slab).
- **Boss tier system** — HP, fire rate, approach speed, and multishot spread scale with
  tier; bosses enrage at ≤50 % HP and mix in other variants' attacks from tier 3.
- **Adaptive boss AI** — bosses observe duck-vs-jump habits and punish the dominant one;
  sustained crouching triggers an un-crouchable ground shot.
- **Dynamic themes** — four day/night palettes that rotate and cross-fade as score climbs,
  with parallax clouds, hills, towers, pebbles, birds, and twinkling stars.
- **Autopilot AI** (`Alt+T`) — simulation-based planner that evaluates jump/duck plans
  against a physics-rolled threat model and adapts a caution level run over run.
- **DUO MODE** — three ways to play:
  - Local co-op on a shared keyboard (P1: `WASD + X`, P2: arrows + `↵`).
  - Online host/join rooms over WebRTC via a `BroadcastChannel`-compatible `RtcPeer`
    (unordered/unreliable DataChannel through public STUN servers).
  - Tab-duo via `BroadcastChannel`.
- **Signaling server** — `POST /api/signal` API route with `create` / `offer` / `answer` /
  `poll` operations and in-memory room storage with a 15-minute GC sweep.
- **Win state** — five single-life objectives: 1,000,000 score, 50 kills of each boss,
  10,000 purges, 500,000 overclocked frames, and 10,000 hours of unbroken play.
- **HUD & UI** — score/best readout, boss HP bar with tier badge, ammo pips, pause, duo
  modal with room-code flow, connection toast, and new-best flash.
- **Accessibility** — keyboard and touch (tap to jump) controls, `aria-label` on the game
  canvas.
- **Ruvyxa framework integration** — SSR-first page shell, `'use client'` game component,
  `ruvyxa.config.ts` (server, build split, caching, image optimization), and full CLI
  script set.

### Security

- Server/client boundary enforcement and Ruvyxa default secure headers.

[Unreleased]: https://github.com/thirawat27/ruvy-runner/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/thirawat27/ruvy-runner/releases/tag/v0.1.0
