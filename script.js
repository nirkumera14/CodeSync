// ============================================================
// STATE
// ============================================================
let myUser = {name:'You', color:'#7c6af7', id:'me'};
let currentRoom = 'room-alpha-42';
let currentFile = 'main.js';
let isTyping = false;
let typingTimer = null;
let chatUnread = 0;
let currentPanel = 'terminal';
let panelResizing = false;
let panelStartY = 0;
let panelStartH = 0;

const BOTS = [
  {name:'Priya', color:'#2ecc71', id:'bot1'},
  {name:'Rahul', color:'#e056fd', id:'bot2'},
  {name:'Aarav', color:'#f39c12', id:'bot3'},
];

const FILES = {
  'main.js': `// Real-Time Collaborative Code Editor
// Built with WebSockets + Operational Transform

const express = require('express');
const { Server } = require('socket.io');
const http = require('http');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Track rooms and their documents
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', ({ roomId, user }) => {
    socket.join(roomId);
    
    // Get or create room state
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        document: '',
        users: new Map(),
        version: 0
      });
    }
    
    const room = rooms.get(roomId);
    room.users.set(socket.id, user);
    
    // Send current state to new user
    socket.emit('room-state', {
      document: room.document,
      users: [...room.users.values()],
      version: room.version
    });
    
    // Notify others
    socket.to(roomId).emit('user-joined', user);
  });

  socket.on('operation', ({ roomId, op, version }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    // Apply Operational Transform
    const transformed = transformOp(op, room.pendingOps, version);
    room.document = applyOp(room.document, transformed);
    room.version++;
    
    // Broadcast to all other users in room
    socket.to(roomId).emit('operation', {
      op: transformed,
      version: room.version
    });
  });

  socket.on('cursor-move', ({ roomId, position }) => {
    socket.to(roomId).emit('cursor-update', {
      userId: socket.id,
      position
    });
  });

  socket.on('disconnect', () => {
    // Clean up user from all rooms
    rooms.forEach((room, roomId) => {
      if (room.users.has(socket.id)) {
        const user = room.users.get(socket.id);
        room.users.delete(socket.id);
        io.to(roomId).emit('user-left', user);
      }
    });
  });
});

function transformOp(op, pendingOps, clientVersion) {
  // Simplified OT: transform insert/delete against concurrent ops
  let transformed = { ...op };
  for (const pending of pendingOps.slice(clientVersion)) {
    if (pending.type === 'insert' && op.type === 'insert') {
      if (pending.position <= transformed.position) {
        transformed.position += pending.text.length;
      }
    }
    // ... more transform cases
  }
  return transformed;
}

server.listen(3000, () => {
  console.log('CodeSync server running on port 3000');
});`,

  'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeSync Editor</title>
  <link rel="stylesheet" href="styles.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.0/codemirror.min.css">
</head>
<body>
  <div id="app">
    <header class="editor-header">
      <div class="logo">⟨/⟩ CodeSync</div>
      <div class="room-badge">
        <span class="live-indicator"></span>
        Room: <strong id="room-id">loading...</strong>
      </div>
      <div class="collaborators" id="collaborators"></div>
      <button id="run-btn" class="run-button">▶ Run</button>
    </header>
    
    <main class="editor-layout">
      <aside class="file-tree" id="file-tree"></aside>
      
      <div class="editor-container">
        <div class="editor-tabs" id="editor-tabs"></div>
        <div id="editor-mount"></div>
      </div>
      
      <aside class="chat-sidebar">
        <div class="chat-header">Team Chat</div>
        <div class="messages" id="messages"></div>
        <div class="chat-input">
          <input type="text" id="msg-input" placeholder="Message...">
          <button id="send-btn">Send</button>
        </div>
      </aside>
    </main>
    
    <footer class="status-bar" id="status-bar">
      Ready
    </footer>
  </div>
  
  <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.0/socket.io.min.js"><\/script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.0/codemirror.min.js"><\/script>
  <script src="client.js"><\/script>
</body>
</html>`,

  'styles.css': `/* CodeSync Editor — Client Styles */

:root {
  --bg-primary: #0d0f14;
  --bg-secondary: #13161e;
  --bg-tertiary: #1a1d27;
  --border: #2a2f3f;
  --accent: #7c6af7;
  --text: #e8eaf2;
  --text-muted: #8b91a8;
  --green: #2ecc71;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg-primary);
  color: var(--text);
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-header {
  height: 52px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 16px;
}

.editor-layout {
  flex: 1;
  display: grid;
  grid-template-columns: 220px 1fr 280px;
  overflow: hidden;
}

.live-indicator {
  display: inline-block;
  width: 8px;
  height: 8px;
  background: var(--green);
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.CodeMirror {
  height: 100%;
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.6;
}

.remote-cursor {
  border-left: 2px solid;
  margin-left: -1px;
  position: relative;
}

.remote-cursor-label {
  position: absolute;
  top: -18px;
  left: -1px;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
  color: white;
}`,

  'README.md': `# CodeSync — Real-Time Collaborative Editor

> Final Year CSE Project | WebSocket + Operational Transform

## Features

- **Real-time collaboration** — See changes from all users instantly
- **Operational Transform** — Conflict-free concurrent editing
- **Live cursors** — See where your teammates are working
- **Multi-file support** — Work across multiple files simultaneously
- **Integrated chat** — Communicate without leaving the editor
- **Syntax highlighting** — Support for 20+ languages
- **Built-in terminal** — Run code directly in the browser

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, CodeMirror 6 |
| Backend | Node.js, Express |
| Real-time | Socket.io (WebSocket) |
| OT Engine | Custom implementation |
| Database | Redis (session), MongoDB (persist) |
| Deploy | Docker + AWS EC2 |

## Architecture

\`\`\`
Client A ──┐
           ├──► Socket.io Server ──► OT Engine ──► Broadcast
Client B ──┘          │
                       └──► MongoDB (persistence)
\`\`\`

## Getting Started

\`\`\`bash
# Clone the repo
git clone https://github.com/yourusername/codesync

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000
\`\`\`

## OT Algorithm

This project implements a simplified version of the 
Jupiter OT algorithm to handle concurrent edits:

1. Each operation has a (revision, op) pair
2. Server serializes all operations
3. Client transforms incoming ops against local pending ops
4. Guarantees convergence across all clients

## License

MIT — Built for educational purposes`,

  'package.json': `{
  "name": "codesync-editor",
  "version": "1.0.0",
  "description": "Real-time collaborative code editor",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "jest --coverage",
    "build": "webpack --mode production"
  },
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.7.0",
    "redis": "^4.6.7",
    "mongoose": "^7.5.0",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",
    "jest": "^29.6.2",
    "webpack": "^5.88.2",
    "webpack-cli": "^5.1.4",
    "@types/node": "^20.5.0"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "keywords": ["collaborative", "editor", "websocket", "realtime", "ot"],
  "author": "Your Name",
  "license": "MIT"
}`
};

const LANG_MAP = {
  'main.js':'javascript','index.html':'html','styles.css':'css',
  'README.md':'markdown','package.json':'json'
};

const LANG_LABELS = {
  'main.js':'JavaScript','index.html':'HTML','styles.css':'CSS',
  'README.md':'Markdown','package.json':'JSON'
};

// ============================================================
// INIT
// ============================================================
function joinRoom() {
  const name = document.getElementById('user-name').value.trim() || 'Developer';
  const room = document.getElementById('room-id-input').value.trim() || 'room-alpha-42';
  const selectedSwatch = document.querySelector('.color-swatch.selected');
  const color = selectedSwatch ? selectedSwatch.dataset.color : '#7c6af7';

  myUser = {name, color, id:'me'};
  currentRoom = room;

  document.getElementById('join-modal').style.display = 'none';
  document.getElementById('room-id-display').textContent = room;

  loadFile('main.js');
  renderUsers();
  renderAvatars();
  initTerminal();
  startBotActivity();

  showToast(`Joined room "${room}" as ${name}`, 'success');
  setTimeout(() => showToast('Priya joined the room', 'info', '#2ecc71'), 1800);
  setTimeout(() => showToast('Rahul joined the room', 'info', '#e056fd'), 3200);
}

// ============================================================
// COLOR PICKER
// ============================================================
document.getElementById('color-picker').addEventListener('click', e => {
  const sw = e.target.closest('.color-swatch');
  if (!sw) return;
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
  sw.classList.add('selected');
});

// ============================================================
// FILE MANAGEMENT
// ============================================================
function switchFile(fname) {
  currentFile = fname;
  document.querySelectorAll('.file-item').forEach(f => f.classList.toggle('active', f.dataset.file === fname));

  // Update tabs
  const tabEl = document.querySelector(`.tab[data-file="${fname}"]`);
  if (!tabEl) {
    addTab(fname);
  }
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.file === fname));
  document.getElementById('lang-indicator').textContent = LANG_LABELS[fname] || 'Text';
  loadFile(fname);
}

