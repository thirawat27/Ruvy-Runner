# Security Policy

We take the security of Ruvy-Runner seriously. Thank you for helping us keep the project
and its users safe.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | ✅ Currently supported |
| < 0.1   | ❌ Not supported      |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

To report a security problem, use **GitHub Private Vulnerability Reporting**:

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability** → **New advisory**.
3. Provide as much detail as possible:

   - A description of the vulnerability and its impact.
   - Steps to reproduce (or a minimal proof-of-concept).
   - Affected files or endpoints (e.g. `app/api/signal/route.ts`).
   - Your environment: browser, OS, device, and whether it involves WebRTC/duo mode.

   > If the repository isn't hosted at the location you expected, file the report through
   > the private advisory form and include the repo path, or contact a maintainer directly.

### What happens next

- We will acknowledge your report within **5 business days**.
- We will assess the issue and provide a status update — typically within **14 days**.
- If the issue is confirmed, we will coordinate a fix and a responsible disclosure
  timeline before any public announcement.
- We will credit you for the report if you wish (with your consent).

### Scope

In scope:

- The web application and its API routes (`/api/signal` and any future routes).
- The game logic in `app/components/` (client-side canvas engine).
- Project configuration and deployment output.

Out of scope (not vulnerabilities in this project):

- Issues in the **Ruvyxa Framework** itself — please report those to the
  [Ruvyxa repository](https://github.com/thirawat27/Ruvyxa/security).
- Vulnerabilities in third-party npm packages — report them to the respective package
  maintainers.

## Security Considerations for This Project

Because the game uses WebRTC and a browser-based signaling server, keep in mind:

- The signaling store is **in-memory** — rooms are keyed by a 6-character code. Codes are
  guessable in principle, so treat room codes as *invitations*, not as authentication.
- Signaling messages are not end-to-end encrypted; do not exchange sensitive data over a
  DataChannel in this project's default configuration.
- Browser environments are sandboxed by the browser's own WebRTC security model; we follow
  Ruvyxa's default secure headers and server/client boundary enforcement.
