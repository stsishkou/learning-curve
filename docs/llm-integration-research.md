# LLM integration research: easier for the person, clearer for the model

Fetched 2026-11-23 (Europe/Minsk). Only first-party pages were used: the MCP specification, the vendors' own
documentation and help centres, the proposals' own sites, and the source of this repository and of its
installed packages. Every claim is followed by the page it was read from, with the version or date that page
carries where it shows one.

Legend: **(d)** = documented on the linked first-party page; **(f)** = de facto: reported to work, but no
first-party page describing it was found; **(k)** = my general knowledge, not re-verified here;
**unverified** = looked for and not settled. Treat every (f), (k) and unverified as a lead to test, not a
fact. Section 11 lists them all.

How the pages were read: some through a summarising fetch tool (its answer, not the raw page, is what I saw),
others downloaded as Markdown and searched for the sentences quoted. Quotes in quotation marks were seen
verbatim in the page text. The MCP specification pages, the Anthropic structured-outputs and prompting pages,
the Claude Code MCP and deep-link pages, the OpenAI function-calling page and the Gemini prompting and
function-calling pages were read raw.

## 1. Short answer

- **The protocol is the right shape; the adapters are what is thin.** One update document, one parser, one
  guide is exactly what every route below needs. Nothing here asks for a second protocol.
- **A link cannot carry the brief.** The brief is 42,735 characters (74,368 URL-encoded); the documented
  prefill limits are 5,000 (Claude Code), about 14,000 (Claude Desktop) and 10,000 encoded (Cursor). The
  web chat apps (claude.ai, ChatGPT, Gemini) document no prefill parameter at all. The reliable one-click
  flow is: copy the brief to the clipboard **and** open the chat app in the same click.
- **The largest usability gain is a remote MCP endpoint in the web server** (`POST /mcp`, Streamable HTTP).
  It turns "copy, paste, copy, paste" into "ask", for Claude Code, Cursor and VS Code today on `localhost`,
  and for claude.ai and ChatGPT once the app has a public HTTPS address and an OAuth login. Without a login
  it must stay bound to localhost with `Origin` validation.
