// ==========================================
// AI DATA GENERATOR
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  const btnAIGenerateData = document.getElementById('btnAIGenerateData');
  // This block runs in its own DOMContentLoaded scope, so re-bind the shared
  // block-1 helpers (bare references used to throw ReferenceError here).
  const showBentoAlert = window.QAFlow.showBentoAlert;
  const showBentoPrompt = window.QAFlow.showBentoPrompt;
  if (btnAIGenerateData) {
    btnAIGenerateData.addEventListener('click', async () => {
      try {
        const localStore = await chrome.storage.local.get('qa_ai_settings');
        const state = await new Promise(resolve => chrome.runtime.sendMessage({ action: 'GET_STATE' }, res => resolve(res?.data || {})));
        const settings = (localStore?.qa_ai_settings?.apiKey ? localStore.qa_ai_settings : null) || state.aiSettings || {};
        if (!settings.apiKey) {
          showBentoAlert('API Key AI Belum Diatur', 'API Key AI belum diatur. Silakan atur terlebih dahulu di AI Settings.', '⚠️');
          return;
        }

        const userPrompt = await showBentoPrompt(
          'Generate Data AI',
          'Ceritakan data dummy apa yang ingin dibuat:',
          '5 data user indonesia berisi email, nama, dan no_hp',
          { icon: '✨', confirmText: 'Generate Data' }
        );
        if (!userPrompt) return;

        btnAIGenerateData.disabled = true;
        btnAIGenerateData.style.opacity = '0.5';

        const { AIClient } = await import('../shared/ai-client.js');
        const ai = new AIClient(settings.provider, settings.apiKey, settings.model);

        const systemPrompt = "Anda adalah Data Generator. Hasilkan array of objects JSON berdasarkan permintaan user. Contoh format: [{\"email\": \"...\", \"nama\": \"...\"}]. PASTIKAN output HANYA berisi JSON Array valid tanpa teks penjelasan apapun.";
        const reply = await ai.sendPrompt(systemPrompt, userPrompt);
        
        const jsonMatch = reply.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const rows = JSON.parse(jsonMatch[0]);
          if (Array.isArray(rows) && rows.length > 0) {
            const datasetName = `AI_Data_${Date.now()}`;
            chrome.runtime.sendMessage({ action: 'SAVE_DATASET', payload: { dataset: { name: datasetName, rows } } });
            showBentoAlert('Generate Berhasil', `Berhasil membuat dataset '${datasetName}' dengan ${rows.length} baris data.`, '✨');
          } else {
            showBentoAlert('Dataset Kosong', 'AI mengembalikan array kosong.', '⚠️');
          }
        } else {
          showBentoAlert('Gagal Parse JSON', 'Gagal mengekstrak JSON dari respons AI.\n\nRespons AI: ' + reply, '❌');
        }
      } catch (e) {
        showBentoAlert('Gagal Generate', 'Gagal generate data: ' + e.message, '❌');
      } finally {
        btnAIGenerateData.disabled = false;
        btnAIGenerateData.style.opacity = '1';
      }
    });
  }
});
