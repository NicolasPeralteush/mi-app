const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const dotenv = require('dotenv');
const fs = require('fs');
const qrcode = require('qrcode-terminal');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');
const crypto = require('crypto');

dotenv.config();

const SYSTEM_PROMPT = fs.readFileSync('prompt.txt', 'utf8');
const chatHistory = new Map();

// ---------------------------
// Admin auth (cookie + session)
// ---------------------------
const SESSION_COOKIE_NAME = process.env.ADMIN_SESSION_COOKIE_NAME || 'admin_session';
const SESSION_TTL_MS = Number(process.env.ADMIN_SESSION_TTL_MS || (7 * 24 * 3600 * 1000));
const ADMIN_TIME_ZONE = process.env.ADMIN_TIME_ZONE || 'America/Argentina/Cordoba';
const adminSessions = new Map(); // sid -> { username, createdAt }

function sha256Hex(s) {
    return crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');
}

function safeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const aBuf = Buffer.from(a, 'utf8');
    const bBuf = Buffer.from(b, 'utf8');
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
}

function parseCookies(cookieHeader) {
    const out = {};
    (cookieHeader || '').split(';').forEach(part => {
        const [k, ...rest] = part.trim().split('=');
        if (!k) return;
        out[k] = rest.join('=');
    });
    return out;
}

function loadAdminUsers() {
    // Leer desde archivo externo si está configurado
    const usersFile = process.env.ADMIN_USERS_FILE;
    if (usersFile) {
        try {
            const raw = fs.readFileSync(usersFile, 'utf8');
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
                const map = new Map();
                arr.forEach(u => {
                    if (u && typeof u.username === 'string' && typeof u.passwordHash === 'string') {
                        map.set(u.username, { hash: u.passwordHash, role: u.role || 'admin' });
                    }
                });
                if (map.size > 0) return map;
            }
        } catch (e) {
            console.error('Error leyendo ADMIN_USERS_FILE:', e.message);
        }
    }
    // Fallback: leer desde ADMIN_USERS_JSON en .env
    const usersJson = process.env.ADMIN_USERS_JSON;
    if (usersJson) {
        try {
            const arr = JSON.parse(usersJson);
            if (Array.isArray(arr)) {
                const map = new Map();
                arr.forEach(u => {
                    if (u && typeof u.username === 'string' && typeof u.passwordHash === 'string') {
                        map.set(u.username, { hash: u.passwordHash, role: u.role || 'admin' });
                    }
                });
                if (map.size > 0) return map;
            }
        } catch {}
    }
    const username = process.env.ADMIN_USERNAME;
    const passwordHash = process.env.ADMIN_PASSWORD_HASH;
    if (username && passwordHash) return new Map([[username, { hash: passwordHash, role: 'admin' }]]);
    return new Map();
}

function getAdminUsers() {
    // Lazy load once; env won't change during runtime for this use-case.
    if (!global.__ADMIN_USERS_MAP__) global.__ADMIN_USERS_MAP__ = loadAdminUsers();
    return global.__ADMIN_USERS_MAP__;
}

function validateAdminLogin(username, password) {
    const users = getAdminUsers();
    const entry = users.get(username);
    if (!entry) return false;
    return safeEqual(sha256Hex(password), entry.hash);
}

function getAdminRole(username) {
    const users = getAdminUsers();
    const entry = users.get(username);
    return entry ? (entry.role || 'admin') : null;
}

function getAdminFromReq(req) {
    const cookies = parseCookies(req.headers.cookie);
    const sid = cookies[SESSION_COOKIE_NAME];
    if (!sid) return null;
    const session = adminSessions.get(sid);
    if (!session) return null;
    if (Date.now() - session.createdAt > SESSION_TTL_MS) {
        adminSessions.delete(sid);
        return null;
    }
    return session.username;
}

function requireAdmin(req, res) {
    const username = getAdminFromReq(req);
    if (!username) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'unauthorized' }));
        return null;
    }
    return username;
}

