import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

type Layer = 'app' | 'module' | 'infra' | 'service' | 'content' | 'domain' | 'contract' | 'shared'

interface Project {
  name: string
  dir: string
  tags: string[]
  deps: string[]
}

// What each layer may depend on: the layer rule of docs/architecture.md.
const ALLOWED: Record<Layer, readonly Layer[]> = {
  app: ['module', 'infra', 'service', 'content', 'domain', 'contract', 'shared'],
  module: ['domain', 'contract', 'shared'],
  infra: ['service', 'domain', 'content', 'contract'],
  service: ['domain'],
  content: ['domain'],
  domain: [],
  contract: [],
  shared: ['contract'],
}

const LAYERS = Object.keys(ALLOWED)
const isLayer = (value: string): value is Layer => LAYERS.includes(value)

const root = join(import.meta.dirname, '..')
const DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

const readProject = (dir: string): Project | null => {
  let text: string
  try {
    text = readFileSync(join(root, dir, 'package.json'), 'utf8')
  } catch {
    return null
  }
  const json: unknown = JSON.parse(text)
  if (!isRecord(json) || typeof json['name'] !== 'string') return null
  const nx = json['nx']
  const deps = DEP_FIELDS.flatMap((field) => {
    const entries = json[field]
    if (!isRecord(entries)) return []
    return Object.entries(entries)
      .filter(([, range]) => typeof range === 'string' && range.startsWith('workspace:'))
      .map(([name]) => name)
  })
  return { name: json['name'], dir, tags: isRecord(nx) ? strings(nx['tags']) : [], deps }
}

const projects = ['apps', 'modules', 'packages'].flatMap((group) =>
  readdirSync(join(root, group), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => readProject(`${group}/${entry.name}`) ?? []),
)

const layerOf = new Map<string, Layer>()
const errors: string[] = []

for (const project of projects) {
  const types = project.tags.filter((tag) => tag.startsWith('type:')).map((tag) => tag.slice('type:'.length))
  const [type, ...rest] = types
  if (type === undefined || rest.length > 0 || !isLayer(type)) {
    const found = types.length === 0 ? 'none' : types.join(', ')
    errors.push(`${project.name} (${project.dir}): needs exactly one type: tag of ${LAYERS.join(', ')}, found ${found}`)
    continue
  }
  layerOf.set(project.name, type)
}

let edges = 0
for (const project of projects) {
  const from = layerOf.get(project.name)
  if (from === undefined) continue
  for (const dep of project.deps) {
    const to = layerOf.get(dep)
    if (to === undefined) {
      if (!projects.some((other) => other.name === dep)) {
        errors.push(`${project.name} → ${dep} (unknown workspace project)`)
      }
      continue
    }
    edges += 1
    if (!ALLOWED[from].includes(to)) errors.push(`${project.name} → ${dep} (${from} → ${to})`)
  }
}

if (errors.length > 0) {
  process.stderr.write(`Dependency graph violates the layer rule:\n${errors.map((line) => `  ${line}`).join('\n')}\n`)
  process.exit(1)
}
process.stdout.write(`Dependency graph ok: ${projects.length} projects, ${edges} workspace dependencies.\n`)
