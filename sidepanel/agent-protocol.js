// sidepanel/agent-protocol.js - Pure AI Sharing Agent protocol
// Tool vocabulary + JSON action parsing for the autonomous agent loop.
// Extracted as a pure module so it is unit-testable (see tests/unit/agent-protocol.test.mjs).
// Loaded via script tag BEFORE sidepanel/ai-agent.js.

  const AGENT_TOOLS = Object.freeze({
    click: '{"tool":"click","selector":"CSS selector"} — klik tombol/link (mis. tombol Login, tombol/ikon Cari).',
    fill: '{"tool":"fill","selector":"CSS selector","value":"teks"} — isi input/textarea dengan data tes.',
    select: '{"tool":"select","selector":"CSS selector","value":"teks atau value option"} — pilih opsi pada <select>.',
    hover: '{"tool":"hover","selector":"CSS selector"} — arahkan kursor ke elemen (mis. membuka dropdown menu hover).',
    press: '{"tool":"press","selector":"CSS selector (opsional, kosongkan utk elemen fokus saat ini)","value":"Enter"} — tekan tombol keyboard, umum untuk submit search box tanpa tombol Cari eksplisit.',
    read: '{"tool":"read","selector":"CSS selector"} — baca teks yang tampil pada elemen/kontainer (mis. hasil pencarian, daftar produk) agar bisa "melihat" datanya sebelum memutuskan langkah berikutnya. TIDAK mengubah halaman.',
    go_back: '{"tool":"go_back"} — kembali ke halaman sebelumnya lewat riwayat navigasi BROWSER ASLI (chrome.tabs.goBack, bukan window.history.back() halaman - jadi tetap bekerja walau halamannya SPA), berguna setelah membuka satu item saat menjelajah/scraping banyak item dari sebuah daftar. BISA dimasukkan ke "steps" final jika test memang perlu memverifikasi tombol back/forward.',
    go_forward: '{"tool":"go_forward"} — maju ke halaman berikutnya lewat riwayat navigasi BROWSER ASLI (chrome.tabs.goForward), kebalikan dari go_back. BISA dimasukkan ke "steps" final.',
    wait: '{"tool":"wait","ms":800} — tunggu halaman stabil (maks 6000ms).',
    done: '{"tool":"done","summary":"ringkasan singkat","steps":[{"action":"click","selector":"...","value":"...","description":"..."}],"bugs":[{"title":"...","errorMsg":"...","expected":"...","actual":"...","severity":"LOW|MEDIUM|HIGH|CRITICAL","triggerAction":"...","triggerSelector":"..."}]} — selesai, serahkan test case lengkap. "bugs" opsional - isi hanya jika benar-benar menemukan bug.'
  });

  // Extract a single agent action object from the AI reply. The AI must answer
  // with exactly one JSON object; tolerate markdown code fences around it.
  function parseAgentAction(reply) {
    const text = reply && String(reply);
    const jsonMatch = text && text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { tool: 'retry', reason: 'AI tidak mengembalikan JSON aksi.' };
    try {
      const obj = JSON.parse(jsonMatch[0]);
      const tool = String(obj.tool || '').toLowerCase();
      const okTools = ['click', 'fill', 'select', 'hover', 'press', 'read', 'go_back', 'go_forward', 'wait', 'done', 'retry'];
      if (!okTools.includes(tool)) return { tool: 'retry', reason: `Tool tidak dikenal: ${tool}` };
      return { ...obj, tool };
    } catch (e) {
      return { tool: 'retry', reason: 'Gagal parse aksi: ' + e.message };
    }
  }

  // done = the agent finished exploring and hands over the final test case.
  function isTerminalAction(action) {
    return Boolean(action && action.tool === 'done');
  }

  // Labels that signal a destructive/irreversible action. The agent must ask for
  // explicit user confirmation before clicking such an element (safety gate).
  const DESTRUCTIVE_RE = /(hapus|menghapus|delete|remove|log\s?out|sign\s?out|keluar|clear\s?(all|data|cache)?|reset|uninstall|discard|trash|revoke|abort|batal\s?kan|tutup\s?(akun|sesi)|deactivate|nonaktifkan|withdraw)/i;

  function isDestructiveLabel(label) {
    return DESTRUCTIVE_RE.test(String(label || ''));
  }

  function agentToolDocs() {
    return Object.entries(AGENT_TOOLS).map(([, v]) => `- ${v}`).join('\n');
  }