function readJsonBody(req, maxBytes = 2_000_000) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > maxBytes) reject(new Error('body_too_large'));
        });
        req.on('end', () => {
            try {
                const parsed = JSON.parse(body || '{}');
                resolve(parsed);
            } catch {
                reject(new Error('invalid_json'));
            }
        });
    });
}

// Usuarios con bot pausado
const pausedUsers = new Set();

// Referencia global al socket de WhatsApp
let waSocket = null;

// ---------------------------
// Admin chat state persistence
// ---------------------------
const CHAT_STATE_FILE = 'admin_chat_state.json';
let chatState = loadChatStateFromDisk();

function loadChatStateFromDisk() {
    try {
        if (!fs.existsSync(CHAT_STATE_FILE)) return {};
        const raw = fs.readFileSync(CHAT_STATE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function saveChatStateToDisk() {
    try {
        fs.writeFileSync(CHAT_STATE_FILE, JSON.stringify(chatState, null, 2), 'utf8');
    } catch (e) {
        console.error('Error saving chat state:', e.message);
    }
}

function getChatEntry(jid) {
    if (!chatState[jid]) {
        chatState[jid] = { assignedAdmin: null, processedAt: null, lastClientName: null };
    }
    return chatState[jid];
}

function computeProcessedStats() {
    const now = Date.now();

    const ymdFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: ADMIN_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
    const ymd = (ts) => ymdFormatter.format(new Date(ts)); // YYYY-MM-DD
    const parseYMD = (str) => {
        const [y, m, d] = str.split('-').map(Number);
        return { y, m, d };
    };

    function getOffsetMinutesAt(ts) {
        const d = new Date(ts);
        const dtf = new Intl.DateTimeFormat('en-US', {
            timeZone: ADMIN_TIME_ZONE,
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        const parts = dtf.formatToParts(d);
        const pick = (type) => Number(parts.find(p => p.type === type)?.value);
        const localAsUTC = Date.UTC(pick('year'), pick('month') - 1, pick('day'), pick('hour'), pick('minute'), pick('second'));
        return (localAsUTC - ts) / 60000;
    }

    function zonedMidnightUtcFromYMD({ y, m, d }) {
        const guess = Date.UTC(y, m - 1, d, 0, 0, 0);
        const offsetMin = getOffsetMinutesAt(guess);
        return guess - offsetMin * 60000;
    }

    // Today
    const localNow = parseYMD(ymd(now));
    const todayStart = zonedMidnightUtcFromYMD(localNow);
    const localTomorrow = new Date(Date.UTC(localNow.y, localNow.m - 1, localNow.d, 0, 0, 0));
    localTomorrow.setUTCDate(localTomorrow.getUTCDate() + 1);
    const tomorrowYMD = { y: localTomorrow.getUTCFullYear(), m: localTomorrow.getUTCMonth() + 1, d: localTomorrow.getUTCDate() };
    const todayEnd = zonedMidnightUtcFromYMD(tomorrowYMD);

    // Week (ISO week, Monday start)
    const localDate = new Date(Date.UTC(localNow.y, localNow.m - 1, localNow.d, 0, 0, 0));
    const weekdaySun0 = localDate.getUTCDay(); // 0..6 (Sun=0)
    const mondayOffset = (weekdaySun0 + 6) % 7; // Mon=0
    const weekStartLocal = new Date(localDate.getTime());
    weekStartLocal.setUTCDate(weekStartLocal.getUTCDate() - mondayOffset);
    const weekStart = zonedMidnightUtcFromYMD({ y: weekStartLocal.getUTCFullYear(), m: weekStartLocal.getUTCMonth() + 1, d: weekStartLocal.getUTCDate() });
    const weekEnd = weekStart + 7 * 24 * 3600 * 1000;

    // Month
    const monthStart = zonedMidnightUtcFromYMD({ y: localNow.y, m: localNow.m, d: 1 });
    const nextMonth = new Date(Date.UTC(localNow.y, localNow.m - 1, 1));
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    const nextMonthYMD = { y: nextMonth.getUTCFullYear(), m: nextMonth.getUTCMonth() + 1, d: 1 };
    const monthEnd = zonedMidnightUtcFromYMD(nextMonthYMD);

    let today = 0;
    let week = 0;
    let month = 0;
    let totalProcessed = 0;

    for (const jid of Object.keys(chatState)) {
        const processedAt = chatState[jid]?.processedAt;
        if (!processedAt) continue;
        totalProcessed++;
        if (processedAt >= todayStart && processedAt < todayEnd) today++;
        if (processedAt >= weekStart && processedAt < weekEnd) week++;
        if (processedAt >= monthStart && processedAt < monthEnd) month++;
    }

    return {
        today,
        week,
        month,
        totalProcessed
    };
}

let stats = {
    totalMessages: 0,
    totalUsers: new Set(),
    botStatus: 'disconnected',
    startedAt: new Date().toISOString(),
    qrCode: null
};

// HTTP server
const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const pathname = (req.url || '').split('?')[0];

    // ---------------------------
    // Admin routes
    // ---------------------------
    if (req.method === 'POST' && pathname === '/admin/login') {
        readJsonBody(req).then(({ username, password } = {}) => {
            if (!username || !password) { res.writeHead(400); res.end('error'); return; }
            if (!validateAdminLogin(username, password)) { res.writeHead(401); res.end('unauthorized'); return; }

            const sid = crypto.randomBytes(24).toString('hex');
            adminSessions.set(sid, { username, createdAt: Date.now() });

            const secure = process.env.ADMIN_SESSION_SECURE === 'true' || (req.headers['x-forwarded-proto'] === 'https');
            const maxAgeSeconds = Math.floor(SESSION_TTL_MS / 1000);
            res.setHeader('Set-Cookie',
                `${SESSION_COOKIE_NAME}=${sid}; HttpOnly; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure ? '; Secure' : ''}`
            );
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, username }));
        }).catch(() => { res.writeHead(400); res.end('error'); });
        return;
    }

    if (req.method === 'GET' && pathname === '/admin/me') {
        const username = getAdminFromReq(req);
        res.writeHead(username ? 200 : 401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(username ? { username, role: getAdminRole(username) } : { error: 'unauthorized' }));
        return;
    }

    if (req.method === 'POST' && pathname === '/admin/logout') {
        const cookies = parseCookies(req.headers.cookie);
        const sid = cookies[SESSION_COOKIE_NAME];
        if (sid) adminSessions.delete(sid);
        res.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
    }

    if (req.method === 'GET' && pathname === '/superadmin/check') {
        const username = getAdminFromReq(req);
        if (!username || getAdminRole(username) !== 'superadmin') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'forbidden' }));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, username }));
        return;
    }

    if (req.method === 'GET' && pathname === '/superadmin/stats') {
        const username = getAdminFromReq(req);
        if (!username || getAdminRole(username) !== 'superadmin') {
            res.writeHead(403); res.end('forbidden'); return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(computeSuperAdminStats()));
        return;
    }

    if (req.method === 'POST' && pathname === '/admin/claim') {
        const adminUsername = requireAdmin(req, res);
        if (!adminUsername) return;
        readJsonBody(req).then(({ jid } = {}) => {
            if (!jid) { res.writeHead(400); res.end('error'); return; }
            const entry = getChatEntry(jid);
            if (entry.assignedAdmin && entry.assignedAdmin !== adminUsername) { res.writeHead(409); res.end('claimed'); return; }
            entry.assignedAdmin = adminUsername;
            entry.lastUpdatedAt = Date.now();
            saveChatStateToDisk();
            broadcast('admin_assignment', { jid, assignedAdmin: entry.assignedAdmin });
            broadcast('admin_stats', computeProcessedStats());
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
        }).catch(() => { res.writeHead(400); res.end('error'); });
        return;
    }

    if (req.method === 'POST' && pathname === '/admin/release') {
        const adminUsername = requireAdmin(req, res);
        if (!adminUsername) return;
        readJsonBody(req).then(({ jid } = {}) => {
            if (!jid) { res.writeHead(400); res.end('error'); return; }
            const entry = getChatEntry(jid);
            if (entry.assignedAdmin !== adminUsername) { res.writeHead(403); res.end('forbidden'); return; }
            entry.assignedAdmin = null;
            entry.lastUpdatedAt = Date.now();
            saveChatStateToDisk();
            broadcast('admin_assignment', { jid, assignedAdmin: entry.assignedAdmin });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
        }).catch(() => { res.writeHead(400); res.end('error'); });
        return;
    }

    if (req.method === 'POST' && pathname === '/admin/processed') {
        const adminUsername = requireAdmin(req, res);
        if (!adminUsername) return;
        readJsonBody(req).then(({ jid, processed } = {}) => {
            if (!jid) { res.writeHead(400); res.end('error'); return; }
            const entry = getChatEntry(jid);
            if (entry.assignedAdmin !== adminUsername) { res.writeHead(403); res.end('forbidden'); return; }
            entry.processedAt = processed === false ? null : (entry.processedAt || Date.now());
            entry.lastUpdatedAt = Date.now();
            saveChatStateToDisk();
            broadcast('admin_processed', { jid, processedAt: entry.processedAt });
            broadcast('admin_stats', computeProcessedStats());
            broadcastSuperAdmin('superadmin_stats', computeSuperAdminStats());
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
        }).catch(() => { res.writeHead(400); res.end('error'); });
        return;
    }

    // ---------------------------
    // Protected bot control endpoints
    // ---------------------------
    if (req.method === 'POST' && pathname === '/send') {
        const adminUsername = requireAdmin(req, res);
        if (!adminUsername) return;
        let body = '';
        req.on('data', d => body += d);
        req.on('end', async () => {
            try {
                const { jid, text } = JSON.parse(body);
                if (!waSocket || !jid || !text) { res.writeHead(400); res.end('error'); return; }
                const entry = getChatEntry(jid);
                if (entry.assignedAdmin !== adminUsername) { res.writeHead(403); res.end('forbidden'); return; }
                await waSocket.sendMessage(jid, { text });
                const now = new Date().toLocaleString('es-AR');
                fs.appendFileSync('registro_chats.txt', `[${now}] MANUAL -> ${jid}: ${text}\n---\n`);
                const updatedEntry = getChatEntry(jid);
                broadcast('manual_message', { jid, text, ts: now, assignedAdmin: updatedEntry.assignedAdmin, processedAt: updatedEntry.processedAt });
                res.writeHead(200); res.end('ok');
            } catch (e) { console.error('/send error:', e.message); res.writeHead(500); res.end('error'); }
        });
        return;
    }

    if (req.method === 'POST' && pathname === '/pause') {
        const adminUsername = requireAdmin(req, res);
        if (!adminUsername) return;
        let body = '';
        req.on('data', d => body += d);
        req.on('end', () => {
            try {
                const { jid } = JSON.parse(body);
                if (!jid) { res.writeHead(400); res.end('error'); return; }
                const entry = getChatEntry(jid);
                if (entry.assignedAdmin !== adminUsername) { res.writeHead(403); res.end('forbidden'); return; }
                pausedUsers.add(jid);
                broadcast('paused', { jid, paused: true });
                console.log('Bot pausado para', jid);
                res.writeHead(200); res.end('ok');
            } catch { res.writeHead(400); res.end('error'); }
        });
        return;
    }

    if (req.method === 'POST' && pathname === '/resume') {
        const adminUsername = requireAdmin(req, res);
        if (!adminUsername) return;
        let body = '';
        req.on('data', d => body += d);
        req.on('end', () => {
            try {
                const { jid } = JSON.parse(body);
                if (!jid) { res.writeHead(400); res.end('error'); return; }
                const entry = getChatEntry(jid);
                if (entry.assignedAdmin !== adminUsername) { res.writeHead(403); res.end('forbidden'); return; }
                pausedUsers.delete(jid);
                broadcast('paused', { jid, paused: false });
                console.log('Bot reactivado para', jid);
                res.writeHead(200); res.end('ok');
            } catch { res.writeHead(400); res.end('error'); }
        });
        return;
    }

    // Archivos estaticos
    const panelDir = path.join(__dirname, 'panel');
    const safeRelUrl = (pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')).replace(/\.\./g, '');
    const resolved = path.resolve(path.join(panelDir, safeRelUrl));
    if (!resolved.startsWith(panelDir)) { res.writeHead(403); res.end('forbidden'); return; }
    let filePath = resolved;
    const ext = path.extname(filePath);
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp' };
    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
        res.end(data);
    });
});

