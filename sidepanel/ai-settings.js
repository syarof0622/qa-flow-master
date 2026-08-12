// sidepanel/ai-settings.js - AI Settings UI
// Extracted from sidepanel.js core (block 1). It runs in its own DOMContentLoaded
// scope and reads shared helpers/state via window.QAFlow.ui (exposed by the core).
// Loaded via script tag AFTER sidepanel.js so window.QAFlow.ui is available.
document.addEventListener('DOMContentLoaded', () => {
  const ui = window.QAFlow.ui;
  if (!ui) return;

  document.getElementById('btnAiSettings')?.addEventListener('click', async () => {
    ui.closeQaGovernanceMenu();
    ui.openQaWorkspace('AI Copilot & Services', 'Settings');
    const localStore = await chrome.storage.local.get(['qa_ai_settings', 'appState']);
    const settings = (localStore?.qa_ai_settings?.apiKey ? localStore.qa_ai_settings : null)
      || (localStore?.appState?.aiSettings?.apiKey ? localStore.appState.aiSettings : null)
      || ui.getAiSettingsState()
      || { provider: 'deepseek', model: 'deepseek-chat', apiKey: '' };

    const tr = str => window.QAI18n?.t?.(str) || str;

    const modelsMap = {
      deepseek: [
        { id: 'deepseek-chat', name: tr('⚡ DeepSeek V3 / Flash (Cepat & Hemat Token)'), desc: tr('Sangat cepat dan hemat token API untuk pembuatan skenario biasa.') },
        { id: 'deepseek-reasoner', name: tr('🧠 DeepSeek R1 / Pro (Reasoning Mode)'), desc: tr('Reasoning cerdas untuk analisis skenario kompleks.') }
      ],
      gemini: [
        { id: 'gemini-2.0-flash', name: tr('⚡ Gemini 2.0 Flash (Ultra Cepat & Hemat)'), desc: tr('Model paling cepat dan hemat token dari Google.') },
        { id: 'gemini-1.5-pro', name: tr('🎯 Gemini 1.5 Pro (Presisi & Context 1M)'), desc: tr('Kapasitas konteks besar dan analisa mendalam.') }
      ],
      claude: [
        { id: 'claude-3-haiku-20240307', name: tr('⚡ Claude 3 Haiku (Ringan & Cepat)'), desc: tr('Model paling cepat dan hemat dari Anthropic.') },
        { id: 'claude-3-5-sonnet-20241022', name: '🎯 Claude 3.5 Sonnet (Pro Version)', desc: tr('Performa tertinggi untuk coding & QA automation.') }
      ]
    };

    ui.qaWorkspaceBody.innerHTML = `
      <div class="qa-entity-form">
        <div class="qa-field wide">
          <label>${tr('Provider AI')}</label>
          <select id="aiProviderSelect" class="bento-select">
            <option value="deepseek" ${settings.provider === 'deepseek' ? 'selected' : ''}>DeepSeek</option>
            <option value="gemini" ${settings.provider === 'gemini' ? 'selected' : ''}>Google Gemini</option>
            <option value="claude" ${settings.provider === 'claude' ? 'selected' : ''}>Anthropic Claude</option>
          </select>
        </div>
        <div class="qa-field wide">
          <label>${tr('Model AI')}</label>
          <select id="aiModelSelect" class="bento-select">
          </select>
          <small id="aiModelDescription">${tr('Pilih versi model AI untuk mengontrol kecepatan & konsumsi token.')}</small>
        </div>
        <div class="qa-field wide">
          <label id="aiApiKeyLabel">API Key (${(settings.provider || 'deepseek').toUpperCase()})</label>
          <input type="password" id="aiApiKey" placeholder="${tr('Masukkan API Key')} ${settings.provider || 'deepseek'}" value="${escapeHTML(settings.apiKey || '')}">
          <small>${tr('Kunci ini disimpan secara lokal di browser Anda (chrome.storage).')}</small>
        </div>
        <div class="qa-form-actions">
          <button type="button" class="bento-btn bento-btn-primary" id="btnSaveAiSettings">${tr('Simpan Pengaturan')}</button>
        </div>
      </div>
    `;

    const modelSelect = document.getElementById('aiModelSelect');
    const modelDesc = document.getElementById('aiModelDescription');

    function updateModelOptions(provider, selectedModel) {
      const list = modelsMap[provider] || modelsMap.deepseek;
      modelSelect.innerHTML = list.map(m => `<option value="${m.id}" ${m.id === selectedModel ? 'selected' : ''}>${m.name}</option>`).join('');
      const activeObj = list.find(m => m.id === modelSelect.value) || list[0];
      if (modelDesc && activeObj) modelDesc.textContent = activeObj.desc;
    }

    updateModelOptions(settings.provider || 'deepseek', settings.model || 'deepseek-chat');

    document.getElementById('aiProviderSelect')?.addEventListener('change', (e) => {
      const p = e.target.value;
      const keyInput = document.getElementById('aiApiKey');
      const label = document.getElementById('aiApiKeyLabel');
      if (label) label.textContent = `API Key (${p.toUpperCase()})`;
      if (keyInput) keyInput.placeholder = `${tr('Masukkan API Key')} ${p}`;
      updateModelOptions(p, '');
    });

    modelSelect?.addEventListener('change', () => {
      const p = document.getElementById('aiProviderSelect').value;
      const list = modelsMap[p] || modelsMap.deepseek;
      const activeObj = list.find(m => m.id === modelSelect.value);
      if (modelDesc && activeObj) modelDesc.textContent = activeObj.desc;
    });

    ui.qaWorkspaceBody.querySelector('#btnSaveAiSettings')?.addEventListener('click', async () => {
      const payload = {
        provider: document.getElementById('aiProviderSelect').value,
        model: document.getElementById('aiModelSelect').value,
        apiKey: document.getElementById('aiApiKey').value.trim()
      };

      // Guaranteed instant local storage write
      await chrome.storage.local.set({ qa_ai_settings: payload });
      ui.setAiSettingsState({ ...payload });

      chrome.runtime.sendMessage({ action: 'SAVE_AI_SETTINGS', payload }, () => {});
      ui.closeQaWorkspace();
      ui.showBentoAlert(tr('Tersimpan'), `${tr('Pengaturan AI')} (${payload.provider} - ${payload.model}) ${tr('Pengaturan AI berhasil disimpan!')}`, '✨');

      window.dispatchEvent(new CustomEvent('QA_AI_SETTINGS_CHANGED', { detail: payload }));
    });
  });
});