function addTab(fname) {
  const ext = fname.split('.').pop();
  const colors = {js:'#f39c12',html:'#e74c3c',css:'#3498db',md:'#2ecc71',json:'#e056fd'};
  const c = colors[ext] || '#888';
  const tab = document.createElement('div');
  tab.className = 'tab';
  tab.dataset.file = fname;
  tab.innerHTML = `<svg width="10" height="10" viewBox="0 0 16 16"><rect x="2" y="1" width="10" height="14" rx="1.5" fill="${c}" opacity="0.8"/></svg>${fname}<div class="tab-close" onclick="closeTab(event,'${fname}')">×</div>`;
  tab.onclick = () => switchFile(fname);
  document.getElementById('tabs').appendChild(tab);
}

function closeTab(e, fname) {
  e.stopPropagation();
  const tab = document.querySelector(`.tab[data-file="${fname}"]`);
  if (tab) tab.remove();
  if (currentFile === fname) {
    const remaining = document.querySelector('.tab');
    if (remaining) switchFile(remaining.dataset.file);
  }
}

function loadFile(fname) {
  const content = FILES[fname] || '// Empty file';
  const editor = document.getElementById('code-area');
  editor.value = content;
  updateHighlight();
  updateLineNumbers();
  updateCursorPos();
}

