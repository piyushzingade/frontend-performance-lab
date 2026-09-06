import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'

/**
 * Local mock API for the network waterfall lab. Real HTTP requests served by
 * the Vite dev server, so they appear in the Chrome Network panel with real
 * timing. DEV ONLY — `vite preview` / static hosts don't run middleware
 * (the lab surfaces an honest error there instead of fake data).
 */
function mockLabApi(): Plugin {
  const latency: Record<string, number> = {
    user: 140,
    profile: 190,
    permissions: 160,
    preferences: 210,
    stats: 230,
    activity: 260,
    recommendations: 300,
  }
  const bodies: Record<string, (q: URLSearchParams) => object> = {
    user: () => ({ id: 7, name: 'Ada Lovelace' }),
    profile: (q) => ({ userId: q.get('userId'), role: 'accountant', region: 'West' }),
    permissions: (q) => ({ userId: q.get('userId'), scopes: ['vouchers:write', 'ledgers:read'] }),
    preferences: (q) => ({ userId: q.get('userId'), theme: 'light', pageSize: 50 }),
    stats: () => ({ revenue: 482_000, orders: 1250 }),
    activity: () => ({ events: ['voucher #901 saved', 'ledger validated', 'export done'] }),
    recommendations: () => ({ items: ['Reconcile Bank Account', 'Review XYZ Suppliers'] }),
  }
  return {
    name: 'mock-lab-api',
    configureServer(server) {
      server.middlewares.use('/api/lab/', (req, res) => {
        const url = new URL(req.url ?? '', 'http://localhost')
        const endpoint = url.pathname.split('/').pop() ?? ''
        const wait = latency[endpoint]
        const body = bodies[endpoint]
        if (wait === undefined || !body) {
          res.statusCode = 404
          res.end(JSON.stringify({ error: 'unknown endpoint' }))
          return
        }
        // Realistic jitter around the base latency.
        const delay = wait + Math.random() * 80
        setTimeout(() => {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ endpoint, at: Date.now(), data: body(url.searchParams) }))
        }, delay)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), mockLabApi()],
})
