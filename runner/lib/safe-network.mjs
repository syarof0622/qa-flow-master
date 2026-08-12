// Shared SSRF guard: rejects non-HTTP(S) schemes, embedded credentials, and
// private/loopback/link-local network targets unless explicitly allowed via
// QA_ALLOW_PRIVATE_NETWORK=true. Used anywhere this project makes an
// outbound request to a user/environment-configured URL (suite api_request
// steps, the CI webhook reporter, etc.) so a malicious/misconfigured target
// can't be used to probe internal infrastructure.
export function assertSafeNetworkTarget(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP(S) targets are allowed');
  if (url.username || url.password) throw new Error('Credentials in network target URLs are not allowed');
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const privateHost = host === 'localhost' || host === '::1' || host === '::' || host.endsWith('.localhost') || host.endsWith('.local') || /^127\./.test(host) || /^0\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || /^(fc|fd|fe8|fe9|fea|feb)/i.test(host);
  if (privateHost && process.env.QA_ALLOW_PRIVATE_NETWORK !== 'true') throw new Error(`Private-network target blocked: ${host}. Set QA_ALLOW_PRIVATE_NETWORK=true only for trusted environments.`);
  return url;
}
