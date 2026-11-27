import { describe, expect, test } from 'vitest'

import { Superseded, newestOnly } from './queue'

const tick = async () => new Promise((resolve) => setTimeout(resolve, 0))

/** A promise that settles when `open` is called, to hold a job while the test queues others */
function gate(): { wait: Promise<void>; open: () => void } {
  const held: { release?: () => void } = {}
  const wait = new Promise<void>((resolve) => {
    held.release = resolve
  })
  return { wait, open: () => held.release?.() }
}

describe('newestOnly', () => {
  test('runs one job at a time, and a job still waiting when a newer one comes never runs', async () => {
    const run = newestOnly()
    const started: string[] = []
    const { wait, open } = gate()
    const job =
      (name: string, hold: Promise<void> = Promise.resolve()) =>
      async () => {
        started.push(name)
        await hold
        return name
      }

    const first = run(job('first', wait))
    await tick()
    const second = run(job('second'))
    const third = run(job('third'))
    await tick()
    expect(started).toEqual(['first'])

    open()
    await expect(first).resolves.toBe('first')
    await expect(second).rejects.toBeInstanceOf(Superseded)
    await expect(third).resolves.toBe('third')
    expect(started).toEqual(['first', 'third'])
  })

  test('a job that fails leaves the next one to run', async () => {
    const run = newestOnly()
    const { wait, open } = gate()
    const failing = run(async () => {
      await wait
      throw new Error('no solver')
    })
    await tick()
    const next = run(async () => Promise.resolve('next'))
    open()
    await expect(failing).rejects.toThrow('no solver')
    await expect(next).resolves.toBe('next')
  })
})