const wss = new WebSocketServer({ server });
const PANEL_PORT = process.env.PANEL_PORT || 3001;

// Track online admins: username -> Set of ws clients
const onlineAdmins = new Map();

function broadcast(event, payload) {
    const msg = JSON.stringify({ event, payload, ts: Date.now() });
    wss.clients.forEach(client => { if (client.readyState === 1) client.send(msg); });
}

function broadcastSuperAdmin(event, payload) {
    const msg = JSON.stringify({ event, payload, ts: Date.now() });
    wss.clients.forEach(client => {
        if (client.readyState === 1 && client.isSuperAdmin) client.send(msg);
    });
}

function computeSuperAdminStats() {
    const users = getAdminUsers();
    const now = Date.now();
    const tz = ADMIN_TIME_ZONE;

    const ymdFmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' });
    const ymd = ts => ymdFmt.format(new Date(ts));
    const parseYMD = str => { const [y,m,d] = str.split('-').map(Number); return {y,m,d}; };

    function offsetMin(ts) {
        const d = new Date(ts);
        const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit' });
        const parts = dtf.formatToParts(d);
        const pick = t => Number(parts.find(p=>p.type===t)?.value);
        return (Date.UTC(pick('year'), pick('month')-1, pick('day'), pick('hour'), pick('minute'), pick('second')) - ts) / 60000;
    }
    function midnight({y,m,d}) {
        const g = Date.UTC(y, m-1, d);
        return g - offsetMin(g)*60000;
    }

    const localNow = parseYMD(ymd(now));
    const todayStart = midnight(localNow);
    const tom = new Date(Date.UTC(localNow.y, localNow.m-1, localNow.d)); tom.setUTCDate(tom.getUTCDate()+1);
    const todayEnd = midnight({y:tom.getUTCFullYear(),m:tom.getUTCMonth()+1,d:tom.getUTCDate()});

    const localDate = new Date(Date.UTC(localNow.y, localNow.m-1, localNow.d));
    const mondayOffset = (localDate.getUTCDay()+6)%7;
    const weekStartD = new Date(localDate); weekStartD.setUTCDate(weekStartD.getUTCDate()-mondayOffset);
    const weekStart = midnight({y:weekStartD.getUTCFullYear(),m:weekStartD.getUTCMonth()+1,d:weekStartD.getUTCDate()});
    const weekEnd = weekStart + 7*24*3600*1000;

    const monthStart = midnight({y:localNow.y,m:localNow.m,d:1});
    const nextM = new Date(Date.UTC(localNow.y,localNow.m-1,1)); nextM.setUTCMonth(nextM.getUTCMonth()+1);
    const monthEnd = midnight({y:nextM.getUTCFullYear(),m:nextM.getUTCMonth()+1,d:1});

    const admins = [];
    let totalToday = 0, totalWeek = 0, totalMonth = 0, totalChats = 0;

    for (const [username, entry] of users.entries()) {
        if (entry.role === 'superadmin') continue; // don't show superadmins in table
        const onlineClients = onlineAdmins.get(username);
        const online = !!(onlineClients && onlineClients.size > 0);

        // Count chats currently taken by this admin
        let chatsTaken = 0;
        for (const jid of Object.keys(chatState)) {
            if (chatState[jid]?.assignedAdmin === username) chatsTaken++;
        }

        // Count processed per period
        let pToday = 0, pWeek = 0, pMonth = 0;
        for (const jid of Object.keys(chatState)) {
            const s = chatState[jid];
            if (!s?.processedAt) continue;
            // We attribute to whoever last had the chat assigned — best approximation
            // Track by assignedAdmin at time of processing using lastUpdatedAt
            // For now count all processed regardless of admin (global stats show per-admin via chatState)
            // Better: we need to store who processed. For now estimate: if assignedAdmin matches
            if (s.assignedAdmin === username || (!s.assignedAdmin && s.processedAt)) {
                // only count if this admin is/was assigned
                if (s.assignedAdmin === username) {
                    if (s.processedAt >= todayStart && s.processedAt < todayEnd) { pToday++; totalToday++; }
                    if (s.processedAt >= weekStart  && s.processedAt < weekEnd)  { pWeek++;  totalWeek++;  }
                    if (s.processedAt >= monthStart && s.processedAt < monthEnd) { pMonth++; totalMonth++; }
                }
            }
        }

        totalChats += chatsTaken;
        admins.push({ username, online, chatsTaken, processedToday: pToday, processedWeek: pWeek, processedMonth: pMonth });
    }

    // Global totals (all processed regardless of current assignment)
    let gToday = 0, gWeek = 0, gMonth = 0;
    for (const jid of Object.keys(chatState)) {
        const p = chatState[jid]?.processedAt;
        if (!p) continue;
        if (p >= todayStart && p < todayEnd) gToday++;
        if (p >= weekStart  && p < weekEnd)  gWeek++;
        if (p >= monthStart && p < monthEnd) gMonth++;
    }

    return {
        admins,
        totals: { today: gToday, week: gWeek, month: gMonth },
        onlineCount: [...onlineAdmins.values()].filter(s=>s.size>0).length,
        totalChats
    };
}

