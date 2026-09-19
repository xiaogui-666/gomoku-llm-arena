'use strict';
/* ============================================================
   棋弈台 —— 纯静态五子棋大模型评测（无后端，浏览器直连模型 API）
   ============================================================ */

const SIZE = 15;
const COLS = 'ABCDEFGHIJKLMNO';
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
const $ = (id) => document.getElementById(id);
const notate = (r, c) => COLS[c] + (r + 1);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const inBoard = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;
const emptyBoard = () => Array.from({ length: SIZE }, () => new Array(SIZE).fill(0));
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/* ============================================================
   1. 规则
   ============================================================ */

function findWinLine(board, r, c) {
  const v = board[r][c];
  if (!v) return null;
  for (const [dr, dc] of DIRS) {
    const cells = [[r, c]];
    for (let i = 1; i < SIZE; i++) {
      const nr = r + dr * i, nc = c + dc * i;
      if (!inBoard(nr, nc) || board[nr][nc] !== v) break;
      cells.push([nr, nc]);
    }
    for (let i = 1; i < SIZE; i++) {
      const nr = r - dr * i, nc = c - dc * i;
      if (!inBoard(nr, nc) || board[nr][nc] !== v) break;
      cells.unshift([nr, nc]);
    }
    if (cells.length >= 5) return cells;
  }
  return null;
}

const boardFull = (board) => board.every((row) => row.every((v) => v !== 0));

/* ============================================================
   2. 内置启发式引擎（线模式匹配：成五/活四/冲四/活三/眠三/活二）
   ============================================================ */

const PATTERNS = [
  ['11111', 5000000],
  ['011110', 400000],
  ['11110', 30000], ['01111', 30000], ['11011', 30000], ['10111', 30000], ['11101', 30000],
  ['011100', 12000], ['001110', 12000], ['011010', 12000], ['010110', 12000],
  ['11100', 2500], ['00111', 2500], ['11010', 2500], ['01011', 2500],
  ['10110', 2500], ['01101', 2500], ['10011', 2500], ['11001', 2500],
  ['001100', 1500], ['001010', 1200], ['010100', 1200],
  ['11000', 320], ['00011', 320], ['10100', 300], ['00101', 300], ['10010', 300], ['01001', 300], ['10001', 280],
];

function lineStr(board, r, c, dr, dc, color) {
  let s = '';
  for (let i = -4; i <= 4; i++) {
    const nr = r + dr * i, nc = c + dc * i;
    if (!inBoard(nr, nc)) { s += '2'; continue; }
    if (i === 0) { s += '1'; continue; }
    const v = board[nr][nc];
    s += v === color ? '1' : v === 0 ? '0' : '2';
  }
  return s;
}

function dirScore(board, r, c, dr, dc, color) {
  const s = lineStr(board, r, c, dr, dc, color);
  for (let i = 0; i < PATTERNS.length; i++) if (s.includes(PATTERNS[i][0])) return PATTERNS[i][1];
  return 120;
}

function scoreAt(board, r, c, me) {
  const opp = me === 1 ? 2 : 1;
  let my = 0, op = 0, myT = 0, opT = 0;
  for (const [dr, dc] of DIRS) {
    const a = dirScore(board, r, c, dr, dc, me);
    const b = dirScore(board, r, c, dr, dc, opp);
    my += a; op += b;
    if (a >= 12000) myT++;
    if (b >= 12000) opT++;
  }
  if (myT >= 2) my *= 2.6;   // 双三/三四
  if (opT >= 2) op *= 2.6;
  const def = opT >= 1 ? 1.15 : 0.92;
  return my + op * def + (60 - (Math.abs(r - 7) + Math.abs(c - 7)) * 4);
}

function candidates(board) {
  const set = new Set();
  let any = false;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== 0) { any = true; continue; }
      let near = false;
      for (let dr = -2; dr <= 2 && !near; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const nr = r + dr, nc = c + dc;
          if (inBoard(nr, nc) && board[nr][nc] !== 0) { near = true; break; }
        }
      }
      if (near) set.add(r * SIZE + c);
    }
  }
  if (!any) return [[7, 7]];
  if (!set.size) for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!board[r][c]) set.add(r * SIZE + c);
  return [...set].map((v) => [Math.floor(v / SIZE), v % SIZE]);
}

function engineMove(board, me, noise = 0) {
  const opp = me === 1 ? 2 : 1;
  const cands = candidates(board);
  // 一步成五
  for (const [r, c] of cands) {
    board[r][c] = me;
    const w = findWinLine(board, r, c);
    board[r][c] = 0;
    if (w) return { row: r, col: c, score: 1e9 };
  }
  // 对手一步成五必堵
  for (const [r, c] of cands) {
    board[r][c] = opp;
    const w = findWinLine(board, r, c);
    board[r][c] = 0;
    if (w) return { row: r, col: c, score: 9e8 };
  }
  let best = null, bestScore = -Infinity;
  for (const [r, c] of cands) {
    let s = scoreAt(board, r, c, me);
    if (noise > 0) s += Math.random() * noise * 30000;
    if (s > bestScore) { bestScore = s; best = { row: r, col: c, score: s }; }
  }
  if (!best) for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!board[r][c]) return { row: r, col: c, score: 0 };
  return best;
}

function hintMoves(board, me, n = 5) {
  const s = candidates(board).map(([r, c]) => ({ r, c, s: scoreAt(board, r, c, me) }));
  s.sort((a, b) => b.s - a.s);
  return s.slice(0, n).map((x) => notate(x.r, x.c));
}

/* ============================================================
   3. Prompt 与解析
   ============================================================ */

function renderBoard(board) {
  let s = '     ' + COLS.split('').join(' ') + '\n';
  for (let r = 0; r < SIZE; r++) {
    s += String(r + 1).padStart(3, ' ') + '  ' + board[r].map((v) => (v === 1 ? 'X' : v === 2 ? 'O' : '.')).join(' ') + '\n';
  }
  return s;
}

