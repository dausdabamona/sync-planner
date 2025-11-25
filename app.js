/* app.js
   Versi: 1.0
   Fungsi utama:
   - Tab switching
   - Checklist toggle + progress (localStorage)
   - Pomodoro timer (modes, start/pause/reset/skip), ring update
   - Kanban board CRUD + drag & drop + localStorage
   - Pairwise options add/compare + results + matrix
   - PWA install banner handling + service worker register placeholder
   - Minimal Google Sheets sync placeholder (implement backend later)
*/

/* ========== Utility ========== */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

const LS = {
  get(key, fallback = null) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch(e){ return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch(e){ console.warn('LS set failed', e); }
  },
  remove(key){ localStorage.removeItem(key); }
};

/* ========== TAB SWITCHING ========== */
function switchTab(tab) {
  // hide all tabs
  $$('.nav-tab').forEach(btn => btn.classList.remove('active'));
  $$('.tab-content').forEach(t => t.classList.remove('active'));

  // activate button
  const tabButtons = $$(`.nav-tab`);
  tabButtons.forEach(b => {
    if (b.getAttribute('onclick')?.includes(`switchTab('${tab}')`)) b.classList.add('active');
  });

  const el = $(`#${tab}-tab`);
  if (el) el.classList.add('active');
}
window.switchTab = switchTab; // expose for inline handlers

/* ========== CHECKLIST + PROGRESS ========== */
const CHECKLIST_KEY = 'syncplanner.checklist';

function initChecklist() {
  const container = $('#checklist-container');
  if (!container) return;

  // load or initialize
  const saved = LS.get(CHECKLIST_KEY, null);
  if (saved) {
    // replace container items with saved ones
    container.innerHTML = '';
    saved.forEach(item => {
      const div = createChecklistItem(item.text, item.checked);
      container.appendChild(div);
    });
  }

  // attach handlers
  container.addEventListener('click', (ev) => {
    const item = ev.target.closest('.checklist-item');
    if (!item) return;
    toggleCheck(item);
  });

  updateChecklistProgress();
}

function createChecklistItem(text, checked = false) {
  const div = document.createElement('div');
  div.className = 'checklist-item' + (checked ? ' checked' : '');
  div.innerHTML = `<div class="checkbox">${checked ? '✓' : ''}</div><span class="check-text">${escapeHtml(text)}</span>`;
  return div;
}

function toggleCheck(el) {
  el.classList.toggle('checked');
  const box = el.querySelector('.checkbox');
  if (el.classList.contains('checked')) box.textContent = '✓'; else box.textContent = '';
  updateChecklistProgress();
  persistChecklist();
}

function updateChecklistProgress() {
  const items = $$('.checklist-item');
  if (!items.length) {
    setProgress(0);
    return;
  }
  const checked = items.filter(i => i.classList.contains('checked')).length;
  const pct = Math.round((checked / items.length) * 100);
  setProgress(pct);
}

function setProgress(pct) {
  const fill = $('#progress-fill');
  const txt = $('#progress-text');
  if (fill) fill.style.width = pct + '%';
  if (txt) txt.textContent = pct + '%';
}

function persistChecklist() {
  const items = $$('.checklist-item').map(el => ({
    text: el.querySelector('.check-text').textContent.trim(),
    checked: el.classList.contains('checked')
  }));
  LS.set(CHECKLIST_KEY, items);
}

/* small escape helper */
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* ========== POMODORO TIMER ========== */
const POM_KEY = 'syncplanner.pomodoro';
const CIRCUMFERENCE = 2 * Math.PI * 130; // matches r=130 in SVG

let pom = {
  mode: 'work',
  durations: {
    work: 25 * 60,
    shortBreak: 5 * 60,
    longBreak: 15 * 60
  },
  remaining: null,
  running: false,
  sessionIndex: 1,
  sessionsPerCycle: 4,
  stats: { pomodoros:0, focusSeconds:0, breaks:0 }
};
let pomIntervalTimer = null;
let lastTick = null;

function loadPomState(){
  const saved = LS.get(POM_KEY);
  if (saved) Object.assign(pom, saved);
  // if remaining null, set to current mode duration
  if (pom.remaining === null) pom.remaining = pom.durations[pom.mode];
  updatePomUI();
}

function savePomState(){ LS.set(POM_KEY, pom); }

function formatTime(s){
  const m = Math.floor(s/60).toString().padStart(2,'0');
  const sec = (s%60).toString().padStart(2,'0');
  return `${m}:${sec}`;
}

