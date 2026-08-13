// sidepanel.js - QA Flow Master Pro v4.1 Controller
// Features: Multi-Suite UI (P0), Execution History (P1), Severity Badges (P2), Step Notes (P2), Performance Threshold

document.addEventListener('DOMContentLoaded', async () => {
  let currentState = {
    isRecording: false,
    activeSuiteId: null,
    suites: [],
    logs: [],
    executionHistory: [],
    videoHistory: [],
    executionResults: {}
  };
  let activeFilter = 'ALL';
  let logSearchTerm = '';
  let networkMethodFilter = 'ALL';
  let activeTabUrl = '';
  let activeTabId = null;
  let recorderReadiness = 'checking';

  // ========================================
  // DOM REFERENCES
  // ========================================
  const tabBtns = document.querySelectorAll('.bento-tab-btn, .tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const suiteSelector = document.getElementById('suiteSelector');
  const btnNewSuite = document.getElementById('btnNewSuite');
  const btnDupSuite = document.getElementById('btnDupSuite');
  const btnRenameSuite = document.getElementById('btnRenameSuite');
  const btnSuiteSettings = document.getElementById('btnSuiteSettings');
  const btnDeleteSuite = document.getElementById('btnDeleteSuite');
  const btnRecord = document.getElementById('btnRecord');
  const btnRecordText = document.getElementById('btnRecordText');
  const btnRunSuite = document.getElementById('btnRunSuite');
  const btnClearSteps = document.getElementById('btnClearSteps');
  const stepCountEl = document.getElementById('stepCount');
  const stepListEl = document.getElementById('stepList');
  const stepDelayInput = document.getElementById('stepDelayInput');
  const stopOnErrorCheck = document.getElementById('stopOnErrorCheck');
  const recordVideoCheck = document.getElementById('recordVideoCheck');
  // Helper to read toggle button state
  const isPressed = (btn) => btn?.getAttribute('aria-pressed') === 'true';
  // Wire toggle behavior for icon-only toggle buttons
  const saveRunOptions = () => {
    chrome.runtime.sendMessage({
      action: 'SAVE_RUN_OPTIONS',
      payload: {
        stopOnError: isPressed(stopOnErrorCheck),
        stepDelay: parseInt(stepDelayInput?.value || '500', 10),
        autoRetryCount: parseInt(document.getElementById('autoRetrySelect')?.value || '2', 10)
      }
    });
  };

  stopOnErrorCheck?.addEventListener('click', () => {
    const next = !isPressed(stopOnErrorCheck);
    stopOnErrorCheck.setAttribute('aria-pressed', String(next));
    saveRunOptions();
  });
  stepDelayInput?.addEventListener('change', saveRunOptions);
  document.getElementById('autoRetrySelect')?.addEventListener('change', saveRunOptions);

  recordVideoCheck?.addEventListener('click', () => {
    const next = !isPressed(recordVideoCheck);
    recordVideoCheck.setAttribute('aria-pressed', String(next));
    // Notify background of change
    chrome.runtime.sendMessage({ action: 'GET_STATE' }, (res) => {
      const settings = res?.data?.videoSettings || {};
      chrome.runtime.sendMessage({
        action: 'SAVE_VIDEO_SETTINGS',
        payload: { autoRecord: next, uploadUrl: settings.uploadUrl || '', apiKey: settings.apiKey || '' }
      });
    });
  });
  const btnA11yAudit = document.getElementById('btnA11yAudit');
  const btnClearStorage = document.getElementById('btnClearStorage');
  const btnToggleAddManual = document.getElementById('btnToggleAddManual');
  const manualStepForm = document.getElementById('manualStepForm');
  const btnCancelManual = document.getElementById('btnCancelManual');
  const manualAction = document.getElementById('manualAction');
  const manualSelector = document.getElementById('manualSelector');
  const manualValue = document.getElementById('manualValue');
  const manualNotes = document.getElementById('manualNotes');
  const manualGroup = document.getElementById('manualGroup');
  const manualTimeout = document.getElementById('manualTimeout');
  const manualRequirementIds = document.getElementById('manualRequirementIds');
  const manualRequirementOptions = document.getElementById('manualRequirementOptions');
  const manualRisk = document.getElementById('manualRisk');
  const executionBanner = document.getElementById('executionBanner');
  const bannerText = document.getElementById('bannerText');
  const bannerDetail = document.getElementById('bannerDetail');
  const bannerIcon = document.getElementById('bannerIcon');
  const btnDismissBanner = document.getElementById('btnDismissBanner');
  const btnPauseExecution = document.getElementById('btnPauseExecution');
  const btnStopExecution = document.getElementById('btnStopExecution');
  const progressBar = document.getElementById('progressBar');
  const logBadgeCount = document.getElementById('logBadgeCount');
  const logListEl = document.getElementById('logList');
  const btnClearLogs = document.getElementById('btnClearLogs');
  const btnCopyLogs = document.getElementById('btnCopyLogs');
  const logSearchInput = document.getElementById('logSearchInput');
  const filterBtns = document.querySelectorAll('.filter-btn');
  const networkFilterBar = document.getElementById('networkFilterBar');
  const networkFilterBtns = document.querySelectorAll('.network-filter-btn[data-network-method]');
  const btnToggleNetworkAdvanced = document.getElementById('btnToggleNetworkAdvanced');
  const networkAdvancedFilters = document.getElementById('networkAdvancedFilters');
  const networkStatusFilter = document.getElementById('networkStatusFilter');
  const networkTypeFilter = document.getElementById('networkTypeFilter');
  const networkDomainFilter = document.getElementById('networkDomainFilter');
  const networkSlowFilter = document.getElementById('networkSlowFilter');
  const networkBodyCaptureCheck = document.getElementById('networkBodyCaptureCheck');
  const sumTotalSteps = document.getElementById('sumTotalSteps');
  const sumPassedSteps = document.getElementById('sumPassedSteps');
  const sumFailedSteps = document.getElementById('sumFailedSteps');
  const sumStatus = document.getElementById('sumStatus');
  const executionHistoryList = document.getElementById('executionHistoryList');
  const qualityInsights = document.getElementById('qualityInsights');
  const qaReadiness = document.getElementById('qaReadiness');
  const monitorStatus = document.getElementById('monitorStatus');
  const monitorStatusText = document.getElementById('monitorStatusText');
  const btnTestMonitor = document.getElementById('btnTestMonitor');
  const btnAddDefect = document.getElementById('btnAddDefect');
  const btnRequirements = document.getElementById('btnRequirements');
  const btnDefectBoard = document.getElementById('btnDefectBoard');
  const btnAddExploration = document.getElementById('btnAddExploration');
  const btnReleaseSignoff = document.getElementById('btnReleaseSignoff');
  const btnSuiteVersions = document.getElementById('btnSuiteVersions');
  const btnWorkspaceBackup = document.getElementById('btnWorkspaceBackup');
  const btnQaGovernanceMenu = document.getElementById('btnQaGovernanceMenu');
  const qaGovernanceMenu = document.getElementById('qaGovernanceMenu');
  const btnClearHistory = document.getElementById('btnClearHistory');
  const btnClearVideoHistory = document.getElementById('btnClearVideoHistory');
  const btnDownloadReportHTML = document.getElementById('btnDownloadReportHTML');
  const btnExportPlaywright = document.getElementById('btnExportPlaywright');
  const btnExportCypress = document.getElementById('btnExportCypress');
  const btnExportJSON = document.getElementById('btnExportJSON');
  const importJSONInput = document.getElementById('importJSONInput');
  const btnThemeToggle = document.getElementById('btnThemeToggle');
  const btnAppRefresh = document.getElementById('btnAppRefresh');
  const environmentSelector = document.getElementById('environmentSelector');
  const btnAddEnvironment = document.getElementById('btnAddEnvironment');
  const btnSetSecrets = document.getElementById('btnSetSecrets');
  const datasetInput = document.getElementById('datasetInput');
  const datasetSelector = document.getElementById('datasetSelector');
  const bentoLiveRegion = document.getElementById('bentoLiveRegion');
  const qaWorkspaceOverlay = document.getElementById('qaWorkspaceOverlay');
  const qaWorkspaceEyebrow = document.getElementById('qaWorkspaceEyebrow');
  const qaWorkspaceTitle = document.getElementById('qaWorkspaceTitle');
  const qaWorkspaceBody = document.getElementById('qaWorkspaceBody');
  const qaWorkspaceClose = document.getElementById('qaWorkspaceClose');

  // Canonical set of supported step actions (shared by import validation and
  // AI/Copilot step sanitization).
  const allowedActions = new Set(['click', 'fill', 'select', 'hover', 'assert_visible', 'assert_enabled', 'assert_disabled', 'assert_checked', 'assert_unchecked', 'assert_text', 'assert_value', 'assert_attribute', 'assert_css', 'assert_count', 'assert_url', 'assert_screenshot', 'assert_network_status', 'assert_no_console_errors', 'assert_a11y', 'assert_performance', 'assert_security_headers', 'api_request', 'mock_route', 'clear_mocks', 'use_flow', 'wait', 'wait_for_element_hidden', 'wait_for_text', 'wait_for_url_change', 'wait_for_network_idle']);

  // ========================================
  // SHARED HELPERS EXPOSED TO LATER DOMContentLoaded BLOCKS (QA Copilot, AI Data)
  // ========================================
  async function getRunContext() {
    if (currentState.isRecording) {
      showBentoAlert('Perhatian', 'Hentikan proses perekaman terlebih dahulu sebelum menjalankan tes.', '⚠️');
      return null;
    }
    const activeTab = await getActiveTab();
    if (!activeTab?.id) {
      showBentoAlert('Perhatian', 'Buka tab website terlebih dahulu untuk menjalankan tes.', '⚠️');
      return null;
    }
    if (!/^https?:/i.test(activeTab.url || '')) {
      showBentoAlert('Halaman Tidak Didukung', 'Anda tidak bisa menjalankan tes atau merekam pada halaman bawaan Chrome (seperti Tab Baru, chrome://, atau Web Store). Silakan buka website biasa (HTTP/HTTPS) terlebih dahulu.', '⚠️');
      return null;
    }
    return {
      tab: activeTab,
      delay: parseInt(stepDelayInput?.value || '500', 10),
      autoRetryCount: parseInt(document.getElementById('autoRetrySelect')?.value || '2', 10),
      stopOnError: isPressed(stopOnErrorCheck)
    };
  }

  async function startVideoIfRequested(tab) {
    if (!isPressed(recordVideoCheck)) return true;
    try {
      await startVideoRecording(tab.id);
      announce('Perekaman video dimulai...');
      return true;
    } catch (err) {
      showBentoAlert('Gagal Merekam Video', err.message, '⚠️');
      return false;
    }
  }

  window.QAFlow = Object.assign(window.QAFlow || {}, {
    sendRuntimeMessage,
    showBentoAlert,
    showBentoPrompt,
    showBentoConfirm,
    activateTab,
    btnRunSuite,
    getRunContext,
    getState: () => currentState,
    getActiveSteps: () => getActiveSteps(),
    announce,
    // Validate & clamp AI-generated Copilot steps. The pure implementation lives
    // in sidepanel/codegen.js so it is unit-testable; here we inject the allowlist.
    sanitizeCopilotSteps(rawSteps) {
      return sanitizeCopilotSteps(rawSteps, allowedActions);
    },
    // Run a freshly generated Copilot test case directly (no save), so existing
    // suite steps never constrain the run.
    async runCopilotSteps(steps) {
      const ctx = await getRunContext();
      if (!ctx) return { status: 'ERROR', error: 'run-not-ready' };
      if (!(await startVideoIfRequested(ctx.tab))) return { status: 'ERROR', error: 'video-failed' };
      return sendRuntimeMessage('RUN_COPILOT_STEPS', {
        tabId: ctx.tab.id,
        delay: ctx.delay,
        stopOnError: ctx.stopOnError,
        autoRetryCount: ctx.autoRetryCount,
        steps
      });
    },
    // Save the generated steps to the active suite, then run ONLY the newly added
    // steps (existing steps are untouched during execution).
    async saveAndRunCopilotSteps(steps) {
      const ctx = await getRunContext();
      if (!ctx) return { status: 'ERROR', error: 'run-not-ready' };
      if (!(await startVideoIfRequested(ctx.tab))) return { status: 'ERROR', error: 'video-failed' };
      const previousCount = getActiveSteps().length;
      const saved = await sendRuntimeMessage('APPEND_STEPS', { steps });
      if (saved?.status !== 'SUCCESS') return saved;
      return sendRuntimeMessage('RUN_TEST_SUITE', {
        tabId: ctx.tab.id,
        delay: ctx.delay,
        stopOnError: ctx.stopOnError,
        autoRetryCount: ctx.autoRetryCount,
        scope: { startIndex: previousCount }
      });
    },
    applyStateAndRender(data) {
      currentState = data;
      renderSuiteSelector();
      renderEnvironmentSelector();
      renderDatasetSelector();
      renderSteps(getActiveSteps());
      updateLogBadge();
      updateControlAvailability();
      renderQaReadiness();
    }
  });

  // Shared UI context for feature modules (e.g. sidepanel/ai-settings.js). Exposed
  // synchronously so modules loaded after the core can re-bind helpers/state.
  window.QAFlow.ui = Object.assign(window.QAFlow.ui || {}, {
    closeQaGovernanceMenu,
    openQaWorkspace,
    closeQaWorkspace,
    qaWorkspaceBody,
    showBentoAlert,
    isPressed,
    recordVideoCheck,
    getAiSettingsState: () => currentState.aiSettings,
    setAiSettingsState: (settings) => { currentState.aiSettings = settings; },
    getVideoSettingsState: () => currentState.videoSettings,
    setVideoSettingsState: (settings) => { currentState.videoSettings = settings; },
    // Recording UI (sidepanel/recording-ui.js)
    getActiveTab,
    refreshRecorderReadiness,
    renderRecorderReadiness,
    updateRecordingUI,
    fetchInitialState,
    openRecordingReview,
    showVideoPreviewUI,
    isRecording: () => currentState.isRecording,
    setIsRecording: (value) => { currentState.isRecording = value; },
    isExecutionRunning: () => currentState.executionResults?.status === 'RUNNING',
    // QA governance workspace actions (sidepanel/qa-governance.js)
    renderStructuredForm,
    getActiveSuiteObj,
    downloadFile,
    getBackupSnapshot: () => ({
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      suites: currentState.suites || [],
      activeSuiteId: currentState.activeSuiteId,
      environments: currentState.environments || [],
      datasets: currentState.datasets || [],
      defects: currentState.defects || [],
      exploratorySessions: currentState.exploratorySessions || [],
      releaseSignoffs: currentState.releaseSignoffs || [],
      suiteRevisions: currentState.suiteRevisions || [],
      auditTrail: currentState.auditTrail || [],
      visualBaselines: currentState.visualBaselines || {}
    })
  });

  function renderRecorderReadiness(state = recorderReadiness, error = '') {
    recorderReadiness = state;
    if (!btnRecord || currentState.isRecording) return;
    btnRecord.classList.toggle('recorder-ready', state === 'ready');
    btnRecord.classList.toggle('recorder-checking', state === 'checking');
    btnRecord.classList.toggle('recorder-unavailable', state === 'unavailable');
    const labels = { ready: 'Halaman siap direkam', checking: 'Memeriksa halaman…', unavailable: 'Halaman belum siap direkam' };
    btnRecord.title = error || labels[state] || labels.unavailable;
    btnRecord.setAttribute('aria-label', `${labels[state] || labels.unavailable}. Mulai rekaman`);
  }

  async function refreshRecorderReadiness() {
    if (currentState.isRecording) return true;
    renderRecorderReadiness('checking');
    const tab = await getActiveTab();
    activeTabUrl = tab?.url || '';
    activeTabId = tab?.id || null;
    if (!activeTabId || !/^https?:/i.test(activeTabUrl)) {
      renderRecorderReadiness('unavailable', 'Buka halaman HTTP atau HTTPS untuk merekam');
      return false;
    }
    try {
      const result = await sendRuntimeMessage('ENSURE_MONITOR_INJECTED', { tabId: activeTabId, recorderOnly: true });
      const ready = result?.status === 'SUCCESS' && result.ready === true;
      const readyHint = result.recorder?.live ? 'Halaman live siap · stream diabaikan saat menunggu' : '';
      renderRecorderReadiness(ready ? 'ready' : 'unavailable', ready ? readyHint : result?.error || 'DOM halaman belum tersedia');
      return ready;
    } catch (error) {
      renderRecorderReadiness('unavailable', error.message);
      return false;
    }
  }

  function closeQaGovernanceMenu(returnFocus = false) {
    qaGovernanceMenu?.classList.add('hidden');
    btnQaGovernanceMenu?.setAttribute('aria-expanded', 'false');
    if (returnFocus) btnQaGovernanceMenu?.focus();
  }

  btnQaGovernanceMenu?.addEventListener('click', event => {
    event.stopPropagation();
    const opening = qaGovernanceMenu?.classList.contains('hidden');
    qaGovernanceMenu?.classList.toggle('hidden', !opening);
    btnQaGovernanceMenu.setAttribute('aria-expanded', String(opening));
    if (opening) qaGovernanceMenu?.querySelector('[role="menuitem"]')?.focus();
  });
  qaGovernanceMenu?.addEventListener('click', () => closeQaGovernanceMenu());
  document.addEventListener('click', event => {
    if (!event.target.closest('.qa-governance-menu-wrap')) closeQaGovernanceMenu();
  });
  qaGovernanceMenu?.addEventListener('keydown', event => {
    const items = [...qaGovernanceMenu.querySelectorAll('[role="menuitem"]')];
    const index = items.indexOf(document.activeElement);
    if (event.key === 'Escape') { event.preventDefault(); closeQaGovernanceMenu(true); }
    if (event.key === 'ArrowDown') { event.preventDefault(); items[(index + 1) % items.length]?.focus(); }
    if (event.key === 'ArrowUp') { event.preventDefault(); items[(index - 1 + items.length) % items.length]?.focus(); }
  });

  // ========================================
  // BENTO CUSTOM MODAL SYSTEM (No Native Popups)
  // ========================================
  const bentoModalOverlay = document.getElementById('bentoModalOverlay');
  const bentoModalTitle = document.getElementById('bentoModalTitle');
  const bentoModalIcon = document.getElementById('bentoModalIcon');
  const bentoModalMessage = document.getElementById('bentoModalMessage');
  const bentoModalInputGroup = document.getElementById('bentoModalInputGroup');
  const bentoModalInput = document.getElementById('bentoModalInput');
  const bentoModalInputError = document.getElementById('bentoModalInputError');
  const bentoModalCancelBtn = document.getElementById('bentoModalCancelBtn');
  const bentoModalConfirmBtn = document.getElementById('bentoModalConfirmBtn');
  const bentoModalCloseBtn = document.getElementById('bentoModalCloseBtn');
  const bentoModalExampleBtn = document.getElementById('bentoModalExampleBtn');

  const flatModalIcons = {
    environment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9S14.4 18.5 12 21M12 3C9.6 5.5 8.4 8.5 8.4 12s1.2 6.5 3.6 9"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/></svg>',
    secrets: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2"/></svg>'
  };

  function setBentoModalIcon(icon) {
    if (flatModalIcons[icon]) bentoModalIcon.innerHTML = flatModalIcons[icon];
    else bentoModalIcon.textContent = icon || '';
  }
  let modalReturnFocus = null;
  let editingStepIndex = null;

  function announce(message) {
    if (!bentoLiveRegion) return;
    bentoLiveRegion.textContent = '';
    setTimeout(() => { bentoLiveRegion.textContent = message; }, 20);
  }

  function handleModalKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      bentoModalCloseBtn.click();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusable = [...bentoModalOverlay.querySelectorAll('button:not([disabled]), input:not([disabled]):not(.hidden), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter(el => !el.closest('.hidden'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function openBentoModal(preferredFocus = bentoModalConfirmBtn) {
    modalReturnFocus = document.activeElement;
    bentoModalOverlay.classList.remove('hidden');
    document.addEventListener('keydown', handleModalKeydown);
    setTimeout(() => preferredFocus?.focus(), 50);
  }

  function closeBentoModal() {
    bentoModalOverlay.classList.add('hidden');
    document.removeEventListener('keydown', handleModalKeydown);
    modalReturnFocus?.focus?.();
    modalReturnFocus = null;
  }

  function showBentoConfirm(title, message, options = {}) {
    return new Promise((resolve) => {
      bentoModalExampleBtn.classList.add('hidden');
      bentoModalTitle.textContent = title || 'Konfirmasi';
      setBentoModalIcon(options.icon || '⚠️');
      bentoModalMessage.textContent = message || '';
      bentoModalInputGroup.classList.add('hidden');
      bentoModalCancelBtn.classList.remove('hidden');
      bentoModalConfirmBtn.textContent = options.confirmText || 'Ya, Lanjutkan';
      openBentoModal();

      const cleanup = () => {
        closeBentoModal();
        bentoModalConfirmBtn.removeEventListener('click', onConfirm);
        bentoModalCancelBtn.removeEventListener('click', onCancel);
        bentoModalCloseBtn.removeEventListener('click', onCancel);
      };

      const onConfirm = () => { cleanup(); resolve(true); };
      const onCancel = () => { cleanup(); resolve(false); };

      bentoModalConfirmBtn.addEventListener('click', onConfirm);
      bentoModalCancelBtn.addEventListener('click', onCancel);
      bentoModalCloseBtn.addEventListener('click', onCancel);
    });
  }

  function showBentoPrompt(title, message, defaultValue = '', options = {}) {
    return new Promise((resolve) => {
      bentoModalTitle.textContent = title || 'Input';
      setBentoModalIcon(options.icon || '✏️');
      bentoModalMessage.textContent = message || '';
      bentoModalInput.value = defaultValue;
      bentoModalInputError.classList.add('hidden');
      bentoModalInputError.textContent = '';
      bentoModalInput.type = options.inputType || 'text';
      bentoModalExampleBtn.classList.toggle('hidden', options.exampleValue === undefined);
      bentoModalInputGroup.classList.remove('hidden');
      bentoModalCancelBtn.classList.remove('hidden');
      bentoModalConfirmBtn.textContent = options.confirmText || 'Simpan';
      openBentoModal(bentoModalInput);

      const cleanup = () => {
        closeBentoModal();
        bentoModalConfirmBtn.removeEventListener('click', onConfirm);
        bentoModalCancelBtn.removeEventListener('click', onCancel);
        bentoModalCloseBtn.removeEventListener('click', onCancel);
        bentoModalInput.removeEventListener('keydown', onKey);
        bentoModalExampleBtn.removeEventListener('click', onExample);
        bentoModalExampleBtn.classList.add('hidden');
        bentoModalInput.type = 'text';
      };

      const onConfirm = async () => {
        const val = bentoModalInput.value;
        bentoModalInputError.classList.add('hidden');
        bentoModalConfirmBtn.disabled = true;
        try {
          if (options.validate) await options.validate(val);
          cleanup();
          resolve(val);
        } catch (error) {
          bentoModalInputError.textContent = error.message || 'Data tidak dapat disimpan.';
          bentoModalInputError.classList.remove('hidden');
          bentoModalInput.focus();
        } finally { bentoModalConfirmBtn.disabled = false; }
      };
      const onCancel = () => { cleanup(); resolve(null); };
      const onExample = () => {
        bentoModalInput.value = typeof options.exampleValue === 'string' ? options.exampleValue : JSON.stringify(options.exampleValue);
        bentoModalInput.focus();
        bentoModalInput.select();
      };
      const onKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); onConfirm(); } if (e.key === 'Escape') onCancel(); };

      bentoModalConfirmBtn.addEventListener('click', onConfirm);
      bentoModalCancelBtn.addEventListener('click', onCancel);
      bentoModalCloseBtn.addEventListener('click', onCancel);
      bentoModalInput.addEventListener('keydown', onKey);
      bentoModalExampleBtn.addEventListener('click', onExample);
    });
  }

  function showBentoAlert(title, message, icon = 'ℹ️') {
    return new Promise((resolve) => {
      bentoModalExampleBtn.classList.add('hidden');
      bentoModalTitle.textContent = title || 'Informasi';
      setBentoModalIcon(icon);
      bentoModalMessage.textContent = message || '';
      bentoModalInputGroup.classList.add('hidden');
      bentoModalCancelBtn.classList.add('hidden');
      bentoModalConfirmBtn.textContent = 'OK';
      openBentoModal();

      const cleanup = () => {
        closeBentoModal();
        bentoModalConfirmBtn.removeEventListener('click', onConfirm);
        bentoModalCloseBtn.removeEventListener('click', onConfirm);
      };

      const onConfirm = () => { cleanup(); resolve(true); };

      bentoModalConfirmBtn.addEventListener('click', onConfirm);
      bentoModalCloseBtn.addEventListener('click', onConfirm);
    });
  }

  function openQaWorkspace(title, eyebrow = 'QA Workspace') {
    qaWorkspaceTitle.textContent = title;
    qaWorkspaceEyebrow.textContent = eyebrow;
    qaWorkspaceOverlay.classList.remove('hidden');
    qaWorkspaceClose.focus();
  }

  btnClearVideoHistory?.addEventListener('click', async () => {
    const ok = await showBentoConfirm('Hapus Riwayat', 'Hapus seluruh riwayat video?', { icon: '🗑', danger: true, confirmText: 'Hapus Semua' });
    if (ok) {
      chrome.runtime.sendMessage({ action: 'CLEAR_VIDEO_HISTORY' }, (res) => {
        if (res?.status === 'SUCCESS') {
          currentState.videoHistory = [];
          renderVideoHistory();
        }
      });
    }
  });

  function closeQaWorkspace() {
    qaWorkspaceOverlay.classList.add('hidden');
    qaWorkspaceBody.innerHTML = '';
  }

  qaWorkspaceClose?.addEventListener('click', closeQaWorkspace);
  qaWorkspaceOverlay?.addEventListener('click', event => { if (event.target === qaWorkspaceOverlay) closeQaWorkspace(); });

  function renderStructuredForm(fields, initial, onSave, options = {}) {
    qaWorkspaceBody.innerHTML = `<form class="qa-entity-form"><div class="qa-form-grid">${fields.map(field => {
      const value = initial?.[field.name] ?? field.defaultValue ?? '';
      const classes = `qa-field${field.wide ? ' wide' : ''}`;
      if (field.type === 'select') return `<div class="${classes}"><label for="qa-${field.name}">${escapeHTML(field.label)}</label><select id="qa-${field.name}" name="${field.name}">${field.options.map(option => `<option value="${escapeHTML(option)}" ${option === value ? 'selected' : ''}>${escapeHTML(option)}</option>`).join('')}</select></div>`;
      if (field.type === 'textarea') return `<div class="${classes}"><label for="qa-${field.name}">${escapeHTML(field.label)}</label><textarea id="qa-${field.name}" name="${field.name}" placeholder="${escapeHTML(field.placeholder || '')}">${escapeHTML(Array.isArray(value) ? value.join(', ') : value)}</textarea></div>`;
      return `<div class="${classes}"><label for="qa-${field.name}">${escapeHTML(field.label)}</label><input id="qa-${field.name}" name="${field.name}" type="${field.type || 'text'}" value="${escapeHTML(value)}" placeholder="${escapeHTML(field.placeholder || '')}" ${field.required ? 'required' : ''}></div>`;
    }).join('')}</div><div class="qa-form-error hidden" role="alert"></div><div class="qa-form-actions"><button type="button" class="bento-btn bento-btn-ghost qa-form-cancel">Batal</button><button type="submit" class="bento-btn bento-btn-primary">${escapeHTML(options.saveText || 'Simpan')}</button></div></form>`;
    const form = qaWorkspaceBody.querySelector('.qa-entity-form');
    form.querySelector('.qa-form-cancel').addEventListener('click', options.onCancel || closeQaWorkspace);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const submit = form.querySelector('[type="submit"]');
      const errorBox = form.querySelector('.qa-form-error');
      const data = Object.fromEntries(new FormData(form));
      fields.filter(field => field.array).forEach(field => { data[field.name] = String(data[field.name] || '').split(',').map(value => value.trim()).filter(Boolean); });
      fields.filter(field => field.type === 'number').forEach(field => { data[field.name] = Number(data[field.name]); });
      errorBox.classList.add('hidden');
      submit.disabled = true;
      try { await onSave(data); }
      catch (error) { errorBox.textContent = error.message || 'Data tidak dapat disimpan.'; errorBox.classList.remove('hidden'); }
      finally { submit.disabled = false; }
    });
    setTimeout(() => form.querySelector('input,select,textarea')?.focus(), 30);
  }

  function fullSuiteMetadata(suite, overrides = {}) {
    return { owner: suite.owner || '', priority: suite.priority || 'P1', tags: suite.tags || [], startUrl: suite.startUrl || '', release: suite.release || '', requirements: suite.requirements || [], ...overrides };
  }

  function openRequirementManager() {
    openQaWorkspace('Requirements', 'Traceability');
    const suite = getActiveSuiteObj();
    const requirements = suite?.requirements || [];
    qaWorkspaceBody.innerHTML = `<button type="button" class="bento-btn bento-btn-primary" id="qaAddRequirement">+ Requirement</button><div class="qa-board-list">${requirements.length ? requirements.map(item => `<article class="qa-board-item"><div class="qa-board-item-head"><div><strong>${escapeHTML(item.id)}</strong><p>${escapeHTML(item.title || 'Tanpa judul')}</p></div><div class="qa-item-actions"><button class="qa-item-btn qa-edit-requirement" data-id="${escapeHTML(item.id)}">Edit</button><button class="qa-item-btn qa-delete-requirement" data-id="${escapeHTML(item.id)}">Hapus</button></div></div><div class="qa-board-meta"><span class="qa-mini-tag">${escapeHTML(item.risk || 'MEDIUM')}</span><span class="qa-mini-tag">${getActiveSteps().filter(step => (step.requirementIds || []).includes(item.id)).length} step</span></div></article>`).join('') : '<div class="bento-empty-state"><p>Belum ada requirement.</p><span>Tambahkan requirement pertama untuk mulai mengukur coverage.</span></div>'}</div>`;
    const editRequirement = item => {
      renderStructuredForm([
        { name: 'id', label: 'Requirement ID', required: true, placeholder: 'REQ-AUTH-001' },
        { name: 'risk', label: 'Risk', type: 'select', options: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
        { name: 'title', label: 'Requirement', wide: true, required: true }
      ], item || { risk: 'MEDIUM' }, async data => {
        if (!data.id.trim() || !data.title.trim()) throw new Error('ID dan requirement wajib diisi.');
        const duplicate = requirements.find(existing => existing.id === data.id && existing !== item);
        if (duplicate) throw new Error(`Requirement ${data.id} sudah tersedia.`);
        const next = item ? requirements.map(existing => existing === item ? data : existing) : [...requirements, data];
        const response = await sendRuntimeMessage('UPDATE_SUITE_METADATA', { suiteId: suite.id, metadata: fullSuiteMetadata(suite, { requirements: next }) });
        if (response?.status !== 'SUCCESS') throw new Error(response?.error || 'Requirement gagal disimpan.');
        if (item && item.id !== data.id) {
          const steps = getActiveSteps().map(step => ({ ...step, requirementIds: (step.requirementIds || []).map(id => id === item.id ? data.id : id) }));
          await sendRuntimeMessage('UPDATE_STEPS', { steps });
          suite.steps = steps;
        }
        suite.requirements = next;
        openRequirementManager();
      }, { onCancel: openRequirementManager });
    };
    qaWorkspaceBody.querySelector('#qaAddRequirement')?.addEventListener('click', () => editRequirement(null));
    qaWorkspaceBody.querySelectorAll('.qa-edit-requirement').forEach(button => button.addEventListener('click', () => editRequirement(requirements.find(item => item.id === button.dataset.id))));
    qaWorkspaceBody.querySelectorAll('.qa-delete-requirement').forEach(button => button.addEventListener('click', async () => {
      const next = requirements.filter(item => item.id !== button.dataset.id);
      await sendRuntimeMessage('UPDATE_SUITE_METADATA', { suiteId: suite.id, metadata: fullSuiteMetadata(suite, { requirements: next }) });
      const steps = getActiveSteps().map(step => ({ ...step, requirementIds: (step.requirementIds || []).filter(id => id !== button.dataset.id) }));
      await sendRuntimeMessage('UPDATE_STEPS', { steps });
      suite.steps = steps;
      suite.requirements = next;
      openRequirementManager();
    }));
  }

  function openDefectEditor(defect = null) {
    openQaWorkspace(defect ? 'Edit defect' : 'New defect', 'Defect lifecycle');
    renderStructuredForm([
      { name: 'id', label: 'Defect ID', placeholder: 'BUG-001' },
      { name: 'severity', label: 'Severity', type: 'select', options: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
      { name: 'title', label: 'Title', wide: true, required: true },
      { name: 'status', label: 'Status', type: 'select', options: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'WONT_FIX'] },
      { name: 'assignee', label: 'Assignee' },
      { name: 'requirementIds', label: 'Requirement IDs', type: 'textarea', array: true, wide: true, placeholder: 'REQ-AUTH-001, REQ-AUTH-002' },
      { name: 'evidence', label: 'Evidence references', type: 'textarea', array: true, wide: true }
    ], defect || { severity: 'HIGH', status: 'OPEN' }, async data => {
      if (!data.title.trim()) throw new Error('Title wajib diisi.');
      const known = new Set((getActiveSuiteObj()?.requirements || []).map(item => item.id));
      const unknown = data.requirementIds.find(id => !known.has(id));
      if (unknown) throw new Error(`Requirement ${unknown} belum terdaftar.`);
      const response = await sendRuntimeMessage('UPSERT_DEFECT', { defect: { ...defect, ...data } });
      if (response?.status !== 'SUCCESS') throw new Error(response?.error || 'Defect gagal disimpan.');
      const existing = currentState.defects || [];
      currentState.defects = [response.defect, ...existing.filter(item => item.id !== response.defect.id)];
      openDefectBoard();
    }, { onCancel: openDefectBoard });
  }

  function openDefectBoard() {
    openQaWorkspace('Defect board', 'Lifecycle');
    const suite = getActiveSuiteObj();
    const defects = (currentState.defects || []).filter(item => item.suiteId === suite?.id);
    qaWorkspaceBody.innerHTML = `<button type="button" class="bento-btn bento-btn-primary" id="qaNewDefect">+ Defect</button><div class="qa-board-list">${defects.length ? defects.map(item => `<article class="qa-board-item"><div class="qa-board-item-head"><div><strong>${escapeHTML(item.id)} · ${escapeHTML(item.title)}</strong><p>${escapeHTML(item.assignee || 'Unassigned')}</p></div><div class="qa-item-actions"><button class="qa-item-btn qa-edit-defect" data-id="${escapeHTML(item.id)}">Edit</button>${!['CLOSED', 'WONT_FIX'].includes(item.status) ? `<button class="qa-item-btn qa-close-defect" data-id="${escapeHTML(item.id)}">Close</button>` : ''}</div></div><div class="qa-board-meta"><span class="qa-mini-tag">${escapeHTML(item.severity)}</span><span class="qa-mini-tag">${escapeHTML(item.status)}</span>${(item.requirementIds || []).map(id => `<span class="qa-mini-tag">${escapeHTML(id)}</span>`).join('')}</div></article>`).join('') : '<div class="bento-empty-state"><p>Tidak ada defect.</p><span>Quality gate tidak memiliki blocker aktif.</span></div>'}</div>`;
    qaWorkspaceBody.querySelector('#qaNewDefect')?.addEventListener('click', () => openDefectEditor());
    qaWorkspaceBody.querySelectorAll('.qa-edit-defect').forEach(button => button.addEventListener('click', () => openDefectEditor(defects.find(item => item.id === button.dataset.id))));
    qaWorkspaceBody.querySelectorAll('.qa-close-defect').forEach(button => button.addEventListener('click', async () => {
      const defect = defects.find(item => item.id === button.dataset.id);
      const response = await sendRuntimeMessage('UPSERT_DEFECT', { defect: { ...defect, status: 'CLOSED' } });
      if (response?.status === 'SUCCESS') { currentState.defects = currentState.defects.map(item => item.id === defect.id ? response.defect : item); openDefectBoard(); }
    }));
  }

  function openFailureInspector() {
    const results = currentState.executionResults || {};
    const failures = (results.stepDetails || []).filter(item => item.status === 'FAILED');
    openQaWorkspace('Failure inspector', 'Execution evidence');
    qaWorkspaceBody.innerHTML = failures.length ? `<div class="qa-board-list">${failures.map(item => {
      const relatedLogs = (currentState.logs || []).filter(log => Math.abs(new Date(log.timestamp) - new Date(item.timestamp)) <= 5000).slice(0, 5);
      const timelineLogs = (item.evidenceLogs || relatedLogs).slice(0, 10);
      return `<article class="qa-board-item"><div class="qa-board-item-head"><div><strong>Step ${item.stepIndex} · ${escapeHTML(item.action || '')}</strong><p>${escapeHTML(item.error || 'Unknown failure')}</p></div><span class="qa-mini-tag">${item.attempts || 1} attempt</span></div><div class="qa-board-meta"><span class="qa-mini-tag">Expected: ${escapeHTML(item.expected ?? '-')}</span><span class="qa-mini-tag">Actual: ${escapeHTML(item.actual ?? '-')}</span></div>${item.selector ? `<p>Selector: ${escapeHTML(item.selector)}</p>` : ''}${(item.triedSelectors || []).length ? `<p>Tried: ${escapeHTML(item.triedSelectors.join(' · '))}</p>` : ''}${timelineLogs.length ? `<div class="evidence-timeline">${timelineLogs.map(log => `<div><time>${new Date(log.timestamp).toLocaleTimeString(window.QAI18n?.locale?.() || 'id-ID')}</time><span>${escapeHTML(log.type)}</span><p>${escapeHTML(log.message)}</p></div>`).join('')}</div>` : ''}${item.baselineCandidate ? `<button type="button" class="bento-btn bento-btn-primary qa-approve-baseline" data-step-id="${escapeHTML(item.stepId)}">Approve baseline</button><img class="failure-inspector-evidence" src="${item.baselineCandidate}" alt="Visual baseline candidate step ${item.stepIndex}">` : (item.screenshot && item.status === 'FAILED') ? `<img class="failure-inspector-evidence" src="${item.screenshot}" alt="Failure evidence step ${item.stepIndex}">` : ''}</article>`;
    }).join('')}</div>` : '<div class="bento-empty-state"><p>Tidak ada failure.</p><span>Jalankan suite untuk menghasilkan diagnostic evidence.</span></div>';
    qaWorkspaceBody.querySelectorAll('.qa-approve-baseline').forEach(button => button.addEventListener('click', async () => {
      const item = failures.find(failure => failure.stepId === button.dataset.stepId);
      if (!item?.baselineCandidate) return;
      const response = await sendRuntimeMessage('APPROVE_VISUAL_BASELINE', { stepId: item.stepId, candidate: item.baselineCandidate });
      if (response?.status !== 'SUCCESS') return showBentoAlert('Baseline gagal', response?.error || 'Baseline tidak dapat disimpan.', '⚠️');
      button.disabled = true;
      button.textContent = 'Approved';
      announce('Visual baseline disetujui');
    }));
  }

  // ========================================
  // VPN & NETWORK GEOLOCATION DETECTOR
  // ========================================
  // IP & GEOLOCATION MODAL — moved to sidepanel/ip-modal.js
  // (fetchNetworkVPNStatus, fetchNetworkStatusDirect, renderVPNStatus, modal handlers)

  environmentSelector?.addEventListener('change', () => {
    chrome.runtime.sendMessage({ action: 'SET_ACTIVE_ENVIRONMENT', payload: { id: environmentSelector.value } });
    currentState.activeEnvironmentId = environmentSelector.value;
  });

  btnAddEnvironment?.addEventListener('click', async () => {
    const name = await showBentoPrompt('Environment', 'Nama environment:', '', { icon: 'environment', confirmText: 'Lanjut' });
    if (!name?.trim()) return;
    const baseUrl = await showBentoPrompt('Base URL', 'URL dasar environment:', '', { icon: 'link', confirmText: 'Simpan' });
    if (baseUrl === null) return;
    chrome.runtime.sendMessage({ action: 'SAVE_ENVIRONMENT', payload: { environment: { name: name.trim(), baseUrl: baseUrl.trim(), variables: {} } } });
  });

  btnSetSecrets?.addEventListener('click', () => {
    openQaWorkspace('Rahasia Sesi', 'Keamanan');

    // Load existing secrets from chrome.storage.session (secure storage)
    const loadAndRender = (existing = {}) => {
      const entries = Object.entries(existing).length > 0
        ? Object.entries(existing)
        : [['', '']];

      const renderRows = (rows) => {
        const container = qaWorkspaceBody.querySelector('#secretRowsContainer');
        if (!container) return;
        container.innerHTML = rows.map(([ k, v ], i) => `
          <div class="qa-secret-row" data-index="${i}">
            <input type="text" class="secret-key" placeholder="key" value="${escapeHTML(k)}" autocomplete="off" spellcheck="false">
            <input type="password" class="secret-val" placeholder="nilai rahasia" value="${escapeHTML(v)}" autocomplete="new-password">
            <button type="button" class="qa-secret-del secret-remove-btn" title="Hapus" ${rows.length <= 1 ? 'disabled' : ''}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        `).join('');

        container.querySelectorAll('.secret-remove-btn').forEach((btn, i) => {
          btn.onclick = () => {
            rows.splice(i, 1);
            renderRows(rows);
          };
        });
      };

      qaWorkspaceBody.innerHTML = `
        <div class="qa-entity-form">
          <div class="qa-secret-info">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Data tersimpan aman di penyimpanan lokal &mdash; tidak akan hilang saat browser ditutup.
          </div>
          <div class="qa-secret-header">
            <span>Nama (Key)</span>
            <span>Nilai (Value)</span>
          </div>
          <div id="secretRowsContainer"></div>
          <button type="button" id="btnAddSecretRow" class="qa-secret-add-btn">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Tambah Baris
          </button>
          <div class="qa-form-actions" style="margin-top:10px">
            <button type="button" id="btnClearSecrets" class="bento-btn bento-btn-ghost danger">Hapus Semua</button>
            <button type="button" id="btnSaveSecrets" class="bento-btn bento-btn-primary"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px; margin-bottom:-2px"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Simpan &amp; Terapkan</button>
          </div>
        </div>
      `;

      const currentRows = [...entries];
      renderRows(currentRows);

      qaWorkspaceBody.querySelector('#btnAddSecretRow').onclick = () => {
        currentRows.push(['', '']);
        renderRows(currentRows);
      };

      qaWorkspaceBody.querySelector('#btnClearSecrets').onclick = () => {
        currentRows.length = 0;
        currentRows.push(['', '']);
        renderRows(currentRows);
      };

      qaWorkspaceBody.querySelector('#btnSaveSecrets').onclick = () => {
        const secrets = {};
        qaWorkspaceBody.querySelectorAll('.qa-secret-row').forEach(row => {
          const k = row.querySelector('.secret-key').value.trim();
          const v = row.querySelector('.secret-val').value;
          if (k) secrets[k] = v;
        });

        // Save into appState via background script (persisted to chrome.storage.local)
        chrome.runtime.sendMessage({ action: 'SET_SESSION_SECRETS', payload: { secrets } }, res => {
          announce(`${res?.count || 0} secret aktif dan tersimpan`);
        });

        closeQaWorkspace();
        const count = Object.keys(secrets).length;
        showBentoAlert('Tersimpan', `${count} secret aktif dan tersimpan di penyimpanan lokal.`, '🔒');
      };
    };

    // Load secrets from appState in background
    chrome.runtime.sendMessage({ action: 'GET_STATE' }, (res) => {
      loadAndRender(res?.data?.sessionSecrets || {});
    });
  });

  datasetSelector?.addEventListener('change', () => {
    const [id, row = '0'] = datasetSelector.value.split('::');
    currentState.activeDatasetId = id || null;
    currentState.activeDatasetRow = parseInt(row, 10) || 0;
    chrome.runtime.sendMessage({ action: 'SET_ACTIVE_DATASET', payload: { id: id || null, row: currentState.activeDatasetRow } });
  });

  datasetInput?.addEventListener('change', async () => {
    const file = datasetInput.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      let rows;
      if (file.name.toLowerCase().endsWith('.csv')) rows = parseCsvDataset(text);
      else {
        const parsed = JSON.parse(text);
        rows = Array.isArray(parsed) ? parsed : parsed.rows;
      }
      if (!Array.isArray(rows) || !rows.length || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('Dataset harus berisi array object.');
      chrome.runtime.sendMessage({ action: 'SAVE_DATASET', payload: { dataset: { name: file.name.replace(/\.(json|csv)$/i, ''), rows } } });
      announce(`${rows.length} baris dataset dimuat`);
    } catch (err) {
      showBentoAlert('Dataset Tidak Valid', err.message, '⚠️');
    } finally {
      datasetInput.value = '';
    }
  });

  function parseCsvDataset(text) {
    const parseLine = line => {
      const cells = [];
      let value = '';
      let quoted = false;
      for (let index = 0; index < line.length; index++) {
        const char = line[index];
        if (char === '"' && quoted && line[index + 1] === '"') { value += '"'; index++; }
        else if (char === '"') quoted = !quoted;
        else if (char === ',' && !quoted) { cells.push(value.trim()); value = ''; }
        else value += char;
      }
      cells.push(value.trim());
      return cells;
    };
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    const headers = parseLine(lines.shift() || '');
    if (!headers.length || headers.some(header => !header)) throw new Error('Header CSV tidak valid.');
    return lines.slice(0, 1000).map(line => Object.fromEntries(headers.map((header, index) => [header, parseLine(line)[index] || ''])));
  }

  // ========================================
  // THEME MANAGEMENT (LIGHT / DARK)
  // ========================================
  const btnLanguageToggle = document.getElementById('btnLanguageToggle');
  let currentAppLanguage = 'id';

  chrome.storage.local.get(['themeMode', 'appLanguage'], (res) => {
    const currentTheme = res.themeMode || 'dark';
    applyTheme(currentTheme);
    if (res.appLanguage) {
      currentAppLanguage = res.appLanguage;
      applyAppLanguage(currentAppLanguage);
    }
  });

  btnAppRefresh?.addEventListener('click', () => {
    window.location.reload();
  });

  btnThemeToggle?.addEventListener('click', () => {
    const isLight = document.body.classList.contains('light-theme');
    const newTheme = isLight ? 'dark' : 'light';
    applyTheme(newTheme);
    chrome.storage.local.set({ themeMode: newTheme });
  });

  btnLanguageToggle?.addEventListener('click', () => {
    currentAppLanguage = currentAppLanguage === 'id' ? 'en' : 'id';
    chrome.storage.local.set({ appLanguage: currentAppLanguage });
    applyAppLanguage(currentAppLanguage);
    announce(currentAppLanguage === 'en' ? 'Switched to English' : 'Berhasil beralih ke Bahasa Indonesia');
  });

  function applyAppLanguage(lang) {
    if (window.QAI18n?.setLanguage) {
      window.QAI18n.setLanguage(lang);
    }
    if (btnLanguageToggle) {
      btnLanguageToggle.title = lang === 'en' ? 'Switch to Indonesian' : 'Ubah ke Bahasa Inggris';
      btnLanguageToggle.setAttribute('aria-label', lang === 'en' ? 'Switch to Indonesian' : 'Ubah ke Bahasa Inggris');
    }
    
    // Update Copilot input placeholder
    const copilotInput = document.getElementById('copilotInput');
    if (copilotInput) {
      copilotInput.placeholder = lang === 'en' 
        ? "Type scenario (e.g., test login form with email & password)..." 
        : "Ketik skenario (misal: buat tes untuk form login...)";
    }

    // Update Copilot Suggestion Chips
    const chipBox = document.querySelector('.copilot-prompt-suggestions');
    if (chipBox) {
      if (lang === 'en') {
        chipBox.innerHTML = `
          <button class="copilot-chip" data-prompt="Create a test scenario for login form with username and password"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:2px"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg> Test Login</button>
          <button class="copilot-chip" data-prompt="Create a full registration form test case"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:2px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> Register Form</button>
          <button class="copilot-chip" data-prompt="Verify page title, header, and primary submit button"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:2px"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> Inspect Elements</button>
        `;
      } else {
        chipBox.innerHTML = `
          <button class="copilot-chip" data-prompt="Buatkan skenario test login dengan username dan password"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:2px"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg> Test Login</button>
          <button class="copilot-chip" data-prompt="Buatkan test form pendaftaran lengkap"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:2px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> Form Register</button>
          <button class="copilot-chip" data-prompt="Buatkan assertion verifikasi judul halaman dan tombol utama"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:2px"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> Cek Element</button>
        `;
      }
      chipBox.querySelectorAll('.copilot-chip')?.forEach(chip => {
        chip.addEventListener('click', () => {
          if (copilotInput) {
            copilotInput.value = chip.dataset.prompt || chip.textContent;
            copilotInput.focus();
          }
        });
      });
    }

    window.dispatchEvent(new CustomEvent('QA_LANG_CHANGED', { detail: { lang } }));
  }

  function applyTheme(theme) {
    const isLight = theme === 'light';
    document.body.classList.toggle('light-theme', isLight);
    document.documentElement.classList.toggle('light-theme', isLight);
    document.documentElement.setAttribute('data-theme', isLight ? 'light' : 'dark');

    if (btnThemeToggle) {
      btnThemeToggle.innerHTML = isLight
        ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></svg>'
        : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
      btnThemeToggle.title = isLight ? 'Gunakan mode gelap' : 'Gunakan mode terang';
      btnThemeToggle.setAttribute('aria-label', isLight ? 'Gunakan mode gelap' : 'Gunakan mode terang');
    }
  }

  const tab = await getActiveTab();
  activeTabUrl = tab?.url || '';
  activeTabId = tab?.id || null;
  if (activeTabId && /^https?:/i.test(activeTabUrl)) {
    chrome.runtime.sendMessage({ action: 'ENSURE_MONITOR_INJECTED', payload: { tabId: activeTabId, recorderOnly: true } }, () => {
      // The active tab can change while the panel is starting up.
      void chrome.runtime.lastError;
    });
  }
  fetchInitialState();
  await refreshRecorderReadiness();
  chrome.tabs.onActivated?.addListener(() => setTimeout(refreshRecorderReadiness, 100));
  chrome.tabs.onUpdated?.addListener((tabId, changeInfo) => {
    if (tabId === activeTabId && ['loading', 'complete'].includes(changeInfo.status)) refreshRecorderReadiness();
  });

  // ========================================
  // MESSAGE LISTENER
  // ========================================
  chrome.runtime.onMessage.addListener((message) => {
    const { action } = message;
    switch (action) {
      case 'STATE_CHANGED':
        fetchInitialState();
        window.refreshCopilotThreads?.();
        break;
      case 'SUITES_UPDATED':
        currentState.suites = message.suites;
        currentState.activeSuiteId = message.activeSuiteId;
        currentState.executionResults = message.results || {};
        renderSuiteSelector();
        renderSteps(getActiveSteps());
        updateReportSummary(currentState.executionResults);
        renderQaReadiness();
        break;
      case 'STEPS_UPDATED':
      case 'STEP_ADDED':
        const suite = getActiveSuiteObj();
        if (suite) suite.steps = message.allSteps;
        renderSteps(message.allSteps);
        if (message.smartCorrection === 'CHOICE_REPLACED') announce('Pilihan sebelumnya dikoreksi otomatis');
        if (message.smartCorrection === 'TOGGLE_CANCELLED') announce('Toggle yang dibatalkan tidak direkam');
        if (message.results !== undefined) {
          currentState.executionResults = message.results;
          updateReportSummary(currentState.executionResults);
        }
        renderQaReadiness();
        break;
      case 'NEW_LOG':
        if (message.replaceExisting) {
          const existingIndex = currentState.logs.findIndex(log => log.id === message.log.id);
          if (existingIndex >= 0) currentState.logs[existingIndex] = message.log;
          else currentState.logs.unshift(message.log);
        } else {
          currentState.logs.unshift(message.log);
        }
        renderLogs(currentState.logs);
        updateLogBadge();
        break;
      case 'LOGS_CLEARED':
        currentState.logs = [];
        renderLogs([]);
        updateLogBadge();
        break;
      case 'MONITOR_STATUS_CHANGED':
        currentState.monitorStatus = message.monitorStatus;
        renderMonitorStatus();
        break;
      case 'RECORDING_ERROR':
        currentState.isRecording = false;
        updateRecordingUI(false);
        showBentoAlert('Recorder terputus', message.error || 'Muat ulang halaman target lalu mulai merekam kembali.', '⚠️');
        break;
      case 'EXECUTION_STARTED':
        btnPauseExecution?.classList.remove('hidden');
        btnStopExecution?.classList.remove('hidden');
        if (btnPauseExecution) {
          btnPauseExecution.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="10" y1="4" x2="10" y2="20"/><line x1="14" y1="4" x2="14" y2="20"/></svg>';
          btnPauseExecution.dataset.paused = 'false';
        }
        showExecutionBanner(true, 'running', 'Menjalankan tes', 'Menyiapkan suite…', 0);
        break;
      case 'EXECUTION_CONTROL_CHANGED':
        if (btnPauseExecution) {
          btnPauseExecution.dataset.paused = String(Boolean(message.control?.paused));
          btnPauseExecution.innerHTML = message.control?.paused
            ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>'
            : '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="10" y1="4" x2="10" y2="20"/><line x1="14" y1="4" x2="14" y2="20"/></svg>';
          btnPauseExecution.title = message.control?.paused ? 'Lanjutkan' : 'Pause';
        }
        if (message.control?.paused) showExecutionBanner(true, 'paused', message.control?.reason === 'breakpoint' ? `Breakpoint · Step ${message.control.stepIndex}` : 'Eksekusi dijeda', 'Klik lanjutkan untuk meneruskan', Number(progressBar?.getAttribute('aria-valuenow') || 0));
        break;
      case 'STEP_EXECUTION_START': {
        const total = message.totalSteps || getActiveSteps().length || 1;
        const pct = Math.round(((message.sequenceIndex || message.stepIndex) / total) * 100);
        showExecutionBanner(true, 'running', `Step ${message.sequenceIndex || message.stepIndex} dari ${total}`, `${message.step.action}${message.step.selector ? ` · ${message.step.selector}` : ''}`, pct);
        highlightActiveExecutingStep(message.stepIndex);
        break;
      }
      case 'STEP_EXECUTION_PROGRESS':
        updateReportSummary(message.results);
        break;
      case 'EXECUTION_FINISHED': {
        btnPauseExecution?.classList.add('hidden');
        btnStopExecution?.classList.add('hidden');
        const isOk = message.results.status === 'COMPLETED';
        const failedStep = (message.results.stepDetails || []).find(step => step.status === 'FAILED');
        const durationMs = message.results.startTime && message.results.endTime ? new Date(message.results.endTime) - new Date(message.results.startTime) : 0;
        const duration = durationMs >= 1000 ? `${(durationMs / 1000).toFixed(1)}s` : `${Math.max(0, durationMs)}ms`;
        let detail = isOk
          ? `${message.results.passedSteps || 0}/${message.results.totalSteps || 0} step lolos · ${duration}`
          : `Step ${failedStep?.stepIndex || '-'} gagal · ${message.results.failedSteps || 0} error · ${duration}`;
        const wasCancelled = message.results.status === 'CANCELLED';

        const updateBanner = () => showExecutionBanner(true, wasCancelled ? 'cancelled' : isOk ? 'passed' : 'failed', wasCancelled ? 'Eksekusi dihentikan' : isOk ? 'Tes berhasil' : 'Tes gagal', wasCancelled ? 'Dihentikan oleh pengguna' : detail, 100);

        if (typeof activeMediaRecorder !== 'undefined' && activeMediaRecorder) {
          announce('Menyiapkan preview video...');
          const DEFAULT_UPLOAD_URL = 'https://cloud.duniakuaja.my.id/qa-upload.php';
          // Always fetch the freshest settings from background - the API key has
          // no built-in fallback, it must be configured in Settings > Video.
          chrome.runtime.sendMessage({ action: 'GET_STATE' }, (res) => {
            const latestSettings = res?.data?.videoSettings || currentState.videoSettings || {};
            const uploadUrl = latestSettings.uploadUrl || DEFAULT_UPLOAD_URL;
            const apiKey = latestSettings.apiKey || '';
            stopVideoRecordingAndUpload(uploadUrl, apiKey)
              .then(result => {
                updateBanner();
                if (result && result.blob) {
                  showVideoPreviewUI(result.blob, result, true);
                }
              })
              .catch(err => {
                console.error('Video processing failed', err);
                detail += ` · ⚠️ Pemrosesan video gagal`;
                updateBanner();
              });
          });
        } else {
          updateBanner();
          if (isOk) setTimeout(() => showExecutionBanner(false), 7000);
        }

        updateReportSummary(message.results);
        currentState.executionResults = message.results;
        fetchExecutionHistory();
        break;
      }
    }
  });

  btnDismissBanner?.addEventListener('click', () => showExecutionBanner(false));
  btnPauseExecution?.addEventListener('click', async () => {
    const paused = btnPauseExecution.dataset.paused === 'true';
    await sendRuntimeMessage(paused ? 'RESUME_EXECUTION' : 'PAUSE_EXECUTION');
  });
  btnStopExecution?.addEventListener('click', () => sendRuntimeMessage('STOP_EXECUTION'));

  btnTestMonitor?.addEventListener('click', async () => {
    const activeTab = await getActiveTab();
    if (!activeTab?.id || !/^https?:/i.test(activeTab.url || '')) return showBentoAlert('Monitor tidak tersedia', 'Buka halaman HTTP atau HTTPS terlebih dahulu.', '⚠️');
    if (currentState.monitorStatus?.active && currentState.monitorStatus?.tabId === activeTab.id) {
      await sendRuntimeMessage('STOP_MONITOR', { tabId: activeTab.id });
      return announce('Monitor dihentikan');
    }
    const ensured = await sendRuntimeMessage('ENSURE_MONITOR_INJECTED', { tabId: activeTab.id });
    if (ensured?.status !== 'SUCCESS') return showBentoAlert('Monitor gagal', ensured?.error || 'Monitor tidak dapat dipasang.', '⚠️');
    await chrome.scripting.executeScript({ target: { tabId: activeTab.id }, world: 'MAIN', func: () => console.error('[QA Flow] Console monitor self-test') });
  });

  // ========================================
  // TAB NAVIGATION
  // ========================================
  function activateTab(btn, moveFocus = false) {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabBtns.forEach(b => {
        const selected = b === btn;
        b.setAttribute('aria-selected', String(selected));
        b.tabIndex = selected ? 0 : -1;
      });
      tabPanes.forEach(p => {
        const selected = p.id === btn.dataset.tab;
        p.classList.toggle('active', selected);
        p.hidden = !selected;
      });
      btn.classList.add('active');
      if (moveFocus) btn.focus();
  }

  tabBtns.forEach((btn, index) => {
    btn.addEventListener('click', () => activateTab(btn));
    btn.addEventListener('keydown', (e) => {
      let nextIndex = null;
      if (e.key === 'ArrowRight') nextIndex = (index + 1) % tabBtns.length;
      if (e.key === 'ArrowLeft') nextIndex = (index - 1 + tabBtns.length) % tabBtns.length;
      if (e.key === 'Home') nextIndex = 0;
      if (e.key === 'End') nextIndex = tabBtns.length - 1;
      if (nextIndex !== null) {
        e.preventDefault();
        activateTab(tabBtns[nextIndex], true);
      }
    });
  });

  // ========================================
  // SUITE MANAGEMENT (P0)
  // ========================================
  suiteSelector.addEventListener('change', () => {
    chrome.runtime.sendMessage({ action: 'SWITCH_SUITE', payload: { suiteId: suiteSelector.value } });
  });

  btnNewSuite.addEventListener('click', async () => {
    const name = await showBentoPrompt('Proyek Baru', 'Masukkan nama untuk proyek QA baru:', '', { icon: '➕', confirmText: 'Buat Proyek' });
    if (name && name.trim()) {
      chrome.runtime.sendMessage({ action: 'CREATE_SUITE', payload: { name: name.trim() } });
    }
  });

  btnDupSuite.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'DUPLICATE_SUITE', payload: { suiteId: currentState.activeSuiteId } });
  });

  btnRenameSuite.addEventListener('click', async () => {
    const suite = getActiveSuiteObj();
    const newName = await showBentoPrompt('Ubah Nama Proyek', 'Masukkan nama baru untuk proyek ini:', suite?.name || '', { icon: '✏️', confirmText: 'Simpan Nama' });
    if (newName && newName.trim()) {
      chrome.runtime.sendMessage({ action: 'RENAME_SUITE', payload: { suiteId: currentState.activeSuiteId, name: newName.trim() } });
    }
  });

  btnSuiteSettings?.addEventListener('click', () => {
    const suite = getActiveSuiteObj();
    if (!suite) return;
    openQaWorkspace('Suite Settings', 'Suite configuration');
    renderStructuredForm([
      { name: 'suiteName', label: 'Nama suite', required: true, wide: true, placeholder: 'Regression Checkout' },
      { name: 'owner', label: 'Owner', placeholder: 'QA Team' },
      { name: 'priority', label: 'Priority', type: 'select', options: ['P0', 'P1', 'P2', 'P3'] },
      { name: 'tags', label: 'Tags', type: 'textarea', array: true, wide: true, placeholder: 'smoke, auth, critical-path' },
      { name: 'startUrl', label: 'Start URL', type: 'url', wide: true, placeholder: 'https://app.example.com/login' },
      { name: 'release', label: 'Release', wide: true, placeholder: 'v1.0.0' }
    ], {
      suiteName: suite.name || '',
      owner: suite.owner || '',
      priority: suite.priority || 'P1',
      tags: suite.tags || [],
      startUrl: suite.startUrl || '',
      release: suite.release || ''
    }, async data => {
      if (!data.suiteName.trim()) throw new Error('Nama suite wajib diisi.');
      if (data.startUrl && !/^https?:\/\//i.test(data.startUrl)) throw new Error('Start URL harus menggunakan http:// atau https://.');
      const metadata = fullSuiteMetadata(suite, { owner: data.owner.trim(), priority: data.priority, tags: data.tags, startUrl: data.startUrl.trim(), release: data.release.trim() });
      const response = await sendRuntimeMessage('UPDATE_SUITE_METADATA', { suiteId: suite.id, metadata });
      if (response?.status !== 'SUCCESS') throw new Error('Suite settings gagal disimpan.');
      if (data.suiteName.trim() !== suite.name) await sendRuntimeMessage('RENAME_SUITE', { suiteId: suite.id, name: data.suiteName.trim() });
      closeQaWorkspace();
      fetchInitialState();
      announce('Suite settings tersimpan');
    }, { saveText: 'Simpan' });
  });

  btnDeleteSuite.addEventListener('click', async () => {
    const ok = await showBentoConfirm('Hapus Proyek', 'Hapus proyek ini beserta seluruh langkah tes di dalamnya?', { icon: '🗑', danger: true, confirmText: 'Hapus Proyek' });
    if (ok) {
      chrome.runtime.sendMessage({ action: 'DELETE_SUITE', payload: { suiteId: currentState.activeSuiteId } });
    }
  });

  // ========================================
  // RECORDING
  // ========================================
  function openRecordingReview(recording) {
    if (!recording?.stepCount) return announce('Tidak ada aksi valid yang direkam');
    openQaWorkspace('Review Rekaman', 'Smart Recorder');
    const render = () => {
      const steps = getActiveSteps().slice(recording.startIndex, recording.endIndex + 1);
      const average = steps.length ? Math.round(steps.reduce((sum, step) => sum + Number(step.smart?.confidence || 0), 0) / steps.length) : 0;
      qaWorkspaceBody.innerHTML = `<div class="recording-review-summary"><strong>${steps.length} langkah</strong><span>Confidence ${average}%</span></div><div class="qa-board-list">${steps.map((step, offset) => {
        const suggestion = step.smart?.assertionSuggestion;
        const network = step.smart?.network;
        return `<article class="qa-board-item recording-review-item" data-step-id="${escapeHTML(step.id)}"><div class="qa-board-item-head"><div><strong>${offset + 1}. ${escapeHTML(step.description || step.action)}</strong><p>${escapeHTML(step.selector || step.value || '')}</p></div><span class="recording-confidence ${Number(step.smart?.confidence || 0) >= 80 ? 'is-good' : 'is-warn'}">${Number(step.smart?.confidence || 0)}%</span></div><div class="qa-board-meta"><span class="qa-mini-tag">wait:${escapeHTML(step.smart?.autoWait || 'none')}</span>${network ? `<span class="qa-mini-tag">${escapeHTML(network.method)} ${network.status || 'ERR'}</span>` : ''}${suggestion ? `<button type="button" class="qa-item-btn recording-add-assertion" data-id="${escapeHTML(step.id)}">+ Assertion</button>` : ''}<button type="button" class="qa-item-btn recording-remove-step" data-id="${escapeHTML(step.id)}">Hapus</button></div>${suggestion ? `<p class="recording-suggestion">${escapeHTML(suggestion.reason)}</p>` : ''}</article>`;
      }).join('')}</div><div class="qa-form-actions recording-review-actions"><button type="button" class="bento-btn bento-btn-ghost" id="recordingReviewDone">Selesai</button><button type="button" class="bento-btn bento-btn-primary" id="recordingValidate">Validasi Replay</button></div>`;
      qaWorkspaceBody.querySelector('#recordingReviewDone')?.addEventListener('click', closeQaWorkspace);
      qaWorkspaceBody.querySelectorAll('.recording-remove-step').forEach(button => button.addEventListener('click', async () => {
        const next = getActiveSteps().filter(step => step.id !== button.dataset.id);
        await sendRuntimeMessage('UPDATE_STEPS', { steps: next });
        recording.endIndex--;
        render();
      }));
      qaWorkspaceBody.querySelectorAll('.recording-add-assertion').forEach(button => button.addEventListener('click', async () => {
        const all = [...getActiveSteps()];
        const index = all.findIndex(step => step.id === button.dataset.id);
        const suggestion = all[index]?.smart?.assertionSuggestion;
        if (index < 0 || !suggestion?.action) return;
        all.splice(index + 1, 0, { action: suggestion.action, selector: suggestion.selector, value: suggestion.value, description: suggestion.reason, enabled: true, timeout: 5000, risk: all[index].risk || 'MEDIUM' });
        await sendRuntimeMessage('UPDATE_STEPS', { steps: all });
        recording.endIndex++;
        announce('Assertion ditambahkan');
        render();
      }));
      qaWorkspaceBody.querySelector('#recordingValidate')?.addEventListener('click', async event => {
        const button = event.currentTarget;
        button.disabled = true;
        button.textContent = 'Memvalidasi…';
        const tab = await getActiveTab();
        const result = tab?.id ? await sendRuntimeMessage('RUN_TEST_SUITE', { tabId: tab.id, delay: 150, stopOnError: false, autoRetryCount: 0, scope: { startIndex: recording.startIndex, endIndex: recording.endIndex } }) : null;
        const passed = result?.status === 'SUCCESS' && !result.result?.failedSteps;
        const all = getActiveSteps().map((step, index) => index >= recording.startIndex && index <= recording.endIndex ? { ...step, smart: { ...(step.smart || {}), reviewStatus: passed ? 'validated' : 'failed' } } : step);
        await sendRuntimeMessage('UPDATE_STEPS', { steps: all });
        button.disabled = false;
        button.textContent = passed ? 'Replay Lulus' : 'Periksa Kegagalan';
        button.classList.toggle('is-validation-failed', !passed);
        announce(passed ? 'Rekaman tervalidasi' : 'Replay menemukan langkah gagal');
      });
    };
    render();
  }

  // RECORDING UI — moved to sidepanel/recording-ui.js (reads window.QAFlow.ui)
  // btnRecord + btnRecordScreen click handlers live there; render helpers stay here.

  btnRunSuite.addEventListener('click', async event => {
    if (currentState.isRecording) {
      return showBentoAlert('Perhatian', 'Hentikan proses perekaman terlebih dahulu sebelum menjalankan tes.', '⚠️');
    }

    const activeTab = await getActiveTab();
    if (!activeTab?.id) return showBentoAlert('Perhatian', 'Buka tab website terlebih dahulu untuk menjalankan tes.', '⚠️');
    if (!/^https?:/i.test(activeTab.url || '')) {
      return showBentoAlert('Halaman Tidak Didukung', 'Anda tidak bisa menjalankan tes atau merekam pada halaman bawaan Chrome (seperti Tab Baru, chrome://, atau Web Store). Silakan buka website biasa (HTTP/HTTPS) terlebih dahulu.', '⚠️');
    }
    if (!getActiveSteps().length) return showBentoAlert('Proyek Kosong', 'Belum ada langkah tes pada proyek aktif ini.', 'ℹ️');

    if (isPressed(recordVideoCheck) && activeTab.id) {
      try {
        await startVideoRecording(activeTab.id);
        announce('Perekaman video dimulai...');
      } catch (err) {
        showBentoAlert('Gagal Merekam Video', err.message, '⚠️');
        return;
      }
    }

    const delay = parseInt(stepDelayInput.value) || 500;
    const autoRetryCount = parseInt(document.getElementById('autoRetrySelect')?.value || '2');
    const runPayload = { tabId: activeTab.id, delay, stopOnError: isPressed(stopOnErrorCheck), autoRetryCount };
    const activeDataset = (currentState.datasets || []).find(dataset => dataset.id === currentState.activeDatasetId);
    if (event.altKey && activeDataset?.rows?.length) {
      const originalRow = currentState.activeDatasetRow || 0;
      for (let row = 0; row < activeDataset.rows.length; row++) {
        await sendRuntimeMessage('SET_ACTIVE_DATASET', { id: activeDataset.id, row });
        const result = await sendRuntimeMessage('RUN_TEST_SUITE', runPayload);
        if (result?.status !== 'SUCCESS' || result.result?.failedSteps) break;
      }
      await sendRuntimeMessage('SET_ACTIVE_DATASET', { id: activeDataset.id, row: originalRow });
    } else {
      chrome.runtime.sendMessage({ action: 'RUN_TEST_SUITE', payload: runPayload });
    }
  });

  btnClearSteps.addEventListener('click', async () => {
    const ok = await showBentoConfirm('Hapus Langkah Tes', 'Hapus semua langkah tes pada suite aktif saat ini?', { icon: '🗑', danger: true, confirmText: 'Hapus Semua' });
    if (ok) {
      chrome.runtime.sendMessage({ action: 'CLEAR_STEPS' });
    }
  });

  btnRequirements?.addEventListener('click', openRequirementManager);
  btnAddDefect?.addEventListener('click', () => openDefectEditor());
  btnDefectBoard?.addEventListener('click', openDefectBoard);

  // IP & GEOLOCATION MODAL handlers — moved to sidepanel/ip-modal.js

  executionBanner?.addEventListener('click', event => {
    if (executionBanner.classList.contains('is-failed') && !event.target.closest('button')) openFailureInspector();
  });

  // QA GOVERNANCE WORKSPACE ACTIONS — moved to sidepanel/qa-governance.js
  // (btnAddExploration, btnReleaseSignoff, btnSuiteVersions, btnWorkspaceBackup)

  // ========================================
  // EXPERT QA ACTIONS
  // ========================================
  btnA11yAudit.addEventListener('click', async event => {
    const activeTab = await getActiveTab();
    if (!activeTab?.id) return showBentoAlert('Perhatian', 'Buka tab website terlebih dahulu.', '⚠️');
    try {
      await chrome.scripting.executeScript({ target: { tabId: activeTab.id }, files: ['node_modules/axe-core/axe.min.js'], world: 'ISOLATED', injectImmediately: true });
    } catch (error) {
      return showBentoAlert('Audit belum tersedia', 'Axe tidak dapat diinjeksi pada halaman ini.', '⚠️');
    }
    chrome.tabs.sendMessage(activeTab.id, { action: 'RUN_A11Y_AUDIT', keyboardOnly: event.altKey }, (res) => {
      const deliveryError = chrome.runtime.lastError;
      if (deliveryError) {
        showBentoAlert('Audit belum tersedia', 'Muat ulang halaman target, lalu jalankan audit kembali.', '⚠️');
        return;
      }
      if (res?.status === 'SUCCESS') {
        showBentoAlert('Audit Aksesibilitas Selesai', `Ditemukan ${res.violations?.length || 0} isu. Detail tersedia di Logs.`, '♿');
      } else showBentoAlert('Gagal', 'Gagal menjalankan audit aksesibilitas pada halaman ini.', '❌');
    });
  });

  btnClearStorage.addEventListener('click', async () => {
    const activeTab = await getActiveTab();
    if (!activeTab?.id) return showBentoAlert('Perhatian', 'Buka tab website terlebih dahulu.', '⚠️');
    const ok = await showBentoConfirm('Clean State', 'Bersihkan localStorage dan sessionStorage pada halaman web aktif?', { icon: '🧹', danger: true, confirmText: 'Bersihkan Storage' });
    if (ok) {
      chrome.tabs.sendMessage(activeTab.id, { action: 'CLEAR_PAGE_STORAGE' }, (res) => {
        const deliveryError = chrome.runtime.lastError;
        if (deliveryError) {
          showBentoAlert('Clean State belum tersedia', 'Muat ulang halaman target, lalu coba kembali.', '⚠️');
          return;
        }
        if (res?.status === 'SUCCESS') showBentoAlert('Berhasil', 'Storage halaman berhasil dibersihkan (Clean State)!', '✅');
        else showBentoAlert('Gagal', 'Gagal membersihkan storage: ' + (res?.error || 'Unknown'), '❌');
      });
    }
  });

  // ========================================
  // MANUAL STEP FORM
  // ========================================
  btnToggleAddManual.addEventListener('click', () => {
    if (!manualStepForm.classList.contains('hidden') && editingStepIndex === null) manualStepForm.classList.add('hidden');
    else openStepEditor();
  });
  btnCancelManual.addEventListener('click', closeStepEditor);

  function openStepEditor(index = null) {
    editingStepIndex = Number.isInteger(index) ? index : null;
    const step = editingStepIndex === null ? null : getActiveSteps()[editingStepIndex];
    manualStepForm.querySelector('h4').textContent = step ? `Edit Step ${editingStepIndex + 1}` : 'Tambah Langkah';
    manualStepForm.querySelector('[type="submit"]').textContent = step ? 'Simpan' : 'Tambah';
    manualAction.value = step?.action || 'click';
    manualSelector.value = step?.selector || '';
    manualValue.value = step?.value || '';
    manualNotes.value = step?.notes || '';
    manualGroup.value = step?.group || '';
    manualTimeout.value = step?.timeout || 5000;
    manualRequirementIds.value = (step?.requirementIds || []).join(', ');
    renderManualRequirementOptions();
    manualRisk.value = step?.risk || 'MEDIUM';
    manualStepForm.classList.remove('hidden');
    manualAction.focus();
  }

  function closeStepEditor() {
    editingStepIndex = null;
    manualStepForm.reset();
    manualTimeout.value = 5000;
    manualStepForm.classList.add('hidden');
  }

  function renderManualRequirementOptions() {
    if (!manualRequirementOptions) return;
    const selected = new Set(manualRequirementIds.value.split(',').map(value => value.trim()).filter(Boolean));
    const requirements = getActiveSuiteObj()?.requirements || [];
    manualRequirementOptions.innerHTML = requirements.map(item => `<button type="button" class="manual-requirement-chip${selected.has(item.id) ? ' is-selected' : ''}" data-id="${escapeHTML(item.id)}" title="${escapeHTML(item.title || item.id)}">${escapeHTML(item.id)}</button>`).join('');
    manualRequirementOptions.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
      if (selected.has(button.dataset.id)) selected.delete(button.dataset.id); else selected.add(button.dataset.id);
      manualRequirementIds.value = [...selected].join(', ');
      renderManualRequirementOptions();
    }));
  }

  manualStepForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const action = manualAction.value;
    const selector = manualSelector.value.trim();
    const value = manualValue.value.trim();
    const notes = manualNotes.value.trim();
    const group = manualGroup.value.trim();
    const timeout = Math.max(250, Math.min(60000, parseInt(manualTimeout.value, 10) || 5000));
    const requirementIds = [...new Set(manualRequirementIds.value.split(',').map(value => value.trim()).filter(Boolean))];
    const risk = manualRisk.value;

    const noSelectorActions = ['wait', 'assert_url', 'assert_screenshot', 'assert_no_console_errors', 'assert_a11y', 'assert_performance', 'clear_mocks', 'use_flow', 'wait_for_url_change', 'wait_for_network_idle'];
    if (!noSelectorActions.includes(action) && !selector) return showBentoAlert('Input Kurang', 'Target CSS Selector wajib diisi.', '⚠️');

    const desc = action.startsWith('wait') && !selector ? `${action}: ${value || '1000'}ms` : `${action.toUpperCase()} → ${selector}`;
    const existing = editingStepIndex === null ? null : getActiveSteps()[editingStepIndex];
    const newStep = { ...existing, action, selector, value, description: desc, notes, group, timeout, requirementIds, risk, enabled: existing?.enabled !== false, timestamp: existing?.timestamp || new Date().toISOString() };

    const steps = getActiveSteps();
    if (editingStepIndex === null) steps.push(newStep);
    else steps[editingStepIndex] = newStep;
    chrome.runtime.sendMessage({ action: 'UPDATE_STEPS', payload: { steps } });
    closeStepEditor();
  });

  // ========================================
  // DATA PRESETS
  // ========================================
  document.querySelectorAll('.bento-chip, .preset-card').forEach(card => {
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Salin variabel ${card.dataset.var}`);
    const copyVariable = async () => {
      try {
        await navigator.clipboard.writeText(card.dataset.var);
        card.classList.add('copied');
        announce(`${card.dataset.var} berhasil disalin`);
        setTimeout(() => card.classList.remove('copied'), 900);
      } catch (err) {
        announce(`Gagal menyalin ${card.dataset.var}`);
        showBentoAlert('Gagal Menyalin', 'Browser tidak mengizinkan akses clipboard.', '⚠️');
      }
    };
    card.addEventListener('click', copyVariable);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copyVariable(); }
    });
  });

  // ========================================
  // LOG FILTERS
  // ========================================
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      activeFilter = btn.dataset.filter;
      networkFilterBar?.classList.toggle('hidden', activeFilter !== 'NETWORK');
      renderLogs(currentState.logs);
    });
  });
  networkFilterBtns.forEach(btn => btn.addEventListener('click', () => {
    networkFilterBtns.forEach(item => { item.classList.remove('active'); item.setAttribute('aria-pressed', 'false'); });
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
    networkMethodFilter = btn.dataset.networkMethod;
    renderLogs(currentState.logs);
  }));
  btnToggleNetworkAdvanced?.addEventListener('click', () => {
    const willOpen = networkAdvancedFilters.classList.contains('hidden');
    networkAdvancedFilters.classList.toggle('hidden', !willOpen);
    btnToggleNetworkAdvanced.classList.toggle('active', willOpen);
    btnToggleNetworkAdvanced.setAttribute('aria-expanded', String(willOpen));
  });
  [networkStatusFilter, networkTypeFilter, networkDomainFilter, networkSlowFilter].forEach(control => control?.addEventListener('change', () => renderLogs(currentState.logs)));
  networkBodyCaptureCheck?.addEventListener('change', async () => {
    await sendRuntimeMessage('SET_MONITOR_OPTIONS', { captureBodies: networkBodyCaptureCheck.checked });
    currentState.monitorOptions = { captureBodies: networkBodyCaptureCheck.checked };
    announce(networkBodyCaptureCheck.checked ? 'Body capture aktif untuk sesi monitor berikutnya' : 'Body capture dimatikan');
  });
  logSearchInput?.addEventListener('input', () => {
    logSearchTerm = logSearchInput.value.trim().toLowerCase();
    renderLogs(currentState.logs);
  });
  btnClearLogs.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'CLEAR_LOGS' }));
  btnCopyLogs?.addEventListener('click', async () => {
    const visibleLogs = getFilteredLogs(currentState.logs);
    if (!visibleLogs.length) return announce('Tidak ada log untuk disalin');
    await copyLogText(JSON.stringify(visibleLogs, null, 2), `${visibleLogs.length} log disalin`);
  });

  // ========================================
  // EXPORT & IMPORT
  // ========================================
  btnDownloadReportHTML.addEventListener('click', async () => {
    if (!QAReportTemplate) return showBentoAlert('Belum Siap', 'Modul QAReportTemplate belum siap.', '⚠️');
    const reportPassword = await showBentoPrompt('Proteksi Report', 'Password opsional. Kosongkan untuk HTML biasa.', '', { icon: 'secrets', confirmText: 'Download', inputType: 'password' });
    if (reportPassword === null) return;
    const originalLabel = btnDownloadReportHTML.innerHTML;
    btnDownloadReportHTML.disabled = true;
    btnDownloadReportHTML.textContent = 'Menyiapkan report...';
    try {
      const capture = await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'CAPTURE_REPORT_SCREENSHOT' }, response => {
          resolve(chrome.runtime.lastError ? null : response?.screenshot || null);
        });
      });
      const suite = getActiveSuiteObj();
      const environment = currentState.environments?.find(item => item.id === currentState.activeEnvironmentId);
      const htmlContent = QAReportTemplate.generateHTML(
        currentState.executionResults,
        getActiveSteps(),
        currentState.logs,
        activeTabUrl,
        { suiteName: suite?.name || 'Test Suite', environmentName: environment?.name || 'Default', pageScreenshot: capture, governance: { release: suite?.release || '', requirements: suite?.requirements || [], defects: (currentState.defects || []).filter(item => item.suiteId === suite?.id), exploratorySessions: (currentState.exploratorySessions || []).filter(item => item.suiteId === suite?.id).length, signoffs: (currentState.releaseSignoffs || []).filter(item => item.suiteId === suite?.id).length } }
      );
      const safeSuiteName = String(suite?.name || 'Test-Suite').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '');
      const dateStamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const finalContent = reportPassword ? await encryptHTMLReport(htmlContent, reportPassword) : htmlContent;
      downloadFile(finalContent, `QA-Report-${safeSuiteName}-${dateStamp}${reportPassword ? '-encrypted' : ''}.html`, 'text/html');
    } catch (error) {
      showBentoAlert('Report Gagal', error.message || 'Report tidak dapat dibuat.', '⚠️');
    } finally {
      btnDownloadReportHTML.innerHTML = originalLabel;
      btnDownloadReportHTML.disabled = false;
    }
  });

  btnExportPlaywright.addEventListener('click', () => {
    if (!getActiveSteps().length) return showBentoAlert('Proyek Kosong', 'Belum ada langkah tes untuk diexport.', 'ℹ️');
    downloadFile(generatePlaywrightCode(getActiveSteps(), activeTabUrl), `test-suite.spec.ts`, 'text/typescript');
  });

  btnExportCypress.addEventListener('click', () => {
    if (!getActiveSteps().length) return showBentoAlert('Proyek Kosong', 'Belum ada langkah tes untuk diexport.', 'ℹ️');
    downloadFile(generateCypressCode(getActiveSteps(), activeTabUrl), `test-suite.cy.js`, 'text/javascript');
  });

  btnExportJSON.addEventListener('click', () => {
    const suiteData = getActiveSuiteObj();
    const environment = (currentState.environments || []).find(env => env.id === currentState.activeEnvironmentId);
    const dataset = (currentState.datasets || []).find(item => item.id === currentState.activeDatasetId);
    const exportData = { schemaVersion: 2, suite: suiteData, environment: environment ? { name: environment.name, baseUrl: environment.baseUrl, variables: environment.variables || {} } : undefined, dataset: dataset ? { name: dataset.name, rows: dataset.rows || [] } : undefined, defects: (currentState.defects || []).filter(item => item.suiteId === suiteData?.id), exploratorySessions: (currentState.exploratorySessions || []).filter(item => item.suiteId === suiteData?.id), releaseSignoffs: (currentState.releaseSignoffs || []).filter(item => item.suiteId === suiteData?.id), exportedAt: new Date().toISOString() };
    const secretPath = findHardcodedSecret(exportData);
    if (secretPath) return showBentoAlert('Export Diblokir', `Data sensitif terdeteksi di ${secretPath}. Gunakan {{session_secret}}.`, '⚠️');
    downloadFile(JSON.stringify(exportData, null, 2), `qa-suite-${Date.now()}.json`, 'application/json');
  });

  importJSONInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (Array.isArray(data.suites) && data.suites.length) {
          chrome.runtime.sendMessage({ action: 'RESTORE_WORKSPACE_BACKUP', payload: { backup: data } }, response => {
            if (response?.status === 'SUCCESS') {
              fetchInitialState();
              showBentoAlert('Backup dipulihkan', `${response.suiteCount} suite berhasil dimuat.`, '✓');
            } else showBentoAlert('Restore gagal', response?.error || 'Backup workspace tidak valid.', '⚠️');
          });
          return;
        }
        let steps = [];
        if (Array.isArray(data)) steps = data;
        else if (data.suite?.steps) steps = data.suite.steps;
        else if (data.steps) steps = data.steps;

        steps = validateImportedSteps(steps);
        if (steps.length) {
          const document = data.suite
            ? { ...data, suite: { ...data.suite, steps, beforeEach: validateImportedSteps(data.suite.beforeEach || []), afterEach: validateImportedSteps(data.suite.afterEach || []) } }
            : { schemaVersion: 2, suite: { name: getActiveSuiteObj()?.name || 'Imported Suite', steps } };
          chrome.runtime.sendMessage({ action: 'IMPORT_SUITE_DOCUMENT', payload: { document } }, response => {
            if (response?.status === 'SUCCESS') {
              fetchInitialState();
              showBentoAlert('Import Berhasil', `${steps.length} langkah dan konfigurasi suite dimuat.`, '✓');
            } else showBentoAlert('Import Gagal', response?.error || 'Dokumen tidak dapat dimuat.', '⚠️');
          });
        } else showBentoAlert('Format Gagal', 'Format JSON yang diimport tidak valid atau kosong.', '❌');
      } catch (err) {
        showBentoAlert('Gagal Membaca File', 'Terjadi kesalahan saat membaca file JSON: ' + err.message, '❌');
      } finally {
        importJSONInput.value = '';
      }
    };
    reader.onerror = () => {
      importJSONInput.value = '';
      showBentoAlert('Gagal Membaca File', 'File tidak dapat dibaca oleh browser.', '❌');
    };
    reader.readAsText(file);
  });

  // ========================================
  // RENDER FUNCTIONS
  // ========================================
  function renderSuiteSelector() {
    suiteSelector.innerHTML = '';
    currentState.suites.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.name} (${s.steps.length} langkah)`;
      if (s.id === currentState.activeSuiteId) opt.selected = true;
      suiteSelector.appendChild(opt);
    });
  }

  function renderEnvironmentSelector() {
    if (!environmentSelector) return;
    environmentSelector.innerHTML = '';
    (currentState.environments || []).forEach(environment => {
      const option = document.createElement('option');
      option.value = environment.id;
      option.textContent = environment.name;
      option.selected = environment.id === currentState.activeEnvironmentId;
      environmentSelector.appendChild(option);
    });
  }

  function renderDatasetSelector() {
    if (!datasetSelector) return;
    datasetSelector.innerHTML = '<option value="">Tanpa dataset</option>';
    (currentState.datasets || []).forEach(dataset => {
      (dataset.rows || []).forEach((row, index) => {
        const option = document.createElement('option');
        option.value = `${dataset.id}::${index}`;
        option.textContent = `${dataset.name} · ${index + 1}`;
        option.selected = dataset.id === currentState.activeDatasetId && index === (currentState.activeDatasetRow || 0);
        datasetSelector.appendChild(option);
      });
    });
  }

  function formatSelectorDisplay(sel) {
    if (!sel) return '-';
    if (sel.length <= 36) return sel;
    const parts = sel.split(' > ');
    if (parts.length > 2) {
      return '… > ' + parts.slice(-2).join(' > ');
    }
    return sel;
  }

  function renderSteps(steps) {
    stepCountEl.textContent = steps.length;
    updateControlAvailability();
    
    // Optimasi performa render: Batasi jumlah step yang dirender sekaligus
    const MAX_STEPS = 250;
    const displaySteps = steps.slice(0, MAX_STEPS);
    const hasMore = steps.length > MAX_STEPS;

    if (!displaySteps.length) {
      stepListEl.innerHTML = `<div class="bento-empty-state"><div class="empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div><p>Belum ada langkah tes.</p><span>Klik <strong>"Rekam"</strong> atau tambah langkah manual.</span></div>`;
      return;
    }

    const htmlChunks = displaySteps.map((step, idx) => {
      const stepNum = idx + 1;
      const detail = currentState.executionResults?.stepDetails?.find(d => d.stepIndex === stepNum);
      let statusClass = '';
      if (detail) {
        if (detail.status === 'PASSED') statusClass = 'status-passed';
        else if (detail.status === 'SLOW') statusClass = 'status-slow';
        else statusClass = 'status-failed';
      }

      const notesHtml = step.notes ? `<div class="step-notes"><span class="step-detail-label">Catatan</span><span>${escapeHTML(step.notes)}</span></div>` : '';
      const timeHtml = detail?.executionTimeMs ? `<span class="step-exec-time">${detail.executionTimeMs}ms</span>` : '';
      const groupHtml = step.group ? `<span class="step-group" title="Group">${escapeHTML(step.group)}</span>` : '';
      const displaySel = formatSelectorDisplay(step.selector);
      const healthHistory = (currentState.selectorHealingHistory || []).filter(item => item.stepId === step.id).slice(0, 10);
      const healthScore = detail?.selectorHealth ?? (healthHistory.length ? Math.round(healthHistory.reduce((sum, item) => sum + Number(item.score || 0), 0) / healthHistory.length) : null);
      const healthHtml = healthScore == null ? '' : `<span class="selector-health ${healthScore >= 80 ? 'is-good' : healthScore >= 55 ? 'is-warn' : 'is-risk'}" title="Selector health ${healthScore}/100 · ${healthHistory.filter(item => item.healed).length} healing">${healthScore}</span>`;

      // Mode Isian Data (📌 Statis vs 🎲 Random Dummy Variable)
      let dataModeHtml = '';
      if (step.action === 'fill' || step.action === 'select' || step.action === 'assert_value' || step.action === 'assert_text') {
        const val = step.value || '';
        const recVal = step.originalRecordedValue || (val.startsWith('{{') ? 'Nilai Rekaman' : val);
        const isDynamic = val.startsWith('{{') && val.endsWith('}}');

        dataModeHtml = `
          <div class="step-data-mode-row">
            <span class="mode-label step-detail-label">Data</span>
            <div class="step-data-picker">
              <button type="button" class="step-data-search-toggle" data-index="${idx}" title="Cari data" aria-label="Cari pilihan data langkah ${stepNum}" aria-expanded="false">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
              </button>
              <select class="step-data-mode-select" data-index="${idx}" aria-label="Pilih data langkah ${stepNum}">
                <option value="STATIC" ${!isDynamic ? 'selected' : ''}>📌 Statis ("${escapeHTML(recVal.length > 20 ? recVal.substring(0, 18) + '...' : recVal)}")</option>
                <option value="{{email}}" ${val === '{{email}}' ? 'selected' : ''}>🎲 Random Email ({{email}})</option>
                <option value="{{fullname}}" ${val === '{{fullname}}' ? 'selected' : ''}>🎲 Random Nama ({{fullname}})</option>
                <option value="{{phone}}" ${val === '{{phone}}' ? 'selected' : ''}>🎲 Random Phone ({{phone}})</option>
                <option value="{{nik}}" ${val === '{{nik}}' ? 'selected' : ''}>🎲 Random NIK / KTP ({{nik}})</option>
                <option value="{{password}}" ${val === '{{password}}' ? 'selected' : ''}>🎲 Random Password ({{password}})</option>
                <option value="{{address}}" ${val === '{{address}}' ? 'selected' : ''}>🎲 Random Alamat ({{address}})</option>
                <option value="{{city}}" ${val === '{{city}}' ? 'selected' : ''}>🎲 Random Kota ({{city}})</option>
                <option value="{{company}}" ${val === '{{company}}' ? 'selected' : ''}>🎲 Random Perusahaan ({{company}})</option>
                <option value="{{job_title}}" ${val === '{{job_title}}' ? 'selected' : ''}>🎲 Random Jabatan ({{job_title}})</option>
                <option value="{{npwp}}" ${val === '{{npwp}}' ? 'selected' : ''}>🎲 Random NPWP ({{npwp}})</option>
                <option value="{{cc_visa}}" ${val === '{{cc_visa}}' ? 'selected' : ''}>🎲 Random Visa ({{cc_visa}})</option>
                <option value="{{cc_master}}" ${val === '{{cc_master}}' ? 'selected' : ''}>🎲 Random Mastercard ({{cc_master}})</option>
                <option value="{{price_idr}}" ${val === '{{price_idr}}' ? 'selected' : ''}>🎲 Random Harga ({{price_idr}})</option>
                <option value="{{uuid}}" ${val === '{{uuid}}' ? 'selected' : ''}>🎲 Random UUID ({{uuid}})</option>
                <option value="{{user_agent}}" ${val === '{{user_agent}}' ? 'selected' : ''}>🎲 Random User-Agent ({{user_agent}})</option>
                <option value="{{randomtext}}" ${val === '{{randomtext}}' ? 'selected' : ''}>🎲 Random Teks ({{randomtext}})</option>
              </select>
              <div class="step-data-results" aria-label="Pencarian data" hidden>
                <label class="step-data-search-wrap">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                  <input type="search" class="step-data-search" data-index="${idx}" placeholder="Cari data…" aria-label="Cari pilihan data langkah ${stepNum}" autocomplete="off">
                </label>
                <div class="step-data-result-list" role="listbox" aria-label="Hasil pencarian data"></div>
              </div>
            </div>
          </div>
        `;
      }

      return `
        <div class="step-card ${statusClass} ${step.enabled === false ? 'is-disabled' : ''}" data-step-index="${stepNum}" data-array-index="${idx}" draggable="true" tabindex="0" aria-label="Langkah ${stepNum}: ${escapeHTML(step.action)}">
          <div class="step-card-header">
            <div class="step-meta-left">
              <span class="step-num" aria-label="Langkah ${stepNum}">STEP ${String(stepNum).padStart(2, '0')}</span>
              <span class="step-action-badge action-${step.action}">${step.action}</span>
              ${groupHtml}
              ${timeHtml}
              ${healthHtml}
            </div>
            <div class="step-card-actions">
              <span class="step-drag-handle" title="Geser" aria-hidden="true">⠿</span>
              <button class="btn-step-tool btn-toggle-step" data-index="${idx}" title="${step.enabled === false ? 'Aktifkan' : 'Nonaktifkan'}" aria-label="${step.enabled === false ? 'Aktifkan' : 'Nonaktifkan'} langkah ${stepNum}">${step.enabled === false ? '○' : '●'}</button>
              <button class="btn-step-tool btn-run-step" data-index="${idx}" title="Jalankan · Shift: mulai dari sini" aria-label="Jalankan langkah ${stepNum}; tahan Shift untuk menjalankan dari langkah ini">▶</button>
              <button class="btn-step-tool btn-breakpoint-step ${step.breakpoint ? 'active' : ''}" data-index="${idx}" title="${step.breakpoint ? 'Hapus breakpoint' : 'Tambah breakpoint'}" aria-label="${step.breakpoint ? 'Hapus' : 'Tambah'} breakpoint langkah ${stepNum}" aria-pressed="${Boolean(step.breakpoint)}">◆</button>
              <button class="btn-step-tool btn-edit-step" data-index="${idx}" title="Edit" aria-label="Edit langkah ${stepNum}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
              </button>
              <button class="btn-step-tool btn-dup-step" data-index="${idx}" title="Duplikat langkah" aria-label="Duplikat langkah ${stepNum}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
              <button class="btn-delete-step" data-index="${idx}" title="Hapus langkah" aria-label="Hapus langkah ${stepNum}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
          <div class="step-card-body">
            <div class="step-detail-row selector-row">
              <span class="step-detail-label">Target</span>
              <code class="step-selector" title="${escapeHTML(step.selector || '')}">${escapeHTML(displaySel)}</code>
            </div>
            ${dataModeHtml}
            ${step.value && !dataModeHtml ? `<div class="step-detail-row step-val"><span class="step-detail-label">Value</span><code>${escapeHTML(step.value)}</code></div>` : ''}
            ${notesHtml}
          </div>
        </div>`;
    });
    
    let finalHtml = htmlChunks.join('');
    if (hasMore) {
      finalHtml += `<div style="text-align:center; padding: 10px; font-size: 12px; color: var(--text-muted);">+ ${steps.length - MAX_STEPS} langkah lainnya tersembunyi demi performa.</div>`;
    }
    stepListEl.innerHTML = finalHtml;

    document.querySelectorAll('.btn-toggle-step').forEach(btn => {
      btn.addEventListener('click', e => {
        const index = parseInt(e.currentTarget.dataset.index, 10);
        const allSteps = getActiveSteps();
        allSteps[index].enabled = allSteps[index].enabled === false;
        chrome.runtime.sendMessage({ action: 'UPDATE_STEPS', payload: { steps: allSteps } });
      });
    });

    document.querySelectorAll('.btn-edit-step').forEach(btn => {
      btn.addEventListener('click', e => openStepEditor(parseInt(e.currentTarget.dataset.index, 10)));
    });

    document.querySelectorAll('.btn-breakpoint-step').forEach(btn => {
      btn.addEventListener('click', e => {
        const index = parseInt(e.currentTarget.dataset.index, 10);
        const allSteps = getActiveSteps();
        allSteps[index].breakpoint = !allSteps[index].breakpoint;
        chrome.runtime.sendMessage({ action: 'UPDATE_STEPS', payload: { steps: allSteps } });
      });
    });

    document.querySelectorAll('.btn-run-step').forEach(btn => {
      btn.addEventListener('click', async e => {
        const index = parseInt(e.currentTarget.dataset.index, 10);
        const activeTab = await getActiveTab();
        if (!activeTab?.id) return showBentoAlert('Perhatian', 'Buka tab website terlebih dahulu.', '⚠️');
        const scope = e.shiftKey ? { startIndex: index } : { startIndex: index, endIndex: index };
        chrome.runtime.sendMessage({ action: 'RUN_TEST_SUITE', payload: { tabId: activeTab.id, delay: 0, stopOnError: true, autoRetryCount: parseInt(document.getElementById('autoRetrySelect')?.value || '2', 10), scope } });
      });
    });

    let draggedIndex = null;
    document.querySelectorAll('.step-card').forEach(card => {
      card.addEventListener('dragstart', e => {
        draggedIndex = parseInt(card.dataset.arrayIndex, 10);
        card.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
      card.addEventListener('drop', e => {
        e.preventDefault();
        const targetIndex = parseInt(card.dataset.arrayIndex, 10);
        if (draggedIndex === null || draggedIndex === targetIndex) return;
        const allSteps = getActiveSteps();
        const [moved] = allSteps.splice(draggedIndex, 1);
        allSteps.splice(targetIndex, 0, moved);
        chrome.runtime.sendMessage({ action: 'UPDATE_STEPS', payload: { steps: allSteps } });
      });
      card.addEventListener('dragend', () => { draggedIndex = null; card.classList.remove('is-dragging'); });
      card.addEventListener('keydown', e => {
        if (!e.altKey || !['ArrowUp', 'ArrowDown'].includes(e.key)) return;
        e.preventDefault();
        const sourceIndex = parseInt(card.dataset.arrayIndex, 10);
        const targetIndex = e.key === 'ArrowUp' ? sourceIndex - 1 : sourceIndex + 1;
        const allSteps = getActiveSteps();
        if (targetIndex < 0 || targetIndex >= allSteps.length) return;
        const [moved] = allSteps.splice(sourceIndex, 1);
        allSteps.splice(targetIndex, 0, moved);
        chrome.runtime.sendMessage({ action: 'UPDATE_STEPS', payload: { steps: allSteps } });
      });
    });

    // Listener Mode Isian Data
    document.querySelectorAll('.step-data-mode-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const idx = parseInt(e.currentTarget.dataset.index);
        const steps = getActiveSteps();
        const chosen = e.currentTarget.value;

        if (chosen === 'STATIC') {
          steps[idx].value = steps[idx].originalRecordedValue || steps[idx].value || '';
        } else {
          if (!steps[idx].originalRecordedValue) {
            steps[idx].originalRecordedValue = steps[idx].value;
          }
          steps[idx].value = chosen;
        }

        chrome.runtime.sendMessage({ action: 'UPDATE_STEPS', payload: { steps } });
      });
    });

    document.querySelectorAll('.step-data-search').forEach(input => {
      const picker = input.closest('.step-data-picker');
      const select = picker?.querySelector('.step-data-mode-select');
      const results = picker?.querySelector('.step-data-results');
      const resultList = picker?.querySelector('.step-data-result-list');
      const toggle = picker?.querySelector('.step-data-search-toggle');
      if (!select || !results || !resultList || !toggle) return;

      const renderDataResults = () => {
        const query = input.value.trim().toLocaleLowerCase('id');
        const matches = Array.from(select.options).filter(option => {
          const searchableText = `${option.textContent} ${option.value}`.toLocaleLowerCase('id');
          return !query || searchableText.includes(query);
        });

        resultList.innerHTML = matches.length
          ? matches.map(option => `<button type="button" class="step-data-result${option.selected ? ' is-selected' : ''}" role="option" aria-selected="${option.selected}" data-value="${escapeHTML(option.value)}"><span>${escapeHTML(option.textContent)}</span>${option.selected ? '<span class="step-data-result-check" aria-hidden="true">✓</span>' : ''}</button>`).join('')
          : '<div class="step-data-no-result">Data tidak ditemukan</div>';
        results.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');

        resultList.querySelectorAll('.step-data-result').forEach(button => {
          button.addEventListener('mousedown', event => event.preventDefault());
          button.addEventListener('click', () => {
            select.value = button.dataset.value;
            results.hidden = true;
            toggle.setAttribute('aria-expanded', 'false');
            input.value = '';
            select.dispatchEvent(new Event('change', { bubbles: true }));
          });
        });
      };

      toggle.addEventListener('click', () => {
        renderDataResults();
        input.focus();
      });
      input.addEventListener('input', renderDataResults);
      input.addEventListener('blur', () => { window.setTimeout(() => { results.hidden = true; toggle.setAttribute('aria-expanded', 'false'); }, 100); });

      input.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          resultList.querySelector('.step-data-result')?.focus();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          resultList.querySelector('.step-data-result')?.click();
        } else if (e.key === 'Escape') {
          input.value = '';
          results.hidden = true;
          toggle.setAttribute('aria-expanded', 'false');
          toggle.focus();
        }
      });
    });

    // Listener Duplikat Step
    document.querySelectorAll('.btn-dup-step').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.index);
        const steps = getActiveSteps();
        const dup = JSON.parse(JSON.stringify(steps[idx]));
        delete dup.id;
        dup.description = (dup.description || '') + ' (Copy)';
        steps.splice(idx + 1, 0, dup);
        chrome.runtime.sendMessage({ action: 'UPDATE_STEPS', payload: { steps } });
      });
    });

    // Listener Delete Step
    document.querySelectorAll('.btn-delete-step').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.index);
        const steps = getActiveSteps();
        steps.splice(idx, 1);
        chrome.runtime.sendMessage({ action: 'UPDATE_STEPS', payload: { steps } });
      });
    });
  }

  function getFilteredLogs(logs) {
    return logs.filter(l => {
      if (activeFilter === 'ERROR') return l.type === 'console_error' || l.type === 'uncaught_exception';
      if (activeFilter === 'NETWORK') {
        if (!['network_error', 'network_slow', 'network_request', 'network_resource', 'network_socket'].includes(l.type)) return false;
        const details = l.details || {};
        const method = String(details.method || '').toUpperCase();
        const status = Number(details.status || 0);
        const duration = Number(details.durationMs || details.duration || 0);
        const resourceType = String(details.resourceType || details.type || '').toUpperCase();
        const url = String(details.url || '');
        if (networkMethodFilter === 'FAILED' && !(status >= 400 || status === 0 || l.type === 'network_error')) return false;
        if (networkMethodFilter === 'WRITE' && !['PUT', 'PATCH'].includes(method)) return false;
        if (!['ALL', 'FAILED', 'WRITE'].includes(networkMethodFilter) && method !== networkMethodFilter) return false;
        if (networkStatusFilter?.value !== 'ALL' && Math.floor(status / 100) !== Number(networkStatusFilter.value)) return false;
        if (networkSlowFilter?.checked && duration <= 1000) return false;
        if (networkTypeFilter?.value !== 'ALL') {
          const expected = networkTypeFilter.value;
          const matchesType = expected === 'API' ? ['FETCH', 'XHR', 'XMLHTTPREQUEST'].includes(resourceType) : expected === 'SOCKET' ? ['WEBSOCKET', 'EVENTSOURCE'].includes(resourceType) : expected === 'STYLE' ? ['STYLE', 'STYLESHEET'].includes(resourceType) : resourceType === expected;
          if (!matchesType) return false;
        }
        if (networkDomainFilter?.value !== 'ALL') {
          let isInternal = true;
          try { isInternal = new URL(url).origin === new URL(activeTabUrl).origin; } catch (error) {}
          if (networkDomainFilter.value === 'INTERNAL' && !isInternal) return false;
          if (networkDomainFilter.value === 'THIRD_PARTY' && isInternal) return false;
        }
        return true;
      }
      if (activeFilter === 'SLOW') return l.type === 'network_slow' || (l.details?.durationMs || 0) >= 2000;
      return true;
    }).filter(l => {
      if (!logSearchTerm) return true;
      return `${l.type} ${l.message} ${l.details?.method || ''} ${l.details?.status || ''} ${l.details?.url || ''}`.toLowerCase().includes(logSearchTerm);
    });
  }

  async function copyLogText(text, successMessage) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      const fallback = document.createElement('textarea');
      fallback.value = text;
      fallback.style.position = 'fixed';
      fallback.style.opacity = '0';
      document.body.appendChild(fallback);
      fallback.select();
      if (!document.execCommand('copy')) { fallback.remove(); throw error; }
      fallback.remove();
    }
    announce(successMessage);
  }

  function renderLogs(logs) {
    updateControlAvailability();
    const filtered = getFilteredLogs(logs);

    if (!filtered.length) {
      logListEl.innerHTML = `<div class="bento-empty-state"><div class="empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 11 12 14 22 4"/></svg></div><p>Belum ada log terdeteksi.</p><span>Console errors, HTTP failures, dan API response body akan muncul di sini.</span></div>`;
      return;
    }

    // Optimasi performa render: Batasi log yang ditampilkan maksimal 150
    const MAX_LOGS = 150;
    const displayLogs = filtered.slice(0, MAX_LOGS);
    const hasMoreLogs = filtered.length > MAX_LOGS;

    const logHtmlChunks = displayLogs.map(log => {
      const severity = log.severity || 'LOW';
      const typeLabels = { console_error: 'Console Error', console_warn: 'Console Warning', uncaught_exception: 'Unhandled Exception', network_error: 'Network Error', network_slow: 'Slow Request', network_request: 'Network Request', network_resource: 'Resource', network_socket: 'Live Connection' };
      const typeLabel = typeLabels[log.type] || String(log.type || 'Log').replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase());
      const countHtml = (log.count && log.count > 1) ? `<span class="log-count">(x${log.count})</span>` : '';
      const severityHtml = `<span class="severity-badge severity-${severity}">${severity}</span>`;
      const curlButton = ['network_request', 'network_error', 'network_slow', 'network_resource'].includes(log.type) ? `<button class="log-copy-btn btn-copy-log-curl" data-log-id="${escapeHTML(log.id)}" title="Salin sebagai cURL" aria-label="Salin request sebagai cURL">cURL</button>` : '';

      // Response body viewer (P1)
      let bodyHtml = '';
      if (log.details?.responseBody) {
        bodyHtml += `<div class="log-body"><strong>Response:</strong>\n${escapeHTML(log.details.responseBody)}</div>`;
      }
      if (log.details?.requestBody) {
        bodyHtml += `<div class="log-body"><strong>Request:</strong>\n${escapeHTML(log.details.requestBody)}</div>`;
      }
      if (['network_request', 'network_error', 'network_slow', 'network_resource', 'network_socket'].includes(log.type)) {
        const status = Number(log.details?.status || 0);
        const statusClass = status >= 500 ? 'network-status-5xx' : status >= 400 ? 'network-status-4xx' : status >= 300 ? 'network-status-3xx' : status >= 200 ? 'network-status-2xx' : 'network-status-offline';
        const size = Number(log.details?.responseSize || 0);
        bodyHtml = `<div class="network-log-meta"><b>${escapeHTML(log.details?.method || 'GET')}</b><span class="${statusClass}">${status || 'ERR'}</span><span>${Math.round(Number(log.details?.durationMs || 0))}ms</span>${size ? `<span>${size >= 1024 ? `${(size / 1024).toFixed(1)}KB` : `${size}B`}</span>` : ''}</div>` + bodyHtml;
      }

      return `
        <div class="log-item ${log.type}" data-log-id="${escapeHTML(log.id)}">
          <div class="log-header">
            <span>${severityHtml} <span class="log-type-label">${escapeHTML(typeLabel)}</span> ${countHtml}</span>
            <div class="log-header-actions"><span class="log-time">${new Date(log.timestamp).toLocaleTimeString(window.QAI18n?.locale?.() || 'id-ID')}</span>${curlButton}<button class="log-copy-btn btn-copy-log-message" data-log-id="${escapeHTML(log.id)}" title="Salin pesan" aria-label="Salin pesan log"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button><button class="log-copy-btn btn-copy-log-json" data-log-id="${escapeHTML(log.id)}" title="Salin detail JSON" aria-label="Salin detail lengkap log">{ }</button></div>
          </div>
          <div class="log-msg">${escapeHTML(log.message)}</div>
          ${bodyHtml}
        </div>`;
    });
    
    let finalLogHtml = logHtmlChunks.join('');
    if (hasMoreLogs) {
      finalLogHtml += `<div style="text-align:center; padding: 10px; font-size: 12px; color: var(--text-muted);">+ ${filtered.length - MAX_LOGS} log terlama tersembunyi demi performa.</div>`;
    }
    logListEl.innerHTML = finalLogHtml;

    logListEl.querySelectorAll('.btn-copy-log-message').forEach(button => button.addEventListener('click', async () => {
      const log = currentState.logs.find(item => item.id === button.dataset.logId);
      if (log) await copyLogText(log.message, 'Pesan log disalin');
    }));
    logListEl.querySelectorAll('.btn-copy-log-json').forEach(button => button.addEventListener('click', async () => {
      const log = currentState.logs.find(item => item.id === button.dataset.logId);
      if (log) await copyLogText(JSON.stringify(log, null, 2), 'Detail log disalin');
    }));
    logListEl.querySelectorAll('.btn-copy-log-curl').forEach(button => button.addEventListener('click', async () => {
      const log = currentState.logs.find(item => item.id === button.dataset.logId);
      if (!log) return;
      const details = log.details || {};
      const quote = value => `'${String(value ?? '').replaceAll("'", "'\\''")}'`;
      const headers = Object.entries(details.requestHeaders || {}).map(([name, value]) => `-H ${quote(`${name}: ${value}`)}`).join(' ');
      const data = details.requestBody ? `--data-raw ${quote(details.requestBody)}` : '';
      await copyLogText(`curl -X ${String(details.method || 'GET').toUpperCase()} ${headers} ${data} ${quote(details.url || log.url || '')}`.replace(/\s+/g, ' ').trim(), 'cURL disalin');
    }));
  }

  btnClearHistory?.addEventListener('click', async () => {
    const ok = await showBentoConfirm('Hapus Riwayat', 'Hapus seluruh riwayat eksekusi tes?', { icon: '🗑', danger: true, confirmText: 'Hapus Semua' });
    if (ok) {
      chrome.runtime.sendMessage({ action: 'CLEAR_EXECUTION_HISTORY' }, (res) => {
        if (res?.status === 'SUCCESS') {
          currentState.executionHistory = [];
          renderExecutionHistory();
        }
      });
    }
  });

  function renderExecutionHistory() {
    renderQualityInsights();
    if (!currentState.executionHistory?.length) {
      executionHistoryList.innerHTML = '<p class="text-muted" style="font-size:11px;text-align:center;padding:12px;">Belum ada riwayat.</p>';
      return;
    }

    executionHistoryList.innerHTML = currentState.executionHistory.map((h, idx) => {
      const dt = new Date(h.startTime).toLocaleString(window.QAI18n?.locale?.() || 'id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const dur = h.durationMs ? `${(h.durationMs / 1000).toFixed(1)}s` : '-';
      return `
        <div class="history-item">
          <div class="history-left-group">
            <span class="history-status ${h.status}">${h.status === 'COMPLETED' ? '✅' : '❌'}</span>
            <span class="history-name-text">${escapeHTML(h.suiteName || 'Suite')}</span>
          </div>
          <div class="history-right-group">
            <div class="history-meta-text">
              <span class="stat-pass">${h.passedSteps}</span><span class="stat-slash">/</span><span class="stat-fail">${h.failedSteps}</span>
              <span class="stat-dur">${dur}</span>
            </div>
            <div class="history-date">${dt}</div>
          </div>
          <button class="btn-delete-history-item" data-id="${h.id}" data-index="${idx}" title="Hapus Riwayat Ini">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>`;
    }).join('');

    document.querySelectorAll('.btn-delete-history-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const idx = parseInt(e.currentTarget.dataset.index);
        chrome.runtime.sendMessage({ action: 'DELETE_EXECUTION_HISTORY_ITEM', payload: { id, index: idx } }, (res) => {
          if (res?.status === 'SUCCESS') {
            currentState.executionHistory = res.history || [];
            renderExecutionHistory();
          }
        });
      });
    });
  }

  function renderVideoHistory() {
    const videoHistoryList = document.getElementById('videoHistoryList');
    if (!videoHistoryList) return;
    
    if (!currentState.videoHistory?.length) {
      const msg = window.QAI18n?.getText?.('Belum ada riwayat video.') || 'Belum ada riwayat video.';
      videoHistoryList.innerHTML = `<p class="text-muted" style="font-size:11px;text-align:center;padding:12px;">${msg}</p>`;
      return;
    }

    const titleClick = window.QAI18n?.getText?.('Klik untuk memutar video') || 'Klik untuk memutar video';
    const defLabel = window.QAI18n?.getText?.('Rekaman Layar') || 'Rekaman Layar';
    videoHistoryList.innerHTML = currentState.videoHistory.map((h, idx) => {
      return `
        <div class="history-item video-history-item" data-url="${h.url}" style="cursor:pointer;" title="${titleClick}">
          <div class="history-left-group">
            <span class="history-status COMPLETED">🎥</span>
            <span class="history-name-text">${escapeHTML(h.label || defLabel)}</span>
          </div>
          <div class="history-right-group">
            <div class="history-date">${escapeHTML(h.timestamp)}</div>
          </div>
        </div>`;
    }).join('');

    document.querySelectorAll('.video-history-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const url = e.currentTarget.dataset.url;
        if (url) showVideoHistoryPreviewUI(url);
      });
    });
  }

  function showVideoHistoryPreviewUI(url) {
    const modal = document.getElementById('qaVideoPreviewModal');
    const player = document.getElementById('qaVideoPlayer');
    const stateUpload = document.getElementById('qaVideoUploadState');
    const stateSuccess = document.getElementById('qaVideoSuccessState');
    const stateError = document.getElementById('qaVideoErrorState');
    const linkInput = document.getElementById('qaVideoLinkInput');
    const copyBtn = document.getElementById('qaVideoCopyBtn');
    const closeBtn = document.getElementById('qaVideoClose');

    // Reset UI
    modal.classList.remove('hidden');
    player.classList.remove('hidden');
    player.src = url; // load remote URL directly
    stateUpload.classList.add('hidden');
    stateSuccess.classList.remove('hidden');
    stateError.classList.add('hidden');
    
    // Change text for history view to avoid confusion
    const successText = stateSuccess.querySelector('.premium-success-text');
    if (successText) successText.textContent = window.QAI18n?.getText?.('Riwayat Rekaman') || 'Riwayat Rekaman';
    
    linkInput.value = url;

    const doClose = () => {
      modal.classList.add('hidden');
      modal.classList.remove('is-fullscreen-modal');
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      player.pause();
      player.src = '';
    };
    closeBtn.onclick = doClose;

    copyBtn.onclick = () => {
      navigator.clipboard.writeText(url).then(() => {
        if (copyBtn.classList.contains('success')) return; // Prevent double-click bugs
        const origText = copyBtn.textContent;
        copyBtn.textContent = (window.QAI18n?.getText?.('Disalin! ✅') || 'Disalin! ✅');
        copyBtn.classList.add('success');
        setTimeout(() => {
          copyBtn.textContent = origText;
          copyBtn.classList.remove('success');
        }, 2000);
      });
    };
  }

  function renderQualityInsights() {
    if (!qualityInsights) return;
    const outcomes = (currentState.executionHistory || []).flatMap(run => run.stepOutcomes || []);
    const byStep = new Map();
    outcomes.forEach(outcome => {
      const stats = byStep.get(outcome.stepId) || { index: outcome.stepIndex, passed: 0, failed: 0, durations: [] };
      if (outcome.status === 'FAILED') stats.failed++;
      else stats.passed++;
      stats.durations.push(outcome.durationMs || 0);
      byStep.set(outcome.stepId, stats);
    });
    const flaky = [...byStep.values()].filter(stats => stats.failed && stats.passed).length;
    const slowest = [...byStep.values()].map(stats => ({ ...stats, avg: stats.durations.reduce((sum, value) => sum + value, 0) / stats.durations.length })).sort((a, b) => b.avg - a.avg)[0];
    if (!outcomes.length) {
      qualityInsights.classList.add('hidden');
      return;
    }
    qualityInsights.textContent = `${flaky ? `⚠ ${flaky} flaky` : '✓ stabil'}${slowest ? ` · ⏱ #${slowest.index} ${Math.round(slowest.avg)}ms` : ''}`;
    qualityInsights.classList.remove('hidden');
  }

  function renderMonitorStatus() {
    if (!monitorStatus) return;
    const status = currentState.monitorStatus || {};
    const isCurrentTab = status.tabId === activeTabId;
    const active = status.active && isCurrentTab;
    monitorStatus.className = `monitor-status ${active ? 'is-active' : status.error && isCurrentTab ? 'is-error' : ''}`;
    monitorStatusText.textContent = active ? 'Monitor aktif' : status.error && isCurrentTab ? 'Monitor gagal' : 'Menunggu halaman';
    monitorStatus.title = status.error || '';
    if (btnTestMonitor) {
      btnTestMonitor.title = active ? 'Hentikan monitor' : 'Aktifkan dan tes monitor';
      btnTestMonitor.setAttribute('aria-label', btnTestMonitor.title);
      btnTestMonitor.setAttribute('aria-pressed', String(active));
    }
  }

  function renderQaReadiness() {
    if (!qaReadiness) return;
    const suite = getActiveSuiteObj();
    const requirements = suite?.requirements || [];
    const coveredIds = new Set((suite?.steps || []).flatMap(step => step.requirementIds || []));
    const coverage = requirements.length ? Math.round(requirements.filter(item => coveredIds.has(item.id)).length / requirements.length * 100) : 0;
    const defects = (currentState.defects || []).filter(item => item.suiteId === suite?.id);
    const blockers = defects.filter(item => ['OPEN', 'IN_PROGRESS'].includes(item.status) && ['CRITICAL', 'HIGH'].includes(item.severity));
    const sessions = (currentState.exploratorySessions || []).filter(item => item.suiteId === suite?.id).length;
    const outcomes = (currentState.executionHistory || []).filter(item => item.suiteId === suite?.id).flatMap(item => item.stepOutcomes || []);
    const grouped = new Map();
    outcomes.forEach(item => { const states = grouped.get(item.stepId) || new Set(); states.add(item.status); grouped.set(item.stepId, states); });
    const flaky = [...grouped.values()].filter(states => states.has('FAILED') && states.size > 1).length;
    qaReadiness.innerHTML = `<div class="qa-readiness-item"><b>${coverage}%</b><span>Coverage</span></div><div class="qa-readiness-item"><b>${blockers.length}</b><span>Blocker</span></div><div class="qa-readiness-item"><b>${flaky}</b><span>Flaky</span></div><div class="qa-readiness-item"><b>${requirements.length}</b><span>Requirement</span></div><div class="qa-readiness-item"><b>${defects.length}</b><span>Defect</span></div><div class="qa-readiness-item"><b>${sessions}</b><span>Session</span></div>${(!requirements.length || blockers.length) ? `<div class="qa-readiness-alert">${!requirements.length ? 'Requirement belum dipetakan.' : `${blockers.length} blocker harus ditutup atau diberi override.`}</div>` : ''}`;
  }

  function updateLogBadge() {
    const errorCount = currentState.logs.filter(l => ['console_error', 'uncaught_exception', 'network_error'].includes(l.type)).length;
    if (errorCount > 0) { logBadgeCount.textContent = errorCount; logBadgeCount.classList.remove('hidden'); }
    else logBadgeCount.classList.add('hidden');
  }

  function updateReportSummary(results = {}) {
    const hasResults = results && results.status;
    sumTotalSteps.textContent = hasResults ? (results.totalSteps || 0) : (getActiveSteps().length || 0);
    sumPassedSteps.textContent = hasResults ? (results.passedSteps || 0) : 0;
    sumFailedSteps.textContent = hasResults ? (results.failedSteps || 0) : 0;
    sumStatus.textContent = hasResults ? results.status : '-';
    sumStatus.className = 'metric-value ' + (hasResults && results.status === 'COMPLETED' ? 'text-success' : hasResults && results.status === 'FAILED' ? 'text-danger' : 'text-muted');
  }

  function showExecutionBanner(show, state = 'running', title = '', detail = '', pct = 0) {
    if (!show) { executionBanner.classList.add('hidden'); return; }
    const icons = {
      running: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-3-6.7"/></svg>',
      passed: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m5 12 4 4L19 6"/></svg>',
      failed: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 8v5M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>'
    };
    executionBanner.className = `bento-banner is-${state}`;
    bannerIcon.innerHTML = icons[state] || icons.running;
    bannerText.textContent = title;
    bannerDetail.innerHTML = detail;
    progressBar.style.width = `${pct}%`;
    progressBar.setAttribute('aria-valuenow', String(Math.max(0, Math.min(100, pct))));

    const btnExportBugBanner = document.getElementById('btnExportBugModalOpen');
    if (btnExportBugBanner) {
      if (state === 'failed') {
        btnExportBugBanner.classList.remove('hidden');
      } else {
        btnExportBugBanner.classList.add('hidden');
      }
    }
  }

  function updateControlAvailability() {
    const hasSuite = Boolean(getActiveSuiteObj());
    const hasMultipleSuites = (currentState.suites?.length || 0) > 1;
    const hasSteps = getActiveSteps().length > 0;
    const hasLogs = (currentState.logs?.length || 0) > 0;
    const controls = [
      [btnDupSuite, !hasSuite, 'Tidak ada suite aktif'],
      [btnRenameSuite, !hasSuite, 'Tidak ada suite aktif'],
      [btnSuiteSettings, !hasSuite, 'Tidak ada suite aktif'],
      [btnDeleteSuite, !hasMultipleSuites, 'Minimal satu suite harus tetap tersedia'],
      [btnRunSuite, !hasSteps, 'Tambahkan langkah tes terlebih dahulu'],
      [btnClearSteps, !hasSteps, 'Belum ada langkah untuk dihapus'],
      [btnExportPlaywright, !hasSteps, 'Belum ada langkah untuk diekspor'],
      [btnExportCypress, !hasSteps, 'Belum ada langkah untuk diekspor'],
      [btnExportJSON, !hasSuite, 'Tidak ada suite untuk diekspor'],
      [btnCopyLogs, !hasLogs, 'Belum ada log untuk disalin'],
      [btnClearLogs, !hasLogs, 'Belum ada log untuk dihapus']
    ];
    controls.forEach(([element, disabled, reason]) => {
      if (!element) return;
      if (element.dataset.originalTitle === undefined) element.dataset.originalTitle = element.getAttribute('title') || '';
      element.disabled = disabled;
      if (disabled) {
        element.dataset.disabledReason = reason;
        element.title = reason;
      } else {
        delete element.dataset.disabledReason;
        if (element.dataset.originalTitle) element.title = element.dataset.originalTitle;
        else element.removeAttribute('title');
      }
    });
  }

  function highlightActiveExecutingStep(stepIndex) {
    document.querySelectorAll('.step-card').forEach(card => {
      card.classList.toggle('active-executing', parseInt(card.dataset.stepIndex) === stepIndex);
    });
  }

  function updateRecordingUI(recording) {
    btnRecord.classList.toggle('recording', recording);
    btnRecord.setAttribute('aria-pressed', String(recording));
    btnRecord.setAttribute('aria-label', recording ? 'Hentikan rekaman' : 'Mulai rekaman');
    btnRecord.title = recording ? 'Sedang merekam · klik untuk berhenti' : 'Mulai merekam langkah tes';
    btnRecordText.textContent = recording ? 'Stop' : 'Rekam';
    if (!recording) renderRecorderReadiness(recorderReadiness);
  }

  // ========================================
  // STATE HELPERS
  // ========================================
  function getActiveSuiteObj() {
    return currentState.suites?.find(s => s.id === currentState.activeSuiteId) || null;
  }

  function getActiveSteps() {
    return getActiveSuiteObj()?.steps || [];
  }

  function fetchInitialState() {
    chrome.runtime.sendMessage({ action: 'GET_STATE' }, (res) => {
      if (res?.status === 'SUCCESS' && res.data) {
        currentState = res.data;
        updateRecordingUI(currentState.isRecording);
        renderSuiteSelector();
        renderEnvironmentSelector();
        renderDatasetSelector();
        renderSteps(getActiveSteps());
        renderLogs(currentState.logs);
        updateReportSummary(currentState.executionResults);
        updateLogBadge();
        renderExecutionHistory();
        renderVideoHistory();
        renderMonitorStatus();
        if (networkBodyCaptureCheck) networkBodyCaptureCheck.checked = currentState.monitorOptions?.captureBodies === true;
        if (recordVideoCheck) recordVideoCheck.setAttribute('aria-pressed', String(currentState.videoSettings?.autoRecord === true));
        if (stopOnErrorCheck) stopOnErrorCheck.setAttribute('aria-pressed', String(currentState.runOptions?.stopOnError !== false));
        if (stepDelayInput && currentState.runOptions?.stepDelay != null) stepDelayInput.value = currentState.runOptions.stepDelay;
        const autoRetrySel = document.getElementById('autoRetrySelect');
        if (autoRetrySel && currentState.runOptions?.autoRetryCount != null) autoRetrySel.value = currentState.runOptions.autoRetryCount;
        renderQaReadiness();
        if (currentState.networkStatus) renderVPNStatus(currentState.networkStatus);
      }
    });
  }

  function fetchExecutionHistory() {
    chrome.runtime.sendMessage({ action: 'GET_EXECUTION_HISTORY' }, (res) => {
      if (res?.status === 'SUCCESS') {
        currentState.executionHistory = res.history;
        renderExecutionHistory();
        renderQaReadiness();
      }
    });
  }

  // ========================================
  // CODE GENERATORS
  // ========================================
  // Pure generators moved to sidepanel/codegen.js (loaded before sidepanel.js):
  //   jsLiteral, safeCodeComment, generatePlaywrightCode, generateCypressCode
  // They are plain functions in the shared global scope, so callers below can
  // still invoke generatePlaywrightCode(...) / generateCypressCode(...).

  // ========================================
  // UTILITIES
  // ========================================
  function validateImportedSteps(input) {
    if (!Array.isArray(input)) throw new Error('Daftar langkah harus berupa array.');
    if (input.length > 500) throw new Error('Maksimal 500 langkah per file.');
    return input.map((step, index) => {
      if (!step || typeof step !== 'object' || !allowedActions.has(step.action)) {
        throw new Error(`Aksi pada langkah ${index + 1} tidak valid.`);
      }
      const clean = value => String(value ?? '').slice(0, 5000);
      const smart = step.smart && typeof step.smart === 'object' ? step.smart : {};
      return {
        id: clean(step.id),
        action: step.action,
        selector: clean(step.selector),
        fallbackSelectors: Array.isArray(step.fallbackSelectors) ? step.fallbackSelectors.slice(0, 8).map(clean) : [],
        frame: step.frame && typeof step.frame === 'object' ? {
          url: clean(step.frame.url).slice(0, 2000),
          name: clean(step.frame.name).slice(0, 120),
          isTop: step.frame.isTop !== false,
          frameId: Math.max(0, Number(step.frame.frameId) || 0)
        } : null,
        smart: {
          confidence: Math.max(0, Math.min(100, Number(smart.confidence) || 0)),
          autoWait: ['none', 'dom', 'url', 'network'].includes(smart.autoWait) ? smart.autoWait : 'none',
          reviewStatus: ['pending', 'validated', 'failed'].includes(smart.reviewStatus) ? smart.reviewStatus : 'pending',
          assertionSuggestion: smart.assertionSuggestion && typeof smart.assertionSuggestion === 'object' ? { action: clean(smart.assertionSuggestion.action), selector: clean(smart.assertionSuggestion.selector), value: clean(smart.assertionSuggestion.value), reason: clean(smart.assertionSuggestion.reason) } : null,
          network: smart.network && typeof smart.network === 'object' ? { method: clean(smart.network.method).slice(0, 12), status: Number(smart.network.status) || 0, url: clean(smart.network.url), durationMs: Number(smart.network.durationMs) || 0 } : null
        },
        value: clean(step.value),
        description: clean(step.description),
        notes: clean(step.notes),
        originalRecordedValue: clean(step.originalRecordedValue),
        group: clean(step.group),
        enabled: step.enabled !== false,
        timeout: Math.max(250, Math.min(60000, parseInt(step.timeout, 10) || 5000)),
        performanceThreshold: Math.max(100, Math.min(120000, parseInt(step.performanceThreshold, 10) || 3000)),
        timestamp: /^\d{4}-\d{2}-\d{2}T/.test(String(step.timestamp || '')) ? step.timestamp : new Date().toISOString()
      };
    });
  }

  function downloadFile(content, fileName, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
  }

  async function encryptHTMLReport(html, password) {
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
    const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(html)));
    // Fix Call Stack Error on large reports by using FileReader instead of spread operator
    const b64 = async bytes => new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(new Blob([bytes]));
    });
    const saltB64 = await b64(salt);
    const ivB64 = await b64(iv);
    const cipherB64 = await b64(cipher);
    return `<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Encrypted QA Report</title><style>body{margin:0;background:#f3f6fa;color:#172033;font:14px system-ui;display:grid;place-items:center;min-height:100vh}.box{width:min(360px,calc(100% - 32px));background:white;border:1px solid #dce2ea;border-radius:16px;padding:24px;box-shadow:0 16px 40px #17203318}h1{font-size:18px;margin:0 0 6px}p{color:#667085}input,button{box-sizing:border-box;width:100%;height:42px;border-radius:9px}input{border:1px solid #cbd5e1;padding:0 12px}button{margin-top:10px;border:0;background:#2563eb;color:white;font-weight:700}.error{color:#b42318;font-size:12px}</style><div class="box"><h1>Protected QA Report</h1><p>Masukkan password untuk membuka report.</p><input id="p" type="password" autocomplete="current-password" autofocus><button id="b">Buka report</button><div id="e" class="error"></div></div><script>const salt='${saltB64}',iv='${ivB64}',data='${cipherB64}',u=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));b.onclick=async()=>{e.textContent='';try{const m=await crypto.subtle.importKey('raw',new TextEncoder().encode(p.value),'PBKDF2',false,['deriveKey']);const k=await crypto.subtle.deriveKey({name:'PBKDF2',salt:u(salt),iterations:210000,hash:'SHA-256'},m,{name:'AES-GCM',length:256},false,['decrypt']);const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:u(iv)},k,u(data));document.open();document.write(new TextDecoder().decode(plain));document.close()}catch(x){e.textContent='Password salah atau file rusak.'}};p.addEventListener('keydown',x=>{if(x.key==='Enter')b.click()});<\/script></html>`;
  }

  // Pure helpers moved to sidepanel/render.js (loaded before sidepanel.js):
  //   findHardcodedSecret, escapeHTML — available in the shared global scope.

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  function sendRuntimeMessage(action, payload = {}) {
    const contract = window.QAContracts?.validateMessage({ action, payload });
    if (contract && !contract.valid) return Promise.reject(new Error(contract.error));
    return new Promise((resolve, reject) => chrome.runtime.sendMessage({ action, payload }, response => {
      if (chrome.runtime.lastError) reject(new Error(`${chrome.runtime.lastError.message}. Reload extension lalu coba lagi.`));
      else resolve(response);
    }));
  }

  // escapeHTML moved to sidepanel/render.js (shared global scope).

  // ==========================================
  // VIDEO SETTINGS UI — moved to sidepanel/video-settings.js (reads window.QAFlow.ui)
  // ==========================================

  // ==========================================
  // AI SETTINGS UI — moved to sidepanel/ai-settings.js (reads window.QAFlow.ui)
  // ==========================================

  function showVideoPreviewUI(blob, resultObj, hasUploadUrl = false) {
    const modal = document.getElementById('qaVideoPreviewModal');
    const player = document.getElementById('qaVideoPlayer');
    const stateUpload = document.getElementById('qaVideoUploadState');
    const stateSuccess = document.getElementById('qaVideoSuccessState');
    const stateError = document.getElementById('qaVideoErrorState');
    const linkInput = document.getElementById('qaVideoLinkInput');
    const copyBtn = document.getElementById('qaVideoCopyBtn');
    const closeBtn = document.getElementById('qaVideoClose');

    // Reset UI
    modal.classList.remove('hidden');
    player.classList.remove('hidden');
    player.src = URL.createObjectURL(blob);
    stateSuccess.classList.add('hidden');
    stateError.classList.add('hidden');

    // Always wire close button FIRST
    const doClose = () => {
      modal.classList.add('hidden');
      modal.classList.remove('is-fullscreen-modal');
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      player.pause();
      if (player.src && player.src.startsWith('blob:')) {
        URL.revokeObjectURL(player.src);
      }
      player.src = '';
      const spinner = stateUpload.querySelector('.video-spinner');
      if (spinner) spinner.style.display = '';
    };
    closeBtn.onclick = doClose;

    const uploadPromise = resultObj?.uploadPromise || Promise.resolve(null);
    const percentEl = document.getElementById('qaVideoUploadPercent');
    const progressBar = document.getElementById('qaVideoProgressBar');

    const updatePct = (pct) => {
      if (percentEl) percentEl.textContent = `${pct}%`;
      if (progressBar) progressBar.style.width = `${pct}%`;
    };
    updatePct(0);

    if (resultObj && typeof resultObj.setOnProgress === 'function') {
      resultObj.setOnProgress(updatePct);
    }

    if (hasUploadUrl) {
      stateUpload.classList.remove('hidden');
    } else {
      stateUpload.classList.remove('hidden');
      stateUpload.querySelector('.video-spinner').style.display = 'none';
      stateUpload.querySelector('p').innerHTML = `
        ⚠️ URL Upload belum dikonfigurasi.<br>
        <button id="btnOpenVideoSettingsInline" class="bento-btn bento-btn-primary" style="margin-top:10px;font-size:11px;padding:6px 12px;cursor:pointer;">
          ⚙️ Atur Video Settings Sekarang
        </button>
      `;
      document.getElementById('btnOpenVideoSettingsInline')?.addEventListener('click', () => {
        doClose();
        document.getElementById('btnVideoSettings')?.click();
      });
      return;
    }

    // Artificial delay for UX (minimum 1.5 seconds) to prevent flash of loading state
    const minDelay = new Promise(resolve => setTimeout(resolve, 1500));
    
    Promise.all([uploadPromise, minDelay]).then(([res]) => {
      stateUpload.classList.add('hidden');
      if (res && res.url) {
        stateSuccess.classList.remove('hidden');
        const successText = stateSuccess.querySelector('.premium-success-text');
        if (successText) successText.textContent = window.QAI18n?.getText?.('Berhasil diunggah!') || 'Berhasil diunggah!';
        linkInput.value = res.url;
        
        // Save to video history
        const now = new Date();
        const pad = n => n.toString().padStart(2, '0');
        const timestamp = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
        const entry = {
          id: 'vid_' + Date.now(),
          url: res.url,
          timestamp,
          label: `Screen Record - ${timestamp}`
        };
        chrome.runtime.sendMessage({ action: 'ADD_VIDEO_HISTORY', payload: { entry } });
        if (!currentState.videoHistory) currentState.videoHistory = [];
        currentState.videoHistory.unshift(entry);
        renderVideoHistory(); // Update UI
        
        copyBtn.onclick = () => {
          navigator.clipboard.writeText(res.url).then(() => {
            if (copyBtn.classList.contains('success')) return; // Prevent double-click bugs
            const origText = copyBtn.textContent;
            copyBtn.textContent = (window.QAI18n?.getText?.('Disalin! ✅') || 'Disalin! ✅');
            copyBtn.classList.add('success');
            setTimeout(() => {
              copyBtn.textContent = origText;
              copyBtn.classList.remove('success');
            }, 2000);
          });
        };
      } else {
        stateError.classList.remove('hidden');
        document.getElementById('qaVideoErrorMsg').textContent = res
          ? (window.QAI18n?.getText?.('Server tidak mengembalikan URL video. Cek konfigurasi PHP di cPanel Anda.') || 'Server tidak mengembalikan URL video. Cek konfigurasi PHP di cPanel Anda.')
          : (window.QAI18n?.getText?.('Upload gagal atau URL tidak dikonfigurasi.') || 'Upload gagal atau URL tidak dikonfigurasi.');
      }
    }).catch(err => {
      stateUpload.classList.add('hidden');
      stateError.classList.remove('hidden');
      let msg = err.message || (window.QAI18n?.getText?.('Gagal mengunggah video.') || 'Gagal mengunggah video.');
      if (msg.includes('404')) {
        const error404 = window.QAI18n?.getText?.('HTTP 404 (File tidak ditemukan)') || 'HTTP 404 (File tidak ditemukan)';
        const errorPHP = window.QAI18n?.getText?.('File qa-upload.php belum di-upload ke server cPanel Anda.') || 'File qa-upload.php belum di-upload ke server cPanel Anda.';
        msg = `<b>${error404}:</b><br>${errorPHP}<br><small>Upload file <code>qa-upload.php</code> ke folder <b>public_html</b> di domain <b>cloud.duniakuaja.my.id</b>.</small>`;
      } else {
        const checkTxt = window.QAI18n?.getText?.('Cek / Edit Video Settings') || 'Cek / Edit Video Settings';
        msg = `❌ ${msg}<br><button id="btnFixVideoSettingsInline" class="bento-btn bento-btn-ghost warning" style="margin-top:10px;font-size:10px;padding:5px 10px;cursor:pointer;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:2px; margin-bottom:-1px"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> ${checkTxt}</button>`;
      }
      document.getElementById('qaVideoErrorMsg').innerHTML = msg;
      document.getElementById('btnFixVideoSettingsInline')?.addEventListener('click', () => {
        doClose();
        document.getElementById('btnVideoSettings')?.click();
      });
    });
  }

  // ==========================================
  // VIDEO PLAYER FULLSCREEN & NEW TAB HANDLERS
  // ==========================================
  const qaVideoFullscreenToggle = document.getElementById('qaVideoFullscreenToggle');
  const qaVideoOpenTabBtn = document.getElementById('qaVideoOpenTabBtn');
  const qaVideoPreviewModal = document.getElementById('qaVideoPreviewModal');
  const qaVideoPlayer = document.getElementById('qaVideoPlayer');

  function toggleVideoFullscreen() {
    if (!qaVideoPreviewModal) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      qaVideoPreviewModal.classList.remove('is-fullscreen-modal');
    } else {
      if (qaVideoPlayer && typeof qaVideoPlayer.requestFullscreen === 'function') {
        qaVideoPlayer.requestFullscreen().then(() => {
          // Native fullscreen succeeded
        }).catch(() => {
          // Blocked by Sidepanel API policy -> use custom extension modal fullscreen
          qaVideoPreviewModal.classList.toggle('is-fullscreen-modal');
        });
      } else {
        qaVideoPreviewModal.classList.toggle('is-fullscreen-modal');
      }
    }
  }

  qaVideoFullscreenToggle?.addEventListener('click', toggleVideoFullscreen);
  qaVideoPlayer?.addEventListener('dblclick', toggleVideoFullscreen);

  qaVideoOpenTabBtn?.addEventListener('click', () => {
    const linkInput = document.getElementById('qaVideoLinkInput');
    const url = linkInput?.value || qaVideoPlayer?.src;
    if (url) {
      chrome.tabs.create({ url });
    }
  });

});
// Video Recording & Upload Module
let activeMediaRecorder = null;
let recordedChunks = [];