function buildPrompt({ board, me, history, hint, withReason, illegalNote }) {
  const myName = me === 1 ? '黑棋 (X)' : '白棋 (O)';
  const opName = me === 1 ? '白棋 (O)' : '黑棋 (X)';
  const L = [];
  L.push('你在下五子棋（Gomoku / Five-in-a-Row），15x15 棋盘，标准无禁手规则。');
  L.push(`你执${myName}，对手执${opName}。`);
  L.push('坐标规则：列用字母 A-O（从左到右），行用数字 1-15（从上到下）。例如 H8 表示第 H 列第 8 行。');
  L.push('获胜条件：横、竖、斜任意方向连成 5 子（或更多）即获胜。');
  L.push('');
  L.push('当前棋盘（X=黑棋，O=白棋，.=空点）：');
  L.push(renderBoard(board));
  L.push(`着法历史（先手在前，最新一手在最后）：${history.length ? history.join(' ') : '（无，你是先手）'}`);
  L.push('');
  if (hint && hint.length) L.push(`参考：引擎算出的候选点有 ${hint.join('、')}，仅供你参考，最终落子由你自己判断。`);
  L.push('请按以下优先级检查（这是赢棋的关键）：');
  L.push('1. 我是否能立刻连成 5 子？能就直接落子获胜。');
  L.push('2. 对手是否已经 4 连、下一手就能成 5？是则必须堵住那个空点。');
  L.push('3. 对手是否有"活三"（两端都能延伸成 4 的三连）？是则优先封堵或抢占关键点。');
  L.push('4. 否则：做自己的活三/活四，抢占交叉点，控制中心区域。');
  L.push('');
  if (illegalNote) {
    L.push(`【重要】你上一次的回复无法使用：${illegalNote}。请重新选择一个空点（棋盘上显示为 . 的位置）。`);
    L.push('');
  }
  L.push('输出格式（严格遵守，除以下内容外不要输出任何文字）：');
  if (withReason) {
    L.push('REASON: 一句话说明你的判断（不超过 25 字）');
    L.push('MOVE: <列字母><行数字>');
    L.push('例如：');
    L.push('REASON: 堵住对手的活三');
    L.push('MOVE: H8');
  } else {
    L.push('MOVE: <列字母><行数字>');
    L.push('例如：');
    L.push('MOVE: H8');
  }
  return L.join('\n');
}

