import express from 'express'
import cors from 'cors'
import { JSONFilePreset } from 'lowdb/node'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import https from 'https'
import 'dotenv/config'

// Allow self-signed / untrusted certs on customer CTM environments
const httpsAgent = new https.Agent({ rejectUnauthorized: false })

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, 'db.json')

const CTM_API_URL = process.env.CTM_API_URL || ''
const CTM_SERVER  = process.env.CTM_SERVER  || ''

const DEFAULT_DB = {
  settings: {
    sla: {
      switchover: 30,
      switchback: 60,
      failover: 30,
      failback: 60,
      perApp: {},
    },
    timezone: 'UTC',
    pinnedApps: [],
    customerLogo: null,
    customerName: '',
    agentGroups: {},
    topology: { showUnassigned: true, refreshSecs: 30 },
    businessServices: [],
  },
  theme: 'dark',
}

const db = await JSONFilePreset(DB_PATH, DEFAULT_DB)

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// GET all settings
app.get('/api/settings', (req, res) => {
  res.json(db.data.settings)
})

// PUT (merge-update) settings
app.put('/api/settings', async (req, res) => {
  db.data.settings = { ...db.data.settings, ...req.body }
  await db.write()
  res.json(db.data.settings)
})

// GET theme
app.get('/api/theme', (req, res) => {
  res.json({ theme: db.data.theme })
})

// PUT theme
app.put('/api/theme', async (req, res) => {
  db.data.theme = req.body.theme ?? db.data.theme
  await db.write()
  res.json({ theme: db.data.theme })
})

// CTM relay — reads target and server from .env, injects ?ctm= automatically
app.all('/ctm-api/*path', async (req, res) => {
  if (!CTM_API_URL) {
    return res.status(503).json({ error: 'CTM_API_URL not configured in .env' })
  }

  // Rewrite /ctm-api/... → /automation-api/...
  let path = req.url.replace(/^\/ctm-api/, '/automation-api')

  // Inject ctm= server param if configured and not already present
  if (CTM_SERVER && !req.query.ctm) {
    const sep = path.includes('?') ? '&' : '?'
    path = `${path}${sep}ctm=${encodeURIComponent(CTM_SERVER)}`
  }

  const url = `${CTM_API_URL}${path}`
  console.log(`[CTM] ${req.method} ${url}`)

  try {
    const parsed = new URL(url)
    const body   = ['GET', 'HEAD'].includes(req.method) ? null : JSON.stringify(req.body)

    await new Promise((resolve, reject) => {
      const options = {
        hostname: parsed.hostname,
        port:     parsed.port || 443,
        path:     parsed.pathname + parsed.search,
        method:   req.method,
        agent:    httpsAgent,
        headers: {
          ...(req.headers['x-api-key']    ? { 'x-api-key':    req.headers['x-api-key']    } : {}),
          ...(req.headers['content-type'] ? { 'content-type': req.headers['content-type'] } : {}),
          ...(body                        ? { 'content-length': Buffer.byteLength(body)    } : {}),
        },
      }

      const proxy = https.request(options, (upstream) => {
        res.status(upstream.statusCode)
        if (upstream.headers['content-type']) res.setHeader('content-type', upstream.headers['content-type'])
        upstream.pipe(res)
        upstream.on('end', resolve)
      })

      proxy.on('error', reject)
      if (body) proxy.write(body)
      proxy.end()
    })
  } catch (err) {
    console.error('[CTM] relay error:', err.message)
    res.status(502).json({ error: 'CTM relay error', detail: err.message })
  }
})

const PORT = process.env.API_PORT || 3001
app.listen(PORT, () => {
  console.log(`Settings API running on http://localhost:${PORT}`)
  console.log(`CTM target: ${CTM_API_URL || '(not set — configure CTM_API_URL in .env)'}`)
  console.log(`CTM server: ${CTM_SERVER  || '(not set — configure CTM_SERVER in .env)'}`)
})