wss.on('connection', (ws, req) => {
    const username = getAdminFromReq(req || { headers: {} });
    if (!username) {
        ws.close(4401, 'unauthorized');
        return;
    }
    ws.adminUsername = username;
    const role = getAdminRole(username);
    ws.isSuperAdmin = role === 'superadmin';

    // Track online
    if (!onlineAdmins.has(username)) onlineAdmins.set(username, new Set());
    onlineAdmins.get(username).add(ws);

    ws.on('close', () => {
        const set = onlineAdmins.get(username);
        if (set) { set.delete(ws); }
        broadcastSuperAdmin('superadmin_stats', computeSuperAdminStats());
    });

    if (ws.isSuperAdmin) {
        ws.send(JSON.stringify({
            event: 'superadmin_stats',
            payload: computeSuperAdminStats(),
            ts: Date.now()
        }));
    } else {
        ws.send(JSON.stringify({
            event: 'init',
            payload: {
                status: stats.botStatus,
                totalMessages: stats.totalMessages,
                totalUsers: stats.totalUsers.size,
                startedAt: stats.startedAt,
                qrCode: stats.qrCode,
                history: getRecentHistory(50),
                pausedUsers: [...pausedUsers],
                processedStats: computeProcessedStats()
            },
            ts: Date.now()
        }));
    }

    // Broadcast updated online status to superadmins
    broadcastSuperAdmin('superadmin_stats', computeSuperAdminStats());
});

