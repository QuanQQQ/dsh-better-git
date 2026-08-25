import type { IncomingHttpHeaders } from 'node:http'

export interface TrustFenceRequest {
  headers: IncomingHttpHeaders | Headers
}

function header(headers: IncomingHttpHeaders | Headers, name: string): string | undefined {
  if (headers instanceof Headers) return headers.get(name) ?? undefined
  const value = headers[name]
  return typeof value === 'string' ? value : undefined
}

function parseAuthority(authority: string): URL | undefined {
  try {
    return new URL(`http://${authority}`)
  } catch {
    return undefined
  }
}

function isLoopbackHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  return parts.length === 4
    && parts[0] === '127'
    && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

function isTrustedAuthority(host: URL, trustedHosts: readonly string[]): boolean {
  return trustedHosts.some(entry => {
    const parsed = parseAuthority(entry)
    if (parsed === undefined) return false
    return parsed.port === '' ? parsed.hostname === host.hostname : parsed.host === host.host
  })
}

/** Mirrors the DSH /api Host, Fetch-Metadata, and Origin checks. */
export function isTrustedBetterGitRequest(
  request: TrustFenceRequest,
  trustedHosts: readonly string[],
): boolean {
  const hostHeader = header(request.headers, 'host')
  if (hostHeader === undefined) return false
  const host = parseAuthority(hostHeader)
  if (host === undefined) return false
  if (!isLoopbackHostname(host.hostname) && !isTrustedAuthority(host, trustedHosts)) return false
  if (header(request.headers, 'sec-fetch-site') === 'cross-site') return false
  const origin = header(request.headers, 'origin')
  if (origin === undefined) return true
  try {
    return new URL(origin).host === host.host
  } catch {
    return false
  }
}