function parseMove(text, board) {
  if (!text) return null;
  const tries = [];
  const legal = (r, c) => inBoard(r, c) && board[r][c] === 0;
  const push = (r, c, source) => { if (legal(r, c)) tries.push({ row: r, col: c, source }); };
  const ci = (ch) => COLS.indexOf(String(ch).toUpperCase());

  const jsonRe = [
    [/^"move"/, /"move"\s*:\s*"([A-Oa-o])\s*[-_,]?\s*(\d{1,2})"/g],
    [/^"row"/, /"row"\s*:\s*(\d{1,2})\s*,\s*"col"\s*:\s*(\d{1,2})/g],
    [/^"col"/, /"col"\s*:\s*(\d{1,2})\s*,\s*"row"\s*:\s*(\d{1,2})/g],
    [/^"r"/, /"r"\s*:\s*(\d{1,2})\s*,\s*"c"\s*:\s*(\d{1,2})/g],
  ];
  for (const [t, re] of jsonRe) {
    let m;
    while ((m = re.exec(text)) !== null) {
      if (t.test('"move"')) push(Number(m[2]) - 1, ci(m[1]), 'json');
      else if (t.test('"row"')) push(Number(m[1]) - 1, Number(m[2]) - 1, 'json');
      else if (t.test('"col"')) push(Number(m[2]) - 1, Number(m[1]) - 1, 'json');
      else push(Number(m[1]) - 1, Number(m[2]) - 1, 'json');
    }
  }

  const reMove = /\bMOVE\b\s*[:=]?\s*(?:\[\s*)?([A-Oa-o])\s*[-_,]?\s*(\d{1,2})/gi;
  const h1 = []; let m1;
  while ((m1 = reMove.exec(text)) !== null) h1.push(m1);
  for (let k = h1.length - 1; k >= 0; k--) push(Number(h1[k][2]) - 1, ci(h1[k][1]), 'keyword');

  const reMoveNum = /\bMOVE\b\s*[:=]?\s*\(?\s*(\d{1,2})\s*[,，\s]\s*(\d{1,2})\s*\)?/gi;
  const h2 = []; let m2;
  while ((m2 = reMoveNum.exec(text)) !== null) h2.push(m2);
  for (let k = h2.length - 1; k >= 0; k--) push(Number(h2[k][1]) - 1, Number(h2[k][2]) - 1, 'keyword-num');

  const reBare = /\b([A-Oa-o])\s*[-_,]?\s*(\d{1,2})\b/g;
  const h3 = []; let m3;
  while ((m3 = reBare.exec(text)) !== null) {
    const rr = Number(m3[2]) - 1, cc = ci(m3[1]);
    if (rr >= 0 && rr < SIZE && cc >= 0) h3.push([rr, cc]);
  }
  for (let k = h3.length - 1; k >= 0; k--) push(h3[k][0], h3[k][1], 'bare');

  const reRev = /\b(\d{1,2})\s*[-_,]?\s*([A-Oa-o])\b/g;
  const h4 = []; let m4;
  while ((m4 = reRev.exec(text)) !== null) h4.push([Number(m4[1]) - 1, ci(m4[2])]);
  for (let k = h4.length - 1; k >= 0; k--) push(h4[k][0], h4[k][1], 'reversed');

  const rePair = /\(?\s*(\d{1,2})\s*[,，]\s*(\d{1,2})\s*\)?/g;
  const h5 = []; let m5;
  while ((m5 = rePair.exec(text)) !== null) h5.push([Number(m5[1]), Number(m5[2])]);
  for (let k = h5.length - 1; k >= 0; k--) { push(h5[k][0] - 1, h5[k][1] - 1, 'pair'); push(h5[k][0], h5[k][1], 'pair0'); }

  return tries.length ? tries[0] : null;
}

function illegalReason(text, board) {
  const m = /\b([A-Oa-o])\s*[-_,]?\s*(\d{1,2})\b/.exec(text || '');
  if (!m) return '没有找到任何符合格式的坐标';
  const c = COLS.indexOf(m[1].toUpperCase());
  const r = Number(m[2]) - 1;
  if (!inBoard(r, c)) return `坐标 ${m[0]} 超出棋盘范围（列 A-O，行 1-15）`;
  if (board[r][c] !== 0) return `坐标 ${m[0]} 已经有棋子了，只能落在空点上`;
  return '坐标不合法';
}

/* ============================================================
   4. 模型调用（浏览器直连）
   ============================================================ */

const isReasoning = (m = '') => /^(o\d|gpt-5|.*reasoner.*|.*thinking.*|.*-r1.*)/i.test(m);
const detectProtocol = (url = '') => (/anthropic\.com/i.test(url) ? 'anthropic' : 'openai');
const normBase = (u = '') => {
  let s = String(u).trim().replace(/\/+$/, '');
  if (!s) throw new Error('缺少 API 地址');
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  if (!/\/(v\d+|v\d+beta|openai)$/i.test(s)) s += '/v1';
  return s;
};

async function callModel(cfg, prompt, timeoutMs) {
  const messages = [
    { role: 'system', content: '你是一个冷静、精确的五子棋高手，只输出规定格式的内容，绝不输出多余解释。' },
    { role: 'user', content: prompt },
  ];
  const protocol = cfg.protocol === 'anthropic' ? 'anthropic' : detectProtocol(cfg.baseUrl);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let url, body, headers;
    if (protocol === 'anthropic') {
      url = normBase(cfg.baseUrl) + '/messages';
      headers = { 'Content-Type': 'application/json', 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
      body = {
        model: cfg.model,
        system: messages[0].content,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4096,
      };
      if (!isReasoning(cfg.model)) body.temperature = cfg.temperature;
    } else {
      url = normBase(cfg.baseUrl) + '/chat/completions';
      headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.apiKey };
      body = { model: cfg.model, messages, stream: false };
      if (isReasoning(cfg.model)) body.max_completion_tokens = 4096;
      else { body.max_tokens = 1024; body.temperature = cfg.temperature; }
    }
    const resp = await fetch(url, { method: 'POST', signal: ctrl.signal, headers, body: JSON.stringify(body) });
    const text = await resp.text();
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText} :: ${text.slice(0, 200)}`);
    const data = JSON.parse(text);
    let content = '';
    if (protocol === 'anthropic') {
      if (Array.isArray(data?.content)) content = data.content.map((x) => (x?.type === 'text' ? x.text : '')).join('\n');
      else if (typeof data?.content === 'string') content = data.content;
    } else {
      const msg = data?.choices?.[0]?.message;
      if (typeof msg?.content === 'string') content = msg.content;
      else if (Array.isArray(msg?.content)) content = msg.content.map((x) => (typeof x === 'string' ? x : x?.text || '')).join('\n');
      else if (typeof data?.output_text === 'string') content = data.output_text;
    }
    return { content: content.trim(), usage: data?.usage || null };
  } finally {
    clearTimeout(timer);
  }
}

/** 一次落子：含重试 + 兜底，返回 { move, notation, reason, raw, source, warn, ms } */
async function think(cfg, opts) {
  const t0 = Date.now();
  const board = state.board;
  const me = state.turn;

  if (cfg.protocol === 'local') {
    const mv = engineMove(board, me, cfg.noise || 0);
    return { move: mv, notation: notate(mv.row, mv.col), reason: `内置引擎评分 ${Math.round(mv.score)}`, raw: '', source: 'engine', ms: Date.now() - t0 };
  }

  const timeoutMs = Math.max(10, Math.min(300, Number(opts.timeout) || 60)) * 1000;
  let illegalNote = null;
  let lastErr = null;
  let fatal = null;

  for (let attempt = 0; attempt <= 1; attempt++) {
    const prompt = buildPrompt({
      board, me,
      history: state.history.map((h) => `${h.who === 1 ? 'X' : 'O'}:${notate(h.row, h.col)}`),
      hint: opts.useHint ? hintMoves(board, me, 5) : null,
      withReason: opts.withReason !== false,
      illegalNote,
    });
    let out;
    try {
      out = await callModel({ ...cfg, temperature: cfg.temperature, protocol: cfg.protocol }, prompt, timeoutMs);
    } catch (e) {
      lastErr = e.name === 'AbortError' ? `请求超时（${timeoutMs / 1000}s）` : friendlyError(e);
      // 4xx 重试无意义；CORS 失败同样无需重试
      if (/^HTTP 4\d\d/.test(lastErr) || /跨域|CORS|Failed to fetch|NetworkError/i.test(lastErr)) { fatal = lastErr; break; }
      continue;
    }
    const parsed = parseMove(out.content, board);
    if (parsed) {
      const rm = /REASON\s*[:：]\s*(.+)/i.exec(out.content);
      return {
        move: parsed, notation: notate(parsed.row, parsed.col),
        reason: rm ? rm[1].trim().slice(0, 80) : '',
        raw: out.content.slice(0, 400), usage: out.usage,
        source: 'model', ms: Date.now() - t0,
      };
    }
    illegalNote = illegalReason(out.content, board);
    lastErr = `模型输出无法解析为合法落点（${illegalNote}）`;
  }

  if (fatal) {
    const err = new Error(fatal);
    err.fatal = true;
    throw err;
  }
  // 模型能连通但输出不可用 → 内置引擎兜底，保证对局继续
  const mv = engineMove(board, me, 0);
  return {
    move: mv, notation: notate(mv.row, mv.col), reason: '', raw: lastErr || '',
    source: 'fallback', warn: `${lastErr}，已由内置引擎兜底落子`, ms: Date.now() - t0,
  };
}

function friendlyError(e) {
  const msg = e.message || '';
  if (/Failed to fetch|NetworkError|Load failed|TypeError/i.test(msg)) {
    return '请求被浏览器拦截或网络不可达（多数是对方接口未开放跨域 CORS，也可能是地址填错）';
  }
  return msg;
}

/* ============================================================
   5. 状态与棋盘渲染
   ============================================================ */

const state = {
  mode: null, board: emptyBoard(), history: [], turn: 1,
  playing: false, aborted: false, waiting: false,
  humanColor: 1, winner: null, winLine: null, lastMove: null,
  pending: null, hover: null,
  series: 1, gameIndex: 1, scores: { a: 0, b: 0 }, blackSide: 'a',
  aiCfg: null, aiLabel: '', cfgA: null, cfgB: null,
};

const canvas = $('board');
const ctx = canvas.getContext('2d');
let geom = { pad: 18, cell: 30, w: 480 };

function layoutBoard() {
  const w = Math.max(260, Math.min(canvas.parentElement.clientWidth || 560, 580));
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  canvas.style.width = w + 'px';
  canvas.style.height = w + 'px';
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(w * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const pad = Math.max(15, w * 0.052);
  geom = { pad, cell: (w - pad * 2) / (SIZE - 1), w };
}

const pt = (r, c) => ({ x: geom.pad + c * geom.cell, y: geom.pad + r * geom.cell });

function draw() {
  const w = geom.w, { pad, cell } = geom;
  ctx.clearRect(0, 0, w, w);
  ctx.fillStyle = '#FBF9F2';
  ctx.fillRect(0, 0, w, w);
  const end = pad + cell * (SIZE - 1);

  ctx.strokeStyle = 'rgba(31,30,29,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < SIZE; i++) {
    const p = pad + i * cell;
    ctx.moveTo(pad, p); ctx.lineTo(end, p);
    ctx.moveTo(p, pad); ctx.lineTo(p, end);
  }
  ctx.stroke();

  ctx.strokeStyle = 'rgba(31,30,29,0.42)';
  ctx.lineWidth = 1.4;
  ctx.strokeRect(pad, pad, end - pad, end - pad);

  ctx.fillStyle = 'rgba(31,30,29,0.4)';
  for (const [sr, sc] of [[3, 3], [3, 11], [11, 3], [11, 11], [7, 7]]) {
    const { x, y } = pt(sr, sc);
    ctx.beginPath(); ctx.arc(x, y, Math.max(2, cell * 0.075), 0, Math.PI * 2); ctx.fill();
  }

  ctx.fillStyle = 'rgba(31,30,29,0.45)';
  ctx.font = `${Math.max(9, Math.min(11, cell * 0.42))}px "Noto Serif SC", serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < SIZE; i++) {
    const p = pad + i * cell;
    ctx.fillText(COLS[i], p, pad - cell * 0.52);
    ctx.fillText(String(i + 1), pad - cell * 0.6, p);
  }

  const preview = state.pending || state.hover;
  if (preview && state.playing && !state.waiting && state.board[preview.r][preview.c] === 0) {
    const { x, y } = pt(preview.r, preview.c);
    ctx.globalAlpha = state.pending ? 0.55 : 0.25;
    stone(x, y, cell * 0.44, state.turn);
    ctx.globalAlpha = 1;
    if (state.pending) {
      ctx.strokeStyle = '#D97757'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, cell * 0.46, 0, Math.PI * 2); ctx.stroke();
    }
  }

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!state.board[r][c]) continue;
      const { x, y } = pt(r, c);
      stone(x, y, cell * 0.44, state.board[r][c]);
    }
  }

  if (state.lastMove) {
    const { x, y } = pt(state.lastMove.row, state.lastMove.col);
    ctx.strokeStyle = state.lastMove.who === 1 ? '#D97757' : '#6A9BCC';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, cell * 0.2, 0, Math.PI * 2); ctx.stroke();
  }

  if (state.winLine && state.winLine.length) {
    const a = pt(state.winLine[0][0], state.winLine[0][1]);
    const b = pt(state.winLine[state.winLine.length - 1][0], state.winLine[state.winLine.length - 1][1]);
    ctx.save();
    ctx.strokeStyle = '#C8894A'; ctx.lineWidth = Math.max(3, cell * 0.12); ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(200,137,74,.6)'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.restore();
  }
}

