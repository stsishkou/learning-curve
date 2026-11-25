interface ImportMetaEnv {
  /** The site's origin, for absolute hreflang, canonical and Open Graph URLs */
  readonly VITE_DOCS_ORIGIN: string
  /** The component stand: localhost in dev, `<base>stand/` in a build */
  readonly VITE_STAND_URL: string
}
