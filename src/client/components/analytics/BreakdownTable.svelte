<script lang="ts">
	import { cn } from '../../lib/cn'

	let {
		title,
		columns,
		rows,
		total,
		loading = false,
		showFavicon = false,
		showPercentage = true,
		barColor = 'primary',
		tabs = [],
		activeTab = '',
		seeAllUrl = '',
	}: {
		title: string
		columns: { key: string; label: string }[]
		rows: Record<string, any>[]
		total?: number
		showFavicon?: boolean
		showPercentage?: boolean
		barColor?: 'primary' | 'blue' | 'yellow'
		tabs?: { value: string; label: string }[]
	activeTab?: string
		seeAllUrl?: string
	} = $props()

	let numericKey = $derived.by(() => {
		for (const col of columns) {
			if (rows.length > 0 && typeof rows[0]?.[col.key] === 'number') {
				return col.key
			}
		}
		return null
	})

	let maxValue = $derived.by(() => {
		if (!numericKey || rows.length === 0) return 1
		const max = Math.max(...rows.map((r) => Number(r[numericKey]) || 0))
		return max || 1
	})

	function barWidth(value: any): number {
		if (!numericKey) return 0
		const v = Number(value) || 0
		return Math.max(0, Math.min(100, (v / maxValue) * 100))
	}

	let totalValue = $derived.by(() => {
		if (!numericKey || rows.length === 0) return 0
		return rows.reduce((s, r) => s + (Number(r[numericKey]) || 0), 0)
	})

	function pct(value: any): string {
		if (!numericKey || totalValue === 0) return '0%'
		const v = Number(value) || 0
		const p = (v / totalValue) * 100
		if (p === 0) return '0%'
		if (p < 0.1) return '0%'
		if (p < 1) return `${p.toFixed(2)}%`
		return `${p.toFixed(1)}%`
	}

	function formatCell(value: any): string {
		if (typeof value === 'number') {
			return value.toLocaleString()
		}
		return String(value ?? '—')
	}

	function flagEmoji(code: string): string {
		if (!code || code.length !== 2) return ''
		const cc = code.toUpperCase()
		const A = 0x1f1e6
		return String.fromCodePoint(A + cc.charCodeAt(0) - 65) + String.fromCodePoint(A + cc.charCodeAt(1) - 65)
	}

	function isCountryKey(key: string): boolean {
		return key === 'country' || key === 'country_code'
	}

	function faviconUrl(source: string): string | null {
		if (!source || source === 'Direct / None' || source === 'Direct' || source === '(direct)') return null
		const clean = source.replace(/^https?:\/\//, '').split('/')[0]
		// Skip if not a valid domain (contains spaces, parens, or no dot)
		if (!clean.includes('.') || clean.includes(' ')) return null
		return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(clean)}&sz=32`
	}

	const barBgClass = $derived(
		barColor === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30 group-hover/row:bg-blue-200 dark:group-hover/row:bg-blue-900/50'
		: barColor === 'yellow' ? 'bg-yellow-100 dark:bg-yellow-900/30 group-hover/row:bg-yellow-200 dark:group-hover/row:bg-yellow-900/50'
		: 'bg-primary-soft/40 group-hover/row:bg-primary-soft/60'
	)
</script>

<div
	class={cn(
		'relative w-full p-5 flex flex-col bg-surface shadow-card rounded-radius group/card',
	)}
>
	<!-- Header with optional tabs -->
	<div class="w-full flex justify-between border-b border-border pb-2 mb-3">
		{#if tabs.length > 0}
			<div class="flex gap-x-3">
				{#each tabs as tab (tab.value)}
					<button
						type="button"
						onclick={() => onTabChange?.(tab.value)}
						class={cn(
						'text-sm font-normal pb-2 border-b-2 transition-colors',
						activeTab === tab.value
							? 'border-primary text-text font-medium'
							: 'border-transparent text-muted hover:text-text',
						)}
					>
						{tab.label}
					</button>
				{/each}
			</div>
		{:else}
			<h3 class="m-0 text-sm font-semibold">{title}</h3>
		{/if}
	{#if seeAllUrl}
		<a href={seeAllUrl} class="text-muted hover:text-text transition-opacity opacity-0 group-hover/card:opacity-100" aria-label="Expand">
			<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<path d="M8 3H5a2 2 0 0 0-2 2v3" />
				<path d="M21 8V5a2 2 0 0 0-2-2h-3" />
				<path d="M3 16v3a2 2 0 0 0 2 2h3" />
				<path d="M16 21h3a2 2 0 0 0 2-2v-3" />
			</svg>
		</a>
	{/if}
	</div>

	<!-- Loading state -->
	{#if loading}
		<div class="flex-1 flex items-center justify-center py-12">
			<div class="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary"></div>
		</div>
	{:else if rows.length === 0}
		<div class="flex-1 flex flex-col items-center justify-center gap-3 py-12">
			<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="opacity-30">
				<path d="M3 3v18h18" />
				<path d="M7 14l4-4 4 4 6-6" />
			</svg>
			<p class="text-sm text-muted">No data yet</p>
		</div>
	{:else}
		<!-- Column headers -->
		<div class="flex items-center text-xs font-medium text-muted pb-2 px-3">
			<span class="flex-1 px-2">{columns[0]!.label}</span>
			<div class="flex shrink-0 items-center px-2">
				{#each columns.slice(1) as col (col.key)}
					<span class="w-16 text-right">{col.label}</span>
				{/each}
			</div>
		</div>

		<div class="flex flex-col flex-1 gap-1 overflow-hidden">
			{#each rows.slice(0, 7) as row, i (i)}
				<div class="group/row relative flex items-center h-9 px-3 rounded-md hover:bg-bg/50 transition-colors">
					<!-- Bar background -->
					{#if numericKey}
						<div
							class={cn('absolute inset-y-0 left-0 rounded-md transition-colors', barBgClass)}
							style="width: {barWidth(row[numericKey])}%"
							aria-hidden="true"
						></div>
					{/if}

					<!-- Dimension cell -->
					<div class="relative flex flex-1 items-center gap-2 min-w-0 px-2">
						{#if isCountryKey(columns[0]!.key)}
							<span class="text-base shrink-0">{flagEmoji(row[columns[0]!.key])}</span>
						{:else if showFavicon && faviconUrl(row[columns[0]!.key])}
							<img
								src={faviconUrl(row[columns[0]!.key])}
								alt=""
								class="w-4 h-4 shrink-0 rounded-sm"
								referrerpolicy="no-referrer"
								onerror={(e: Event) => (e.target as HTMLImageElement).style.display = 'none'}
							/>
						{/if}
						<span class="truncate text-sm font-medium text-text">{formatCell(row[columns[0]!.key])}</span>
					</div>

					<!-- Metric cells -->
					<div class="relative flex shrink-0 items-center px-2">
						{#each columns.slice(1) as col (col.key)}
							<span class="w-16 text-right text-sm tabular-nums text-text font-medium">{formatCell(row[col.key])}</span>
						{/each}
					{#if showPercentage}<span class="overflow-hidden text-right text-sm tabular-nums text-muted w-0 ml-0 opacity-0 group-hover/card:w-12 group-hover/card:ml-4 group-hover/card:opacity-100 transition-all duration-200 whitespace-nowrap">{numericKey ? pct(row[numericKey]) : ''}</span>{/if}
					</div>
				</div>
			{/each}
		</div>

		<!-- See full stats link -->
		{#if seeAllUrl}
		<a href={seeAllUrl} class="mt-3 pt-3 border-t border-border text-sm font-medium text-primary hover:text-primary-hover transition-colors -mx-5 px-5">
				See full stats →
			</a>
		{/if}
	{/if}
</div>