function stone(x, y, r, who) {
  const g = ctx.createRadialGradient(x - r * 0.34, y - r * 0.38, r * 0.12, x, y, r);
  if (who === 1) { g.addColorStop(0, '#6B6459'); g.addColorStop(0.45, '#2A2723'); g.addColorStop(1, '#0E0D0B'); }
  else { g.addColorStop(0, '#fff'); g.addColorStop(0.5, '#F2EFE8'); g.addColorStop(1, '#C9C3B7'); }
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = who === 1 ? 'rgba(0,0,0,.45)' : 'rgba(31,30,29,.28)';
  ctx.lineWidth = 1; ctx.stroke();
}

function eventToCell(ev) {
  const rect = canvas.getBoundingClientRect();
  const x = (ev.clientX - rect.left) * (geom.w / rect.width);
  const y = (ev.clientY - rect.top) * (geom.w / rect.width);
  const c = Math.round((x - geom.pad) / geom.cell);
  const r = Math.round((y - geom.pad) / geom.cell);
  if (!inBoard(r, c)) return null;
  const p = pt(r, c);
  if (Math.hypot(x - p.x, y - p.y) > geom.cell * 0.55) return null;
  return { r, c };
}

canvas.addEventListener('pointerdown', (ev) => {
  if (!state.playing || state.mode !== 'pve' || state.waiting || state.turn !== state.humanColor) return;
  const cell = eventToCell(ev);
  if (!cell) return;
  if (state.board[cell.r][cell.c] !== 0) { state.pending = null; draw(); return; }
  if (!state.pending || state.pending.r !== cell.r || state.pending.c !== cell.c) {
    state.pending = cell; draw(); return;   // 移动端两步确认
  }
  state.pending = null;
  humanPlay(cell.r, cell.c);
});

canvas.addEventListener('pointermove', (ev) => {
  if (ev.pointerType !== 'mouse') return;
  if (!state.playing || state.mode !== 'pve' || state.waiting || state.turn !== state.humanColor) { state.hover = null; return; }
  const cell = eventToCell(ev);
  state.hover = cell && state.board[cell.r][cell.c] === 0 ? cell : null;
  draw();
});
canvas.addEventListener('pointerleave', () => { state.hover = null; draw(); });

/* ============================================================
   6. 显示
   ============================================================ */

const other = (s) => (s === 'a' ? 'b' : 'a');
function sideName(s) {
  if (state.mode === 'pvp') return s === 'a' ? (state.cfgA?.label || '模型 A') : (state.cfgB?.label || '模型 B');
  return s === 'a' ? '你' : state.aiLabel;
}

function updateTurn() {
  const chip = $('turnChip');
  chip.classList.remove('is-black', 'is-white', 'is-thinking');
  if (!state.playing) { $('turnText').textContent = '尚未开始'; return; }
  if (state.waiting) {
    chip.classList.add('is-thinking', state.turn === 1 ? 'is-black' : 'is-white');
    $('turnText').textContent = state.mode === 'pve' ? 'AI 思考中…' : `${sideName(state.turn === 1 ? state.blackSide : other(state.blackSide))} 思考中…`;
    return;
  }
  chip.classList.add(state.turn === 1 ? 'is-black' : 'is-white');
  $('turnText').textContent = state.mode === 'pve'
    ? (state.turn === state.humanColor ? `轮到你（${state.turn === 1 ? '黑' : '白'}）` : 'AI 回合')
    : `${sideName(state.turn === 1 ? state.blackSide : other(state.blackSide))}（${state.turn === 1 ? '黑' : '白'}）`;
}

