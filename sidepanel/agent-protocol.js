// sidepanel/agent-protocol.js - Pure AI Sharing Agent protocol
// Tool vocabulary + JSON action parsing for the autonomous agent loop.
// Extracted as a pure module so it is unit-testable (see tests/unit/agent-protocol.test.mjs).
// Loaded via script tag BEFORE sidepanel/ai-agent.js.

  const AGENT_TOOLS = Object.freeze({
    click: '{"tool":"click","selector":"CSS selector"} — klik tombol/link (mis. tombol Login).',
    fill: '{"tool":"fill","selector":"CSS selector","value":"teks"} — isi input/textarea dengan data tes.',
    select: '{"tool":"select","selector":"CSS selector","value":"teks atau value option"} — pilih opsi pada <select>.',
    wait: '{"tool":"wait","ms":800} — tunggu halaman stabil (maks 6000ms).',
    done: '{"tool":"done","summary":"ringkasan singkat","steps":[{"action":"click","selector":"...","value":"...","description":"..."}]} — selesai, serahkan test case lengkap.'
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
      const okTools = ['click', 'fill', 'select', 'wait', 'done', 'retry'];
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

  function agentToolDocs() {
    return Object.entries(AGENT_TOOLS).map(([, v]) => `- ${v}`).join('\n');
  }
