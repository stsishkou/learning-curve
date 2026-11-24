// Serves the built site the way GitHub Pages does: files only, `dir/` from `dir/index.html`, 404.html for anything
// missing, `Access-Control-Allow-Origin: *` and `Cache-Control: max-age=600` on everything, text gzipped. `vite
// preview` would run the TanStack Start server instead, which is not what is deployed. Usage: node scripts/serve.ts
// [port]
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { createGzip } from 'node:zlib'

const root = resolve(import.meta.dirname, '../dist/client')
const port = Number(process.argv[2] ?? process.env.PORT ?? 4310)
const base = process.env.DOCS_BASE ?? '/'

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
}

async function file(path: string): Promise<string | null> {
  try {
    const info = await stat(path)
    if (info.isFile()) return path
    if (info.isDirectory()) return file(join(path, 'index.html'))
  } catch {
    // missing: fall through to 404
  }
  return null
}

createServer((request, response) => {
  void (async () => {
    const { pathname } = new URL(request.url ?? '/', 'http://localhost')
    const inside = pathname.startsWith(base) ? `/${pathname.slice(base.length)}` : null
    const target = inside === null ? null : normalize(join(root, decodeURIComponent(inside)))
    const found = target?.startsWith(root) ? await file(target) : null
    const served = found ?? (await file(join(root, '404.html')))
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.setHeader('Cache-Control', 'max-age=600')
    if (!served) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found')
      return
    }
    const type = TYPES[extname(served)] ?? 'application/octet-stream'
    const text = /^(text\/|application\/(json|xml)|image\/svg)/.test(type)
    const gzip = text && /\bgzip\b/.test(request.headers['accept-encoding'] ?? '')
    response.writeHead(found ? 200 : 404, {
      'Content-Type': type,
      ...(text ? { Vary: 'Accept-Encoding' } : {}),
      ...(gzip ? { 'Content-Encoding': 'gzip' } : {}),
    })
    const stream = createReadStream(served)
    if (gzip) stream.pipe(createGzip()).pipe(response)
    else stream.pipe(response)
  })()
}).listen(port, () => console.log(`Serving ${root} at http://localhost:${port}${base}`))
