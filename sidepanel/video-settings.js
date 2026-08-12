// sidepanel/video-settings.js - Video Settings UI
// Extracted from sidepanel.js core (block 1). Runs in its own DOMContentLoaded
// scope and reads shared helpers/state via window.QAFlow.ui (exposed by the core).
// Loaded via script tag AFTER sidepanel.js so window.QAFlow.ui is available.
document.addEventListener('DOMContentLoaded', () => {
  const ui = window.QAFlow.ui;
  if (!ui) return;

  document.getElementById('btnVideoSettings')?.addEventListener('click', () => {
    ui.closeQaGovernanceMenu();
    ui.openQaWorkspace('Video Recording', 'Settings');
    // Always fetch fresh settings from background
    chrome.runtime.sendMessage({ action: 'GET_STATE' }, (res) => {
      const settings = res?.data?.videoSettings || ui.getVideoSettingsState() || { uploadUrl: '', apiKey: '' };
      ui.qaWorkspaceBody.innerHTML = `
        <div class="qa-entity-form">
          <div class="qa-field wide">
            <label>URL Endpoint Upload (cPanel)</label>
            <input type="url" id="videoUploadUrl" placeholder="https://cloud.duniakuaja.my.id/qa-upload.php" value="${escapeHTML(settings.uploadUrl)}">
          </div>
          <div class="qa-field wide">
            <label>API Secret Key</label>
            <input type="password" id="videoApiKey" placeholder="Token rahasia" value="${escapeHTML(settings.apiKey)}">
          </div>
          <div class="qa-form-actions">
            <button type="button" class="bento-btn bento-btn-primary" id="btnSaveVideoSettings">Simpan Pengaturan</button>
          </div>
        </div>
      `;
      ui.qaWorkspaceBody.querySelector('#btnSaveVideoSettings')?.addEventListener('click', () => {
        const payload = {
          autoRecord: ui.isPressed(ui.recordVideoCheck),
          uploadUrl: document.getElementById('videoUploadUrl').value.trim(),
          apiKey: document.getElementById('videoApiKey').value.trim()
        };
        chrome.runtime.sendMessage({ action: 'SAVE_VIDEO_SETTINGS', payload }, () => {
          ui.setVideoSettingsState({ ...payload });
        });
        ui.closeQaWorkspace();
        ui.showBentoAlert('Tersimpan', 'Pengaturan video berhasil disimpan.', '✅');
      });
    });
  });
});