- **The MCP server is already above average** (titles, annotations, resources, a prompt, `instructions`).
  Four cheap gaps: no `outputSchema`/`structuredContent`, no `openWorldHint: false`, `get_plan` without
  filters returns about 44,000 characters (just under Claude Code's 50,000-character spill threshold), and
  the SDK in use implements the previous protocol revision.
- **`UPDATE_SCHEMA` cannot be used as-is for strict structured output at any of the three providers.**
  `oneOf`, `minLength`/`maxLength`, `minimum`/`maximum`, `maxItems`, `minProperties` and 25 optional
  properties are the blockers (section 5.4). It is fine as a non-strict tool schema and as an MCP
  `inputSchema`. The fix is a derived "strict" variant, generated and tested, not a second hand-written
  schema.
- **The guide follows most of the vendors' advice already** (a role, reasons, examples, the request last).
  The concrete gaps: the answer format is stated 30 KB above the place where the model starts answering,
  examples are not delimited and carry hard-coded dates, the plan is not wrapped in a tag, and there is no
  ready-made text for the retry after a rejected update (section 6).
- **Calling a model from the server with the person's key is a medium-sized feature** and safe only while
  the key stays in the server's environment and the endpoint is not reachable by strangers. It removes the
  clipboard entirely.

## 2. What the app has today, and what the research found in it

| Piece                                                   | State                                                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `packages/plan-domain/src/schema.ts`                    | `PLAN_SCHEMA`, `UPDATE_SCHEMA` (draft 2020-12), a description on every field                       |
| `packages/plan-domain/src/guide.ts`                     | `planGuide` (10,023 characters now), `planBrief` = guide + compact plan + request (42,735)         |
| `packages/plan-domain/src/update.ts`                    | `parseUpdate` (lenient: document, bare list, one change, or text with a code block), `previewUpdate` |
| `packages/plan-data/scripts/mcp.ts`                     | stdio server, low-level `Server` API of `@modelcontextprotocol/sdk` 1.32.2; 4 tools, 4 resources, 1 prompt |
| `/api/plan-guide`, `/api/plan-schema`, `/api/plan-update` | Markdown guide or brief; both schemas; update with `?dry=1`, 422 names the change at fault         |
| `ReaderAssistant.tsx` (`AI chat` tab)                   | Copy brief, copy guide, download schema; paste answer; live preview; apply                         |

Sizes were measured on the running app on the day of the research (148 events).

Findings against the sources:

1. **The SDK speaks the previous protocol revision.** The installed `@modelcontextprotocol/sdk` 1.32.2 (the
   newest 1.x on npm, published 2026-10-23) has `LATEST_PROTOCOL_VERSION = '2025-11-25'`
   (`dist/esm/types.js`). The current revision is **2026-07-28** ([MCP versioning][mcp-versioning]). The SDK's
   README says v2, split into `@modelcontextprotocol/server` and `@modelcontextprotocol/client` (2.4.0 on
   npm), is "the stable release line" "implementing the 2026-07-28 MCP spec", and v1 gets fixes "for at
   least six months after the v2 release" ([typescript-sdk][mcp-ts-sdk], read through a summary). Nothing is
   broken: the specification defines the fallback for handshake-era servers (section 4.1).
2. **No `outputSchema` / `structuredContent`.** `preview_update` and `apply_update` return
   `reportPreview(...)` as JSON inside a text block. The shape is fixed and already typed, so it can be
   declared (section 4.4).
3. **`openWorldHint` is left at its default, `true`.** The server touches only local files; the hint for
   that is `false` (section 4.4).
4. **`get_plan` without arguments returns about 44,000 characters** (pretty-printed, descriptions emptied).
   Claude Code "saves a successful result with no image content to a file once it's longer than 50,000
   characters" and warns above 10,000 tokens ([Claude Code MCP][cc-mcp]). The plan grows with every course.
5. **The `instructions` string (277 characters) is within every documented limit**: Claude Code cuts server
   instructions at 4,096 characters ([Claude Code MCP][cc-mcp]); OpenAI advises to "Keep the first 512
   characters self-contained" ([ChatGPT custom MCP][oai-devmode]).
6. **The examples in the guide carry fixed dates** (`2026-11-26`, `2026-11-25`, `2027-03-15`) while the line
   "Now it is …" is computed. The first two will be in the past within days of this research.
7. **The guide says "The JSON Schema of the update describes every field; follow it when you have it", and
   the brief does not carry the schema.** A model given only the brief learns the fields of, say,
   `event.detach` from one table row.
8. **`ai_tools` in the UI names `pnpm run mcp` but gives no command to register it** in any client other
   than this repository's `.mcp.json`.
9. **`/api/plan-update` has no authentication.** The calendar research already recorded that the app has no
   login; a write endpoint and any future model endpoint inherit that (sections 4.3 and 9).

## 3. Opening a chat app with the prompt already in it

### 3.1 What is documented

| Target                    | Link                                                        | Status | Limit and behaviour                                                                                 |
| ------------------------- | ----------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| Claude Desktop            | `claude://claude.ai/new?q=…`                                | (d)    | `q` prefills the composer; "truncated to roughly 14,000 characters"; values URL-encoded; not sent     |
| Claude Desktop, Code tab  | `claude://code/new?q=…&folder=…`                            | (d)    | `prompt` is an alias of `q`; a folder from a link always asks for confirmation                       |
| Claude Code (terminal)    | `claude-cli://open?q=…&cwd=…` or `&repo=owner/name`         | (d)    | `q`: "Maximum 5,000 characters"; "populated but not sent until you press Enter"                      |
| Claude Code in VS Code    | `vscode://anthropic.claude-code/open`                       | (d)    | Opens an editor tab; parameters are on the VS Code page, not read here                               |
| Cursor                    | `cursor://anysphere.cursor-deeplink/prompt?text=…`, `https://cursor.com/link/prompt?text=…` | (d) | 10,000 characters after URL-encoding; the user confirms before anything runs       |
| claude.ai (web)           | `https://claude.ai/new?q=…`                                 | (f)    | No Anthropic page documents it. Reported as changed in behaviour in October 2025                     |
| ChatGPT (web)             | `https://chatgpt.com/?q=…`                                  | (f)    | No OpenAI page found. Community threads only                                                         |
| Gemini (web)              | none found                                                  | (f)    | Only third-party browser extensions advertise it; they exist because the app does not do it itself   |

Sources: [Claude Desktop links][claude-desktop-link] (article dated 2026-06-30, read through a summary),
[Claude Code deep links][cc-deeplinks] (read raw), [Cursor deeplinks][cursor-deeplinks] (read through a
summary).

- **The documented links never send the prompt.** Claude Code: "A deep link never executes anything on its
  own. The link only chooses a directory and fills the prompt box" and shows the line "Prompt from an
  external link" ([Claude Code deep links][cc-deeplinks]). Cursor requires a review before running
  ([Cursor deeplinks][cursor-deeplinks]). Plan for a prefill, never for an automatic submit.
- **Custom schemes are stripped by some renderers.** "GitHub-rendered Markdown does not allow `claude-cli://`"
  ([Claude Code deep links][cc-deeplinks]). Inside this app's own UI that is not a problem; in the README it
  is.
- **`claude-cli://` needs a registered handler**, which Claude Code installs after the first prompt sent in
  an interactive session on that machine ([Claude Code deep links][cc-deeplinks]).
- **claude.ai on the web: undocumented.** The only first-party trace found is a GitHub issue in the Claude
  Code repository, "Submission of prompt via URL parameter stopped working", opened 2025-10-03 and closed as
  not planned because "This repo is specifically for Claude Code" ([issue 8827][cc-issue-8827], read through
  a summary). That is evidence the parameter existed and that its behaviour changed without notice, which is
  the definition of unreliable.
- **ChatGPT on the web: undocumented.** A search of OpenAI's own domains returned community threads
  ([example][oai-community-q]) and no help-centre or developer page. Whether `q` prefills or submits, and
  whether `hints=search` or `model=` are honoured, is (f).
- **Gemini on the web: undocumented.** Google's developer forum has the question and no documented answer
  ([thread][g-forum-prefill]).
- Not investigated: Perplexity, Microsoft Copilot, Mistral Le Chat, GitHub Copilot Chat.

### 3.2 What it means here

| Text                    | Characters | URL-encoded | Fits                                                    |
| ----------------------- | ---------- | ----------- | ------------------------------------------------------- |
| Brief (guide + plan)    | 42,735     | 74,368      | Nothing                                                  |
| Guide alone             | 10,023     | 16,752      | Claude Desktop only, and close to its "roughly 14,000"   |
| A request of two lines  | ~200       | ~400        | Everything                                               |

**Verdict:** the brief goes through the clipboard, as now. What a link can add:

1. **"Copy and open"**: one button that writes the brief to the clipboard and opens the chosen chat app in a
   new tab (`https://claude.ai/new`, `https://chatgpt.com/`, `https://gemini.google.com/app`: plain
   addresses, no parameters, so nothing undocumented is relied on). The person pastes once. A provider
   choice remembered in `localStorage` makes it one click the next time.
2. **A documented deep link for the tools that have the plan already.** For a client with the MCP server
   registered the prompt does not need the brief at all: `claude-cli://open?cwd=<repo>&q=<request>` or the
   Cursor prompt link, with a request such as "Use the learning-curve tools: read the guide, then …". This
   fits in every limit and uses only (d) parameters.
3. Offer `?q=` web links only as a labelled experiment, if at all. Section 11 has the test.

## 4. MCP

### 4.1 The specification today

The current revision is **2026-07-28** ([versioning][mcp-versioning]). Against 2025-11-25, which the app's
SDK implements, the [changelog][mcp-changelog] lists, among others:

- "Make MCP stateless: remove the `initialize`/`notifications/initialized` handshake. Every request now
  carries its protocol version and client capabilities in `_meta`".
- "Add `server/discover`: servers MUST implement this RPC to advertise their supported protocol versions,
  capabilities, and identity." Its result carries `instructions`: "Optional natural-language guidance for
  LLMs on how to use this server effectively" ([discover][mcp-discover]).
- "Remove protocol-level sessions and the `Mcp-Session-Id` header from the Streamable HTTP transport."
- Server-initiated requests are gone: a server that needs input returns `resultType: "input_required"` and
  the client retries with `inputResponses` (multi round-trip requests).
- "Loosen `inputSchema` and `outputSchema` to allow any JSON Schema 2020-12 keywords, and
  `structuredContent` to allow any JSON value."
- Deprecated: Roots, Sampling, Logging, Dynamic Client Registration, and the old HTTP+SSE transport
  ([deprecated features][mcp-deprecated]). Sampling's migration path is "Integrate directly with LLM provider
  APIs", which is section 9 of this document.

**Transports.** Two are standard ([transports][mcp-transports]):

| Transport       | What it is                                                                                           | Fits                                              |
| --------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| stdio           | "newline-delimited messages over the standard streams of a client-launched subprocess"                | A client on the same machine that can run `pnpm`  |
| Streamable HTTP | "each message is an HTTP POST to a single MCP endpoint; replies arrive as a JSON object or a request-scoped SSE stream" | Any client that can reach a URL  |

**Compatibility across revisions.** A modern client probes a stdio server with `server/discover` and falls
back to `initialize`; over HTTP it tries a modern request and falls back when the 400 body "is not a
recognized modern JSON-RPC error" ([Streamable HTTP][mcp-http], [discover][mcp-discover]). So a 2025-11-25
server keeps working with current clients. How long each client keeps the fallback is not stated anywhere I
read.

### 4.2 How each client registers a server

| Client                 | Local (stdio)                                                                                  | Remote (HTTP)                                                                                       | Source |
| ---------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------ |
| Claude Code            | `claude mcp add --transport stdio <name> -- <command>`; scopes `local` (default), `project` (`.mcp.json`, shared, asks for approval), `user` | `claude mcp add --transport http <name> <url> [--header …]`; OAuth through `/mcp` or `claude mcp login <name>`; `--transport sse` is "deprecated" | [Claude Code MCP][cc-mcp] (d) |
| Claude Desktop         | `claude_desktop_config.json` (`mcpServers`), opened from Settings → Developer; or a `.mcpb` bundle dropped into Settings → Extensions | Customize → Connectors → Add custom connector (same as claude.ai)                                   | [MCP local servers][mcp-local] (d), [connectors][claude-connectors] (summary) |
| claude.ai (web, mobile) | not possible                                                                                   | Custom connector: a URL, sign-in choice ("Sign in now", "Sign in when needed", "No sign in"), optional request headers. "Claude connects from Anthropic's cloud infrastructure, not your device"; port 443 only | [Custom connectors][claude-custom-connectors] (d, summary) |
| Cursor                 | `.cursor/mcp.json` (project) or `~/.cursor/mcp.json`: `{"mcpServers":{"x":{"command":…,"args":[…]}}}` | Same file: `{"url":…, "headers":{…}}`; OAuth with PKCE; `${env:NAME}` interpolation                 | [Cursor MCP][cursor-mcp] (d, summary) |
| VS Code                | `.vscode/mcp.json` with top-level key **`servers`** (not `mcpServers`), `"type":"stdio"`; `code --add-mcp '{…}'` | Same file, `"type":"http"`, `url`, `headers`; "tries Streamable HTTP first and falls back to SSE"; `${input:id}` for secrets | [VS Code MCP reference][vscode-mcp] (d, summary) |
| ChatGPT (web)          | not possible directly; a "Secure MCP Tunnel" client can forward to a private server            | `chatgpt.com/plugins` → + → "Add custom MCP server": Server URL, authentication "OAuth", "No authentication" or both; "Supported MCP protocols: SSE and streaming HTTP" | [ChatGPT custom MCP][oai-devmode], [tunnel][oai-tunnel] (d) |

Notes that matter for this app:

- **This repository's `.mcp.json` already is the Claude Code project scope.** The same file is also read by
  VS Code's newer "Copilot harness" as a portable configuration with the `mcpServers` key
  ([VS Code MCP reference][vscode-mcp], summary). Whether one file serves both without edits was not tested.
- **Claude Code can import from Claude Desktop**: `claude mcp add-from-claude-desktop` appears in
  [Claude Code MCP][cc-mcp]; and it converts a Desktop `mcpServers` entry through `claude mcp add-json`.
- **Desktop extension listings are being wound down**: the connectors page says directory listings for local
  servers packaged as MCPB are deprecated ([connectors][claude-connectors], from a search summary, not
  re-read). A `.mcpb` for a personal app is still installable by hand, but it is not where the effort
  should go.
- **MCP features the clients surface.** Claude Code lists each prompt "as `/servername:promptname (MCP)`",
  references resources as `@server:protocol://resource/path`, shows elicitation dialogs, and declares
  `elicitation: {form: {}, url: {}}` ([Claude Code MCP][cc-mcp]). Cursor lists "Tools, Prompts, Resources,
  Roots, and Elicitation" ([Cursor MCP][cursor-mcp], summary). The claude.ai connector article mentions
  tools only; ChatGPT's page describes tools and server instructions. Anthropic's API-side MCP connector
  states it outright: "only tool calls are currently supported" ([MCP connector][anthropic-mcp-connector]).
  **Tools are the only feature that works everywhere**, which is why `get_guide` as a tool (not only a
  resource) is the right design and should stay.

### 4.3 A remote endpoint inside the web server

What the specification requires of a Streamable HTTP server ([Streamable HTTP][mcp-http], 2026-07-28):

- "The server MUST provide a single HTTP endpoint path … that supports POST." GET and DELETE answer
  405 in this revision.
- A request is answered with `application/json` or with an SSE stream scoped to that request. Plain JSON is
  enough here: no tool runs long.
- "Servers MUST validate the `Origin` header on all incoming connections to prevent DNS rebinding attacks.
  If the `Origin` header is present and invalid, servers MUST respond with HTTP 403 Forbidden."
- "When running locally, servers SHOULD bind only to localhost (127.0.0.1) rather than all network
  interfaces (0.0.0.0)."
- "Servers SHOULD implement proper authentication for all connections."
- Every POST carries `MCP-Protocol-Version`, and in this revision `Mcp-Method` and `Mcp-Name`, which the
  server must check against the body. An SDK does that.

What the specification says about authorization ([authorization][mcp-auth], 2026-07-28):

- "Authorization is OPTIONAL for MCP implementations." For stdio it says the opposite of OAuth:
  "SHOULD NOT follow this specification, and instead retrieve credentials from the environment."
- When an HTTP server is protected, it is an OAuth 2.1 resource server: it "MUST implement OAuth 2.0
  Protected Resource Metadata (RFC9728)", answers 401 with
  `WWW-Authenticate: Bearer resource_metadata="https://…/.well-known/oauth-protected-resource"`, "MUST
  validate that access tokens were issued specifically for them as the intended audience", and tokens
  "MUST NOT be included in the URI query string".
- The authorization server may be someone else's: its "implementation details … are beyond the scope of
  this specification. It may be hosted with the resource server or a separate entity." Clients register
  through Client ID Metadata Documents (preferred), pre-registration, or the now deprecated dynamic
  registration.

What the clients accept short of full OAuth:

- A fixed header: Claude Code `--header "Authorization: Bearer TOKEN"` with `${VAR}` expansion in
  `.mcp.json` ([Claude Code MCP][cc-mcp]); Cursor and VS Code `headers` ([Cursor MCP][cursor-mcp],
  [VS Code MCP reference][vscode-mcp]); claude.ai "Request headers for fixed credentials, such as API keys
  or bearer tokens, if the server doesn't use OAuth" ([Custom connectors][claude-custom-connectors]).
- No authentication at all: claude.ai "No sign in"; ChatGPT "No authentication".

**The design that follows:**

| Stage                       | Endpoint                                   | Protection                                                                                  | Who can use it                              |
| --------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 1. Local                    | `POST http://localhost:3000/mcp`           | Bound to localhost; `Origin` and `Host` allow-list; no token                                 | Claude Code, Cursor, VS Code on the machine |
| 2. Public, single user      | `POST https://<host>/mcp`                  | A long random bearer token from the server's environment, sent as a header; HTTPS; 401 otherwise | The above, plus claude.ai through "request headers" |
| 3. Public, real login       | same                                       | OAuth 2.1 resource server with RFC 9728 metadata, delegated to an identity provider          | Everything, including ChatGPT with OAuth    |

- Stage 1 is a thin adapter: the installed SDK ships `WebStandardStreamableHTTPServerTransport`, "using Web
  Standard APIs (Request, Response, ReadableStream)", with `sessionIdGenerator: undefined` for stateless
  use, `enableJsonResponse`, and `allowedHosts` / `allowedOrigins` / `enableDnsRebindingProtection`
  (`dist/esm/server/webStandardStreamableHttp.d.ts` in `@modelcontextprotocol/sdk` 1.32.2). A TanStack
  Start server route receives a `Request` and returns a `Response`, so the tool table of `mcp.ts` can serve
  both transports. Wiring it was not tried.
- **claude.ai and ChatGPT cannot reach `localhost`**: both connect from the vendor's cloud. ChatGPT documents
  a tunnel for that case ([tunnel][oai-tunnel]); Anthropic's article documents none.
- A static token in a header is a pragmatic stage 2, not what the specification describes. The
  specification's own answer is stage 3. Do not put the token in the URL.
- A read-only host (`canWrite()` false) should not list `apply_update` at all rather than refuse it:
  the tool list "MAY vary by the authorization presented on the request" ([tools][mcp-tools]).

### 4.4 Features that make a server clearer to a model

| Feature               | What the specification says                                                                                                   | The app today                                    | Change                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------- |
| `readOnlyHint`        | "If true, the tool does not modify its environment. Default: false"                                                           | Set on the three readers                         | Keep. Claude Code also "runs the tool's calls in parallel with other read-only calls" |
| `destructiveHint`     | "If false, the tool performs only additive updates … Default: true"                                                           | `false` on `apply_update`                        | Debatable: an update can remove events. They go to a trash and every step can be undone, so `false` is defensible; say so in the description (it does) |
| `idempotentHint`      | "calling the tool repeatedly with the same arguments will have no additional effect … Default: false"                        | `false` on `apply_update`                        | Correct: `events.add` twice adds twice                                  |
| `openWorldHint`       | "If true, this tool may interact with an 'open world' of external entities … Default: true"                                   | Not set, so `true`                               | Set `false` on all four                                                 |
| Trust                 | "clients MUST consider tool annotations to be untrusted unless they come from trusted servers"                                | n/a                                              | Hints tune prompts and parallelism; they are not a safety mechanism     |
| `outputSchema`        | "Servers MUST provide structured results that conform to this schema"; helps "clients and LLMs understand and properly handle structured tool outputs" | None                              | Declare the `reportPreview` shape on `preview_update` and `apply_update` |
| `structuredContent`   | "a tool that returns structured content SHOULD also return the serialized JSON in a TextContent block"                        | Text only                                        | Return both                                                             |
| Tool errors           | "Tool Execution Errors contain actionable feedback that language models can use to self-correct"; clients "SHOULD provide tool execution errors to language models" | `isError: true` with the parser's message | Keep; make the message say what to send next (section 6.3)        |
| `instructions`        | "Optional natural-language guidance for LLMs on how to use this server effectively"                                           | 277 characters, names the order of calls         | Keep under 512 characters with the essentials first                     |
| Prompts               | "designed to be user-controlled"; typically "slash commands"                                                                  | `change_plan(request?)`                          | Add `review_week`, `catch_up`, `add_course(url)`: each is one sentence plus the brief |
| Resources             | "application-driven"; annotations `audience`, `priority`, `lastModified`                                                      | Four static resources                            | Add `lastModified` and `audience: ["assistant"]`; a template `plan://week/{monday}` is optional |
| Resource links        | "A tool MAY return links to Resources"                                                                                        | None                                             | `get_guide` can end with a link to `plan://schema/update`               |
| Elicitation           | Form mode: flat objects of primitives; "Servers MUST NOT use form mode elicitation to request sensitive information"          | None                                             | See below                                                               |
| Tool order            | "Servers SHOULD return tools in a deterministic order"                                                                        | A constant array                                 | Nothing                                                                 |
| `ttlMs`, `cacheScope` | Required on list results in 2026-07-28                                                                                        | Not in 1.x                                       | Comes with the SDK move                                                 |

Sources: [tools][mcp-tools], [schema reference][mcp-schema], [prompts][mcp-prompts],
[resources][mcp-resources], [elicitation][mcp-elicitation], [discover][mcp-discover],
[changelog][mcp-changelog], [Claude Code MCP][cc-mcp].

- **Elicitation fits one place exactly: the confirmation before `apply_update`.** Today the rule "Call it only
  after the person agreed" lives in a description and the model enforces it. A form-mode elicitation with one
  boolean ("Apply 3 changes: 2 moved, 1 added?") moves that decision to the person, in the client's own
  dialog. The schema subset allows it ("flat objects with primitive properties only"). Two cautions: in
  2026-07-28 it is delivered as an `input_required` result and a retried call, which the 1.x SDK does not
  speak; and a client that did not declare the capability must not be sent one, so the description-based
  rule stays as the fallback. Clients also ask before a write on their own: ChatGPT "currently requires
  manual confirmation in any conversation before write actions can be taken" ([OpenAI MCP][oai-mcp],
  summary).
