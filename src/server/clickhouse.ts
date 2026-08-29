/**
 * ClickHouse HTTP client — zero dependency, uses fetch.
 * Queries and inserts via the ClickHouse HTTP interface (default port 8123).
 */

const CH_URL = process.env.CLICKHOUSE_URL ?? "http://localhost:8123";
const CH_DB = process.env.CLICKHOUSE_DB ?? "analytics";

/** Execute a SELECT query and return parsed JSON rows. */
export async function chQuery<T = Record<string, unknown>>(
	sql: string,
): Promise<T[]> {
	const url = `${CH_URL}/?database=${CH_DB}&query=${encodeURIComponent(sql + " FORMAT JSON")}`;
	const resp = await fetch(url, { method: "POST" });
	if (!resp.ok) {
		const body = await resp.text();
		throw new Error(`ClickHouse query error: ${body}`);
	}
	const json = (await resp.json()) as { data: T[] };
	return json.data;
}

/** Insert rows into a table using JSONEachRow format. */
export async function chInsert(
	table: string,
	rows: Record<string, unknown>[],
): Promise<void> {
	if (rows.length === 0) return;
	const body = rows.map((r) => JSON.stringify(r)).join("\n");
	const url = `${CH_URL}/?database=${CH_DB}&query=${encodeURIComponent(
		`INSERT INTO ${table} FORMAT JSONEachRow`,
	)}`;
	const resp = await fetch(url, { method: "POST", body });
	if (!resp.ok) {
		const text = await resp.text();
		throw new Error(`ClickHouse insert error: ${text}`);
	}
}

/** Ping ClickHouse — returns true if reachable. */
export async function chPing(): Promise<boolean> {
	try {
		const resp = await fetch(`${CH_URL}/ping`, { method: "GET" });
		return resp.ok;
	} catch {
		return false;
	}
}