function getRecentHistory(n) {
    try {
        if (!fs.existsSync('registro_chats.txt')) return [];
        const raw = fs.readFileSync('registro_chats.txt', 'utf8');
        const blocks = raw.split('---\n').filter(b => b.trim());
        return blocks.slice(-n).map(block => {
            const lines = block.trim().split('\n');
            const userLine = lines.find(l => l.includes('MANUAL ->'));
            if (userLine) {
                const tsMatch = userLine.match(/\[(.+?)\]/);
                const jidMatch = userLine.match(/MANUAL -> (.+?): /);
                const text = userLine.replace(/\[.+?\] MANUAL -> .+?: /, '');
                const jid = jidMatch?.[1] || null;
                const entry = jid ? getChatEntry(jid) : null;
                return {
                    ts: tsMatch?.[1] || '',
                    name: entry?.lastClientName || 'YO',
                    jid,
                    user: '',
                    bot: text.trim(),
                    manual: true,
                    assignedAdmin: entry?.assignedAdmin ?? null,
                    processedAt: entry?.processedAt ?? null
                };
            }
            const uLine = lines.find(l => l.includes('👤'));
            const bLine = lines.find(l => l.includes('🤖'));
            const tsMatch  = uLine?.match(/\[(.+?)\]/);
            const nmMatch  = uLine?.match(/👤 (.+?):/);
            const jidLine  = lines.find(l => l.includes('JID ->'));
            const jidMatch  = jidLine?.match(/JID -> (.+)$/);
            const userText = uLine?.replace(/\[.+?\]\s*👤\s*.+?:\s*/, '') || '';
            const botText  = bLine?.replace(/🤖 Bot:\s*/, '') || '';
            const jid = jidMatch?.[1] || null;
            const entry = jid ? getChatEntry(jid) : null;
            return {
                ts: tsMatch?.[1]||'',
                name: nmMatch?.[1]||'Cliente',
                jid,
                user: userText.trim(),
                bot: botText.trim(),
                manual: false,
                assignedAdmin: entry?.assignedAdmin ?? null,
                processedAt: entry?.processedAt ?? null
            };
        });
    } catch { return []; }
}