function updatePomUI(){
  const disp = $('#timer-display');
  if (disp) disp.textContent = formatTime(pom.remaining);
  const label = $('#timer-mode-label');
  if (label) {
    if (pom.mode==='work') label.textContent = 'Deep Work';
    else if (pom.mode==='shortBreak') label.textContent = 'Istirahat Pendek';
    else label.textContent = 'Istirahat Panjang';
  }
  // update ring
  updateRing();
  // session and stats
  const sessionEl = $('#session-info');
  if (sessionEl) sessionEl.textContent = `Sesi ${pom.sessionIndex} dari ${pom.sessionsPerCycle} 🍅`;
  $('#stat-pomodoros')?.textContent = pom.stats.pomodoros ?? 0;
  $('#stat-focus-time')?.textContent = (Math.round((pom.stats.focusSeconds || 0)/60)) + 'm';
  $('#stat-breaks')?.textContent = pom.stats.breaks ?? 0;
  // buttons
  $('#btn-timer-start').style.display = pom.running ? 'none' : '';
  $('#btn-timer-pause').style.display = pom.running ? '' : 'none';
  const currentTaskDisplay = $('#current-task-display');
  if (currentTaskDisplay) currentTaskDisplay.style.display = 'none'; // will be shown by other flows if needed
}

function updateRing(){
  const progress = $('#timer-progress');
  if(!progress) return;
  const total = pom.durations[pom.mode];
  const remaining = Math.max(0, pom.remaining);
  const pct = total === 0 ? 0 : (remaining / total);
  const offset = CIRCUMFERENCE * (1 - pct);
  progress.style.strokeDasharray = `${CIRCUMFERENCE.toFixed(2)}`;
  progress.style.strokeDashoffset = offset.toFixed(2);
  // set class for coloring
  progress.classList.remove('work','short-break','long-break');
  if (pom.mode === 'work') progress.classList.add('work');
  if (pom.mode === 'shortBreak') progress.classList.add('short-break');
  if (pom.mode === 'longBreak') progress.classList.add('long-break');
}

function setTimerMode(mode){
  pom.mode = mode;
  pom.remaining = pom.durations[mode];
  savePomState();
  updatePomUI();
  // update active class on mode buttons
  $$('.mode-btn').forEach(b => b.classList.remove('active'));
  const selector = `.mode-btn.${mode === 'work' ? 'work' : (mode==='shortBreak' ? 'short-break' : 'long-break')}`;
  $$(selector).forEach(b => b.classList.add('active'));
}
window.setTimerMode = setTimerMode;

function tickPom(){
  if (!pom.running) return;
  const now = Date.now();
  const elapsed = Math.floor((now - lastTick) / 1000);
  if (elapsed <= 0) return;
  lastTick = now;
  pom.remaining = Math.max(0, pom.remaining - elapsed);

  // accumulate focus time if in work
  if (pom.mode === 'work') {
    pom.stats.focusSeconds = (pom.stats.focusSeconds || 0) + elapsed;
  }

  updatePomUI();
  if (pom.remaining === 0) {
    // session finished
    if (pom.mode === 'work') {
      pom.stats.pomodoros = (pom.stats.pomodoros || 0) + 1;
      pom.sessionIndex = Math.min(pom.sessionsPerCycle, pom.sessionIndex + 1);
      // auto-switch to break
      if (pom.sessionIndex % pom.sessionsPerCycle === 0) {
        pom.mode = 'longBreak';
      } else {
        pom.mode = 'shortBreak';
      }
    } else {
      // finished break
      pom.stats.breaks = (pom.stats.breaks || 0) + 1;
      // back to work
      pom.mode = 'work';
      // if completed full cycle, reset sessionIndex
      if (pom.sessionIndex > pom.sessionsPerCycle) pom.sessionIndex = 1;
    }
    pom.remaining = pom.durations[pom.mode];
    // notify (simple beep)
    playBeep();
    savePomState();
  }
  // persist small frequent updates
  savePomState();
}

function startTimer(){
  if (pom.running) return;
  pom.running = true;
  lastTick = Date.now();
  // use interval for 1s ticks
  if (pomIntervalTimer) clearInterval(pomIntervalTimer);
  pomIntervalTimer = setInterval(() => tickPom(), 1000);
  updatePomUI();
  savePomState();
}
window.startTimer = startTimer;

function pauseTimer(){
  if (!pom.running) return;
  pom.running = false;
  if (pomIntervalTimer) { clearInterval(pomIntervalTimer); pomIntervalTimer = null; }
  updatePomUI();
  savePomState();
}
window.pauseTimer = pauseTimer;

