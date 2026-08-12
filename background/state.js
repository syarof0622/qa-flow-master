// ========================================
// STATE MANAGEMENT
// ========================================
let appState = {
  schemaVersion: 2,
  isRecording: false,
  activeTabId: null,
  activeSuiteId: null,
  suites: [],          // Array of TestSuite objects
  logs: [],
  executionHistory: [], // Array of past execution results (max 20)
  executionResults: {
    status: 'IDLE',
    totalSteps: 0,
    passedSteps: 0,
    failedSteps: 0,
    startTime: null,
    endTime: null,
    stepDetails: []
  },
  networkStatus: null,
  environments: [{ id: 'env_default', name: 'Default', baseUrl: '', variables: {} }],
  activeEnvironmentId: 'env_default',
  datasets: [],
  activeDatasetId: null,
  activeDatasetRow: 0,
  visualBaselines: {}
  ,auditTrail: [],
  suiteRevisions: []
  ,monitorStatus: { active: false, tabId: null, checkedAt: null, error: null }
  ,defects: []
  ,exploratorySessions: []
  ,releaseSignoffs: []
  ,selectorHealingHistory: []
  ,monitorOptions: { captureBodies: false }
  ,videoSettings: { autoRecord: false, uploadUrl: 'https://cloud.duniakuaja.my.id/qa-upload.php', apiKey: '' }
  ,videoHistory: []
  ,runOptions: { stopOnError: true, stepDelay: 500, autoRetryCount: 2 }
  ,aiSettings: { provider: 'gemini', apiKey: '' }
  ,copilotThreads: []
  ,activeCopilotThreadId: null
};
let sessionSecrets = {};
let runtimeVariables = {};
let executionControl = { runId: null, paused: false, cancelled: false };
let recordingSession = null;
const monitorControlTokens = new Map();

const SENSITIVE_LOG_KEY_RE = /(pass(word|wd)?|token|secret|authorization|api[-_]?key|cookie|session|credential|card|cvv|cvc|pin|otp)/i;

