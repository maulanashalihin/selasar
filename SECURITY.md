# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest `main` | ✅ |
| tagged releases | ✅ |
| older versions | ❌ |

Selasar is under active development. We recommend running the latest release.

## Reporting a Vulnerability

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please report vulnerabilities privately:

1. Email **<maulanashalihin@gmail.com>** with subject `SECURITY: Selasar`.
2. Include a description of the vulnerability, steps to reproduce, and potential impact.
3. If possible, include a proof-of-concept or patch.

You will receive a response within 48 hours. If the vulnerability is confirmed, we will:

- Acknowledge the report
- Work on a fix in a private branch
- Release a patched version
- Credit you in the release notes (unless you prefer to remain anonymous)

## Security Measures

Selasar implements the following security features:

- **Argon2id** password hashing
- **Session-based auth** with HTTP-only cookies
- **CSRF protection** via Origin header validation
- **CSP with per-request nonce** — no `unsafe-inline` for scripts or styles
- **Rate limiting** on auth endpoints
- **Input validation** via TypeBox schemas on all routes
- **SQL injection prevention** — parameterized queries only (no string interpolation in SQL)
- **Avatar upload safety** — raster-only (no SVG), decoded via Bun.image, re-encoded to WebP
- **tus upload protocol** — auth-required, offset-verified, checksum-supported
- **Secure headers** — X-Frame-Options DENY, Referrer-Policy, Permissions-Policy

## Self-Hosting Security Checklist

When deploying Selasar in production:

- [ ] Set `NODE_ENV=production`
- [ ] Set `APP_URL` to your actual domain (used for OAuth redirects, email links)
- [ ] Run behind a reverse proxy (Caddy, Cloudflare, nginx) with TLS
- [ ] Restrict ClickHouse to localhost only (default)
- [ ] Set `METRICS_TOKEN` to protect `/metrics` endpoint
- [ ] Configure `MAIL_DRIVER` (resend/mailtrap) for password reset emails
- [ ] Review `RATE_LIMIT_*` settings for your traffic patterns
- [ ] Regularly update dependencies (`bun update` + Dependabot PRs)
