// sidepanel/qa-governance.js - QA Governance workspace actions
// Extracted from sidepanel.js core (block 1): exploratory session, release
// sign-off, suite versions, and workspace backup. Runs in its own
// DOMContentLoaded scope and reads shared helpers/state via window.QAFlow.ui.
document.addEventListener('DOMContentLoaded', () => {
  const ui = window.QAFlow.ui;
  if (!ui) return;
  const qaFlow = window.QAFlow;
  const sendRuntimeMessage = qaFlow.sendRuntimeMessage;
  const showBentoConfirm = qaFlow.showBentoConfirm;
  const announce = qaFlow.announce;

  document.getElementById('btnAddExploration')?.addEventListener('click', () => {
    ui.openQaWorkspace('Exploratory session', 'Session-based testing');
    ui.renderStructuredForm([
      { name: 'charter', label: 'Charter', wide: true, required: true },
      { name: 'tester', label: 'Tester' },
      { name: 'durationMinutes', label: 'Duration (minutes)', type: 'number', defaultValue: 30 },
      { name: 'notes', label: 'Notes', type: 'textarea', wide: true },
      { name: 'evidence', label: 'Evidence references', type: 'textarea', array: true, wide: true }
    ], { durationMinutes: 30 }, async session => {
      if (!session.charter.trim()) throw new Error('Charter wajib diisi.');
      const response = await sendRuntimeMessage('ADD_EXPLORATORY_SESSION', { session });
      if (response?.status !== 'SUCCESS') throw new Error(response?.error || 'Session gagal disimpan.');
      ui.closeQaWorkspace();
      ui.fetchInitialState();
    });
  });

  document.getElementById('btnReleaseSignoff')?.addEventListener('click', () => {
    const suite = ui.getActiveSuiteObj();
    ui.openQaWorkspace('Release sign-off', 'Quality gate');
    ui.renderStructuredForm([
      { name: 'release', label: 'Release', required: true },
      { name: 'approver', label: 'Approver', required: true },
      { name: 'approved', label: 'Decision', type: 'select', options: ['APPROVED', 'REJECTED'] },
      { name: 'minimumCoverage', label: 'Minimum coverage', type: 'number', defaultValue: 80 },
      { name: 'maximumFlaky', label: 'Maximum flaky', type: 'number', defaultValue: 0 },
      { name: 'maximumSlow', label: 'Maximum slow steps', type: 'number', defaultValue: 0 },
      { name: 'requireCleanRuntime', label: 'Clean runtime required', type: 'select', options: ['YES', 'NO'] },
      { name: 'overrideReason', label: 'Override reason', type: 'textarea', wide: true }
    ], { release: suite?.release || '', approved: 'APPROVED', minimumCoverage: 80, maximumFlaky: 0, maximumSlow: 0, requireCleanRuntime: 'YES' }, async data => {
      if (!data.release.trim() || !data.approver.trim()) throw new Error('Release dan approver wajib diisi.');
      const response = await sendRuntimeMessage('CREATE_RELEASE_SIGNOFF', { signoff: { ...data, approved: data.approved === 'APPROVED', requireCleanRuntime: data.requireCleanRuntime === 'YES' } });
      if (response?.status !== 'SUCCESS') throw new Error(`${response?.error || 'Sign-off ditolak.'} Run: ${response?.gates?.passingRun ? 'pass' : 'fail'}, coverage: ${response?.gates?.coverage ?? 0}%, blocker: ${response?.gates?.blockerCount ?? 0}, flaky: ${response?.gates?.flakyCount ?? 0}, slow: ${response?.gates?.slowCount ?? 0}, runtime: ${response?.gates?.criticalRuntimeIssues ?? 0}.`);
      ui.closeQaWorkspace();
      ui.fetchInitialState();
      ui.showBentoAlert('Sign-off tersimpan', 'Quality gate dan keputusan release tercatat.', '✓');
    }, { saveText: 'Verifikasi' });
  });

  document.getElementById('btnSuiteVersions')?.addEventListener('click', () => {
    const suite = ui.getActiveSuiteObj();
    const revisions = (ui.getBackupSnapshot().suiteRevisions || []).filter(item => item.suiteId === suite?.id);
    ui.openQaWorkspace('Suite versions', 'Restore & audit');
    ui.qaWorkspaceBody.innerHTML = revisions.length ? `<div class="qa-board-list">${revisions.map(item => `<article class="qa-board-item"><div class="qa-board-item-head"><div><strong>${escapeHTML(item.reason || 'Revision')}</strong><p>${new Date(item.timestamp).toLocaleString(window.QAI18n?.locale?.() || 'id-ID')}</p></div><button type="button" class="qa-item-btn qa-restore-revision" data-id="${escapeHTML(item.id)}">Restore</button></div><div class="qa-board-meta"><span class="qa-mini-tag">${item.suite?.steps?.length || 0} step</span><span class="qa-mini-tag">${escapeHTML(item.suite?.name || suite?.name || '')}</span></div></article>`).join('')}</div>` : '<div class="bento-empty-state"><p>Belum ada versi.</p><span>Versi dibuat otomatis ketika suite berubah.</span></div>';
    ui.qaWorkspaceBody.querySelectorAll('.qa-restore-revision').forEach(button => button.addEventListener('click', async () => {
      const ok = await showBentoConfirm('Restore suite', 'Kembalikan suite ke versi ini? Kondisi sekarang tetap disimpan sebagai revision.', { confirmText: 'Restore' });
      if (!ok) return;
      const response = await sendRuntimeMessage('RESTORE_SUITE_REVISION', { revisionId: button.dataset.id });
      if (response?.status !== 'SUCCESS') return ui.showBentoAlert('Restore gagal', response?.error || 'Revision tidak dapat dipulihkan.', '⚠️');
      ui.closeQaWorkspace();
      ui.fetchInitialState();
      announce('Suite berhasil dipulihkan');
    }));
  });

  document.getElementById('btnWorkspaceBackup')?.addEventListener('click', () => {
    const backup = ui.getBackupSnapshot();
    const secretPath = findHardcodedSecret(backup);
    if (secretPath) return ui.showBentoAlert('Backup diblokir', `Data sensitif terdeteksi di ${secretPath}.`, '⚠️');
    ui.downloadFile(JSON.stringify(backup, null, 2), `qa-workspace-backup-${Date.now()}.json`, 'application/json');
  });
});
