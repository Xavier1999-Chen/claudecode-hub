/**
 * Cross-app links: where the marketing site sends users into the admin app.
 *
 * Domain topology is undecided (TRD §10) — env vars allow swapping
 * between same-origin paths and a separate admin subdomain without code changes.
 *
 * Defaults assume same-origin during local dev (admin runs on a sibling port,
 * marketing on 3183). Production should set NEXT_PUBLIC_ADMIN_URL
 * to e.g. https://app.example.com.
 */

const ADMIN_BASE = process.env.NEXT_PUBLIC_ADMIN_URL ?? ''

export const adminLinks = {
  login: `${ADMIN_BASE}/login`,
  register: `${ADMIN_BASE}/register`,
  console: `${ADMIN_BASE}/`,
}
