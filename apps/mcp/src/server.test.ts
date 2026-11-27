import { LOCAL_ACTOR, createPlanServices } from '@lc/plan-service'
import { createMemoryPorts, type MemoryPortsOptions } from '@lc/plan-service/testing'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { expect, test } from 'vitest'

import { createMcpServer } from './server'

async function connected(options: MemoryPortsOptions = {}): Promise<Client> {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await createMcpServer(createPlanServices(createMemoryPorts(options)), LOCAL_ACTOR).connect(serverSide)
  const client = new Client({ name: 'test', version: '1' })
  await client.connect(clientSide)
  return client
}

test('the same tools as before', async () => {
  const client = await connected()
  const { tools } = await client.listTools()
  expect(tools.map((t) => t.name)).toEqual([
    'get_guide',
    'get_plan',
    'get_accuracy',
    'preview_update',
    'apply_update',
    'rebalance_calendar',
  ])
})

test('apply_update on a read-only host is refused with the reason', async () => {
  const client = await connected({ writable: false })
  const answer = await client.callTool({
    name: 'apply_update',
    arguments: { changes: [{ type: 'plan.rename', title: 'X' }] },
  })
  expect(answer.isError).toBe(true)
  expect(JSON.stringify(answer.content)).toContain('The plan is read-only here')
})
