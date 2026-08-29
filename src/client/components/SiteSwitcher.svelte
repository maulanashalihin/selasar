<script lang="ts">
	import { Link, usePage } from '@inertiajs/svelte'
	import type { SharedPageProps, Site } from '../../shared/types'
	import { cn } from '../lib/cn'

	const page = usePage<SharedPageProps>()
	const sites = $derived(page.props.sites as Site[])
	const url = $derived(page.url)

	let open = $state(false)
	let rootRef = $state<HTMLDivElement | null>(null)

	// Extract site id from current URL (/sites/:id/...)
	const currentSiteId = $derived.by(() => {
		const path = url?.split('?')[0] ?? ''
		const m = path.match(/^\/sites\/(\d+)/)
		return m ? Number(m[1]) : null
	})

	const currentSite = $derived(
		sites.find((s) => s.id === currentSiteId) ?? null,
	)

	const onSitesList = $derived(
		(url?.split('?')[0] ?? '') === '/sites',
	)

	// Close on outside click + Escape
	$effect(() => {
		if (!open) return
		const onDown = (e: MouseEvent) => {
			if (rootRef && !rootRef.contains(e.target as Node)) open = false
		}
		const onKey = (e: KeyboardEvent) =>
			e.key === 'Escape' && (open = false)
		document.addEventListener('mousedown', onDown)
		document.addEventListener('keydown', onKey)
		return () => {
			document.removeEventListener('mousedown', onDown)
			document.removeEventListener('keydown', onKey)
		}
	})

	// Close dropdown on navigation
	$effect(() => {
		url // track
		open = false
	})

	function toggle() {
		open = !open
	}

	function siteHref(site: Site): string {
		return `/sites/${site.id}/analytics`
	}
</script>

<div class="relative w-full" bind:this={rootRef}>
	<button
		type="button"
		class="w-full px-3 py-2.5 rounded-lg border border-border bg-bg text-left flex items-center justify-between gap-2 cursor-pointer text-text hover:bg-primary-soft transition-colors"
		onclick={toggle}
		aria-haspopup="listbox"
		aria-expanded={open}
	>
		{#if sites.length === 0}
			<span class="text-sm text-muted">No sites</span>
		{:else if currentSite}
			<span class="font-semibold text-sm truncate">{currentSite.name}</span>
		{:else if onSitesList}
			<span class="text-sm text-muted">Select a site…</span>
		{:else}
			<span class="text-sm text-muted">Select a site…</span>
		{/if}
		<svg
			class={cn(
				'shrink-0 text-muted transition-transform duration-150',
				open && 'rotate-180',
			)}
			viewBox="0 0 24 24"
			width="16"
			height="16"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="m6 9 6 6 6-6" />
		</svg>
	</button>

	{#if open}
		<div
			class="absolute left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-card z-40 max-h-[300px] overflow-y-auto"
			role="listbox"
		>
			{#if sites.length === 0}
				<div class="p-3">
					<p class="text-sm text-muted mb-2">No sites yet.</p>
					<Link
						href="/sites/new"
						class="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:no-underline"
					>
						<svg
							viewBox="0 0 24 24"
							width="16"
							height="16"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="M12 5v14M5 12h14" />
						</svg>
						Create new site
					</Link>
				</div>
			{:else}
				<ul class="list-none m-0 p-0">
					{#each sites as site (site.id)}
						{@const active = site.id === currentSiteId}
						<li>
							<Link
								href={siteHref(site)}
								class={cn(
									'flex items-center gap-2 px-3 py-2 text-sm hover:bg-primary-soft hover:no-underline transition-colors',
									active ? 'text-primary font-medium' : 'text-text',
								)}
								role="option"
								aria-selected={active}
							>
								<svg
									class="shrink-0 text-muted"
									viewBox="0 0 24 24"
									width="14"
									height="14"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
								>
									<circle cx="12" cy="12" r="10" />
									<path d="M2 12h20" />
									<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
								</svg>
								<span class="flex-1 min-w-0 flex flex-col">
									<span class="truncate">{site.name}</span>
									{#if site.primaryDomain}
										<span class="text-xs text-muted truncate">{site.primaryDomain}</span>
									{/if}
								</span>
							</Link>
						</li>
					{/each}
				</ul>
				<div class="border-t border-border p-1">
					<Link
						href="/sites/new"
						class="flex items-center gap-1.5 px-3 py-2 text-sm text-muted hover:text-primary hover:bg-primary-soft hover:no-underline rounded-md transition-colors"
					>
						<svg
							viewBox="0 0 24 24"
							width="16"
							height="16"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="M12 5v14M5 12h14" />
						</svg>
						Create new site
					</Link>
				</div>
			{/if}
		</div>
	{/if}
</div>
