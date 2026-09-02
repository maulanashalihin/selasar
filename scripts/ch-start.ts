/**
 * Start ClickHouse if not running, then verify schema is initialized.
 *
 *   bun run ch:start   — ensure ClickHouse is up + schema ready
 *
 * Detects clickhouse binary via PATH. Starts with `clickhouse server --daemon`.
 * Waits up to 10s for HTTP ping, then runs init-clickhouse.ts to ensure
 * the database + events table exist.
 */
import { spawn } from "node:child_process";

const CH_URL = process.env.CLICKHOUSE_URL ?? "http://localhost:8123";
const PING_TIMEOUT_MS = 10_000;
const PING_POLL_MS = 500;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function ping(): Promise<boolean> {
	try {
		const resp = await fetch(`${CH_URL}/ping`);
		return resp.ok;
	} catch {
		return false;
	}
}

async function waitForReady(): Promise<boolean> {
	const start = Date.now();
	while (Date.now() - start < PING_TIMEOUT_MS) {
		if (await ping()) return true;
		await sleep(PING_POLL_MS);
	}
	return false;
}

// 1. Check if already running
if (await ping()) {
	console.log(`ClickHouse already running at ${CH_URL}`);
} else {
	// 2. Find binary
	const bin = Bun.which("clickhouse");
	if (!bin) {
		console.error(
			"ClickHouse binary not found in PATH. Install it first:\n  brew install clickhouse",
		);
		process.exit(1);
	}

	// 3. Start in daemon mode
	console.log("Starting ClickHouse...");
	const child = spawn(bin, ["server", "--daemon"], {
		stdio: "ignore",
		detached: true,
	});
	child.unref();

	// 4. Wait for readiness
	const ready = await waitForReady();
	if (!ready) {
		console.error(
			`ClickHouse did not become ready within ${PING_TIMEOUT_MS / 1000}s.`,
		);
		console.error("Check logs: clickhouse server --daemon may have failed.");
		process.exit(1);
	}
	console.log(`ClickHouse ready at ${CH_URL}`);
}

// 5. Ensure schema is initialized
console.log("Ensuring schema...");
const init = spawn(
	"bun",
	["run", "scripts/init-clickhouse.ts"],
	{ stdio: "inherit", cwd: process.cwd(), env: process.env },
);
init.on("exit", (code: number | null) => {
	if (code !== 0) {
		console.error("Schema init failed. Run `bun run ch:init` manually.");
		process.exit(1);
	}
	console.log("ClickHouse is ready for use.");
});
