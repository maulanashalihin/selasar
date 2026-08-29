/**
 * Seed ClickHouse with 90 days of realistic analytics data for site_id=1.
 * Run: bun run scripts/seed-clickhouse.ts
 */
import { chQuery, chInsert } from "../src/server/clickhouse"

const SITE_ID = 1
const DOMAIN = "test.com"
const DAYS = 90

// Realistic data pools
const PAGES = [
	{ path: "/", title: "Home" },
	{ path: "/pricing", title: "Pricing" },
	{ path: "/docs", title: "Documentation" },
	{ path: "/docs/getting-started", title: "Getting Started" },
	{ path: "/blog", title: "Blog" },
	{ path: "/blog/why-analytics-matters", title: "Why Analytics Matters" },
	{ path: "/blog/clickhouse-vs-sqlite", title: "ClickHouse vs SQLite" },
	{ path: "/about", title: "About Us" },
	{ path: "/contact", title: "Contact" },
	{ path: "/features", title: "Features" },
	{ path: "/changelog", title: "Changelog" },
	{ path: "/signup", title: "Sign Up" },
]

const CUSTOM_EVENTS = [
	{ event_name: "signup_click", page: "/signup", weight: 30 },
	{ event_name: "demo_request", page: "/contact", weight: 15 },
	{ event_name: "newsletter_signup", page: "/blog", weight: 20 },
	{ event_name: "pricing_view", page: "/pricing", weight: 25 },
	{ event_name: "docs_search", page: "/docs", weight: 10 },
]

const SOURCES = [
	{ source: "google.com", medium: "search", weight: 40 },
	{ source: "twitter.com", medium: "social", weight: 15 },
	{ source: "github.com", medium: "referral", weight: 12 },
	{ source: "linkedin.com", medium: "social", weight: 8 },
	{ source: "(direct)", medium: "direct", weight: 15 },
	{ source: "reddit.com", medium: "social", weight: 5 },
	{ source: "hn.algolia.com", medium: "referral", weight: 3 },
	{ source: "producthunt.com", medium: "referral", weight: 2 },
]

const DEVICES = [
	{ device: "Desktop", browser: "Chrome", weight: 45 },
	{ device: "Desktop", browser: "Safari", weight: 15 },
	{ device: "Desktop", browser: "Firefox", weight: 8 },
	{ device: "Desktop", browser: "Edge", weight: 5 },
	{ device: "Mobile", browser: "Chrome", weight: 18 },
	{ device: "Mobile", browser: "Safari", weight: 7 },
	{ device: "Tablet", browser: "Safari", weight: 2 },
]

const OS_POOL = [
	{ os: 'Windows', weight: 40 },
	{ os: 'macOS', weight: 25 },
	{ os: 'Linux', weight: 10 },
	{ os: 'Android', weight: 15 },
	{ os: 'iOS', weight: 8 },
	{ os: 'Unknown', weight: 2 },
]

const COUNTRIES = [
	{ country: "United States", code: "US", weight: 35 },
	{ country: "United Kingdom", code: "GB", weight: 12 },
	{ country: "Germany", code: "DE", weight: 10 },
	{ country: "India", code: "IN", weight: 8 },
	{ country: "Japan", code: "JP", weight: 7 },
	{ country: "France", code: "FR", weight: 6 },
	{ country: "Canada", code: "CA", weight: 5 },
	{ country: "Australia", code: "AU", weight: 4 },
	{ country: "Brazil", code: "BR", weight: 4 },
	{ country: "Netherlands", code: "NL", weight: 3 },
	{ country: "Singapore", code: "SG", weight: 3 },
	{ country: "Indonesia", code: "ID", weight: 3 },
]

const CITIES: Record<string, string[]> = {
	US: ["New York", "Los Angeles", "Chicago", "Houston", "San Francisco", "Seattle"],
	GB: ["London", "Manchester", "Birmingham", "Edinburgh", "Bristol"],
	DE: ["Berlin", "Munich", "Hamburg", "Frankfurt", "Cologne"],
	IN: ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai"],
	JP: ["Tokyo", "Osaka", "Yokohama", "Nagoya", "Kyoto"],
	FR: ["Paris", "Marseille", "Lyon", "Toulouse", "Nice"],
	CA: ["Toronto", "Vancouver", "Montreal", "Calgary", "Ottawa"],
	AU: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide"],
	BR: ["São Paulo", "Rio de Janeiro", "Brasília", "Salvador", "Fortaleza"],
	NL: ["Amsterdam", "Rotterdam", "The Hague", "Utrecht", "Eindhoven"],
	SG: ["Singapore"],
	ID: ["Jakarta", "Surabaya", "Bandung", "Medan", "Bekasi"],
}

const UTM_CAMPAIGNS = [
	{ campaign: "summer_sale", content: "banner_top", term: "analytics tool", weight: 30 },
	{ campaign: "black_friday", content: "sidebar_ad", term: "clickhouse analytics", weight: 25 },
	{ campaign: "newsletter_promo", content: "email_link", term: "web analytics", weight: 20 },
	{ campaign: "product_hunt_launch", content: "ph_badge", term: "open source analytics", weight: 15 },
	{ campaign: "", content: "", term: "", weight: 10 },
]

function weightedPick<T extends { weight: number }>(pool: T[]): T {
	const total = pool.reduce((s, p) => s + p.weight, 0)
	let r = Math.random() * total
	for (const item of pool) {
		r -= item.weight
		if (r <= 0) return item
	}
	return pool[pool.length - 1]!
}

