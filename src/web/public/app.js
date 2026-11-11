let currentSessionId = null;
let isStreaming = false;

// DOM Elements
const chatMessagesEl = document.getElementById('chat-messages');
const chatFormEl = document.getElementById('chat-form');
const chatInputEl = document.getElementById('chat-input');
const sendBtnEl = document.getElementById('send-btn');
const newChatBtnEl = document.getElementById('new-chat-btn');
const sessionsListEl = document.getElementById('sessions-list');
const activeChatTitleEl = document.getElementById('active-chat-title');
const systemTimeDisplayEl = document.getElementById('system-time-display');
const relativeAnchorPreviewEl = document.getElementById('relative-anchor-preview');
const agentActivityBarEl = document.getElementById('agent-activity-bar');
const activityStepTextEl = document.getElementById('activity-step-text');
const llmProviderLabelEl = document.getElementById('llm-provider-label');
const searchProviderLabelEl = document.getElementById('search-provider-label');

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
  await fetchStatus();
  await loadSessions();
  setupEventListeners();
});

function setupEventListeners() {
  chatFormEl.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSubmit();
  });

  chatInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  });

  // Auto-grow textarea
  chatInputEl.addEventListener('input', () => {
    chatInputEl.style.height = 'auto';
    chatInputEl.style.height = Math.min(chatInputEl.scrollHeight, 160) + 'px';
  });

  newChatBtnEl.addEventListener('click', () => {
    startNewChat();
  });

  // Time-travel date simulator
  const datePicker = document.getElementById('reference-date-picker');
  const resetDateBtn = document.getElementById('reset-date-btn');

  if (datePicker) {
    datePicker.addEventListener('change', async () => {
      const selected = datePicker.value;
      if (!selected) return;
      try {
        const res = await fetch('/api/temporal/override', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dateISO: selected }),
        });
        const data = await res.json();
        if (data.temporal) {
          systemTimeDisplayEl.textContent = data.temporal.todayHuman;
          relativeAnchorPreviewEl.textContent = `Simulated: ${data.temporal.todayISO} (Grounding Shifted)`;
        }
      } catch (err) {
        console.warn('Failed to set simulated date:', err);
      }
    });
  }

  if (resetDateBtn) {
    resetDateBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/temporal/override', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dateISO: null }),
        });
        const data = await res.json();
        if (data.temporal) {
          if (datePicker) datePicker.value = '';
          systemTimeDisplayEl.textContent = data.temporal.todayHuman;
          relativeAnchorPreviewEl.textContent = `Live Clock: ${data.temporal.todayISO} (${data.temporal.now.slice(11, 16)} UTC)`;
        }
      } catch (err) {
        console.warn('Failed to reset date:', err);
      }
    });
  }

  // Benchmark evaluation suite runner
  const runEvalBtn = document.getElementById('run-eval-btn');
  const benchmarkBtnText = document.getElementById('benchmark-btn-text');
  const benchmarkBtnIcon = document.getElementById('benchmark-btn-icon');
  const benchmarkPassBadge = document.getElementById('benchmark-pass-badge');

  if (runEvalBtn) {
    runEvalBtn.addEventListener('click', async () => {
      if (runEvalBtn.disabled) return;
      runEvalBtn.disabled = true;
      benchmarkBtnIcon.textContent = '⏳';
      benchmarkBtnText.textContent = 'Running Suite...';
      showActivityBar('⚡ Running architecture benchmark suite (3 test cases)...');

      try {
        const res = await fetch('/api/eval/run', { method: 'POST' });
        const result = await res.json();

        benchmarkPassBadge.textContent = `${result.passRate}% (${result.passedCases}/${result.totalCases} Passed)`;
        benchmarkPassBadge.style.color = result.passRate === 100 ? '#34d399' : '#f87171';

        // Add a benchmark report card directly into the chat area
        const emptyState = document.getElementById('empty-state');
        if (emptyState) emptyState.remove();

        const benchEl = document.createElement('div');
        benchEl.className = 'message assistant';
        benchEl.innerHTML = `
          <div class="message-bubble">
            <div class="message-content">
              <h3>⚡ Architecture Evaluation Benchmark Results</h3>
              <p><strong>Pass Rate:</strong> ${result.passRate}% (${result.passedCases}/${result.totalCases} Passed) | <strong>Avg Latency:</strong> ${result.averageLatencyMs}ms | <strong>Avg TTFT:</strong> ${result.averageTTFTMs}ms | <strong>Avg Grounding:</strong> ${result.averageGroundingScore}%</p>
              <br>
              <table style="width:100%; border-collapse:collapse; font-size:12px; margin-top:8px;">
                <thead>
                  <tr style="border-bottom:1px solid #334155; text-align:left; color:#94a3b8;">
                    <th style="padding:6px;">Test Benchmark</th>
                    <th style="padding:6px;">Result</th>
                    <th style="padding:6px;">Latency</th>
                    <th style="padding:6px;">TTFT</th>
                    <th style="padding:6px;">Grounding</th>
                  </tr>
                </thead>
                <tbody>
                  ${result.cases.map(c => `
                    <tr style="border-bottom:1px solid #1e293b;">
                      <td style="padding:6px; font-weight:600;">${escapeHtml(c.name)}</td>
                      <td style="padding:6px; color:${c.passed ? '#34d399' : '#f87171'}; font-weight:bold;">${c.passed ? '✔ PASS' : '✖ FAIL'}</td>
                      <td style="padding:6px;">${c.totalLatencyMs}ms</td>
                      <td style="padding:6px;">${c.timeToFirstTokenMs}ms</td>
                      <td style="padding:6px;">${c.groundingScore}%</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
        chatMessagesEl.appendChild(benchEl);
        scrollToBottom();
      } catch (err) {
        console.error('Benchmark error:', err);
      } finally {
        runEvalBtn.disabled = false;
        benchmarkBtnIcon.textContent = '▶';
        benchmarkBtnText.textContent = 'Run Benchmark Suite';
        hideActivityBar();
      }
    });
  }

  // Prompt chips
  document.querySelectorAll('.prompt-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt');
      if (prompt) {
        chatInputEl.value = prompt;
        chatInputEl.focus();
        chatInputEl.style.height = 'auto';
        chatInputEl.style.height = Math.min(chatInputEl.scrollHeight, 160) + 'px';
      }
    });
  });
}

