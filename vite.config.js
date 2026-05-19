import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolveWebcamUrl } from './lib/resolveStream.js'

function apiResolveDevPlugin() {
  return {
    name: 'api-resolve-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0]
        if (path !== '/api/resolve') return next()

        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Access-Control-Allow-Origin', '*')

        if (req.method === 'OPTIONS') {
          res.statusCode = 200
          res.end()
          return
        }

        const query = new URL(req.url, 'http://localhost').searchParams
        const url = query.get('url')
        if (!url) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'Missing url param' }))
          return
        }

        try {
          const result = await resolveWebcamUrl(url);
          if (result.reason === 'domain_not_allowed') {
            res.statusCode = 403
            res.end(JSON.stringify({ error: 'Domain not allowed' }))
            return
          }
          res.statusCode = 200
          res.end(JSON.stringify(result))
        } catch (err) {
          res.statusCode = 502
          res.end(JSON.stringify({ error: err.message }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), apiResolveDevPlugin()],
  server: {
    port: 3001,
    host: '0.0.0.0',
  },
})