function updateMeta() {
  const p = [`第 ${state.history.length} 手`, '15×15 无禁手'];
  if (state.mode === 'pvp' && state.series === 3) p.unshift(`第 ${state.gameIndex} 局`);
  $('metaInfo').textContent = p.join(' · ');
}

function updateScore() {
  if (state.mode === 'pvp') {
    $('scoreAName').textContent = state.cfgA?.label || '模型 A';
    $('scoreBName').textContent = state.cfgB?.label || '模型 B';
    $('scoreA').hidden = $('scoreB').hidden = $('scoreSep').hidden = false;
    $('scoreA').textContent = state.scores.a;
    $('scoreB').textContent = state.scores.b;
  } else {
    $('scoreAName').textContent = '你';
    $('scoreBName').textContent = state.aiLabel || 'AI';
    $('scoreA').hidden = $('scoreB').hidden = $('scoreSep').hidden = true;
  }
}

function addLog({ type = '', side = '', move = '', note = '', time = '' }) {
  const box = $('log');
  const e0 = box.querySelector('.log-empty');
  if (e0) e0.remove();
  const el = document.createElement('div');
  el.className = 'log-item' + (type ? ' ' + type : '') + (side === 'b' ? ' side-b' : '');
  el.innerHTML = `<div class="log-head"><span class="log-move">${move}</span>${time ? `<span class="log-time">${time}</span>` : ''}</div>${note ? `<div class="log-note">${note}</div>` : ''}`;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}

function showOverlay({ icon, title, desc, primary, secondary }) {
  $('ovIcon').textContent = icon;
  $('ovTitle').textContent = title;
  $('ovDesc').textContent = desc;
  $('ovPrimary').textContent = primary.text;
  $('ovPrimary').onclick = primary.onClick;
  if (secondary) {
    $('ovSecondary').hidden = false;
    $('ovSecondary').textContent = secondary.text;
    $('ovSecondary').onclick = secondary.onClick;
  } else $('ovSecondary').hidden = true;
  $('overlay').classList.add('show');
}
const hideOverlay = () => $('overlay').classList.remove('show');

/* ============================================================
   7. 对局流程
   ============================================================ */

function resetBoard() {
  state.board = emptyBoard();
  state.history = [];
  state.winner = null;
  state.winLine = null;
  state.lastMove = null;
  state.pending = null;
  state.hover = null;
  state.turn = 1;
  updateMeta();
  draw();
}

function applyMove(r, c, who) {
  state.board[r][c] = who;
  state.history.push({ row: r, col: c, who });
  state.lastMove = { row: r, col: c, who };
  const line = findWinLine(state.board, r, c);
  if (line) state.winLine = line;
  updateMeta();
  draw();
}

function checkEnd() {
  if (state.winLine) {
    endGame(state.board[state.winLine[0][0]][state.winLine[0][1]], `，共 ${state.history.length} 手`);
    return true;
  }
  if (boardFull(state.board)) { endGame('draw'); return true; }
  return false;
}

function endGame(winner, extra = '') {
  state.playing = false;
  state.waiting = false;
  state.winner = winner;
  $('btnStopPve').hidden = $('btnStopPvp').hidden = true;
  $('btnStartPve').hidden = $('btnStartPvp').hidden = false;
  $('btnUndo').disabled = true;
  updateTurn();

  if (state.mode === 'pve') {
    let icon = '🏆', title, desc;
    if (winner === state.humanColor) { title = '你赢了'; desc = `击败 ${state.aiLabel}${extra}`; }
    else if (winner === 'draw') { icon = '🤝'; title = '平局'; desc = '棋盘已满，和棋'; }
    else { icon = '🤖'; title = 'AI 获胜'; desc = `${state.aiLabel} 赢下这局${extra}`; }
    showOverlay({ icon, title, desc, primary: { text: '再来一局', onClick: () => { hideOverlay(); startPve(); } }, secondary: { text: '关闭', onClick: hideOverlay } });
  } else {
    const winSide = winner === 'draw' ? null : (winner === 1 ? state.blackSide : other(state.blackSide));
    let icon = '🏆', title, desc;
    if (winner === 'draw') { icon = '🤝'; title = '平局'; desc = '棋盘已满，和棋'; }
    else { title = `${sideName(winSide)} 获胜`; desc = `执${winner === 1 ? '黑' : '白'}取胜${extra}`; }
    showOverlay({ icon, title, desc, primary: { text: '再来一局', onClick: () => { hideOverlay(); startSeries(); } }, secondary: { text: '关闭', onClick: hideOverlay } });
  }
}

function failGame(msg) {
  state.playing = false;
  state.waiting = false;
  $('btnStopPve').hidden = $('btnStopPvp').hidden = true;
  $('btnStartPve').hidden = $('btnStartPvp').hidden = false;
  updateTurn();
  showOverlay({ icon: '⚠️', title: '对局中断', desc: msg, primary: { text: '知道了', onClick: hideOverlay } });
}

/* ---- 人机 ---- */

function cfgOf(kind) {
  if (kind === 'pve') {
    const proto = protocolOf('pve');
    const model = $('pveModel').value.trim();
    return {
      protocol: proto,
      baseUrl: $('pveBase').value.trim(),
      apiKey: $('pveKey').value.trim(),
      model,
      temperature: Number($('pveTemp').value),
      noise: proto === 'local' ? (1 - Number($('pveStrength').value) / 100) * 1.2 : 0,
      label: proto === 'local' ? '内置引擎' : (model || '未命名模型'),
    };
  }
  const s = kind === 'pvpA' ? 'A' : 'B';
  const model = $('pvpModel' + s).value.trim();
  const base = $('pvpBase' + s).value.trim();
  const proto = detectProtocol(base);
  return {
    protocol: proto,
    baseUrl: base,
    apiKey: $('pvpKey' + s).value.trim(),
    model,
    temperature: $('pvpTempToggle').checked ? 0.6 : 0,
    noise: 0,
    label: model || (s === 'A' ? '模型 A' : '模型 B'),
  };
}

let protocolMap = { pve: 'openai' };
const protocolOf = (k) => protocolMap[k] || 'openai';

