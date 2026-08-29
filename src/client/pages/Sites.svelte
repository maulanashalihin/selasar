<script lang="ts">
  import { Link } from '@inertiajs/svelte'
  import Layout from '../components/Layout.svelte'
  import type { Site } from '../../shared/types'

  let { sites }: { sites: Site[] } = $props()

  let copiedId = $state<number | null>(null)


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
    <Link href="/sites/new" class="btn btn-primary no-underline">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="inline-block">
        <path d="M12 5v14M5 12h14" />
      </svg>
      New Site
    </Link>
  </div>

  {#if sites.length === 0}
    <div class="bg-surface border border-border rounded-radius p-12 text-center">
      <div class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary-soft text-primary mb-4">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
        </svg>
      </div>
      <h2 class="text-lg font-semibold m-0 mb-1">No sites yet</h2>
      <Link href="/sites/new" class="btn btn-primary no-underline">Create your first site</Link>
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
