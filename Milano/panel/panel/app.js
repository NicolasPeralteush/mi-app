// Il Milano — Panel de Control (Admin)
// Este archivo reemplaza el JS inline anterior; el inline se mantiene comentado en `index.html`.

const conversations = new Map(); // jid -> { jid, name, msgs:[], assignedAdmin, processedAt }
const pausedSet = new Set(); // jid
const newMsgJids = new Set();

let activeJid = null;
let meUsername = null;
let startedAt = null;
let sidebarOpen = false;
let ws = null;
let qrInstance = null;
let currentFilter = 'all'; // 'all', 'confirmed', 'claims', 'attention'

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setLoginVisible(visible) {
  const el = document.getElementById('login-overlay');
  if (!el) return;
  el.classList.toggle('hidden', !visible);
}

function setProcessedStats(stats) {
  const today = String(stats?.today ?? 0);
  const week = String(stats?.week ?? 0);
  const month = String(stats?.month ?? 0);
  
  // Update original stats bar elements (if they exist)
  const statToday = document.getElementById('stat-processed-today');
  const statWeek = document.getElementById('stat-processed-week');
  const statMonth = document.getElementById('stat-processed-month');
  if (statToday) statToday.textContent = today;
  if (statWeek) statWeek.textContent = week;
  if (statMonth) statMonth.textContent = month;
  
  // Update new sidebar elements
  const sidebarToday = document.getElementById('sidebar-stat-processed-today');
  const sidebarWeek = document.getElementById('sidebar-stat-processed-week');
  const sidebarMonth = document.getElementById('sidebar-stat-processed-month');
  if (sidebarToday) sidebarToday.textContent = today;
  if (sidebarWeek) sidebarWeek.textContent = week;
  if (sidebarMonth) sidebarMonth.textContent = month;
}

function updateStatus(s) {
  const pill = document.getElementById('status-pill');
  const txt = document.getElementById('status-text');
  const labels = { connected: 'Conectado', disconnected: 'Desconectado', connecting: 'Conectando...' };
  pill.className = `status-pill ${s}`;
  txt.textContent = labels[s] || s;
  if (s === 'connected') document.getElementById('qr-modal').classList.remove('show');
}

function setStats(msgs, users) {
  anim('stat-msgs', msgs);
  anim('stat-users', users);
  document.getElementById('user-count').textContent = users;
}

function anim(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.textContent !== String(val)) {
    el.textContent = val;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }
}