async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();

    if (data.temporal) {
      systemTimeDisplayEl.textContent = data.temporal.todayHuman;
      relativeAnchorPreviewEl.textContent = `Live Clock: ${data.temporal.todayISO} (${data.temporal.now.slice(11, 16)} UTC)`;
    }

    if (data.llm) {
      llmProviderLabelEl.textContent = `${data.llm.provider.toUpperCase()} (${data.llm.model})`;
    }
    if (data.search) {
      searchProviderLabelEl.textContent = `Search: ${data.search.provider.toUpperCase()}`;
    }
  } catch (err) {
    console.warn('Failed to fetch status:', err);
  }
}

async function loadSessions() {
  try {
    const res = await fetch('/api/sessions');
    const sessions = await res.json();
    renderSessionsList(sessions);

    if (sessions.length > 0 && !currentSessionId) {
      selectSession(sessions[0].id);
    }
  } catch (err) {
    console.error('Failed to load sessions:', err);
  }
}

function renderSessionsList(sessions) {
  sessionsListEl.innerHTML = '';
  for (const s of sessions) {
    const item = document.createElement('div');
    item.className = `session-item ${s.id === currentSessionId ? 'active' : ''}`;
    item.onclick = () => selectSession(s.id);

    const title = document.createElement('div');
    title.className = 'session-title';
    title.textContent = s.title;

    const meta = document.createElement('div');
    meta.className = 'session-meta';
    meta.textContent = `${new Date(s.createdAt).toLocaleDateString()} • ${s.messages.length} msgs`;

    item.appendChild(title);
    item.appendChild(meta);
    sessionsListEl.appendChild(item);
  }
}

async function selectSession(sessionId) {
  currentSessionId = sessionId;
  document.querySelectorAll('.session-item').forEach((el) => {
    el.classList.toggle('active', el.textContent.includes(sessionId));
  });

  try {
    const res = await fetch(`/api/sessions/${sessionId}`);
    const session = await res.json();
    activeChatTitleEl.textContent = session.title;
    renderMessages(session.messages);
    loadSessions();
  } catch (err) {
    console.error('Failed to load session details:', err);
  }
}

function startNewChat() {
  currentSessionId = null;
  activeChatTitleEl.textContent = 'New Conversation';
  chatMessagesEl.innerHTML = `
    <div id="empty-state" class="empty-state">
      <div class="empty-icon">🌐</div>
      <h2>Fresh Chat Session</h2>
      <p>Ask anything or test episodic recall against past sessions.</p>
      <p class="empty-subtext">Click any evaluation prompt on the left or type your own question.</p>
    </div>
  `;
  document.querySelectorAll('.session-item').forEach((el) => el.classList.remove('active'));
  chatInputEl.focus();
}

function renderMessages(messages) {
  chatMessagesEl.innerHTML = '';
  if (!messages || messages.length === 0) {
    startNewChat();
    return;
  }

  for (const msg of messages) {
    appendMessageElement(msg);
  }
  scrollToBottom();
}

