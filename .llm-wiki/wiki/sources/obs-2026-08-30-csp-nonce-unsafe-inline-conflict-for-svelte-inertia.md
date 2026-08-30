---
type: source
title: "Observation: CSP nonce + unsafe-inline conflict for Svelte/Inertia"
slug: obs-2026-08-30-csp-nonce-unsafe-inline-conflict-for-svelte-inertia
status: observation
created: 2026-08-30
updated: 2026-08-30
relevance: high
observed_at: 2026-08-30T03:50:33.770Z
tags: ["csp", "svelte", "inertia", "security"]
source_context: "Fixing CSP violations on selasar.maulanabuilds.com production deploy"
---
# ⭐ Observation: CSP nonce + unsafe-inline conflict for Svelte/Inertia
CSP spec: 'unsafe-inline' is ignored when nonce is present in the same style-src directive. Inertia's NProgress and Svelte transitions apply inline style attributes via JS (style="..."), which require 'unsafe-inline'. Nonce only covers <style nonce="..."> blocks, not style attributes. Correct CSP for Svelte+Inertia: style-src 'self' 'unsafe-inline' (no nonce), script-src 'self' 'nonce-{nonce}' (nonce kept for XSS protection). Discovered in selasar project, same issue exists in dulak-v2 boilerplate.
*Relevance: high*

*Context: Fixing CSP violations on selasar.maulanabuilds.com production deploy*

*Tags: csp svelte inertia security*
---
*Observed: 2026-08-30T03:50:33.770Z*