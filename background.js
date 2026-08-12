// background.js - QA Flow Master Pro v4.2 Service Worker (ROUTER)
// Modular entry: loads per-domain modules via importScripts, then wires the
// message router, lifecycle listeners, keyboard shortcuts, and init.
//
// Module layout (all share the worker global scope via importScripts):
//   background/state.js      - appState, redaction, suite helpers, save/broadcast
//   background/services.js   - qaState service layer (per-domain state API)
//   background/cloud.js      - Supabase sync/fetch, workspace id, audit trail
//   background/injection.js  - monitor injection, tab messaging, screenshots
//   background/runner.js     - test-suite runner, assertions, API, secure fetch
//   background/network.js    - VPN / network geolocation detector
//   background/handlers.js   - per-action message logic (qaHandleMessage)
//
// Fixing one system (e.g. runner) now only touches its module, not the router.

importScripts('shared/contracts.js');
importScripts(
  'background/state.js',
  'background/services.js',
  'background/cloud.js',
  'background/injection.js',
  'background/runner.js',
  'background/network.js',
  'background/handlers.js'
);

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// ========================================
// INITIALIZATION
// ========================================
chrome.runtime.onInstalled.addListener(() => {
  console.log("QA Flow Master Pro v4.2 installed.");
  chrome.storage.local.get('appState', (data) => {
    if (!data.appState || !data.appState.suites || !data.appState.suites.length) {
      const defaultSuite = createSuiteObject('Proyek QA Default');
      appState.suites = [defaultSuite];
      appState.activeSuiteId = defaultSuite.id;
      saveState();
    }
  });
});

// Restore state on startup
chrome.storage.local.get('appState', (data) => {
  if (data.appState) {
    appState = { ...appState, ...data.appState };
    // Ensure suites array exists (backward compat)
    if (!appState.suites || !appState.suites.length) {
      const defaultSuite = createSuiteObject('Proyek QA Default');
      // Migrate old testSteps if any
      if (appState.testSteps && appState.testSteps.length) {
        defaultSuite.steps = appState.testSteps;
      }
      appState.suites = [defaultSuite];
      appState.activeSuiteId = defaultSuite.id;
    }
    if (!appState.executionHistory) appState.executionHistory = [];
    appState.schemaVersion = 2;
    appState.environments = Array.isArray(appState.environments) && appState.environments.length ? appState.environments : [{ id: 'env_default', name: 'Default', baseUrl: '', variables: {} }];
    appState.activeEnvironmentId = appState.activeEnvironmentId || appState.environments[0].id;
    appState.datasets = Array.isArray(appState.datasets) ? appState.datasets : [];
    appState.activeDatasetId = appState.activeDatasetId || null;
    appState.activeDatasetRow = Math.max(0, parseInt(appState.activeDatasetRow, 10) || 0);
    appState.visualBaselines = appState.visualBaselines && typeof appState.visualBaselines === 'object' ? appState.visualBaselines : {};
    appState.auditTrail = Array.isArray(appState.auditTrail) ? appState.auditTrail : [];
    appState.suiteRevisions = Array.isArray(appState.suiteRevisions) ? appState.suiteRevisions : [];
    appState.monitorStatus = appState.monitorStatus && typeof appState.monitorStatus === 'object' ? appState.monitorStatus : { active: false, tabId: null, checkedAt: null, error: null };
    appState.defects = Array.isArray(appState.defects) ? appState.defects : [];
    appState.exploratorySessions = Array.isArray(appState.exploratorySessions) ? appState.exploratorySessions : [];
    appState.releaseSignoffs = Array.isArray(appState.releaseSignoffs) ? appState.releaseSignoffs : [];
    appState.selectorHealingHistory = Array.isArray(appState.selectorHealingHistory) ? appState.selectorHealingHistory : [];
    appState.monitorOptions = { captureBodies: appState.monitorOptions?.captureBodies === true };
    // Preserve video settings from storage, falling back to pre-configured domain defaults
    appState.videoSettings = {
      autoRecord: appState.videoSettings?.autoRecord === true,
      uploadUrl: appState.videoSettings?.uploadUrl || 'https://cloud.duniakuaja.my.id/qa-upload.php',
      // No baked-in default key: a secret shipped inside a distributed extension
      // is not a secret. The user must paste their own key in Settings.
      apiKey: appState.videoSettings?.apiKey || ''
    };
    // The AI provider key lives only in the dedicated `qa_ai_settings` local
    // storage key (read directly by the sidepanel) - never duplicated inside
    // `appState`, since `appState` is also what gets synced to Supabase.
    if (data.appState.aiSettings?.apiKey) {
      // One-time migration for installs upgrading from a version that stored
      // the key here: move it over, then let it drop out of appState.
      chrome.storage.local.get('qa_ai_settings', (store) => {
        if (!store?.qa_ai_settings?.apiKey) {
          chrome.storage.local.set({
            qa_ai_settings: {
              provider: data.appState.aiSettings.provider || 'gemini',
              apiKey: data.appState.aiSettings.apiKey
            }
          });
        }
      });
    }
    appState.aiSettings = {
      provider: appState.aiSettings?.provider || 'gemini',
      apiKey: ''
    };
    appState.sessionSecrets = appState.sessionSecrets && typeof appState.sessionSecrets === 'object' ? appState.sessionSecrets : {};
    sessionSecrets = { ...appState.sessionSecrets };
    appState.runOptions = {
      stopOnError: appState.runOptions?.stopOnError !== false,
      stepDelay: Math.max(0, parseInt(appState.runOptions?.stepDelay, 10) || 500),
      autoRetryCount: Math.max(0, parseInt(appState.runOptions?.autoRetryCount, 10) || 2)
    };
    appState.suites.forEach(suite => { suite.steps = (suite.steps || []).map(normalizeStep); });
    appState.logs = (appState.logs || []).map(log => redactLogData(log));
    broadcastStateUpdate();
    saveState();
  } else {
    // If no local state, we still want to pull from cloud
    fetchFromSupabase();
  }
  
  // Pull from Cloud after local restore
  fetchFromSupabase();
});

