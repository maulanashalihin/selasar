<script lang="ts">
  import { Link, router } from '@inertiajs/svelte'
  import Layout from '../components/Layout.svelte'
  import Badge from '../components/ui/Badge.svelte'
  import type { SiteWithDomains } from '../../shared/types'

  let { site }: { site: SiteWithDomains; appUrl?: string } = $props()

  // --- General settings form -------------------------------------------
  function initialFormValues() {
    return {
      name: site.name,
      timezone: site.timezone,
      autoAcceptDomains: site.autoAcceptDomains,
    }
  }
  const initial = initialFormValues()
  let name = $state(initial.name)
  let timezone = $state(initial.timezone)
  let autoAcceptDomains = $state(initial.autoAcceptDomains)

  let saving = $state(false)
  let generalMsg = $state<string | null>(null)
  let generalErr = $state<string | null>(null)

  // Keep form fields in sync when the server refreshes the `site` prop.
  $effect(() => {
    name = site.name
    timezone = site.timezone
    autoAcceptDomains = site.autoAcceptDomains
  })

  // --- Domains ----------------------------------------------------------
  let newDomain = $state('')
  let domainAdding = $state(false)
  let domainErr = $state<string | null>(null)


  // --- Danger zone ------------------------------------------------------
  let confirmOpen = $state(false)
  let deleting = $state(false)
  let deleteErr = $state<string | null>(null)

  const inputClass =
    'w-full px-3 py-2.5 border border-border rounded-lg bg-bg text-text text-[0.95rem] focus:outline-2 focus:outline-primary focus:-outline-offset-1 focus:border-primary'

  const TIMEZONES: { value: string; label: string }[] = [
    { value: 'UTC', label: 'UTC (+00:00)' },
    { value: 'America/New_York', label: 'New York (-05:00)' },
    { value: 'America/Chicago', label: 'Chicago (-06:00)' },
    { value: 'America/Denver', label: 'Denver (-07:00)' },
    { value: 'America/Los_Angeles', label: 'Los Angeles (-08:00)' },
    { value: 'America/Sao_Paulo', label: 'São Paulo (-03:00)' },
    { value: 'Europe/London', label: 'London (+00:00)' },
    { value: 'Europe/Paris', label: 'Paris (+01:00)' },
    { value: 'Europe/Berlin', label: 'Berlin (+01:00)' },
    { value: 'Europe/Madrid', label: 'Madrid (+01:00)' },
    { value: 'Europe/Istanbul', label: 'Istanbul (+03:00)' },
    { value: 'Africa/Johannesburg', label: 'Johannesburg (+02:00)' },
    { value: 'Africa/Lagos', label: 'Lagos (+01:00)' },
    { value: 'Africa/Cairo', label: 'Cairo (+02:00)' },
    { value: 'Africa/Nairobi', label: 'Nairobi (+03:00)' },
    { value: 'Asia/Dubai', label: 'Dubai (+04:00)' },
    { value: 'Asia/Riyadh', label: 'Madinah/Riyadh (+03:00)' },
    { value: 'Asia/Kolkata', label: 'Kolkata (+05:30)' },
    { value: 'Asia/Bangkok', label: 'Bangkok (+07:00)' },
    { value: 'Asia/Jakarta', label: 'Jakarta (+07:00)' },
    { value: 'Asia/Shanghai', label: 'Shanghai (+08:00)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (+09:00)' },
    { value: 'Asia/Singapore', label: 'Singapore (+08:00)' },
    { value: 'Australia/Sydney', label: 'Sydney (+10:00)' },
    { value: 'Pacific/Auckland', label: 'Auckland (+12:00)' },
  ]

  /** JSON fetch helper for the /api endpoints. Throws on non-2xx. */
  async function api(url: string, method: string, body?: unknown): Promise<void> {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Inertia': 'true',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) throw new Error(`Request failed (HTTP ${res.status})`)
  }

  async function saveGeneral(e: SubmitEvent) {
    e.preventDefault()
    saving = true
    generalMsg = null
    generalErr = null
    try {
      await api(`/api/sites/${site.id}`, 'PATCH', {
        name,
        timezone,
        auto_accept_domains: autoAcceptDomains,
      })
      generalMsg = 'Settings saved.'
      await router.reload()
    } catch (err) {
      generalErr = err instanceof Error ? err.message : 'Failed to save settings.'
    } finally {
      saving = false
    }
  }

  async function addDomain(e: SubmitEvent) {
    e.preventDefault()
    const value = newDomain.trim()
    if (!value) return
    domainAdding = true
    domainErr = null
    try {
      await api(`/api/sites/${site.id}/domains`, 'POST', { domain: value })
      newDomain = ''
      await router.reload()
    } catch (err) {
      domainErr = err instanceof Error ? err.message : 'Failed to add domain.'
    } finally {
      domainAdding = false
    }
  }

  async function setPrimary(domain: string) {
    domainErr = null
    try {
      await api(`/api/sites/${site.id}/primary-domain`, 'PATCH', { domain })
      await router.reload()
    } catch (err) {
      domainErr = err instanceof Error ? err.message : 'Failed to set primary domain.'
    }
  }

  async function removeDomain(domainId: number) {
    domainErr = null
    try {
      await api(`/api/sites/${site.id}/domains/${domainId}`, 'DELETE')
      await router.reload()
    } catch (err) {
      domainErr = err instanceof Error ? err.message : 'Failed to remove domain.'
    }
  }

  async function confirmDelete() {
    deleting = true
    deleteErr = null
    try {
      await api(`/api/sites/${site.id}`, 'DELETE')
      router.visit('/sites')
    } catch (err) {
      deleteErr = err instanceof Error ? err.message : 'Failed to delete site.'
      deleting = false
    }
  }
