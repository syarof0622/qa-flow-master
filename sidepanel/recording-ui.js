// sidepanel/recording-ui.js - Recording UI (btnRecord + btnRecordScreen)
// Extracted from sidepanel.js core (block 1). Runs in its own DOMContentLoaded
// scope and reads shared helpers/state via window.QAFlow.ui (exposed by the core).
// startVideoRecording / stopVideoRecordingAndUpload are global (defined in
// sidepanel.js), so this module can call them directly.
document.addEventListener('DOMContentLoaded', () => {
  const ui = window.QAFlow.ui;
  if (!ui) return;

  const btnRecord = document.getElementById('btnRecord');
  btnRecord?.addEventListener('click', async () => {
    if (ui.isExecutionRunning()) {
      return ui.showBentoAlert('Perhatian', 'Hentikan eksekusi tes (Run) terlebih dahulu sebelum mulai merekam.', '⚠️');
    }

    const activeTab = await ui.getActiveTab();
    if (!activeTab?.id) return ui.showBentoAlert('Perhatian', 'Buka tab website terlebih dahulu untuk mulai merekam.', '⚠️');

    if (!ui.isRecording()) {
      // Readiness is advisory. Live/video pages may never reach a traditional
      // completed state, so START_RECORDING performs the authoritative handshake.
      await ui.refreshRecorderReadiness().catch(() => false);
      ui.renderRecorderReadiness('checking', 'Menghubungkan recorder ke DOM yang sudah tersedia…');
      chrome.runtime.sendMessage({ action: 'START_RECORDING', payload: { tabId: activeTab.id } }, (res) => {
        if (chrome.runtime.lastError) return ui.showBentoAlert('Recorder gagal', chrome.runtime.lastError.message, '⚠️');
        if (res?.status === 'SUCCESS') { ui.setIsRecording(true); ui.updateRecordingUI(true); }
        else ui.showBentoAlert('Recorder gagal', res?.error || 'Recorder tidak dapat diaktifkan pada halaman ini.', '⚠️');
      });
    } else {
      chrome.runtime.sendMessage({ action: 'STOP_RECORDING' }, (res) => {
        if (res?.status === 'SUCCESS') { ui.setIsRecording(false); ui.updateRecordingUI(false); ui.fetchInitialState(); ui.openRecordingReview(res.recording); }
      });
    }
  });

  const btnRecordScreen = document.getElementById('btnRecordScreen');
  const btnRecordScreenText = document.getElementById('btnRecordScreenText');

  btnRecordScreen?.addEventListener('click', async () => {
    const isRecordingScreen = btnRecordScreen.classList.contains('recording');

    if (!isRecordingScreen) {
      if (ui.isRecording() || ui.isExecutionRunning()) {
        return ui.showBentoAlert('Perhatian', 'Pastikan tidak ada tes atau perekaman step yang sedang berjalan.', '⚠️');
      }

      try {
        const recordPromise = startVideoRecording();
        btnRecordScreen.classList.add('recording');
        if (btnRecordScreenText) btnRecordScreenText.textContent = 'Merekam';
        await recordPromise;
      } catch (err) {
        ui.showBentoAlert('Gagal', 'Tidak bisa merekam layar: ' + err.message, '❌');
        btnRecordScreen.classList.remove('recording');
        if (btnRecordScreenText) btnRecordScreenText.textContent = 'Layar';
      }
    } else {
      btnRecordScreen.classList.remove('recording');
      if (btnRecordScreenText) btnRecordScreenText.textContent = 'Layar';

      const settings = ui.getVideoSettingsState() || {};
      const hasUploadUrl = !!settings.uploadUrl;

      try {
        const result = await stopVideoRecordingAndUpload(
          settings.uploadUrl,
          settings.apiKey
        );

        if (result) {
          ui.showVideoPreviewUI(result.blob, result, hasUploadUrl);
        }
      } catch (err) {
        ui.showBentoAlert('Upload Gagal', err.message, '❌');
      }
    }
  });
});
