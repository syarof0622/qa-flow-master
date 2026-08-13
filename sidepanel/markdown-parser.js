window.QAMarkdown = (() => {
  function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.copyCopilotCode = (btn, base64code) => {
    try {
      const code = decodeURIComponent(escape(atob(base64code)));
      navigator.clipboard.writeText(code);
      const original = btn.innerHTML;
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#27c93f" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> <span style="color:#27c93f;font-size:9px;margin-left:4px">Copied</span>`;
      setTimeout(() => { btn.innerHTML = original; }, 2000);
    } catch(e) { console.error("Copy failed", e); }
  };

  function highlightJSCode(code) {
    return code
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/("(?:\\"|[^"])*"|'(?:\\'|[^'])*')/g, '<span class="sy-string">$1</span>')
      .replace(/(`(?:\\`|[^`])*`)/g, '<span class="sy-string">$1</span>')
      .replace(/\b(await|async|const|let|var|function|return|if|else|for|while|class|import|export|from|switch|case|break|try|catch|throw)\b/g, '<span class="sy-keyword">$1</span>')
      .replace(/\b(true|false|null|undefined)\b/g, '<span class="sy-number">$1</span>')
      .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="sy-number">$1</span>')
      .replace(/(\w+)\s*(?=\()/g, '<span class="sy-function">$1</span>')
      .replace(/(\/\/.*$)/gm, '<span class="sy-comment">$1</span>')
      .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="sy-comment">$1</span>');
  }

  function getAlertIcon(type) {
    switch(type) {
      case 'NOTE': return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
      case 'TIP': return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1.45.62 2.84 1.5 3.5.76.76 1.23 1.52 1.41 2.5"></path></svg>`;
      case 'WARNING': return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
      case 'IMPORTANT': return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
      default: return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }
  }

  function parse(text) {
    if (!text) return '';
    let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // Code blocks
    html = html.replace(/```(\w*)[ \t\r]*\n([\s\S]*?)```/g, (m, lang, code) => {
      const encodedCode = btoa(unescape(encodeURIComponent(code)));
      const highlighted = highlightJSCode(code);
      return `<div class="bento-code-card">
        <div class="bento-mac-header">
          <div class="mac-dots"><div class="mac-dot red"></div><div class="mac-dot yellow"></div><div class="mac-dot green"></div></div>
          <div class="code-card-header">${escapeHTML(lang || 'code')}</div>
          <button class="bento-copy-btn" onclick="window.copyCopilotCode(this, '${encodedCode}')" title="Copy code">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </button>
        </div>
        <pre class="bento-code-block"><code>${highlighted}</code></pre>
      </div>`;
    });
    
    html = html.replace(/`([^`\n]+)`/g, '<code class="bento-inline-code">$1</code>');
    html = html.replace(/^### (.*$)/gim, '<h4 class="bento-chat-h4">$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h3 class="bento-chat-h3">$1</h3>');
    html = html.replace(/^# (.*$)/gim, '<h2 class="bento-chat-h2">$1</h2>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="bento-chat-link">$1 <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left:2px"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a>');

    const lines = html.split('\n');
    let inList = false;
    let listType = 'ul';
    let inTable = false;
    let inAlert = false;
    const result = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      
      // Table processing
      if (line.startsWith('|') && line.endsWith('|')) {
        if (!inTable) {
          result.push('<div class="bento-table-wrapper"><table class="bento-chat-table">');
          inTable = true;
        }
        if (line.match(/^\|(?:[-:]+[-|:]*)+\|$/)) continue; 
        
        const cells = line.split('|').filter((c, idx, arr) => idx > 0 && idx < arr.length - 1).map(c => c.trim());
        const tag = (inTable && result.length > 0 && result[result.length - 1] === '<div class="bento-table-wrapper"><table class="bento-chat-table">') ? 'th' : 'td';
        result.push(`<tr>${cells.map(c => `<${tag}>${c}</${tag}>`).join('')}</tr>`);
        continue;
      } else if (inTable) {
        result.push('</table></div>');
        inTable = false;
      }

      // GitHub Alerts & Blockquotes
      if (line.startsWith('>')) {
        const quoteText = line.substring(1).trim();
        const alertMatch = quoteText.match(/^\[!(NOTE|TIP|WARNING|IMPORTANT)\]\s*(.*)$/i);
        if (alertMatch) {
          if (!inAlert) {
            const type = alertMatch[1].toUpperCase();
            const icon = getAlertIcon(type);
            result.push(`<div class="bento-alert bento-alert-${type.toLowerCase()}"><div class="bento-alert-title">${icon} ${type}</div><div class="bento-alert-content">${alertMatch[2]}`);
            inAlert = true;
          }
          continue;
        } else if (inAlert) {
          result.push(`<p>${quoteText}</p>`);
          continue;
        } else {
          result.push(`<blockquote class="bento-chat-blockquote">${quoteText}</blockquote>`);
          continue;
        }
      } else if (inAlert) {
        result.push(`</div></div>`);
        inAlert = false;
      }

      // Task lists and normal lists
      const taskMatch = line.match(/^[-*•]\s+\[([ xX])\]\s+(.*)/);
      const bulletMatch = line.match(/^[-*•]\s+(.*)/);
      const numberMatch = line.match(/^\d+\.\s+(.*)/);
      
      if (taskMatch || bulletMatch || numberMatch) {
        const type = numberMatch ? 'ol' : 'ul';
        const isTask = !!taskMatch;
        const content = taskMatch ? taskMatch[2] : (bulletMatch ? bulletMatch[1] : numberMatch[1]);
        
        if (!inList) {
          result.push(`<${type} class="bento-chat-list ${isTask ? 'task-list' : ''}">`);
          inList = true;
          listType = type;
        } else if (listType !== type) {
          result.push(`</${listType}><${type} class="bento-chat-list ${isTask ? 'task-list' : ''}">`);
          listType = type;
        }
        
        if (isTask) {
          const checked = taskMatch[1].toLowerCase() === 'x' ? 'checked' : '';
          const checkboxSvg = checked 
            ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`
            : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>`;
          result.push(`<li class="task-list-item"><span class="task-checkbox ${checked}">${checkboxSvg}</span><span>${content}</span></li>`);
        } else {
          result.push(`<li>${content}</li>`);
        }
      } else {
        if (inList) {
          result.push(`</${listType}>`);
          inList = false;
        }
        if (line && !line.startsWith('<div') && !line.startsWith('<table') && !line.startsWith('<blockquote') && !line.startsWith('</div')) {
          result.push(`<p class="bento-chat-p">${line}</p>`);
        } else if (line) {
          result.push(line);
        }
      }
    }
    
    if (inList) result.push(`</${listType}>`);
    if (inTable) result.push(`</table></div>`);
    if (inAlert) result.push(`</div></div>`);
    
    return result.join('');
  }

  return { parse };
})();