// ========================================
// PAGE NAVIGATION AUTO-REINJECT (P0 Fix)
// ========================================
chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId !== 0) return; // Only main frame
  const tabId = details.tabId;

  // Reconnect both recorder bridge and monitor after navigation.
  if (appState.isRecording && appState.activeTabId === tabId) {
    ensureMonitorInjected(tabId, true)
      .then(() => sendCommandToAllFrames(tabId, { action: 'TOGGLE_RECORDING', isRecording: true }))
      .catch(error => broadcastToSidepanel({ action: 'RECORDING_ERROR', error: error.message }));
  }
});

// ========================================
// KEYBOARD SHORTCUTS (P3)
// ========================================
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  if (command === 'toggle-recording') {
    if (!appState.isRecording) {
      if (!/^https?:/i.test(tab.url || '')) return;
      try {
        await ensureMonitorInjected(tab.id, true, true);
        const response = await sendCommandToAllFrames(tab.id, { action: 'TOGGLE_RECORDING', isRecording: true });
        if (response?.status !== 'SUCCESS' || !response.isRecording) throw new Error('Recorder tidak merespons.');
        appState.isRecording = true;
        appState.activeTabId = tab.id;
        const activeSuite = getActiveSuite();
        recordingSession = { id: `recording_${Date.now()}`, suiteId: activeSuite?.id || '', startIndex: activeSuite?.steps?.length || 0, startedAt: new Date().toISOString(), tabId: tab.id };
      } catch (error) {
        appState.isRecording = false;
        broadcastToSidepanel({ action: 'RECORDING_ERROR', error: error.message });
      }
    } else {
      const recordingTabId = appState.activeTabId || tab.id;
      await sendCommandToAllFrames(recordingTabId, { action: 'TOGGLE_RECORDING', isRecording: false }).catch(() => null);
      await disableMonitor(recordingTabId).catch(() => null);
      appState.isRecording = false;
      appState.activeTabId = null;
      recordingSession = null;
    }
    broadcastStateUpdate();
  } else if (command === 'run-test-suite') {
    const steps = getActiveSuiteSteps();
    if (steps.length) {
      try {
        await ensureMonitorInjected(tab.id, true, true);
        await runTestSuite(tab.id, 500, true);
      } finally {
        await disableMonitor(tab.id).catch(() => null);
      }
    }
  }
});

// ========================================
// MESSAGE ROUTER (validation + gating + dispatch to qaHandleMessage)
// ========================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const contract = QAContracts.validateMessage(message);
  if (!contract.valid) { sendResponse({ status: 'INVALID_MESSAGE', error: contract.error }); return false; }
  const { action, payload } = message;
  const contentActions = new Set(['APPLY_MOCK_CONFIG', 'PAGE_LOG_EVENT', 'MONITOR_STATUS', 'RECORDED_STEP']);
  const isExtensionPage = typeof sender.url === 'string' && sender.url.startsWith(chrome.runtime.getURL(''));
  const isContentScript = Boolean(sender.tab) && !isExtensionPage;
  if (isContentScript && !contentActions.has(action)) { sendResponse({ status: 'FORBIDDEN', error: 'Action tidak diizinkan dari content script.' }); return false; }
  if (!isContentScript && contentActions.has(action)) { sendResponse({ status: 'FORBIDDEN', error: 'Action membutuhkan konteks tab.' }); return false; }
  if (QAContracts.mutationActions.has(action)) {
    const suite = getActiveSuite();
    pushAuditEntry({ action, suiteId: suite?.id || null });
    if (suite && ['UPDATE_STEPS','CLEAR_STEPS','IMPORT_SUITE_DOCUMENT'].includes(action)) appState.suiteRevisions.push({ id: `rev_${Date.now()}`, reason: action, suiteId: suite.id, timestamp: new Date().toISOString(), suite: JSON.parse(JSON.stringify(suite)) });
    appState.suiteRevisions = appState.suiteRevisions.slice(-25);
  }

  return qaHandleMessage(action, payload, sender, sendResponse);
});