function redactLogData(value, key = '', seen = new WeakSet()) {
  if (SENSITIVE_LOG_KEY_RE.test(key)) return '[REDACTED]';
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object') return JSON.stringify(redactLogData(parsed));
    } catch (err) {}
    return value
      .replace(/(["']?(?:password|passwd|token|secret|authorization|api[-_]?key|cookie|cvv|cvc|otp)["']?\s*[:=]\s*)["']?([^\s,"'&}]+)/gi, '$1[REDACTED]')
      .replace(/(Bearer\s+)[A-Za-z0-9._~+\/-]+=*/gi, '$1[REDACTED]');
  }
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);
  if (Array.isArray(value)) return value.map(item => redactLogData(item, '', seen));
  return Object.fromEntries(Object.entries(value).map(([childKey, item]) => [childKey, redactLogData(item, childKey, seen)]));
}

// Redact credential-like values from Copilot threads before they are pushed to
// the cloud, so test credentials typed in chat prompts never land in Supabase.
function sanitizeCopilotThreadsForCloud(threads) {
  if (!Array.isArray(threads)) return threads;
  return threads.map(thread => {
    const safe = { ...thread };
    if (typeof safe.title === 'string') safe.title = redactLogData(safe.title);
    if (Array.isArray(safe.messages)) {
      safe.messages = safe.messages.map(msg => {
        const safeMsg = { ...msg };
        if (Array.isArray(msg.steps)) {
          safeMsg.steps = msg.steps.map(step => {
            const safeStep = { ...step };
            if (SENSITIVE_LOG_KEY_RE.test([step.selector, step.description, step.action].join(' '))) {
              if (safeStep.value) safeStep.value = '[REDACTED]';
              if (safeStep.originalRecordedValue) safeStep.originalRecordedValue = '[REDACTED]';
            }
            return safeStep;
          });
        }
        if (typeof safeMsg.text === 'string') safeMsg.text = redactLogData(safeMsg.text);
        if (typeof safeMsg.cleanReply === 'string') safeMsg.cleanReply = redactLogData(safeMsg.cleanReply);
        return safeMsg;
      });
    }
    return safe;
  });
}

// Helper: get active suite
function getActiveSuite() {
  return appState.suites.find(s => s.id === appState.activeSuiteId) || null;
}

function getActiveSuiteSteps() {
  const suite = getActiveSuite();
  return suite ? suite.steps : [];
}

function normalizeStep(step = {}) {
  const smart = step.smart && typeof step.smart === 'object' ? step.smart : {};
  return {
    id: step.id || `step_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    action: String(step.action || 'click'),
    selector: String(step.selector || ''),
    fallbackSelectors: Array.isArray(step.fallbackSelectors) ? [...new Set(step.fallbackSelectors.filter(Boolean).map(String))].slice(0, 8) : [],
    frame: step.frame && typeof step.frame === 'object' ? {
      url: String(step.frame.url || '').slice(0, 2000),
      name: String(step.frame.name || '').slice(0, 120),
      isTop: step.frame.isTop !== false,
      frameId: Math.max(0, Number(step.frame.frameId) || 0)
    } : null,
    value: String(step.value ?? ''),
    originalRecordedValue: String(step.originalRecordedValue ?? step.value ?? ''),
    description: String(step.description || ''),
    notes: String(step.notes || ''),
    group: String(step.group || ''),
    enabled: step.enabled !== false,
    timeout: Math.max(250, Math.min(60000, parseInt(step.timeout, 10) || 5000)),
    performanceThreshold: Math.max(100, Math.min(120000, parseInt(step.performanceThreshold, 10) || 3000)),
    requirementIds: Array.isArray(step.requirementIds) ? [...new Set(step.requirementIds.map(String).filter(Boolean))].slice(0, 30) : [],
    risk: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(step.risk) ? step.risk : 'MEDIUM',
    quarantined: Boolean(step.quarantined),
    breakpoint: Boolean(step.breakpoint),
    recordingIntent: step.recordingIntent && typeof step.recordingIntent === 'object' ? { kind: ['choice', 'toggle', 'commit'].includes(step.recordingIntent.kind) ? step.recordingIntent.kind : 'commit', group: String(step.recordingIntent.group || '').slice(0, 300) } : null,
    smart: {
      confidence: Math.max(0, Math.min(100, Number(smart.confidence) || 0)),
      autoWait: ['none', 'dom', 'url', 'network'].includes(smart.autoWait) ? smart.autoWait : 'none',
      assertionSuggestion: smart.assertionSuggestion && typeof smart.assertionSuggestion === 'object' ? {
        action: String(smart.assertionSuggestion.action || '').slice(0, 60),
        selector: String(smart.assertionSuggestion.selector || '').slice(0, 1000),
        value: String(smart.assertionSuggestion.value || '').slice(0, 3000),
        reason: String(smart.assertionSuggestion.reason || '').slice(0, 300)
      } : null,
      network: smart.network && typeof smart.network === 'object' ? {
        method: String(smart.network.method || '').slice(0, 12),
        status: Number(smart.network.status) || 0,
        url: String(smart.network.url || '').slice(0, 2000),
        durationMs: Number(smart.network.durationMs) || 0
      } : null,
      reviewStatus: ['pending', 'validated', 'failed'].includes(smart.reviewStatus) ? smart.reviewStatus : 'pending'
    },
    quarantineOwner: String(step.quarantineOwner || '').slice(0, 120),
    quarantineUntil: String(step.quarantineUntil || '').slice(0, 40),
    timestamp: step.timestamp || new Date().toISOString()
  };
}
function createSuiteObject(name, tags = []) {
  return {
    id: 'suite_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    name: name,
    tags: tags,
    requirements: [],
    steps: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function validateWorkspaceBackup(backup) {
  if (!backup || typeof backup !== 'object' || !Array.isArray(backup.suites) || !backup.suites.length) throw new Error('Backup workspace tidak valid.');
  let serialized;
  try { serialized = JSON.stringify(backup); } catch (error) { throw new Error('Backup tidak dapat diproses.'); }
  if (new TextEncoder().encode(serialized).length > 8 * 1024 * 1024) throw new Error('Backup melebihi batas 8 MB.');
  if (backup.suites.length > 50) throw new Error('Backup melebihi batas 50 proyek.');
  const suites = backup.suites.map((source, index) => {
    if (!source || typeof source !== 'object' || !Array.isArray(source.steps) || source.steps.length > 500) throw new Error(`Proyek ${index + 1} tidak valid atau melebihi 500 langkah.`);
    const suite = createSuiteObject(String(source.name || `Suite ${index + 1}`).slice(0, 120), Array.isArray(source.tags) ? source.tags.map(String).slice(0, 30) : []);
    suite.id = String(source.id || suite.id).slice(0, 160);
    suite.description = String(source.description || '').slice(0, 1000);
    suite.owner = String(source.owner || '').slice(0, 120);
    suite.priority = ['P0', 'P1', 'P2', 'P3'].includes(source.priority) ? source.priority : 'P1';
    suite.startUrl = String(source.startUrl || '').slice(0, 2000);
    suite.release = String(source.release || '').slice(0, 120);
    suite.requirements = Array.isArray(source.requirements) ? source.requirements.slice(0, 500).map(item => ({ id: String(item?.id || '').slice(0, 120), title: String(item?.title || '').slice(0, 300), risk: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(item?.risk) ? item.risk : 'MEDIUM' })).filter(item => item.id) : [];
    suite.beforeEach = Array.isArray(source.beforeEach) ? source.beforeEach.slice(0, 100).map(normalizeStep) : [];
    suite.steps = source.steps.map(normalizeStep);
    suite.afterEach = Array.isArray(source.afterEach) ? source.afterEach.slice(0, 100).map(normalizeStep) : [];
    suite.updatedAt = new Date().toISOString();
    return suite;
  });
  const environments = (Array.isArray(backup.environments) ? backup.environments : []).slice(0, 50).map((item, index) => ({ id: String(item?.id || `env_restore_${index}`).slice(0, 120), name: String(item?.name || 'Environment').slice(0, 80), baseUrl: String(item?.baseUrl || '').slice(0, 2000), variables: item?.variables && typeof item.variables === 'object' && !Array.isArray(item.variables) ? redactLogData(item.variables) : {} }));
  const datasets = (Array.isArray(backup.datasets) ? backup.datasets : []).slice(0, 50).map((item, index) => ({ id: String(item?.id || `dataset_restore_${index}`).slice(0, 120), name: String(item?.name || 'Dataset').slice(0, 80), rows: Array.isArray(item?.rows) ? item.rows.slice(0, 1000).map(row => row && typeof row === 'object' && !Array.isArray(row) ? redactLogData(row) : {}) : [] }));
  const visualBaselines = {};
  let baselineBytes = 0;
  for (const [id, value] of Object.entries(backup.visualBaselines && typeof backup.visualBaselines === 'object' ? backup.visualBaselines : {}).slice(0, 20)) {
    const candidate = String(value || '');
    if (!/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(candidate) || candidate.length > 2_500_000) continue;
    baselineBytes += candidate.length;
    if (baselineBytes <= 8_000_000) visualBaselines[String(id).slice(0, 200)] = candidate;
  }
  return { suites, environments, datasets, visualBaselines, defects: (Array.isArray(backup.defects) ? backup.defects : []).slice(0, 1000).map(item => redactLogData(item)), exploratorySessions: (Array.isArray(backup.exploratorySessions) ? backup.exploratorySessions : []).slice(0, 500).map(item => redactLogData(item)), releaseSignoffs: (Array.isArray(backup.releaseSignoffs) ? backup.releaseSignoffs : []).slice(0, 500).map(item => redactLogData(item)) };
}

function broadcastToSidepanel(message) {
  chrome.runtime.sendMessage(message, () => {
    // The side panel is optional and may not be open yet.
    void chrome.runtime.lastError;
  });
}

function broadcastStateUpdate() {
  broadcastToSidepanel({ action: 'STATE_CHANGED', data: appState });
  saveState();
}

let saveStateTimeout = null;
let supabaseSyncTimeout = null;
function saveState() {
  if (saveStateTimeout) clearTimeout(saveStateTimeout);
  saveStateTimeout = setTimeout(() => {
    chrome.storage.local.set({ appState }, () => {
      if (chrome.runtime.lastError) {
        // Most likely QUOTA_BYTES exceeded - surface it instead of silently losing writes.
        console.error('QA Flow: chrome.storage.local.set failed', chrome.runtime.lastError.message);
        broadcastToSidepanel({ action: 'STORAGE_WRITE_FAILED', data: { error: chrome.runtime.lastError.message } });
      }
    });

    // Cloud Sync Debounce (2 seconds)
    if (supabaseSyncTimeout) clearTimeout(supabaseSyncTimeout);
    supabaseSyncTimeout = setTimeout(() => {
      syncToSupabase(appState);
    }, 2000);
  }, 250);
}
