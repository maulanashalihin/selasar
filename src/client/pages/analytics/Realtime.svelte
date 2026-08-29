<script lang="ts">
	import Layout from '../../components/Layout.svelte'
	import type { Site } from '../../../shared/types'
	import LiveBadge from '../../components/analytics/LiveBadge.svelte'
	import Skeleton from '../../components/ui/Skeleton.svelte'

	let { site }: { site: Site } = $props()

	type RealtimeRow = { page_path?: string; source?: string; country?: string; device?: string; visitors: number }
	type RealtimeData = {
		activeVisitors: number
		topPages: RealtimeRow[]
		topSources: RealtimeRow[]
		topCountries: RealtimeRow[]
		topDevices: RealtimeRow[]
	}

	let data = $state<RealtimeData | null>(null)
	let loading = $state(true)

	async function fetchRealtime() {
		try {
			const res = await fetch(`/api/analytics/realtime?site_id=${site.id}`)
			if (!res.ok) throw new Error(`HTTP ${res.status}`)
			data = (await res.json()) as RealtimeData
		} catch {
			// keep old data
		} finally {
			loading = false
		}
	}

	$effect(() => {
		fetchRealtime()
		const interval = setInterval(fetchRealtime, 5000)
		return () => clearInterval(interval)
	})

	let activeVisitors = $derived(data?.activeVisitors ?? 0)

	function maxVisitors(rows: RealtimeRow[]): number {
		return rows.length > 0 ? Math.max(...rows.map((r) => r.visitors)) : 0
	}

	function barWidth(visitors: number, max: number): string {
		return `${max > 0 ? (visitors / max) * 100 : 0}%`
	}

	function label(row: RealtimeRow, key: string): string {
		return (row as Record<string, unknown>)[key] as string || '—'
	}
</script>

<svelte:head><title>Realtime — {site.name}</title></svelte:head>