- **Descriptions.** Anthropic: "Provide extremely detailed descriptions. This is by far the most important
  factor in tool performance … Aim for at least 3–4 sentences" ([define tools][anthropic-define-tools]).
  OpenAI: "write action-oriented tool names and descriptions that include 'Use this when…' guidance, note
  disallowed/edge cases, and add parameter descriptions (and enums)" ([ChatGPT custom MCP][oai-devmode]).
  The four descriptions here already do this. Claude Code cuts a description loaded up front at 4,096
  characters and reads "only the part within the shorter limit" when searching, so "put critical details
  near the start" ([Claude Code MCP][cc-mcp]).
- **Names.** With many servers connected, a bare `get_plan` is ambiguous. Anthropic: "prefix names with the
  service" ([define tools][anthropic-define-tools]). Clients prefix by server already
  (`mcp__learning-curve__get_plan`), and the specification warns that the server name "SHOULD NOT be relied
  upon for disambiguation" ([tools][mcp-tools]). Renaming to `plan_get`, `plan_preview_update` is optional;
  the cost is a changed public name.
- **Result size.** Give `get_plan` a default window (for example from the Monday of this week, 8 weeks) and
  say so in the description, so that the unfiltered call stays far below Claude Code's 25,000-token default
  and 50,000-character spill ([Claude Code MCP][cc-mcp]). Anthropic: "Design tool responses to return only
  high-signal information" ([define tools][anthropic-define-tools]).

