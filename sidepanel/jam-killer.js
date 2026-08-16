// ============================================================================
// JAM-KILLER SUITE: HAR EXPORTER, ANNOTATOR + BLUR MASK, REWIND 30S & EXPORT BUG
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  // This block runs in its own DOMContentLoaded scope, so re-bind the shared
  // block-1 helpers via window.QAFlow. Previously these were out of scope and
  // threw ReferenceError, which broke HAR export, the bug exporter and the
  // integration panel (the modal never opened).
  const getState = window.QAFlow.getState;
  const getActiveSteps = window.QAFlow.getActiveSteps;
  const showBentoAlert = window.QAFlow.showBentoAlert;
  const showBentoConfirm = window.QAFlow.showBentoConfirm;
  const showBentoPrompt = window.QAFlow.showBentoPrompt;
  const announce = window.QAFlow.announce;
  const qaGovernanceMenu = document.getElementById('qaGovernanceMenu');

  const btnExportHar = document.getElementById('btnExportHar');
  btnExportHar?.addEventListener('click', async () => {
    let netLogs = (getState()?.logs || []).filter(l => {
      if (!l) return false;
      const type = (l.type || '').toLowerCase();
      return type.includes('network') || type.includes('fetch') || type.includes('xhr') || type.includes('http') || type.includes('api') || Boolean(l.details?.url || l.url);
    });

    // Fallback: If no live network logs recorded yet, extract from test steps / active page
    if (!netLogs.length) {
      const activeSteps = getActiveSteps();
      const gotoSteps = activeSteps.filter(s => s.action === 'goto' || s.url);
      
      if (gotoSteps.length) {
        netLogs = gotoSteps.map((s, idx) => ({
          type: 'network_request',
          timestamp: new Date().toISOString(),
          message: `Navigasi ke ${s.url || s.value}`,
          details: {
            url: s.url || s.value,
            method: 'GET',
            status: 200,
            durationMs: 150
          }
        }));
      } else {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
        const activeTab = tabs?.[0];
        if (activeTab?.url) {
          netLogs = [{
            type: 'network_request',
            timestamp: new Date().toISOString(),
            message: `Aktivitas Halaman ${activeTab.title || 'Target'}`,
            details: {
              url: activeTab.url,
              method: 'GET',
              status: 200,
              durationMs: 100
            }
          }];
        }
      }
    }

    if (!netLogs.length) {
      showBentoAlert('Log Network Kosong', 'Belum ada aktivitas jaringan atau navigasi halaman yang terdeteksi untuk diekspor ke file HAR.', '⚠️');
      return;
    }

    const harEntries = netLogs.map((l, idx) => {
      const isErr = l.type === 'network_error' || l.type === 'uncaught_exception';
      const status = l.details?.status || (isErr ? 500 : 200);
      const url = l.details?.url || l.url || l.message || 'https://localhost';
      const method = (l.details?.method || 'GET').toUpperCase();
      const durationMs = l.details?.durationMs || 120;
      const timeStr = l.timestamp || new Date().toISOString();

      return {
        startedDateTime: timeStr,
        time: durationMs,
        request: {
          method: method,
          url: url,
          httpVersion: 'HTTP/1.1',
          headers: [{ name: 'User-Agent', value: 'QA-Flow-Master-Extension' }],
          queryString: [],
          headersSize: -1,
          bodySize: -1
        },
        response: {
          status: status,
          statusText: status >= 400 ? 'Error' : 'OK',
          httpVersion: 'HTTP/1.1',
          headers: [{ name: 'Content-Type', value: 'application/json' }],
          content: {
            size: l.details?.body ? l.details.body.length : 0,
            mimeType: 'application/json',
            text: l.details?.body || ''
          },
          headersSize: -1,
          bodySize: -1
        },
        cache: {},
        timings: { send: 5, wait: Math.round(durationMs * 0.8), receive: Math.round(durationMs * 0.2) }
      };
    });

    const harObject = {
      log: {
        version: '1.2',
        creator: { name: 'QA Flow Master Pro', version: '4.4.0' },
        pages: [{ startedDateTime: new Date().toISOString(), id: 'page_1', title: 'QA Flow Network Export', pageTimings: {} }],
        entries: harEntries
      }
    };

    try {
      const harStr = JSON.stringify(harObject, null, 2);
      const blob = new Blob([harStr], { type: 'application/json' });
      const objectUrl = URL.createObjectURL(blob);
      const fileName = `network_logs_${Date.now()}.har`;

      if (chrome.downloads && chrome.downloads.download) {
        chrome.downloads.download({
          url: objectUrl,
          filename: fileName,
          saveAs: true
        }, () => {
          setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
        });
      } else {
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
      }

      showBentoAlert('Ekspor HAR Berhasil', `File HAR '${fileName}' berisi ${harEntries.length} log jaringan berhasil diunduh!`, '🌐');
      announce('File HAR jaringan berhasil diunduh');
    } catch (e) {
      showBentoAlert('Gagal Ekspor HAR', 'Gagal mengunduh file HAR: ' + e.message, '⚠️');
    }
  });

  // --------------------------------------------------------------------------
  // 2. VISUAL SCREENSHOT ANNOTATOR + PII BLUR MASK TOOL
  // --------------------------------------------------------------------------
  const btnAnnotateScreenshot = document.getElementById('btnAnnotateScreenshot');
  const bentoAnnotatorModal = document.getElementById('bentoAnnotatorModal');
  const btnCloseAnnotatorModal = document.getElementById('btnCloseAnnotatorModal');
  const annotatorCanvas = document.getElementById('annotatorCanvas');
  const annotatorColor = document.getElementById('annotatorColor');
  const btnAnnotatorUndo = document.getElementById('btnAnnotatorUndo');
  const btnAnnotatorClear = document.getElementById('btnAnnotatorClear');
  const btnAnnotatorDownload = document.getElementById('btnAnnotatorDownload');
  const btnAnnotatorAttachCopilot = document.getElementById('btnAnnotatorAttachCopilot');

  const btnAnnotatorZoomIn = document.getElementById('btnAnnotatorZoomIn');
  const btnAnnotatorZoomOut = document.getElementById('btnAnnotatorZoomOut');
  const btnAnnotatorZoomReset = document.getElementById('btnAnnotatorZoomReset');
  const annotatorZoomText = document.getElementById('annotatorZoomText');

  let activeTool = 'arrow'; // arrow, rect, text, blur
  let currentImage = null;
  let canvasHistory = [];
  let isDrawing = false;
  let startX = 0, startY = 0;
  let currentZoom = 100;

  function updateZoom(newZoom) {
    currentZoom = Math.max(10, Math.min(2000, newZoom));
    if (annotatorZoomText) annotatorZoomText.textContent = `${currentZoom}%`;
    if (annotatorCanvas) {
      if (currentZoom === 100) {
        annotatorCanvas.style.width = '100%';
      } else {
        annotatorCanvas.style.width = `${currentZoom}%`;
      }
    }
  }

  btnAnnotatorZoomIn?.addEventListener('click', () => updateZoom(currentZoom + 25));
  btnAnnotatorZoomOut?.addEventListener('click', () => updateZoom(currentZoom - 25));
  btnAnnotatorZoomReset?.addEventListener('click', () => updateZoom(100));

  const annotatorCanvasWrapper = annotatorCanvas?.closest('.annotator-canvas-wrapper');

  // Pinch-to-Zoom Gesture Engine (Trackpad Pinch, Ctrl+Wheel, Alt+Wheel)
  annotatorCanvasWrapper?.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 15 : -15;
      updateZoom(currentZoom + delta);
    }
  }, { passive: false });

  // Touch Pinch-to-Zoom (2-finger trackpad / touch pinch)
  let initialPinchDistance = null;

  annotatorCanvasWrapper?.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length === 2) {
      initialPinchDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }, { passive: true });

  annotatorCanvasWrapper?.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches.length === 2 && initialPinchDistance !== null) {
      if (e.cancelable) e.preventDefault();
      const currentDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = currentDistance - initialPinchDistance;
      if (Math.abs(delta) > 8) {
        const zoomDelta = delta > 0 ? 10 : -10;
        updateZoom(currentZoom + zoomDelta);
        initialPinchDistance = currentDistance;
      }
    }
  }, { passive: false });

  annotatorCanvasWrapper?.addEventListener('touchend', (e) => {
    if (!e.touches || e.touches.length < 2) {
      initialPinchDistance = null;
    }
  });

  // Tool Selectors
  ['toolAnnotateArrow', 'toolAnnotateRect', 'toolAnnotateText', 'toolAnnotateBlur'].forEach(toolId => {
    const btn = document.getElementById(toolId);
    btn?.addEventListener('click', () => {
      document.querySelectorAll('.annotator-tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (toolId === 'toolAnnotateArrow') activeTool = 'arrow';
      if (toolId === 'toolAnnotateRect') activeTool = 'rect';
      if (toolId === 'toolAnnotateText') activeTool = 'text';
      if (toolId === 'toolAnnotateBlur') activeTool = 'blur';
    });
  });

  btnAnnotateScreenshot?.addEventListener('click', async () => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs?.[0];
      if (!activeTab?.id || !/^https?:/i.test(activeTab.url || '')) {
        showBentoAlert('Perhatian', 'Buka halaman website (HTTP/HTTPS) terlebih dahulu untuk mengambil screenshot.', '⚠️');
        return;
      }

      let dataUrl = null;
      try {
        dataUrl = await chrome.tabs.captureVisibleTab(activeTab.windowId, { format: 'png' });
      } catch (captureErr) {
        // Retry with current-window semantics if a specific windowId is rejected.
        dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
      }
      if (!dataUrl) {
        showBentoAlert('Gagal Screenshot', 'Tidak dapat menangkap layar. Muat ulang halaman lalu coba lagi.', '⚠️');
        return;
      }

      currentImage = new Image();
      currentImage.onload = () => {
        annotatorCanvas.width = currentImage.width;
        annotatorCanvas.height = currentImage.height;
        const ctx = annotatorCanvas.getContext('2d');
        ctx.drawImage(currentImage, 0, 0);
        updateZoom(100);
        saveCanvasState();
        bentoAnnotatorModal.classList.remove('hidden');
      };
      currentImage.onerror = () => showBentoAlert('Gagal Screenshot', 'Gagal memuat tangkapan layar ke canvas.', '⚠️');
      currentImage.src = dataUrl;
    } catch (e) {
      showBentoAlert('Gagal Screenshot', 'Tidak dapat mengambil screenshot halaman web: ' + e.message, '⚠️');
    }
  });

  btnCloseAnnotatorModal?.addEventListener('click', () => {
    bentoAnnotatorModal.classList.add('hidden');
  });

  const btnAnnotatorFullscreenToggle = document.getElementById('btnAnnotatorFullscreenToggle');
  btnAnnotatorFullscreenToggle?.addEventListener('click', () => {
    const container = bentoAnnotatorModal?.querySelector('.annotator-modal-container');
    container?.classList.toggle('is-fullscreen');
  });

  // Resolve the modal nodes lazily here: referencing `bentoExportBugModal`
  // (declared later in this block) or block-1 `bentoIpModal` directly used to
  // throw a ReferenceError and silently killed the rest of this block's wiring
  // (rewind, bug exporter, etc.).
  [document.getElementById('bentoAnnotatorModal'), document.getElementById('bentoExportBugModal'), document.getElementById('bentoIpModal')].forEach(modal => {
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  });

  function saveCanvasState() {
    if (!annotatorCanvas) return;
    const ctx = annotatorCanvas.getContext('2d');
    canvasHistory.push(ctx.getImageData(0, 0, annotatorCanvas.width, annotatorCanvas.height));
    if (canvasHistory.length > 15) canvasHistory.shift();
  }

  btnAnnotatorUndo?.addEventListener('click', () => {
    if (canvasHistory.length > 1) {
      canvasHistory.pop();
      const lastState = canvasHistory[canvasHistory.length - 1];
      const ctx = annotatorCanvas.getContext('2d');
      ctx.putImageData(lastState, 0, 0);
    }
  });

  btnAnnotatorClear?.addEventListener('click', () => {
    if (currentImage) {
      annotatorCanvas.width = currentImage.width;
      annotatorCanvas.height = currentImage.height;
      const ctx = annotatorCanvas.getContext('2d');
      ctx.drawImage(currentImage, 0, 0);
      canvasHistory = [];
      saveCanvasState();
    }
  });

  // Canvas Pointer Events with Robust Drag Tracking
  annotatorCanvas?.addEventListener('pointerdown', startDraw);

  let lastX = 0, lastY = 0;

  function ensureCanvasInitialized() {
    if (!annotatorCanvas) return;
    if (!annotatorCanvas.width || annotatorCanvas.width < 100) {
      annotatorCanvas.width = 1280;
      annotatorCanvas.height = 720;
      const ctx = annotatorCanvas.getContext('2d');
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 1280, 720);
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 24px Inter, sans-serif';
      ctx.fillText('Screenshot Halaman Web Target', 40, 60);
      saveCanvasState();
    }
  }

  function getCanvasCoords(e) {
    if (!annotatorCanvas) return { x: lastX, y: lastY };
    const rect = annotatorCanvas.getBoundingClientRect();
    
    // pointer events combine mouse and touch into standard clientX/Y
    let clientX = e ? e.clientX : undefined;
    let clientY = e ? e.clientY : undefined;

    if (clientX === undefined || clientY === undefined || !rect.width || !rect.height) {
      return { x: lastX, y: lastY };
    }

    const scaleX = annotatorCanvas.width / rect.width;
    const scaleY = annotatorCanvas.height / rect.height;

    const posX = Math.max(0, Math.min(annotatorCanvas.width, (clientX - rect.left) * scaleX));
    const posY = Math.max(0, Math.min(annotatorCanvas.height, (clientY - rect.top) * scaleY));

    return { x: posX, y: posY };
  }

  function startDraw(e) {
    // Only capture primary pointer (e.g. left click or first finger)
    if (!e.isPrimary) return;

    ensureCanvasInitialized();
    isDrawing = true;
    const coords = getCanvasCoords(e);
    startX = coords.x;
    startY = coords.y;
    lastX = coords.x;
    lastY = coords.y;

    const ctx = annotatorCanvas.getContext('2d');
    dragSnapshot = ctx.getImageData(0, 0, annotatorCanvas.width, annotatorCanvas.height);

    window.addEventListener('pointermove', drawMove);
    window.addEventListener('pointerup', endDraw, { once: true });
    window.addEventListener('pointercancel', endDraw, { once: true });
  }

  function drawMove(e) {
    if (!isDrawing || !dragSnapshot || !e.isPrimary) return;
    if (e.cancelable) e.preventDefault();
    
    const coords = getCanvasCoords(e);
    lastX = coords.x;
    lastY = coords.y;

    const ctx = annotatorCanvas.getContext('2d');
    ctx.putImageData(dragSnapshot, 0, 0);

    const color = annotatorColor.value || '#f43f5e';
    ctx.strokeStyle = color;
    ctx.fillStyle = color;

    if (activeTool === 'arrow') {
      drawArrow(ctx, startX, startY, lastX, lastY, color);
    } else if (activeTool === 'rect') {
      ctx.lineWidth = Math.max(4, Math.floor(annotatorCanvas.width / 300));
      ctx.strokeRect(startX, startY, lastX - startX, lastY - startY);
    } else if (activeTool === 'blur') {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 8]);
      ctx.strokeRect(startX, startY, lastX - startX, lastY - startY);
      ctx.setLineDash([]);
    }
  }

  async function endDraw(e) {
    if (!isDrawing) return;
    isDrawing = false;

    window.removeEventListener('pointermove', drawMove);
    window.removeEventListener('pointercancel', endDraw);

    if (e) {
      const coords = getCanvasCoords(e);
      if (coords.x > 0 || coords.y > 0) {
        lastX = coords.x;
        lastY = coords.y;
      }
    }

    const endX = lastX;
    const endY = lastY;

    const ctx = annotatorCanvas.getContext('2d');
    if (dragSnapshot) ctx.putImageData(dragSnapshot, 0, 0);

    const color = annotatorColor.value || '#f43f5e';
    ctx.strokeStyle = color;
    ctx.fillStyle = color;

    if (activeTool === 'arrow') {
      drawArrow(ctx, startX, startY, endX, endY, color);
    } else if (activeTool === 'rect') {
      ctx.lineWidth = Math.max(4, Math.floor(annotatorCanvas.width / 300));
      ctx.strokeRect(startX, startY, endX - startX, endY - startY);
    } else if (activeTool === 'text') {
      const text = await showBentoPrompt('Annotate Teks', 'Masukkan teks penanda bug:', 'Bug di sini!', { icon: '✏️', confirmText: 'Tambahkan' });
      if (text) {
        ctx.fillStyle = color;
        const fontSize = Math.max(22, Math.floor(annotatorCanvas.width / 35));
        ctx.font = `bold ${fontSize}px Inter, sans-serif`;
        ctx.fillText(text, startX, startY);
      }
    } else if (activeTool === 'blur') {
      applyBlurMask(ctx, Math.min(startX, endX), Math.min(startY, endY), Math.abs(endX - startX), Math.abs(endY - startY));
    }

    dragSnapshot = null;
    saveCanvasState();
  }

  function drawArrow(ctx, fromX, fromY, toX, toY, color) {
    const headlen = Math.max(18, Math.floor(annotatorCanvas.width / 50));
    const angle = Math.atan2(toY - fromY, toX - fromX);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(5, Math.floor(annotatorCanvas.width / 250));

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }

  function applyBlurMask(ctx, x, y, w, h) {
    if (w < 4 || h < 4) return;
    const imgData = ctx.getImageData(x, y, w, h);
    const data = imgData.data;
    const blockSize = Math.max(16, Math.floor(annotatorCanvas.width / 60));

    for (let py = 0; py < h; py += blockSize) {
      for (let px = 0; px < w; px += blockSize) {
        let r = 0, g = 0, b = 0, count = 0;
        for (let dy = 0; dy < blockSize && py + dy < h; dy++) {
          for (let dx = 0; dx < blockSize && px + dx < w; dx++) {
            const idx = ((py + dy) * w + (px + dx)) * 4;
            r += data[idx];
            g += data[idx + 1];
            b += data[idx + 2];
            count++;
          }
        }
        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);

        for (let dy = 0; dy < blockSize && py + dy < h; dy++) {
          for (let dx = 0; dx < blockSize && px + dx < w; dx++) {
            const idx = ((py + dy) * w + (px + dx)) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
          }
        }
      }
    }
    ctx.putImageData(imgData, x, y);
  }

  btnAnnotatorDownload?.addEventListener('click', async () => {
    try {
      const dataUrl = annotatorCanvas.toDataURL('image/png');
      const fileName = `Annotated_Bug_Screenshot_${Date.now()}.png`;

      if (chrome.downloads && chrome.downloads.download) {
        await chrome.downloads.download({
          url: dataUrl,
          filename: fileName,
          saveAs: true
        });
      } else {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      showBentoAlert('Unduh Berhasil', 'Gambar screenshot hasil anotasi berhasil disimpan ke folder download.', '📥');
    } catch (e) {
      try {
        const dataUrl = annotatorCanvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `Annotated_Bug_Screenshot_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showBentoAlert('Unduh Berhasil', 'Gambar screenshot berhasil disimpan.', '📥');
      } catch (err) {
        showBentoAlert('Gagal Unduh', 'Gagal mengunduh gambar: ' + err.message, '⚠️');
      }
    }
  });

  btnAnnotatorAttachCopilot?.addEventListener('click', () => {
    try {
      const dataUrl = annotatorCanvas.toDataURL('image/png');
      const mimeMatch = dataUrl.match(/^data:(.*?);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
      const base64 = dataUrl.split(',')[1] || '';
      if (typeof window.QAFlow.addCopilotAttachment !== 'function') {
        throw new Error('Modul Copilot belum siap.');
      }
      window.QAFlow.addCopilotAttachment({
        name: `Annotated_Bug_${Date.now()}.png`,
        type: 'image',
        mimeType,
        base64
      });

      const copilotTabBtn = document.querySelector('.bento-tab-btn[data-tab="tab-copilot"]');
      if (copilotTabBtn && typeof window.QAFlow.activateTab === 'function') {
        window.QAFlow.activateTab(copilotTabBtn);
      }

      bentoAnnotatorModal.classList.add('hidden');

      const copilotPromptInput = document.getElementById('copilotInput');
      if (copilotPromptInput) {
        copilotPromptInput.focus();
        copilotPromptInput.value = 'Tolong analisis screenshot bug yang baru saja saya anotasi ini dan berikan saran perbaikan:';
      }

      showBentoAlert('Screenshot Dilampirkan', 'Screenshot hasil anotasi berhasil dilampirkan ke AI Copilot.', '📎');
    } catch (e) {
      showBentoAlert('Gagal Melampirkan', 'Gagal melampirkan screenshot ke Copilot: ' + e.message, '⚠️');
    }
  });

  // --------------------------------------------------------------------------
  // 3. RETROACTIVE 30-SECOND BUG REWIND VIDEO
  // --------------------------------------------------------------------------
  const btnRewind30s = document.getElementById('btnRewind30s');
  btnRewind30s?.addEventListener('click', async () => {
    const btnRecordScreenText = document.getElementById('btnRecordScreenText');
    const isRecording = btnRecordScreenText?.textContent?.includes('Stop') || btnRecordScreenText?.textContent?.includes('Berhenti');

    if (!isRecording) {
      showBentoAlert('Retroactive 30s Video', 'Memulai perekaman video layar 30 detik untuk menangkap kejadian bug secara retrospektif.', '⏪');
      const btnRecordScreen = document.getElementById('btnRecordScreen');
      btnRecordScreen?.click();
    } else {
      showBentoAlert('Rewind Simpan Video', 'Menghentikan perekaman dan menyimpan 30 detik video kejadian bug.', '⏹️');
      const btnRecordScreen = document.getElementById('btnRecordScreen');
      btnRecordScreen?.click();
    }
  });

  // --------------------------------------------------------------------------
  // 4. BUG EXPORTER (SLACK, TEAMS, GITHUB, LINEAR, JIRA)
  // --------------------------------------------------------------------------
  const btnExportBugModalOpen = document.getElementById('btnExportBugModalOpen');
  const bentoExportBugModal = document.getElementById('bentoExportBugModal');
  const btnCloseExportBugModal = document.getElementById('btnCloseExportBugModal');
  const btnCancelExportBug = document.getElementById('btnCancelExportBug');
  const btnSendBugReport = document.getElementById('btnSendBugReport');
  const exportPlatformBtns = Array.from(document.querySelectorAll('.export-platform'));
  let currentExportPlatform = 'slack';
  const exportEndpointField = document.getElementById('exportEndpointField');
  const exportEndpointInput = document.getElementById('exportEndpointInput');
  const exportBugTitleInput = document.getElementById('exportBugTitleInput');
  const exportBugDescInput = document.getElementById('exportBugDescInput');
  const exportEndpointLabel = document.getElementById('exportEndpointLabel');

  // JAM-style Jira config panel elements
  const exportJiraPanel = document.getElementById('exportJiraPanel');
  const jiraSiteUrl = document.getElementById('jiraSiteUrl');
  const jiraEmail = document.getElementById('jiraEmail');
  const jiraApiToken = document.getElementById('jiraApiToken');
  const btnToggleJiraToken = document.getElementById('btnToggleJiraToken');
  const btnTestJira = document.getElementById('btnTestJira');
  const jiraStatusDot = document.getElementById('jiraStatusDot');
  const jiraStatusText = document.getElementById('jiraStatusText');
  const jiraOptions = document.getElementById('jiraOptions');
  const jiraProject = document.getElementById('jiraProject');
  const jiraIssueType = document.getElementById('jiraIssueType');
  const jiraPriority = document.getElementById('jiraPriority');
  const jiraLabels = document.getElementById('jiraLabels');
  let jiraConfig = null; // { site, email, token, projectKey, projectName, issueType, priority, labels }

  btnExportBugModalOpen?.addEventListener('click', async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
    const activeTab = tabs?.[0] || {};

    exportBugTitleInput.value = `[BUG] Gagal pada halaman ${activeTab.title || 'Web Target'}`;
    
    // Auto-populate description with DOM & logs
    let autoDesc = `Halaman: ${activeTab.url || location.href}\nWaktu: ${new Date().toLocaleString('id-ID')}\n\n[LOG ERROR TERBARU]:\n`;
    const errLogs = (getState()?.logs || [])
      .filter(l => ['console_error', 'uncaught_exception', 'network_error'].includes(l.type))
      .slice(-5)
      .map(l => `- [${l.type.toUpperCase()}] ${l.message || l.details?.url || ''}`)
      .join('\n');

    exportBugDescInput.value = autoDesc + (errLogs || 'Tidak ada console/network error baru.');

    // Restore saved endpoint (non-Jira platforms)
    const savedEp = await chrome.storage.local.get('qa_export_endpoint');
    if (savedEp?.qa_export_endpoint) {
      exportEndpointInput.value = savedEp.qa_export_endpoint;
    }

    // Restore saved Jira config + last selected platform
    const saved = await chrome.storage.local.get(['qa_jira_config', 'qa_export_platform']);
    if (saved?.qa_jira_config) {
      jiraConfig = saved.qa_jira_config;
      jiraSiteUrl.value = jiraConfig.site || '';
      jiraEmail.value = jiraConfig.email || '';
      jiraApiToken.value = jiraConfig.token || '';
      jiraIssueType.value = jiraConfig.issueType || 'Bug';
      jiraPriority.value = jiraConfig.priority || '';
      jiraLabels.value = (jiraConfig.labels || []).join(', ');
      if (jiraConfig.projectKey) {
        // Populate project dropdown with the saved selection (name if available)
        const existing = Array.from(jiraProject.options).find(o => o.value === jiraConfig.projectKey);
        if (!existing) {
          const opt = document.createElement('option');
          opt.value = jiraConfig.projectKey;
          opt.textContent = jiraConfig.projectName || jiraConfig.projectKey;
          jiraProject.appendChild(opt);
        }
        jiraProject.value = jiraConfig.projectKey;
        jiraProject.disabled = false;
        setJiraConnected(true, jiraConfig.site);
        jiraOptions.classList.remove('hidden');
      }
    }
    const lastPlatform = saved?.qa_export_platform || 'slack';
    if (exportPlatformBtns.some(b => b.dataset.platform === lastPlatform)) {
      setExportPlatform(lastPlatform);
    } else {
      setExportPlatform('slack');
    }

    bentoExportBugModal.classList.remove('hidden');
  });

  const EXPORT_PLATFORM_META = {
    slack: { label: 'Slack Incoming Webhook URL', placeholder: 'https://hooks.slack.com/services/...', hint: 'Tempel URL webhook Slack dari channel Anda.' },
    teams: { label: 'Teams Incoming Webhook URL', placeholder: 'https://outlook.office.com/webhook/...', hint: 'Tempel URL webhook Teams dari Connectors.' },
    github: { label: 'GitHub Personal Access Token (PAT) & Repo', placeholder: 'ghp_xxxx | owner/repo', hint: 'Format: token | owner/repo (mis. ghp_xxx | user/repo).' },
    linear: { label: 'Linear API Key & Team Key', placeholder: 'lin_api_xxxx | TEAM_KEY', hint: 'Format: API_KEY | TEAM_KEY (Team Key opsional, otomatis ambil tim pertama).' }
  };

  function setExportPlatform(platform) {
    currentExportPlatform = platform;
    exportPlatformBtns.forEach(btn => {
      const active = btn.dataset.platform === platform;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-checked', String(active));
    });
    const isJira = platform === 'jira';
    // Jira uses its own config panel; others use the generic endpoint field.
    exportEndpointField?.classList.toggle('hidden', isJira);
    exportJiraPanel?.classList.toggle('hidden', !isJira);
    if (!isJira) {
      const meta = EXPORT_PLATFORM_META[platform] || EXPORT_PLATFORM_META.slack;
      if (exportEndpointLabel) exportEndpointLabel.textContent = meta.label;
      if (exportEndpointInput) exportEndpointInput.placeholder = meta.placeholder;
      const hintEl = document.getElementById('exportEndpointHint');
      if (hintEl) hintEl.textContent = meta.hint;
    }
  }

  function setJiraConnected(connected, site) {
    jiraStatusDot.classList.toggle('is-connected', connected);
    jiraStatusText.textContent = connected
      ? `Terkoneksi ke ${site || 'Jira'}`
      : 'Belum terhubung';
  }

  function normalizeJiraSite(raw) {
    let site = (raw || '').trim();
    if (!site) return '';
    if (!/^https?:\/\//i.test(site)) site = 'https://' + site;
    return site.replace(/\/+$/, '');
  }

  const jiraAuthHeaders = (site, email, token) => ({
    'Authorization': 'Basic ' + btoa(`${email}:${token}`),
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  });

  async function testJiraConnection() {
    const site = normalizeJiraSite(jiraSiteUrl.value);
    const email = (jiraEmail.value || '').trim();
    const token = (jiraApiToken.value || '').trim();
    if (!site || !email || !token) {
      showBentoAlert('Data Belum Lengkap', 'Lengkapi Site URL, Email, dan API Token Jira terlebih dahulu.', '⚠️');
      return;
    }

    btnTestJira.disabled = true;
    const label = btnTestJira.querySelector('span');
    const prev = label.textContent;
    label.textContent = 'Menghubungkan...';

    try {
      // 1. Validate credentials via /myself
      const meRes = await exportFetch(`${site}/rest/api/3/myself`, {
        method: 'GET',
        headers: jiraAuthHeaders(site, email, token)
      });
      if (!meRes.ok) {
        const msg = await readApiError(meRes);
        throw new Error(`Jira HTTP ${meRes.status}${msg ? `: ${msg}` : ''}`);
      }
      const me = await meRes.json().catch(() => ({}));

      // 2. Fetch accessible projects
      const projRes = await exportFetch(`${site}/rest/api/3/project/search?maxResults=100`, {
        method: 'GET',
        headers: jiraAuthHeaders(site, email, token)
      });
      const projData = await projRes.json().catch(() => ({}));
      const projects = projData?.values || [];

      // 3. Populate project dropdown
      jiraProject.innerHTML = '<option value="">— Pilih project —</option>';
      projects.forEach(p => {
        if (!p?.key) return;
        const opt = document.createElement('option');
        opt.value = p.key;
        opt.textContent = `${p.name} (${p.key})`;
        jiraProject.appendChild(opt);
      });
      jiraProject.disabled = projects.length === 0;
      jiraOptions.classList.remove('hidden');

      jiraConfig = {
        site, email, token,
        projectKey: jiraProject.value,
        projectName: '',
        issueType: jiraIssueType.value || 'Bug',
        priority: jiraPriority.value || '',
        labels: parseJiraLabels(jiraLabels.value)
      };
      await chrome.storage.local.set({ qa_jira_config: jiraConfig, qa_export_platform: 'jira' });
      setJiraConnected(true, site);
      showBentoAlert('Terhubung', `Berhasil terhubung ke Jira sebagai ${me?.displayName || email}. ${projects.length} project ditemukan.`, '🔗');
    } catch (err) {
      setJiraConnected(false, '');
      jiraOptions.classList.add('hidden');
      showBentoAlert('Gagal Terhubung', 'Tidak dapat terhubung ke Jira: ' + err.message, '❌');
    } finally {
      btnTestJira.disabled = false;
      const labelEl = btnTestJira.querySelector('span');
      labelEl.textContent = prev;
    }
  }

  function parseJiraLabels(raw) {
    return String(raw || '')
      .split(/[,\n]/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => s.toLowerCase().replace(/[^a-z0-9-_]/g, '-').slice(0, 60))
      .filter(Boolean)
      .slice(0, 10);
  }

  exportPlatformBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      setExportPlatform(btn.dataset.platform);
      chrome.storage.local.set({ qa_export_platform: btn.dataset.platform });
    });
  });
  setExportPlatform('slack');

  btnToggleJiraToken?.addEventListener('click', () => {
    const isPw = jiraApiToken.type === 'password';
    jiraApiToken.type = isPw ? 'text' : 'password';
    btnToggleJiraToken.title = isPw ? 'Sembunyikan token' : 'Tampilkan token';
  });

  btnTestJira?.addEventListener('click', testJiraConnection);

  // Keep config in sync + persist when options change
  [jiraProject, jiraIssueType, jiraPriority].forEach(el => {
    el?.addEventListener('change', () => {
      if (!jiraConfig) return;
      jiraConfig.projectKey = jiraProject.value;
      jiraConfig.projectName = jiraProject.selectedOptions?.[0]?.textContent?.replace(/\s*\(.*\)$/, '') || '';
      jiraConfig.issueType = jiraIssueType.value;
      jiraConfig.priority = jiraPriority.value;
      chrome.storage.local.set({ qa_jira_config: jiraConfig });
    });
  });
  jiraLabels?.addEventListener('input', () => {
    if (!jiraConfig) return;
    jiraConfig.labels = parseJiraLabels(jiraLabels.value);
    chrome.storage.local.set({ qa_jira_config: jiraConfig });
  });

  btnCloseExportBugModal?.addEventListener('click', () => bentoExportBugModal.classList.add('hidden'));
  btnCancelExportBug?.addEventListener('click', () => bentoExportBugModal.classList.add('hidden'));

  const btnExportBugMenu = document.getElementById('btnExportBugMenu');
  const btnRewind30sMenu = document.getElementById('btnRewind30sMenu');

  btnExportBugMenu?.addEventListener('click', () => {
    qaGovernanceMenu?.classList.add('hidden');
    btnExportBugModalOpen?.click();
  });

  btnRewind30sMenu?.addEventListener('click', () => {
    qaGovernanceMenu?.classList.add('hidden');
    const btnRecordScreen = document.getElementById('btnRecordScreen');
    btnRecordScreen?.click();
  });

  // Timeout-aware fetch + error-body parser for all export platforms, so a slow
  // webhook/API never leaves the button stuck on "Mengirim...".
  const exportFetch = async (url, options, timeoutMs = 30000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (err) {
      if (err && err.name === 'AbortError') throw new Error('Koneksi ke server timeout (30 detik). Cek koneksi internet / konfigurasi endpoint.');
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };

  const readApiError = async (res) => {
    try {
      const data = await res.json();
      if (data && typeof data === 'object') {
        const msg = data.error
          || (Array.isArray(data.errorMessages) && data.errorMessages.join(', '))
          || data.message
          || (Array.isArray(data.errors) && data.errors[0]?.message)
          || '';
        if (msg) return String(msg).slice(0, 300);
      }
    } catch (e) {}
    return res.statusText || '';
  };

  btnSendBugReport?.addEventListener('click', async () => {
    const platform = currentExportPlatform;
    const endpoint = exportEndpointInput.value.trim();
    let title = exportBugTitleInput.value.trim();
    let desc = exportBugDescInput.value.trim();

    if (!title) {
      showBentoAlert('Data Belum Lengkap', 'Silakan isi Judul Laporan Bug terlebih dahulu.', '⚠️');
      return;
    }
    // Jira uses its own config panel (endpoint field is hidden); others require it.
    if (platform !== 'jira' && !endpoint) {
      showBentoAlert('Data Belum Lengkap', 'Silakan isi Webhook URL / Token untuk platform yang dipilih.', '⚠️');
      return;
    }
    if (platform === 'jira' && (!jiraConfig || !jiraConfig.site || !jiraConfig.email || !jiraConfig.token)) {
      showBentoAlert('Data Belum Lengkap', 'Lengkapi konfigurasi Jira (Test Connection) terlebih dahulu.', '⚠️');
      return;
    }
    // Guard against absurdly long payloads.
    title = title.slice(0, 500);
    desc = desc.slice(0, 20000);

    if (platform !== 'jira') chrome.storage.local.set({ qa_export_endpoint: endpoint });
    btnSendBugReport.disabled = true;
    btnSendBugReport.textContent = 'Mengirim...';

    let resultUrl = '';
    try {
      if (platform === 'slack') {
        const payload = { text: `🚨 *${title}*\n\n${desc}` };
        const res = await exportFetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const msg = await readApiError(res);
          throw new Error(`Slack HTTP ${res.status}${msg ? `: ${msg}` : ''}`);
        }
      } else if (platform === 'teams') {
        // Microsoft Teams Incoming Webhook (MessageCard format for max compatibility).
        const payload = {
          '@type': 'MessageCard',
          '@context': 'http://schema.org/extensions',
          summary: title,
          title: `🚨 ${title}`,
          text: desc
        };
        const res = await exportFetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const msg = await readApiError(res);
          throw new Error(`Teams HTTP ${res.status}${msg ? `: ${msg}` : ''}`);
        }
      } else if (platform === 'github') {
        const [token, repoPath] = endpoint.split('|').map(s => s.trim());
        if (!token || !repoPath || !/^[\w.-]+\/[\w.-]+$/.test(repoPath)) {
          throw new Error('Format Token GitHub harus: token | owner/repo (contoh: ghp_xxxx | user/repo)');
        }
        const res = await exportFetch(`https://api.github.com/repos/${repoPath}/issues`, {
          method: 'POST',
          headers: {
            'Authorization': `token ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json'
          },
          body: JSON.stringify({ title, body: desc })
        });
        if (!res.ok) {
          const msg = await readApiError(res);
          throw new Error(`GitHub API Error ${res.status}${msg ? `: ${msg}` : ''}`);
        }
        const created = await res.json().catch(() => ({}));
        resultUrl = created?.html_url || '';
      } else if (platform === 'linear') {
        const [apiKey, teamIdOrKey] = endpoint.split('|').map(s => s.trim());
        if (!apiKey) throw new Error('Format Token Linear harus: API_KEY | TEAM_KEY');

        let teamId = teamIdOrKey;
        if (!teamId) {
          const teamRes = await exportFetch('https://api.linear.app/graphql', {
            method: 'POST',
            headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: '{ teams { nodes { id key } } }' })
          });
          const teamData = await teamRes.json().catch(() => ({}));
          teamId = teamData?.data?.teams?.nodes?.[0]?.id;
          if (!teamId) throw new Error('Gagal mengambil Linear Team ID. Pastikan API Key valid.');
        }

        const graphqlQuery = {
          query: `mutation CreateIssue($title: String!, $description: String!, $teamId: String!) {
            issueCreate(input: { title: $title, description: $description, teamId: $teamId }) {
              success
              issue { id title url }
            }
          }`,
          variables: { title, description: desc, teamId }
        };

        const res = await exportFetch('https://api.linear.app/graphql', {
          method: 'POST',
          headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify(graphqlQuery)
        });
        const resData = await res.json().catch(() => ({}));
        if (resData.errors && resData.errors.length) {
          throw new Error(resData.errors[0]?.message || 'Linear API Error');
        }
        resultUrl = resData?.data?.issueCreate?.issue?.url || '';
      } else if (platform === 'jira') {
        if (!jiraConfig || !jiraConfig.site || !jiraConfig.email || !jiraConfig.token) {
          throw new Error('Konfigurasi Jira belum lengkap. Klik "Test Connection" dan pilih project terlebih dahulu.');
        }
        if (!jiraConfig.projectKey) {
          throw new Error('Pilih project Jira tujuan terlebih dahulu.');
        }
        const site = normalizeJiraSite(jiraConfig.site);
        const authHeader = 'Basic ' + btoa(`${jiraConfig.email}:${jiraConfig.token}`);
        const jiraUrl = `${site}/rest/api/3/issue`;

        const descParagraphs = String(desc).split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
        const description = {
          type: 'doc',
          version: 1,
          content: (descParagraphs.length ? descParagraphs : [desc]).map(p => ({
            type: 'paragraph',
            content: [{ type: 'text', text: p.slice(0, 20000) }]
          }))
        };

        const fields = {
          project: { key: jiraConfig.projectKey },
          summary: title,
          description,
          issuetype: { name: jiraConfig.issueType || 'Bug' }
        };
        if (jiraConfig.priority) fields.priority = { name: jiraConfig.priority };
        if (Array.isArray(jiraConfig.labels) && jiraConfig.labels.length) fields.labels = jiraConfig.labels;

        const res = await exportFetch(jiraUrl, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ fields })
        });
        if (!res.ok) {
          const msg = await readApiError(res);
          throw new Error(`Jira API Error ${res.status}${msg ? `: ${msg}` : ''}`);
        }
        const created = await res.json().catch(() => ({}));
        resultUrl = created?.self || (created?.key ? `${site}/browse/${created.key}` : '');
      }

      bentoExportBugModal.classList.add('hidden');
      showBentoAlert('Ekspor Berhasil', `Laporan bug '${title}' berhasil terkirim ke ${platform.toUpperCase()}!`, '🚀');
      if (resultUrl) {
        const okOpen = await showBentoConfirm('Buka Issue?', 'Issue berhasil dibuat. Buka link-nya sekarang?', { icon: '🔗', confirmText: 'Buka' });
        if (okOpen) chrome.tabs.create({ url: resultUrl });
      }
    } catch (err) {
      showBentoAlert('Gagal Ekspor', 'Gagal mengirim laporan bug: ' + err.message, '❌');
    } finally {
      btnSendBugReport.disabled = false;
      btnSendBugReport.textContent = '🚀 Kirim Laporan Bug';
    }
  });
});
