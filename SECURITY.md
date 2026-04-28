# Security Policy

Picho-RPG takes security seriously. If you believe you have found a vulnerability in the **back-end API**, please follow the steps below.

## Supported versions

Only the `main` branch receives active security maintenance. Older tagged releases are not patched — if you're running an older deploy, please update before reporting.

| Version         | Supported |
| --------------- | --------- |
| `main` (latest) | ✅        |
| Older tags      | ❌        |

## Reporting a vulnerability

**Please do not open a public GitHub issue.** Instead, send the details privately to:

📧 **security@picho.org**

If you'd like to use PGP, request the public key by replying to the same address.

In your report, please include as much of the following as you can:

- A clear description of the issue and its potential impact.
- Steps to reproduce (curl/HTTPie request, payload, route, expected vs. actual response).
- A proof of concept (script, recording, minimal repro repo) if available.
- The commit hash, deployed URL or container image tag where you observed the issue.
- Whether the issue requires authentication, GM mode, or specific data state.
- Your name or handle, in case you want to be credited.

You should receive an acknowledgement within **72 hours**. We aim to provide an initial assessment within **7 days**, and either a fix or a public advisory within **30 days**, depending on severity. If we need more time, we'll keep you informed.

## What's in scope

The back-end and its deployment artefacts. That includes:

- Authentication / authorisation bypass (GM gate, JWT issues, brute-force tracker).
- Input validation gaps that lead to SQL injection, prototype pollution, path traversal, SSRF, etc.
- Vulnerabilities in upload handling: MIME bypass, oversized uploads escaping the cap, path traversal in stored filenames, accidental script execution.
- Information disclosure (private/GM data leaking to player endpoints, env-var leakage, stack traces in production).
- Storage adapter issues (Azure Blob misconfiguration, public exposure, signature bypass).
- Insecure defaults in `Dockerfile` / deploy manifests.
- Dependency vulnerabilities in production dependencies with a credible exploit path.

For frontend issues, see the front-end's [SECURITY.md](https://github.com/picho-org/picho-rpg-front/blob/main/SECURITY.md).

## What's _not_ a security issue

To save us both time, the following are explicitly **not** in scope here:

- Reports that depend on a maintainer's machine being compromised.
- Automated scanner output without a working proof of concept.
- Lack of brute-force protection on routes that already throttle (the GM unlock has a tracker).
- Missing security headers when there's no demonstrated exploit path. (We already ship a hardened Helmet config.)
- Theoretical timing attacks against `safeCompare`.
- DoS via excessive valid traffic when `@fastify/rate-limit` is configured but tuned permissively.
- Issues that require running with `NODE_ENV !== 'production'` in a production deploy.
- Dependency issues without a reachable code path in our build (advisories on dev-only or unused features).

## Disclosure policy

We follow a **coordinated disclosure** model:

1. You report privately.
2. We acknowledge, investigate, and develop a fix.
3. Once a fix is deployed, we publish an advisory crediting the reporter (unless they prefer to remain anonymous).

We don't currently run a bug-bounty program. We do, however, deeply appreciate responsibly disclosed reports and will publicly thank you in the advisory and in release notes.

## Security defaults you should know about

When evaluating reports, it helps to know what we already do:

- **Helmet** with a strict CSP (`default-src 'none'`), `crossOriginResourcePolicy: cross-origin`, COOP `same-origin`, hidden `X-Powered-By`.
- **CORS** allow-list driven by `CORS_ORIGIN`.
- **Rate limiting** via `@fastify/rate-limit`.
- **Body size cap** of 512 KB for JSON; multipart uploads have their own cap (`MAX_UPLOAD_MB`).
- **MIME allow-list** on every upload route, with extension fallback for browsers that report `application/octet-stream`.
- **Brute-force tracker** for the GM unlock endpoint (`src/infra/security/brute-force.ts`).
- **JWT-based GM sessions** with `JWT_SECRET` rotation supported via env-var change.
- **`safeCompare`** for constant-time comparison of secrets.

Thank you for helping keep Picho-RPG and its users safe. 🛡️
