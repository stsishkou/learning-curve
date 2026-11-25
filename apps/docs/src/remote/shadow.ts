// Everything the remote puts on a host page outside its own shadow root, and how to take it back.
import css from '../styles/remote.css?inline'

const FONTS =
  'https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600&family=Unbounded:wght@500;700&display=swap'
const PROPERTY_RULE = /@property\s+--[\w-]+\s*\{[^}]*\}/g

/**
 * Gives the shadow root its stylesheet and registers what a shadow root cannot hold on its own:
 *
 * - `@property` rules are ignored inside a shadow tree, and Tailwind's utilities (borders, shadows, transforms)
 *   rely on the initial values they declare, so they go to the document;
 * - fonts are loaded by the document, so the guide's link is added there unless the host already loads them.
 *
 * Returns the function that removes what was added.
 */
export function adoptStyles(shadow: ShadowRoot): () => void {
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(css)
  shadow.adoptedStyleSheets = [sheet]

  const properties = new CSSStyleSheet()
  properties.replaceSync(css.match(PROPERTY_RULE)?.join('\n') ?? '')
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, properties]

  let fonts: HTMLLinkElement | null = null
  if (!document.querySelector('link[href*="fonts.googleapis.com/css2?family=Golos+Text"]')) {
    fonts = document.createElement('link')
    fonts.rel = 'stylesheet'
    fonts.href = FONTS
    document.head.append(fonts)
  }

  return () => {
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((entry) => entry !== properties)
    fonts?.remove()
  }
}