## 5. Structured output and tool use with JSON Schema

### 5.1 Anthropic

Structured outputs are generally available: `output_config.format` with `type: "json_schema"` for the
answer, `strict: true` on a tool for its input. "The `output_format` parameter has moved to
`output_config.format`, and beta headers are no longer required" ([structured outputs][anthropic-so], read
raw; page metadata `status: stable`).

| Supported (d)                                                                 | Not supported (d)                                                                                   |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| All basic types; `enum`, `const`                                              | "`oneOf` (use `anyOf` instead)"; `not`                                                              |
| `anyOf`, `allOf` (with exceptions)                                            | "`anyOf` in the same schema object as keywords such as `type` or `properties`"                      |
| `$ref`, `$defs`, `definitions`; `default`                                     | "Recursive schemas"; "External `$ref`"                                                              |
| `required`; `additionalProperties` "(must be set to `false` for objects)"     | "Numerical constraints (such as `minimum`, `maximum`, `multipleOf`)"                                 |
| Formats `date-time`, `time`, `date`, `duration`, `email`, `hostname`, `uri`, `ipv4`, `ipv6`, `uuid` | "String constraints (`minLength`, `maxLength`)"                                |
| "Array `minItems` (only values 0 and 1 supported)"                            | "Array constraints beyond `minItems` of 0 or 1"                                                     |
| `pattern`: `^…$`, `*`, `+`, `?`, "simple `{n,m}` cases", `[]`, `.`, `\d`, `\w`, `\s`, groups | Backreferences, lookaround, `\b`, "Complex `{n,m}` quantifiers with large ranges"     |

Limits (d): 20 strict tools per request; **24 optional parameters** "across all strict tool schemas and JSON
output schemas. Each parameter not listed in `required` counts"; 16 parameters with union types; beyond that
"Schema is too complex for compilation" and a 180-second compile timeout. An unsupported keyword is "a 400
error with details". Other behaviour (d): required properties are emitted first, then optional ones; `enum`
and `const` capitalisation is not guaranteed ("Compare enum values case-insensitively"); a refusal or
`max_tokens` can still produce output that does not match; "Message prefilling" is incompatible with JSON
outputs; the first request with a new schema pays a compile, cached "for 24 hours".

The SDK helpers show the intended workaround: "Remove unsupported constraints", "Add each removed constraint
to the field description", "Add `additionalProperties: false` to all objects", then validate the response
against the original schema ([structured outputs][anthropic-so], through a summary of that section).

Two facts about forcing output that changed recently (d):

- Prefilling the assistant turn is gone on current models: "Requests with prefilled assistant messages to
  these models return a 400 error", and the migration is "The structured outputs feature is designed
  specifically to constrain Claude's responses" or "asking the model to conform to your output structure
  first, as newer models can reliably match complex schemas when told to, especially if implemented with
  retries" ([prompting best practices][anthropic-prompting]).
- Forcing a tool is not available on the newest models: for "Claude Fable 5.2, Claude Mythos 5.2, Claude Opus
  5.5, Claude Sonnet 5.5, Claude Fable 5.1, and Claude Mythos 5.1" `tool_choice` `any` and `tool` "return a
  400 error"; use "`auto` with strict tool use … or structured outputs when you need a response in a fixed
  JSON shape" ([define tools][anthropic-define-tools]).

### 5.2 OpenAI

From the "Supported schemas" section of the Structured Outputs guide ([OpenAI structured outputs][oai-so],
read through a summary; no date on the page):

| Supported (d, via summary)                                                        | Rules and limits (d, via summary)                                                       |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Types string, number, boolean, integer, object, array, enum, `anyOf`              | "Root objects must not be `anyOf` and must be an object"                                 |
| String: `pattern`, `format` (date-time, time, date, duration, email, hostname, ipv4, ipv6, uuid) | "All fields must be `required`"; an optional field is a union with `null`   |
| Number: `multipleOf`, `maximum`, `exclusiveMaximum`, `minimum`, `exclusiveMinimum` | "`additionalProperties: false` must always be set in objects"                           |
| Array: `minItems`, `maxItems`                                                     | Up to 5,000 object properties and 10 levels of nesting                                   |
| `$defs`, `$ref`, recursion                                                        | Up to 1,000 enum values; 120,000 characters of names and enum/const values in total      |
| Keys are emitted in schema order                                                  | Not supported: `allOf`, `not`, `dependentRequired`, `dependentSchemas`, `if`/`then`/`else` |

- `oneOf` does not appear in either column of what I was given. Unverified whether it is accepted, rewritten
  or rejected; the supported union is `anyOf`.
- `const` is counted in the size limits, which implies it is accepted; it is not in the list of supported
  types. Unverified.
- `minLength` / `maxLength` appear only in the list of constraints "not yet supported for fine-tuned
  models", which implies base models accept them; not in the supported string properties I was given.
  Unverified.
- Function calling ([OpenAI function calling][oai-fc], read raw): "Setting `strict` to `true` will ensure
  function calls reliably adhere to the function schema … We recommend always enabling strict mode", with
  the same two requirements: "`additionalProperties` must be set to `false` for each object" and "All fields
  in `properties` must be marked as `required`"; "You can denote optional fields by adding `null` as a `type`
  option". The Responses API tries to "normalize your schema into strict mode when possible" and otherwise
  falls back to non-strict and shows `strict: false`; "Chat Completions requests remain non-strict by
  default".

### 5.3 Google (Gemini)

Google's documentation now lives at `aistudio.google.com/docs` (the `ai.google.dev` addresses redirect) and
describes structured output through the Interactions API's `response_format`
([Gemini structured output][g-so], read through a summary; no date shown).

| Supported and enforced (d, via summary)                         | Accepted but not enforced (d, via summary)                         |
| --------------------------------------------------------------- | ------------------------------------------------------------------ |
| Types string, number, integer, boolean, object, array, null      | String `minLength`, `maxLength`                                    |
| Object: `properties`, `required`, `additionalProperties`         | Object `minProperties`, `maxProperties`                            |
| String: `enum`, `format` (date-time, date, time)                 | Array `uniqueItems`, `contains`, `minContains`, `maxContains`      |
| Number: `enum`, `minimum`, `maximum`                             |                                                                    |
| Array: `items`, `prefixItems`, `minItems`, `maxItems`            |                                                                    |
| `anyOf`; `$ref`/`$defs`; `title`, `description`                  |                                                                    |

- Unenforced keywords are not an error: "the API automatically strips and ignores them during request
  normalization rather than returning an error." Validate in the application.
