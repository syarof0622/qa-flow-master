// background/handlers.js - QA Flow Master Pro message handler
// Extracted from background.js: per-action logic (switch). Loaded via importScripts.
// Relies on shared globals from state/cloud/injection/runner/network + QAContracts.

function qaHandleMessage(action, payload, sender, sendResponse) {
  switch (action) {
    case 'SAVE_VIDEO_SETTINGS':
      qaState.settings.setVideo({
        autoRecord: !!payload?.autoRecord,
        uploadUrl: payload?.uploadUrl || '',
        apiKey: payload?.apiKey || ''
      });
      saveState();
      broadcastStateUpdate();
      sendResponse({ status: 'SUCCESS' });
      break;

    case 'SAVE_AI_SETTINGS':
      // Real key goes only into the dedicated qa_ai_settings local key.
      // appState.aiSettings keeps provider/model metadata but never the key,
      // since appState is also the payload synced to Supabase.
      chrome.storage.local.set({
        qa_ai_settings: {
          provider: payload?.provider || 'deepseek',
          model: payload?.model || 'deepseek-chat',
          apiKey: payload?.apiKey || ''
        }
      });
      qaState.settings.setAi({
        provider: payload?.provider || 'deepseek',
        model: payload?.model || 'deepseek-chat',
        apiKey: ''
      });
      saveState();
      broadcastStateUpdate();
      sendResponse({ status: 'SUCCESS' });
      break;
      
    case 'ADD_VIDEO_HISTORY':
      qaState.video.push(payload.entry);
      saveState();
      broadcastStateUpdate();
      sendResponse({ status: 'SUCCESS' });
      break;

    case 'SYNC_COPILOT_THREADS':
      // Receive copilot threads from sidepanel and inject them into appState
      // so they can be seamlessly synced to Supabase.
      if (Array.isArray(payload?.threads)) {
        appState.copilotThreads = payload.threads;
        if (payload.activeId !== undefined) {
          appState.activeCopilotThreadId = payload.activeId;
        }
        // Force state save, which triggers the debounce for Supabase sync
        saveState();
      }
      sendResponse({ status: 'SUCCESS' });
      break;

    case 'GET_STATE':
      sendResponse({ status: 'SUCCESS', data: getAppState() });
      break;

    case 'CAPTURE_REPORT_SCREENSHOT':
      captureTabScreenshot()
        .then(screenshot => sendResponse({ status: screenshot ? 'SUCCESS' : 'ERROR', screenshot }))
        .catch(error => sendResponse({ status: 'ERROR', error: error.message }));
      return true;

    // --- SUITE MANAGEMENT (P0) ---
    case 'CREATE_SUITE': {
      const newSuite = createSuiteObject(payload.name, payload.tags || []);
      qaState.suites.add(newSuite);
      saveState();
      broadcastToSidepanel({ action: 'SUITES_UPDATED', suites: qaState.suites.all(), activeSuiteId: qaState.suites.activeId(), results: {} });
      sendResponse({ status: 'SUCCESS', suite: newSuite });
      break;
    }

    case 'SWITCH_SUITE': {
      const target = qaState.suites.get(payload.suiteId);
      if (target) {
        qaState.suites.setActive(payload.suiteId);
        saveState();
        broadcastToSidepanel({ action: 'SUITES_UPDATED', suites: qaState.suites.all(), activeSuiteId: qaState.suites.activeId(), results: {} });
      }
      sendResponse({ status: 'SUCCESS' });
      break;
    }

    case 'RENAME_SUITE': {
      const suite = qaState.suites.update(payload.suiteId, { name: payload.name });
      saveState();
      if (suite) broadcastToSidepanel({ action: 'SUITES_UPDATED', suites: qaState.suites.all(), activeSuiteId: qaState.suites.activeId() });
      sendResponse({ status: 'SUCCESS' });
      break;
    }

    case 'DUPLICATE_SUITE': {
      const src = qaState.suites.get(payload.suiteId);
      if (src) {
        const dup = createSuiteObject(src.name + ' (Salinan)', [...src.tags]);
        dup.steps = JSON.parse(JSON.stringify(src.steps));
        qaState.suites.add(dup);
        saveState();
        broadcastToSidepanel({ action: 'SUITES_UPDATED', suites: qaState.suites.all(), activeSuiteId: qaState.suites.activeId(), results: {} });
      }
      sendResponse({ status: 'SUCCESS' });
      break;
    }

    case 'DELETE_SUITE': {
      qaState.suites.remove(payload.suiteId);
      saveState();
      broadcastToSidepanel({ action: 'SUITES_UPDATED', suites: qaState.suites.all(), activeSuiteId: qaState.suites.activeId(), results: {} });
      sendResponse({ status: 'SUCCESS' });
      break;
    }

    case 'UPDATE_SUITE_TAGS': {
      const s = qaState.suites.update(payload.suiteId, { tags: payload.tags });
      saveState();
      if (s) broadcastToSidepanel({ action: 'SUITES_UPDATED', suites: qaState.suites.all(), activeSuiteId: qaState.suites.activeId() });
      sendResponse({ status: 'SUCCESS' });
      break;
    }

    case 'UPDATE_SUITE_METADATA': {
      const suite = qaState.suites.get(payload.suiteId);
      if (suite) {
        const metadata = payload.metadata || {};
        suite.owner = String(metadata.owner || '').slice(0, 120);
        suite.priority = ['P0', 'P1', 'P2', 'P3'].includes(metadata.priority) ? metadata.priority : 'P1';
        suite.tags = Array.isArray(metadata.tags) ? [...new Set(metadata.tags.map(String))].slice(0, 30) : [];
        suite.startUrl = String(metadata.startUrl || '').slice(0, 2000);
        suite.release = String(metadata.release || '').slice(0, 120);
        suite.requirements = Array.isArray(metadata.requirements) ? metadata.requirements.slice(0, 500).map(item => ({ id: String(item?.id || '').slice(0, 120), title: String(item?.title || '').slice(0, 300), risk: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(item?.risk) ? item.risk : 'MEDIUM' })).filter(item => item.id) : (suite.requirements || []);
        suite.updatedAt = new Date().toISOString();
        saveState();
        broadcastToSidepanel({ action: 'SUITES_UPDATED', suites: qaState.suites.all(), activeSuiteId: qaState.suites.activeId() });
      }
      sendResponse({ status: suite ? 'SUCCESS' : 'ERROR' });
      break;
    }

    case 'IMPORT_SUITE_DOCUMENT': {
      const targetSuite = getActiveSuite();
      const importedSuite = payload?.document?.suite || {};
      if (!targetSuite || !Array.isArray(importedSuite.steps)) {
        sendResponse({ status: 'ERROR', error: 'Dokumen suite tidak valid.' });
        break;
      }
      targetSuite.name = String(importedSuite.name || targetSuite.name).slice(0, 120);
      targetSuite.description = String(importedSuite.description || '').slice(0, 1000);
      targetSuite.owner = String(importedSuite.owner || '').slice(0, 120);
      targetSuite.priority = ['P0', 'P1', 'P2', 'P3'].includes(importedSuite.priority) ? importedSuite.priority : undefined;
      targetSuite.tags = Array.isArray(importedSuite.tags) ? [...new Set(importedSuite.tags.map(String))].slice(0, 30) : [];
      targetSuite.startUrl = String(importedSuite.startUrl || '').slice(0, 2000);
      targetSuite.release = String(importedSuite.release || '').slice(0, 120);
      targetSuite.requirements = Array.isArray(importedSuite.requirements) ? importedSuite.requirements.slice(0, 500) : [];
      targetSuite.beforeEach = Array.isArray(importedSuite.beforeEach) ? importedSuite.beforeEach.map(normalizeStep) : [];
      targetSuite.steps = importedSuite.steps.map(normalizeStep);
      targetSuite.afterEach = Array.isArray(importedSuite.afterEach) ? importedSuite.afterEach.map(normalizeStep) : [];
      targetSuite.flows = importedSuite.flows && typeof importedSuite.flows === 'object' ? Object.fromEntries(Object.entries(importedSuite.flows).map(([name, steps]) => [String(name).slice(0, 120), Array.isArray(steps) ? steps.map(normalizeStep) : []])) : {};
      targetSuite.updatedAt = new Date().toISOString();

      const importedEnvironment = payload.document.environment;
      if (importedEnvironment && typeof importedEnvironment === 'object') {
        const environment = {
          id: `env_${Date.now()}`,
          name: String(importedEnvironment.name || 'Imported').slice(0, 80),
          baseUrl: String(importedEnvironment.baseUrl || '').slice(0, 2000),
          variables: importedEnvironment.variables && typeof importedEnvironment.variables === 'object' ? importedEnvironment.variables : {}
        };
        qaState.data.environments().push(environment);
        appState.activeEnvironmentId = environment.id;
      }
      const importedDataset = payload.document.dataset;
      if (importedDataset && Array.isArray(importedDataset.rows) && importedDataset.rows.length) {
        const dataset = { id: `dataset_${Date.now()}`, name: String(importedDataset.name || 'Imported').slice(0, 80), rows: importedDataset.rows.slice(0, 1000) };
        qaState.data.datasets().push(dataset);
        qaState.data.setActiveDataset(dataset.id, 0);
      }
      if (Array.isArray(payload.document.defects)) qaState.qa.defects().push(...payload.document.defects.slice(0, 1000).map(item => ({ ...item, suiteId: targetSuite.id })));
      if (Array.isArray(payload.document.exploratorySessions)) qaState.qa.exploratorySessions().push(...payload.document.exploratorySessions.slice(0, 1000).map(item => ({ ...item, suiteId: targetSuite.id })));
      if (Array.isArray(payload.document.releaseSignoffs)) qaState.qa.releaseSignoffs().push(...payload.document.releaseSignoffs.slice(0, 1000).map(item => ({ ...item, suiteId: targetSuite.id })));
      appState.executionResults = {};
      saveState();
      broadcastStateUpdate();
      sendResponse({ status: 'SUCCESS', stepCount: targetSuite.steps.length });
      break;
    }

    // --- RECORDING ---
    case 'START_RECORDING':
      (async () => {
        const tabId = Number(payload?.tabId);
        const tab = await chrome.tabs.get(tabId);
        if (!/^https?:/i.test(tab?.url || '')) throw new Error('Recorder hanya dapat digunakan pada halaman HTTP atau HTTPS.');
        await ensureMonitorInjected(tabId, true);
        let response = null;
        for (let attempt = 0; attempt < 3 && response?.status !== 'SUCCESS'; attempt++) {
          response = await sendCommandToAllFrames(tabId, { action: 'TOGGLE_RECORDING', isRecording: true }).catch(() => null);
          if (response?.status !== 'SUCCESS') await new Promise(resolve => setTimeout(resolve, 200));
        }
        if (response?.status !== 'SUCCESS' || !response.isRecording) throw new Error('Recorder tidak merespons. Muat ulang halaman target.');
        qaState.recording.setRecording(true);
        qaState.recording.setActiveTab(tabId);
        const activeSuite = getActiveSuite();
        recordingSession = { id: `recording_${Date.now()}`, suiteId: activeSuite?.id || '', startIndex: activeSuite?.steps?.length || 0, startedAt: new Date().toISOString(), tabId };
        broadcastStateUpdate();
        sendResponse({ status: 'SUCCESS', tabId });
      })().catch(error => {
        qaState.recording.setRecording(false);
        broadcastStateUpdate();
        sendResponse({ status: 'ERROR', error: error.message });
      });
      return true;

    case 'STOP_RECORDING':
      (async () => {
        const tabId = qaState.recording.activeTabId();
        if (tabId) await sendCommandToAllFrames(tabId, { action: 'TOGGLE_RECORDING', isRecording: false }).catch(() => null);
        qaState.recording.setRecording(false);
        qaState.recording.setActiveTab(null);
        if (tabId) await disableMonitor(tabId).catch(() => null);
        qaState.recording.setMonitorStatus({ active: false, tabId, checkedAt: new Date().toISOString(), error: null });
        broadcastStateUpdate();
        const activeSuite = getActiveSuite();
        const endIndex = Math.max(-1, (activeSuite?.steps?.length || 0) - 1);
        const summary = recordingSession ? { ...recordingSession, endIndex, stepCount: Math.max(0, endIndex - recordingSession.startIndex + 1), endedAt: new Date().toISOString() } : null;
        recordingSession = null;
        sendResponse({ status: 'SUCCESS', recording: summary });
      })();
      return true;

    case 'RECORDED_STEP': {
      if (qaState.recording.isRecording()) {
        const activeSuite = getActiveSuite();
        if (activeSuite) {
          const normalizedStep = normalizeStep({ ...payload, frame: { ...(payload.frame || {}), frameId: sender.frameId || 0, isTop: (sender.frameId || 0) === 0 } });
          normalizedStep.smart.confidence = normalizedStep.smart.confidence || scoreRecordedStep(normalizedStep);
          const previous = activeSuite.steps.at(-1);
          const recent = previous && Date.now() - new Date(previous.timestamp || 0).getTime() < 5000;
          const replaceInput = recent && ['fill', 'select'].includes(normalizedStep.action) && previous.action === normalizedStep.action && previous.selector === normalizedStep.selector;
          const replaceChoice = recent && normalizedStep.recordingIntent?.kind === 'choice' && previous.recordingIntent?.kind === 'choice' && normalizedStep.recordingIntent.group && previous.recordingIntent.group === normalizedStep.recordingIntent.group;
          const cancelToggle = recent && normalizedStep.recordingIntent?.kind === 'toggle' && previous.recordingIntent?.kind === 'toggle' && previous.selector === normalizedStep.selector;
          if (cancelToggle) activeSuite.steps.pop();
          else if (replaceInput || replaceChoice) activeSuite.steps[activeSuite.steps.length - 1] = { ...normalizedStep, id: previous.id };
          else activeSuite.steps.push(normalizedStep);
          activeSuite.updatedAt = new Date().toISOString();
          saveState();
          broadcastToSidepanel({ action: cancelToggle ? 'STEPS_UPDATED' : 'STEP_ADDED', step: normalizedStep, allSteps: activeSuite.steps, smartCorrection: cancelToggle ? 'TOGGLE_CANCELLED' : replaceChoice ? 'CHOICE_REPLACED' : replaceInput ? 'INPUT_UPDATED' : null });
        }
      }
      sendResponse({ status: 'SUCCESS' });
      break;
    }

    case 'APPLY_MOCK_CONFIG':
      setMonitorControl(sender.tab?.id, { type: 'mock', config: payload || {} }, sender.frameId || 0)
        .then(() => sendResponse({ status: 'SUCCESS' }))
        .catch(error => sendResponse({ status: 'ERROR', error: error.message }));
      return true;

    case 'UPSERT_DEFECT': {
      const defect = payload?.defect || {};
      const normalized = { id: String(defect.id || `BUG-${Date.now()}`).slice(0, 120), suiteId: String(defect.suiteId || qaState.suites.activeId() || ''), requirementIds: Array.isArray(defect.requirementIds) ? defect.requirementIds.map(String).slice(0, 30) : [], title: String(defect.title || 'Untitled defect').slice(0, 300), severity: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(defect.severity) ? defect.severity : 'MEDIUM', status: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'WONT_FIX'].includes(defect.status) ? defect.status : 'OPEN', assignee: String(defect.assignee || '').slice(0, 120), evidence: Array.isArray(defect.evidence) ? defect.evidence.map(String).slice(0, 20) : [], updatedAt: new Date().toISOString(), createdAt: defect.createdAt || new Date().toISOString() };
      const defects = qaState.qa.defects();
      const defectIndex = defects.findIndex(item => item.id === normalized.id);
      if (defectIndex >= 0) defects[defectIndex] = normalized;
      else defects.unshift(normalized);
      broadcastStateUpdate();
      sendResponse({ status: 'SUCCESS', defect: normalized });
      break;
    }

    case 'ADD_EXPLORATORY_SESSION': {
      const session = payload?.session || {};
      const normalized = { id: String(session.id || `SESSION-${Date.now()}`).slice(0, 120), suiteId: String(session.suiteId || qaState.suites.activeId() || ''), charter: String(session.charter || '').slice(0, 1000), tester: String(session.tester || '').slice(0, 120), durationMinutes: Math.max(1, Math.min(1440, Number(session.durationMinutes) || 30)), notes: String(session.notes || '').slice(0, 5000), evidence: Array.isArray(session.evidence) ? session.evidence.map(String).slice(0, 20) : [], createdAt: new Date().toISOString() };
      if (!normalized.charter) { sendResponse({ status: 'ERROR', error: 'Charter wajib diisi.' }); break; }
      const sessions = qaState.qa.exploratorySessions();
      sessions.unshift(normalized);
      if (sessions.length > 100) sessions.length = 100;
      broadcastStateUpdate();
      sendResponse({ status: 'SUCCESS', session: normalized });
      break;
    }

    case 'CREATE_RELEASE_SIGNOFF': {
      const activeSuite = getActiveSuite();
      const request = payload?.signoff || {};
      const requirements = activeSuite?.requirements || [];
      const coveredIds = new Set((activeSuite?.steps || []).flatMap(step => step.requirementIds || []));
      const coverage = requirements.length ? Math.round(requirements.filter(item => coveredIds.has(item.id)).length / requirements.length * 100) : 0;
      const blockers = qaState.qa.defects().filter(item => item.suiteId === activeSuite?.id && ['OPEN', 'IN_PROGRESS'].includes(item.status) && ['CRITICAL', 'HIGH'].includes(item.severity));
      const lastRun = qaState.execution.history().find(item => item.suiteId === activeSuite?.id);
      const suiteRuns = qaState.execution.history().filter(item => item.suiteId === activeSuite?.id);
      const byStep = new Map();
      suiteRuns.flatMap(item => item.stepOutcomes || []).forEach(outcome => {
        const states = byStep.get(outcome.stepId) || new Set();
        states.add(outcome.status);
        byStep.set(outcome.stepId, states);
      });
      const flakyCount = [...byStep.values()].filter(states => states.has('FAILED') && [...states].some(state => state !== 'FAILED')).length;
      const criticalRuntimeIssues = qaState.logs.all().filter(log => log.severity === 'CRITICAL' || (log.type === 'network_error' && Number(log.details?.status || 0) >= 500)).length;
      const gates = { passingRun: lastRun?.status === 'COMPLETED' && !lastRun.failedSteps, coverage, blockerCount: blockers.length, flakyCount, slowCount: Number(lastRun?.slowSteps || 0), criticalRuntimeIssues };
      const gateFailed = !gates.passingRun || coverage < (Number(request.minimumCoverage) || 80) || blockers.length > 0 || flakyCount > (Number(request.maximumFlaky) || 0) || gates.slowCount > (Number(request.maximumSlow) || 0) || (request.requireCleanRuntime !== false && criticalRuntimeIssues > 0);
      if (request.approved && gateFailed && !String(request.overrideReason || '').trim()) { sendResponse({ status: 'ERROR', error: 'Quality gate gagal. Isi overrideReason untuk pengecualian yang dapat diaudit.', gates }); break; }
      const signoff = { id: `SIGNOFF-${Date.now()}`, suiteId: activeSuite?.id || '', release: String(request.release || activeSuite?.release || '').slice(0, 120), approver: String(request.approver || '').slice(0, 120), approved: Boolean(request.approved), thresholds: { minimumCoverage: Number(request.minimumCoverage) || 80, maximumFlaky: Number(request.maximumFlaky) || 0, maximumSlow: Number(request.maximumSlow) || 0, requireCleanRuntime: request.requireCleanRuntime !== false }, gates, overrideReason: String(request.overrideReason || '').slice(0, 1000), createdAt: new Date().toISOString() };
      const signoffs = qaState.qa.releaseSignoffs();
      signoffs.unshift(signoff);
      if (signoffs.length > 100) signoffs.length = 100;
      broadcastStateUpdate();
      sendResponse({ status: 'SUCCESS', signoff });
      break;
    }

    case 'UPDATE_STEPS': {
      qaState.suites.setSteps(payload.steps || []);
      sendResponse({ status: 'SUCCESS' });
      break;
    }

    case 'APPEND_STEPS': {
      qaState.suites.appendSteps(payload.steps || []);
      sendResponse({ status: 'SUCCESS', data: getAppState() });
      break;
    }

    case 'CLEAR_STEPS': {
      qaState.suites.clearSteps();
      sendResponse({ status: 'SUCCESS' });
      break;
    }

    // --- LOG MONITORING ---
    case 'PAGE_LOG_EVENT': {
      const logItem = {
        id: Date.now() + Math.random().toString(36).substr(2, 4),
        timestamp: new Date().toISOString(),
        type: payload.type,
        severity: classifyLogSeverity(payload.type, payload.details),
        message: redactLogData(payload.message),
        details: redactLogData(payload.details || {}),
        url: sender.tab?.url || payload.url || 'Unknown'
      };
      // Smart dedup: jika pesan identik sudah ada dalam 5 detik terakhir, increment counter
      const logs = qaState.logs.all();
      const recent = logs.find(l =>
        l.message === logItem.message &&
        l.type === logItem.type &&
        (new Date(logItem.timestamp) - new Date(l.timestamp)) < 5000
      );
      if (recent) {
        recent.count = (recent.count || 1) + 1;
        recent.timestamp = logItem.timestamp;
      } else {
        logItem.count = 1;
        qaState.logs.push(logItem);
      }
      if (qaState.logs.all().length > 300) qaState.logs.all().pop();
      if (qaState.recording.isRecording() && recordingSession && ['network_request', 'network_error', 'network_slow'].includes(logItem.type)) {
        const suite = getActiveSuite();
        const lastStep = suite?.steps?.at(-1);
        const age = lastStep ? Date.now() - new Date(lastStep.timestamp || 0).getTime() : Infinity;
        if (lastStep && lastStep.action === 'click' && age < 5000) {
          lastStep.smart = lastStep.smart || {};
          lastStep.smart.autoWait = 'network';
          lastStep.smart.network = { method: String(logItem.details?.method || 'GET'), status: Number(logItem.details?.status || 0), url: String(logItem.details?.url || ''), durationMs: Number(logItem.details?.durationMs || 0) };
          if (lastStep.smart.network.status) lastStep.smart.assertionSuggestion = { action: 'assert_network_status', selector: lastStep.smart.network.url, value: String(lastStep.smart.network.status), reason: 'Respons network terdeteksi setelah aksi' };
        }
      }
      saveState();
      broadcastToSidepanel({ action: 'NEW_LOG', log: recent || logItem, replaceExisting: Boolean(recent), totalLogs: qaState.logs.all().length });
      sendResponse({ status: 'SUCCESS' });
      break;
    }

    case 'MONITOR_STATUS':
      qaState.recording.setMonitorStatus({ active: Boolean(payload?.active), tabId: sender.tab?.id || null, checkedAt: new Date().toISOString(), error: payload?.error || null });
      saveState();
      broadcastToSidepanel({ action: 'MONITOR_STATUS_CHANGED', monitorStatus: qaState.recording.monitorStatus() });
      sendResponse({ status: 'SUCCESS' });
      break;

    case 'CLEAR_LOGS':
      qaState.logs.clear();
      saveState();
      broadcastToSidepanel({ action: 'LOGS_CLEARED' });
      sendResponse({ status: 'SUCCESS' });
      break;

    // --- EXECUTION ---
    case 'RUN_TEST_SUITE':
      ensureMonitorInjected(payload.tabId, true, true)
        .then(() => runTestSuite(payload.tabId, payload.delay || 500, payload.stopOnError ?? true, payload.autoRetryCount ?? 2, payload.scope || {}))
        .then(async result => { await disableMonitor(payload.tabId).catch(() => null); sendResponse({ status: 'SUCCESS', result }); })
        .catch(async err => { await disableMonitor(payload.tabId).catch(() => null); sendResponse({ status: 'ERROR', error: err.message }); });
      return true;

    // Run explicit steps (e.g. freshly generated Copilot test case) WITHOUT persisting
    // them to the active suite, so existing steps never constrain the run.
    case 'RUN_COPILOT_STEPS':
      if (!Array.isArray(payload.steps) || !payload.steps.length) { sendResponse({ status: 'ERROR', error: 'Tidak ada langkah tes untuk dijalankan.' }); break; }
      // Defense in depth: never trust the renderer alone. Re-validate step actions
      // against the shared contract, drop unknown actions, and clamp field lengths.
      const validatedCopilotSteps = payload.steps
        .filter(step => step && typeof step === 'object' && QAContracts.isSupportedStepAction(step.action))
        .slice(0, 200)
        .map(step => ({ ...step, value: String(step.value ?? '').slice(0, 5000), selector: String(step.selector ?? '').slice(0, 5000) }));
      if (!validatedCopilotSteps.length) { sendResponse({ status: 'ERROR', error: 'Tidak ada langkah tes yang valid untuk dijalankan.' }); break; }
      ensureMonitorInjected(payload.tabId, true, true)
        .then(() => runTestSuite(payload.tabId, payload.delay || 500, payload.stopOnError ?? true, payload.autoRetryCount ?? 2, payload.scope || {}, validatedCopilotSteps))
        .then(async result => { await disableMonitor(payload.tabId).catch(() => null); sendResponse({ status: 'SUCCESS', result }); })
        .catch(async err => { await disableMonitor(payload.tabId).catch(() => null); sendResponse({ status: 'ERROR', error: err.message }); });
      return true;

    case 'PAUSE_EXECUTION':
      if (qaState.execution.results().status !== 'RUNNING') { sendResponse({ status: 'ERROR', error: 'Tidak ada eksekusi aktif.' }); break; }
      qaState.execution.setControl({ ...qaState.execution.control(), paused: true });
      broadcastToSidepanel({ action: 'EXECUTION_CONTROL_CHANGED', control: { paused: true, cancelled: false } });
      sendResponse({ status: 'SUCCESS', paused: true });
      break;

    case 'RESUME_EXECUTION':
      qaState.execution.setControl({ ...qaState.execution.control(), paused: false });
      broadcastToSidepanel({ action: 'EXECUTION_CONTROL_CHANGED', control: { paused: false, cancelled: false } });
      sendResponse({ status: 'SUCCESS', paused: false });
      break;

    case 'STOP_EXECUTION':
      qaState.execution.setControl({ runId: qaState.execution.control().runId, paused: false, cancelled: true });
      broadcastToSidepanel({ action: 'EXECUTION_CONTROL_CHANGED', control: { paused: false, cancelled: true } });
      sendResponse({ status: 'SUCCESS', cancelled: true });
      break;

    case 'APPROVE_VISUAL_BASELINE': {
      const stepId = String(payload?.stepId || '');
      const candidate = String(payload?.candidate || '');
      if (!stepId || !candidate.startsWith('data:image/')) { sendResponse({ status: 'ERROR', error: 'Baseline candidate tidak valid.' }); break; }
      qaState.qa.setVisualBaseline(stepId, candidate);
      pushAuditEntry({ action: 'APPROVE_VISUAL_BASELINE', suiteId: qaState.suites.activeId(), stepId });
      saveState();
      sendResponse({ status: 'SUCCESS' });
      break;
    }

    case 'RESTORE_SUITE_REVISION': {
      const revisions = qaState.suites.revisions();
      const revision = revisions.find(item => item.id === payload?.revisionId && item.suiteId === qaState.suites.activeId());
      const suiteIndex = qaState.suites.all().findIndex(item => item.id === qaState.suites.activeId());
      if (!revision || suiteIndex < 0) { sendResponse({ status: 'ERROR', error: 'Revision tidak ditemukan.' }); break; }
      const currentSuite = qaState.suites.all()[suiteIndex];
      revisions.unshift({ id: `rev_${Date.now()}`, reason: 'BEFORE_RESTORE', suiteId: currentSuite.id, timestamp: new Date().toISOString(), suite: JSON.parse(JSON.stringify(currentSuite)) });
      qaState.suites.all()[suiteIndex] = { ...JSON.parse(JSON.stringify(revision.suite)), id: currentSuite.id, steps: (revision.suite.steps || []).map(normalizeStep), updatedAt: new Date().toISOString() };
      if (revisions.length > 25) revisions.length = 25;
      pushAuditEntry({ action: 'RESTORE_SUITE_REVISION', suiteId: currentSuite.id, revisionId: revision.id });
      saveState();
      broadcastStateUpdate();
      sendResponse({ status: 'SUCCESS' });
      break;
    }

    case 'RESTORE_WORKSPACE_BACKUP': {
      const backup = payload?.backup;
      let validated;
      try { validated = validateWorkspaceBackup(backup); } catch (error) { sendResponse({ status: 'ERROR', error: error.message }); break; }
      const suites = validated.suites;
      qaState.suites.all().length = 0;
      qaState.suites.all().push(...suites);
      appState.activeSuiteId = suites.some(item => item.id === backup.activeSuiteId) ? backup.activeSuiteId : suites[0].id;
      qaState.data.environments().length = 0;
      qaState.data.environments().push(...(validated.environments.length ? validated.environments : appState.environments));
      qaState.data.datasets().length = 0;
      qaState.data.datasets().push(...validated.datasets);
      qaState.qa.setDefects(validated.defects);
      appState.exploratorySessions = validated.exploratorySessions;
      appState.releaseSignoffs = validated.releaseSignoffs;
      const priorChainTail = qaState.qa.auditTrail().length ? qaState.qa.auditTrail()[qaState.qa.auditTrail().length - 1].hash : null;
      qaState.suites.revisions().length = 0;
      appState.auditTrail = [];
      appState.visualBaselines = validated.visualBaselines;
      appState.executionResults = { status: 'IDLE', totalSteps: 0, passedSteps: 0, failedSteps: 0, stepDetails: [] };
      pushAuditEntry({ action: 'RESTORE_WORKSPACE_BACKUP', suiteId: qaState.suites.activeId(), priorChainTail });
      saveState();
      broadcastStateUpdate();
      sendResponse({ status: 'SUCCESS', suiteCount: suites.length });
      break;
    }

    case 'SET_ACTIVE_ENVIRONMENT':
      qaState.data.setActiveEnvironment(payload.id);
      saveState();
      sendResponse({ status: 'SUCCESS' });
      break;

    case 'SAVE_ENVIRONMENT': {
      const environment = {
        id: payload.environment?.id || `env_${Date.now()}`,
        name: String(payload.environment?.name || 'Environment').slice(0, 80),
        baseUrl: String(payload.environment?.baseUrl || '').slice(0, 2000),
        variables: payload.environment?.variables && typeof payload.environment.variables === 'object' ? payload.environment.variables : {}
      };
      qaState.data.saveEnvironment(environment);
      saveState();
      broadcastStateUpdate();
      sendResponse({ status: 'SUCCESS', environment });
      break;
    }

    case 'SET_SESSION_SECRETS':
      qaState.settings.setSecrets(payload?.secrets && typeof payload.secrets === 'object' ? { ...payload.secrets } : {});
      saveState();
      sendResponse({ status: 'SUCCESS', count: Object.keys(sessionSecrets).length });
      break;

    case 'SAVE_RUN_OPTIONS':
      qaState.settings.setRunOptions({
        stopOnError: payload?.stopOnError !== false,
        stepDelay: Math.max(0, parseInt(payload?.stepDelay, 10) || 500),
        autoRetryCount: Math.max(0, parseInt(payload?.autoRetryCount, 10) || 2)
      });
      saveState();
      sendResponse({ status: 'SUCCESS', runOptions: qaState.settings.runOptions() });
      break;

    case 'SET_MONITOR_OPTIONS':
      qaState.recording.setMonitorOptions({ captureBodies: payload?.captureBodies === true });
      saveState();
      sendResponse({ status: 'SUCCESS', options: qaState.recording.monitorOptions() });
      break;

    case 'SAVE_COPILOT_THREAD': {
      const thread = payload.thread;
      if (thread && thread.id) {
        qaState.copilot.saveThread(thread);
        saveState();
        broadcastStateUpdate();
      }
      sendResponse({ status: 'SUCCESS', threads: qaState.copilot.threads() });
      break;
    }

    case 'DELETE_COPILOT_THREAD': {
      qaState.copilot.deleteThread(payload.threadId);
      saveState();
      broadcastStateUpdate();
      sendResponse({ status: 'SUCCESS', threads: qaState.copilot.threads() });
      break;
    }

    case 'SET_ACTIVE_COPILOT_THREAD': {
      qaState.copilot.setActiveThreadId(payload.threadId || null);
      saveState();
      sendResponse({ status: 'SUCCESS' });
      break;
    }

    case 'SAVE_DATASET': {
      const dataset = {
        id: payload.dataset?.id || `dataset_${Date.now()}`,
        name: String(payload.dataset?.name || 'Dataset').slice(0, 80),
        rows: Array.isArray(payload.dataset?.rows) ? payload.dataset.rows.slice(0, 20000).map(row => row && typeof row === 'object' ? row : {}) : []
      };
      qaState.data.saveDataset(dataset);
      saveState();
      broadcastStateUpdate();
      sendResponse({ status: 'SUCCESS', dataset });
      break;
    }

    case 'SET_ACTIVE_DATASET':
      qaState.data.setActiveDataset(payload?.id || null, payload?.row);
      saveState();
      sendResponse({ status: 'SUCCESS' });
      break;

    case 'GET_EXECUTION_HISTORY':
      sendResponse({ status: 'SUCCESS', history: qaState.execution.history() });
      break;

    case 'CLEAR_EXECUTION_HISTORY':
      qaState.execution.clearHistory();
      saveState();
      broadcastStateUpdate();
      sendResponse({ status: 'SUCCESS' });
      break;

    case 'CLEAR_VIDEO_HISTORY':
      qaState.video.clear();
      saveState();
      broadcastStateUpdate();
      sendResponse({ status: 'SUCCESS' });
      break;

    case 'DELETE_EXECUTION_HISTORY_ITEM':
      qaState.execution.deleteHistoryItem(payload?.id, payload?.index);
      saveState();
      sendResponse({ status: 'SUCCESS', history: qaState.execution.history() });
      break;

    case 'GET_NETWORK_STATUS':
      detectNetworkAndVPN()
        .then(netInfo => {
          qaState.network.setStatus(netInfo);
          saveState();
          sendResponse({ status: 'SUCCESS', networkStatus: netInfo });
        })
        .catch(err => sendResponse({ status: 'ERROR', error: err.message }));
      return true;

    case 'ENSURE_MONITOR_INJECTED':
      // Compute the "is this a content-script sender?" flag locally — the router's
      // local const is not in scope here (background.js owns the message listener).
      {
        const senderIsContentScript = Boolean(sender?.tab) && typeof sender?.url === 'string' && !sender.url.startsWith(chrome.runtime.getURL(''));
        ensureMonitorInjected(payload?.tabId || sender.tab?.id, !senderIsContentScript, payload?.recorderOnly !== true)
          .then(async () => {
            const tabId = payload?.tabId || sender.tab?.id;
            const recorder = await sendCommandToTab(tabId, { action: 'RECORDER_STATUS' }, 0).catch(() => null);
            sendResponse({ status: 'SUCCESS', ready: Boolean(recorder?.ready), recorder });
          })
          .catch(err => sendResponse({ status: 'ERROR', error: err.message }));
      }
      return true;

    case 'STOP_MONITOR':
      disableMonitor(payload?.tabId)
        .then(() => sendResponse({ status: 'SUCCESS' }))
        .catch(error => sendResponse({ status: 'ERROR', error: error.message }));
      return true;

    default:
      sendResponse({ status: 'UNKNOWN_ACTION' });
  }
  return true;
}