</script>

<svelte:head><title>{site.name} · Settings</title></svelte:head>

<Layout>
  <h1 class="text-[1.6rem] m-0 mb-6 tracking-tight font-bold">Settings</h1>


  <div class="flex flex-col gap-5 max-w-3xl">
    <section class="bg-surface shadow-card rounded-radius p-6">
      <h2 class="text-[1.1rem] m-0 mb-1">General</h2>
      <p class="text-muted text-sm m-0 mb-4">Site name and timezone used for reporting.</p>

      <form onsubmit={saveGeneral} novalidate class="flex flex-col gap-4">
        <div>
          <label for="site-name" class="block text-sm font-semibold mb-1.5">Name</label>
          <input id="site-name" class={inputClass} bind:value={name} placeholder="My site" />
        </div>

        <div>
          <label for="site-tz" class="block text-sm font-semibold mb-1.5">Timezone</label>
          <select id="site-tz" class={inputClass} bind:value={timezone}>
            {#if !TIMEZONES.some((tz) => tz.value === timezone)}
              <option value={timezone}>{timezone}</option>
            {/if}
            {#each TIMEZONES as tz (tz.value)}
              <option value={tz.value}>{tz.label}</option>
            {/each}
          </select>
        </div>

        <label class="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input type="checkbox" bind:checked={autoAcceptDomains} class="accent-primary" />
          Automatically accept new domains
        </label>

        {#if generalErr}
          <p class="text-danger text-sm m-0" role="alert">{generalErr}</p>
        {/if}
        {#if generalMsg}
          <p class="text-success text-sm m-0">{generalMsg}</p>
        {/if}

        <div>
          <button type="submit" class="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </section>

    <!-- Domains -->
    <section class="bg-surface shadow-card rounded-radius p-6">
      <h2 class="text-[1.1rem] m-0 mb-1">Domains</h2>
      <p class="text-muted text-sm m-0 mb-4">
        Domains allowed to send events to this site. The primary domain is shown in reports.
      </p>

      {#if site.domains.length === 0}
        <p class="text-muted text-sm m-0 mb-4">No domains yet. Add one below.</p>
      {:else}
        <ul class="flex flex-col gap-2 m-0 p-0 list-none mb-4">
          {#each site.domains as d (d.id)}
            <li
              class="flex items-center justify-between gap-3 rounded-lg bg-bg/50 px-4 py-3"
            >
              <div class="flex items-center gap-2 min-w-0">
                <span class="font-medium truncate">{d.domain}</span>
                {#if site.primaryDomain === d.domain}
                  <Badge variant="primary">Primary</Badge>
                {/if}
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  class="btn btn-ghost"
                  disabled={site.primaryDomain === d.domain}
                  onclick={() => setPrimary(d.domain)}
                >
                  Set primary
                </button>
                <button
                  type="button"
                  class="btn btn-ghost text-danger"
                  onclick={() => removeDomain(d.id)}
                >
                  Remove
                </button>
              </div>
            </li>
          {/each}
        </ul>
      {/if}

      <form onsubmit={addDomain} class="flex gap-2 items-start">
        <input
          class={inputClass}
          bind:value={newDomain}
          placeholder="example.com"
          aria-label="Add domain"
        />
        <button type="submit" class="btn btn-primary shrink-0" disabled={domainAdding}>
          {domainAdding ? 'Adding…' : 'Add domain'}
        </button>
      </form>
      {#if domainErr}
        <p class="text-danger text-sm mt-2 m-0" role="alert">{domainErr}</p>
      {/if}
    </section>

    <!-- Tracking setup link -->
    <section class="bg-surface shadow-card rounded-radius p-6">
      <h2 class="text-[1.1rem] m-0 mb-1">Tracking setup</h2>
      <p class="text-muted text-sm m-0 mb-4">
        Installation guide, custom event tracking, and UTM parameters.
      </p>
      <a href={`/sites/${site.id}/analytics/tracking`} class="btn btn-primary inline-flex items-center gap-2 no-underline">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8 M12 17v4" />
        </svg>
        View tracking guide
      </a>
    </section>

    <section class="bg-surface shadow-card rounded-radius p-6 ring-1 ring-danger/20">
      <h2 class="text-[1.1rem] m-0 mb-1 text-danger">Danger zone</h2>
      <p class="text-muted text-sm m-0 mb-4">
        Deleting a site permanently removes it and all of its analytics data. This cannot be undone.
      </p>
      <button type="button" class="btn btn-ghost text-danger border-danger/40" onclick={() => (confirmOpen = true)}>
        Delete site
      </button>
    </section>
  </div>

  <!-- Delete confirmation dialog -->
  {#if confirmOpen}
    <div
      class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-title"
    >
      <div class="bg-surface border border-border rounded-radius shadow-card p-6 max-w-md w-full">
        <h3 id="delete-title" class="text-[1.1rem] m-0 mb-2">Delete this site?</h3>
        <p class="text-muted text-sm m-0 mb-5">
          You are about to delete <strong class="text-text">{site.name}</strong>. All analytics data
          for this site will be lost permanently.
        </p>
        {#if deleteErr}
          <p class="text-danger text-sm m-0 mb-3" role="alert">{deleteErr}</p>
        {/if}
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="btn btn-ghost"
            disabled={deleting}
            onclick={() => {
              confirmOpen = false
              deleteErr = null
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-ghost text-danger border-danger/40"
            disabled={deleting}
            onclick={confirmDelete}
          >
            {deleting ? 'Deleting…' : 'Delete site'}
          </button>
        </div>
      </div>
    </div>
  {/if}
</Layout>
