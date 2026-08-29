<script lang="ts">
	import { router } from '@inertiajs/svelte'
	import Layout from '../components/Layout.svelte'
	import type { ApiKey } from '../../shared/types'

	let { apiKeys }: { apiKeys: ApiKey[] } = $props()

	let showForm = $state(false)
	let label = $state('')
	let submitting = $state(false)
	let error = $state<string | null>(null)
	let newlyCreatedKey = $state<{ key: string; label: string } | null>(null)
	let copied = $state(false)

	const inputClass =
		'w-full px-3 py-2.5 border border-border rounded-lg bg-bg text-text text-[0.95rem] focus:outline-2 focus:outline-primary focus:-outline-offset-1 focus:border-primary'

	async function submit(e: SubmitEvent) {
		e.preventDefault()
		if (!label.trim()) return
		submitting = true
		error = null
		try {
			const res = await fetch('/api/keys', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ label: label.trim() }),
			})
			if (!res.ok) {
				const body = await res.json().catch(() => null)
				error = body?.error ?? 'Failed to create key.'
				submitting = false
				return
			}
			const data = await res.json()
			newlyCreatedKey = { key: data.key, label: data.label }
			label = ''
			submitting = false
			router.reload({ only: ['apiKeys'] })
		} catch {
			error = 'Network error.'
			submitting = false
		}
	}

	async function copyKey() {
		if (!newlyCreatedKey) return
		await navigator.clipboard.writeText(newlyCreatedKey.key)
		copied = true
		setTimeout(() => (copied = false), 2000)
	}

	function dismissKey() {
		newlyCreatedKey = null
	}

	async function revokeKey(id: number) {
		await fetch(`/api/keys/${id}`, { method: 'DELETE' })
	router.reload({ only: ['apiKeys'] })
	}
</script>

<svelte:head><title>API Keys</title></svelte:head>

<Layout>
	<div class="flex items-center justify-between gap-3 mb-8">
		<div>
			<h1 class="text-[1.75rem] font-bold m-0 tracking-tight">API Keys</h1>
			<p class="text-muted text-sm m-0 mt-1">
				Manage keys for programmatic analytics access
			</p>
		</div>
		{#if !showForm}
			<button class="btn btn-primary" onclick={() => (showForm = true)}>
				<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="inline-block">
					<path d="M12 5v14M5 12h14" />
				</svg>
				New Key
			</button>
		{/if}
	</div>

	{#if newlyCreatedKey}
		<div class="bg-success/10 border border-success/30 rounded-radius p-5 mb-6">
			<div class="flex items-start justify-between gap-3 mb-3">
				<div>
					<h2 class="text-base font-semibold m-0 mb-1 text-success">Key created</h2>
					<p class="text-muted text-sm m-0">Copy this key now — it won't be shown again.</p>
				</div>
				<button type="button" class="text-muted hover:text-text" onclick={dismissKey} aria-label="Dismiss">
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M18 6 6 18M6 6l12 12" />
					</svg>
				</button>
			</div>
			<div class="flex gap-2">
				<code class="flex-1 px-3 py-2.5 bg-bg border border-border rounded-lg text-sm font-mono break-all">
					{newlyCreatedKey.key}
				</code>
				<button class="btn btn-ghost shrink-0" onclick={copyKey}>
					{copied ? 'Copied!' : 'Copy'}
				</button>
			</div>
		</div>
	{/if}

	{#if showForm}
		<form
			onsubmit={submit}
			novalidate
			class="bg-surface border border-border rounded-radius p-6 mb-6 shadow-card"
		>
			<div class="flex items-center justify-between mb-5">
				<h2 class="text-lg font-semibold m-0">Create a new API key</h2>
				<button type="button" class="text-muted hover:text-text text-sm" onclick={() => (showForm = false)}>Cancel</button>
			</div>

			{#if error}
				<p class="text-danger text-sm mb-4">{error}</p>
			{/if}

			<div class="mb-4">
				<label for="key-label" class="block text-sm font-medium mb-1.5">Label</label>
				<input id="key-label" class={inputClass} bind:value={label} placeholder="e.g. Production dashboard" />
				<p class="text-muted text-xs mt-1.5">A name to help you identify this key.</p>
			</div>

			<button class="btn btn-primary" type="submit" disabled={submitting || !label.trim()}>
				{submitting ? 'Creating…' : 'Create Key'}
			</button>
		</form>
	{/if}

	{#if apiKeys.length === 0 && !showForm}
		<div class="bg-surface border border-border rounded-radius p-12 text-center">
			<div class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary-soft text-primary mb-4">
				<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 8.5m0 0l3 3L22 8l-3-3m-3.5 3.5L19 5" />
				</svg>
			</div>
			<h2 class="text-lg font-semibold m-0 mb-1">No API keys yet</h2>
			<p class="text-muted text-sm m-0 mb-5">Create a key to access analytics data programmatically.</p>
			<button class="btn btn-primary" onclick={() => (showForm = true)}>Create your first key</button>
		</div>
	{:else if apiKeys.length > 0}
		<div class="bg-surface border border-border rounded-radius overflow-hidden shadow-card">
			<table class="w-full border-collapse text-sm">
				<thead>
					<tr>
						<th class="text-left px-4 py-3 border-b border-border text-xs uppercase tracking-wider text-muted font-semibold">Label</th>
						<th class="text-left px-4 py-3 border-b border-border text-xs uppercase tracking-wider text-muted font-semibold">Created</th>
						<th class="text-left px-4 py-3 border-b border-border text-xs uppercase tracking-wider text-muted font-semibold">Last Used</th>
						<th class="text-right px-4 py-3 border-b border-border text-xs uppercase tracking-wider text-muted font-semibold">Actions</th>
					</tr>
				</thead>
				<tbody class="[&>tr:last-child>td]:border-b-0">
					{#each apiKeys as key (key.id)}
						<tr class="transition-colors hover:bg-primary-soft/50">
							<td class="px-4 py-3.5 border-b border-border font-semibold">{key.label}</td>
							<td class="px-4 py-3.5 border-b border-border text-muted">
								{new Date(key.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
							</td>
							<td class="px-4 py-3.5 border-b border-border text-muted">
								{key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Never'}
							</td>
							<td class="px-4 py-3.5 border-b border-border text-right">
								<button
									class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-danger hover:bg-danger/10 text-xs font-semibold transition-colors"
									onclick={() => revokeKey(key.id)}
								>
									<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
										<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
									</svg>
									Revoke
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</Layout>
