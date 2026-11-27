import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadRemote, RemoteLoadError, type RemoteLoadFailure } from './load-remote'

interface InstanceConfig {
  name: string
  remotes: { name: string; entry: string }[]
  shared: Record<string, unknown>
}

const federation = vi.hoisted(() => ({
  loadRemote: vi.fn<(module: string) => Promise<unknown>>(),
  createInstance: vi.fn<(config: InstanceConfig) => unknown>(),
}))
vi.mock('@module-federation/runtime', () => ({
  createInstance: federation.createInstance.mockImplementation(() => ({ loadRemote: federation.loadRemote })),
}))

interface Widget {
  version: string
}
const isWidget = (value: unknown): value is Widget =>
  typeof value === 'object' && value !== null && 'version' in value && typeof value.version === 'string'

const options = {
  manifestUrl: 'http://remote.test/mf-manifest.json',
  remoteName: 'lc_widget',
  module: 'lc_widget/main',
  hostName: 'lc_test_host',
  isModule: isWidget,
  isCompatible: (module: Widget) => module.version.startsWith('1.'),
}

async function failureOf(work: Promise<unknown>): Promise<RemoteLoadFailure | null> {
  try {
    await work
  } catch (err) {
    return err instanceof RemoteLoadError ? err.reason : null
  }
  return null
}

describe('loadRemote', () => {
  beforeEach(() => {
    vi.stubGlobal('location', { href: 'http://host.test/' })
    federation.loadRemote.mockReset()
    federation.createInstance.mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('returns a module that has the shape and a compatible version', async () => {
    federation.loadRemote.mockResolvedValue({ version: '1.2.0' })
    await expect(loadRemote(options)).resolves.toEqual({ version: '1.2.0' })
    expect(federation.loadRemote).toHaveBeenCalledWith('lc_widget/main')
  })

  it('names the host, shares the host React and asks for a manifest no cache can have kept', async () => {
    federation.loadRemote.mockResolvedValue({ version: '1.0.0' })
    await loadRemote(options)
    const config = federation.createInstance.mock.calls.at(0)?.at(0)
    expect(config?.name).toBe('lc_test_host')
    expect(config?.remotes.map((remote) => remote.name)).toEqual(['lc_widget'])
    expect(config?.remotes.at(0)?.entry).toMatch(/^http:\/\/remote\.test\/mf-manifest\.json\?v=\w+$/)
    expect(Object.keys(config?.shared ?? {})).toEqual(['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'])
  })

  it('fails as unavailable, keeping the cause, when the remote cannot be fetched', async () => {
    const cause = new Error('network')
    federation.loadRemote.mockRejectedValue(cause)
    const error = await loadRemote(options).catch((err: unknown) => err)
    expect(error).toBeInstanceOf(RemoteLoadError)
    expect(error).toMatchObject({ reason: 'unavailable', cause })
  })

  it('fails as shape when the module is not what the host expects', async () => {
    federation.loadRemote.mockResolvedValue({ createWidget: true })
    expect(await failureOf(loadRemote(options))).toBe('shape')
  })

  it('fails as version when the contract is not one the host can use', async () => {
    federation.loadRemote.mockResolvedValue({ version: '2.0.0' })
    expect(await failureOf(loadRemote(options))).toBe('version')
  })

  it('fails as timeout when the remote does not answer in time', async () => {
    vi.useFakeTimers()
    federation.loadRemote.mockReturnValue(new Promise(() => undefined))
    const failure = failureOf(loadRemote({ ...options, timeoutMs: 50 }))
    await vi.advanceTimersByTimeAsync(50)
    expect(await failure).toBe('timeout')
  })

  it('waits 8000 ms when no timeout is given', async () => {
    vi.useFakeTimers()
    federation.loadRemote.mockReturnValue(new Promise(() => undefined))
    const failure = failureOf(loadRemote(options))
    await vi.advanceTimersByTimeAsync(7999)
    expect(federation.loadRemote).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1)
    expect(await failure).toBe('timeout')
  })
})