// ============================================================
// EDITOR
// ============================================================
const editor = document.getElementById('code-area');
const hlCode = document.getElementById('highlighted-code');
const lineNums = document.getElementById('line-numbers');

function updateHighlight() {
  const code = editor.value;
  const lang = LANG_MAP[currentFile] || 'plaintext';
  let highlighted;
  try {
    highlighted = hljs.highlight(code, {language: lang}).value;
  } catch(e) {
    highlighted = hljs.highlightAuto(code).value;
  }
  hlCode.innerHTML = highlighted;
  document.getElementById('highlight-layer').className = `language-${lang}`;
}

function updateLineNumbers() {
  const lines = editor.value.split('\n').length;
  lineNums.innerHTML = Array.from({length: lines}, (_, i) => `<span>${i+1}</span>`).join('');
}

function updateCursorPos() {
  const val = editor.value;
  const pos = editor.selectionStart || 0;
  const before = val.substring(0, pos);
  const lines = before.split('\n');
  document.getElementById('cursor-pos').textContent = `Ln ${lines.length}, Col ${lines[lines.length-1].length + 1}`;
}

function syncScroll() {
  document.getElementById('highlight-layer').scrollTop = editor.scrollTop;
  document.getElementById('highlight-layer').scrollLeft = editor.scrollLeft;
  lineNums.scrollTop = editor.scrollTop;
}

editor.addEventListener('input', () => {
  FILES[currentFile] = editor.value;
  updateHighlight();
  updateLineNumbers();
  updateCursorPos();
  triggerTyping();
  simulateBroadcast();
});

editor.addEventListener('scroll', syncScroll);
editor.addEventListener('keyup', updateCursorPos);
editor.addEventListener('click', updateCursorPos);

editor.addEventListener('keydown', e => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.value = editor.value.substring(0, start) + '  ' + editor.value.substring(end);
    editor.selectionStart = editor.selectionEnd = start + 2;
    FILES[currentFile] = editor.value;
    updateHighlight();
  }
});

// ============================================================
// TYPING INDICATOR
// ============================================================
function triggerTyping() {
  if (!isTyping) {
    isTyping = true;
    updateStatusTyping();
  }
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    isTyping = false;
    updateStatus();
  }, 1200);
}

function updateStatusTyping() {
  document.getElementById('status-text').textContent = 'Connected • You are typing...';
}

function updateStatus() {
  const count = BOTS.length + 1;
  document.getElementById('status-text').textContent = `Connected • ${count} collaborators`;
}

