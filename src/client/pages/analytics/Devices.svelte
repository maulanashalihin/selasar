<script lang="ts">
	import Layout from '../../components/Layout.svelte'
	import type { Site } from '../../../shared/types'
	import DateRangePicker from '../../components/analytics/DateRangePicker.svelte'
	import { DATE_RANGES } from '../../lib/date-ranges'

	let { site }: { site: Site } = $props()

	type DeviceRow = {
		device: string
		browser: string
		visitors: number
	}

	let range = $state('28d')
	const ranges = DATE_RANGES

	let rows = $state<DeviceRow[]>([])
	let osRows = $state<DeviceRow[]>([])
	let totalVisitors = $state(0)
	let loading = $state(true)
	let error = $state<string | null>(null)

	async function fetchDevices() {
		loading = true
		try {
			const [res, osRes] = await Promise.all([
				fetch(`/api/analytics/devices?site_id=${site.id}&range=${range}`),
				fetch(`/api/analytics/devices?site_id=${site.id}&range=${range}&type=os`),
			])
			if (!res.ok) throw new Error(`HTTP ${res.status}`)
			const data = (await res.json()) as { totalVisitors: number; devices: DeviceRow[] }
			rows = data.devices ?? []
			totalVisitors = data.totalVisitors ?? 0
			if (osRes.ok) {
				const osData = (await osRes.json()) as { totalVisitors: number; devices: DeviceRow[] }
				osRows = osData.devices ?? []
			} else {
				osRows = []
			}
			error = null
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load'
			rows = []
			totalVisitors = 0
			osRows = []
		} finally {
			loading = false
		}
	}

	$effect(() => {
		fetchDevices()
	})

	const DEVICE_ORDER = ['Desktop', 'Mobile', 'Tablet']

	type DeviceTotal = {
		device: string
		visitors: number
		percentage: number
	}

	type BrowserTotal = {
		browser: string
		visitors: number
		percentage: number
	}

	const deviceTotals = $derived.by<DeviceTotal[]>(() => {
		const map = new Map<string, number>()
		for (const row of rows) {
			map.set(row.device, (map.get(row.device) ?? 0) + row.visitors)
		}
		const entries = [...map.entries()]
		entries.sort((a, b) => {
			const ai = DEVICE_ORDER.indexOf(a[0])
			const bi = DEVICE_ORDER.indexOf(b[0])
			if (ai === -1 && bi === -1) return a[0].localeCompare(b[0])
			if (ai === -1) return 1
			if (bi === -1) return -1
			return ai - bi
		})
		return entries.map(([device, visitors]) => ({
			device,
			visitors,
			percentage: totalVisitors > 0 ? (visitors / totalVisitors) * 100 : 0,
		}))
	})

	const browserTotals = $derived.by<BrowserTotal[]>(() => {
		const map = new Map<string, number>()
		for (const row of rows) {
			map.set(row.browser, (map.get(row.browser) ?? 0) + row.visitors)
		}
		const entries = [...map.entries()]
		entries.sort((a, b) => b[1] - a[1])
		return entries.map(([browser, visitors]) => ({
			browser,
			visitors,
			percentage: totalVisitors > 0 ? (visitors / totalVisitors) * 100 : 0,
		}))
	})

	const maxBrowserVisitors = $derived(
		browserTotals.length > 0 ? Math.max(...browserTotals.map((b) => b.visitors)) : 0,
	)

	const osTotals = $derived.by<DeviceTotal[]>(() => {
		const map = new Map<string, number>()
		for (const row of osRows) {
			map.set(row.device, (map.get(row.device) ?? 0) + row.visitors)
		}
		const entries = [...map.entries()]
		entries.sort((a, b) => b[1] - a[1])
		return entries.map(([device, visitors]) => ({
			device,
			visitors,
			percentage: totalVisitors > 0 ? (visitors / totalVisitors) * 100 : 0,
		}))
	})

	const maxOsVisitors = $derived(
		osTotals.length > 0 ? Math.max(...osTotals.map((o) => o.visitors)) : 0,
	)

	function osIconKey(os: string): string {
		const o = os.toLowerCase()
		if (o.includes('win')) return 'windows'
		if (o.includes('android')) return 'android'
		if (o.includes('ios') || o.includes('iphone') || o.includes('ipad')) return 'ios'
		if (o.includes('mac')) return 'macos'
		if (o.includes('linux') || o.includes('ubuntu') || o.includes('debian') || o.includes('fedora') || o.includes('chrome')) return 'linux'
		return 'unknown'
	}
</script>

<svelte:head><title>Devices — {site.name}</title></svelte:head>