async function startVideoRecording(tabId) {
  return new Promise((resolve, reject) => {
    navigator.mediaDevices.getDisplayMedia({
      audio: false,
      video: { displaySurface: 'browser' }
    }).then(stream => {
      recordedChunks = [];
      const track = stream.getVideoTracks()[0];
      if (track && track.applyConstraints) {
        track.applyConstraints({ frameRate: { max: 10 } }).catch(() => {});
      }
      const options = { videoBitsPerSecond: 300000 }; // 300 kbps = ultra tiny file size (~300KB) for instant upload
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
        options.mimeType = 'video/webm;codecs=vp8';
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        options.mimeType = 'video/webm';
      }
      activeMediaRecorder = new MediaRecorder(stream, options);
      
      activeMediaRecorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) recordedChunks.push(e.data);
      };
      
      activeMediaRecorder.start(2000);
      resolve(true);
    }).catch(err => {
      reject(err);
    });
  });
}

async function stopVideoRecordingAndUpload(uploadUrl, apiKey, onProgress) {
  return new Promise((resolve) => {
    if (!activeMediaRecorder || activeMediaRecorder.state === 'inactive') {
      return resolve(null);
    }
    
    // Save the stream reference BEFORE onstop fires (after stop(), stream may be GC'd)
    const stream = activeMediaRecorder.stream;

    activeMediaRecorder.onstop = () => {
      // Stop all tracks to release the screen share
      if (stream) stream.getTracks().forEach(track => track.stop());
      activeMediaRecorder = null;
      
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      recordedChunks = [];
      
      const targetUrl = uploadUrl || 'https://cloud.duniakuaja.my.id/qa-upload.php';
      const targetKey = apiKey || '';
      
      let progressCb = onProgress;

      const uploadPromise = new Promise((res, rej) => {
        if (!blob || blob.size === 0) {
          return rej(new Error(window.QAI18n?.getText?.('Rekaman video 0 byte. Pastikan izin rekam layar diberikan.') || 'Rekaman video 0 byte. Pastikan izin rekam layar diberikan.'));
        }

        const xhr = new XMLHttpRequest();
        xhr.open('POST', targetUrl, true);
        if (targetKey) xhr.setRequestHeader('X-API-Key', targetKey);

        // Two-phase timeout to fix "video uploaded to cPanel but status = failed/timeout":
        // 1) UPLOAD PHASE — generous (>= 120s, scaled to blob size) because a slow
        //    upload link can take a while to push the video body. Previously a single
        //    30s timeout covered the ENTIRE request, so a slow upload aborted the XHR
        //    ("timeout") even though cPanel had already received and saved the file.
        // 2) RESPONSE PHASE — normal 30s once the body has been fully transmitted.
        let uploadPhase = true;
        xhr.timeout = Math.max(120000, Math.round((blob.size || 0) / 512));

        xhr.upload.onload = () => {
          uploadPhase = false;
          xhr.timeout = 30000;
        };

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && e.total > 0) {
            const percent = Math.min(100, Math.round((e.loaded / e.total) * 100));
            if (typeof progressCb === 'function') progressCb(percent);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const result = JSON.parse(xhr.responseText);
              if (!result || result.status !== 'success' || !result.url) {
                rej(new Error(result?.message || (window.QAI18n?.getText?.('Server PHP cPanel tidak mengembalikan URL video.') || 'Server PHP cPanel tidak mengembalikan URL video.')));
              } else {
                res(result);
              }
            } catch (err) {
              rej(new Error(window.QAI18n?.getText?.('Respons server cPanel bukan JSON valid.') || 'Respons server cPanel bukan JSON valid.'));
            }
          } else {
            let msg = '';
            try {
              const parsed = JSON.parse(xhr.responseText);
              msg = parsed.message || '';
            } catch (e) {
              msg = xhr.responseText ? xhr.responseText.slice(0, 100) : xhr.statusText;
            }
            const errorUpload = window.QAI18n?.getText?.('Gagal mengunggah.') || 'Gagal mengunggah.';
            rej(new Error(`HTTP ${xhr.status}: ${msg || errorUpload}`));
          }
        };

        xhr.onerror = () => rej(new Error(window.QAI18n?.getText?.('Gagal menghubungi server cPanel. Cek koneksi / CORS / HTTPS.') || 'Gagal menghubungi server cPanel. Cek koneksi / CORS / HTTPS.'));
        xhr.ontimeout = () => {
          const timeoutMsg = uploadPhase
            ? (window.QAI18n?.getText?.('Waktu upload video melebihi batas (koneksi lambat). Coba lagi atau periksa kecepatan upload internet Anda.') || 'Waktu upload video melebihi batas (koneksi lambat). Coba lagi atau periksa kecepatan upload internet Anda.')
            : (window.QAI18n?.getText?.('Video terupload, tetapi server cPanel lambat merespons.') || 'Video terupload, tetapi server cPanel lambat merespons.');
          rej(new Error(timeoutMsg));
        };

        const formData = new FormData();
        formData.append('video', blob, `qa_recording_${Date.now()}.webm`);
        xhr.send(formData);
      });
      
      resolve({
        blob,
        uploadPromise,
        setOnProgress: (cb) => { progressCb = cb; }
      });
    };
    
    activeMediaRecorder.stop();
  });
}
