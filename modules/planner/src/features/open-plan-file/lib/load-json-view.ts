/** The editor is the heaviest thing in the module and only the file text tab needs it: it loads on demand. */
export const loadJsonView = () => import('./json-view')
