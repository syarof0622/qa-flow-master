// sidepanel/ip-modal.js - IP & Geolocation modal + VPN status
// Extracted from sidepanel.js core (block 1). Runs in its own DOMContentLoaded
// scope; queries its own DOM refs and uses window.QAFlow for shared helpers.
document.addEventListener('DOMContentLoaded', () => {
  const ui = window.QAFlow.ui;
  if (!ui) return;
  const announce = window.QAFlow.announce;

  const qaGovernanceMenu = document.getElementById('qaGovernanceMenu');
  const bentoIpModal = document.getElementById('bentoIpModal');
  const btnCloseIpModal = document.getElementById('btnCloseIpModal');
  const btnCloseIpModalFooter = document.getElementById('btnCloseIpModalFooter');
  const btnCopyIpAddress = document.getElementById('btnCopyIpAddress');
  const btnRefreshVPN = document.getElementById('btnRefreshVPN');
  const vpnBadge = document.getElementById('vpnBadge');
  const vpnBadgeText = document.getElementById('vpnBadgeText');
  const vpnIp = document.getElementById('vpnIp');
  const vpnLocation = document.getElementById('vpnLocation');

  function fetchNetworkVPNStatus() {
    if (vpnBadgeText) vpnBadgeText.textContent = 'Scanning...';
    if (btnRefreshVPN) btnRefreshVPN.disabled = true;
    chrome.runtime.sendMessage({ action: 'GET_NETWORK_STATUS' }, async res => {
      const runtimeFailed = Boolean(chrome.runtime.lastError);
      const backgroundResult = res?.status === 'SUCCESS' && res.networkStatus?.ip !== 'Undetected' ? res.networkStatus : null;
      if (backgroundResult) {
        renderVPNStatus(backgroundResult);
        if (btnRefreshVPN) btnRefreshVPN.disabled = false;
        return;
      }

      try {
        const directResult = await fetchNetworkStatusDirect();
        renderVPNStatus(directResult);
      } catch (err) {
        if (vpnBadgeText) vpnBadgeText.textContent = 'Tidak tersedia';
        if (vpnIp) vpnIp.textContent = 'IP tidak dapat dibaca';
        if (vpnLocation) vpnLocation.textContent = runtimeFailed ? 'Reload extension lalu coba lagi' : 'Layanan jaringan sedang diblokir';
        ['vpnCountry', 'vpnCity', 'vpnIsp', 'vpnType'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '—'; });
      } finally {
        if (btnRefreshVPN) btnRefreshVPN.disabled = false;
      }
    });
  }

  async function fetchNetworkStatusDirect() {
    const endpoints = [
      {
        url: 'https://ipwho.is/',
        parse: data => data?.success !== false && data?.ip ? {
          ip: data.ip,
          country: data.country || 'Unknown',
          countryCode: data.country_code || '',
          city: data.city || 'Unknown',
          isp: data.connection?.isp || data.connection?.org || 'Internet Provider',
          isVpn: Boolean(data.security?.vpn || data.security?.proxy),
          detectedAt: new Date().toISOString()
        } : null
      },
      {
        url: 'https://api64.ipify.org?format=json',
        parse: data => data?.ip ? {
          ip: data.ip,
          country: 'Online',
          countryCode: '',
          city: 'Connected',
          isp: 'Public Network',
          isVpn: false,
          detectedAt: new Date().toISOString()
        } : null
      }
    ];

    for (const endpoint of endpoints) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(endpoint.url, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) continue;
        const parsed = endpoint.parse(await response.json());
        if (parsed) return parsed;
      } catch (err) {
        // Continue to the next provider.
      } finally {
        clearTimeout(timeoutId);
      }
    }
    throw new Error('Semua layanan IP tidak tersedia.');
  }

  function renderVPNStatus(net) {
    if (!vpnBadgeText || !vpnIp || !vpnLocation) return;
    const regionCode = String(net.countryCode || '').trim().toUpperCase();
    vpnIp.textContent = net.ip || 'IP tidak dapat dibaca';
    vpnLocation.textContent = net.city && net.country ? `${net.city}, ${net.country}` : (net.country || net.city || 'Memuat geolokasi...');

    if (net.isVpn) {
      vpnBadgeText.textContent = regionCode ? `VPN (${regionCode})` : 'VPN';
      vpnBadge?.classList.add('is-vpn');
    } else {
      vpnBadgeText.textContent = regionCode ? `Direct (${regionCode})` : 'Direct';
      vpnBadge?.classList.remove('is-vpn');
    }

    const fill = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value || '—'; };
    fill('vpnCountry', net.country || '—');
    fill('vpnCity', net.city || '—');
    fill('vpnIsp', net.isp || '—');
    fill('vpnType', net.isVpn ? 'VPN / Proxy' : 'Koneksi langsung');
  }

  document.getElementById('btnCheckIpInfo')?.addEventListener('click', () => {
    qaGovernanceMenu?.classList.add('hidden');
    bentoIpModal?.classList.remove('hidden');
    fetchNetworkVPNStatus();
  });

  btnCloseIpModal?.addEventListener('click', () => bentoIpModal?.classList.add('hidden'));
  btnCloseIpModalFooter?.addEventListener('click', () => bentoIpModal?.classList.add('hidden'));

  btnCopyIpAddress?.addEventListener('click', () => {
    const rawIpText = vpnIp?.textContent || '';
    const cleanIp = rawIpText.replace(/^IP:\s*/i, '').trim();
    if (cleanIp && cleanIp !== 'Memuat IP...' && cleanIp !== 'IP tidak dapat dibaca') {
      navigator.clipboard.writeText(cleanIp).then(() => {
        announce('IP Address berhasil disalin');
      });
    }
  });

  btnRefreshVPN?.addEventListener('click', fetchNetworkVPNStatus);
});
