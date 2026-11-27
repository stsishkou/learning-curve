// Serves the plan over stdio. stdout carries the protocol, so nothing else may print there:
//   pnpm --silent run mcp
import { findDataDir } from '@lc/plan-data/fs'
import { localPorts } from '@lc/plan-data/local'
import { LOCAL_ACTOR, createPlanServices } from '@lc/plan-service'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { createMcpServer } from './server'

const services = createPlanServices(localPorts({ dir: findDataDir(process.cwd(), process.env), env: process.env }))

await createMcpServer(services, LOCAL_ACTOR).connect(new StdioServerTransport())
