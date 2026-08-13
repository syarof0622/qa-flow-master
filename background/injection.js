function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000; // 32768 bytes
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function captureTabScreenshot(targetTabId, options = { highQuality: false }) {
  let targetTab = null;
  let windowId = null;

  if (targetTabId) {
    try {
      targetTab = await chrome.tabs.get(targetTabId);
      if (targetTab && !targetTab.active) {
        await chrome.tabs.update(targetTabId, { active: true });
        // Give the browser a moment to paint the activated tab
        await new Promise(r => setTimeout(r, 150));
      }
      windowId = targetTab ? targetTab.windowId : null;
    } catch (e) {
      // Fallback to active tab if get fails
    }
  }

  if (!targetTab) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    targetTab = tabs[0];
  }
  
  if (targetTab?.id) {
    try { await chrome.tabs.sendMessage(targetTab.id, { action: 'APPLY_PRIVACY_MASK' }); } catch (error) {}
  }
  
  let dataUrl = null;
  try {
    // If high quality is needed (Visual Assertion), use PNG to avoid compression artifacts that break pixel matching
    if (options.highQuality) {
      dataUrl = await new Promise(resolve => chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, res => resolve(chrome.runtime.lastError ? null : res)));
    } else {
      // Capture as JPEG initially for speed
      dataUrl = await new Promise(resolve => chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 80 }, res => resolve(chrome.runtime.lastError ? null : res)));
    }
  } finally {
    if (targetTab?.id) try { await chrome.tabs.sendMessage(targetTab.id, { action: 'CLEAR_PRIVACY_MASK' }); } catch (error) {}
  }

  if (!dataUrl || options.highQuality) {
    return dataUrl;
  }

  // Convert to highly compressed WebP via OffscreenCanvas for max evidence efficiency
  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.drawImage(bitmap, 0, 0);
    const webpBlob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.5 });
    const buffer = await webpBlob.arrayBuffer();
    return `data:image/webp;base64,${arrayBufferToBase64(buffer)}`;
  } catch (e) {
    return dataUrl; // fallback if conversion fails
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
      args: [qaState.recording.monitorOptions()?.captureBodies === true, controlToken]
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
  const status = { active: false, tabId: tabId || null, checkedAt: new Date().toISOString(), error: null };
  qaState.recording.setMonitorStatus(status);
  saveState();
  broadcastToSidepanel({ action: 'MONITOR_STATUS_CHANGED', monitorStatus: status });
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
