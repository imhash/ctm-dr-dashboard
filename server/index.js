import express from 'express'
import cors from 'cors'
import { JSONFilePreset } from 'lowdb/node'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, 'db.json')

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

const PORT = process.env.API_PORT || 3001
app.listen(PORT, () => console.log(`Settings API running on http://localhost:${PORT}`))
