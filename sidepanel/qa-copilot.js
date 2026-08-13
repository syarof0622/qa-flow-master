// ==========================================
// QA COPILOT WITH THREAD PERSISTENCE & SUPABASE CLOUD SYNC
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  const btnSendCopilot = document.getElementById('btnSendCopilot');
  const copilotInput = document.getElementById('copilotInput');
  const copilotChatArea = document.getElementById('copilotChatArea');
  const btnClearCopilot = document.getElementById('btnClearCopilot');
  const copilotProviderBadge = document.getElementById('copilotProviderBadge');
  const btnOpenAiSettingsDirect = document.getElementById('btnOpenAiSettingsDirect');
  const copilotThreadDropdown = document.getElementById('copilotThreadDropdown');
  const copilotThreadTrigger = document.getElementById('copilotThreadTrigger');
  const copilotThreadCurrent = document.getElementById('copilotThreadCurrent');
  const copilotThreadMenu = document.getElementById('copilotThreadMenu');
  const btnNewCopilotThread = document.getElementById('btnNewCopilotThread');

  // This block runs in its own DOMContentLoaded scope, so re-bind the shared
  // block-1 helper (bare references used to throw ReferenceError here).
  const showBentoAlert = window.QAFlow.showBentoAlert;

  if (!btnSendCopilot) return;

  let activeThreadId = null;
  let copilotThreads = [];

  btnOpenAiSettingsDirect?.addEventListener('click', () => {
    document.getElementById('btnAiSettings')?.click();
  });

  copilotProviderBadge?.addEventListener('click', () => {
    document.getElementById('btnAiSettings')?.click();
  });

  async function getAiSettings() {
    const local = await new Promise(resolve => chrome.storage.local.get(['qa_ai_settings', 'appState'], resolve));
    // The real key lives only in qa_ai_settings; appState.aiSettings is just
    // provider/model metadata (the background strips apiKey before storing).
    if (local?.qa_ai_settings?.apiKey) return local.qa_ai_settings;
    const state = await new Promise(resolve => chrome.runtime.sendMessage({ action: 'GET_STATE' }, res => resolve(res?.data || {})));
    return state.aiSettings || { provider: 'gemini', apiKey: '' };
  }

  window.addEventListener('QA_AI_SETTINGS_CHANGED', updateProviderBadge);

  const providerLogos = {
    deepseek: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" style="flex-shrink:0"><path d="M4 12C4 7.58 7.58 4 12 4C16.42 4 20 7.58 20 12C20 14.5 18.5 17.5 15.5 19.5C14.5 20.2 13 20.5 12 20.5C11 20.5 9.5 20.2 8.5 19.5C5.5 17.5 4 14.5 4 12Z" fill="#4D6BFE"/><path d="M12 7L13.2 10.8L17 12L13.2 13.2L12 17L10.8 13.2L7 12L10.8 10.8L12 7Z" fill="#FFFFFF"/></svg>`,
    gemini: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" style="flex-shrink:0"><defs><linearGradient id="geminiBadgeGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#4285F4"/><stop offset="50%" stop-color="#9B51E0"/><stop offset="100%" stop-color="#E94235"/></linearGradient></defs><path d="M12 0C12 6.627 6.627 12 0 12C6.627 12 12 17.373 12 24C12 17.373 17.373 12 24 12C17.373 12 12 6.627 12 0Z" fill="url(#geminiBadgeGrad)"/></svg>`,
    claude: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" style="flex-shrink:0"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="#D97757"/></svg>`
  };

  async function updateProviderBadge() {
    if (!copilotProviderBadge) return;
    const settings = await getAiSettings();
    if (settings.apiKey) {
      const providerKey = (settings.provider || 'gemini').toLowerCase();
      const nameMap = { gemini: 'Gemini', deepseek: 'DeepSeek', claude: 'Claude' };
      const providerName = nameMap[providerKey] || settings.provider;
      const logoSvg = providerLogos[providerKey] || '✨';
      copilotProviderBadge.innerHTML = `${logoSvg}<span>${escapeHTML(providerName)}</span>`;
      copilotProviderBadge.style.color = 'var(--text-main)';
      copilotProviderBadge.style.borderColor = 'rgba(56, 189, 248, 0.3)';
      copilotProviderBadge.style.background = 'rgba(56, 189, 248, 0.12)';
    } else {
      const warnSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
      copilotProviderBadge.innerHTML = `${warnSvg}<span>Set Key</span>`;
      copilotProviderBadge.style.color = 'var(--accent-warning)';
      copilotProviderBadge.style.borderColor = 'rgba(251, 191, 36, 0.3)';
      copilotProviderBadge.style.background = 'rgba(251, 191, 36, 0.12)';
    }
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // highlightJSCode and parseMarkdownToHTML have been moved to sidepanel/markdown-parser.js
  // window.copyCopilotCode has also been moved.

  function renderWelcomeScreen() {
    if (!copilotChatArea) return;
    const isEn = (window.QAI18n?.getLanguage?.() || 'id') === 'en';
    copilotChatArea.innerHTML = `
      <div class="copilot-prompt-suggestions">
        <button class="copilot-chip" data-action="negative-test" data-prompt="${isEn ? 'Create negative & boundary value tests for form on this page' : 'Buatkan skenario negative test dan boundary value testing untuk form di halaman ini'}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:2px"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg> Negative Tests</button>
        <button class="copilot-chip" data-action="mock-api" data-prompt="${isEn ? 'Create Playwright page.route() mock API based on network logs' : 'Buatkan Playwright page.route() mock API berdasarkan network log halaman ini'}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:2px"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg> Mock API Routes</button>
        <button class="copilot-chip" data-action="heal-selector" data-prompt="${isEn ? 'Audit fragile CSS selectors to ARIA roles & data-testid' : 'Audit dan ubah CSS selector rapuh pada halaman ini menjadi ARIA role (getByRole) & data-testid'}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:2px"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg> Self-Healing</button>
        <button class="copilot-chip" data-action="bug-report" data-prompt="${isEn ? 'Draft structured Jira bug report from error logs' : 'Susunkan draf Laporan Bug (Jira Issue) terstruktur berdasarkan log error dan status halaman saat ini'}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:2px"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path></svg> ${isEn ? 'Draft Bug Report' : 'Draft Bug Laporan'}</button>
        <button class="copilot-chip" data-prompt="${isEn ? 'Create test scenario for login form' : 'Buatkan skenario test login dengan username dan password'}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:2px"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg> ${isEn ? 'Login Test' : 'Test Login'}</button>
        <button class="copilot-chip" data-prompt="${isEn ? 'Verify page title and main buttons' : 'Buatkan assertion verifikasi judul halaman dan tombol utama'}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:2px"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> ${isEn ? 'Check Elements' : 'Cek Element'}</button>
      </div>
      <div class="copilot-msg system">
        <div class="msg-bubble">${isEn ? 'Hello! I am QA Copilot. Describe the test scenario you want to build on this page.' : 'Halo! Saya QA Copilot. Ceritakan skenario tes apa yang ingin Anda buat di halaman ini?'}</div>
      </div>
    `;
    wirePromptChips();
  }

  function wirePromptChips() {
    // Replaced by event delegation below to survive DOM replacements
  }

  copilotChatArea?.addEventListener('click', (e) => {
    const chip = e.target.closest('.copilot-chip');
    if (chip && copilotInput) {
      copilotInput.value = chip.dataset.prompt || chip.textContent;
      copilotInput.focus();
    }
  });

  const threadIcons = {
    chat: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>`,
    plus: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>`
  };

  function closeThreadMenu() {
    copilotThreadMenu?.classList.add('hidden');
    copilotThreadTrigger?.setAttribute('aria-expanded', 'false');
  }

  function toggleThreadMenu() {
    if (isAiGenerating) return;
    const willOpen = copilotThreadMenu?.classList.toggle('hidden') === false;
    copilotThreadTrigger?.setAttribute('aria-expanded', String(willOpen));
  }

  function renderThreadSelector() {
    if (!copilotThreadTrigger || !copilotThreadMenu) return;
    const isEn = (window.QAI18n?.getLanguage?.() || 'id') === 'en';
    const newChatLabel = isEn ? 'New Chat...' : 'Buat Chat Baru...';
    const activeThread = copilotThreads.find(t => t.id === activeThreadId) || null;
    let currentTitle = activeThread ? (activeThread.title || (isEn ? 'Session' : 'Skenario')) : newChatLabel;
    if (currentTitle.length > 40) currentTitle = currentTitle.substring(0, 37) + '...';
    if (copilotThreadCurrent) {
      copilotThreadCurrent.innerHTML = `${threadIcons.chat}<span>${escapeHTML(currentTitle)}</span>`;
    }

    let menuHtml = `<button type="button" class="ctd-item" data-thread-id="">${threadIcons.plus}<span>${escapeHTML(newChatLabel)}</span></button>`;
    copilotThreads.forEach(t => {
      const selected = t.id === activeThreadId ? ' is-active' : '';
      let tTitle = t.title || (isEn ? 'Session' : 'Skenario');
      if (tTitle.length > 40) tTitle = tTitle.substring(0, 37) + '...';
      menuHtml += `<button type="button" class="ctd-item${selected}" data-thread-id="${escapeHTML(t.id)}">${threadIcons.chat}<span>${escapeHTML(tTitle)}</span></button>`;
    });
    copilotThreadMenu.innerHTML = menuHtml;
  }

  function loadActiveThread() {
    if (!copilotChatArea) return;
    const currentThread = copilotThreads.find(t => t.id === activeThreadId);

    if (!currentThread || !Array.isArray(currentThread.messages) || currentThread.messages.length === 0) {
      renderWelcomeScreen();
      return;
    }

    copilotChatArea.innerHTML = '';
    currentThread.messages.forEach(msg => {
      if (Array.isArray(msg.activity) && msg.activity.length) {
        // appendAgentActivity(msg.activity); // Di-disable atas permintaan pengguna agar tidak mengotori UI
      }
      if (msg.steps && Array.isArray(msg.steps) && msg.steps.length > 0) {
        appendCopilotStepCardMsg(msg.cleanReply || msg.text, msg.steps, false);
      } else if (msg.sender === 'error') {
        appendCopilotErrorMsg(msg.text, false);
      } else {
        appendCopilotMsg(msg.text, msg.sender, false);
      }
    });
    copilotChatArea.scrollTop = copilotChatArea.scrollHeight;
  }

  let isAiGenerating = false;

  async function initCopilotThreads() {
    // Merge the local cache with the background state (dedupe by id, prefer the
    // version with more messages) so threads survive a background/cloud reset.
    const localStore = await chrome.storage.local.get(['qa_copilot_threads', 'qa_active_copilot_thread_id']).catch(() => ({}));
    const state = await window.QAFlow.sendRuntimeMessage('GET_STATE').catch(() => ({}));
    const localThreads = Array.isArray(localStore?.qa_copilot_threads) ? localStore.qa_copilot_threads : [];
    const stateThreads = Array.isArray(state?.data?.copilotThreads) ? state.data.copilotThreads : [];
    const threadMap = new Map();
    [...localThreads, ...stateThreads].forEach(t => {
      if (t && t.id) {
        const existing = threadMap.get(t.id);
        if (!existing || (t.messages?.length || 0) >= (existing.messages?.length || 0)) {
          threadMap.set(t.id, t);
        }
      }
    });
    copilotThreads = Array.from(threadMap.values());
    activeThreadId = localStore?.qa_active_copilot_thread_id || state?.data?.activeCopilotThreadId || (copilotThreads[0]?.id || null);
    
    chrome.storage.local.set({ qa_copilot_threads: copilotThreads, qa_active_copilot_thread_id: activeThreadId });
    
    renderThreadSelector();
    if (!isAiGenerating) {
      loadActiveThread();
    }
    updateProviderBadge();
  }

  window.refreshCopilotThreads = initCopilotThreads;
  await initCopilotThreads();

  btnNewCopilotThread?.addEventListener('click', () => {
    if (isAiGenerating) return;
    activeThreadId = null;
    chrome.storage.local.set({ qa_active_copilot_thread_id: null });
    window.QAFlow.sendRuntimeMessage('SET_ACTIVE_COPILOT_THREAD', { threadId: null });
    renderThreadSelector();
    renderWelcomeScreen();
  });

  copilotThreadTrigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleThreadMenu();
  });

  copilotThreadMenu?.addEventListener('click', (e) => {
    if (isAiGenerating) return; // don't switch threads mid-generation
    const item = e.target.closest('.ctd-item');
    if (!item) return;
    const nextId = item.dataset.threadId || null;
    activeThreadId = nextId;
    chrome.storage.local.set({ qa_active_copilot_thread_id: activeThreadId });
    window.QAFlow.sendRuntimeMessage('SET_ACTIVE_COPILOT_THREAD', { threadId: activeThreadId });
    renderThreadSelector();
    loadActiveThread();
    closeThreadMenu();
  });

  document.addEventListener('click', (e) => {
    if (copilotThreadDropdown && !copilotThreadDropdown.contains(e.target)) {
      closeThreadMenu();
    }
  });

  btnClearCopilot?.addEventListener('click', async () => {
    if (isAiGenerating) return;
    if (activeThreadId) {
      const currentThread = copilotThreads.find(t => t.id === activeThreadId);
      if (currentThread) {
        currentThread.messages = [];
        chrome.storage.local.set({ qa_copilot_threads: copilotThreads, qa_active_copilot_thread_id: activeThreadId });
        loadActiveThread();
        window.QAFlow.sendRuntimeMessage?.('SAVE_COPILOT_THREAD', { thread: currentThread })?.catch(() => {});
      }
    } else {
      loadActiveThread();
    }
  });

  function appendCopilotMsg(text, sender = 'system', saveToThread = true, isMarkdown = true) {
    const wrapper = document.createElement('div');
    wrapper.className = `copilot-msg ${sender}`;
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.innerHTML = isMarkdown ? window.QAMarkdown.parse(text) : text;
    wrapper.appendChild(bubble);
    copilotChatArea.appendChild(wrapper);
    copilotChatArea.scrollTop = copilotChatArea.scrollHeight;
    return wrapper;
  }

  function appendCopilotErrorMsg(errorText, saveToThread = true) {
    const wrapper = document.createElement('div');
    wrapper.className = 'copilot-msg error';
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    const textDiv = document.createElement('div');
    textDiv.style.display = 'flex';
    textDiv.style.alignItems = 'flex-start';
    textDiv.style.gap = '5px';
    const errSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
    textDiv.innerHTML = `${errSvg}<span>Error: ${escapeHTML(errorText)}</span>`;
    bubble.appendChild(textDiv);
    wrapper.appendChild(bubble);
    copilotChatArea.appendChild(wrapper);
    copilotChatArea.scrollTop = copilotChatArea.scrollHeight;
  }

  // Compact log of what the AI Sharing Agent did on the live page (visible in chat).
  function appendAgentActivity(history) {
    return; // DISABLED: Pengguna merasa tidak penting untuk ditampilkan di chat UI
    const isEn = (window.QAI18n?.getLanguage?.() || 'id') === 'en';
    const wrapper = document.createElement('div');
    wrapper.className = 'copilot-msg system';
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble agent-activity';
    const rows = history
      .map(h => `<div class="agent-activity-row">${escapeHTML(String(h))}</div>`)
      .join('');
    bubble.innerHTML = `<div class="agent-activity-title">${escapeHTML(isEn ? 'Agent Activity' : 'Aktivitas Agent')}</div>${rows}`;
    wrapper.appendChild(bubble);
    copilotChatArea.appendChild(wrapper);
    copilotChatArea.scrollTop = copilotChatArea.scrollHeight;
  }

  function appendCopilotStepCardMsg(cleanReply, steps, saveToThread = true) {
    const activeLang = window.QAI18n?.getLanguage?.() || 'id';
    const isEn = activeLang === 'en';
    const cardHeader = isEn ? `${steps.length} Test Steps Generated:` : `${steps.length} Langkah Tes Di-generate:`;
    const appendLabel = isEn ? 'Add to Suite' : 'Simpan ke Steps';
    const runLabel = isEn ? 'Run Only' : 'Jalankan Saja';
    const saveRunLabel = isEn ? 'Save & Run' : 'Simpan & Jalankan';

    const wrapper = document.createElement('div');
    wrapper.className = 'copilot-msg system';
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    
    let html = `<div>${window.QAMarkdown.parse(cleanReply)}</div>`;
    if (Array.isArray(steps) && steps.length > 0) {
      const btnSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const listSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>`;
      
      html += `<div class="copilot-step-preview">`;
      html += `<div style="font-weight:700;font-size:10.5px;margin-bottom:4px;color:var(--accent-primary);display:flex;align-items:center;">${listSvg} <span>${escapeHTML(cardHeader)}</span></div>`;
      steps.forEach((st, idx) => {
        html += `<div class="copilot-step-item"><span class="copilot-step-badge">${escapeHTML(st.action || 'step')}</span> ${escapeHTML(st.description || st.selector || `Step ${idx+1}`)}</div>`;
      });
      html += `</div>`;
      
      const appendSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
      const runSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="margin-right:2px"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
      const saveSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>`;
      
      html += `<div class="copilot-action-group">
        <button class="copilot-action-btn run" id="btnRunOnlySteps_${btnSuffix}" title="${escapeHTML(isEn ? 'Run the generated steps directly, without saving them and without running existing suite steps.' : 'Jalankan langkah hasil generate langsung, tanpa menyimpan dan tanpa menjalankan step suite yang sudah ada.')}">${runSvg} <span>${escapeHTML(runLabel)}</span></button>
        <button class="copilot-action-btn append" id="btnAppendSteps_${btnSuffix}" title="${escapeHTML(isEn ? 'Save the generated steps to the active suite.' : 'Simpan langkah hasil generate ke Suite aktif.')}">${appendSvg} <span>${escapeHTML(appendLabel)}</span></button>
        <button class="copilot-action-btn save-run" id="btnSaveRunSteps_${btnSuffix}" title="${escapeHTML(isEn ? 'Save the steps, then run only the newly added steps.' : 'Simpan langkah, lalu jalankan hanya langkah baru yang ditambahkan.')}">${saveSvg} <span>${escapeHTML(saveRunLabel)}</span></button>
      </div>`;
    }

    bubble.innerHTML = html;
    wrapper.appendChild(bubble);
    copilotChatArea.appendChild(wrapper);
    copilotChatArea.scrollTop = copilotChatArea.scrollHeight;

    if (Array.isArray(steps) && steps.length > 0) {
      const appendBtn = bubble.querySelector('[id^="btnAppendSteps_"]');
      const runOnlyBtn = bubble.querySelector('[id^="btnRunOnlySteps_"]');
      const saveRunBtn = bubble.querySelector('[id^="btnSaveRunSteps_"]');

      const isEnLang = () => (window.QAI18n?.getLanguage?.() || 'id') === 'en';
      const checkSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      const retrySvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`;
      const spinnerSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="spin" style="margin-right:2px"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>`;

      appendBtn?.addEventListener('click', async () => {
        appendBtn.disabled = true;
        appendBtn.innerHTML = spinnerSvg + ' <span>' + (isEnLang() ? 'Adding...' : 'Menambahkan...') + '</span>';

        const res = await window.QAFlow.sendRuntimeMessage('APPEND_STEPS', { steps: steps }).catch(err => ({ status: 'ERROR', error: err.message }));
        if (res?.status === 'SUCCESS' && res.data) {
          window.QAFlow.applyStateAndRender(res.data);
        }

        const stepsTabBtn = document.querySelector('.bento-tab-btn[data-tab="tab-builder"]');
        if (stepsTabBtn && typeof window.QAFlow.activateTab === 'function') {
          window.QAFlow.activateTab(stepsTabBtn);
        }

        const isEnLangNow = isEnLang();
        appendBtn.innerHTML = checkSvg + ' <span>' + (isEnLangNow ? 'Added' : 'Ditambahkan') + '</span>';
        window.QAFlow.showBentoAlert(isEnLangNow ? 'Saved to Suite' : 'Tersimpan ke Suite', isEnLangNow ? `${steps.length} steps added to active suite.` : `${steps.length} langkah tes ditambahkan ke Suite aktif.`, '✓');
      });

      runOnlyBtn?.addEventListener('click', async () => {
        runOnlyBtn.disabled = true;
        const isEnLangNow = isEnLang();
        runOnlyBtn.innerHTML = spinnerSvg + ' <span>' + (isEnLangNow ? 'Running...' : 'Menjalankan...') + '</span>';

        const res = await window.QAFlow.runCopilotSteps(steps).catch(err => ({ status: 'ERROR', error: err.message }));

        if (res?.status === 'SUCCESS') {
          window.QAFlow.showBentoAlert(isEnLangNow ? 'Test Started' : 'Tes Dijalankan', isEnLangNow ? `Running ${steps.length} generated steps without touching existing suite steps.` : `Menjalankan ${steps.length} langkah hasil generate tanpa mengubah step suite yang sudah ada.`, '▶');
          runOnlyBtn.innerHTML = checkSvg + ' <span>' + (isEnLangNow ? 'Started' : 'Dijalankan') + '</span>';
        } else {
          if (res?.error !== 'run-not-ready' && res?.error !== 'video-failed') {
            window.QAFlow.showBentoAlert(isEnLangNow ? 'Failed to Run' : 'Gagal Menjalankan', res?.error || 'Unknown error', '⚠️');
          }
          runOnlyBtn.innerHTML = retrySvg + ' <span>' + (isEnLangNow ? 'Retry' : 'Coba Lagi') + '</span>';
          runOnlyBtn.disabled = false;
        }
      });

      saveRunBtn?.addEventListener('click', async () => {
        saveRunBtn.disabled = true;
        const isEnLangNow = isEnLang();
        saveRunBtn.innerHTML = spinnerSvg + ' <span>' + (isEnLangNow ? 'Saving & Running...' : 'Menyimpan & Menjalankan...') + '</span>';

        const res = await window.QAFlow.saveAndRunCopilotSteps(steps).catch(err => ({ status: 'ERROR', error: err.message }));

        if (res?.status === 'SUCCESS') {
          window.QAFlow.showBentoAlert(isEnLangNow ? 'Saved & Started' : 'Tersimpan & Dijalankan', isEnLangNow ? `${steps.length} steps saved, running only the new steps.` : `${steps.length} langkah disimpan, hanya menjalankan step baru yang ditambahkan.`, '✓');
          saveRunBtn.innerHTML = checkSvg + ' <span>' + (isEnLangNow ? 'Started' : 'Dijalankan') + '</span>';
        } else {
          if (res?.error !== 'run-not-ready' && res?.error !== 'video-failed') {
            window.QAFlow.showBentoAlert(isEnLangNow ? 'Failed' : 'Gagal', res?.error || 'Unknown error', '⚠️');
          }
          saveRunBtn.innerHTML = retrySvg + ' <span>' + (isEnLangNow ? 'Retry' : 'Coba Lagi') + '</span>';
          saveRunBtn.disabled = false;
        }
      });
    }
  }

  // ==========================================
  // COPILOT ATTACHMENT & MULTIMODAL SYSTEM
  // ==========================================
  let copilotAttachments = [];
  const btnAttachCopilotFile = document.getElementById('btnAttachCopilotFile');
  const copilotFileInput = document.getElementById('copilotFileInput');
  const copilotAttachmentContainer = document.getElementById('copilotAttachmentContainer');

  btnAttachCopilotFile?.addEventListener('click', () => {
    copilotFileInput?.click();
  });

  // Expose a cross-block helper so the screenshot annotator (JAM-KILLER block)
  // can attach an annotated screenshot to the Copilot chat.
  window.QAFlow.addCopilotAttachment = (att) => {
    if (!att) return false;
    copilotAttachments.push(att);
    renderCopilotAttachments();
    return true;
  };

  function renderCopilotAttachments() {
    if (!copilotAttachmentContainer) return;
    if (!copilotAttachments.length) {
      copilotAttachmentContainer.innerHTML = '';
      copilotAttachmentContainer.classList.add('hidden');
      return;
    }

    copilotAttachmentContainer.classList.remove('hidden');
    let html = '';
    copilotAttachments.forEach((att, index) => {
      const icon = att.type === 'image'
        ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`
        : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
      const name = escapeHTML(att.name || `Lampiran_${index + 1}`);
      html += `
        <div class="copilot-attachment-chip" data-index="${index}">
          <span>${icon} ${name}</span>
          <button class="copilot-attachment-remove" data-index="${index}" title="Hapus lampiran">&times;</button>
        </div>
      `;
    });
    copilotAttachmentContainer.innerHTML = html;

    copilotAttachmentContainer.querySelectorAll('.copilot-attachment-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.index, 10);
        if (!isNaN(idx)) {
          copilotAttachments.splice(idx, 1);
          renderCopilotAttachments();
        }
      });
    });
  }

  async function processCopilotFile(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showBentoAlert('File Terlalu Besar', `Ukuran file '${file.name}' melebihi batas 10MB.`, '⚠️');
      return;
    }

    const isImg = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name);

    if (isImg) {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }).catch(() => null);

      if (dataUrl) {
        const base64Parts = dataUrl.split(',');
        const mimeMatch = dataUrl.match(/data:(.*?);base64/);
        const mimeType = mimeMatch ? mimeMatch[1] : (file.type || 'image/png');
        const base64Data = base64Parts[1] || '';

        copilotAttachments.push({
          type: 'image',
          name: file.name,
          mimeType,
          base64: base64Data,
          previewUrl: dataUrl
        });
        renderCopilotAttachments();
      }
    } else {
      let textContent = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
      }).catch(() => null);

      if (typeof textContent === 'string') {
        textContent = textContent.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
        if (textContent.length > 50000) {
          textContent = textContent.slice(0, 50000) + '\n\n[...Konten file dipotong karena melebihi 50.000 karakter...]';
        }
        copilotAttachments.push({
          type: 'text',
          name: file.name,
          content: textContent
        });
        renderCopilotAttachments();
      }
    }
  }

  copilotFileInput?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    for (const f of files) {
      await processCopilotFile(f);
    }
    copilotFileInput.value = '';
  });

  // CLIPBOARD PASTE HANDLER (Pasted Images & Text Test Cases)
  copilotInput?.addEventListener('paste', async (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) {
          const file = new File([blob], `Pasted_Image_${Date.now()}.png`, { type: blob.type });
          await processCopilotFile(file);
        }
      }
    }
  });

  // DRAG & DROP HANDLER FOR COPILOT CHAT AREA
  const copilotChatCard = document.querySelector('.bento-copilot-card');
  if (copilotChatCard) {
    copilotChatCard.addEventListener('dragover', (e) => {
      e.preventDefault();
      copilotChatCard.style.borderColor = 'var(--accent-primary)';
    });
    copilotChatCard.addEventListener('dragleave', (e) => {
      e.preventDefault();
      copilotChatCard.style.borderColor = 'var(--border-subtle)';
    });
    copilotChatCard.addEventListener('drop', async (e) => {
      e.preventDefault();
      copilotChatCard.style.borderColor = 'var(--border-subtle)';
      const files = Array.from(e.dataTransfer?.files || []);
      for (const f of files) {
        await processCopilotFile(f);
      }
    });
  }

  copilotInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      btnSendCopilot.click();
    }
  });

  btnSendCopilot?.addEventListener('click', async () => {
    const rawText = copilotInput.value.trim();
    if (!rawText && !copilotAttachments.length) return;
    
    isAiGenerating = true;
    let currentAttachments = [...copilotAttachments];
    copilotAttachments = [];
    renderCopilotAttachments();

    let displayUserText = rawText;
    if (!displayUserText && currentAttachments.length) {
      displayUserText = `[Lampiran Test Case: ${currentAttachments.map(a => a.name).join(', ')}]`;
    }

    // Get or Create Thread
    let currentThread = copilotThreads.find(t => t.id === activeThreadId);
    if (!currentThread) {
      const threadTitle = displayUserText.slice(0, 28) + (displayUserText.length > 28 ? '...' : '');
      currentThread = {
        id: `thread_${Date.now()}`,
        title: threadTitle,
        updatedAt: new Date().toISOString(),
        messages: []
      };
      copilotThreads.unshift(currentThread);
      activeThreadId = currentThread.id;
    }
    // Pin the target thread for this request so a mid-generation UI change can
    // never redirect the AI response into another thread.
    const targetThreadId = currentThread.id;

    // Lock thread controls while AI is generating to prevent mid-flight switching.
    copilotThreadTrigger?.setAttribute('disabled', 'disabled');
    closeThreadMenu();
    if (btnNewCopilotThread) btnNewCopilotThread.disabled = true;
    if (btnClearCopilot) btnClearCopilot.disabled = true;

    // Add user message
    currentThread.messages.push({
      id: `msg_${Date.now()}`,
      sender: 'user',
      text: displayUserText,
      timestamp: new Date().toISOString()
    });

    window.QAFlow.sendRuntimeMessage('SAVE_COPILOT_THREAD', { thread: currentThread });
    renderThreadSelector();

    appendCopilotMsg(displayUserText, 'user', false);
    copilotInput.value = '';
    btnSendCopilot.disabled = true;

    let thinkingMsgEl = null;

    try {
      const settings = await getAiSettings();
      if (!settings.apiKey) {
        throw new Error('API Key belum diatur. Silakan klik tombol di bawah untuk memasukkan API Key.');
      }

      function detectUserIntent(userText = '') {
        const text = String(userText).toLowerCase().trim();
        if (/(negative test|boundary value|page\.route|mock api|mocking|laporan bug|bug report|jira issue|self-healing|heal selector)/i.test(text)) return 'EXPERT_TASK';
        if (/(buatkan|buat|generate|bikin|gen)\s+(test|tes|skenario|assertion|assert|langkah|step)/i.test(text) ||
            /(test|tes)\s+(login|register|form|pendaftaran|checkout|search|flow)/i.test(text) ||
            /^(generate|buat|bikin)\s+/i.test(text)) return 'TEST_GENERATION';
        if (/^(kamu siapa|siapa kamu|who are you|halo|hi|hey|pagi|siang|malam|terima kasih|thanks|thank you|ok|okay|siap|mantap)$/i.test(text) ||
            /^(siapa|who)\s+(kamu|anda|you)/i.test(text) || /^(kamu|anda)\s+siapa/i.test(text)) return 'GREETING';
        return 'QA_KNOWLEDGE';
      }

      const activeLang = window.QAI18n?.getLanguage?.() || 'id';
      const isEn = activeLang === 'en';
      const userIntent = detectUserIntent(displayUserText);

      // ---- AI SHARING AGENT MODE (optional) ----
      // When enabled and user explicitly requests test generation, the AI drives the live page
      const agentMode = await window.QAFlow.isAgentModeEnabled?.();
      if (agentMode && userIntent === 'TEST_GENERATION' && typeof window.QAFlow.runAgentTask === 'function') {
        const agentThinking = isEn ? 'AI Agent is exploring the page & building a test case…' : 'AI Agent sedang menjelajahi halaman & menyusun test case…';
        thinkingMsgEl = appendCopilotMsg(agentThinking, 'system', false);
        const thinkingBubble = thinkingMsgEl?.querySelector('.msg-bubble');
        if (thinkingBubble) {
          thinkingBubble.innerHTML = `<span class="agent-status">${escapeHTML(agentThinking)}</span>`;
          const cancelBtn = document.createElement('button');
          cancelBtn.type = 'button';
          cancelBtn.className = 'copilot-cancel-btn';
          cancelBtn.textContent = isEn ? '⏹ Cancel' : '⏹ Batalkan';
          cancelBtn.addEventListener('click', () => { window.QAFlow.cancelAgentTask?.(); });
          thinkingBubble.appendChild(cancelBtn);
        }
        let agentResult;
        try {
          agentResult = await window.QAFlow.runAgentTask(displayUserText, {
            onProgress: (p) => {
              const statusEl = thinkingMsgEl?.querySelector('.agent-status');
              if (!statusEl || !p?.action?.tool || p.action.tool === 'done') return;
              const label = { click: 'klik', fill: 'isi', select: 'pilih', wait: 'tunggu' }[p.action.tool] || p.action.tool;
              statusEl.textContent = `${agentThinking} (${p.iteration}) ${label} ${p.action.selector || p.action.ms || ''}`.trim();
            }
          });
        } finally {
          thinkingMsgEl?.remove();
          thinkingMsgEl = null;
        }

        const cleanReply = agentResult?.cleanReply || (isEn ? 'AI agent generated a test scenario for this page:' : 'AI agent berhasil membuat skenario uji untuk halaman ini:');
        let agentSteps = agentResult?.steps || [];
        let currentThread = copilotThreads.find(t => t.id === targetThreadId);
        if (currentThread) {
          currentThread.messages.push({
            id: `msg_${Date.now()}`,
            sender: 'system',
            text: cleanReply,
            cleanReply,
            steps: agentSteps,
            activity: agentResult?.history,
            timestamp: new Date().toISOString()
          });
          currentThread.updatedAt = new Date().toISOString();
          chrome.storage.local.set({ qa_copilot_threads: copilotThreads, qa_active_copilot_thread_id: activeThreadId });
          window.QAFlow.sendRuntimeMessage('SAVE_COPILOT_THREAD', { thread: currentThread });
          renderThreadSelector();
        }
        // appendAgentActivity(agentResult?.history); // Di-disable agar tidak muncul di chat
        appendCopilotStepCardMsg(cleanReply, agentSteps, false);
        return;
      }

      // Provider capability guard for image attachments:
      // - DeepSeek chat API has no vision (images are only noted by name).
      // - Claude caps inline images (~5MB base64); oversized images are dropped.
      if (currentAttachments.length) {
        const providerKey = (settings.provider || '').toLowerCase();
        const imageCount = currentAttachments.filter(a => a.type === 'image').length;
        if (imageCount && providerKey === 'deepseek') {
          showBentoAlert('Perhatian', 'Provider DeepSeek tidak mendukung analisis gambar. Gambar hanya dicatat sebagai lampiran nama.', '⚠️');
        } else if (providerKey === 'claude') {
          const oversized = currentAttachments.filter(a => a.type === 'image' && (a.base64?.length || 0) > 5 * 1024 * 1024);
          if (oversized.length) {
            showBentoAlert('Perhatian', `Gambar terlalu besar untuk Claude (maks ~5MB). ${oversized.length} gambar dilewati.`, '⚠️');
            currentAttachments = currentAttachments.filter(a => !(a.type === 'image' && (a.base64?.length || 0) > 5 * 1024 * 1024));
          }
        }
      }

      const { AIClient } = await import('../shared/ai-client.js');
      const ai = new AIClient(settings.provider, settings.apiKey, settings.model);

      let tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!tabs || !tabs.length) {
        tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      }
      const activeTab = tabs?.[0] || null;
      let domContext = '';
      let activeTabId = activeTab?.id || null;

      const lowerUserText = displayUserText.toLowerCase().trim();
      const isGreetingOrIdentity = /^(kamu siapa|siapa kamu|who are you|halo|hi|hey|pagi|siang|malam|terima kasih|thanks|thank you|ok|okay|siap|mantap)$/i.test(lowerUserText) ||
        /^(siapa|who)\s+(kamu|anda|you)/i.test(lowerUserText) ||
        /^(kamu|anda)\s+siapa/i.test(lowerUserText);

      if (!isGreetingOrIdentity && activeTabId && activeTab.url && /^https?:/i.test(activeTab.url)) {
        try {
          let domRes = await new Promise(resolve => chrome.tabs.sendMessage(activeTabId, { action: 'EXTRACT_DOM' }, res => resolve(res || {})));
          
          if (!domRes || domRes.status !== 'SUCCESS') {
            const results = await chrome.scripting.executeScript({
              target: { tabId: activeTabId },
              func: () => {
                const url = location.href;
                const title = document.title;
                const interactiveList = [];
                let count = 0;
                document.querySelectorAll('button, input, select, textarea, a, [role="tab"], [role="button"], form, [data-testid], h1, h2, h3, h4, [class*="btn"], [class*="card"]').forEach((el) => {
                  if (count > 150) return;
                  
                  // Visual Extractor (Menerjemahkan visual ke bahasa kode tanpa AI)
                  const rect = el.getBoundingClientRect();
                  if (rect.width === 0 || rect.height === 0) return;
                  const style = window.getComputedStyle(el);
                  if (style.opacity === '0' || style.visibility === 'hidden' || style.display === 'none') return;
                  
                  count++;
                  const tag = el.tagName.toLowerCase();
                  const type = el.getAttribute('type') || '';
                  const role = el.getAttribute('role') || '';
                  const id = el.id ? `#${el.id}` : '';
                  const name = el.getAttribute('name') ? `[name="${el.getAttribute('name')}"]` : '';
                  const testId = el.getAttribute('data-testid') ? `[data-testid="${el.getAttribute('data-testid')}"]` : '';
                  const placeholderVal = el.getAttribute('placeholder') || '';
                  const placeholderSel = placeholderVal ? `[placeholder="${placeholderVal}"]` : '';
                  const ariaLabel = el.getAttribute('aria-label') ? `[aria-label="${el.getAttribute('aria-label')}"]` : '';
                  const label = (el.labels?.[0]?.textContent || el.getAttribute('aria-label') || el.innerText || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 50);
                  
                  let selector = id || testId || (name ? `${tag}${name}` : '') || (placeholderSel ? `${tag}${placeholderSel}` : '') || (ariaLabel ? `${tag}${ariaLabel}` : '');
                  if (!selector && role) selector = `[role="${role}"]:has-text("${label.slice(0, 25)}")`;
                  if (!selector && tag === 'input' && type) {
                    selector = `input[type="${type}"]`;
                  }
                  if (!selector && el.className && typeof el.className === 'string') {
                    const cleanClasses = el.className.split(' ').filter(c => c && !c.startsWith('__qa') && !c.includes(':')).slice(0, 2).join('.');
                    if (cleanClasses) selector = `${tag}.${cleanClasses}`;
                  }
                  if (!selector) {
                    if (label && ['button', 'a', 'h1', 'h2', 'h3', 'h4', 'span', 'div'].includes(tag)) {
                      selector = `${tag}:has-text("${label.slice(0, 25)}")`;
                    } else {
                      selector = tag;
                    }
                  }

                  if (label || id || testId || name || type || placeholderVal) {
                    const bgColor = style.backgroundColor;
                    const isPrimary = (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') ? ' [PRIMARY/FILLED]' : '';
                    const visualCode = `(Posisi: x=${Math.round(rect.x)},y=${Math.round(rect.y)}, ukuran:${Math.round(rect.width)}x${Math.round(rect.height)}${isPrimary})`;
                    
                    interactiveList.push(`- <${tag}${type ? ` type="${type}"` : ''}${role ? ` role="${role}"` : ''}> "${label}" ${placeholderVal ? `(placeholder: "${placeholderVal}")` : ''} ${visualCode} ➔ Selector: "${selector}"`);
                  }
                });

                return { status: 'SUCCESS', url, title, interactiveSummary: interactiveList.join('\n') };
              }
            }).catch(() => []);
            if (results && results[0] && results[0].result) {
              domRes = results[0].result;
            }
          }

          if (domRes?.status === 'SUCCESS') {
            let logSummary = '';
            const liveState = window.QAFlow.getState?.() || {};
            if (Array.isArray(liveState.logs) && liveState.logs.length) {
              const errLogs = liveState.logs
                .filter(l => ['console_error', 'uncaught_exception', 'network_error', 'network_slow'].includes(l.type))
                .slice(-10)
                .map(l => `- [${l.type.toUpperCase()}] ${l.message || l.details?.url || JSON.stringify(l.details || {})}`);
              if (errLogs.length) {
                logSummary = `\n\n[LOG CONSOLE & NETWORK ERROR AKTIF PADA WEBPAGE]\n${errLogs.join('\n')}`;
              }
            }

            domContext = `[HALAMAN WEBPAGE AKTIF: "${domRes.title || activeTab.title}" | URL: ${domRes.url || activeTab.url}]

[STRUKTUR FORM PADA HALAMAN]
${domRes.formSummary || 'Tidak ada form khusus.'}

[ELEMEN ALERT & PESAN ERROR VISIBEL]
${domRes.alertSummary || 'Tidak ada alert error visibel.'}

[DROPDOWN SELECT & PILIHAN OPTION]
${domRes.selectSummary || 'Tidak ada select dropdown.'}

[DAFTAR ELEMEN INTERAKTIF DENGAN CSS SELECTOR PRESISI]
${domRes.interactiveSummary || ''}${logSummary}`;
          }
        } catch (err) {
          console.warn("DOM extraction warning:", err);
        }
      }

      // Include previous thread conversation history for context awareness
      let historyTurns = [];
      const activeThreadObj = copilotThreads.find(t => t.id === targetThreadId);
      if (activeThreadObj && Array.isArray(activeThreadObj.messages) && activeThreadObj.messages.length > 1) {
        const pastMsgs = activeThreadObj.messages.slice(0, -1).slice(-10);
        historyTurns = pastMsgs.map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          text: (m.cleanReply || m.text || '').trim()
        })).filter(h => h.text.length > 0);
      }

      // Enrich context with Expert QA Engine helpers if specialized task requested
      if (window.QAFlow?.copilotExpert) {
        const expert = window.QAFlow.copilotExpert;
        const lowerPrompt = displayUserText.toLowerCase();
        const liveState = window.QAFlow.getState?.() || {};

        if (lowerPrompt.includes('negative test') || lowerPrompt.includes('boundary value')) {
          domContext += '\n\n' + expert.buildNegativeTestPrompt(domRes || {}, displayUserText);
        } else if (lowerPrompt.includes('page.route') || lowerPrompt.includes('mock api') || lowerPrompt.includes('mocking')) {
          domContext += '\n\n' + expert.buildNetworkMockPrompt(liveState.logs || [], displayUserText);
        } else if (lowerPrompt.includes('laporan bug') || lowerPrompt.includes('bug report') || lowerPrompt.includes('jira issue')) {
          const bugDraft = expert.buildBugReportDraft({
            pageUrl: domRes?.url || activeTab?.url,
            title: `Log / Status pada ${domRes?.title || activeTab?.title || 'Halaman Web'}`,
            errorMsg: 'Detail masalah hasil audit QA Copilot'
          }, liveState.logs || []);
          domContext += `\n\n[DRAF LAPORAN BUG UNTUK JIRA/GITHUB]:\n${bugDraft}`;
        }
      }

      // detectUserIntent has been moved to the top of the execution flow

      let systemPrompt = '';
      if (userIntent === 'GREETING') {
        systemPrompt = `You are QA Copilot, an intelligent, friendly AI partner built into QA Flow Master Pro.
Responlah sapaan atau pertanyaan identitas pengguna secara ramah, luwes (seperti ChatGPT), dan jelas.
Gunakan gaya bahasa natural dan interaktif. Jelaskan bahwa Anda adalah QA Copilot yang siap berdiskusi, memecahkan masalah (problem solving), serta membantu pengujian otomatis.
DILARANG HARAM membuat kartu langkah tes JSON.`;

      } else if (userIntent === 'QA_KNOWLEDGE' || userIntent === 'EXPERT_TASK') {
        systemPrompt = `You are QA Copilot, a highly intelligent and conversational AI assistant (like Gemini/ChatGPT), functioning as a Senior QA Automation Architect.
You are NOT a rigid bot. You can brainstorm, discuss deeply, solve complex logic problems, and answer general questions warmly and naturally.
You accommodate ALL Expert QA tasks, inquiries, and capabilities:

1. TEST AUTOMATION & FRAMEWORKS:
   - Provide production-grade Playwright (TS/JS), Cypress, Selenium, or Jest code.
   - Explain Page Object Model (POM), iframe handling, shadow DOM, multi-tab contexts, and storage state session reuse.

2. NEGATIVE & SECURITY EDGE-CASE TESTING:
   - Generate Boundary Value Analysis (BVA), Equivalence Partitioning (EP), SQL Injection / XSS payloads, Unicode/emoji input cases, and required field validation tests.

3. API MOCKING & CONTRACT VALIDATION:
   - Provide Playwright page.route() mock scripts for simulating HTTP 400/401/403/500 errors, network timeouts, and JSON Schema contract assertions.

4. SELECTOR RESILIENCE & FLAKINESS REPAIR (SELF-HEALING):
   - Repair fragile dynamic CSS selectors into robust ARIA role locators (getByRole), getByPlaceholder, getByTestId, and text-based locators.

5. DEFECT AUDIT & JIRA BUG REPORT GENERATION:
   - Draft structured Jira/GitHub issue tickets complete with Steps to Reproduce, Expected vs Actual Results, Environment Metadata, Severity, and Traceback Logs.

6. ACCESSIBILITY (WCAG), VISUAL & PERFORMANCE TESTING:
   - Provide WCAG 2.1 AA accessibility audit guidance, Playwright visual snapshot regression (toHaveScreenshot), and Web Vitals performance checks.

7. QA STRATEGY, TEST PLAN & DATA MATRIX:
   - Build Test Strategy plans, Risk Assessment Matrices, test data generators, and CI/CD parallel execution configurations.

Answer the user's specific request directly, comprehensively, and naturally using clean GitHub Markdown. Focus on problem-solving.
DO NOT generate dummy JSON test step arrays unless the user explicitly requests generating step cards!`;

      } else {
        systemPrompt = `You are QA Copilot, an expert Playwright Test Scenario Generator.
Analyze the active webpage DOM & user requirements, provide a brief 1-2 sentence summary, and append a valid JSON array of Playwright test steps.
Valid actions: "fill", "click", "assert_text", "assert_visible", "assert_url", "wait", "select".
Example JSON Array:
[
  {"action": "fill", "selector": "input[type='email']", "value": "user@example.com", "description": "Isi Email"},
  {"action": "click", "selector": "button[type='submit']", "description": "Klik tombol Login"}
]
JSON ONLY, NO BACKTICKS.`;
      }

      systemPrompt += `\n\n--- PENTING: MULTIMODAL VISION ---\nAnda kini diberikan GAMBAR TANGKAPAN LAYAR (SCREENSHOT) dari halaman aktif. Selalu padukan informasi visual (warna, elemen tampak, layout, posisi) dari gambar tersebut dengan data DOM teks untuk memberikan analisis yang sangat akurat, relevan, dan menghindari tebakan buta.`;

      const typingHtml = `<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
      thinkingMsgEl = appendCopilotMsg(typingHtml, 'system', false, false);
      let activeAttachments = [...currentAttachments];
      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 50 });
        if (dataUrl) {
          activeAttachments.push({
            type: 'image',
            mimeType: 'image/jpeg',
            base64: dataUrl.split(',')[1]
          });
        }
      } catch (e) {
        console.warn('Gagal capture screenshot copilot:', e);
      }
      
      const reply = await ai.sendPrompt(systemPrompt, displayUserText, domContext, activeAttachments, historyTurns);
      thinkingMsgEl?.remove();
      thinkingMsgEl = null;
      
      const jsonMatch = reply.match(/\[[\s\S]*\]/);
      let steps = [];
      if (jsonMatch) {
        try {
          steps = JSON.parse(jsonMatch[0]);
        } catch(e) {
          console.error("Gagal parse AI steps", e);
        }
        if (typeof window.QAFlow.sanitizeCopilotSteps === 'function') {
          steps = window.QAFlow.sanitizeCopilotSteps(steps);
        }
      }

      const hasValidSteps = Array.isArray(steps) && steps.length > 0;

      if (hasValidSteps) {
        let cleanReply = reply
          .replace(/```(?:json)?\s*\[[\s\S]*?\]\s*```/gi, '')
          .replace(jsonMatch[0], '')
          .replace(/```(?:json)?\s*```/gi, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        if (!cleanReply) {
          cleanReply = isEn ? 'AI generated test scenario for this page:' : 'AI berhasil membuat skenario uji untuk halaman ini:';
        }

        let currentThread = copilotThreads.find(t => t.id === targetThreadId);
        if (currentThread) {
          currentThread.messages.push({
            id: `msg_${Date.now()}`,
            sender: 'system',
            text: reply,
            cleanReply: cleanReply,
            steps: steps,
            timestamp: new Date().toISOString()
          });
          currentThread.updatedAt = new Date().toISOString();
          chrome.storage.local.set({ qa_copilot_threads: copilotThreads, qa_active_copilot_thread_id: activeThreadId });
          window.QAFlow.sendRuntimeMessage('SAVE_COPILOT_THREAD', { thread: currentThread });
          renderThreadSelector();
        }

        appendCopilotStepCardMsg(cleanReply, steps, false);

      } else {
        let currentThread = copilotThreads.find(t => t.id === targetThreadId);
        if (currentThread) {
          currentThread.messages.push({
            id: `msg_${Date.now()}`,
            sender: 'system',
            text: reply,
            timestamp: new Date().toISOString()
          });
          currentThread.updatedAt = new Date().toISOString();
          chrome.storage.local.set({ qa_copilot_threads: copilotThreads, qa_active_copilot_thread_id: activeThreadId });
          window.QAFlow.sendRuntimeMessage('SAVE_COPILOT_THREAD', { thread: currentThread });
          renderThreadSelector();
        }

        appendCopilotMsg(reply, 'system', false);
      }

    } catch (e) {
      thinkingMsgEl?.remove();
      thinkingMsgEl = null;
      appendCopilotErrorMsg(e.message);
    } finally {
      isAiGenerating = false;
      btnSendCopilot.disabled = false;
      copilotThreadTrigger?.removeAttribute('disabled');
      if (btnNewCopilotThread) btnNewCopilotThread.disabled = false;
      if (btnClearCopilot) btnClearCopilot.disabled = false;
      updateProviderBadge();
    }
  });
});
