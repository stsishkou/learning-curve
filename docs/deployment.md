# Deploying the planner with Docker

How to run the planner (`apps/web`) in a container on this machine, test the image, and run it on your own server
or a hosted service. Which host to pick and what each costs: [deployment-research.md](deployment-research.md).

1. [What runs where](#what-runs-where)
2. [Run it locally](#1-run-it-locally)
3. [Test the image](#2-test-the-image)
4. [Before any remote deploy](#3-before-any-remote-deploy)
5. [Your own server (VPS)](#4-your-own-server-vps)
6. [Hosted services](#5-hosted-services): Fly.io, Railway, Render, Azure Container Apps, Azure App Service
7. [Updates, backups and restore](#6-updates-backups-and-restore)
8. [Troubleshooting](#7-troubleshooting)

## What runs where

| Part | Where it runs | How |
|---|---|---|
| The planner (`apps/web`) | one container, its data on one volume | this guide |
| The guide and the component stand (`apps/docs`, `apps/stand`) | GitHub Pages, static | `.github/workflows/docs.yml`, on every push to `main` |
| The MCP server (`apps/mcp`) | your machine, started by the assistant | `pnpm run mcp`; it edits the local data, not a deployed planner's |

| File | What it does |
|---|---|
| `apps/web/Dockerfile` | Builds the workspace, keeps only Nitro's server output; health check on `/api/plan` |
| `apps/web/docker-entrypoint.sh` | Hands a root-owned data volume to the `node` user, then runs the server as `node` |
| `.dockerignore` | Keeps live data, secrets, `node_modules` and `.git` out of the build |
| `compose.yaml` | The `planner`, a one-off `seed`, and an optional `proxy` (HTTPS and a password) |
| `Caddyfile` | The proxy's configuration |
| `planner.env.example` | Every setting; copy it to `planner.env` (git-ignored) |
| `scripts/docker-smoke.sh` | The image's smoke test: `pnpm run docker:smoke` |

What the container needs, wherever it runs:

- **One volume at `/data`** (`PLAN_DATA_DIR`). It holds `plan.json`, `edits.json`, the history, the library, the calendar
  sync state and the calendar tokens. An empty volume serves the plan bundled into the image, **read-only**, until a
  plan is copied in (the seed).
- **One instance.** The files and the calendar-sync lock assume a single server: no replicas, no autoscaling past one.
- **Port 3000**, or whatever `PORT` says (Railway sets it).
- **Settings** from the environment: see `planner.env.example`.

## 1. Run it locally

Requires Docker Desktop (or Docker Engine) with Compose 2.24 or later.

```bash
cp planner.env.example planner.env              # optional: OAuth clients, read-only mode, docs button
docker compose up -d --build                    # build the image and start the planner
docker compose --profile seed run --rm seed     # once: copy your plan from packages/plan-data/data into the volume
```

Open http://localhost:3000. Before the seed, the planner shows the plan baked into the image with no editing controls;
after it, your own plan, editable. The seed copies `plan.json`, `edits.json`, `history.json`, `sync.json` and `library/`,
never `local.json`, and does nothing if the volume already holds a plan.

The local container and `pnpm run dev` keep **separate** data: the container its volume, the dev server
`packages/plan-data/data`.

| Task | Command |
|---|---|
| Follow the server's output | `docker compose logs -f planner` |
| Stop / start | `docker compose stop` / `docker compose start` |
| Rebuild after a code change | `docker compose up -d --build` |
| Another host port | `PLANNER_PORT=8080 docker compose up -d` |
| View-only mode | `PLAN_READONLY=1` in `planner.env`, then `docker compose up -d` |
| Start over with an empty volume | `docker compose down -v` (deletes the volume and everything in it) |

## 2. Test the image

```bash
pnpm run docker:smoke            # about a minute once the image is cached
pnpm run docker:smoke --proxy    # also the HTTPS proxy on https://localhost; needs ports 80 and 443 free
```

It builds the image, runs it under a throwaway project (`lc-smoke`, ports 3102–3104) and removes every container,
volume and file it made, whatever the outcome. It never reads your `planner.env`. Each line is one check:

| Check | What it proves |
|---|---|
| empty volume: healthy, runs as `node`, plan answers, a write is refused (403) | the image starts safely with no data |
| seed copies, a second seed copies nothing, files belong to `node`, a write is stored (200) | the seed and writing work |
| the calendar callback is `https` behind `X-Forwarded-Proto: https` | Google and Outlook accept the sign-in behind an HTTPS front |
| a root-owned volume becomes writable | Fly.io, Railway and Render volumes work |
| started with `--user node`, healthy | Kubernetes-style non-root starts work |
| `--proxy`: no or a wrong password 401, the password 200, http → https 308, callback `https` on the domain | the VPS setup of section 4 |

To check by hand instead: `docker compose ps` shows `healthy`, `curl -s localhost:3000/api/plan` returns the plan, and an
edit in the browser survives `docker compose restart planner`.

## 3. Before any remote deploy

- **Protect it.** The planner has no sign-in of its own yet: anyone who reaches it can edit the plan and connect
  calendars. Use one of:
  - a password in front of it: the `proxy` service on a VPS (section 4), or the platform's own sign-in (Azure);
  - an access gateway such as [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/)
    in front of a custom domain, on any host;
  - `PLAN_READONLY=1`, for a public planner nobody can change.
- **Keep the image private.** It contains `plan.json` (your plan, as the fallback). Push it only to a private registry.
- **Build for the server's CPU.** An image built on an Apple Silicon Mac is `arm64`; most servers are `amd64`. Build on
  the server, let the host build from the repository, or cross-build (below).
- **Calendar apps.** Each OAuth client must list `https://<your-domain>/api/google/callback` or
  `https://<your-domain>/api/outlook/callback` exactly. Set the clients with `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
  and `OUTLOOK_CLIENT_ID` / `OUTLOOK_CLIENT_SECRET`, then connect each app again in the deployed planner. Once the
  server syncs, disconnect the calendar apps in your local copy: two copies syncing the same calendars duplicate events.
- **One home for the plan.** After the seed, the deployed planner and your local copy are separate. Edit the deployed one;
  the MCP server keeps editing the local one.

Cross-building and pushing to a registry (GitHub's, private by default for a new package):

```bash
echo "$GITHUB_TOKEN" | docker login ghcr.io -u <github-user> --password-stdin   # a token with write:packages
docker buildx build --platform linux/amd64 -f apps/web/Dockerfile \
  -t ghcr.io/<owner>/learning-curve-planner:1 --push .
```

## 4. Your own server (VPS)

Any Linux VM with 2 GB of memory or more (building the image needs it), for example Hetzner, DigitalOcean or a cloud VM.
The steps use `compose.yaml` as it is: the planner listens on the server only, and Caddy serves it on your domain with
HTTPS and a password. Tested locally on `https://localhost` (`pnpm run docker:smoke --proxy`).

1. **Domain and firewall.** Point an `A` record (and `AAAA` for IPv6) of your domain, e.g. `planner.example.com`, at the
   server. Allow inbound 22, 80 and 443 only.
2. **Docker.** On the server, install Docker Engine with the Compose plugin
   ([official script](https://docs.docker.com/engine/install/ubuntu/#install-using-the-convenience-script)):

   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker "$USER"     # then log out and in again
   ```

3. **The code.** `git clone <repository-url> learning-curve && cd learning-curve` (a private repository needs a deploy
   key or a token).
4. **Settings.** `cp planner.env.example planner.env && chmod 600 planner.env`, then set:
   - `PLANNER_DOMAIN=planner.example.com`
   - `PROXY_USER=<name>` and `PROXY_PASSWORD_HASH='<hash>'` (single quotes), the hash made with
     `docker run --rm caddy:2 caddy hash-password --plaintext '<password>'`
   - the OAuth clients, if you use calendar apps.
5. **Start the planner:** `docker compose up -d --build`.
6. **Your data.** From your own machine, copy the plan to a folder outside the server's checkout, then seed from it:

   ```bash
   # on your machine
   rsync -av packages/plan-data/data/{plan.json,edits.json,history.json,sync.json,library} <user>@<server>:plan-seed/
   # on the server, in learning-curve/
   PLAN_SEED_DIR=~/plan-seed docker compose --profile seed run --rm seed
   ```

7. **Start the proxy:** `docker compose --profile proxy up -d`. Caddy requests the certificate on first start. Open
   `https://planner.example.com` and sign in with the user and password from step 4.
8. **Calendar apps:** register the callbacks (section 3) and connect the apps in the planner.

Calendar apps that *subscribe* to the `.ics` feeds cannot type a password; the `Caddyfile` shows how to leave
`/api/ics/*` open, which makes the feeds readable by anyone who has their address.

## 5. Hosted services

Not run from this repository: the steps follow each provider's documentation as read on 2026-11-28; check the linked
page when a command fails. Each needs the [checks of section 3](#3-before-any-remote-deploy), and none but Azure puts a
sign-in in front of the planner, so on the others use an access gateway or `PLAN_READONLY=1`.

| Service | Builds from | Volume | Copy the plan in | Sign-in in front |
|---|---|---|---|---|
| Fly.io | the repository (`fly deploy`) | Fly volume | `fly ssh sftp put` | none built in |
| Railway | the repository (GitHub) | Railway volume | `scp` over `railway ssh` | none built in |
| Render | the repository (Blueprint) | persistent disk (paid plans) | `scp` over Render SSH | none built in |
| Azure Container Apps | `az acr build` | Azure Files share | `az storage file upload` | built in (Easy Auth) |
| Azure App Service | `az acr build` | `/home` | the Kudu console | built in (Easy Auth) |

Not suitable: Vercel, Netlify and Cloudflare Workers run no container and keep no disk; Google Cloud Run mounts storage
without file locking. See [deployment-research.md](deployment-research.md).

### Fly.io

Volume and region flags: [fly volumes create](https://docs.fly.io/flyctl/volumes-create); `fly.toml`:
[configuration reference](https://docs.fly.io/reference/configuration).

1. `fly auth login`, then `fly apps create <app>`.
2. Create `fly.toml` **at the repository root** (`fly deploy` keeps the root as the build context):

   ```toml
   app = "<app>"
   primary_region = "fra"

   [build]
     dockerfile = "apps/web/Dockerfile"

   [[mounts]]
     source = "plan_data"
     destination = "/data"

   [http_service]
     internal_port = 3000
     force_https = true
     auto_stop_machines = "off"     # one machine, always on: the volume belongs to it
     min_machines_running = 1

   [[http_service.checks]]
     grace_period = "15s"
     interval = "30s"
     method = "GET"
     timeout = "5s"
     path = "/api/plan"
   ```

3. `fly volumes create plan_data --region fra --size 1 --app <app> --yes`
4. Secrets: `fly secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... --app <app>` (and `PLAN_READONLY=1` for a
   public, view-only planner).
5. `fly deploy` (Fly builds the image for its own CPU).
6. Copy the plan in, then hand it to the planner's user (sftp writes as root):

   ```bash
   for f in plan.json edits.json history.json sync.json; do
     fly ssh sftp put "packages/plan-data/data/$f" "/data/$f" --app <app>
   done
   fly ssh sftp put -R packages/plan-data/data/library /data/library --app <app>
   fly ssh console --app <app> -C "chown -R node:node /data"
   ```

7. Your address is `https://<app>.fly.dev`, or a custom domain (`fly certs add`).

### Railway

Docs: [Dockerfiles](https://docs.railway.com/builds/dockerfiles), [volumes](https://docs.railway.com/reference/volumes),
[SSH and file copy](https://docs.railway.com/cli/ssh).

1. New project → *Deploy from GitHub repo* → this repository.
2. Service *Variables*: `RAILWAY_DOCKERFILE_PATH=apps/web/Dockerfile`, plus the OAuth clients (and `PLAN_READONLY=1` if
   view-only). Railway sets `PORT` itself; the planner listens on it.
3. Add a volume (command palette or right-click on the canvas), attach it to the service, mount path `/data`. Railway
   mounts volumes as root; the entrypoint hands it to the planner's user.
4. *Settings → Networking → Generate Domain*.
5. Copy the plan in (`scp -s` on OpenSSH older than 9.0), then restart the service so the entrypoint hands the files over:

   ```bash
   for f in plan.json edits.json history.json sync.json; do
     scp "packages/plan-data/data/$f" "<service-domain>@ssh.railway.com:/data/$f"
   done
   scp -r packages/plan-data/data/library "<service-domain>@ssh.railway.com:/data/"
   ```

### Render

Docs: [Blueprint spec](https://render.com/docs/blueprint-spec), [disks](https://render.com/docs/disks). A disk needs a
paid instance type, keeps the service at one instance and turns off zero-downtime deploys.

1. Add `render.yaml` at the repository root and create a Blueprint from it in the dashboard:

   ```yaml
   services:
     - type: web
       runtime: docker
       name: planner
       plan: <a paid instance type from Render's plan table>
       dockerfilePath: ./apps/web/Dockerfile
       dockerContext: .
       disk:
         name: plan-data
         mountPath: /data
         sizeGB: 1
       envVars:
         - key: GOOGLE_CLIENT_ID
           sync: false
         - key: GOOGLE_CLIENT_SECRET
           sync: false
   ```

2. Set the secret values in the dashboard (`sync: false` asks for them).
3. Copy the plan in over Render SSH (add your SSH key to the account first), then restart the service:
   `scp -s packages/plan-data/data/plan.json <service>@ssh.<region>.render.com:/data/` and the same for `edits.json`,
   `history.json`, `sync.json` and `library/` (`-r`).

### Azure Container Apps

Docs: [storage mounts](https://learn.microsoft.com/en-us/azure/container-apps/storage-mounts),
[`az containerapp`](https://learn.microsoft.com/en-us/cli/azure/containerapp),
[authentication](https://learn.microsoft.com/en-us/azure/container-apps/authentication). Azure builds the image, so the
CPU of your machine does not matter.

```bash
rg=learning-curve; loc=westeurope; acr=<registry-name>; st=<storage-account-name>

az group create -n $rg -l $loc
az acr create -g $rg -n $acr --sku Basic --admin-enabled true
az acr build -r $acr -t planner:1 -f apps/web/Dockerfile .          # from the repository root

az storage account create -g $rg -n $st --sku Standard_LRS
az storage share-rm create -g $rg --storage-account $st -n plan-data --quota 1
key=$(az storage account keys list -g $rg -n $st --query '[0].value' -o tsv)

az containerapp env create -g $rg -n planner-env -l $loc
az containerapp env storage set -g $rg -n planner-env --storage-name plan-data \
  --azure-file-account-name $st --azure-file-account-key "$key" \
  --azure-file-share-name plan-data --access-mode ReadWrite

az containerapp create -g $rg -n planner --environment planner-env \
  --image $acr.azurecr.io/planner:1 --registry-server $acr.azurecr.io \
  --registry-username $acr --registry-password "$(az acr credential show -n $acr --query 'passwords[0].value' -o tsv)" \
  --revisions-mode single --min-replicas 1 --max-replicas 1 \
  --ingress external --target-port 3000 \
  --secrets google-secret=<secret> --env-vars GOOGLE_CLIENT_ID=<id> GOOGLE_CLIENT_SECRET=secretref:google-secret
```

The CLI cannot mount a volume; add it to the app's YAML. `az containerapp show -g $rg -n planner -o yaml > planner.yaml`,
add the two blocks below under `properties.template`, then `az containerapp update -g $rg -n planner --yaml planner.yaml`:

```yaml
containers:
  - name: planner
    # ...as exported, plus:
    volumeMounts:
      - volumeName: plan-data
        mountPath: /data
volumes:
  - name: plan-data
    storageType: AzureFile
    storageName: plan-data
    # Azure Files cannot change owners; these mount it as the planner's user (uid 1000).
    mountOptions: uid=1000,gid=1000,dir_mode=0755,file_mode=0644
```

(`mountOptions` is documented for Container Apps; the `uid`/`gid` values come from Azure's Azure Files mount options
and were not tried here.)

Copy the plan into the share; the planner reads it on the next request:

```bash
for f in plan.json edits.json history.json sync.json; do
  az storage file upload --account-name $st --account-key "$key" --share-name plan-data \
    --source "packages/plan-data/data/$f" --path "$f"
done
az storage file upload-batch --account-name $st --account-key "$key" --destination plan-data \
  --source packages/plan-data/data/library --destination-path library
```

Sign-in in front (Easy Auth), with a Microsoft Entra app registration of your own:

```bash
az containerapp auth microsoft update -g $rg -n planner --client-id <id> --client-secret <secret> --tenant-id <tenant> --yes
az containerapp auth update -g $rg -n planner --unauthenticated-client-action RedirectToLoginPage
```

`az containerapp auth google update` does the same with Google. The address is the app's `https://<name>.<region>.azurecontainerapps.io`.

### Azure App Service

Simpler than Container Apps, dearer (B1 is about $13 a month). Docs:
[custom containers](https://learn.microsoft.com/en-us/azure/app-service/configure-custom-container?pivots=container-linux).
Build the image with `az acr build` as above, then:

```bash
az appservice plan create -g $rg -n planner-plan --is-linux --sku B1
az webapp create -g $rg -p planner-plan -n <app> --deployment-container-image-name $acr.azurecr.io/planner:1
az webapp config container set -g $rg -n <app> --container-image-name $acr.azurecr.io/planner:1 \
  --docker-registry-server-url https://$acr.azurecr.io --docker-registry-server-user $acr \
  --docker-registry-server-password "$(az acr credential show -n $acr --query 'passwords[0].value' -o tsv)"
az webapp config appsettings set -g $rg -n <app> --settings \
  WEBSITES_ENABLE_APP_SERVICE_STORAGE=true WEBSITES_PORT=3000 PLAN_DATA_DIR=/home/data \
  GOOGLE_CLIENT_ID=<id> GOOGLE_CLIENT_SECRET=<secret>
```

`/home` is the persistent storage, so the data lives in `/home/data`. Copy the plan into it with the Kudu console
(`https://<app>.scm.azurewebsites.net`, *Debug console*), then restart the app. Sign-in in front: *Authentication* in
the portal, or `az webapp auth`.

## 6. Updates, backups and restore

| Task | VPS / local (`compose.yaml`) | Hosted |
|---|---|---|
| Update | `git pull && docker compose --profile proxy up -d --build` | redeploy (`fly deploy`, a push for Railway/Render, a new `az acr build` tag) |
| Back up | see below | the provider's volume snapshots (Fly, Render), share snapshots (Azure) |
| Settings change | edit `planner.env`, then `docker compose up -d` | the service's variables or secrets |

The volume holds the plan, the history and the calendar tokens; back it up and keep the copies private.

```bash
# back up the volume into ./plan-data-<date>.tgz
docker run --rm -v learning-curve_plan-data:/data:ro -v "$PWD":/backup alpine \
  tar czf "/backup/plan-data-$(date +%F).tgz" -C /data .

# restore it (replaces everything in the volume)
docker compose stop planner
docker run --rm -v learning-curve_plan-data:/data -v "$PWD":/backup alpine \
  sh -c 'rm -rf /data/* && tar xzf /backup/plan-data-<date>.tgz -C /data'
docker compose start planner          # the entrypoint hands the files back to the planner's user
```

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| The plan shows but cannot be edited; writes answer 403 | the volume holds no `plan.json`, or `PLAN_READONLY=1` | run the seed (or copy the files in); check `planner.env` |
| Log line `planner: could not hand /data to uid 1000` | the volume cannot change owners (SMB, Azure Files) | mount it as uid 1000 (`mountOptions` above) |
| Google: `redirect_uri_mismatch`; Outlook: redirect URI error | the registered callback differs from `https://<domain>/api/<app>/callback` | register exactly that address; the front must send `X-Forwarded-Proto` (all listed hosts and Caddy do) |
| `exec format error` | the image was built for another CPU | build on the server, or `--platform linux/amd64` |
| `unhealthy` | the server failed to start | `docker compose logs planner` |
| Caddy cannot get a certificate | DNS does not point at the server yet, or 80/443 are closed | fix DNS and the firewall, then `docker compose --profile proxy restart proxy` |
| Duplicate events in a calendar app | two copies of the plan sync the same calendars | disconnect the app in one of them |
| Port 3000 already in use | the dev server or another container | `PLANNER_PORT=3005 docker compose up -d` |