async function startPve() {
  state.mode = 'pve';
  const cfg = cfgOf('pve');
  state.aiCfg = cfg;
  state.aiLabel = cfg.label;
  state.humanColor = Number(document.querySelector('#segColor .is-active').dataset.val);
  resetBoard();
  updateScore();
  state.playing = true;
  state.aborted = false;
  $('btnStartPve').hidden = true;
  $('btnStopPve').hidden = false;
  $('btnUndo').disabled = true;
  addLog({ type: 'sys', move: '开局', note: `人机对战：你执${state.humanColor === 1 ? '黑' : '白'}，对手 <code>${esc(state.aiLabel)}</code>` });
  updateTurn();
  if (state.turn !== state.humanColor) await aiTurn();
}

async function humanPlay(r, c) {
  if (!state.playing || state.board[r][c] !== 0) return;
  applyMove(r, c, state.humanColor);
  const n = state.history.length;
  addLog({ move: `${n}. ${notate(r, c)}`, note: '你落子' });
  if (checkEnd()) return;
  state.turn = state.humanColor === 1 ? 2 : 1;
  updateTurn();
  await aiTurn();
}

async function aiTurn() {
  if (!state.playing || state.aborted) return;
  const aiColor = state.humanColor === 1 ? 2 : 1;
  state.turn = aiColor;
  state.waiting = true;
  updateTurn();
  draw();
  try {
    const d = await think(state.aiCfg, {
      timeout: $('pveTime').value,
      useHint: $('pveHint').checked,
      withReason: $('pveReason').checked,
    });
    if (state.aborted) return;
    state.waiting = false;
    const n = state.history.length + 1;
    applyMove(d.move.row, d.move.col, aiColor);
    addLog({ side: 'b', move: `${n}. ${d.notation}`, note: noteOf(d), time: `${(d.ms / 1000).toFixed(1)}s` });
    if (d.source === 'fallback') addLog({ type: 'warn', move: '兜底', note: d.warn });
    if (checkEnd()) return;
    state.turn = state.humanColor;
    $('btnUndo').disabled = state.history.length < 2;
    updateTurn();
    draw();
  } catch (e) {
    state.waiting = false;
    addLog({ type: 'err', move: '错误', note: esc(e.message) });
    failGame(e.message);
  }
}

function noteOf(d) {
  const b = [];
  if (d.reason) b.push(esc(d.reason));
  const raw = (d.raw || '').replace(/\s+/g, ' ').slice(0, 150);
  if (raw && raw !== d.reason) b.push(`<code>${esc(raw)}</code>`);
  if (d.usage?.total_tokens) b.push(`tokens ${d.usage.total_tokens}`);
  return b.join(' · ');
}

async function undo() {
  if (state.mode !== 'pve' || !state.playing || state.waiting || state.history.length < 2) return;
  for (let i = 0; i < 2; i++) {
    const last = state.history.pop();
    state.board[last.row][last.col] = 0;
  }
  state.lastMove = state.history.length ? { ...state.history[state.history.length - 1] } : null;
  state.winLine = null;
  state.turn = state.humanColor;
  state.pending = null;
  $('btnUndo').disabled = state.history.length < 2;
  updateMeta(); updateTurn(); draw();
  addLog({ type: 'sys', move: '悔棋', note: `回到第 ${state.history.length} 手` });
}

/* ---- 模型对战 ---- */

async function startSeries() {
  state.mode = 'pvp';
  state.cfgA = cfgOf('pvpA');
  state.cfgB = cfgOf('pvpB');
  state.series = Number(document.querySelector('#segSeries .is-active').dataset.val);
  state.scores = { a: 0, b: 0 };
  state.gameIndex = 1;
  state.blackSide = Math.random() < 0.5 ? 'a' : 'b';
  state.aborted = false;
  $('btnStartPvp').hidden = true;
  $('btnStopPvp').hidden = false;
  $('btnUndo').disabled = true;
  updateScore();
  addLog({
    type: 'sys',
    move: state.series === 3 ? '三局两胜' : '单局对战',
    note: `<code>${esc(state.cfgA.label)}</code> vs <code>${esc(state.cfgB.label)}</code> · 第 1 局 ${esc(sideName(state.blackSide))} 执黑`,
  });

  while (state.gameIndex <= state.series && !state.aborted) {
    await runGame();
    if (state.aborted) return;
    tally();
    if (state.series === 1) return;                       // 单局：runGame 内已弹结算
    if (state.scores.a >= 2 || state.scores.b >= 2) break;
    state.gameIndex++;
    state.blackSide = other(state.blackSide);
    if ($('pvpAutoNext').checked) { hideOverlay(); await sleep(1500); }
    else {
      showOverlay({
        icon: '⚖️', title: `第 ${state.gameIndex} 局`,
        desc: `当前比分 ${state.scores.a}:${state.scores.b} · 本局 ${sideName(state.blackSide)} 执黑`,
        primary: { text: '开始下一局', onClick: () => { hideOverlay(); runGame().then(() => { tally(); nextOrFinish(); }); } },
        secondary: { text: '结束系列赛', onClick: () => { state.aborted = true; hideOverlay(); finishSeries(); } },
      });
      return;
    }
  }
  finishSeries();
}

function tally() {
  if (state.winner === 'draw' || !state.winner) {
    addLog({ type: 'sys', move: `第 ${state.gameIndex} 局结束`, note: `和棋 · 比分 ${state.scores.a}:${state.scores.b}` });
    return;
  }
  const winSide = state.winner === 1 ? state.blackSide : other(state.blackSide);
  state.scores[winSide]++;
  updateScore();
  addLog({ type: 'sys', move: `第 ${state.gameIndex} 局结束`, note: `${esc(sideName(winSide))} 胜 · 比分 ${state.scores.a}:${state.scores.b}` });
}

function nextOrFinish() {
  if (state.aborted) return;
  if (state.scores.a >= 2 || state.scores.b >= 2 || state.gameIndex >= state.series) { finishSeries(); return; }
  state.gameIndex++;
  state.blackSide = other(state.blackSide);
  showOverlay({
    icon: '⚖️', title: `第 ${state.gameIndex} 局`,
    desc: `当前比分 ${state.scores.a}:${state.scores.b} · 本局 ${sideName(state.blackSide)} 执黑`,
    primary: { text: '开始下一局', onClick: () => { hideOverlay(); runGame().then(() => { tally(); nextOrFinish(); }); } },
    secondary: { text: '结束系列赛', onClick: () => { state.aborted = true; hideOverlay(); finishSeries(); } },
  });
}