- `oneOf`, `const` and `pattern` are not covered by the page as I received it. Unverified.
- A schema that is too large or complex is "`400 INVALID_ARGUMENT`".
- Function calling ([Gemini function calling][g-fc], read raw): "Only a subset of the OpenAPI schema is
  supported"; "For `any` mode, very large or deeply nested schemas may be rejected." The API "compiles your
  function declarations into a state machine that constrains token generation" with "limits on total states,
  branching paths, and nesting depth". Its advice is specific: "Optional properties, `enum` values, and
  `anyOf` branches multiply the branching paths"; "Array bounds such as `minItems` and `maxItems` also
  duplicate the item schema for each counted position"; "Move complex formatting rules into field
  `description` properties".

### 5.4 `UPDATE_SCHEMA` against those limits

Counted on the schema served by `/api/plan-schema` on the day of the research: 17 object schemas, all with
`additionalProperties: false`; 25 properties not listed in `required`; `oneOf` 1; `const` 12; `pattern` 21;
`minLength` 7; `maxLength` 1; `minimum` 2; `maximum` 2; `minItems` 5 (all `1`); `maxItems` 3; `minProperties`
1; `default` 6; `examples` 21; `enum` 6; plus `$schema`, `$id`, `title`. About 18 KB.

| # | Construct in `schema.ts`                                                              | Anthropic strict                                  | OpenAI strict                                         | Gemini                                              |
| - | ------------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------- |
| 1 | `changes.items: { oneOf: CHANGES }` (11 branches)                                     | **Rejected**: `oneOf` unsupported; use `anyOf`    | Unverified; `anyOf` is the supported form              | Unverified; `anyOf` is the supported form; 11 branches raise complexity |
| 2 | 25 optional properties (`format`, `summary`, `description`, `kind`, `rrule`, 9 in `patch`, …) | **Rejected**: limit is 24 per request      | **Rejected**: every field must be `required`           | Allowed; each one multiplies branching               |
| 3 | `minLength: 1` (titles, names), `maxLength: 80` (`plan.rename`)                       | **Rejected**                                      | Unverified                                             | Stripped silently                                    |
| 4 | `minimum`/`maximum` on `actual` (5…1440) and `days` (−366…366)                        | **Rejected**                                      | Supported                                              | Supported                                            |
| 5 | `maxItems: 400` (`sessions`, `events`), `maxItems: 200` (`changes`)                   | **Rejected**: only `minItems` 0 or 1              | Supported                                              | Enforced, and "duplicate the item schema for each counted position": 400 copies is the likeliest cause of a complexity rejection |
| 6 | `minItems: 1` (five arrays)                                                           | Supported                                         | Supported                                              | Supported                                            |
| 7 | `patch.minProperties: 1`                                                              | Not in the supported list; expect a 400 (unverified) | Not in the supported list (unverified)              | Stripped silently                                    |
| 8 | `pattern` for times, days, colors: `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$`, `^#[0-9a-fA-F]{6}$` | Supported class of regex                       | Supported                                              | Unverified                                           |
| 9 | `pattern` for `rrule`: `^FREQ=WEEKLY;BYDAY=(MO\|TU\|…)(,(MO\|TU\|…))*$`               | Groups are supported; alternation `\|` is not in the list of supported features (unverified) | Supported (regex dialect unverified) | Unverified                 |
| 10 | `type: { const: 'event.patch' }`, `format: { const: … }` without a `type` keyword     | `const` supported; missing `type` unverified      | Unverified                                             | Unverified                                           |
| 11 | `enum` without `type` (`availability`, `kind`)                                        | `enum` supported; missing `type` unverified       | Unverified                                             | Unverified                                           |
| 12 | `examples` (21), `$schema`, `$id: 'learning-curve/update@1'`                          | Not in the supported list (unverified)            | Unverified                                             | Unknown keywords are stripped                         |
| 13 | `default` (6)                                                                         | Supported                                         | Unverified                                             | Unverified                                           |
| 14 | Root: object, `required: ['changes']`, `additionalProperties: false`                  | Fine                                              | Fine once all three properties are required            | Fine                                                 |
| 15 | Nesting: update → changes → change → sessions → session → field                       | Fine                                              | 5 levels, limit 10                                     | Counts toward the state-machine limits               |

What no schema subset expresses, so the parser must keep checking: `end` after `start` on the same day,
`days` not 0, `start` on a day named in `rrule`, a `uid` that exists, a calendar `id` that exists, the
weekly budget. All three vendors say the same thing in their own words; Google's page: output is
"syntactically correct JSON but not guaranteed semantically correct" ([Gemini structured output][g-so],
summary).

**Where the schema is fine as it is:**

- As an MCP `inputSchema`: "any JSON Schema 2020-12 keyword may appear alongside `type` — including
  composition keywords (`oneOf`, `anyOf`, `allOf`, `not`)" ([schema reference][mcp-schema]). One caveat from
  the same paragraph: "type constraints placed inside `oneOf` branches are not enforced for whichever branch
  does not match", so a client-side validator reports a wrong change poorly. `parseUpdate`'s message
  ("Change 2 (event.patch): …") is the useful one; keep returning it as a tool error.
- As a non-strict tool schema (Anthropic without `strict`, OpenAI Chat Completions, Gemini `auto` mode),
  where the schema is guidance and the model is not constrained by a grammar. Not tested with any provider.

**What to build:** one function, `strictSchema(UPDATE_SCHEMA, target)`, next to `schema.ts`, that derives the
constrained variants mechanically:

1. `oneOf` → `anyOf` (the branches are already disjoint by `type.const`).
2. Drop `minLength`, `maxLength`, `minimum`, `maximum`, `maxItems`, `minProperties`, `examples`, `$schema`,
   `$id`; append what was dropped to the field's `description` ("at least 1 character", "5 to 1440"), which
   is what Anthropic's own SDK helpers do.
3. Add `type: 'string'` beside every `const` and `enum`.
4. For OpenAI: make every property required and turn each optional one into a union with `null`; teach
   `parseChange` to treat `null` as absent, or strip nulls before parsing.
5. For Anthropic: get under 24 optional parameters. Making `format` and `summary` required is free (both are
   always wanted). The `patch` object's nine optional fields are the bulk; the OpenAI-style nullable form
   moves them from the optional budget to the union budget (limit 16), which also fits.
6. A test beside the existing drift tests: every example of the guide validates against each variant, and
   `parseUpdate` accepts what each variant allows.

The existing schema stays the source of truth and the public document; the variants are build products.

## 6. Prompt-writing guidance, and the guide

### 6.1 What the three vendors say

| Topic                         | Anthropic ([best practices][anthropic-prompting], read raw)                                                                 | OpenAI ([prompt engineering][oai-prompting], summary; [function calling][oai-fc], raw)                    | Google ([prompting strategies][g-prompting], read raw)                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Structure                     | "XML tags help Claude parse complex prompts unambiguously, especially when your prompt mixes instructions, context, examples, and variable inputs" | Sections Identity, Instructions, Examples, Context, formatted with Markdown and XML     | "XML-style tags (e.g., `<context>`, `<task>`) or Markdown headings are effective. Choose one format and use it consistently within a single prompt" |
| Examples                      | "Wrap examples in `<example>` tags"; "Include 3–5 examples for best results"; relevant, diverse                             | "show a diverse range of possible inputs with the desired outputs"; "Adding examples may hurt performance for reasoning models" | "We recommend to always include few-shot examples"; "ensure a consistent format across all examples" |
| Long data vs. instructions    | "Put long-form data at the top … above your query, instructions, and examples"; "Queries at the end can improve response quality by up to 30 percent in tests" | Context "is usually best positioned near the end of your prompt"; reusable instructions first, for caching | "supply all the context first. Place your specific instructions or questions at the very *end*"; then anchor: "Based on the information above..." |
| Where the format rule goes    | "Tell Claude what to do instead of what not to do"; "Use XML format indicators"                                             | Use Structured Outputs to "ensure JSON data emitted from a model conforms to a JSON schema"                | "Place essential behavioral constraints, role definitions (persona), and output format requirements in the System Instruction or at the very beginning of the user prompt" |
| Reasons                       | "Providing context or motivation behind your instructions, such as explaining to Claude why such behavior is important"     | "Pass the intern test. Can an intern/human correctly use the function given nothing but what you gave the model?" | "Explicitly explain any ambiguous terms or parameters"                                                 |
| Tone                          | "Where you might have said 'CRITICAL: You MUST use this tool when...,' you can use more normal prompting"                   | Reasoning models "provide better results on tasks with only high-level guidance"                           | "Be precise and direct … Avoid unnecessary or overly persuasive language"                                       |
| Retry after a wrong answer    | Newer models "can reliably match complex schemas when told to, especially if implemented with retries"                      | "Include examples and edge cases, especially to rectify any recurring failures"                            | Not found on the page                                                                                           |

