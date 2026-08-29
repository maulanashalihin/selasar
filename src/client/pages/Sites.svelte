<script lang="ts">
  import { Link, router } from '@inertiajs/svelte'
  import Layout from '../components/Layout.svelte'
  import type { Site } from '../../shared/types'

  let { sites }: { sites: Site[] } = $props()

  let showForm = $state(false)
  let name = $state('')
  let timezone = $state('UTC')
  let domain = $state('')
  let submitting = $state(false)
  let error = $state<string | null>(null)
  let nameError = $state<string | null>(null)
  let domainError = $state<string | null>(null)
  let copiedId = $state<number | null>(null)

  const inputClass =
    'w-full px-3 py-2.5 border border-border rounded-lg bg-bg text-text text-[0.95rem] focus:outline-2 focus:outline-primary focus:-outline-offset-1 focus:border-primary'

  const TIMEZONES = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Sao_Paulo',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Madrid',
    'Africa/Johannesburg',
    'Africa/Lagos',
    'Africa/Nairobi',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Asia/Bangkok',
    'Asia/Jakarta',
    'Asia/Shanghai',
    'Asia/Tokyo',
    'Asia/Singapore',
    'Australia/Sydney',
    'Pacific/Auckland',
  ]

  const DOMAIN_RE = /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/

  function openForm() {
    showForm = true
  }

  function closeForm() {
    showForm = false
    resetForm()
  }

  function resetForm() {
    name = ''
    timezone = 'UTC'
    domain = ''
    error = null
    nameError = null
    domainError = null
  }

  function normalizeDomain(raw: string): string {
    return raw
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '')
  }

  function validate(): boolean {
    nameError = null
    domainError = null
    let ok = true
    if (!name.trim()) {
      nameError = 'Site name is required.'
      ok = false
    }
    const d = normalizeDomain(domain)
    if (!d) {
      domainError = 'Domain is required.'
      ok = false
    } else if (!DOMAIN_RE.test(d)) {
      domainError = 'Enter a valid domain, e.g. example.com'
      ok = false
    }
    return ok
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault()
    error = null
    if (!validate()) return
    submitting = true
    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          timezone: timezone.trim() || 'UTC',
          domains: [normalizeDomain(domain)],
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        error = body?.error ?? 'Failed to create site.'
        submitting = false
        return
      }
      const data = await res.json()
      router.visit(`/sites/${data.id}`)
    } catch {
      error = 'Network error. Please try again.'
      submitting = false
    }
  }

  async function copyTrackingId(site: Site) {
    try {
      await navigator.clipboard.writeText(site.trackingId)
      copiedId = site.id
      setTimeout(() => (copiedId = null), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime()
    const days = Math.floor(diff / 86400000)
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    if (days < 30) return `${Math.floor(days / 7)}w ago`
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }
</script>

<svelte:head><title>Sites</title></svelte:head>

<Layout>
  <div class="flex items-center justify-between gap-3 mb-8">
    <div>
      <h1 class="text-[1.75rem] font-bold m-0 tracking-tight">Sites</h1>
      <p class="text-muted text-sm m-0 mt-1">
        {sites.length} {sites.length === 1 ? 'site' : 'sites'} tracking
      </p>
    </div>
    {#if !showForm}
      <button class="btn btn-primary" onclick={openForm}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="inline-block">
          <path d="M12 5v14M5 12h14" />
        </svg>
        New Site
      </button>
    {/if}
  </div>

  {#if showForm}
    <form
      onsubmit={submit}
      novalidate
      class="bg-surface border border-border rounded-radius p-6 mb-6 shadow-card"
    >
      <div class="flex items-center justify-between mb-5">
        <h2 class="text-lg font-semibold m-0">Create a new site</h2>
        <button type="button" class="text-muted hover:text-text text-sm" onclick={closeForm}>Cancel</button>
      </div>

      {#if error}
        <div class="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm mb-4">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="shrink-0">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          {error}
        </div>
      {/if}

      <div class="grid gap-4 mb-5">
        <div>
          <label for="site-name" class="block text-sm font-medium mb-1.5">
            Site Name
            <span class="text-danger" aria-label="required">*</span>
          </label>
          <input
            id="site-name"
            class={inputClass}
            class:!border-danger={!!nameError}
            bind:value={name}
            placeholder="My Website"
            onchange={() => (nameError = null)}
          />
          {#if nameError}
            <p class="text-danger text-xs mt-1.5" role="alert">{nameError}</p>
          {/if}
        </div>

        <div>
          <label for="site-domain" class="block text-sm font-medium mb-1.5">
            Domain
            <span class="text-danger" aria-label="required">*</span>
          </label>
          <input
            id="site-domain"
            class={inputClass}
            class:!border-danger={!!domainError}
            bind:value={domain}
            placeholder="example.com"
            onchange={() => (domainError = null)}
          />
          {#if domainError}
            <p class="text-danger text-xs mt-1.5" role="alert">{domainError}</p>
          {/if}
          <p class="text-muted text-xs mt-1.5">The domain tracking events will come from.</p>
        </div>

        <div>
          <label for="site-tz" class="block text-sm font-medium mb-1.5">Timezone</label>
          <select id="site-tz" class={inputClass} bind:value={timezone}>
            {#each TIMEZONES as tz (tz)}
              <option value={tz}>{tz}</option>
            {/each}
          </select>
          <p class="text-muted text-xs mt-1.5">Used for date boundaries in reports.</p>
        </div>
      </div>

      <button class="btn btn-primary" type="submit" disabled={submitting}>
        {submitting ? 'Creating…' : 'Create Site'}
      </button>
    </form>
  {/if}

  {#if sites.length === 0 && !showForm}
    <div class="bg-surface border border-border rounded-radius p-12 text-center">
      <div class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary-soft text-primary mb-4">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
        </svg>
      </div>
      <h2 class="text-lg font-semibold m-0 mb-1">No sites yet</h2>
      <p class="text-muted text-sm m-0 mb-5">Create your first site to start tracking analytics.</p>
      <button class="btn btn-primary" onclick={openForm}>Create your first site</button>
    </div>
  {:else if sites.length > 0}
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each sites as site (site.id)}
        <div class="group bg-surface border border-border rounded-radius p-5 shadow-card transition-colors hover:border-primary/40">
          <div class="flex items-start justify-between gap-3 mb-4">
            <div class="min-w-0">
              <Link href={`/sites/${site.id}/analytics`} class="block font-semibold text-text text-base hover:no-underline truncate">
                {site.name}
              </Link>
              <p class="text-muted text-sm m-0 mt-0.5 truncate">{site.primaryDomain ?? 'No domain set'}</p>
            </div>
            <Link
              href={`/sites/${site.id}`}
              class="inline-flex items-center justify-center w-8 h-8 rounded-lg text-muted hover:text-text hover:bg-bg transition-colors shrink-0"
              aria-label="Settings for {site.name}"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
              </svg>
            </Link>
          </div>

          <div class="flex items-center gap-2 mb-4">
            <code class="text-xs font-mono text-muted bg-bg px-2 py-1 rounded truncate">{site.trackingId.slice(0, 8)}</code>
            <button
              type="button"
              class="inline-flex items-center justify-center w-7 h-7 rounded-md text-muted hover:text-primary hover:bg-primary-soft transition-colors shrink-0"
              onclick={() => copyTrackingId(site)}
              aria-label="Copy tracking ID"
            >
              {#if copiedId === site.id}
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              {:else}
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
              {/if}
            </button>
          </div>

          <div class="flex items-center justify-between gap-2 pt-4 border-t border-border">
            <span class="text-xs text-muted">{relativeTime(site.createdAt)}</span>
            <Link
              href={`/sites/${site.id}/analytics`}
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover hover:no-underline transition-colors"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 3v18h18" />
                <path d="M7 14l4-4 4 4 6-6" />
              </svg>
              View Analytics
            </Link>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</Layout>