function randomVisitorId(): string {
	return Array.from({ length: 16 }, () => Math.floor(Math.random() * 256))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("")
}

function randomSessionId(): string {
	return Array.from({ length: 12 }, () => Math.floor(Math.random() * 256))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("")
}

// Generate data
const rows: Record<string, unknown>[] = []
const now = new Date()

for (let dayOffset = DAYS - 1; dayOffset >= 0; dayOffset--) {
	const date = new Date(now)
	date.setDate(date.getDate() - dayOffset)
	const dateStr = date.toISOString().slice(0, 10)

	// Base visitors per day with weekly seasonality + growth trend
	const dayOfWeek = date.getDay()
	const weekendDip = dayOfWeek === 0 || dayOfWeek === 6 ? 0.6 : 1.0
	const growthFactor = 1 + (DAYS - dayOffset) / DAYS * 0.5 // 50% growth over period
	const baseVisitors = Math.round(800 * weekendDip * growthFactor)
	// Add some noise
	const visitorsToday = Math.round(baseVisitors * (0.8 + Math.random() * 0.4))

	for (let v = 0; v < visitorsToday; v++) {
		const visitorId = randomVisitorId()
		const sessionId = randomSessionId()
		const source = weightedPick(SOURCES)
		const device = weightedPick(DEVICES)
		const country = weightedPick(COUNTRIES)
		const cityList = CITIES[country.code] ?? []
		const city = cityList.length > 0 ? cityList[Math.floor(Math.random() * cityList.length)]! : ""
		const os = weightedPick(OS_POOL).os
		const isNewVisitor = Math.random() > 0.3 ? 1 : 0
		// ~20% of visitors arrive via a UTM campaign
		const utm = Math.random() < 0.2 ? weightedPick(UTM_CAMPAIGNS) : null

		// Each visitor views 1-5 pages
		const pagesViewed = Math.floor(Math.random() * 5) + 1
		const isBounce = pagesViewed === 1 ? 1 : 0

		for (let p = 0; p < pagesViewed; p++) {
			const page = PAGES[Math.floor(Math.random() * PAGES.length)]!
			const hour = Math.floor(Math.random() * 24)
			const minute = Math.floor(Math.random() * 60)
			const second = Math.floor(Math.random() * 60)
			const eventTime = `${dateStr} ${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:${second.toString().padStart(2, "0")}`

			// Duration: first page longer, subsequent shorter
			const duration = p === 0
				? Math.floor(Math.random() * 120000) + 5000 // 5s-125s
				: Math.floor(Math.random() * 60000) + 2000 // 2s-62s

			rows.push({
				site_id: SITE_ID,
				domain: DOMAIN,
				event_time: eventTime,
				event_date: dateStr,
				event_name: "pageview",
				visitor_id: visitorId,
				session_id: sessionId,
				page_path: page.path,
				page_title: page.title,
				source: source.source,
				medium: source.medium,
				device: device.device,
				browser: device.browser,
				country: country.code,
				city,
				duration_ms: duration,
				is_new_visitor: isNewVisitor,
				is_bounce: isBounce,
				os,
				utm_campaign: utm?.campaign ?? "",
				utm_content: utm?.content ?? "",
				utm_term: utm?.term ?? "",
			})
		}

		// ~15% of visitors trigger a custom event
		if (Math.random() < 0.15) {
			const customEvent = weightedPick(CUSTOM_EVENTS)
			const hour = Math.floor(Math.random() * 24)
			const minute = Math.floor(Math.random() * 60)
			const second = Math.floor(Math.random() * 60)
			const eventTime = `${dateStr} ${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:${second.toString().padStart(2, "0")}`
			rows.push({
				site_id: SITE_ID,
				domain: DOMAIN,
				event_time: eventTime,
				event_date: dateStr,
				event_name: customEvent.event_name,
				visitor_id: visitorId,
				session_id: sessionId,
				page_path: customEvent.page,
				page_title: customEvent.event_name,
				source: source.source,
				medium: source.medium,
				device: device.device,
				browser: device.browser,
				country: country.code,
				city,
				duration_ms: 0,
				is_new_visitor: isNewVisitor,
				is_bounce: 0,
				os,
				utm_campaign: utm?.campaign ?? "",
				utm_content: utm?.content ?? "",
				utm_term: utm?.term ?? "",
			})
		}
	}
}

console.log(`Generated ${rows.length.toLocaleString()} events over ${DAYS} days`)

// Insert in batches of 5000
const BATCH = 5000
for (let i = 0; i < rows.length; i += BATCH) {
	const batch = rows.slice(i, i + BATCH)
	await chInsert("events", batch)
	console.log(`  Inserted batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(rows.length / BATCH)}`)
}

// Verify
const count = await chQuery<{ count: number }>("SELECT count() AS count FROM events WHERE site_id = 1")
const visitors = await chQuery<{ v: number }>("SELECT uniq(visitor_id) AS v FROM events WHERE site_id = 1")
const pageviews = await chQuery<{ p: number }>("SELECT countIf(event_name = 'pageview') AS p FROM events WHERE site_id = 1")

console.log(`\nDone!`)
console.log(`  Total events: ${count[0]?.count.toLocaleString()}`)
console.log(`  Unique visitors: ${visitors[0]?.v.toLocaleString()}`)
console.log(`  Pageviews: ${pageviews[0]?.p.toLocaleString()}`)
