# Deployment research: where the planner and the docs can run

Prices and limits read 2026-11-23/24 from the providers' own pages (sources at the end), plus live `curl -I` against
GitHub Pages. Nothing was deployed. Cells marked **unverified** could not be confirmed on a first-party page; lines
marked **computed** are arithmetic from a cited unit price.

There are two different things to host, and they need different kinds of hosting:

1. **The planner** (`apps/web`): a TanStack Start app with server-side rendering, server functions and `/api/*`
   routes, which reads and writes JSON files (`packages/plan-data/src/store.ts`, `library.ts`; sync and history
   files) and runs the HiGHS solver from a `.wasm` file on disk. It needs a long-lived Node process **and a writable
   disk**. `PLAN_DATA_DIR` already points the store at another directory, so a mounted volume needs no code change.
   The Nitro build copies `highs` with its `.wasm` (`traceDeps: ['highs*']` in `apps/web/vite.config.ts`).
2. **The docs site, its federation remote and the component stand**: static files. They need a CDN, CORS on the
   remote's files (the planner imports them from another origin), and a cache policy that does not keep an old
   `remoteEntry` alive after a deploy.

## 1. Short answer

| | Pick | Monthly | Why |
|---|---|---|---|
| Planner, cheapest without code changes | **Fly.io**, 512 MB machine + 1 GB volume | $3.84, inside the $5 monthly free usage once a card is on file: **~$0** | Real Node process, real disk, wasm works. One machine with one volume: a short gap on each deploy. |
| Planner, least friction | **Railway Hobby** | $5 (includes $5 usage) | Official TanStack hosting partner, Nitro with zero config, always on, volume up to 5 GB. |
| Planner, full control | **Hetzner CX23** | €5.99 + VAT | A whole VM, real cron. You run the OS, TLS, backups and deploys yourself. |
| Docs + remote + stand, cheapest | **GitHub Pages** | $0, no extra account | Sends `Access-Control-Allow-Origin: *` (checked live). Fixed `max-age=600`: handled with a hashed `remoteEntry` and a cache-busting query on the manifest. |
| Docs + remote + stand, best value | **Cloudflare Workers static assets** | $0 | `_headers` for per-path CORS and `immutable`, branch previews. Needs a Cloudflare account and an API token. |

The repository's CI deploys the static outputs to GitHub Pages (`.github/workflows/docs.yml`). The planner stays
undeployed: hosting it is the owner's decision, and chapter 22 of the docs walks through the options.

## 2. The planner