// ============================================================
// USERS
// ============================================================
function renderUsers() {
  const list = document.getElementById('user-list');
  const allUsers = [myUser, ...BOTS];
  list.innerHTML = allUsers.map(u => `
    <div class="user-row">
      <div class="av" style="background:${u.color}22;color:${u.color}">${u.name[0]}</div>
      <div>
        <div class="uname">${u.name}${u.id==='me'?' (You)':''}</div>
        <div class="ustatus">${u.id==='me'?'Editing '+currentFile:'Online'}</div>
      </div>
      <div style="width:7px;height:7px;border-radius:50%;background:${u.color};margin-left:auto"></div>
    </div>
  `).join('');
}

function renderAvatars() {
  const bar = document.getElementById('avatar-bar');
  const allUsers = [myUser, ...BOTS];
  bar.innerHTML = allUsers.map(u => `
    <div class="avatar" style="background:${u.color}33;color:${u.color}" title="${u.name}">${u.name[0]}</div>
  `).join('');
}

// ============================================================
// TERMINAL
// ============================================================
const termLines = [];
function initTerminal() {
  termLog('$ node --version', 'cmd');
  termLog('v20.11.0', 'out');
  termLog('$ npm --version', 'cmd');
  termLog('10.2.4', 'out');
  termLog('$ ', 'cmd');
  renderTerminal();
}

function termLog(text, type='out') {
  termLines.push({text, type});
}

function renderTerminal() {
  const el = document.getElementById('terminal-panel');
  el.innerHTML = termLines.map(l => `<div class="term-line ${l.type}">${escHtml(l.text)}</div>`).join('');
  el.scrollTop = el.scrollHeight;
}

function termKeydown(e) {
  if (e.key === 'Enter') {
    const val = e.target.value.trim();
    if (!val) return;
    termLog('$ ' + val, 'cmd');
    processCommand(val);
    e.target.value = '';
    renderTerminal();
  }
}

function processCommand(cmd) {
  const c = cmd.toLowerCase();
  if (c === 'ls' || c === 'dir') {
    termLog('main.js  index.html  styles.css  README.md  package.json  node_modules/', 'out');
  } else if (c === 'node main.js' || c === 'npm start') {
    termLog('> codesync-editor@1.0.0 start', 'out');
    termLog('> node server.js', 'out');
    termLog('', 'out');
    termLog('CodeSync server running on port 3000', 'info');
    termLog('WebSocket server ready', 'info');
    termLog('Connected to MongoDB: localhost:27017/codesync', 'info');
  } else if (c === 'npm install') {
    termLog('npm warn deprecated...', 'err');
    termLog('added 237 packages in 4.2s', 'out');
    termLog('', 'out');
    termLog('46 packages are looking for funding', 'info');
  } else if (c === 'clear' || c === 'cls') {
    termLines.length = 0;
  } else if (c === 'help') {
    termLog('Available: ls, node main.js, npm install, npm start, clear, git status', 'info');
  } else if (c === 'git status') {
    termLog('On branch main', 'out');
    termLog('Changes not staged for commit:', 'out');
    termLog('  modified: main.js', 'err');
    termLog('  modified: styles.css', 'err');
  } else if (c === 'git log --oneline') {
    termLog('a3f21bc feat: add OT transform engine', 'out');
    termLog('b2e11de fix: cursor sync on reconnect', 'out');
    termLog('c1d00ab init: project scaffold', 'out');
  } else if (c.startsWith('echo ')) {
    termLog(cmd.slice(5), 'out');
  } else {
    termLog(`command not found: ${cmd}`, 'err');
    termLog('Type "help" for available commands', 'info');
  }
}

