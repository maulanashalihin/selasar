export type DateRange = {
	value: string
	label: string
	shortcut?: string
}

export const DATE_RANGES: DateRange[] = [
	{ value: 'today', label: 'Today', shortcut: 'T' },
	{ value: 'yesterday', label: 'Yesterday', shortcut: 'Y' },
	{ value: 'realtime', label: 'Realtime', shortcut: 'R' },
	{ value: '24h', label: 'Last 24 Hours', shortcut: '24' },
	{ value: '7d', label: 'Last 7 Days', shortcut: '7' },
	{ value: '28d', label: 'Last 28 Days', shortcut: '28' },
	{ value: '91d', label: 'Last 91 Days', shortcut: '91' },
	{ value: 'mtd', label: 'Month to Date', shortcut: 'M' },
	{ value: 'last_month', label: 'Last Month', shortcut: 'L' },
	{ value: 'ytd', label: 'Year to Date', shortcut: 'Y' },
	{ value: '12mo', label: 'Last 12 Months', shortcut: '12' },
	{ value: 'all', label: 'All time', shortcut: 'A' },
]