| Option | Cheapest monthly cost for this app | Free tier | SSR / Node | API, background work | Persistent disk | wasm | Notes |
|---|---|---|---|---|---|---|---|
| **Fly.io** [3–5] | 512 MB $3.69 + 1 GB volume $0.15 = **$3.84** (256 MB: $2.19) | $1 credit without a card; **$5 usage every month with a card**; up to 3 machines | Node process (Fly is not on the TanStack list) | Long-lived process; can stop on idle and pay only rootfs + volume | Yes, $0.15/GB-mo; one volume per machine, not replicated | Yes | Brief downtime on deploy with a single machine. Shared IPv4 and 10 certificates free. Egress $0.02/GB (NA/EU). |
| **Railway** [6–8] | **Hobby $5** (includes $5 usage) | $1/mo credit, 0.5 GB RAM, 0.5 GB volume; sleeps 5–10 min after no outbound traffic | Official partner, Nitro | Always on (Hobby) | Yes, $0.15/GB-mo, max 5 GB on Hobby | Yes | No replicas with a volume; brief downtime on redeploy. Egress $0.05/GB. |
| **Render** [9–11] | Starter $7 + disk $0.25/GB = **$7.25** | Spins down after 15 min, ~1 min cold start, **no disk** | Node | Full process on paid plans | Paid plans only | Yes | A disk rules out zero-downtime deploys. |
| **Koyeb** [12–14] | Pro $29 + compute | A free instance is documented; still offered to new accounts: **unverified** | Container | Yes | Volumes in public preview, "suitable only for testing", not on free instances | Yes | Not viable today. |
| **Google Cloud Run** [15–17] | **~$0** scaled to zero | 180k vCPU-s, 360k GiB-s, 2M requests | Container | Yes; CPU outside requests depends on the billing mode | Only a Cloud Storage FUSE mount: no file locking, last write wins | Yes | Custom domains: mapping is limited to some regions, otherwise a load balancer. Cold starts. |
| **Azure App Service** [18–21] | B1 Linux $0.018/h ≈ **$13.1** (computed) | F1: 60 CPU-min/day, no custom domain, no Always On | Node | Yes on B1 | `/home` persists (10 GB on B1) | Yes | Poor value here. |
| **Azure Container Apps** [21–23] | **~$0** scaled to zero; ≈ $5.7 with one idle replica (computed) | 180k vCPU-s, 360k GiB-s, 2M requests | Container | Yes | Azure Files mount (storage price unverified) | Yes | The most setup: environment, storage account, identity. |
| **Hetzner VPS** [24–25] | **CX23 €5.99** excl. VAT (2 vCPU, 4 GB, 40 GB) | None | Anything | Anything, real cron | Native disk | Yes | You own operations. Both plan pages showed every plan as "currently unavailable" when read. |
| **Vercel** [26–30] | **$0** Hobby | 100 GB transfer, 4 active-CPU h, 1M invocations | Via Nitro | Functions up to 300 s; cron once a day on Hobby | **No**: read-only file system, `/tmp` not persistent | Yes (250 MB bundle) | The JSON files and OAuth tokens would have to move to Blob or a database. |
| **Netlify** [31–34] | $0, or Personal $9 | 300 credits/mo, hard cap; **every project pauses** when they run out | Official partner | Functions 60 s; scheduled 30 s | **No**, needs Netlify Blobs | Likely (limit unverified) | 15 credits per production deploy: about 20 deploys a month on the free plan. |
| **Cloudflare Workers** [35–38] | **$5** (paid plan needed) | 100k requests/day but **10 ms CPU per request**: too little for SSR plus a ~1 s solve | Official partner (Cloudflare's Vite plugin) | 30 s CPU (up to 5 min), cron triggers | **No**: `node:fs` is virtual; data must go to KV, D1 or R2 | 64 MiB Worker; highs must be imported as a module, not read from disk | The largest rewrite of all. |

Every serverless target (Vercel, Netlify, Cloudflare) needs the file storage behind `@lc/plan-data` replaced. That
is a real architectural change: `store.ts` is the only writer today, so it would become an interface with a file
implementation and a blob/database one.

### What "supports SSR" and "supports an API" mean here

- **SSR** in TanStack Start is a request handler (Nitro's server output, `node .output/server/index.mjs`). Any host
  that runs a Node process or a Nitro preset can serve it. Static hosts (GitHub Pages, Cloudflare static assets)
  cannot: they serve files, so only a pre-rendered or SPA build fits there. The docs site is pre-rendered for that
  reason.
- **Server functions and `/api/*` routes** run in the same handler. On a VM or a container they are ordinary code in
  the process. On serverless platforms each request may get a fresh, short-lived instance: fine for reading, wrong
  for "write this JSON file and read it on the next request".
- **Background work** (a periodic calendar sync, purging the trash) needs either a process that stays up (Fly,
  Railway, a VPS) or the platform's cron (Vercel once a day on Hobby, Cloudflare cron triggers).

## 3. The docs site, the remote and the stand

| Option | Monthly | Free tier | Headers / CORS | Default headers | Deploy from GitHub Actions | Previews | Notes |
|---|---|---|---|---|---|---|---|
| **GitHub Pages** [39–42] | $0 | Site ≤ 1 GB; 100 GB/mo soft bandwidth; 10-minute deploy timeout | No custom headers (none documented) | **Checked live**: `access-control-allow-origin: *`, `cache-control: max-age=600` on HTML and JS | `actions/deploy-pages`, no extra account | **No** (the `preview` input is not public) | One site per repository: docs, remote and stand go under sub-paths of one artifact. |
| **Cloudflare Workers static assets** [35, 36, 43–46] | $0 | Static requests free and unlimited; 20,000 files per version; 25 MiB per file | `_headers`, 100 rules | Unverified | Yes, with an account and an API token | Yes, 100 per Worker on Free | Best header control. |
| **Netlify** [31–34] | $0 | 300 credits; 15 per production deploy; projects pause when exhausted | `_headers` / `netlify.toml` | Unverified | Account + token | Yes, previews cost 0 credits | The credit cap is a problem for CI deploys. |
| **Vercel** [26, 29, 30] | $0 | 100 GB transfer, 100 deploys/day; CLI upload ≤ 15,000 files | `vercel.json` `headers` | `public, max-age=0, must-revalidate` | Account + token | Yes | Fine. |
| **Azure Static Web Apps** [47–48] | $0 | 100 GB/mo, 250 MB per environment, 15,000 files | `staticwebapp.config.json` | Unverified | Account + deployment token | 3 environments on Free | Fine, most setup. |

### Living with `max-age=600` on GitHub Pages

A Module Federation host first loads the remote's entry (here through `mf-manifest.json`), and the entry names
every chunk. Every chunk name carries a content hash, so a stale chunk is never served under a new name. Two files
have fixed names and can be stale for up to ten minutes after a deploy:

- `mf-manifest.json`: the planner adds a query string that changes per page load (`?v=<timestamp>`), which skips
  the browser cache. Pages' CDN may still serve its own copy for up to the same ten minutes (**unverified**: the
  CDN's behaviour with query strings is not documented).
- `remoteEntry`: built as `remoteEntry-[hash].js`, so the manifest always names the entry that matches its chunks.

The remaining risk is a page opened before a deploy that loads the remote after it: the old manifest names chunks
the deploy deleted (Pages replaces the whole site). The planner treats any load failure as "docs unavailable" and
shows its fallback link; a reload fixes it. Cloudflare's `_headers` (`no-cache` on the manifest, `immutable` on
hashed files) is the clean fix if this ever matters.

## Sources

1. TanStack Start hosting guide — https://tanstack.com/start/latest/docs/framework/react/guide/hosting
2. Nitro deploy presets — https://nitro.build/deploy
3. Fly.io pricing — https://docs.fly.io/about/pricing
4. Fly.io volumes — https://docs.fly.io/volumes/overview/
5. Fly.io autostop/autostart — https://docs.fly.io/launch/autostop-autostart/
6. Railway pricing — https://railway.com/pricing
7. Railway volumes — https://docs.railway.com/reference/volumes
8. Railway app sleeping — https://docs.railway.com/reference/app-sleeping
9. Render pricing — https://render.com/pricing
10. Render free instances — https://render.com/docs/free
11. Render disks — https://render.com/docs/disks
12. Koyeb pricing — https://www.koyeb.com/pricing
13. Koyeb instances — https://www.koyeb.com/docs/reference/instances
14. Koyeb volumes — https://www.koyeb.com/docs/reference/volumes
15. Cloud Run pricing — https://cloud.google.com/run/pricing
16. Cloud Run Cloud Storage volume mounts — https://docs.cloud.google.com/run/docs/configuring/services/cloud-storage-volume-mounts
17. Cloud Run custom domains — https://docs.cloud.google.com/run/docs/mapping-custom-domains
18. Azure App Service Linux pricing — https://azure.microsoft.com/en-us/pricing/details/app-service/linux/
19. Azure App Service limits — https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits#azure-app-service-limits
20. Azure App Service custom containers — https://learn.microsoft.com/en-us/azure/app-service/configure-custom-container
21. Azure Retail Prices API — https://prices.azure.com/api/retail/prices
22. Azure Container Apps pricing — https://azure.microsoft.com/en-us/pricing/details/container-apps/
23. Azure Container Apps storage mounts — https://learn.microsoft.com/en-us/azure/container-apps/storage-mounts
24. Hetzner cost-optimized cloud — https://www.hetzner.com/cloud/cost-optimized/
25. Hetzner regular-performance cloud — https://www.hetzner.com/cloud/regular-performance/
26. Vercel Hobby — https://vercel.com/docs/plans/hobby
27. Vercel function limitations — https://vercel.com/docs/functions/limitations
28. Vercel function runtimes — https://vercel.com/docs/functions/runtimes
29. Vercel limits; cron usage — https://vercel.com/docs/limits, https://vercel.com/docs/cron-jobs/usage-and-pricing
30. Vercel cache headers; `vercel.json` — https://vercel.com/docs/headers/cache-control-headers, https://vercel.com/docs/project-configuration/vercel-json
31. Netlify pricing — https://www.netlify.com/pricing/
32. Netlify credits — https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/
33. Netlify credits FAQ — https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/billing-faq-for-credit-based-plans/
34. Netlify functions; headers — https://docs.netlify.com/build/functions/configuration/, https://docs.netlify.com/manage/routing/headers/
35. Cloudflare Workers limits — https://developers.cloudflare.com/workers/platform/limits/
36. Cloudflare Workers pricing — https://developers.cloudflare.com/workers/platform/pricing/
37. Cloudflare Workers `node:fs` — https://developers.cloudflare.com/workers/runtime-apis/nodejs/fs/
38. Cloudflare setup for TanStack Start — see 1
39. GitHub Pages limits — https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
40. `actions/deploy-pages` — https://github.com/actions/deploy-pages/blob/main/action.yml
41. Live `curl -I`, 2026-11-23 22:56 UTC: https://pages.github.com/, https://octocat.github.io/, https://pages.github.com/js/jquery.js
42. What is GitHub Pages — https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
43. Cloudflare Pages — https://developers.cloudflare.com/pages/
44. Workers static assets headers — https://developers.cloudflare.com/workers/static-assets/headers/
45. Workers previews; build limits — https://developers.cloudflare.com/workers/previews/, https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/
46. Cloudflare Pages limits — https://developers.cloudflare.com/pages/platform/limits/
47. Azure Static Web Apps quotas — https://learn.microsoft.com/en-us/azure/static-web-apps/quotas
48. Azure Static Web Apps configuration — https://learn.microsoft.com/en-us/azure/static-web-apps/configuration