function finishSeries() {
  state.playing = false;
  state.waiting = false;
  $('btnStopPvp').hidden = true;
  $('btnStartPvp').hidden = false;
  updateTurn();
  const A = state.cfgA?.label || '模型 A';
  const B = state.cfgB?.label || '模型 B';
  let icon = '🏆', title, desc;
  if (state.scores.a > state.scores.b) { title = `${A} 赢得系列赛`; desc = `总比分 ${state.scores.a} : ${state.scores.b}`; }
  else if (state.scores.b > state.scores.a) { title = `${B} 赢得系列赛`; desc = `总比分 ${state.scores.b} : ${state.scores.a}`; }
  else { icon = '🤝'; title = '系列赛打平'; desc = `总比分 ${state.scores.a} : ${state.scores.b}`; }
  addLog({ type: 'sys', move: '系列赛结束', note: `${esc(title)} · ${desc}` });
  showOverlay({ icon, title, desc, primary: { text: '再来一轮', onClick: () => { hideOverlay(); startSeries(); } }, secondary: { text: '关闭', onClick: hideOverlay } });
}

async function runGame() {
  resetBoard();
  state.playing = true;
  state.waiting = false;
  updateTurn();
  const delay = Number($('pvpDelay').value) * 1000;
  const opts = { timeout: $('pvpTime').value, useHint: $('pvpHint').checked, withReason: $('pvpReason').checked };
  let guard = 0;
  while (state.playing && !state.aborted && guard++ < 225) {
    const side = state.turn === 1 ? state.blackSide : other(state.blackSide);
    const cfg = side === 'a' ? state.cfgA : state.cfgB;
    state.waiting = true;
    updateTurn();
    draw();
    let d;
    try {
      d = await think(cfg, opts);
    } catch (e) {
      state.waiting = false;
      addLog({ type: 'err', move: '错误', note: `${esc(sideName(side))}：${esc(e.message)}` });
      failGame(`${sideName(side)} 请求失败：${e.message}`);
      return;
    }
    if (state.aborted) { state.waiting = false; return; }
    state.waiting = false;
    const n = state.history.length + 1;
    applyMove(d.move.row, d.move.col, state.turn);
    addLog({ side, move: `${n}. ${d.notation}`, note: noteOf(d), time: `${(d.ms / 1000).toFixed(1)}s` });
    if (d.source === 'fallback') addLog({ type: 'warn', move: '兜底', note: `${esc(sideName(side))}：${esc(d.warn || '')}` });
    if (checkEnd()) return;
    state.turn = state.turn === 1 ? 2 : 1;
    updateTurn();
    if (delay > 0) await sleep(delay);
  }
}

/* ============================================================
   8. UI
   ============================================================ */

const LS = 'qiyitai-config-v1';
let saveReady = false;

function save() {
  if (!saveReady) return;
  const d = {
    pvePreset: $('pvePreset').value, pveModel: $('pveModel').value, pveBase: $('pveBase').value, pveKey: $('pveKey').value,
    pvpModelA: $('pvpModelA').value, pvpBaseA: $('pvpBaseA').value, pvpKeyA: $('pvpKeyA').value,
    pvpModelB: $('pvpModelB').value, pvpBaseB: $('pvpBaseB').value, pvpKeyB: $('pvpKeyB').value,
    color: document.querySelector('#segColor .is-active')?.dataset.val,
    series: document.querySelector('#segSeries .is-active')?.dataset.val,
    pveTemp: $('pveTemp').value, pveTime: $('pveTime').value, pveStrength: $('pveStrength').value,
    pvpDelay: $('pvpDelay').value, pvpTime: $('pvpTime').value, pvpStrength: $('pvpStrength').value,
    pveHint: $('pveHint').checked, pveReason: $('pveReason').checked,
    pvpHint: $('pvpHint').checked, pvpReason: $('pvpReason').checked,
    pvpAutoNext: $('pvpAutoNext').checked, pvpTempToggle: $('pvpTempToggle').checked,
  };
  try { localStorage.setItem(LS, JSON.stringify(d)); } catch { /* 隐私模式忽略 */ }
}

const RANGES = [
  ['pveTemp', 'pveTempOut', (v) => v],
  ['pveTime', 'pveTimeOut', (v) => v + 's'],
  ['pveStrength', 'pveStrengthOut', (v) => v + '%'],
  ['pvpDelay', 'pvpDelayOut', (v) => Number(v).toFixed(1) + 's'],
  ['pvpTime', 'pvpTimeOut', (v) => v + 's'],
  ['pvpStrength', 'pvpStrengthOut', (v) => v + '%'],
];
const syncOut = () => RANGES.forEach(([id, out, f]) => { $(out).textContent = f($(id).value); });

function applyPreset(id, fillDefaults, silent) {
  const p = window.PROVIDERS.find((x) => x.id === id);
  if (!p) return;
  protocolMap.pve = p.protocol;
  if (fillDefaults) {
    $('pveBase').value = p.baseUrl || '';
    $('pveModel').value = p.model || '';
  }
  const local = p.protocol === 'local';
  $('pveBase').disabled = local;
  $('pveModel').disabled = local;
  $('pveKey').disabled = local;
  $('pveKey').placeholder = local ? '无需密钥' : 'sk-...';
  if (saveReady) save();
  if (!silent && p.tip) addLog({ type: 'sys', move: p.name, note: p.tip });
}