function resetTimer(){
  pom.remaining = pom.durations[pom.mode];
  pom.running = false;
  if (pomIntervalTimer) { clearInterval(pomIntervalTimer); pomIntervalTimer = null; }
  updatePomUI();
  savePomState();
}
window.resetTimer = resetTimer;

function skipTimer(){
  // set remaining to 0 so tick will transition
  pom.remaining = 0;
  tickPom();
  updatePomUI();
  savePomState();
}
window.skipTimer = skipTimer;

function playBeep(){
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.value = 0.05;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    setTimeout(()=>{ o.stop(); ctx.close(); }, 350);
  } catch(e){ /* ignore in Safari strict contexts */ }
}

/* ========== KANBAN BOARD ========== */
const KANBAN_KEY = 'syncplanner.kanban';

function initKanban() {
  // prepare
  const defaultData = {
    columns: {
      backlog: { id: 'backlog', title: 'Backlog', tasks: [] },
      todo: { id: 'todo', title: 'To Do', tasks: [] },
      progress: { id: 'progress', title: 'In Progress', tasks: [] },
      done: { id: 'done', title: 'Done', tasks: [] }
    }
  };
  const saved = LS.get(KANBAN_KEY, null);
  window.kanbanData = saved || defaultData;
  renderKanban();
  attachKanbanHandlers();
}

function renderKanban(){
  // find kanban board container
  const board = $('.kanban-board');
  if(!board) return;
  board.innerHTML = '';
  for(const colKey of ['backlog','todo','progress','done']){
    const col = window.kanbanData.columns[colKey];
    const colEl = document.createElement('div');
    colEl.className = `kanban-column column-${colKey}`;
    colEl.dataset.column = colKey;
    colEl.innerHTML = `
      <div class="column-header">
        <h3>${escapeHtml(col.title)} <span class="task-count">${col.tasks.length}</span></h3>
      </div>
      <div class="task-list" data-column="${colKey}"></div>
      <div style="margin-top:10px;">
        <button class="add-task-btn" data-col="${colKey}">+ Tambah</button>
      </div>
    `;
    board.appendChild(colEl);
    const taskList = colEl.querySelector('.task-list');
    col.tasks.forEach(t => {
      taskList.appendChild(renderTaskCard(t));
    });
  }
  // attach add buttons
  $$('.add-task-btn').forEach(b => {
    b.addEventListener('click', () => {
      const col = b.dataset.col;
      const title = prompt('Judul tugas:');
      if (!title) return;
      const task = {
        id: 't' + Date.now(),
        title: title.trim(),
        notes: '',
        priority: 'low',
        date: null
      };
      window.kanbanData.columns[col].tasks.unshift(task);
      persistKanban();
      renderKanban();
    });
  });
}

function renderTaskCard(task){
  const div = document.createElement('div');
  div.className = 'task-card';
  div.draggable = true;
  div.dataset.taskId = task.id;
  div.innerHTML = `
    <div class="task-card-header">
      <div class="task-title">${escapeHtml(task.title)}</div>
      <div class="task-actions">
        <button class="task-btn task-btn-edit" title="Edit">✎</button>
        <button class="task-btn task-btn-delete" title="Hapus">🗑</button>
      </div>
    </div>
    <div class="task-meta">
      <div class="task-priority priority-${task.priority}">${escapeHtml(task.priority)}</div>
      <div class="task-date">${task.date ? escapeHtml(task.date) : ''}</div>
    </div>
    <div class="task-notes">${escapeHtml(task.notes || '')}</div>
  `;
  // attach internal action handlers
  div.querySelector('.task-btn-delete').addEventListener('click', (ev) => {
    ev.stopPropagation();
    deleteTaskById(task.id);
  });
  div.querySelector('.task-btn-edit').addEventListener('click', (ev) => {
    ev.stopPropagation();
    editTaskById(task.id);
  });
  // Drag events
  div.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', task.id);
    div.classList.add('dragging');
  });
  div.addEventListener('dragend', (e) => {
    div.classList.remove('dragging');
  });
  return div;
}

function attachKanbanHandlers(){
  // drop zones per column
  $$('.task-list').forEach(list => {
    list.addEventListener('dragover', (e) => {
      e.preventDefault();
      list.classList.add('drag-over');
    });
    list.addEventListener('dragleave', (e) => {
      list.classList.remove('drag-over');
    });
    list.addEventListener('drop', (e) => {
      e.preventDefault();
      list.classList.remove('drag-over');
      const taskId = e.dataTransfer.getData('text/plain');
      if(!taskId) return;
      moveTaskToColumn(taskId, list.dataset.column);
    });
  });
}

