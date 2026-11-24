// The hosting comparison of chapter 22, from docs/deployment-research.md (prices read 2026-11-23/24; the sources are
// listed there). Cells say what matters for this app, not everything a provider offers.
export type Fit = 'yes' | 'no' | 'partial'

export interface Host {
  name: string
  /** The cheapest monthly price that runs this app */
  price: string
  free: string
  ssr: Fit
  api: Fit
  disk: Fit
  note: string
  pick?: 'cheapest' | 'value' | 'control' | undefined
}

export const PLANNER_HOSTS: readonly Host[] = [
  {
    name: 'Fly.io',
    price: '$3.84 (≈ $0)',
    free: '$5 of usage a month once a card is on file',
    ssr: 'yes',
    api: 'yes',
    disk: 'yes',
    note: '512 MB machine + 1 GB volume. One machine with one volume: a short gap on each deploy.',
    pick: 'cheapest',
  },
  {
    name: 'Railway Hobby',
    price: '$5',
    free: '$1 credit a month, sleeps when idle',
    ssr: 'yes',
    api: 'yes',
    disk: 'yes',
    note: 'An official TanStack Start hosting partner; Nitro with zero config, volume up to 5 GB.',
    pick: 'value',
  },
  {
    name: 'Hetzner CX23',
    price: '€5.99 + VAT',
    free: 'none',
    ssr: 'yes',
    api: 'yes',
    disk: 'yes',
    note: 'A whole VM with real cron; you run the OS, TLS, backups and deploys.',
    pick: 'control',
  },
  {
    name: 'Render Starter',
    price: '$7.25',
    free: 'spins down after 15 min, no disk',
    ssr: 'yes',
    api: 'yes',
    disk: 'yes',
    note: 'A disk rules out zero-downtime deploys.',
  },
  {
    name: 'Google Cloud Run',
    price: '≈ $0',
    free: '180k vCPU-s, 2M requests',
    ssr: 'yes',
    api: 'yes',
    disk: 'partial',
    note: 'Only a Cloud Storage FUSE mount: no file locking, last write wins. Cold starts.',
  },
  {
    name: 'Azure Container Apps',
    price: '≈ $0 (≈ $5.7 with one warm replica)',
    free: '180k vCPU-s, 2M requests',
    ssr: 'yes',
    api: 'yes',
    disk: 'partial',
    note: 'An Azure Files mount; the most setup of all.',
  },
  {
    name: 'Vercel Hobby',
    price: '$0',
    free: '100 GB transfer, 1M invocations',
    ssr: 'yes',
    api: 'partial',
    disk: 'no',
    note: 'Read-only file system: runs the planner read-only as it is (untested); editing needs Blob or a database.',
  },
  {
    name: 'Netlify',
    price: '$0 – $9',
    free: '300 credits, every project pauses when they run out',
    ssr: 'yes',
    api: 'partial',
    disk: 'no',
    note: '15 credits per production deploy; read-only as it is (untested), editing needs Netlify Blobs.',
  },
  {
    name: 'Cloudflare Workers',
    price: '$5',
    free: '10 ms CPU per request: too little for a solve',
    ssr: 'yes',
    api: 'partial',
    disk: 'no',
    note: 'node:fs is virtual; data to KV, D1 or R2 and HiGHS imported as a module: the largest rewrite.',
  },
]

export interface StaticHost {
  name: string
  price: string
  headers: string
  previews: Fit
  account: string
  note: string
  pick?: 'cheapest' | 'value' | undefined
}

export const STATIC_HOSTS: readonly StaticHost[] = [
  {
    name: 'GitHub Pages',
    price: '$0',
    headers: 'none of your own; sends `access-control-allow-origin: *` and `max-age=600`',
    previews: 'no',
    account: 'none beyond the repository',
    note: 'One site per repository: docs, remote and stand share it under sub-paths.',
    pick: 'cheapest',
  },
  {
    name: 'Cloudflare Workers static assets',
    price: '$0',
    headers: '`_headers`, 100 rules',
    previews: 'yes',
    account: 'Cloudflare account + API token',
    note: 'Unlimited static requests; `immutable` on hashed files and `no-cache` on the manifest.',
    pick: 'value',
  },
  {
    name: 'Vercel',
    price: '$0',
    headers: '`vercel.json`',
    previews: 'yes',
    account: 'Vercel account + token',
    note: 'Fine; 15,000 files per CLI upload.',
  },
  {
    name: 'Netlify',
    price: '$0',
    headers: '`_headers` / `netlify.toml`',
    previews: 'yes',
    account: 'Netlify account + token',
    note: 'The credit cap makes frequent CI deploys a problem.',
  },
  {
    name: 'Azure Static Web Apps',
    price: '$0',
    headers: '`staticwebapp.config.json`',
    previews: 'yes',
    account: 'Azure account + deployment token',
    note: '3 preview environments, 250 MB per environment.',
  },
]