function updateUptime() {
  if (!startedAt) return;
  const d = Math.floor((Date.now() - startedAt) / 1000);
  const h = Math.floor(d / 3600), m = Math.floor((d % 3600) / 60), s = d % 60;
  const uptimeText = h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
  const uptimeSub = `desde ${startedAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
  
  // Update original stats bar elements (if they exist)
  const statUptime = document.getElementById('stat-uptime');
  const statUptimeSub = document.getElementById('stat-uptime-sub');
  if (statUptime) statUptime.textContent = uptimeText;
  if (statUptimeSub) statUptimeSub.textContent = uptimeSub;
  
  // Update new sidebar elements
  const sidebarUptime = document.getElementById('sidebar-stat-uptime');
  const sidebarUptimeSub = document.getElementById('sidebar-stat-uptime-sub');
  if (sidebarUptime) sidebarUptime.textContent = uptimeText;
  if (sidebarUptimeSub) sidebarUptimeSub.textContent = uptimeSub;
}

function showQR(qrData) {
  document.getElementById('qr-modal').classList.add('show');
  const canvas = document.getElementById('qr-canvas');
  canvas.innerHTML = '';
  qrInstance = new QRCode(canvas, {
    text: qrData,
    width: 200,
    height: 200,
    colorDark: '#000000',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.M
  });
}

function toggleSidebar() {
  const sb = document.getElementById('im-sidebar');
  sidebarOpen = !sidebarOpen;
  sb.classList.toggle('show', sidebarOpen);
}

function canOperateActiveChat() {
  const conv = conversations.get(activeJid);
  if (!conv) return false;
  return conv.assignedAdmin === meUsername;
}

function updateControlsForActiveChat() {
  const conv = conversations.get(activeJid);
  const btnPause = document.getElementById('btn-pause');
  const input = document.getElementById('msg-input');
  const send = document.getElementById('btn-send');
  const btnClaim = document.getElementById('btn-claim');
  const btnRelease = document.getElementById('btn-release');
  const btnProcessed = document.getElementById('btn-processed');

  if (!conv || !btnPause || !input || !send || !btnClaim || !btnRelease || !btnProcessed) return;

  const isPaused = pausedSet.has(activeJid);
  const assigned = conv.assignedAdmin ?? null;
  const isMeAssigned = assigned && assigned === meUsername;

  // Claim / Release / Process
  btnClaim.disabled = !(assigned === null);
  btnRelease.disabled = !(isMeAssigned);
  btnProcessed.disabled = !(isMeAssigned && !conv.processedAt);
  if (!btnProcessed.disabled && conv.processedAt) {
    btnProcessed.disabled = true;
    btnProcessed.innerHTML = 'Procesado ✓';
  } else if (btnProcessed.disabled && conv.processedAt) {
    btnProcessed.innerHTML = 'Procesado ✓';
  } else {
    btnProcessed.innerHTML = 'Marcar procesado';
  }

  // Pause / Manual send
  btnPause.disabled = !isMeAssigned;
  if (!isMeAssigned) {
    input.disabled = true;
    send.disabled = true;
    input.placeholder = 'Chat asignado a otro admin';
    return;
  }

  if (isPaused) {
    btnPause.className = 'btn-im-pause paused';
    btnPause.innerHTML = '<i class="bi bi-play-fill"></i> Reactivar bot';
    input.disabled = false;
    input.placeholder = 'Escribí tu respuesta manual...';
    send.disabled = false;
  } else {
    btnPause.className = 'btn-im-pause';
    btnPause.innerHTML = '<i class="bi bi-pause-fill"></i> Pausar bot';
    input.disabled = true;
    input.placeholder = 'Pausá el bot para escribir manualmente';
    send.disabled = true;
  }
}

function categorizeConversation(conv) {
  // Check if conversation has confirmed orders
  const hasConfirmedOrder = conv.msgs.some(msg => 
    (msg.user && msg.user.toLowerCase().includes('confirmar')) ||
    (msg.user && msg.user.toLowerCase().includes('pedido confirmado')) ||
    (msg.user && msg.user.toLowerCase().includes('ok')) ||
    (msg.bot && msg.bot.toLowerCase().includes('confirmado'))
  );
  
  // Check if conversation has claims
  const hasClaim = conv.msgs.some(msg => 
    (msg.user && msg.user.toLowerCase().includes('reclamo')) ||
    (msg.user && msg.user.toLowerCase().includes('queja')) ||
    (msg.user && msg.user.toLowerCase().includes('problema')) ||
    (msg.user && msg.user.toLowerCase().includes('error')) ||
    (msg.user && msg.user.toLowerCase().includes('mal'))
  );
  
  // Check if conversation needs attention
  const needsAttention = (
    !conv.assignedAdmin && 
    conv.msgs.length > 0 && 
    !conv.processedAt &&
    !hasConfirmedOrder
  ) || (
    conv.msgs.length > 2 && 
    !conv.processedAt &&
    pausedSet.has(conv.jid)
  );
  
  return {
    hasConfirmedOrder,
    hasClaim,
    needsAttention
  };
}

function updateFilterCounters() {
  const counts = {
    all: 0,
    confirmed: 0,
    claims: 0,
    attention: 0
  };
  
  conversations.forEach(conv => {
    counts.all++;
    const category = categorizeConversation(conv);
    if (category.hasConfirmedOrder) counts.confirmed++;
    if (category.hasClaim) counts.claims++;
    if (category.needsAttention) counts.attention++;
  });
  
  // Update counter displays
  const allEl = document.getElementById('filter-count-all');
  const confirmedEl = document.getElementById('filter-count-confirmed');
  const claimsEl = document.getElementById('filter-count-claims');
  const attentionEl = document.getElementById('filter-count-attention');
  
  if (allEl) allEl.textContent = counts.all;
  if (confirmedEl) confirmedEl.textContent = counts.confirmed;
  if (claimsEl) claimsEl.textContent = counts.claims;
  if (attentionEl) attentionEl.textContent = counts.attention;
}

function filterConversations(filter) {
  currentFilter = filter;
  
  // Update active button in stats bar
  document.querySelectorAll('.filter-stat-btn').forEach(btn => {
    btn.classList.toggle('active', btn.closest('.filter-stat-item').dataset.filter === filter);
  });
  
  renderUserList();
}

function renderUserList() {
  const list = document.getElementById('user-list');
  if (!list) return;

  // Update filter counters
  updateFilterCounters();

  if (conversations.size === 0) {
    list.innerHTML = `<div class="empty-sidebar">
      <i class="bi bi-chat-dots" style="font-size:2rem;opacity:.3;display:block;margin-bottom:.5rem"></i>
      Sin conversaciones aún</div>`;
    return;
  }

  list.innerHTML = '';

  const ordered = [...conversations.entries()].reverse();
  const filteredConversations = ordered.filter(([jid, conv]) => {
    if (currentFilter === 'all') return true;
    
    const category = categorizeConversation(conv);
    
    switch (currentFilter) {
      case 'confirmed':
        return category.hasConfirmedOrder;
      case 'claims':
        return category.hasClaim;
      case 'attention':
        return category.needsAttention;
      default:
        return true;
    }
  });
  
  if (filteredConversations.length === 0) {
    const filterNames = {
      'confirmed': 'pedidos confirmados',
      'claims': 'reclamos',
      'attention': 'pedidos que necesitan atención'
    };
    
    list.innerHTML = `<div class="empty-sidebar">
      <i class="bi bi-funnel" style="font-size:2rem;opacity:.3;display:block;margin-bottom:.5rem"></i>
      Sin ${filterNames[currentFilter] || 'conversaciones'} aún</div>`;
    return;
  }
  
  for (const [jid, conv] of filteredConversations) {
    const last = conv.msgs[conv.msgs.length - 1];
    const isPaused = pausedSet.has(jid);
    const hasNew = newMsgJids.has(jid) && activeJid !== jid;
    const preview = (last.user || last.bot || '').slice(0, 38);
    const timeStr = last.ts ? (last.ts.split(' ')[1] || '') : '';

    const assignedBadge = conv.assignedAdmin ? `<span class="badge-assigned-sm">Asignado: ${esc(conv.assignedAdmin)}</span>` : '';
    const processedBadge = conv.processedAt ? `<span class="badge-processed-sm">Procesado</span>` : '';

    const div = document.createElement('div');
    div.className = `user-item${activeJid === jid ? ' active' : ''}${isPaused ? ' paused-item' : ''}`;
    div.innerHTML = `
      <div class="user-name">
        ${esc(conv.name || 'Cliente')}
        ${isPaused ? '<span class="badge-paused-sm">pausado</span>' : ''}
        ${assignedBadge}
        ${processedBadge}
      </div>
      ${hasNew
        ? '<span class="new-dot"></span>'
        : `<span class="user-time">${esc(timeStr)}</span>`}
      <div class="user-preview">${esc(preview)}</div>
    `;
    div.onclick = () => {
      selectConversation(jid);
      if (window.innerWidth <= 768) toggleSidebar();
    };
    list.appendChild(div);
  }
}

function renderChat(jid) {
  const conv = conversations.get(jid);
  const container = document.getElementById('messages');
  if (!conv || !container) return;

  container.innerHTML = '';

  const msgs = conv.msgs || [];
  if (msgs.length === 0) {
    container.innerHTML = `<div class="empty-chat">
      <div class="big-icon">💬</div>
      <p>Sin mensajes en esta conversación</p>
    </div>`;
    return;
  }

  msgs.forEach(m => {
    const block = document.createElement('div');
    block.className = 'msg-block';

    if (m.manual) {
      block.innerHTML = `
        <div class="msg-meta" style="justify-content:flex-end">
          <span class="mbadge mbadge-manual"><i class="bi bi-person-fill"></i> Vos (manual)</span>
          <span>${esc(m.ts)}</span>
        </div>
        <div class="bubble bubble-manual">${esc(m.bot)}</div>
      `;
    } else if (m.paused && !m.bot) {
      block.innerHTML = `
        <div class="msg-meta">
          <span class="mbadge mbadge-user"><i class="bi bi-person-fill"></i> Cliente</span>
          <span>${esc(conv.name || '')}</span>
          <span class="ms-auto">${esc(m.ts)}</span>
        </div>
        <div class="bubble bubble-user">${esc(m.user)}</div>
        <div class="paused-notice"><i class="bi bi-pause-circle"></i> Bot pausado — sin respuesta automática</div>
      `;
    } else {
      block.innerHTML = `
        <div class="msg-meta">
          <span class="mbadge mbadge-user"><i class="bi bi-person-fill"></i> Cliente</span>
          <span>${esc(conv.name || '')}</span>
          <span class="ms-auto">${esc(m.ts)}</span>
        </div>
        <div class="bubble bubble-user">${esc(m.user)}</div>
        ${m.bot ? `
          <div class="msg-meta mt-1" style="justify-content:flex-end">
            <span class="mbadge mbadge-bot"><i class="bi bi-robot"></i> Bot</span>
          </div>
          <div class="bubble bubble-bot">${esc(m.bot)}</div>
        ` : ''}
      `;
    }
    container.appendChild(block);
  });

  container.scrollTop = container.scrollHeight;
}

function selectConversation(jid) {
  activeJid = jid;
  newMsgJids.delete(jid);
  renderUserList();

  const conv = conversations.get(jid);
  if (!conv) return;

  const isPaused = pausedSet.has(jid);

  document.getElementById('chat-header').style.display = 'flex';
  document.getElementById('input-area').style.display = 'flex';
  document.getElementById('chat-avatar').textContent = conv.name?.[0]?.toUpperCase() || '?';
  document.getElementById('chat-name').textContent = conv.name || 'Cliente';

  const assignedText = conv.assignedAdmin ? `Asignado a ${conv.assignedAdmin}` : 'Sin asignar';
  const processedText = conv.processedAt ? 'Procesado' : 'Sin procesar';
  document.getElementById('chat-sub').textContent =
    `${(conv.msgs || []).length || 0} mensajes · ${jid} · ${assignedText} · ${processedText}`;

  updateControlsForActiveChat();
  renderChat(jid);
}

function addOrUpdateConversationMeta(jid, meta) {
  if (!conversations.has(jid)) {
    conversations.set(jid, { jid, name: meta?.name || 'Cliente', msgs: [], assignedAdmin: meta?.assignedAdmin ?? null, processedAt: meta?.processedAt ?? null });
  } else {
    const conv = conversations.get(jid);
    if (meta?.name) conv.name = meta.name;
    if (meta?.assignedAdmin !== undefined) conv.assignedAdmin = meta.assignedAdmin;
    if (meta?.processedAt !== undefined) conv.processedAt = meta.processedAt;
  }
}

function addMsg(jid, msg, meta) {
  addOrUpdateConversationMeta(jid, meta);
  const conv = conversations.get(jid);
  conv.msgs.push(msg);

  // Move to end (so it's rendered on top)
  conversations.delete(jid);
  conversations.set(jid, conv);
}

function handleInit(p) {
  updateStatus(p.status);
  setStats(p.totalMessages, p.totalUsers);
  setProcessedStats(p.processedStats || {});

  if (p.startedAt) { startedAt = new Date(p.startedAt); updateUptime(); }
  if (p.qrCode) showQR(p.qrCode);

  pausedSet.clear();
  if (Array.isArray(p.pausedUsers)) p.pausedUsers.forEach(j => pausedSet.add(j));

  conversations.clear();
  newMsgJids.clear();

  (p.history || []).forEach(h => {
    if (!h || !h.jid) return;
    const meta = { name: h.name, assignedAdmin: h.assignedAdmin ?? null, processedAt: h.processedAt ?? null };
    if (h.manual) {
      addMsg(h.jid, { ts: h.ts, user: '', bot: h.bot, manual: true }, meta);
    } else {
      addMsg(h.jid, { ts: h.ts, user: h.user, bot: h.bot, manual: false, paused: false }, meta);
    }
  });

  activeJid = null;
  document.getElementById('chat-header').style.display = 'none';
  document.getElementById('input-area').style.display = 'none';
  renderUserList();
}

function handleMessage(p) {
  setStats(p.totalMessages, p.totalUsers);
  const jid = p.jid;
  addOrUpdateConversationMeta(jid, { name: p.name, assignedAdmin: p.assignedAdmin ?? null, processedAt: p.processedAt ?? null });
  addMsg(jid, { ts: p.ts, user: p.user, bot: p.bot, manual: false, paused: false }, { name: p.name, assignedAdmin: p.assignedAdmin ?? null, processedAt: p.processedAt ?? null });

  if (activeJid !== jid) newMsgJids.add(jid);
  renderUserList();
  if (activeJid === jid) {
    selectConversation(jid); // updates header + controls
  }
}

function handleIncoming(p) {
  setStats(p.totalMessages, p.totalUsers);
  const jid = p.jid;
  addOrUpdateConversationMeta(jid, { name: p.name, assignedAdmin: p.assignedAdmin ?? null, processedAt: p.processedAt ?? null });
  addMsg(jid, { ts: p.ts, user: p.user, bot: '', manual: false, paused: true }, { name: p.name, assignedAdmin: p.assignedAdmin ?? null, processedAt: p.processedAt ?? null });

  if (activeJid !== jid) newMsgJids.add(jid);
  renderUserList();
  if (activeJid === jid) selectConversation(jid);
}

function handleManual(p) {
  const jid = p.jid;
  addOrUpdateConversationMeta(jid, { name: 'Admin', assignedAdmin: p.assignedAdmin ?? null, processedAt: p.processedAt ?? null });
  addMsg(jid, { ts: p.ts, user: '', bot: p.text, manual: true }, { name: 'Admin', assignedAdmin: p.assignedAdmin ?? null, processedAt: p.processedAt ?? null });

  renderUserList();
  if (activeJid === jid) selectConversation(jid);
}

function handlePausedEv(p) {
  if (!p || !p.jid) return;
  if (p.paused) pausedSet.add(p.jid);
  else pausedSet.delete(p.jid);
  renderUserList();
  if (activeJid === p.jid) {
    updateControlsForActiveChat();
  }
}

function handleAdminAssignment(p) {
  if (!p || !p.jid) return;
  const conv = conversations.get(p.jid);
  if (!conv) return;
  conv.assignedAdmin = p.assignedAdmin ?? null;
  conversations.delete(p.jid);
  conversations.set(p.jid, conv);
  renderUserList();
  if (activeJid === p.jid) selectConversation(p.jid);
}

function handleAdminProcessed(p) {
  if (!p || !p.jid) return;
  const conv = conversations.get(p.jid);
  if (!conv) return;
  conv.processedAt = p.processedAt ?? null;
  conversations.delete(p.jid);
  conversations.set(p.jid, conv);
  renderUserList();
  if (activeJid === p.jid) selectConversation(p.jid);
}

function handleAdminStats(p) {
  setProcessedStats(p || {});
}

function connectWs() {
  if (ws) try { ws.close(); } catch {}

  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);

  ws.onmessage = ({ data }) => {
    const { event, payload } = JSON.parse(data);
    if (event === 'init') handleInit(payload);
    if (event === 'status') updateStatus(payload.status);
    if (event === 'qr') showQR(payload.qr);
    if (event === 'message') handleMessage(payload);
    if (event === 'incoming') handleIncoming(payload);
    if (event === 'manual_message') handleManual(payload);
    if (event === 'paused') handlePausedEv(payload);
    if (event === 'admin_assignment') handleAdminAssignment(payload);
    if (event === 'admin_processed') handleAdminProcessed(payload);
    if (event === 'admin_stats') handleAdminStats(payload);
  };

  ws.onclose = (ev) => {
    updateStatus('disconnected');
    if (ev && ev.code === 4401) setLoginVisible(true);
  };
}

async function loginAdmin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const err = document.getElementById('login-error');
  if (err) err.textContent = '';

  try {
    const res = await fetch('/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    });

    if (!res.ok) {
      if (err) err.textContent = 'Usuario o contraseña incorrectos.';
      setLoginVisible(true);
      return;
    }

    setLoginVisible(false);
    const me = await res.json().catch(() => ({}));
    meUsername = me.username || meUsername;
    connectWs();
  } catch {
    if (err) err.textContent = 'Error de conexión.';
  }
}

async function bootstrapAdmin() {
  setLoginVisible(true);
  try {
    const res = await fetch('/admin/me', { method: 'GET', credentials: 'include' });
    if (!res.ok) {
      setLoginVisible(true);
      return;
    }
    const data = await res.json();
    meUsername = data.username;
    setLoginVisible(false);
    connectWs();
  } catch {
    setLoginVisible(true);
  }
}

async function togglePause() {
  if (!activeJid) return;
  if (!canOperateActiveChat()) return;
  const jid = activeJid;
  const endpoint = pausedSet.has(jid) ? '/resume' : '/pause';
  await fetch(endpoint, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jid })
  });
}

async function sendManual() {
  if (!activeJid) return;
  if (!canOperateActiveChat()) return;

  const jid = activeJid;
  const input = document.getElementById('msg-input');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';

  await fetch('/send', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jid, text })
  });
}

async function claimChat() {
  if (!activeJid) return;
  const jid = activeJid;
  await fetch('/admin/claim', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jid })
  });
}

async function releaseChat() {
  if (!activeJid) return;
  const jid = activeJid;
  await fetch('/admin/release', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jid })
  });
}

async function markProcessed() {
  if (!activeJid) return;
  const jid = activeJid;
  await fetch('/admin/processed', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jid, processed: true })
  });
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendManual();
  }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

// Close sidebar on outside click (mobile)
document.addEventListener('click', e => {
  if (window.innerWidth > 768) return;
  const sb = document.getElementById('im-sidebar');
  const btn = document.getElementById('btn-sidebar-toggle');
  if (sidebarOpen && sb && btn && !sb.contains(e.target) && !btn.contains(e.target)) {
    sidebarOpen = false;
    sb.classList.remove('show');
  }
});

setInterval(updateUptime, 5000);

// Public methods used by inline handlers
window.toggleSidebar = toggleSidebar;
window.togglePause = togglePause;
window.sendManual = sendManual;
window.handleKey = handleKey;
window.autoResize = autoResize;
window.loginAdmin = loginAdmin;
window.claimChat = claimChat;
window.releaseChat = releaseChat;
window.markProcessed = markProcessed;
window.filterConversations = filterConversations;

// Kickoff
bootstrapAdmin();

