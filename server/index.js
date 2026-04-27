import express from 'express'
import cors from 'cors'
import { JSONFilePreset } from 'lowdb/node'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import 'dotenv/config'

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
    const headers = {}
    if (req.headers['x-api-key'])    headers['x-api-key']    = req.headers['x-api-key']
    if (req.headers['content-type']) headers['content-type'] = req.headers['content-type']

    const upstream = await fetch(url, {
      method:  req.method,
      headers,
      body:    ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
    })

    const text = await upstream.text()
    res.status(upstream.status)
    const ct = upstream.headers.get('content-type')
    if (ct) res.setHeader('content-type', ct)
    res.send(text)
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
