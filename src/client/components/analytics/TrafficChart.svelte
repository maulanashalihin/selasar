<script lang="ts">
	let {
		data,
		loading = false,
		metric = 'visitors',
	}: {
		data: { date: string; visitors: number; pageviews: number }[]
		loading?: boolean
		metric?: 'visitors' | 'pageviews'
	} = $props()

	let hoverIndex = $state<number | null>(null)
	let containerRef = $state<HTMLDivElement | null>(null)

	const W = 800
	const H = 240
	const PAD_T = 16
	const PAD_B = 32
	const PAD_L = 44
	const PAD_R = 12

	let hasData = $derived(data.length > 0)
	let values = $derived(data.map((d) => (metric === 'visitors' ? d.visitors : d.pageviews)))

	let maxValue = $derived.by(() => {
		if (values.length === 0) return 100
		const max = Math.max(...values)
		// Add 15% headroom for visual breathing room
		const padded = max * 1.15
		if (padded <= 5) return 5
		if (padded <= 10) return 10
		if (padded <= 50) return 50
		if (padded <= 100) return 100
		const magnitude = Math.pow(10, Math.floor(Math.log10(padded)))
		return Math.ceil(padded / magnitude) * magnitude
	})

	let chartH = $derived(H - PAD_T - PAD_B)
	let chartW = $derived(W - PAD_L - PAD_R)

	function xAt(i: number): number {
		if (data.length <= 1) return PAD_L + chartW / 2
		return PAD_L + (chartW / (data.length - 1)) * i
	}

	function yAt(v: number): number {
		return PAD_T + chartH * (1 - v / maxValue)
	}

	// Smooth curve path using monotonic cubic interpolation
	function buildLinePath(): string {
		if (values.length === 0) return ''
		if (values.length === 1) return `M ${xAt(0)} ${yAt(values[0]!)}`

		const pts = values.map((v, i) => ({ x: xAt(i), y: yAt(v) }))
		let path = `M ${pts[0]!.x} ${pts[0]!.y}`

		for (let i = 0; i < pts.length - 1; i++) {
			const p0 = pts[i]!
			const p1 = pts[i + 1]!
			// Control points at midpoint for smooth curve
			const mx = (p0.x + p1.x) / 2
			path += ` C ${mx} ${p0.y}, ${mx} ${p1.y}, ${p1.x} ${p1.y}`
		}
		return path
	}

	function buildAreaPath(): string {
		if (values.length === 0) return ''
		const linePath = buildLinePath()
		const lastX = xAt(values.length - 1)
		const firstX = xAt(0)
		const bottomY = PAD_T + chartH
		return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`
	}

	let linePath = $derived(buildLinePath())
	let areaPath = $derived(buildAreaPath())

	let yTicks = $derived.by(() => {
		const ticks: { y: number; label: string }[] = []
		const steps = 5
		for (let i = 0; i <= steps; i++) {
			const val = (maxValue / steps) * i
			ticks.push({
				y: PAD_T + chartH * (1 - i / steps),
				label: formatShort(val),
			})
		}
		return ticks
	})

	function formatShort(n: number): string {
		if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
		if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
		return String(Math.round(n))
	}

	let xLabels = $derived.by(() => {
		if (data.length === 0) return []
		const indices: number[] = []
		const step = Math.max(1, Math.floor(data.length / 7))
		for (let i = 0; i < data.length; i += step) {
			indices.push(i)
		}
		if (indices[indices.length - 1] !== data.length - 1) {
			indices.push(data.length - 1)
		}
		return indices.map((i) => ({
			x: xAt(i),
			label: formatLabel(data[i]!.date),
		}))
	})

	function formatLabel(date: string): string {
		// Hourly: "2026-08-29 14:00" → "14:00"
		if (date.includes(':')) {
			return date.slice(11, 16)
		}
		// Daily: "2026-08-29" → "8/29"
		if (date.length === 10) {
			const [, m, d] = date.split('-')
			return `${Number(m)}/${Number(d)}`
		}
		// Monthly: "2026-08" → "Aug"
		if (date.length === 7) {
			const [, m] = date.split('-')
			const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
			return names[Number(m) - 1] ?? date
		}
		return date
	}

	function formatTooltipDate(date: string): string {
		if (date.includes(':')) {
			// Hourly
			const [d, time] = date.split(' ')
			const [y, m, day] = d!.split('-')
			return `${new Date(Number(y), Number(m) - 1, Number(day)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${time}`
		}
		if (date.length === 10) {
			const [y, m, d] = date.split('-')
			return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', {
				weekday: 'short',
				month: 'short',
				day: 'numeric',
			})
		}
		if (date.length === 7) {
			const [y, m] = date.split('-')
			return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
		}
		return date
	}

	let hoveredPoint = $derived(
		hoverIndex !== null && hoverIndex < data.length ? data[hoverIndex] : null,
	)
	let hoveredValue = $derived(
		hoverIndex !== null && hoverIndex < values.length ? values[hoverIndex] : null,
	)
	let tooltipX = $derived(hoverIndex !== null ? xAt(hoverIndex) : 0)

	function onMove(e: MouseEvent) {
		if (!containerRef || data.length === 0) return
		const rect = containerRef.getBoundingClientRect()
		const relX = ((e.clientX - rect.left) / rect.width) * W
		const dataX = relX - PAD_L
		const idx = Math.round((dataX / chartW) * (data.length - 1))
		hoverIndex = idx >= 0 && idx < data.length ? idx : null
	}

	function onLeave() {
		hoverIndex = null
	}
</script>

<div class="relative flex flex-col px-4 pb-4">
	<div
		class="relative h-[240px]"
		bind:this={containerRef}
		onmousemove={onMove}
		onmouseleave={onLeave}
		role="img"
		aria-label="Visitor graph"
	>
		<svg
			viewBox={`0 0 ${W} ${H}`}
			width="100%"
			height="100%"
			preserveAspectRatio="none"
			class="overflow-visible"
		>
			<defs>
				<linearGradient id="area-gradient" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color="var(--primary)" stop-opacity="0.2" />
					<stop offset="100%" stop-color="var(--primary)" stop-opacity="0.01" />
				</linearGradient>
			</defs>

			<!-- Y axis grid lines + labels -->
			{#each yTicks as tick}
				<line
					x1={PAD_L}
					y1={tick.y}
					x2={W - PAD_R}
					y2={tick.y}
					stroke="var(--border)"
					stroke-width="1"
					vector-effect="non-scaling-stroke"
				/>
				<text
					x={PAD_L - 8}
					y={tick.y + 3}
					text-anchor="end"
					font-size="10"
					fill="var(--muted)"
					vector-effect="non-scaling-stroke"
				>
					{tick.label}
				</text>
			{/each}

			{#if hasData && !loading}
				<!-- Area fill -->
				<path d={areaPath} fill="url(#area-gradient)" />

				<!-- Line -->
				<path
					d={linePath}
					fill="none"
					stroke="var(--primary)"
					stroke-width="2"
					stroke-linejoin="round"
					stroke-linecap="round"
					vector-effect="non-scaling-stroke"
				/>

				<!-- Hover indicator -->
				{#if hoverIndex !== null && hoveredValue !== null}
					<line
						x1={xAt(hoverIndex)}
						y1={PAD_T}
						x2={xAt(hoverIndex)}
						y2={PAD_T + chartH}
						stroke="var(--primary)"
						stroke-width="1"
						stroke-dasharray="3 3"
						vector-effect="non-scaling-stroke"
						opacity="0.4"
					/>
					<circle
						cx={xAt(hoverIndex)}
						cy={yAt(hoveredValue)}
						r="4"
						fill="var(--primary)"
						stroke="var(--surface)"
						stroke-width="2"
						vector-effect="non-scaling-stroke"
					/>
				{/if}

				<!-- X axis labels -->
				{#each xLabels as lbl}
					<text
						x={lbl.x}
						y={H - 8}
						text-anchor="middle"
						font-size="10"
						fill="var(--muted)"
						vector-effect="non-scaling-stroke"
					>
						{lbl.label}
					</text>
				{/each}
			{/if}
		</svg>

		{#if !hasData && !loading}
			<div class="absolute inset-0 flex flex-col items-center justify-center gap-2">
				<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="opacity-40">
					<path d="M3 3v18h18" />
					<path d="M7 14l4-4 4 4 6-6" />
				</svg>
				<p class="text-sm text-muted">Waiting for data…</p>
			</div>
		{/if}

		{#if loading}
			<div class="absolute inset-0 flex items-center justify-center">
				<div class="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary"></div>
			</div>
		{/if}

		<!-- Hover tooltip -->
		{#if hoveredPoint && hoveredValue !== null}
			<div
				class="pointer-events-none absolute top-0 z-20 -translate-x-1/2 rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-card whitespace-nowrap"
				style="left: {(tooltipX / W) * 100}%"
			>
				<div class="font-semibold text-text">{formatTooltipDate(hoveredPoint.date)}</div>
				<div class="mt-0.5 flex items-center gap-1.5 text-muted">
					<span class="h-2 w-2 rounded-sm bg-primary"></span>
					<span class="tabular-nums">{hoveredValue.toLocaleString()} {metric === 'visitors' ? 'visitors' : 'pageviews'}</span>
				</div>
			</div>
		{/if}
	</div>
</div>