The three agree on: delimit the parts, show examples in one consistent format, give reasons, write plainly,
and **put the person's question after the data**. They differ on where the long data sits relative to the
instructions (Anthropic: data first; OpenAI: instructions first, for caching; Google: context first, with
the format rule at the very beginning). For a text pasted into an unknown chat app, the order that satisfies
all three is: a short contract at the top, the instructions, the data, then the request and a one-line
restatement of the contract.

None of the three pages has a section on phrasing error feedback for a retry. The closest primary source is
the MCP specification's distinction and example: an execution error should be "actionable feedback that
language models can use to self-correct", such as "Invalid departure date: must be in the future. Current
date is 08/08/2025." ([tools][mcp-tools]). Section 6.3 builds on that; its wording is my proposal, not a
quoted recipe.

### 6.2 The current guide against that advice

What it already does well: a role in the first sentence; the date, weekday and time zone stated; rules with
reasons in several places ("because a repeat cannot be marked done"); three worked examples as JSON; the
request last (`## What I want`); plain tone, no capitals; an explicit "ask before answering with an update"
for unclear requests.

Concrete improvements, in order of expected effect:

1. **State the contract in the first lines and again after the plan.** The format rule ("Answer with one JSON
   code block that holds an update") sits about 30,000 characters above `## What I want`. Add two lines at the
   very top ("You will get instructions, then the plan, then a request. Answer with one fenced `json` block
   holding an update, or with a question if the request is unclear.") and one line after the request
   ("Based on the plan above, answer with one `json` block holding an update."). Google asks for the format
   rule at the very beginning and for the anchor phrase after the data; Anthropic's test result is about the
   query being last.
2. **Wrap the variable parts in tags**: `<plan>…</plan>` around the JSON, `<request>…</request>` around the
   person's words, `<example>…</example>` around each example. The plan is 32,000 characters of JSON that
   itself contains Markdown-like text in titles; a tag is an unambiguous boundary. Keep Markdown headings for
   the instructions, and use tags only for those three kinds of content, so the document still follows
   "choose one format" for its prose.
3. **Compute the dates in the examples from `now`.** `2026-11-26T19:00` and `2026-11-25T07:00` are fixed
   strings; the model is told two paragraphs earlier what today is. An example in the past contradicts the
   guide's own rules and risks being copied. Derive them from `mondayOf(now)` and avoid `meta.holidays`.
4. **Say that the examples are examples.** The first one uses a real `uid` from the plan with a real move. Add
   "The values are illustrative: do not reuse them" and, better, name the pattern each example shows.
5. **Add two examples and keep the set small.** Missing patterns: a clarifying question instead of an update
   (the brief ends with "(Ask me what to change.)" when the request is empty, with no example of the expected
   reply), and `events.shift` followed by `events.move` for the sessions that landed on a holiday (the guide
   describes this in prose only). That makes five, Anthropic's upper figure. OpenAI warns that examples can
   hurt reasoning models, so resist adding more.
6. **Turn the prohibitions into instructions.** "Never make a uid up" → "Copy every `uid` from the plan below,
   character for character". "Do not invent modules" → "List only modules named by the person or on the page
   they gave; when the list is incomplete, ask". "never 'restore' or rewrite a description" → "Leave
   `description` out of a patch unless the person asked to change it". Anthropic: "Tell Claude what to do
   instead of what not to do".
7. **Give the missing reasons.** Rules 1, 2, 5 and 6 are bare. One clause each: the budget is what the person
   can sustain beside work; what is done is a record of the past; a deadline is fixed by the certificate.
8. **Put the field reference in the brief.** Either generate the table of changes from `UPDATE_SCHEMA` with
   required and optional fields marked (a few hundred characters more), or append the schema itself (18 KB,
   a 40% larger brief). The first is enough and keeps one source. Then drop "follow it when you have it".
9. **Tighten "nothing the person has to edit".** It can be read as "no prose at all" or as "no placeholders".
   Say both: "Fill every value: no placeholders. Put what the person should know into `summary`; outside the
   block write at most one sentence." `parseUpdate` already tolerates prose around the block.
10. **Offer a smaller brief.** A "next 8 weeks only" option (the filter `get_plan` already has) cuts the plan
    by more than half for everyday requests; the guide's weekly table covers the same 8 weeks.

### 6.3 Feedback for a retry

Today a rejected answer shows the person `ai_invalid` or `ai_problem` with the parser's message, and they
have to compose the reply to the chat themselves. Add a **Copy the correction** button that produces a text
built by a function in `plan-domain` (so the MCP tool error, the 422 body and the UI share it):

```
Your update was not applied: nothing was stored.

Problem: change 2 (event.patch): `end` must be after `start`
The change at fault:
{"type":"event.patch","uid":"certs-012@learning-curve","patch":{"start":"2026-11-26T19:00","end":"2026-11-26T18:00"}}

Send the whole update again as one json block, with this change corrected and the other changes unchanged.
```

Why each part: the outcome first ("nothing was stored": the update is all or nothing, and the model should
not assume change 1 went through); the error verbatim with the position and type the parser already adds;
the offending change echoed, so the model does not have to find it in a long conversation; one instruction
that says what to return, in positive form. Add "Today is … in Europe/Minsk" when the error is about a date,
following the example in the MCP specification. When the plan changed since the brief was copied (a `uid`
that no longer exists), say so and attach the fresh brief instead.

## 7. Conventions for exposing a site to models

| Convention                 | Status                                                                                                                                              | Who reads it                                                                                               | Worth it here                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `/llms.txt`                | A "proposal to standardise on using an /llms.txt file to provide information to help agents use a website", by Jeremy Howard; published 2024-09-03, page modified 2026-08-10 ([llmstxt.org][llmstxt], summary) | The page names no model or product that honours it; it cites documentation platforms and coding agents as adopters | Small. Useful as a signpost once the app is public |
| `AGENTS.md`                | "an open, simple format for guiding coding agents", "now stewarded by the Agentic AI Foundation under the Linux Foundation"; plain Markdown, no required fields ([agents.md][agentsmd], summary) | Listed there: OpenAI Codex, Jules, Cursor, VS Code, Gemini CLI, GitHub Copilot coding agent, Zed, Aider and others. Claude Code is not on the list | Yes, for the repository |
| OpenAPI description        | OpenAPI Specification **3.2.1**, dated 10 September 2026 ([spec][oas]); schemas are JSON Schema draft 2020-12 since 3.1 (k)                          | API tooling, code generators, some agent frameworks                                                        | Small: three routes                                               |
| `/.well-known/oauth-protected-resource` | RFC 9728; required of a protected MCP server ([authorization][mcp-auth])                                                                | MCP clients, during authorization                                                                          | Only with stage 3 of section 4.3                                  |
| MCP server card            | A draft: SEP-1649 and its successor SEP-2127 propose a card under `/.well-known/`; the path differs between drafts ([SEP-2127][mcp-sep-2127], from a search summary) | Unverified                                                                                    | Not yet                                                           |
| MCP Registry               | Exists, with a publishing guide ([registry][mcp-registry], seen in the documentation index only)                                                    | Clients' server browsers                                                                                   | No: a personal app is not a public server                         |

- **`llms.txt` for this app** would be a dozen lines: an H1, a one-sentence summary, and links to
  `/api/plan-guide`, `/api/plan-schema`, the README section and the MCP endpoint. The proposal's format is "an
  H1 naming the project" (the only required element), an optional blockquote summary and H2 sections of link
  lists ([llmstxt.org][llmstxt], summary). It is consulted "on demand", not crawled. Both vendors' docs sites
  ship one (`modelcontextprotocol.io/llms.txt`, `code.claude.com/docs/llms.txt`, `aistudio.google.com/llms.txt`
  were all seen during this research), which is adoption by publishers, not proof that chat apps fetch it.
  `/api/plan-guide` already returns `text/markdown`, which is the proposal's "clean Markdown copy" idea.
- **`AGENTS.md`**: this repository has a `CLAUDE.md` with exactly that content and no `AGENTS.md`. The
  agents.md page says agents "automatically read the nearest file in the directory tree". A one-line
  `AGENTS.md` that points to `CLAUDE.md`, or the reverse, makes the same notes reach Cursor, Codex and VS
  Code. How Claude Code treats `AGENTS.md` was not checked.
- **OpenAPI**: `PLAN_SCHEMA` and `UPDATE_SCHEMA` are already 2020-12, so a 3.2 document can reference them
  unchanged. With an MCP endpoint in place, few clients would need it. Low priority.

## 8. Models in the browser (Chrome's Prompt API)

From [Chrome's Prompt API page][chrome-prompt] (published 2025-05-20, last updated 2026-10-21, read through a
summary):

- **Status**: the page's availability table lists Chrome 148 for web pages and Chrome 138 for extensions.
  The API surface is `LanguageModel`; the model is Gemini Nano, downloaded on first use.
- **Requirements**: Windows 10 or 11, macOS 13+, Linux, or ChromeOS on Chromebook Plus; at least 22 GB free
  on the profile volume; a GPU with more than 4 GB of VRAM, or 16 GB of RAM and 4 or more cores. Desktop
  only: Chrome for Android and iOS are not supported.
- **Languages**: English, Japanese, Spanish, German and French. **Russian is not listed**, and the plan's
  content is Russian.
- **Structured output**: yes. A JSON Schema (or a regular expression) is passed as `responseConstraint` to
  `prompt()` or `promptStreaming()`; `omitResponseConstraintInput` keeps it out of the context window.
  Which JSON Schema keywords the constraint honours is not stated on the pages read
  ([structured output][chrome-so], dated 2025-05-13).
- **Context**: `session.contextWindow` and `session.contextUsage`; on overflow older turns are dropped. The
  size is not given on the page. Not available in Web Workers; cross-origin iframes need
  `allow="language-model"`.
- **Standardisation**: the explainer is "in active development by the Web Machine Learning Community Group"
  and implementations are "experimentally available" in Chrome and Edge; Mozilla's and WebKit's positions
  are linked, not stated ([explainer][prompt-api-explainer], summary).

**Verdict:** not a route for editing the plan. A 43,000-character brief in an unsupported language, on a
small on-device model, with hardware most laptops lack, will not produce reliable updates. It could serve a
narrow, optional nicety later (turning "move tomorrow's session to Friday evening" plus one day of events
into one `event.patch`), feature-detected with `LanguageModel.availability()`. Do not build on it now.

## 9. Calling a model from the app's server with the person's own key

### 9.1 What the providers require

- **The key stays on a server.** OpenAI: "Never deploy your key in client-side environments like browsers or
  mobile apps … Requests should always be routed through your own backend server where you can keep your API
  key secure" ([OpenAI key safety][oai-keys]). Anthropic: "Never share your API key", "Handle API keys
  securely with environment variables and secrets", "Rotate API keys regularly" ([Anthropic key
  practices][anthropic-keys]). Google recommends the environment variable `GEMINI_API_KEY` or
  `GOOGLE_API_KEY` and now rejects "unrestricted standard keys" ([Gemini API keys][g-keys]). OpenAI adds: use
  a project service account, and "We strongly recommend setting an expiration date"
  ([OpenAI production practices][oai-prod]).
