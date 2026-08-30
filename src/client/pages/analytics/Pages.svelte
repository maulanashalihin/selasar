<script lang="ts">
	import Layout from '../../components/Layout.svelte'
	import type { Site } from '../../../shared/types'
	import DateRangePicker from '../../components/analytics/DateRangePicker.svelte'
	import { DATE_RANGES } from '../../lib/date-ranges'

	let { site }: { site: Site } = $props()

	type PageRow = {
		page_path: string
		page_title: string
		views: number
		unique_visitors: number
		avg_duration: number
	}

	type SortKey = 'views' | 'unique_visitors' | 'avg_duration'
	type SortDir = 'desc' | 'asc'

	let range = $state('28d')
	const ranges = DATE_RANGES

	let rows = $state<PageRow[]>([])
	let totalVisitors = $state(0)
	let totalPageviews = $state(0)
	let loading = $state(true)
	let error = $state<string | null>(null)

	let searchQuery = $state('')
	let sortKey = $state<SortKey>('views')
	let sortDir = $state<SortDir>('desc')

	async function fetchPages() {
		loading = true
		try {
			const res = await fetch(`/api/analytics/pages?site_id=${site.id}&range=${range}`)
			if (!res.ok) throw new Error(`HTTP ${res.status}`)
			const data = (await res.json()) as { totalVisitors: number; pages: PageRow[] }
			rows = data.pages ?? []
			totalVisitors = data.totalVisitors ?? 0
			totalPageviews = rows.reduce((s, r) => s + (Number(r.views) || 0), 0)
			error = null
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load'
			rows = []
			totalVisitors = 0
			totalPageviews = 0
		} finally {
			loading = false
		}
	}

	$effect(() => {
		fetchPages()
	})

	let filteredRows = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase()
		const filtered = q ? rows.filter((r) => r.page_path.toLowerCase().includes(q)) : rows
		const sorted = [...filtered].sort((a, b) => {
			const av = Number(a[sortKey]) || 0
			const bv = Number(b[sortKey]) || 0
			return sortDir === 'asc' ? av - bv : bv - av
		})
		return sorted
	})

	let maxViews = $derived(rows.length > 0 ? Math.max(...rows.map((r) => r.views)) : 1)

	function formatDuration(ms: number): string {
		if (!ms || ms <= 0) return '0s'
		if (ms > 60000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
		return `${Math.floor(ms / 1000)}s`
	}

	function toggleSort(key: SortKey) {
		if (sortKey === key) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc'
		} else {
			sortKey = key
			sortDir = 'desc'
		}
	}

	const columns: { key: SortKey | 'page_path'; label: string; align: 'left' | 'right' }[] = [
		{ key: 'page_path', label: 'Page Path', align: 'left' },
		{ key: 'views', label: 'Pageviews', align: 'right' },
		{ key: 'unique_visitors', label: 'Visitors', align: 'right' },
		{ key: 'avg_duration', label: 'Avg Duration', align: 'right' },
	]
</script>

<svelte:head><title>Pages — {site.name}</title></svelte:head>

<Layout>
	<div class="flex items-center justify-between gap-4 flex-wrap mb-6">
		<h1 class="text-[1.6rem] m-0 tracking-tight font-bold">Pages</h1>
		<DateRangePicker bind:value={range} options={ranges} />
	</div>

	<div class="grid grid-cols-2 gap-4 mb-6">
		<div class="bg-surface shadow-card rounded-radius p-6">
			<span class="block text-3xl font-bold tabular-nums">{totalPageviews.toLocaleString()}</span>
			<span class="block text-sm text-muted mt-1">Total Pageviews</span>
		</div>
		<div class="bg-surface shadow-card rounded-radius p-6">
			<span class="block text-3xl font-bold tabular-nums">{totalVisitors.toLocaleString()}</span>
			<span class="block text-sm text-muted mt-1">Total Visitors</span>
		</div>
	</div>

	<input
		type="text"
		placeholder="Search pages..."
		bind:value={searchQuery}
		class="w-full mb-4 bg-surface shadow-card rounded-radius px-4 py-3 text-sm text-text placeholder:text-muted outline-none border border-transparent focus:border-border"
	/>

	<div class="bg-surface shadow-card rounded-radius overflow-hidden">
		<div class="max-h-[600px] overflow-y-auto">
			<table class="w-full border-collapse">
				<thead class="sticky top-0 z-10">
					<tr class="bg-bg/50 backdrop-blur">
						{#each columns as col (col.key)}
							<th
							class="px-3 sm:px-5 h-11 text-xs font-semibold uppercase tracking-wide text-muted select-none {col.align === 'right' ? 'text-right' : 'text-left'} {col.key === 'avg_duration' ? 'hidden sm:table-cell' : ''}"
							>
								{#if col.key === 'page_path'}
									{col.label}
								{:else}
									<button
										type="button"
										onclick={() => toggleSort(col.key as SortKey)}
										class="inline-flex items-center gap-1 hover:text-text transition-colors {col.align === 'right' ? 'flex-row-reverse' : ''}"
									>
										{col.label}
										{#if sortKey === col.key}
											<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
												{#if sortDir === 'asc'}
													<polyline points="18 15 12 9 6 15" />
												{:else}
													<polyline points="6 9 12 15 18 9" />
												{/if}
											</svg>
										{/if}
									</button>
								{/if}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#if loading}
						<tr>
							<td colspan="4" class="px-5 py-16 text-center text-sm text-muted">Loading…</td>
						</tr>
					{:else if error}
						<tr>
							<td colspan="4" class="px-5 py-16 text-center text-sm text-muted">{error}</td>
						</tr>
					{:else if filteredRows.length === 0}
						<tr>
							<td colspan="4" class="px-5 py-16">
								<div class="flex flex-col items-center justify-center gap-2 text-muted">
									<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
										<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
										<polyline points="14 2 14 8 20 8" />
									</svg>
									<span class="text-sm">No pages found</span>
								</div>
							</td>
						</tr>
					{:else}
						{#each filteredRows as row (row.page_path)}
							<tr class="border-b border-border hover:bg-bg/30 transition-colors">
						<td class="px-3 sm:px-5 py-2.5 text-sm font-medium text-text max-w-0">
								<div class="flex flex-col min-w-0 gap-0.5">
									<span class="truncate">{row.page_path}</span>
									{#if row.page_title}
										<span class="text-xs text-muted truncate font-normal">{row.page_title}</span>
									{/if}
								</div>
							</td>
							<td class="px-3 sm:px-5 h-11 text-right">
								<div class="relative w-full">
									<div
										class="absolute right-0 top-0 bottom-0 bg-primary/10 rounded"
										style="width: {maxViews > 0 ? (row.views / maxViews) * 100 : 0}%"
									></div>
									<span class="relative text-sm tabular-nums">{row.views.toLocaleString()}</span>
								</div>
							</td>
							<td class="px-3 sm:px-5 h-11 text-right text-sm tabular-nums">{row.unique_visitors.toLocaleString()}</td>
							<td class="px-3 sm:px-5 h-11 text-right text-sm tabular-nums hidden sm:table-cell">{formatDuration(row.avg_duration)}</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</div>
</Layout>