function appendMessageElement(msg) {
  const container = document.createElement('div');
  container.className = `message ${msg.role}`;
  container.id = `msg-el-${msg.id || Date.now()}`;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  // Render activity accordion if metadata exists on assistant message
  if (msg.role === 'assistant' && msg.metadata) {
    const activityHtml = buildActivityCard(msg.metadata);
    if (activityHtml) {
      bubble.innerHTML += activityHtml;
    }
  }

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.innerHTML = renderMarkdown(msg.content);
  bubble.appendChild(contentDiv);

  // Render citations grid if present
  if (msg.metadata && msg.metadata.citations && msg.metadata.citations.length > 0) {
    bubble.innerHTML += buildCitationsGrid(msg.metadata.citations);
  }

  const meta = document.createElement('div');
  meta.className = 'message-meta';
  const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : '';
  const latencyStr = msg.metadata?.latencyMs ? ` • ${Math.round(msg.metadata.latencyMs)}ms total` : '';
  meta.textContent = `${msg.role.toUpperCase()} • ${timeStr}${latencyStr}`;

  container.appendChild(bubble);
  container.appendChild(meta);
  chatMessagesEl.appendChild(container);
}

function buildActivityCard(metadata) {
  const items = [];

  if (metadata.temporalAnchor) {
    items.push(`
      <div class="activity-item">
        <span class="activity-icon">🕒</span>
        <div>Temporal Anchoring: <strong>"${escapeHtml(metadata.temporalAnchor.expression)}"</strong> &rarr; <span class="activity-badge">${metadata.temporalAnchor.anchorDate} (${metadata.temporalAnchor.dayOfWeek})</span></div>
      </div>
    `);
  }

  if (metadata.searchQueries && metadata.searchQueries.length > 0) {
    items.push(`
      <div class="activity-item">
        <span class="activity-icon">🔍</span>
        <div>Parallel Web Search (${metadata.searchQueries.length} queries): ${metadata.searchQueries.map((q) => `<span class="activity-badge">${escapeHtml(q)}</span>`).join(' ')}</div>
      </div>
    `);
  }

  if (metadata.deltaSummary) {
    const statusColor = metadata.deltaSummary.hasChanges ? 'var(--accent-amber)' : 'var(--accent-green)';
    items.push(`
      <div class="activity-item">
        <span class="activity-icon">⚖️</span>
        <div style="color:${statusColor}; font-weight:500;">${escapeHtml(metadata.deltaSummary.verdict)}</div>
      </div>
    `);
  }

  if (metadata.groundingScore !== undefined) {
    items.push(`
      <div class="activity-item">
        <span class="activity-icon">🎯</span>
        <div>Citation Grounding Score: <span class="activity-badge" style="color:var(--accent-green); font-weight:600;">${metadata.groundingScore}% Verified</span> (Direct Source Attribution)</div>
      </div>
    `);
  }

  if (metadata.dagTrace && metadata.dagTrace.length > 0) {
    items.push(`
      <div class="activity-item">
        <span class="activity-icon">📊</span>
        <div style="width:100%;">
          <div style="font-weight:600; margin-bottom:6px; font-size:11px; color:var(--text-muted);">State Machine Execution DAG:</div>
          <div class="dag-pipeline-grid">
            ${metadata.dagTrace.map((step) => `
              <div class="dag-step-chip ${step.status}">
                <span class="step-name">${escapeHtml(step.step)}</span>
                <span class="step-time">${step.durationMs}ms</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `);
  }

  if (metadata.latencyBreakdown) {
    const b = metadata.latencyBreakdown;
    items.push(`
      <div class="activity-item">
        <span class="activity-icon">⚡</span>
        <div style="font-family:var(--font-mono); font-size:11px; color:var(--text-dim);">
          Latency: Temporal: ${b.temporalMs}ms | Memory: ${b.memoryMs}ms | Search: ${b.searchMs}ms | Scrape: ${b.scrapeMs}ms | Synthesis: ${b.llmFirstTokenMs}ms | Total: <strong>${b.totalMs}ms</strong>
        </div>
      </div>
    `);
  }

  if (items.length === 0) return '';

  return `
    <div class="activity-card">
      <div class="activity-card-header" onclick="this.parentElement.classList.toggle('collapsed')">
        <span>⚡ Agent Execution & Latency Trace</span>
        <span class="accordion-toggle">&dtrif;</span>
      </div>
      <div class="activity-card-body">
        ${items.join('')}
      </div>
    </div>
  `;
}

function buildCitationsGrid(citations) {
  return `
    <div class="citations-footer">
      <div class="citations-title">Verified Sources (${citations.length})</div>
      <div class="citations-grid">
        ${citations
          .map(
            (c) => `
          <a href="${c.url}" target="_blank" rel="noopener noreferrer" class="citation-card" title="${escapeHtml(c.title)}">
            <span class="citation-index">${c.index}</span>
            <div class="citation-info">
              <div class="citation-name">${escapeHtml(c.title || c.domain)}</div>
              <div class="citation-domain">${escapeHtml(c.domain)}${c.groundingConfidence ? ` • ${(c.groundingConfidence * 100).toFixed(0)}% Grounded` : ''}</div>
            </div>
          </a>
        `
          )
          .join('')}
      </div>
    </div>
  `;
}

async function handleSubmit() {
  if (isStreaming) return;
  const query = chatInputEl.value.trim();
  if (!query) return;

  chatInputEl.value = '';
  chatInputEl.style.height = 'auto';

  const emptyState = document.getElementById('empty-state');
  if (emptyState) emptyState.remove();

  // 1. Append User Message
  appendMessageElement({
    role: 'user',
    content: query,
    timestamp: new Date().toISOString(),
  });
  scrollToBottom();

  // 2. Prepare Assistant Bubble
  isStreaming = true;
  sendBtnEl.disabled = true;
  showActivityBar('Processing query...');

  const assistantMsgId = `stream-${Date.now()}`;
  const assistantContainer = document.createElement('div');
  assistantContainer.className = 'message assistant';
  assistantContainer.id = assistantMsgId;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  const liveActivityDiv = document.createElement('div');
  liveActivityDiv.className = 'live-activity';
  bubble.appendChild(liveActivityDiv);

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.innerHTML = '<span class="typing-cursor">▋</span>';
  bubble.appendChild(contentDiv);

  assistantContainer.appendChild(bubble);
  chatMessagesEl.appendChild(assistantContainer);
  scrollToBottom();

  let streamedText = '';
  let finalMetadata = {};

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        sessionId: currentSessionId,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const jsonStr = trimmed.slice(6);

        try {
          const event = JSON.parse(jsonStr);
          handleAgentEvent(event, {
            liveActivityDiv,
            contentDiv,
            bubble,
            onTextChunk: (text) => {
              streamedText += text;
              contentDiv.innerHTML = renderMarkdown(streamedText) + '<span class="typing-cursor">▋</span>';
              scrollToBottom();
            },
            onComplete: (data) => {
              finalMetadata = data;
              if (data.sessionId && !currentSessionId) {
                currentSessionId = data.sessionId;
                loadSessions();
              }
            },
          });
        } catch {
          // ignore stream parse error
        }
      }
    }

    contentDiv.innerHTML = renderMarkdown(streamedText);
    hideActivityBar();

    if (finalMetadata.citations && finalMetadata.citations.length > 0) {
      bubble.innerHTML += buildCitationsGrid(finalMetadata.citations);
    }
  } catch (err) {
    console.error('Chat error:', err);
    contentDiv.innerHTML = `<p style="color:#ef4444;">Error processing request: ${err.message}</p>`;
    hideActivityBar();
  } finally {
    isStreaming = false;
    sendBtnEl.disabled = false;
    chatInputEl.focus();
    loadSessions();
  }
}

function handleAgentEvent(event, ctx) {
  switch (event.type) {
    case 'temporal_resolved':
      if (event.data.anchor) {
        showActivityBar(`🕒 Temporal Grounding: "${event.data.anchor.expression}" &rarr; ${event.data.anchor.anchorDate}`);
      }
      break;

    case 'memory_recalled':
      showActivityBar(`🧠 Recalled session: "${event.data.sessionTitle}" (${event.data.messageCount} messages)`);
      break;

    case 'search_planned':
      showActivityBar(`🔍 Planning ${event.data.queries.length} parallel searches...`);
      break;

    case 'search_executing':
      showActivityBar(`🌐 Searching: "${event.data.query.slice(0, 40)}..."`);
      break;

    case 'search_completed':
      showActivityBar(`✨ Found ${event.data.resultCount} sources (${event.data.totalLatencyMs}ms)`);
      break;

    case 'page_scraped':
      showActivityBar(`📄 Scraped ${event.data.scrapedCount} pages (${event.data.latencyMs}ms)`);
      break;

    case 'delta_computed':
      showActivityBar(`⚖️ Delta Check: ${event.data.hasChanges ? 'Changes detected' : 'Unchanged'}`);
      break;

    case 'token':
      if (event.data.chunk) {
        ctx.onTextChunk(event.data.chunk);
      }
      break;

    case 'done':
      ctx.onComplete(event.data);
      break;
  }
}

function showActivityBar(text) {
  agentActivityBarEl.classList.remove('hidden');
  activityStepTextEl.textContent = text;
}

function hideActivityBar() {
  agentActivityBarEl.classList.add('hidden');
}

function scrollToBottom() {
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function renderMarkdown(text) {
  if (window.marked && typeof window.marked.parse === 'function') {
    return window.marked.parse(text);
  }
  return text
    .replace(/\n\n/g, '<br><br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
