/**
 * `path` as an absolute address on the origin the person opened the planner at. A proxy or platform that ends HTTPS
 * in front of the server (Caddy, Fly.io, Railway, Azure) sends the request on as plain HTTP and names the original
 * scheme in `X-Forwarded-Proto`; the host is kept from the request, since those proxies pass it through. A calendar
 * app accepts its sign-in callback only on the exact `https` address registered for it.
 */
export function publicUrl(path: string, request: Request): string {
  const url = new URL(path, request.url)
  const scheme = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  if (scheme === 'https' || scheme === 'http') url.protocol = `${scheme}:`
  return url.href
}