async function callGroq(messages) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, max_tokens: 1024, temperature: 0.7 })
    });
    if (!response.ok) throw new Error(`Groq ${response.status}: ${await response.text()}`);
    const data = await response.json();
    return data.choices[0].message.content;
}

async function connectToWhatsApp() {
    console.log('Iniciando Il Milano Bot...');
    stats.botStatus = 'connecting';
    broadcast('status', { status: 'connecting' });

    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        auth: state,
        browser: ['Il Milano Bot', 'Chrome', '1.0.0'],
        printQRInTerminal: true,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
    });

    waSocket = sock;
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) { qrcode.generate(qr, { small: true }); stats.qrCode = qr; broadcast('qr', { qr }); }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            stats.botStatus = 'disconnected'; stats.qrCode = null; waSocket = null;
            broadcast('status', { status: 'disconnected' });
            if (shouldReconnect) setTimeout(connectToWhatsApp, 5000);
        } else if (connection === 'open') {
            stats.botStatus = 'connected'; stats.qrCode = null;
            broadcast('status', { status: 'connected' });
            console.log('Bot conectado!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid  = msg.key.remoteJid;
        const clientName = msg.pushName || 'Cliente';
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!text) return;

        stats.totalMessages++;
        stats.totalUsers.add(remoteJid);
        const now = new Date().toLocaleString('es-AR');

        // Bot pausado: mostrar en panel pero no responder
        if (pausedUsers.has(remoteJid)) {
            console.log(`[PAUSADO] ${clientName}: ${text}`);
            broadcast('incoming', {
                jid: remoteJid, ts: now, name: clientName,
                user: text, paused: true,
                assignedAdmin: getChatEntry(remoteJid).assignedAdmin,
                processedAt: getChatEntry(remoteJid).processedAt,
                totalMessages: stats.totalMessages, totalUsers: stats.totalUsers.size
            });
            return;
        }

        try {
            const entry = getChatEntry(remoteJid);
            entry.lastClientName = clientName;

            if (!chatHistory.has(remoteJid))
                chatHistory.set(remoteJid, [{ role: 'system', content: SYSTEM_PROMPT }]);
            const history = chatHistory.get(remoteJid);
            history.push({ role: 'user', content: text });
            const response = await callGroq(history);
            history.push({ role: 'assistant', content: response });
            if (history.length > 52) { const s = history[0]; history.splice(1,2); history[0]=s; }

            fs.appendFileSync('registro_chats.txt', `[${now}] 👤 ${clientName}: ${text}\nJID -> ${remoteJid}\n🤖 Bot: ${response}\n---\n`);
            broadcast('message', {
                jid: remoteJid, ts: now, name: clientName, user: text, bot: response, paused: false,
                assignedAdmin: entry.assignedAdmin,
                processedAt: entry.processedAt,
                totalMessages: stats.totalMessages, totalUsers: stats.totalUsers.size
            });
            await sock.sendMessage(remoteJid, { text: response });
        } catch (error) {
            console.error('Error Groq:', error.message);
            await sock.sendMessage(remoteJid, { text: 'Perdon, se me quemo la cocina. Me repetis el pedido?' }).catch(()=>{});
        }
    });
}

server.listen(PANEL_PORT, '0.0.0.0', () => console.log(`Panel en http://0.0.0.0:${PANEL_PORT}`));
connectToWhatsApp().catch(console.error);