- **Browser-direct calls exist and are named as dangerous.** Anthropic's API accepts a browser request only
  with the header `anthropic-dangerous-direct-browser-access` (k: not re-read today).
- **Shape of the request** (Anthropic as the worked case; the other two have the same parts):
  authentication by `Authorization: Bearer` or `x-api-key` ([API overview][anthropic-api]); the update comes
  back either as the answer, constrained by `output_config.format` with the strict variant of the schema, or
  as the input of a `strict: true` tool ([structured outputs][anthropic-so]); on the newest models a tool
  cannot be forced, so the structured answer is the simpler of the two ([define
  tools][anthropic-define-tools]).
- **Streaming**: server-sent events; a tool's input arrives as partial JSON in `content_block_delta` events
  and "You can accumulate the string deltas and parse the JSON once you receive a `content_block_stop`
  event" ([Anthropic streaming][anthropic-streaming]). OpenAI streams
  `response.function_call_arguments.delta` events ([OpenAI function calling][oai-fc]). Gemini: "The streamed
  chunks are valid partial JSON strings that can be concatenated" ([Gemini structured output][g-so],
  summary).
- **The vendor-hosted MCP connector is not the shortcut it looks like**: the Messages API can call an MCP
  server itself, but "The server must be publicly exposed through HTTP" and the feature is in beta
  ([MCP connector][anthropic-mcp-connector]).

### 9.2 The minimal safe design

1. **Key**: read from the server's environment (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `GEMINI_API_KEY`) in
   a new server-only module; never returned by any route, never logged, never passed into a module (modules
   may not import server code, which the lint rules already enforce). No key, no feature: the UI asks the
   server "is a model configured?" and shows the chat box only then. A key typed into the browser and stored
   there is what the vendors warn against; if a settings screen is wanted, it writes to an untracked file on
   the server, like `history.json`.
2. **One route**, `POST /api/plan-chat`, taking `{ request, history? }` and streaming back. It builds the
   same parts the brief has: the guide as the system text (stable, so cacheable), the plan in a `<plan>` tag,
   then the request.
3. **Output**: the strict variant of `UPDATE_SCHEMA` (section 5.4) as the answer format. The answer goes
   through `parseUpdate` and `previewUpdate` exactly like a pasted one. A model may also need to ask a
   question: allow that with a top-level `anyOf` of "update" and "question" where the provider permits it, or
   with a nullable `question` field beside `changes` where the root must be a plain object (OpenAI).
4. **Retry**: on a parse error or a `problem`, send the correction text of section 6.3 as the next user turn;
   stop after two attempts and show the last error.
5. **The person still applies.** The route never writes. The existing preview and `Apply` button stay, so
   the model's output is a proposal, as it is now.
6. **Abuse**: the app has no login. On `localhost` that is fine. On a public address this route spends the
   owner's money for any visitor, so it must not exist there before an app login does. Until then: enable it
   only when `canWrite()` is true and the request's `Origin` is the app's own; set a spending limit in the
   provider's console (k).
7. **Privacy**: the `AI chat` tab says "This page sends nothing anywhere". A server-side call sends the whole
   plan to a provider. The UI must say so before the first call and name the provider.

Effort is mostly in items 3 and 4, which need the strict variants and one provider's SDK (a new dependency,
in the `catalog`). Supporting three providers triples the testing, not the design: start with one.

## 10. What to build next

Ranked by benefit to the person per unit of work. S = an afternoon, M = a few days, L = a week or more.

| #   | What                                                                                                                                                              | Effort | What the person gets                                                                                         | Backed by                                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| 1   | **Guide v2**: contract at the top and after the request, `<plan>` / `<request>` / `<example>` tags, dates computed from `now`, two more examples, positive wording, field table generated from the schema | S | Fewer wrong or wordy answers from any chat app, with no change to the workflow | Section 6; [Anthropic][anthropic-prompting], [Google][g-prompting], [OpenAI][oai-prompting]       |
| 2   | **Correction text and "Copy and open"**: a shared `correctionFor(error)` used by the UI, the 422 body and the MCP tool error; a button that copies the brief and opens the chosen chat app | S | The two manual steps that remain become one click each; a rejected answer is fixed in one round trip | Sections 3.2, 6.3; [MCP tools][mcp-tools], [Claude Code deep links][cc-deeplinks]                |
| 3   | **MCP polish**: `openWorldHint: false`, `outputSchema` + `structuredContent` on the two update tools, a default window on `get_plan`, two or three more prompts, a "Connect a tool" panel with copy-ready commands for Claude Code, Cursor, VS Code and Claude Desktop | S | Agents make fewer exploratory calls; any client is set up by pasting one command | Section 4.2, 4.4; [schema reference][mcp-schema], [Claude Code MCP][cc-mcp], [Cursor][cursor-mcp], [VS Code][vscode-mcp] |
| 4   | **`POST /mcp` in the web server**, stage 1: localhost only, `Origin`/`Host` allow-list, the same tool table as stdio                                              | M      | The running app is the MCP server: no second process, no `pnpm` on the client's side, one URL to register     | Section 4.3; [Streamable HTTP][mcp-http], SDK 1.32.2 source                                        |
| 5   | **Strict schema variants** generated from `UPDATE_SCHEMA`, with drift tests                                                                                       | M      | Nothing visible on its own; it is the precondition of 6 and makes the schema usable in any provider's API     | Section 5; [Anthropic][anthropic-so], [OpenAI][oai-so], [Gemini][g-fc]                            |
| 6   | **Built-in chat** through the server with the owner's key (one provider first), streaming, automatic retry, same preview and Apply                                | L      | "Ask and apply" inside the app, no clipboard at all                                                          | Section 9; [key safety][oai-keys], [Anthropic keys][anthropic-keys], [streaming][anthropic-streaming] |
| 7   | **Move to the v2 MCP SDK** (protocol 2026-07-28), then elicitation for the apply confirmation                                                                     | M      | Keeps working when clients drop the handshake fallback; the confirmation becomes the person's click, not the model's promise | Section 4.1, 4.4; [changelog][mcp-changelog], [typescript-sdk][mcp-ts-sdk], [elicitation][mcp-elicitation] |
| 8   | **Public reach**: an app login, the OAuth resource-server metadata, then claude.ai and ChatGPT connectors; `llms.txt` and `AGENTS.md` alongside                    | L      | The plan can be changed from a phone, by voice, in the chat app the person already uses                      | Sections 4.3, 7; [authorization][mcp-auth], [custom connectors][claude-custom-connectors], [ChatGPT][oai-devmode] |

