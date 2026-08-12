async function captureTabScreenshot() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    try { await chrome.tabs.sendMessage(tab.id, { action: 'APPLY_PRIVACY_MASK' }); } catch (error) {}
  }
  try {
    return await new Promise(resolve => chrome.tabs.captureVisibleTab(null, { format: 'png' }, dataUrl => resolve(chrome.runtime.lastError ? null : dataUrl)));
  } finally {
    if (tab?.id) try { await chrome.tabs.sendMessage(tab.id, { action: 'CLEAR_PRIVACY_MASK' }); } catch (error) {}
  }
}

async function ensureMonitorInjected(tabId, includeBridge = false, includeMonitor = true) {
  if (!tabId) throw new Error('Tab target tidak tersedia.');

  let bridgeNeeded = includeBridge;
  let monitorNeeded = includeMonitor;

  if (includeBridge) {
    const status = await sendCommandToTab(tabId, { action: 'RECORDER_STATUS' }, 0).catch(() => null);
    if (status?.status === 'SUCCESS') bridgeNeeded = false;
  }

  if (includeMonitor) {
    const monitorReady = await chrome.scripting.executeScript({
      target: { tabId }, world: 'MAIN',
      func: () => Boolean(window.__QA_MONITOR_INJECTED__)
    }).then(res => res[0]?.result).catch(() => false);
    if (monitorReady) monitorNeeded = false;
  }

  if (bridgeNeeded) {
    await executeScriptImmediately({
      target: { tabId, allFrames: true },
      files: ['data-generator.js', 'recorder-engine.js', 'content.js'],
      world: 'ISOLATED'
    });
  }
  if (monitorNeeded) {
    const controlToken = monitorControlTokens.get(tabId) || crypto.randomUUID().replace(/-/g, '');
    monitorControlTokens.set(tabId, controlToken);
    await executeScriptImmediately({
      target: { tabId, allFrames: true }, world: 'MAIN',
      func: (captureBodies, token) => {
        if (!window.__QA_MONITOR_INJECTED__) {
          window.__QFM_CAPTURE_BODIES_ONCE__ = captureBodies === true;
          window.__QFM_CONTROL_TOKEN_ONCE__ = token;
        } else {
          window.dispatchEvent(new CustomEvent(`__QFM_CONTROL_${token}`, { detail: { type: 'enable', captureBodies: captureBodies === true } }));
        }
      },
      args: [appState.monitorOptions?.captureBodies === true, controlToken]
    });
    await executeScriptImmediately({ target: { tabId, allFrames: true }, files: ['injected-monitor.js'], world: 'MAIN' });
  }
}

async function setMonitorControl(tabId, detail, frameId = null) {
  if (!tabId) throw new Error('Tab target tidak tersedia.');
  const token = monitorControlTokens.get(tabId);
  if (!token) throw new Error('Sesi monitor tidak ditemukan.');
  const target = Number.isInteger(frameId) ? { tabId, frameIds: [frameId] } : { tabId, allFrames: true };
  await chrome.scripting.executeScript({
    target,
    world: 'MAIN',
    injectImmediately: true,
    func: (eventName, control) => window.dispatchEvent(new CustomEvent(eventName, { detail: control })),
    args: [`__QFM_CONTROL_${token}`, detail]
  });
}

async function disableMonitor(tabId) {
  await setMonitorControl(tabId, { type: 'disable' });
  appState.monitorStatus = { active: false, tabId: tabId || null, checkedAt: new Date().toISOString(), error: null };
  saveState();
  broadcastToSidepanel({ action: 'MONITOR_STATUS_CHANGED', monitorStatus: appState.monitorStatus });
}

async function executeScriptImmediately(injection) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await Promise.race([
        chrome.scripting.executeScript({ ...injection, injectImmediately: true }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Injeksi recorder melewati batas waktu.')), 4000))
      ]);
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  throw lastError || new Error('Recorder tidak dapat diinjeksi ke halaman.');
}

function sendCommandToTab(tabId, message, frameId = null) {
  return new Promise((resolve, reject) => {
    const callback = (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response || { success: false, error: 'No response from content script' });
      }
    };
    if (Number.isInteger(frameId)) chrome.tabs.sendMessage(tabId, message, { frameId }, callback);
    else chrome.tabs.sendMessage(tabId, message, callback);
  });
}

async function sendCommandToAllFrames(tabId, message) {
  const frames = await chrome.webNavigation.getAllFrames({ tabId }).catch(() => [{ frameId: 0 }]);
  const results = await Promise.all((frames || [{ frameId: 0 }]).map(frame => sendCommandToTab(tabId, message, frame.frameId).catch(() => null)));
  return results.find(result => result?.status === 'SUCCESS') || null;
}

async function sendStepCommandToTab(tabId, step, message) {
  if (!step?.frame || step.frame.isTop !== false) return sendCommandToTab(tabId, message, 0);
  const frames = await chrome.webNavigation.getAllFrames({ tabId }).catch(() => []);
  const recordedUrl = String(step.frame.url || '');
  let recorded = null;
  try { recorded = recordedUrl ? new URL(recordedUrl) : null; } catch (error) {}
  const match = frames.find(frame => frame.frameId === step.frame.frameId && frame.frameId !== 0)
    || frames.find(frame => frame.frameId !== 0 && frame.url === recordedUrl)
    || frames.find(frame => {
      try {
        const current = new URL(frame.url);
        return recorded && current.origin === recorded.origin && current.pathname === recorded.pathname;
      } catch (error) { return false; }
    });
  if (!match) return { success: false, error: `Frame target tidak ditemukan: ${recordedUrl || step.frame.name || 'unknown'}` };
  return sendCommandToTab(tabId, message, match.frameId);
}

function notifyContentScript(tabId, message) {
  if (!tabId) return;
  chrome.tabs.sendMessage(tabId, message, () => {
    // The target may navigate or close before this optional notification arrives.
    void chrome.runtime.lastError;
  });
}
