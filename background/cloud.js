// ========================================
// SUPABASE CLOUD SYNC CONFIGURATION
// ========================================
const SUPABASE_URL = 'https://xnyzhuvyftspgvwigcdu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhueXpodXZ5ZnRzcGd2d2lnY2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NjA0OTQsImV4cCI6MjEwMjAzNjQ5NH0.A9R-MazKCruhxCBG15t98mB2DM7lKSlVyU8QMH0z28Q';
let isSupabaseSyncing = false;

// Per-device workspace isolation: each install gets its own random row in
// qa_global_state so separate devices/users never overwrite each other's
// state. Stored outside `appState` so it is never clobbered by a cloud pull.
// Requires the Supabase table's `id` column to be TEXT (see docs/expert-guide.md).
let workspaceId = null;
async function ensureWorkspaceId() {
  if (workspaceId) return workspaceId;
  const stored = await new Promise(resolve => chrome.storage.local.get('qa_workspace_id', resolve));
  if (stored?.qa_workspace_id) {
    workspaceId = stored.qa_workspace_id;
  } else {
    workspaceId = crypto.randomUUID();
    await new Promise(resolve => chrome.storage.local.set({ qa_workspace_id: workspaceId }, resolve));
  }
  return workspaceId;
}

// Tamper-evident audit trail: each entry hash-chains off the previous one
// (device-scoped, capped-window chain - not a substitute for server-side
// signing, but any edit/reorder of a retained entry breaks the chain).
function auditHash(prevHash, entry) {
  const str = prevHash + JSON.stringify(entry);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function pushAuditEntry(fields) {
  const prevHash = appState.auditTrail.length ? appState.auditTrail[appState.auditTrail.length - 1].hash : '00000000';
  const entry = { id: crypto.randomUUID(), device: workspaceId || 'unknown', timestamp: new Date().toISOString(), ...fields, prevHash };
  entry.hash = auditHash(prevHash, entry);
  appState.auditTrail.push(entry);
  appState.auditTrail = appState.auditTrail.slice(-200);
  return entry;
}

async function syncToSupabase(state) {
  if (isSupabaseSyncing) return;
  try {
    isSupabaseSyncing = true;
    const wsId = await ensureWorkspaceId();
    // Sanitize: strip sensitive credentials before cloud sync
    const sanitizedState = { ...state };
    if (sanitizedState.aiSettings) {
      sanitizedState.aiSettings = { provider: sanitizedState.aiSettings.provider, apiKey: '' };
    }
    if (sanitizedState.sessionSecrets) {
      sanitizedState.sessionSecrets = {};
    }
    if (sanitizedState.videoSettings) {
      sanitizedState.videoSettings = { ...sanitizedState.videoSettings, apiKey: '' };
    }
    if (Array.isArray(sanitizedState.copilotThreads)) {
      sanitizedState.copilotThreads = sanitizeCopilotThreadsForCloud(sanitizedState.copilotThreads);
    }
    const response = await fetch(`${SUPABASE_URL}/rest/v1/qa_global_state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ id: wsId, state_data: sanitizedState, updated_at: new Date().toISOString() })
    });
    if (!response.ok) console.error('QA Flow: Supabase Sync Failed', await response.text());
  } catch (err) {
    console.error('QA Flow: Supabase Network Error', err);
  } finally {
    isSupabaseSyncing = false;
  }
}

async function fetchFromSupabase() {
  try {
    isSupabaseSyncing = true;
    const wsId = await ensureWorkspaceId();
    const response = await fetch(`${SUPABASE_URL}/rest/v1/qa_global_state?id=eq.${encodeURIComponent(wsId)}`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0 && data[0].state_data) {
        const cloudData = data[0].state_data;
        
        // Preserve un-synced local video history if cloud is stale
        if (appState.videoHistory?.length > 0) {
           const cloudHistory = Array.isArray(cloudData.videoHistory) ? cloudData.videoHistory : [];
           const merged = [...appState.videoHistory];
           for (const item of cloudHistory) {
             if (!merged.find(m => m.url === item.url)) merged.push(item);
           }
           // Sort by newest first (descending by ID timestamp)
           cloudData.videoHistory = merged.sort((a,b) => {
             const aId = Number(a.id?.replace('vid_', '') || 0);
             const bId = Number(b.id?.replace('vid_', '') || 0);
             return bId - aId;
           }).slice(0, 50);
        }

        // Seamlessly merge copilot chat threads from local and cloud
        if (Array.isArray(cloudData.copilotThreads)) {
          const localThreads = Array.isArray(appState.copilotThreads) ? appState.copilotThreads : [];
          const mergedThreads = [...localThreads];
          for (const cloudThread of cloudData.copilotThreads) {
            const idx = mergedThreads.findIndex(t => t.id === cloudThread.id);
            if (idx >= 0) {
              const localMsgs = mergedThreads[idx].messages?.length || 0;
              const cloudMsgs = cloudThread.messages?.length || 0;
              if (cloudMsgs >= localMsgs) {
                mergedThreads[idx] = cloudThread;
              }
            } else {
              mergedThreads.push(cloudThread);
            }
          }
          cloudData.copilotThreads = mergedThreads;
        } else {
          delete cloudData.copilotThreads;
        }

        // PRESERVE LOCAL SENSITIVE CREDENTIALS (Video API Key, Session Secrets)
        // so Supabase cloud sync (which sanitizes keys before push) never wipes local settings!
        // The AI API key is NOT handled here - it lives only in the separate
        // `qa_ai_settings` local key and is never stored inside `appState`.
        const currentVideoApiKey = appState.videoSettings?.apiKey || '';
        const currentSessionSecrets = appState.sessionSecrets || {};

        appState = { ...appState, ...cloudData };
        // Defense in depth: strip any apiKey that might still be present on an
        // older cloud-side row written before this field was excluded from sync.
        if (appState.aiSettings) appState.aiSettings = { ...appState.aiSettings, apiKey: '' };

        if (currentVideoApiKey) {
          appState.videoSettings = { ...(appState.videoSettings || {}), apiKey: currentVideoApiKey };
        }
        if (Object.keys(currentSessionSecrets).length > 0) {
          appState.sessionSecrets = { ...(appState.sessionSecrets || {}), ...currentSessionSecrets };
        }

        broadcastToSidepanel({ action: 'STATE_CHANGED', data: appState });
        chrome.storage.local.set({ appState });
        console.log('QA Flow: State restored from Supabase Cloud (local credentials preserved).');
      }
    }
  } catch (err) {
    console.error('QA Flow: Supabase Fetch Error', err);
  } finally {
    isSupabaseSyncing = false;
  }
}