// ============================================================
// RUN CODE
// ============================================================
function runCode() {
  switchPanel('output');
  const out = document.getElementById('run-output');
  out.innerHTML = '';
  const lang = LANG_MAP[currentFile];
  const code = FILES[currentFile];

  const line = (t, c='var(--text2)') => {
    const el = document.createElement('div');
    el.style.cssText = `color:${c};font-family:var(--font-mono);font-size:12.5px;line-height:1.7`;
    el.textContent = t;
    out.appendChild(el);
    out.scrollTop = out.scrollHeight;
  };

  line(`> Running ${currentFile}...`, 'var(--text3)');
  line('');

  setTimeout(() => {
    if (lang === 'javascript') {
      try {
        const logs = [];
        const fakeConsole = {log:(...a)=>logs.push(a.join(' ')), error:(...a)=>logs.push('ERROR: '+a.join(' ')), warn:(...a)=>logs.push('WARN: '+a.join(' '))};
        const safeCode = code.replace(/require\s*\(/g,'//require(').replace(/import\s+/g,'//import ');
        new Function('console', safeCode)(fakeConsole);
        if (logs.length === 0) {
          line('(No console output)', 'var(--text3)');
        } else {
          logs.forEach(l => line(l, 'var(--green)'));
        }
      } catch(e) {
        line('✗ ' + e.message, 'var(--red)');
        const frames = e.stack ? e.stack.split('\n').slice(0,3) : [];
        frames.forEach(f => line('  ' + f, 'var(--text3)'));
      }
    } else {
      line(`[${LANG_LABELS[currentFile]}] Syntax OK`, 'var(--green)');
      line(`File: ${currentFile} (${code.length} bytes, ${code.split('\n').length} lines)`, 'var(--text2)');
    }
    line('');
    line(`Process finished. Exit code: 0`, 'var(--text3)');
  }, 400);

  showToast(`Running ${currentFile}...`, 'info');
}

// ============================================================
// CHAT
// ============================================================
const chatMessages = [];

function sendChat() {
  const inp = document.getElementById('chat-input');
  const text = inp.value.trim();
  if (!text) return;
  addChatMsg(myUser, text, true);
  inp.value = '';
  simulateBotReply(text);
}

function chatKeydown(e) { if (e.key === 'Enter') sendChat(); }

function addChatMsg(user, text, own=false) {
  const msgs = document.getElementById('chat-messages');
  const time = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  const div = document.createElement('div');
  div.className = 'chat-msg' + (own ? ' own' : '');
  div.innerHTML = `
    <div class="msg-av" style="background:${user.color}22;color:${user.color}">${user.name[0]}</div>
    <div class="msg-body">
      <div class="msg-name" style="color:${user.color}">${user.name} <span class="msg-time">${time}</span></div>
      <div class="msg-text">${escHtml(text)}</div>
    </div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  chatMessages.push({user, text, time});

  if (currentPanel !== 'chat') {
    chatUnread++;
    const badge = document.getElementById('chat-badge');
    badge.textContent = chatUnread;
    badge.style.display = 'inline';
  }
}

const BOT_REPLIES = [
  "Looking good! I'll review main.js now.",
  "Can you check the OT transform function? I think there's an edge case.",
  "I updated the README with the new architecture diagram.",
  "The socket.io version might need an upgrade — v4.7 has better reconnect logic.",
  "Good point! Let me test that locally first.",
  "I'm adding error handling to the disconnect event.",
  "Should we add Redis for session persistence? Makes scaling easier.",
  "The cursor sync looks smooth now! Great fix.",
  "Let's add unit tests for the transformOp function.",
  "I just pushed a fix for the MongoDB connection pooling issue.",
];

let replyIdx = 0;
function simulateBotReply(userMsg) {
  const bot = BOTS[Math.floor(Math.random() * BOTS.length)];
  setTimeout(() => {
    addChatMsg(bot, BOT_REPLIES[replyIdx % BOT_REPLIES.length]);
    replyIdx++;
  }, 800 + Math.random() * 1200);
}

// ============================================================
// BOT ACTIVITY
// ============================================================
const BOT_EDITS = [
  {file:'main.js', action:'Added error handling to connection event'},
  {file:'styles.css', action:'Updated cursor animation timing'},
  {file:'index.html', action:'Added meta viewport tag'},
  {file:'main.js', action:'Refactored transformOp function'},
  {file:'README.md', action:'Updated installation steps'},
];
let botEditIdx = 0;

function startBotActivity() {
  scheduleNextBotEdit();
  scheduleBotChat();
}

function scheduleNextBotEdit() {
  setTimeout(() => {
    const bot = BOTS[botEditIdx % BOTS.length];
    const edit = BOT_EDITS[botEditIdx % BOT_EDITS.length];
    showToast(`${bot.name} edited ${edit.file}`, 'collab', bot.color);
    // Mark file with diff badge
    const fi = document.querySelector(`.file-item[data-file="${edit.file}"] .file-badge`);
    if (fi) { fi.style.background = bot.color; fi.style.display='block'; }
    botEditIdx++;
    scheduleNextBotEdit();
  }, 5000 + Math.random() * 8000);
}

function scheduleBotChat() {
  setTimeout(() => {
    const bot = BOTS[Math.floor(Math.random() * BOTS.length)];
    const msgs = [
      "I'm working on the OT algorithm — almost done!",
      "Should we use MongoDB or PostgreSQL for persistence?",
      "The cursor positions look off on mobile, might need fixing.",
      "Great progress everyone! Almost ready to demo.",
    ];
    addChatMsg(bot, msgs[Math.floor(Math.random() * msgs.length)]);
    scheduleBotChat();
  }, 12000 + Math.random() * 20000);
}

function simulateBroadcast() {
  // Simulate sending to other users (in real app this would be WebSocket emit)
  const bot = BOTS[Math.floor(Math.random() * BOTS.length)];
  // Could show "Priya received your changes" but keeping it minimal
}

// ============================================================
// PANEL SWITCHING
// ============================================================
function switchPanel(panel) {
  currentPanel = panel;
  document.querySelectorAll('.panel-tab').forEach((t, i) => {
    t.classList.toggle('active', ['terminal','output','chat'][i] === panel);
  });
  document.getElementById('terminal-panel').className = 'terminal' + (panel==='terminal'?' active':'');
  document.getElementById('run-output').className = 'run-output' + (panel==='output'?' active':'');
  document.getElementById('chat-panel').className = 'chat-panel' + (panel==='chat'?' active':'');
  document.getElementById('term-input-row').style.display = panel === 'terminal' ? 'flex' : 'none';

  if (panel === 'chat') {
    chatUnread = 0;
    document.getElementById('chat-badge').style.display = 'none';
  }
}

// ============================================================
// PANEL RESIZE
// ============================================================
const resizeHandle = document.getElementById('resize-handle');
if (resizeHandle) resizeHandle.addEventListener('mousedown', e => {
  panelResizing = true;
  panelStartY = e.clientY;
  panelStartH = document.getElementById('bottom-panel').offsetHeight;
  document.body.style.cursor = 'ns-resize';
  document.body.style.userSelect = 'none';
});
document.addEventListener('mousemove', e => {
  if (!panelResizing) return;
  const delta = panelStartY - e.clientY;
  const newH = Math.max(100, Math.min(500, panelStartH + delta));
  document.getElementById('bottom-panel').style.height = newH + 'px';
});
document.addEventListener('mouseup', () => {
  panelResizing = false;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
});

// ============================================================
// TOAST
// ============================================================
function showToast(msg, type='info', color=null) {
  const colors = {success:var_('--green'), info:var_('--blue'), error:var_('--red'), collab:color||var_('--accent')};
  const icons = {success:'✓', info:'ℹ', error:'✗', collab:'●'};
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span style="color:${colors[type]||colors.info};font-weight:700">${icons[type]||'ℹ'}</span> ${escHtml(msg)}`;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('fade-out'); setTimeout(()=>t.remove(), 200); }, 3000);
}

function var_(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#7c6af7';
}

// ============================================================
// SHARE / COPY
// ============================================================
function copyRoomLink() {
  const link = `https://codesync.app/room/${currentRoom}`;
  navigator.clipboard.writeText(link).catch(()=>{});
  showToast('Room link copied!', 'success');
}

function shareRoom() {
  copyRoomLink();
}

// ============================================================
// UTILS
// ============================================================
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ============================================================
// STARTUP CHAT MESSAGES
// ============================================================
setTimeout(() => {
  const initMsgs = [
    {user: BOTS[0], text: "Hey team! I'm starting on the server-side OT implementation."},
    {user: BOTS[1], text: "Nice! I'll handle the client-side cursor sync logic."},
    {user: BOTS[2], text: "I'm setting up Redis for session management. Any preferences on the key schema?"},
  ];
  let delay = 500;
  initMsgs.forEach(m => {
    setTimeout(() => addChatMsg(m.user, m.text), delay);
    delay += 1200;
  });
}, 2500);