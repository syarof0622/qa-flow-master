async function detectNetworkAndVPN() {
  const cacheAge = appState.networkStatus?.detectedAt ? Date.now() - new Date(appState.networkStatus.detectedAt).getTime() : Infinity;
  if (cacheAge < 15 * 60 * 1000) return appState.networkStatus;

  const vpnKeywords = [
    'vpn', 'proxy', 'm247', 'digitalocean', 'linode', 'aws', 'amazon', 'google cloud', 
    'azure', 'hosting', 'datacenter', 'expressvpn', 'nord', 'surfshark', 'ovh', 
    'choopa', 'vultr', 'wireguard', 'openvpn', 'cloud-vpn', 'zenmate', 'cyberghost', 'cloudflare'
  ];

  // Strategy 1: ipwho.is (HTTPS, CORS, Security VPN detection)
  try {
    const res = await fetchWithTimeout('https://ipwho.is/');
    if (res.ok) {
      const d = await res.json();
      if (d.success !== false && d.ip) {
        const ispStr = ((d.connection?.isp || d.connection?.org || d.org || '') + ' ' + (d.connection?.domain || '')).toLowerCase();
        const isVpn = d.security?.vpn || d.security?.proxy || vpnKeywords.some(kw => ispStr.includes(kw));
        return {
          ip: d.ip,
          country: d.country || 'Unknown',
          countryCode: d.country_code || '',
          city: d.city || 'Unknown',
          isp: d.connection?.isp || d.connection?.org || d.org || 'Internet Provider',
          isVpn: !!isVpn,
          detectedAt: new Date().toISOString()
        };
      }
    }
  } catch (err) {}

  // Strategy 2: ipify.org (Raw IP Fallback)
  // Trimmed from 5 third-party IP-lookup providers down to 2 (matches the
  // sidepanel's own direct-fetch fallback list) - fewer services the user's
  // IP gets sent to for what is only a cosmetic "network/VPN" badge.
  try {
    const res5 = await fetchWithTimeout('https://api64.ipify.org?format=json');
    if (res5.ok) {
      const d5 = await res5.json();
      if (d5.ip) {
        return {
          ip: d5.ip,
          country: 'Online',
          countryCode: '',
          city: 'Connected',
          isp: 'Public Network',
          isVpn: false,
          detectedAt: new Date().toISOString()
        };
      }
    }
  } catch (err) {}

  return {
    ip: 'Undetected',
    country: 'Unknown',
    countryCode: '',
    city: 'Unknown',
    isp: 'Unknown Provider',
    isVpn: false,
    detectedAt: new Date().toISOString()
  };
}

async function fetchWithTimeout(url, timeoutMs = 3500) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { cache: 'no-cache', signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}