<Layout>
	<div class="flex items-center justify-between gap-4 flex-wrap mb-6">
		<div>
			<h1 class="text-[1.6rem] m-0 mb-1 tracking-tight font-bold">Devices</h1>
			<p class="text-muted m-0 text-sm">{site.name}</p>
		</div>
		<DateRangePicker bind:value={range} options={ranges} />
	</div>

	<div class="bg-surface shadow-card rounded-radius p-6 mb-6 flex flex-col items-center justify-center py-16">
		<span class="text-5xl font-bold tracking-tight text-text tabular-nums">{totalVisitors.toLocaleString()}</span>
		<span class="text-sm text-muted mt-2">total visitors this period</span>
	</div>

	{#if loading}
		<div class="bg-surface shadow-card rounded-radius p-6 mb-6 text-center text-muted text-sm">Loading…</div>
	{:else if error}
		<div class="bg-surface shadow-card rounded-radius p-6 mb-6 text-center text-muted text-sm">{error}</div>
	{:else}
		<div class="grid grid-cols-3 gap-4 mb-6">
			{#each deviceTotals as dt (dt.device)}
				<div class="bg-surface shadow-card rounded-radius p-6 flex flex-col items-center justify-center">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="w-12 h-12 text-text"
					>
						{#if dt.device === 'Mobile'}
							<rect x="5" y="2" width="14" height="20" rx="2" />
							<path d="M12 18h.01" />
						{:else if dt.device === 'Tablet'}
							<rect x="4" y="2" width="16" height="20" rx="2" />
							<path d="M12 18h.01" />
						{:else}
							<rect x="2" y="3" width="20" height="14" rx="2" />
							<path d="M8 21h8" />
							<path d="M12 17v4" />
						{/if}
					</svg>
					<span class="text-sm font-medium mt-3">{dt.device}</span>
					<span class="text-2xl font-bold tabular-nums mt-1">{dt.visitors.toLocaleString()}</span>
					<span class="text-sm text-muted mt-1">{dt.percentage.toFixed(1)}%</span>
					<div class="w-full h-2 rounded-full bg-bg mt-3">
						<div class="h-full rounded-full bg-primary" style="width: {dt.percentage}%"></div>
					</div>
				</div>
			{/each}
		</div>

		<div class="bg-surface shadow-card rounded-radius p-5">
			<div class="text-sm font-semibold mb-3 border-b border-border pb-2">Browsers</div>
			{#each browserTotals as bt (bt.browser)}
				<div class="relative h-9 rounded-md hover:bg-bg/50 px-3 flex items-center justify-between">
					<div
						class="absolute inset-y-1 left-1 rounded bg-primary/10"
						style="width: {maxBrowserVisitors > 0 ? (bt.visitors / maxBrowserVisitors) * 100 : 0}%"
					></div>
					<span class="relative text-sm font-medium z-10">{bt.browser}</span>
					<span class="relative flex items-center gap-3 z-10 ml-auto">
						<span class="text-sm tabular-nums">{bt.visitors.toLocaleString()}</span>
						<span class="text-sm text-muted tabular-nums w-12 text-right">{bt.percentage.toFixed(1)}%</span>
					</span>
				</div>
			{/each}
		</div>

		<div class="bg-surface shadow-card rounded-radius p-5 mt-6">
			<div class="text-sm font-semibold mb-3 border-b border-border pb-2 flex items-center gap-2">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="shrink-0 text-text"
				>
					<rect x="2" y="3" width="20" height="14" rx="2" />
					<path d="M8 21h8" />
					<path d="M12 17v4" />
				</svg>
				Operating Systems
			</div>
			{#each osTotals as ot (ot.device)}
			<div class="relative h-9 rounded-md hover:bg-bg/50 px-3 flex items-center justify-between">
					<div
					class="absolute inset-y-1 left-1 rounded bg-primary/10"
						style="width: {maxOsVisitors > 0 ? (ot.visitors / maxOsVisitors) * 100 : 0}%"
					></div>
					<span class="relative flex items-center gap-2 z-10">
						{#if osIconKey(ot.device) === 'windows'}
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-text">
								<rect x="3" y="3" width="8" height="8" rx="1" />
								<rect x="13" y="3" width="8" height="8" rx="1" />
								<rect x="3" y="13" width="8" height="8" rx="1" />
								<rect x="13" y="13" width="8" height="8" rx="1" />
							</svg>
						{:else if osIconKey(ot.device) === 'macos'}
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-text">
								<path d="M12 20c-1.5 0-2.5 1-4 1-2.5 0-5-3.5-5-8 0-4 2.5-6 5-6 1 0 2 .5 4 .5s3-.5 4-.5c2.5 0 5 2 5 6 0 4.5-2.5 8-5 8-1.5 0-2.5-1-4-1z" />
								<path d="M12 8c0-1.5 1-2.5 2-3" />
							</svg>
						{:else if osIconKey(ot.device) === 'ios'}
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-text">
								<path d="M12 20c-1.5 0-2.5 1-4 1-2.5 0-5-3.5-5-8 0-4 2.5-6 5-6 1 0 2 .5 4 .5s3-.5 4-.5c2.5 0 5 2 5 6 0 4.5-2.5 8-5 8-1.5 0-2.5-1-4-1z" />
								<path d="M12 8c0-1.5 1-2.5 2-3" />
							</svg>
						{:else if osIconKey(ot.device) === 'android'}
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-text">
								<path d="M5 14a7 7 0 0 1 14 0" />
								<path d="M8 9l-1.5-2.5" />
								<path d="M16 9l1.5-2.5" />
								<line x1="6" y1="14" x2="18" y2="14" />
								<circle cx="9.5" cy="11.5" r="0.5" fill="currentColor" />
								<circle cx="14.5" cy="11.5" r="0.5" fill="currentColor" />
							</svg>
						{:else if osIconKey(ot.device) === 'linux'}
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-text">
								<polyline points="4 17 10 11 14 11 20 17" />
								<line x1="12" y1="11" x2="12" y2="3" />
								<line x1="8" y1="7" x2="16" y2="7" />
							</svg>
						{:else}
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-text">
								<circle cx="12" cy="12" r="10" />
								<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
								<line x1="12" y1="17" x2="12.01" y2="17" />
							</svg>
						{/if}
						<span class="text-sm font-medium">{ot.device}</span>
					</span>
					<span class="relative flex items-center gap-3 z-10 ml-auto">
						<span class="text-sm tabular-nums">{ot.visitors.toLocaleString()}</span>
						<span class="text-sm text-muted tabular-nums w-12 text-right">{ot.percentage.toFixed(1)}%</span>
					</span>
				</div>
			{/each}
		</div>
	{/if}
</Layout>