function findTask(taskId){
  for(const colKey in window.kanbanData.columns){
    const col = window.kanbanData.columns[colKey];
    const t = col.tasks.find(x => x.id === taskId);
    if (t) return {task: t, column: colKey};
  }
  return null;
}

function moveTaskToColumn(taskId, targetCol){
  const found = findTask(taskId);
  if (!found) return;
  // remove from old
  const oldCol = window.kanbanData.columns[found.column];
  oldCol.tasks = oldCol.tasks.filter(t => t.id !== taskId);
  // push to top of target
  window.kanbanData.columns[targetCol].tasks.unshift(found.task);
  persistKanban();
  renderKanban();
}

function deleteTaskById(taskId){
  const f = findTask(taskId);
  if(!f) return;
  if (!confirm('Hapus tugas "'+ f.task.title +'" ?')) return;
  window.kanbanData.columns[f.column].tasks = window.kanbanData.columns[f.column].tasks.filter(t => t.id !== taskId);
  persistKanban();
  renderKanban();
}

function editTaskById(taskId){
  const f = findTask(taskId);
  if(!f) return;
  const t = f.task;
  const newTitle = prompt('Edit judul:', t.title);
  if (newTitle === null) return;
  t.title = newTitle.trim() || t.title;
  const newNotes = prompt('Catatan (kosong = tidak berubah):', t.notes || '');
  if (newNotes !== null) t.notes = newNotes;
  persistKanban();
  renderKanban();
}

function persistKanban(){
  LS.set(KANBAN_KEY, window.kanbanData);
}

/* ========== PAIRWISE COMPARISON ========== */
const PAIR_KEY = 'syncplanner.pairwise';

function initPairwise(){
  const saved = LS.get(PAIR_KEY, null);
  window.pairwise = saved || { options: [], comparisons: [], results: {} };
  renderOptionsList();
  attachPairwiseHandlers();
}

function renderOptionsList(){
  const area = $('.options-list');
  if(!area) return;
  area.innerHTML = '';
  window.pairwise.options.forEach((opt, idx) => {
    const div = document.createElement('div');
    div.className = 'option-item';
    div.innerHTML = `<div class="option-number">${idx+1}</div><div class="option-text">${escapeHtml(opt)}</div><button class="option-delete" data-idx="${idx}">✖</button>`;
    area.appendChild(div);
  });
  // attach deletes
  $$('.option-delete', area).forEach(b => {
    b.addEventListener('click', () => {
      const i = parseInt(b.dataset.idx,10);
      window.pairwise.options.splice(i,1);
      LS.set(PAIR_KEY, window.pairwise);
      renderOptionsList();
    });
  });
  // update count
  const count = $('.options-count');
  if(count) count.textContent = (window.pairwise.options.length || 0) + ' opsi';
}

function attachPairwiseHandlers(){
  const addBtn = $('.btn-add-option');
  const input = $('.option-input');
  if(addBtn && input){
    addBtn.addEventListener('click', () => {
      const v = input.value.trim();
      if (!v) return alert('Masukkan opsi terlebih dahulu');
      window.pairwise.options.push(v);
      input.value = '';
      LS.set(PAIR_KEY, window.pairwise);
      renderOptionsList();
    });
  }

  // comparison nav actions
  $$('.action-buttons .btn-primary, .action-buttons .btn-secondary').forEach(btn => {
    btn.addEventListener('click', () => {
      // placeholder: you can implement evaluate / reset etc.
      if (btn.classList.contains('btn-primary')) {
        computePairwiseResults();
      } else {
        // reset
        if (!confirm('Reset semua opsi dan hasil?')) return;
        window.pairwise = { options: [], comparisons: [], results: {} };
        LS.set(PAIR_KEY, window.pairwise);
        renderOptionsList();
        renderComparisonResults();
      }
    });
  });
}

