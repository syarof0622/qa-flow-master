// Shared runtime message contract for background and UI contexts.
(function initContracts(global) {
  const actions = Object.freeze([
    'ADD_EXPLORATORY_SESSION', 'ADD_VIDEO_HISTORY', 'APPEND_STEPS', 'APPROVE_VISUAL_BASELINE', 'CAPTURE_REPORT_SCREENSHOT',
    'CLEAR_EXECUTION_HISTORY', 'CLEAR_LOGS', 'CLEAR_STEPS', 'CLEAR_VIDEO_HISTORY', 'CREATE_RELEASE_SIGNOFF', 'CREATE_SUITE',
    'DELETE_COPILOT_THREAD', 'DELETE_EXECUTION_HISTORY_ITEM', 'DELETE_SUITE', 'DUPLICATE_SUITE', 'ENSURE_MONITOR_INJECTED',
    'GET_EXECUTION_HISTORY', 'GET_NETWORK_STATUS', 'GET_STATE', 'IMPORT_SUITE_DOCUMENT', 'MONITOR_STATUS',
    'APPLY_MOCK_CONFIG', 'PAGE_LOG_EVENT', 'PAUSE_EXECUTION', 'RECORDED_STEP', 'RENAME_SUITE', 'RESTORE_SUITE_REVISION',
    'RESTORE_WORKSPACE_BACKUP', 'RESUME_EXECUTION', 'RUN_COPILOT_STEPS', 'RUN_TEST_SUITE', 'SAVE_AI_SETTINGS', 'SAVE_COPILOT_THREAD', 'SAVE_DATASET', 'SAVE_ENVIRONMENT', 'SAVE_RUN_OPTIONS', 'SAVE_VIDEO_SETTINGS',
    'SET_ACTIVE_COPILOT_THREAD', 'SET_ACTIVE_DATASET', 'SET_ACTIVE_ENVIRONMENT', 'SET_MONITOR_OPTIONS', 'SET_SESSION_SECRETS', 'START_RECORDING', 'STOP_EXECUTION',
    'STOP_MONITOR', 'STOP_RECORDING', 'SWITCH_SUITE', 'SYNC_COPILOT_THREADS', 'UPDATE_STEPS', 'UPDATE_SUITE_METADATA', 'UPDATE_SUITE_TAGS', 'UPSERT_DEFECT'
  ]);
  const actionSet = new Set(actions);
  const mutationActions = new Set(['CREATE_SUITE', 'RENAME_SUITE', 'DUPLICATE_SUITE', 'DELETE_SUITE', 'UPDATE_STEPS', 'APPEND_STEPS', 'CLEAR_STEPS', 'IMPORT_SUITE_DOCUMENT', 'UPDATE_SUITE_METADATA', 'SAVE_ENVIRONMENT', 'SAVE_DATASET', 'SAVE_AI_SETTINGS', 'RESTORE_SUITE_REVISION', 'RESTORE_WORKSPACE_BACKUP', 'APPROVE_VISUAL_BASELINE']);
  // Step actions an AI/test generator may emit. Mirrors runner/lib/action-registry.mjs
  // ACTION_NAMES so the renderer allowlist, background validation, and the Playwright
  // engine all agree on one vocabulary.
  const stepActions = Object.freeze([
    'click', 'fill', 'select', 'hover', 'press', 'go_back', 'go_forward',
    'assert_visible', 'assert_enabled', 'assert_disabled', 'assert_checked', 'assert_unchecked',
    'assert_text', 'assert_value', 'assert_attribute', 'assert_css', 'assert_count', 'assert_url',
    'assert_screenshot', 'assert_network_status', 'assert_no_console_errors', 'assert_a11y', 'assert_performance', 'assert_security_headers',
    'api_request', 'mock_route', 'clear_mocks', 'use_flow',
    'wait', 'wait_for_element_hidden', 'wait_for_text', 'wait_for_url_change', 'wait_for_network_idle'
  ]);
  const stepActionSet = new Set(stepActions);
  const isSupportedStepAction = action => stepActionSet.has(String(action || ''));
  function validateMessage(message) {
    if (!message || typeof message !== 'object' || Array.isArray(message)) return { valid: false, error: 'Message harus berupa object.' };
    if (typeof message.action !== 'string' || !actionSet.has(message.action)) return { valid: false, error: `Action tidak dikenal: ${String(message.action || '-')}` };
    if (message.payload !== undefined && (message.payload === null || typeof message.payload !== 'object' || Array.isArray(message.payload))) return { valid: false, error: 'Payload harus berupa object.' };
    return { valid: true };
  }
  global.QAContracts = Object.freeze({ actions, actionSet, mutationActions, stepActions, stepActionSet, isSupportedStepAction, validateMessage });
})(typeof self !== 'undefined' ? self : globalThis);