async function testConn(kind, btn) {
  const cfg = cfgOf(kind);
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = '测试中…';
  try {
    if (cfg.protocol === 'local') {
      addLog({ type: 'sys', move: '内置引擎', note: '无需联网，可直接使用' });
    } else if (!cfg.apiKey || !cfg.model || !cfg.baseUrl) {
      addLog({ type: 'err', move: '测试连接', note: '请先填全 模型名称 / API 地址 / 密钥' });
    } else {
      const t0 = Date.now();
      const out = await callModel({ ...cfg, protocol: cfg.protocol }, 'Reply with exactly: PONG', 30000);
      addLog({ type: 'sys', move: '连接成功', note: `<code>${esc(cfg.model)}</code> 响应正常（${((Date.now() - t0) / 1000).toFixed(1)}s）：${esc((out.content || '').slice(0, 60))}` });
    }
  } catch (e) {
    addLog({ type: 'err', move: '连接失败', note: `<code>${esc(cfg.model || '')}</code> ${esc(friendlyError(e))}` });
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
}

function init() {
  // 预设下拉
  $('pvePreset').innerHTML = window.PROVIDERS.map((p) => `<option value="${p.id}">${p.name}</option>`).join('');
  $('pvePreset').addEventListener('change', () => { applyPreset($('pvePreset').value, true, false); });

  // 支持用网址参数预填（如 ?base=...&model=...&key=...），便于把配置做成一条链接带走
  const qs = new URLSearchParams(location.search);
  const qBase = qs.get('base'), qModel = qs.get('model'), qKey = qs.get('key');
  let prefilled = false;
  if (qBase || qModel || qKey) {
    prefilled = true;
    if (qBase) { $('pveBase').value = qBase; $('pvpBaseA').value = qBase; $('pvpBaseB').value = qBase; }
    if (qModel) { $('pveModel').value = qModel; $('pvpModelA').value = qModel; $('pvpModelB').value = qModel; }
    if (qKey) { $('pveKey').value = qKey; $('pvpKeyA').value = qKey; $('pvpKeyB').value = qKey; }
    const hit = window.PROVIDERS.find((p) => p.baseUrl && qBase && p.baseUrl.replace(/\/+$/, '') === qBase.replace(/\/+$/, ''));
    if (hit) { $('pvePreset').value = hit.id; protocolMap.pve = hit.protocol; }
    else { $('pvePreset').value = 'custom'; protocolMap.pve = 'openai'; }
    history.replaceState(null, '', location.pathname);   // 用后即清，密钥不留在地址栏
  }

  const models = new Set();
  window.PROVIDERS.forEach((p) => (p.models || []).forEach((m) => models.add(m)));
  $('modelList').innerHTML = [...models].map((m) => `<option value="${m}"></option>`).join('');

  // 读取本地配置
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(LS) || '{}'); } catch { saved = {}; }
  $('pvePreset').value = saved.pvePreset || 'agnes';
  applyPreset($('pvePreset').value, !saved.pvePreset, true);
  ['pveModel', 'pveBase', 'pveKey', 'pvpModelA', 'pvpBaseA', 'pvpKeyA', 'pvpModelB', 'pvpBaseB', 'pvpKeyB',
    'pveTemp', 'pveTime', 'pveStrength', 'pvpDelay', 'pvpTime', 'pvpStrength'].forEach((id) => {
    if (saved[id] != null) $(id).value = saved[id];
  });
  ['pveHint', 'pveReason', 'pvpHint', 'pvpReason', 'pvpAutoNext', 'pvpTempToggle'].forEach((id) => {
    if (saved[id] != null) $(id).checked = !!saved[id];
  });
  if (saved.color) document.querySelectorAll('#segColor .seg-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.val === saved.color));
  if (saved.series === '3') {
    document.querySelectorAll('#segSeries .seg-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.val === '3'));
    $('seriesHint').textContent = '三局两胜：每局交换先后手，先赢 2 局者获胜';
  }
  syncOut();
  saveReady = true;
  if (prefilled) save();   // 网址带进来的配置立即落盘，下次打开仍可用

  // Tab
  document.querySelector('.tabs').addEventListener('click', (e) => {
    const b = e.target.closest('.tab');
    if (!b) return;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t === b));
    document.querySelectorAll('.panel[data-panel]').forEach((p) => p.classList.toggle('is-active', p.dataset.panel === b.dataset.tab));
    requestAnimationFrame(() => { layoutBoard(); draw(); });
  });

  // 分段控件
  const seg = (wrap, cb) => $(wrap).addEventListener('click', (e) => {
    const b = e.target.closest('.seg-btn');
    if (!b) return;
    [...$(wrap).querySelectorAll('.seg-btn')].forEach((x) => x.classList.toggle('is-active', x === b));
    cb && cb(b.dataset.val);
    save();
  });
  seg('segColor');
  seg('segSeries', (v) => {
    $('seriesHint').textContent = v === '3' ? '三局两胜：每局交换先后手，先赢 2 局者获胜' : '单局：随机决定先后手';
  });

  // 按钮
  $('btnStartPve').onclick = () => { hideOverlay(); startPve(); };
  $('btnStartPvp').onclick = () => { hideOverlay(); startSeries(); };
  $('btnStopPve').onclick = stop;
  $('btnStopPvp').onclick = stop;
  $('btnUndo').onclick = undo;
  $('btnResign').onclick = () => {
    if (!state.playing) return;
    if (state.mode === 'pve') endGame(state.humanColor === 1 ? 2 : 1, '（你认输了）');
    else endGame(state.turn === 1 ? 2 : 1, `（${sideName(state.turn === 1 ? state.blackSide : other(state.blackSide))} 认输）`);
  };
  $('btnClearLog').onclick = () => { $('log').innerHTML = '<div class="log-empty">开始一局后，每一手的落点、理由与耗时会显示在这里。</div>'; };
  $('btnTestPve').onclick = (e) => testConn('pve', e.target);
  $('btnTestA').onclick = (e) => testConn('pvpA', e.target);
  $('btnTestB').onclick = (e) => testConn('pvpB', e.target);

  document.querySelectorAll('[data-eye]').forEach((b) => {
    b.onclick = () => {
      const i = $(b.dataset.eye);
      const show = i.type === 'password';
      i.type = show ? 'text' : 'password';
      b.textContent = show ? '隐藏' : '显示';
    };
  });

  RANGES.forEach(([id, out, f]) => $(id).addEventListener('input', () => { $(out).textContent = f($(id).value); save(); }));
  document.querySelectorAll('.input').forEach((el) => el.addEventListener('change', save));
  document.querySelectorAll('.check input').forEach((el) => el.addEventListener('change', save));

  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { layoutBoard(); draw(); }, 120); });

  layoutBoard();
  draw();
  updateTurn();
  updateMeta();
}

function stop() {
  state.aborted = true;
  state.playing = false;
  state.waiting = false;
  $('btnStopPve').hidden = $('btnStopPvp').hidden = true;
  $('btnStartPve').hidden = $('btnStartPvp').hidden = false;
  updateTurn();
  addLog({ type: 'sys', move: '已停止', note: '对局被手动终止' });
}

init();
