# @lc/mcp

The Model Context Protocol server for the plan, over stdio: an assistant reads the plan and its guide, previews an
update and applies it. It is an adapter and holds no rules: each tool calls one method of `@lc/plan-service` as the
local owner, and the documents and their rules come from `@lc/plan-domain`.

- `src/main.ts`: the composition root. Builds the services over the files of the data directory (`findDataDir`,
  `localPorts`) and serves `createMcpServer` on stdio.
- `src/server.ts`: `createMcpServer(services, actor)`, the handlers of the tools, resources and the prompt.
- `src/tools.ts`: their definitions.
- `src/rebalance-args.ts`: the arguments of `rebalance_calendar` as a re-balance request.

Run it from the repository root with `pnpm --silent run mcp` (stdout carries the protocol, so nothing else may print
there); `.mcp.json` does. `PLAN_DATA_DIR` points it at another data directory and `PLAN_READONLY=1` switches writing
off. Tested with Vitest over an in-memory transport: `pnpm exec nx run @lc/mcp:test`.
