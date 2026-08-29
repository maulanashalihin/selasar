<script lang="ts">
	let {
		data,
		color = 'var(--primary)',
		height = 40,
	}: {
		data: number[]
		color?: string
		height?: number
	} = $props()

	// Viewbox width is fixed; SVG scales to container via width=100%.
	const W = 100
	const H = 40
	const PAD = 2

	let points = $derived.by(() => {
		if (data.length === 0) return ''
		const min = Math.min(...data)
		const max = Math.max(...data)
		const range = max - min || 1
		const step = data.length > 1 ? (W - PAD * 2) / (data.length - 1) : 0
		return data
			.map((v, i) => {
				const x = PAD + i * step
				// Invert y: higher value = top
				const y = PAD + (H - PAD * 2) * (1 - (v - min) / range)
				return `${x.toFixed(2)},${y.toFixed(2)}`
			})
			.join(' ')
	})
</script>

{#if data.length > 0}
	<svg
		viewBox={`0 0 ${W} ${H}`}
		width="100%"
		{height}
		preserveAspectRatio="none"
		aria-hidden="true"
	>
		<polyline
			points={points}
			fill="none"
			stroke={color}
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			vector-effect="non-scaling-stroke"
		/>
	</svg>
{:else}
	<div style="height: {height}px"></div>
{/if}