Items 1 to 3 are independent and can ship in any order. Item 6 needs 5. Item 8 needs the login that the
calendar research also asks for before any public deployment. Not recommended now: `?q=` links to the web
chat apps as a primary path, a `.mcpb` bundle, the Chrome Prompt API, an OpenAPI document.

## 11. Not verified

| Claim                                                                                              | Kind        | How to settle it                                                                                 |
| -------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------ |
| `https://claude.ai/new?q=` prefills (and does not send) today                                      | (f)         | Open it logged in, with a 200-character and a 6,000-character prompt, on desktop and mobile       |
| `https://chatgpt.com/?q=` prefills or submits; `hints=`, `model=` are honoured; its length limit   | (f)         | Same test                                                                                         |
| Gemini has no prefill parameter                                                                    | (f)         | Same test with `?q=` and `?prompt=`                                                               |
| Perplexity, Copilot, Mistral prefill links                                                         | not looked at | Each vendor's help centre                                                                       |
| Parameters of `vscode://anthropic.claude-code/open`                                                | not read    | The Claude Code VS Code page                                                                      |
| How long clients keep the fallback to `initialize`-era servers                                     | unverified  | Each client's release notes                                                                       |
| `@modelcontextprotocol/server` 2.4.0 fully implements 2026-07-28, and the size of the migration     | summary only | Its migration guide; a spike on `mcp.ts`                                                         |
| `WebStandardStreamableHTTPServerTransport` works inside a TanStack Start route under Nitro          | untested    | A spike                                                                                           |
| One `.mcp.json` serves Claude Code and VS Code's Copilot harness unchanged                         | untested    | Open the repository in VS Code                                                                    |
| MCPB directory listings are deprecated; Settings → Extensions installs a `.mcpb`                   | search summary | Re-read the connectors article                                                                 |
| Transports and MCP features (prompts, resources) supported by claude.ai custom connectors          | not on the page | Connect a test server                                                                          |
| The MCP server card path and status                                                                | search summary | Read SEP-2127 itself                                                                           |
| Anthropic strict mode: `minProperties`, `examples`, `$id`, `const`/`enum` without `type`, regex alternation | unverified | Send the schema with each construct alone and read the 400                              |
| OpenAI strict mode: `oneOf`, `const`, `minLength`/`maxLength`, `minProperties`, `default`, `examples` | unverified | Same                                                                                           |
| Gemini: `oneOf`, `const`, `pattern`; whether `maxItems: 400` is rejected in practice                | unverified  | Same; also read the "subset of the OpenAPI schema" reference, which was not opened                |
| `UPDATE_SCHEMA` works as a non-strict tool schema at each provider                                  | untested    | One call per provider                                                                             |
| The count of 25 optional properties                                                                | measured by a script over the served schema | Re-count after any schema change                                  |
| Anthropic's `anthropic-dangerous-direct-browser-access` header                                     | (k)         | The API reference                                                                                 |
| Provider-side spending limits                                                                      | (k)         | Each console                                                                                      |
| OpenAPI 3.1+ uses JSON Schema 2020-12                                                              | (k)         | The specification text                                                                            |
| How Claude Code treats `AGENTS.md`                                                                 | not checked | The Claude Code memory documentation                                                              |
| Which products fetch `/llms.txt` on their own                                                      | not stated by the proposal | Server logs after publishing one                                                    |
| JSON Schema keywords honoured by Chrome's `responseConstraint`; the size of the context window      | not on the pages read | The explainer and a test in Chrome                                                      |
| OpenAI, Google, Cursor, VS Code, Claude Desktop, llms.txt, agents.md and Chrome pages               | read through a summarising tool | Open the linked page for any sentence that a decision rests on               |

[mcp-versioning]: https://modelcontextprotocol.io/specification/versioning
[mcp-changelog]: https://modelcontextprotocol.io/specification/2026-07-28/changelog
[mcp-transports]: https://modelcontextprotocol.io/specification/2026-07-28/basic/transports
[mcp-http]: https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http
[mcp-auth]: https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization
[mcp-tools]: https://modelcontextprotocol.io/specification/2026-07-28/server/tools
[mcp-prompts]: https://modelcontextprotocol.io/specification/2026-07-28/server/prompts
[mcp-resources]: https://modelcontextprotocol.io/specification/2026-07-28/server/resources
[mcp-discover]: https://modelcontextprotocol.io/specification/2026-07-28/server/discover
[mcp-elicitation]: https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation
[mcp-schema]: https://modelcontextprotocol.io/specification/2026-07-28/schema
[mcp-deprecated]: https://modelcontextprotocol.io/specification/2026-07-28/deprecated
[mcp-local]: https://modelcontextprotocol.io/docs/develop/connect-local-servers
[mcp-registry]: https://modelcontextprotocol.io/registry/about
[mcp-ts-sdk]: https://github.com/modelcontextprotocol/typescript-sdk
[mcp-sep-2127]: https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2127
[cc-mcp]: https://code.claude.com/docs/en/mcp
[cc-deeplinks]: https://code.claude.com/docs/en/deep-links
[cc-issue-8827]: https://github.com/anthropics/claude-code/issues/8827
[claude-desktop-link]: https://support.claude.com/en/articles/14729294-open-claude-desktop-with-a-link
[claude-custom-connectors]: https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp
[claude-connectors]: https://support.claude.com/en/articles/11176164-use-connectors-to-extend-claude-s-capabilities
[anthropic-so]: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
[anthropic-define-tools]: https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools
[anthropic-prompting]: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
[anthropic-streaming]: https://platform.claude.com/docs/en/build-with-claude/streaming
[anthropic-api]: https://platform.claude.com/docs/en/api/overview
[anthropic-mcp-connector]: https://platform.claude.com/docs/en/agents-and-tools/mcp-connector
[anthropic-keys]: https://support.claude.com/en/articles/9767949-api-key-best-practices-keeping-your-keys-safe-and-secure
[oai-so]: https://developers.openai.com/api/docs/guides/structured-outputs
[oai-fc]: https://developers.openai.com/api/docs/guides/function-calling
[oai-prompting]: https://developers.openai.com/api/docs/guides/prompt-engineering
[oai-mcp]: https://developers.openai.com/api/docs/mcp
[oai-devmode]: https://developers.openai.com/api/docs/guides/developer-mode
[oai-tunnel]: https://developers.openai.com/api/docs/guides/secure-mcp-tunnels
[oai-keys]: https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety
[oai-prod]: https://developers.openai.com/api/docs/guides/production-best-practices
[oai-community-q]: https://community.openai.com/t/query-parameters-in-chatgpt/1027747
[g-so]: https://aistudio.google.com/docs/structured-output
[g-fc]: https://aistudio.google.com/docs/function-calling
[g-prompting]: https://aistudio.google.com/docs/prompting-strategies
[g-keys]: https://aistudio.google.com/docs/api-key
[g-forum-prefill]: https://discuss.ai.google.dev/t/can-the-gemini-api-enable-a-website-to-open-the-gemini-site-with-a-text-prompt-pre-filled-by-that-website/73828
[cursor-mcp]: https://cursor.com/docs/context/mcp
[cursor-deeplinks]: https://cursor.com/docs/integrations/deeplinks
[vscode-mcp]: https://code.visualstudio.com/docs/copilot/reference/mcp-configuration
[llmstxt]: https://llmstxt.org/
[agentsmd]: https://agents.md/
[oas]: https://spec.openapis.org/oas/latest.html
[chrome-prompt]: https://developer.chrome.com/docs/ai/prompt-api
[chrome-so]: https://developer.chrome.com/docs/ai/structured-output-for-prompt-api
[prompt-api-explainer]: https://github.com/webmachinelearning/prompt-api