<Layout>
	<div class="flex items-center justify-between gap-4 flex-wrap mb-6">
		<div>
			<h1 class="text-[1.6rem] m-0 mb-1 tracking-tight font-bold">Realtime</h1>
			<p class="text-muted m-0 text-sm">{site.name}</p>
		</div>
		<LiveBadge count={activeVisitors} {loading} />
	</div>

	<!-- Active visitors big number -->
	<div class="bg-surface shadow-card rounded-radius p-6 mb-6 flex flex-col items-center justify-center py-16">
		{#if loading}
			<Skeleton class="h-16 w-32" />
		{:else}
			<span class="text-5xl font-bold tracking-tight text-text tabular-nums">{activeVisitors}</span>
		{/if}
		<span class="text-sm text-muted mt-2">active visitors right now</span>
	</div>

	<!-- Breakdown grid -->
	<div class="grid grid-cols-2 gap-4 max-md:grid-cols-1">
		<!-- Top Pages -->
		<div class="bg-surface shadow-card rounded-radius p-5 flex flex-col">
			<h2 class="text-sm font-bold m-0 mb-3">Top Pages</h2>
			{#if loading}
				<div class="flex flex-col gap-1">{#each Array(5) as _, i (i)}<Skeleton class="h-9 w-full" />{/each}</div>
			{:else if data?.topPages?.length === 0}
<div class="flex flex-col items-center justify-center py-10 text-center">
  <div class="w-12 h-12 rounded-xl bg-bg flex items-center justify-center mb-3">
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-muted opacity-50" aria-hidden="true">
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
    </svg>
  </div>
  <p class="text-sm text-muted m-0">No active visitors right now</p>
  <p class="text-xs text-muted mt-1 m-0">Data updates every 30 seconds</p>
</div>
			{:else}
				<div class="flex flex-col gap-1">
					{#each data?.topPages ?? [] as row (row.page_path)}
						<div class="group/row relative flex items-center h-9 px-3 rounded-md hover:bg-bg/50 transition-colors">
							<div class="absolute inset-y-0 left-0 bg-primary-soft/40 rounded-md transition-all" style={`width: ${barWidth(row.visitors, maxVisitors(data?.topPages ?? []))}`}></div>
							<span class="relative flex-1 truncate text-sm font-medium text-text px-2">{label(row, 'page_path')}</span>
							<span class="relative text-sm font-semibold text-text tabular-nums shrink-0 px-2">{row.visitors}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Top Sources -->
		<div class="bg-surface shadow-card rounded-radius p-5 flex flex-col">
			<h2 class="text-sm font-bold m-0 mb-3">Top Sources</h2>
			{#if loading}
				<div class="flex flex-col gap-1">{#each Array(5) as _, i (i)}<Skeleton class="h-9 w-full" />{/each}</div>
			{:else if data?.topSources?.length === 0}
<div class="flex flex-col items-center justify-center py-10 text-center">
  <div class="w-12 h-12 rounded-xl bg-bg flex items-center justify-center mb-3">
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-muted opacity-50" aria-hidden="true">
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
    </svg>
  </div>
  <p class="text-sm text-muted m-0">No active visitors right now</p>
  <p class="text-xs text-muted mt-1 m-0">Data updates every 30 seconds</p>
</div>
			{:else}
				<div class="flex flex-col gap-1">
					{#each data?.topSources ?? [] as row (row.source)}
						<div class="group/row relative flex items-center h-9 px-3 rounded-md hover:bg-bg/50 transition-colors">
							<div class="absolute inset-y-0 left-0 bg-primary-soft/40 rounded-md transition-all" style={`width: ${barWidth(row.visitors, maxVisitors(data?.topSources ?? []))}`}></div>
							<span class="relative flex-1 truncate text-sm font-medium text-text px-2">{label(row, 'source')}</span>
							<span class="relative text-sm font-semibold text-text tabular-nums shrink-0 px-2">{row.visitors}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Top Countries -->
		<div class="bg-surface shadow-card rounded-radius p-5 flex flex-col">
			<h2 class="text-sm font-bold m-0 mb-3">Top Countries</h2>
			{#if loading}
				<div class="flex flex-col gap-1">{#each Array(5) as _, i (i)}<Skeleton class="h-9 w-full" />{/each}</div>
			{:else if data?.topCountries?.length === 0}
<div class="flex flex-col items-center justify-center py-10 text-center">
  <div class="w-12 h-12 rounded-xl bg-bg flex items-center justify-center mb-3">
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-muted opacity-50" aria-hidden="true">
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
    </svg>
  </div>
  <p class="text-sm text-muted m-0">No active visitors right now</p>
  <p class="text-xs text-muted mt-1 m-0">Data updates every 30 seconds</p>
</div>
			{:else}
				<div class="flex flex-col gap-1">
					{#each data?.topCountries ?? [] as row (row.country)}
						<div class="group/row relative flex items-center h-9 px-3 rounded-md hover:bg-bg/50 transition-colors">
							<div class="absolute inset-y-0 left-0 bg-primary-soft/40 rounded-md transition-all" style={`width: ${barWidth(row.visitors, maxVisitors(data?.topCountries ?? []))}`}></div>
							<span class="relative flex-1 truncate text-sm font-medium text-text px-2">{label(row, 'country')}</span>
							<span class="relative text-sm font-semibold text-text tabular-nums shrink-0 px-2">{row.visitors}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Top Devices -->
		<div class="bg-surface shadow-card rounded-radius p-5 flex flex-col">
			<h2 class="text-sm font-bold m-0 mb-3">Top Devices</h2>
			{#if loading}
				<div class="flex flex-col gap-1">{#each Array(5) as _, i (i)}<Skeleton class="h-9 w-full" />{/each}</div>
			{:else if data?.topDevices?.length === 0}
<div class="flex flex-col items-center justify-center py-10 text-center">
  <div class="w-12 h-12 rounded-xl bg-bg flex items-center justify-center mb-3">
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-muted opacity-50" aria-hidden="true">
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
    </svg>
  </div>
  <p class="text-sm text-muted m-0">No active visitors right now</p>
  <p class="text-xs text-muted mt-1 m-0">Data updates every 30 seconds</p>
</div>
			{:else}
				<div class="flex flex-col gap-1">
					{#each data?.topDevices ?? [] as row (row.device)}
						<div class="group/row relative flex items-center h-9 px-3 rounded-md hover:bg-bg/50 transition-colors">
							<div class="absolute inset-y-0 left-0 bg-primary-soft/40 rounded-md transition-all" style={`width: ${barWidth(row.visitors, maxVisitors(data?.topDevices ?? []))}`}></div>
							<span class="relative flex-1 truncate text-sm font-medium text-text px-2">{label(row, 'device')}</span>
							<span class="relative text-sm font-semibold text-text tabular-nums shrink-0 px-2">{row.visitors}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</Layout>
