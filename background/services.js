// ============================================================
// QA STATE SERVICE LAYER (qaState)
// ============================================================
// Wraps the raw `appState` object with per-domain, intent-named APIs so modules
// (runner, handlers, cloud, ...) never touch the state shape directly. Every
// mutation funnels through qaState.commit() → saveState() + broadcastStateUpdate().
//
// Why: changing one system (e.g. copilot thread storage) must not ripple into
// other systems. If a module only talks to `qaState.copilot.*`, that contract is
// stable even when the internal `appState` shape evolves.
//
// NOTE: `appState` is a `let` reassigned wholesale on startup/cloud-restore, so
// all accessors read the live binding via getAppState() (never capture the
// object reference once).

function getAppState() {
  return appState;
}

// Keep `sessionSecrets` and execution control in sync with their raw siblings.
function syncSecrets() {
  sessionSecrets = { ...(getAppState().sessionSecrets || {}) };
}

const qaState = {
  // ---- generic helpers -----------------------------------------------------
  snapshot: () => JSON.parse(JSON.stringify(appState)),
  commit: (opts = {}) => {
    if (opts.syncSecrets) syncSecrets();
    saveState();
    broadcastStateUpdate();
  },
  resetExecutionControl: () => {
    executionControl = { runId: null, paused: false, cancelled: false };
  },

  // ---- suites & steps ------------------------------------------------------
  suites: {
    all: () => getAppState().suites,
    activeId: () => getAppState().activeSuiteId,
    active: () => getAppState().suites.find(s => s.id === getAppState().activeSuiteId) || null,
    activeSteps: () => {
      const suite = getAppState().suites.find(s => s.id === getAppState().activeSuiteId);
      return suite ? suite.steps : [];
    },
    get: (id) => getAppState().suites.find(s => s.id === id) || null,
    add: (suite) => {
      getAppState().suites.push(suite);
      getAppState().activeSuiteId = suite.id;
      getAppState().executionResults = {};
      qaState.commit();
    },
    remove: (id) => {
      const state = getAppState();
      state.suites = state.suites.filter(s => s.id !== id);
      if (!state.suites.length) {
        const def = createSuiteObject('Proyek QA Default');
        state.suites.push(def);
        state.activeSuiteId = def.id;
      } else if (state.activeSuiteId === id) {
        state.activeSuiteId = state.suites[0].id;
      }
      state.executionResults = {};
      qaState.commit();
    },
    setActive: (id) => {
      const state = getAppState();
      if (state.suites.some(s => s.id === id)) {
        state.activeSuiteId = id;
        state.executionResults = {};
      }
      qaState.commit();
    },
    update: (id, patch) => {
      const suite = getAppState().suites.find(s => s.id === id);
      if (suite) {
        Object.assign(suite, patch, { updatedAt: new Date().toISOString() });
        qaState.commit();
      }
      return suite;
    },
    setSteps: (steps) => {
      const suite = qaState.suites.active();
      if (suite) {
        suite.steps = (steps || []).map(normalizeStep);
        suite.updatedAt = new Date().toISOString();
        qaState.commit();
        broadcastToSidepanel({ action: 'STEPS_UPDATED', allSteps: suite.steps });
      }
    },
    appendSteps: (steps) => {
      const suite = qaState.suites.active();
      if (suite) {
        suite.steps = [...suite.steps, ...(steps || []).map(normalizeStep)];
        suite.updatedAt = new Date().toISOString();
        qaState.commit();
        broadcastToSidepanel({ action: 'STEPS_UPDATED', allSteps: suite.steps });
      }
    },
    clearSteps: () => {
      const suite = qaState.suites.active();
      if (suite) {
        suite.steps = [];
        suite.updatedAt = new Date().toISOString();
        getAppState().executionResults = {};
        qaState.commit();
        broadcastToSidepanel({ action: 'STEPS_UPDATED', allSteps: [], results: {} });
      }
    },
    pushRevision: (reason, suiteSnapshot) => {
      const state = getAppState();
      state.suiteRevisions.push({ id: `rev_${Date.now()}`, reason, suiteId: suiteSnapshot?.id, timestamp: new Date().toISOString(), suite: suiteSnapshot });
      state.suiteRevisions = state.suiteRevisions.slice(-25);
    },
    revisions: () => getAppState().suiteRevisions,
    pushAudit: (fields) => pushAuditEntry(fields)
  },

  // ---- execution -----------------------------------------------------------
  execution: {
    results: () => getAppState().executionResults,
    setResults: (results) => { getAppState().executionResults = results; },
    patchResults: (patch) => { Object.assign(getAppState().executionResults, patch); },
    control: () => executionControl,
    setControl: (control) => { executionControl = control; },
    history: () => getAppState().executionHistory,
    pushHistory: (entry) => {
      getAppState().executionHistory.unshift(entry);
      if (getAppState().executionHistory.length > 20) getAppState().executionHistory.pop();
    },
    clearHistory: () => {
      getAppState().executionHistory = [];
      getAppState().executionResults = { status: 'IDLE', totalSteps: 0, passedSteps: 0, failedSteps: 0, startTime: null, endTime: null, stepDetails: [] };
    },
    deleteHistoryItem: (id, index) => {
      if (id) getAppState().executionHistory = getAppState().executionHistory.filter(h => h.id !== id);
      else if (typeof index === 'number') getAppState().executionHistory.splice(index, 1);
    }
  },

  // ---- recording & monitor --------------------------------------------------
  recording: {
    isRecording: () => getAppState().isRecording === true,
    setRecording: (value) => { getAppState().isRecording = !!value; },
    activeTabId: () => getAppState().activeTabId,
    setActiveTab: (id) => { getAppState().activeTabId = id; },
    session: () => recordingSession,
    setSession: (session) => { recordingSession = session; },
    monitorStatus: () => getAppState().monitorStatus,
    setMonitorStatus: (status) => { getAppState().monitorStatus = status; },
    monitorOptions: () => getAppState().monitorOptions,
    setMonitorOptions: (options) => { getAppState().monitorOptions = options; }
  },

  // ---- logs ----------------------------------------------------------------
  logs: {
    all: () => getAppState().logs,
    push: (log) => { getAppState().logs.unshift(log); if (getAppState().logs.length > 300) getAppState().logs.pop(); },
    clear: () => { getAppState().logs = []; }
  },

  // ---- copilot --------------------------------------------------------------
  copilot: {
    threads: () => getAppState().copilotThreads || [],
    activeThreadId: () => getAppState().activeCopilotThreadId,
    setActiveThreadId: (id) => { getAppState().activeCopilotThreadId = id; },
    saveThread: (thread) => {
      const state = getAppState();
      if (!Array.isArray(state.copilotThreads)) state.copilotThreads = [];
      if (thread && thread.id) {
        const idx = state.copilotThreads.findIndex(t => t.id === thread.id);
        if (idx >= 0) state.copilotThreads[idx] = thread;
        else state.copilotThreads.unshift(thread);
        state.activeCopilotThreadId = thread.id;
      }
      return state.copilotThreads;
    },
    deleteThread: (threadId) => {
      const state = getAppState();
      if (Array.isArray(state.copilotThreads)) {
        state.copilotThreads = state.copilotThreads.filter(t => t.id !== threadId);
        if (state.activeCopilotThreadId === threadId) {
          state.activeCopilotThreadId = state.copilotThreads[0]?.id || null;
        }
      }
      return state.copilotThreads;
    },
    setThreads: (threads) => { getAppState().copilotThreads = threads; }
  },

  // ---- settings --------------------------------------------------------------
  settings: {
    ai: () => getAppState().aiSettings,
    setAi: (settings) => { getAppState().aiSettings = settings; },
    video: () => getAppState().videoSettings,
    setVideo: (settings) => { getAppState().videoSettings = settings; },
    runOptions: () => getAppState().runOptions,
    setRunOptions: (options) => { getAppState().runOptions = options; },
    secrets: () => getAppState().sessionSecrets || {},
    setSecrets: (secrets) => { getAppState().sessionSecrets = secrets || {}; syncSecrets(); }
  },

  // ---- data (environments & datasets) ----------------------------------------
  data: {
    environments: () => getAppState().environments || [],
    activeEnvironmentId: () => getAppState().activeEnvironmentId,
    setActiveEnvironment: (id) => {
      if (getAppState().environments.some(env => env.id === id)) getAppState().activeEnvironmentId = id;
    },
    saveEnvironment: (environment) => {
      const envs = getAppState().environments;
      const idx = envs.findIndex(env => env.id === environment.id);
      if (idx >= 0) envs[idx] = environment;
      else envs.push(environment);
      getAppState().activeEnvironmentId = environment.id;
      return environment;
    },
    datasets: () => getAppState().datasets || [],
    activeDatasetId: () => getAppState().activeDatasetId,
    activeDatasetRow: () => getAppState().activeDatasetRow,
    setActiveDataset: (id, row) => {
      getAppState().activeDatasetId = id || null;
      getAppState().activeDatasetRow = Math.max(0, parseInt(row, 10) || 0);
    },
    saveDataset: (dataset) => {
      const ds = getAppState().datasets;
      const idx = ds.findIndex(item => item.id === dataset.id);
      if (idx >= 0) ds[idx] = dataset;
      else ds.push(dataset);
      getAppState().activeDatasetId = dataset.id;
      getAppState().activeDatasetRow = 0;
      return dataset;
    }
  },

  // ---- QA artifacts (defects, sessions, signoffs, baselines) ------------------
  qa: {
    defects: () => getAppState().defects || [],
    setDefects: (defects) => { getAppState().defects = defects; },
    exploratorySessions: () => getAppState().exploratorySessions || [],
    releaseSignoffs: () => getAppState().releaseSignoffs || [],
    visualBaselines: () => getAppState().visualBaselines || {},
    setVisualBaseline: (stepId, dataUrl) => { getAppState().visualBaselines[stepId] = dataUrl; },
    selectorHealingHistory: () => getAppState().selectorHealingHistory || [],
    auditTrail: () => getAppState().auditTrail || []
  },

  // ---- network ---------------------------------------------------------------
  network: {
    status: () => getAppState().networkStatus,
    setStatus: (status) => { getAppState().networkStatus = status; }
  },

  // ---- video ---------------------------------------------------------------
  video: {
    history: () => getAppState().videoHistory || [],
    push: (entry) => {
      const state = getAppState();
      if (!state.videoHistory) state.videoHistory = [];
      state.videoHistory.unshift(entry);
      if (state.videoHistory.length > 50) state.videoHistory.pop();
    },
    clear: () => { getAppState().videoHistory = []; },
    set: (history) => { getAppState().videoHistory = history; }
  }
};