function computePairwiseResults(){
  const opts = window.pairwise.options;
  if (!opts || opts.length < 2) return alert('Butuh minimal 2 opsi untuk membandingkan');
  // For simplicity: ask user pairwise via prompt in a loop (easy to replace with UI)
  const scores = Array(opts.length).fill(0);
  for (let i=0;i<opts.length;i++){
    for (let j=i+1;j<opts.length;j++){
      const a = opts[i], b = opts[j];
      const ans = prompt(`Mana lebih penting?\n1: ${a}\n2: ${b}\n(ketik 1 atau 2, atau 0 untuk seri)`, '1');
      let val = 0;
      if (ans === '1') val = 1;
      else if (ans === '2') val = -1;
      else val = 0;
      if (val === 1) scores[i] += 1;
      else if (val === -1) scores[j] += 1;
      else { scores[i] += 0.5; scores[j] += 0.5; }
      // save pairwise record
      window.pairwise.comparisons.push({ a:i, b:j, result: val });
    }
  }
  // produce ranking
  const res = opts.map((o, idx) => ({ option:o, score: scores[idx] }));
  res.sort((x,y) => y.score - x.score);
  window.pairwise.results = { ranking: res, rawScores: scores };
  LS.set(PAIR_KEY, window.pairwise);
  renderComparisonResults();
}

function renderComparisonResults(){
  const container = $('.results-list');
  if(!container) return;
  container.innerHTML = '';
  if (!window.pairwise.results || !window.pairwise.results.ranking) {
    container.innerHTML = `<div class="log-empty">Belum ada hasil perbandingan.</div>`;
    return;
  }
  window.pairwise.results.ranking.forEach((r, i) => {
    const div = document.createElement('div');
    const rankClass = i===0 ? 'rank-1' : (i===1 ? 'rank-2' : (i===2 ? 'rank-3' : ''));
    div.className = `result-item ${rankClass}`;
    div.innerHTML = `<div class="result-rank">${i+1}</div><div class="result-info"><div class="result-title">${escapeHtml(r.option)}</div><div class="result-score">Skor: ${r.score}</div></div><div class="result-bar-container"><div class="result-bar" style="width:${Math.min(100, Math.round((r.score / (window.pairwise.options.length||1))*100))}%"></div></div>`;
    container.appendChild(div);
  });
}

/* ========== SIMPLE PWA INSTALL BANNER + SW REGISTER ========== */
function initPwaHelpers(){
  // install banner UI
  const banner = document.createElement('div');
  banner.className = 'pwa-install-banner';
  banner.innerHTML = `
    <div class="pwa-install-info"><div class="pwa-install-icon">🎯</div>
    <div class="pwa-install-text"><h4>Install Sync Planner</h4><p>Tambahkan ke layar utama untuk akses cepat.</p></div></div>
    <div class="pwa-install-actions"><button class="pwa-btn pwa-btn-install">Install</button><button class="pwa-btn pwa-btn-dismiss">Tutup</button></div>
  `;
  document.body.appendChild(banner);

  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    banner.classList.add('show');
  });

  banner.querySelector('.pwa-btn-install').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      console.log('User accepted install');
    } else console.log('User dismissed install');
    deferredPrompt = null;
    banner.classList.remove('show');
  });

  banner.querySelector('.pwa-btn-dismiss').addEventListener('click', () => {
    banner.classList.remove('show');
  });

  // service worker registration (placeholder)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').then(reg => {
      console.log('ServiceWorker registered', reg);
    }).catch(err => {
      console.warn('ServiceWorker reg failed', err);
    });
  }
}

/* ========== GOOGLE SHEETS SYNC PLACEHOLDERS ========== */
function initSheetsPlaceholder(){
  // attach sample sync button behavior if present in DOM
  $$('.btn-sync').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.disabled = true;
      btn.textContent = 'Menyinkronkan...';
      // NOTE: You need a server or Apps Script endpoint to accept POST/GET
      setTimeout(() => {
        alert('Sinkronisasi demo selesai (placeholder). Implementasikan backend Apps Script untuk Google Sheets.');
        btn.disabled = false;
        btn.textContent = 'Sync';
      }, 1200);
    });
  });
}

/* ========== INIT BOOTSTRAP ========== */
function bootApp(){
  // Checklist
  initChecklist();

  // Pomodoro
  loadPomState();

  // Kanban
  initKanban();

  // Pairwise
  initPairwise();
  renderComparisonResults();

  // PWA
  initPwaHelpers();

  // Sheets placeholder
  initSheetsPlaceholder();

  // wire up mode buttons initial state
  $$('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $('.mode-btn.active')?.classList.remove('active');
      btn.classList.add('active');
    });
  });

  // window unload persist
  window.addEventListener('beforeunload', () => {
    persistChecklist();
    savePomState();
    persistKanban();
    LS.set(PAIR_KEY, window.pairwise);
  });
}

// run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApp);
} else bootApp();

