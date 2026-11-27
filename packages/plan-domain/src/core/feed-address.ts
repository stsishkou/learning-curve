/**
 * The address as it is fetched: `webcal:` is the same file over https. null when it is not an https address, which
 * is what every calendar host gives out.
 */
export function feedAddress(input: string): string | null {
  try {
    const url = new URL(input.trim().replace(/^webcal:/i, 'https:'))
    return url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}
