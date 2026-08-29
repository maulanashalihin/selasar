<script lang="ts">
	import { router } from '@inertiajs/svelte'
	import Layout from '../components/Layout.svelte'

	let name = $state('')
	let timezone = $state('UTC')
	let domain = $state('')
	let submitting = $state(false)
	let error = $state<string | null>(null)
	let nameError = $state<string | null>(null)
	let domainError = $state<string | null>(null)

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
			router.visit(`/sites/${data.id}/analytics`)
		} catch {
			error = 'Network error. Please try again.'
			submitting = false
		}
	}
</script>

<svelte:head><title>New Site — Selasar</title></svelte:head>

<Layout>
	<div class="mb-6">
		<a href="/sites" class="text-sm text-muted hover:text-text transition-colors inline-flex items-center gap-1.5">
			<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<path d="M19 12H5 M12 19l-7-7 7-7" />
			</svg>
			Back to sites
		</a>
	</div>

	<div class="max-w-xl">
		<h1 class="text-2xl font-bold m-0 mb-2">Create a new site</h1>
		<p class="text-muted text-sm m-0 mb-8">Set up tracking for a new website. You can add more domains later in site settings.</p>

		<form onsubmit={submit} novalidate class="bg-surface border border-border rounded-radius p-6 shadow-card">
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
						autocomplete="off"
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
						autocomplete="off"
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

			<div class="flex items-center gap-3">
				<button class="btn btn-primary" type="submit" disabled={submitting}>
					{#if submitting}
						<span class="inline-flex items-center gap-2">
							<span class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
							Creating…
						</span>
					{:else}
						Create Site
					{/if}
				</button>
				<a href="/sites" class="text-sm text-muted hover:text-text transition-colors">Cancel</a>
			</div>
		</form>
	</div>
</Layout>
