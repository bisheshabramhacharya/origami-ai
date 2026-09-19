import { serve } from '@hono/node-server'
import { app } from './app'
import { SEED_LIBRARY } from '@origami/core'

const port = Number(process.env.PORT ?? 8787)

serve({ fetch: app.fetch, port }, (info) => {
  const llm = process.env.ANTHROPIC_API_KEY ? 'anthropic tutor enabled' : 'offline heuristic tutor'
  console.log(`Origami AI API listening on http://localhost:${info.port}`)
  console.log(`  ${SEED_LIBRARY.length} validated models loaded`)
  console.log(`  ${llm}`)
})
