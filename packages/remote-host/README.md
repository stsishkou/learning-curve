# @lc/remote-host

What a React host needs to show a Module Federation remote. Consumed as TypeScript source.

- `@lc/remote-host`: `loadRemote<T>()` loads one exposed module with the federation runtime, shares the host's React
  (singletons) and asks for the manifest with a fresh query. It rejects with a `RemoteLoadError` whose `reason` is
  `timeout`, `unavailable`, `shape` or `version`, so a host can show a fallback. It imports no contract.
- `@lc/remote-host/docs`: `useDocsHost`, the docs drawer for a React host, built on `loadRemote` and
  `@lc/docs-contract`. Nothing is fetched until `open` is first called; the loader is loaded with `import()` then.
