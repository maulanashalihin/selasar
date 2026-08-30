/**
 * `bun run db:seed [email] [password] [role]` — create a demo user.
 * Defaults: demo@example.com / password123 / user.
 * Example: bun run db:seed admin@example.com admin123 admin
 */
import { hashPassword } from '../src/server/auth'
import { addDomain, createSite, createUserWithRole, findUserByEmail, setPrimaryDomain } from '../src/server/db'

const email = process.argv[2] ?? 'demo@example.com'
const password = process.argv[3] ?? 'password123'
const role = (process.argv[4] ?? 'user').toLowerCase()

if (role !== 'user' && role !== 'admin') {
  console.error('Role must be "user" or "admin".')
  process.exit(1)
}

if (findUserByEmail.get(email)) {
  console.log(`User ${email} already exists.`)
  process.exit(0)
}

const passwordHash = await hashPassword(password)
const user = createUserWithRole.get('Demo User', email, passwordHash, role)

// Create a demo site so the dashboard isn't empty on first login.
// The ClickHouse seed (seed-clickhouse.ts) generates 250k events for site_id=1.
const trackingId = crypto.randomUUID()
if (!user) { console.error('Failed to create user.'); process.exit(1) }
const site = createSite.get(user.id, 'Demo Site', trackingId, 'UTC')
if (site) {
  addDomain.get(site.id, 'test.com')
  setPrimaryDomain.run('test.com', site.id)
  console.log(`Created demo site "Demo Site" (id=${site.id}, domain=test.com, tracking_id=${trackingId})`)
}
console.log(`Seeded ${email} (password: ${password}, role: ${role})`)
