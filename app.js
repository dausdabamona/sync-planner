// ==================== SYNC PLANNER - MAIN JAVASCRIPT ====================
// Version 2.0 - Modular & Improved

// ==================== GLOBAL STATE ====================
const AppState = {
    // Theme
    theme: 'light',
    
    // Planner
    checklist: [],
    reflections: {
        good: '',
        improve: '',
        gratitude: '',
        sedona: ''
    },
    
    // Pomodoro
    timer: {
        mode: 'work',
        isRunning: false,
        timeLeft: 25 * 60,
        interval: null,
        settings: {
            work: 25,
            shortBreak: 5,
            longBreak: 15
        },
        stats: {
            pomodoros: 0,
            focusTime: 0,
            breaks: 0,
            streak: 0
        },
        currentSession: 1,
        sound: {
            enabled: true,
            volume: 0.5
        }
    },
    
    // Pairwise
    pairwise: {
        options: [],
        comparisons: [],
        currentIndex: 0,
        scores: {}
    },
    
    // Kanban
    kanban: {
        tasks: [],
        taskIdCounter: 1,
        draggedTask: null
    },
    
    // Google Sheets
    gsheet: {
        webAppUrl: ''
    }
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    loadFromLocalStorage();
    initTheme();
    initDate();
    initPomodoro();
    initPWA();
    renderKanbanTasks();
    updateProgress();
    console.log('🎯 Sync Planner initialized');
}

// ==================== THEME ====================
function initTheme() {
    const savedTheme = localStorage.getItem('sync-planner-theme') || 'light';
    setTheme(savedTheme);
}

function toggleTheme() {
    const newTheme = AppState.theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
}

function setTheme(theme) {
    AppState.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelector('.theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('sync-planner-theme', theme);
}

// ==================== DATE ====================
function initDate() {
    const dateEl = document.getElementById('current-date');
    if (dateEl) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateEl.textContent = new Date().toLocaleDateString('id-ID', options);
    }
}

// ==================== NAVIGATION ====================
function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Deactivate all nav buttons
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    const targetTab = document.getElementById(`${tabName}-tab`);
    if (targetTab) {
        targetTab.classList.add('active');
    }
    
    // Activate nav button
    const navBtn = document.querySelector(`.nav-tab[data-tab="${tabName}"]`);
    if (navBtn) {
        navBtn.classList.add('active');
    }
}

// ==================== CHECKLIST ====================
function toggleCheck(element) {
    element.classList.toggle('checked');
    updateProgress();
    saveChecklistState();
}

function updateProgress() {
    const items = document.querySelectorAll('.checklist-item');
    const checked = document.querySelectorAll('.checklist-item.checked');
    const percentage = items.length > 0 ? Math.round((checked.length / items.length) * 100) : 0;
    
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
    if (progressFill) progressFill.style.width = `${percentage}%`;
    if (progressText) progressText.textContent = `${percentage}%`;
}

function saveChecklistState() {
    const items = document.querySelectorAll('.checklist-item');
    AppState.checklist = Array.from(items).map(item => item.classList.contains('checked'));
    saveToLocalStorage();
}

function loadChecklistState() {
    const items = document.querySelectorAll('.checklist-item');
    AppState.checklist.forEach((checked, index) => {
        if (items[index] && checked) {
            items[index].classList.add('checked');
        }
    });
    updateProgress();
}

// ==================== REFLECTIONS ====================
function saveReflections() {
    AppState.reflections = {
        good: document.getElementById('reflection-good')?.value || '',
        improve: document.getElementById('reflection-improve')?.value || '',
        gratitude: document.getElementById('reflection-gratitude')?.value || '',
        sedona: document.getElementById('reflection-sedona')?.value || ''
    };
    saveToLocalStorage();
}

function loadReflections() {
    const fields = ['good', 'improve', 'gratitude', 'sedona'];
    fields.forEach(field => {
        const el = document.getElementById(`reflection-${field}`);
        if (el && AppState.reflections[field]) {
            el.value = AppState.reflections[field];
        }
    });
}

// ==================== POMODORO TIMER ====================
function initPomodoro() {
    loadTimerSettings();
    updateTimerDisplay();
    updateSessionInfo();
}

function setTimerMode(mode) {
    AppState.timer.mode = mode;
    
    // Update button states
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.mode === mode) {
            btn.classList.add('active');
        }
    });
    
    // Update progress ring class
    const progressRing = document.getElementById('timer-progress');
    if (progressRing) {
        progressRing.className = `timer-ring-progress ${mode.replace('-', '-')}`;
        progressRing.classList.remove('work', 'short-break', 'long-break');
        progressRing.classList.add(mode);
    }
    
    // Set time based on mode
    const settings = AppState.timer.settings;
    switch (mode) {
        case 'work':
            AppState.timer.timeLeft = settings.work * 60;
            document.getElementById('timer-mode-label').textContent = 'Deep Work';
            break;
        case 'short-break':
            AppState.timer.timeLeft = settings.shortBreak * 60;
            document.getElementById('timer-mode-label').textContent = 'Istirahat';
            break;
        case 'long-break':
            AppState.timer.timeLeft = settings.longBreak * 60;
            document.getElementById('timer-mode-label').textContent = 'Istirahat Panjang';
            break;
    }
    
    resetTimer();
}

function startTimer() {
    if (AppState.timer.isRunning) return;
    
    AppState.timer.isRunning = true;
    document.getElementById('btn-timer-start').style.display = 'none';
    document.getElementById('btn-timer-pause').style.display = 'flex';
    
    AppState.timer.interval = setInterval(() => {
        AppState.timer.timeLeft--;
        updateTimerDisplay();
        
        if (AppState.timer.timeLeft <= 0) {
            timerComplete();
        }
    }, 1000);
}

function pauseTimer() {
    AppState.timer.isRunning = false;
    clearInterval(AppState.timer.interval);
    document.getElementById('btn-timer-start').style.display = 'flex';
    document.getElementById('btn-timer-pause').style.display = 'none';
}

function resetTimer() {
    pauseTimer();
    const settings = AppState.timer.settings;
    const mode = AppState.timer.mode;
    
    switch (mode) {
        case 'work':
            AppState.timer.timeLeft = settings.work * 60;
            break;
        case 'short-break':
            AppState.timer.timeLeft = settings.shortBreak * 60;
            break;
        case 'long-break':
            AppState.timer.timeLeft = settings.longBreak * 60;
            break;
    }
    
    updateTimerDisplay();
}

function skipTimer() {
    timerComplete();
}

function timerComplete() {
    pauseTimer();
    playNotificationSound();
    
    if (AppState.timer.mode === 'work') {
        AppState.timer.stats.pomodoros++;
        AppState.timer.stats.focusTime += AppState.timer.settings.work;
        AppState.timer.stats.streak++;
        
        // Check for long break
        if (AppState.timer.currentSession >= 4) {
            AppState.timer.currentSession = 1;
            setTimerMode('long-break');
            showNotification('🎉 Selesai 4 sesi! Saatnya istirahat panjang.');
        } else {
            AppState.timer.currentSession++;
            setTimerMode('short-break');
            showNotification('✅ Pomodoro selesai! Istirahat sebentar.');
        }
    } else {
        AppState.timer.stats.breaks++;
        setTimerMode('work');
        showNotification('⏰ Istirahat selesai! Kembali fokus.');
    }
    
    updatePomodoroStats();
    updateSessionInfo();
    saveToLocalStorage();
}

function updateTimerDisplay() {
    const minutes = Math.floor(AppState.timer.timeLeft / 60);
    const seconds = AppState.timer.timeLeft % 60;
    const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    document.getElementById('timer-display').textContent = display;
    document.title = `${display} - Sync Planner`;
    
    // Update progress ring
    const settings = AppState.timer.settings;
    const mode = AppState.timer.mode;
    let totalTime;
    
    switch (mode) {
        case 'work':
            totalTime = settings.work * 60;
            break;
        case 'short-break':
            totalTime = settings.shortBreak * 60;
            break;
        case 'long-break':
            totalTime = settings.longBreak * 60;
            break;
    }
    
    const circumference = 816.81; // 2 * PI * 130
    const progress = AppState.timer.timeLeft / totalTime;
    const offset = circumference * (1 - progress);
    
    const progressRing = document.getElementById('timer-progress');
    if (progressRing) {
        progressRing.style.strokeDashoffset = offset;
    }
}

function updateSessionInfo() {
    const sessionInfo = document.getElementById('session-info');
    if (sessionInfo) {
        const emojis = '🍅'.repeat(Math.min(AppState.timer.currentSession, 4));
        sessionInfo.textContent = `Sesi ${AppState.timer.currentSession} dari 4 ${emojis}`;
    }
}

function updatePomodoroStats() {
    const stats = AppState.timer.stats;
    document.getElementById('stat-pomodoros').textContent = stats.pomodoros;
    document.getElementById('stat-focus-time').textContent = `${stats.focusTime}m`;
    document.getElementById('stat-breaks').textContent = stats.breaks;
    document.getElementById('stat-streak').textContent = stats.streak;
}

function updateTimerSettings() {
    AppState.timer.settings = {
        work: parseInt(document.getElementById('setting-work').value) || 25,
        shortBreak: parseInt(document.getElementById('setting-short-break').value) || 5,
        longBreak: parseInt(document.getElementById('setting-long-break').value) || 15
    };
    
    resetTimer();
    saveToLocalStorage();
}

function loadTimerSettings() {
    const settings = AppState.timer.settings;
    document.getElementById('setting-work').value = settings.work;
    document.getElementById('setting-short-break').value = settings.shortBreak;
    document.getElementById('setting-long-break').value = settings.longBreak;
    
    const sound = AppState.timer.sound;
    document.getElementById('sound-enabled').checked = sound.enabled;
    document.getElementById('sound-volume').value = sound.volume * 100;
    
    updatePomodoroStats();
}

function updateSoundSettings() {
    AppState.timer.sound = {
        enabled: document.getElementById('sound-enabled').checked,
        volume: document.getElementById('sound-volume').value / 100
    };
    saveToLocalStorage();
}

function testSound() {
    playNotificationSound();
}

function playNotificationSound() {
    if (!AppState.timer.sound.enabled) return;
    
    const audio = document.getElementById('notification-sound');
    if (audio) {
        audio.volume = AppState.timer.sound.volume;
        audio.currentTime = 0;
        audio.play().catch(e => console.log('Audio play failed:', e));
    }
}

function showNotification(message) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Sync Planner', { body: message, icon: '🎯' });
    }
    alert(message);
}

function startDeepWorkSession(sessionNum) {
    // Update session status
    for (let i = 1; i <= 4; i++) {
        const statusEl = document.getElementById(`session-status-${i}`);
        const cardEl = document.querySelector(`.session-card[data-session="${i}"]`);
        
        if (i < sessionNum) {
            statusEl.textContent = 'Selesai';
            statusEl.className = 'session-status status-completed';
            cardEl.classList.add('completed');
            cardEl.classList.remove('active');
        } else if (i === sessionNum) {
            statusEl.textContent = 'Aktif';
            statusEl.className = 'session-status status-active';
            cardEl.classList.add('active');
            cardEl.classList.remove('completed');
        } else {
            statusEl.textContent = 'Menunggu';
            statusEl.className = 'session-status status-pending';
            cardEl.classList.remove('completed', 'active');
        }
    }
    
    // Start timer
    setTimerMode('work');
    startTimer();
}

// ==================== PAIRWISE COMPARISON ====================
function handleOptionKeypress(event) {
    if (event.key === 'Enter') {
        addOption();
    }
}

function addOption() {
    const input = document.getElementById('option-input');
    const text = input.value.trim();
    
    if (!text) return;
    if (AppState.pairwise.options.length >= 10) {
        alert('Maksimal 10 opsi!');
        return;
    }
    if (AppState.pairwise.options.includes(text)) {
        alert('Opsi sudah ada!');
        return;
    }
    
    AppState.pairwise.options.push(text);
    input.value = '';
    renderOptionsList();
    savePairwiseState();
}

function removeOption(index) {
    AppState.pairwise.options.splice(index, 1);
    renderOptionsList();
    savePairwiseState();
}

function clearAllOptions() {
    if (confirm('Hapus semua opsi?')) {
        AppState.pairwise.options = [];
        renderOptionsList();
        savePairwiseState();
    }
}

function renderOptionsList() {
    const container = document.getElementById('options-list');
    const count = AppState.pairwise.options.length;
    
    if (count === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span>📝</span>
                <p>Belum ada opsi. Tambahkan minimal 3 opsi.</p>
            </div>
        `;
    } else {
        container.innerHTML = AppState.pairwise.options.map((opt, i) => `
            <div class="option-item">
                <span class="option-number">${i + 1}</span>
                <span class="option-text">${escapeHtml(opt)}</span>
                <button class="option-delete" onclick="removeOption(${i})">✕</button>
            </div>
        `).join('');
    }
    
    document.getElementById('options-count').textContent = `${count} opsi`;
    document.getElementById('btn-start-comparison').disabled = count < 3;
}

function startComparison() {
    if (AppState.pairwise.options.length < 3) {
        alert('Minimal 3 opsi diperlukan!');
        return;
    }
    
    // Generate all pairs
    AppState.pairwise.comparisons = [];
    AppState.pairwise.scores = {};
    
    const opts = AppState.pairwise.options;
    for (let i = 0; i < opts.length; i++) {
        AppState.pairwise.scores[i] = 0;
        for (let j = i + 1; j < opts.length; j++) {
            AppState.pairwise.comparisons.push([i, j]);
        }
    }
    
    // Shuffle comparisons
    AppState.pairwise.comparisons.sort(() => Math.random() - 0.5);
    AppState.pairwise.currentIndex = 0;
    
    // Show comparison card
    document.getElementById('comparison-card').style.display = 'block';
    document.getElementById('results-card').style.display = 'none';
    
    showCurrentComparison();
}

function showCurrentComparison() {
    const idx = AppState.pairwise.currentIndex;
    const total = AppState.pairwise.comparisons.length;
    
    if (idx >= total) {
        showResults();
        return;
    }
    
    const [a, b] = AppState.pairwise.comparisons[idx];
    document.getElementById('option-text-a').textContent = AppState.pairwise.options[a];
    document.getElementById('option-text-b').textContent = AppState.pairwise.options[b];
    
    // Update progress
    const percentage = (idx / total) * 100;
    document.getElementById('comparison-progress-fill').style.width = `${percentage}%`;
    document.getElementById('comparison-progress-text').textContent = `${idx} / ${total}`;
}

function selectOption(choice) {
    const [a, b] = AppState.pairwise.comparisons[AppState.pairwise.currentIndex];
    
    if (choice === 'a') {
        AppState.pairwise.scores[a]++;
    } else {
        AppState.pairwise.scores[b]++;
    }
    
    AppState.pairwise.currentIndex++;
    showCurrentComparison();
    savePairwiseState();
}

function showResults() {
    document.getElementById('comparison-card').style.display = 'none';
    document.getElementById('results-card').style.display = 'block';
    
    // Sort options by score
    const results = AppState.pairwise.options
        .map((opt, i) => ({ text: opt, score: AppState.pairwise.scores[i], index: i }))
        .sort((a, b) => b.score - a.score);
    
    const container = document.getElementById('results-list');
    container.innerHTML = results.map((item, rank) => {
        const rankClass = rank < 3 ? `rank-${rank + 1}` : '';
        return `
            <div class="result-item ${rankClass}">
                <span class="result-rank">${rank + 1}</span>
                <span class="result-text">${escapeHtml(item.text)}</span>
                <span class="result-score">${item.score} poin</span>
            </div>
        `;
    }).join('');
}

function resetComparison() {
    document.getElementById('comparison-card').style.display = 'none';
    document.getElementById('results-card').style.display = 'none';
    AppState.pairwise.currentIndex = 0;
    AppState.pairwise.scores = {};
}

function savePairwiseState() {
    saveToLocalStorage();
}

// ==================== KANBAN ====================
function handleQuickTaskKeypress(event) {
    if (event.key === 'Enter') {
        quickAddTask();
    }
}

function quickAddTask() {
    const input = document.getElementById('quick-task-input');
    const priority = document.getElementById('quick-task-priority').value;
    const title = input.value.trim();
    
    if (!title) return;
    
    const task = {
        id: AppState.kanban.taskIdCounter++,
        title: title,
        column: 'backlog',
        priority: priority,
        notes: '',
        link: '',
        created: new Date().toISOString()
    };
    
    AppState.kanban.tasks.push(task);
    input.value = '';
    
    renderKanbanTasks();
    saveToLocalStorage();
}

function renderKanbanTasks() {
    // Clear all columns
    ['backlog', 'todo', 'inprogress', 'done'].forEach(col => {
        const container = document.getElementById(`column-${col}`);
        if (container) container.innerHTML = '';
    });
    
    // Render tasks
    AppState.kanban.tasks.forEach(task => {
        const container = document.getElementById(`column-${task.column}`);
        if (container) {
            container.appendChild(createTaskElement(task));
        }
    });
    
    updateKanbanCounts();
}

function createTaskElement(task) {
    const div = document.createElement('div');
    div.className = `task-card priority-${task.priority}`;
    div.draggable = true;
    div.dataset.taskId = task.id;
    
    div.innerHTML = `
        <div class="task-header">
            <span class="task-title">${escapeHtml(task.title)}</span>
            <div class="task-actions">
                <button class="task-btn" onclick="editTask(${task.id})">✏️</button>
                <button class="task-btn delete" onclick="quickDeleteTask(${task.id})">🗑️</button>
            </div>
        </div>
        <span class="task-priority ${task.priority}">${getPriorityLabel(task.priority)}</span>
        ${task.notes ? `<div class="task-notes">${escapeHtml(task.notes)}</div>` : ''}
        ${task.link ? `<a href="${escapeHtml(task.link)}" target="_blank" class="task-link">🔗 Link</a>` : ''}
    `;
    
    // Drag events
    div.addEventListener('dragstart', handleDragStart);
    div.addEventListener('dragend', handleDragEnd);
    
    return div;
}

function getPriorityLabel(priority) {
    const labels = {
        high: '🔴 Tinggi',
        medium: '🟡 Sedang',
        low: '🟢 Rendah'
    };
    return labels[priority] || priority;
}

function updateKanbanCounts() {
    const counts = { backlog: 0, todo: 0, inprogress: 0, done: 0 };
    
    AppState.kanban.tasks.forEach(task => {
        if (counts.hasOwnProperty(task.column)) {
            counts[task.column]++;
        }
    });
    
    Object.keys(counts).forEach(col => {
        const el = document.getElementById(`count-${col}`);
        if (el) el.textContent = counts[col];
    });
    
    // Update stats bar
    const total = AppState.kanban.tasks.length;
    const progress = counts.inprogress;
    const done = counts.done;
    
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-progress').textContent = progress;
    document.getElementById('stat-done').textContent = done;
}

// Drag and Drop
function handleDragStart(e) {
    AppState.kanban.draggedTask = e.target;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    AppState.kanban.draggedTask = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDrop(e, column) {
    e.preventDefault();
    
    if (!AppState.kanban.draggedTask) return;
    
    const taskId = parseInt(AppState.kanban.draggedTask.dataset.taskId);
    const task = AppState.kanban.tasks.find(t => t.id === taskId);
    
    if (task) {
        task.column = column;
        renderKanbanTasks();
        saveToLocalStorage();
    }
}

// Task Modal
function editTask(taskId) {
    const task = AppState.kanban.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    document.getElementById('edit-task-id').value = task.id;
    document.getElementById('edit-task-title').value = task.title;
    document.getElementById('edit-task-priority').value = task.priority;
    document.getElementById('edit-task-column').value = task.column;
    document.getElementById('edit-task-notes').value = task.notes || '';
    document.getElementById('edit-task-link').value = task.link || '';
    
    document.getElementById('task-modal').classList.add('active');
}

function closeTaskModal() {
    document.getElementById('task-modal').classList.remove('active');
}

function saveTaskEdit() {
    const taskId = parseInt(document.getElementById('edit-task-id').value);
    const task = AppState.kanban.tasks.find(t => t.id === taskId);
    
    if (!task) return;
    
    task.title = document.getElementById('edit-task-title').value.trim();
    task.priority = document.getElementById('edit-task-priority').value;
    task.column = document.getElementById('edit-task-column').value;
    task.notes = document.getElementById('edit-task-notes').value.trim();
    task.link = document.getElementById('edit-task-link').value.trim();
    
    closeTaskModal();
    renderKanbanTasks();
    saveToLocalStorage();
}

function deleteTask() {
    const taskId = parseInt(document.getElementById('edit-task-id').value);
    if (confirm('Hapus tugas ini?')) {
        AppState.kanban.tasks = AppState.kanban.tasks.filter(t => t.id !== taskId);
        closeTaskModal();
        renderKanbanTasks();
        saveToLocalStorage();
    }
}

function quickDeleteTask(taskId) {
    if (confirm('Hapus tugas ini?')) {
        AppState.kanban.tasks = AppState.kanban.tasks.filter(t => t.id !== taskId);
        renderKanbanTasks();
        saveToLocalStorage();
    }
}

// ==================== GOOGLE SHEETS ====================
function toggleAppsScript() {
    const el = document.getElementById('apps-script-code');
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function copyAppsScript() {
    const code = document.querySelector('.script-code').textContent;
    navigator.clipboard.writeText(code).then(() => {
        alert('Kode berhasil dicopy! Paste ke Google Apps Script editor.');
    }).catch(err => {
        alert('Gagal copy. Silakan select dan copy manual.');
    });
}

function saveGSheetSettings() {
    AppState.gsheet.webAppUrl = document.getElementById('gsheet-url').value.trim();
    saveToLocalStorage();
    testConnection();
}

function loadGSheetSettings() {
    document.getElementById('gsheet-url').value = AppState.gsheet.webAppUrl || '';
    if (AppState.gsheet.webAppUrl) {
        updateConnectionStatus('connected', '🟢', 'Terhubung');
    }
}

async function testConnection() {
    const url = AppState.gsheet.webAppUrl;
    if (!url) {
        updateConnectionStatus('', '⚪', 'Belum terhubung');
        return;
    }
    
    try {
        addLogEntry('Testing koneksi...', '');
        const response = await fetch(`${url}?type=tasks`, { method: 'GET', redirect: 'follow' });
        const result = await response.json();
        
        if (result.success !== undefined) {
            updateConnectionStatus('connected', '🟢', 'Terhubung ke Google Sheets');
            addLogEntry('✓ Koneksi berhasil', 'success');
        } else {
            throw new Error('Invalid response');
        }
    } catch (error) {
        updateConnectionStatus('error', '🔴', 'Gagal terhubung');
        addLogEntry('✗ Koneksi gagal: ' + error.message, 'error');
    }
}

function updateConnectionStatus(className, icon, text) {
    const el = document.getElementById('connection-status');
    el.className = 'connection-status ' + className;
    el.innerHTML = `
        <span class="status-icon">${icon}</span>
        <span class="status-text">${text}</span>
    `;
}

async function syncTasksToSheet() {
    if (!AppState.gsheet.webAppUrl) {
        alert('Setup Google Sheets terlebih dahulu!');
        return;
    }
    
    try {
        addLogEntry('Mengirim tasks ke Google Sheets...', '');
        
        const response = await fetch(AppState.gsheet.webAppUrl, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                type: 'tasks',
                tasks: AppState.kanban.tasks
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            addLogEntry('✓ Tasks berhasil disimpan', 'success');
            alert('Tasks berhasil disimpan ke Google Sheets!');
        } else {
            throw new Error(result.error || 'Gagal menyimpan');
        }
    } catch (error) {
        addLogEntry('✗ Gagal sync: ' + error.message, 'error');
        alert('Gagal sync: ' + error.message);
    }
}

async function loadTasksFromSheet() {
    if (!AppState.gsheet.webAppUrl) {
        alert('Setup Google Sheets terlebih dahulu!');
        return;
    }
    
    try {
        addLogEntry('Memuat tasks dari Google Sheets...', '');
        
        const response = await fetch(`${AppState.gsheet.webAppUrl}?type=tasks`, {
            method: 'GET',
            redirect: 'follow'
        });
        
        const result = await response.json();
        
        if (result.success && result.data) {
            AppState.kanban.tasks = result.data;
            
            // Update task ID counter
            if (result.data.length > 0) {
                const maxId = Math.max(...result.data.map(t => t.id || 0));
                AppState.kanban.taskIdCounter = maxId + 1;
            }
            
            renderKanbanTasks();
            saveToLocalStorage();
            
            addLogEntry('✓ Berhasil memuat ' + result.data.length + ' tasks', 'success');
            alert('Berhasil memuat ' + result.data.length + ' tasks!');
        } else {
            throw new Error(result.error || 'Gagal memuat');
        }
    } catch (error) {
        addLogEntry('✗ Gagal memuat: ' + error.message, 'error');
        alert('Gagal memuat: ' + error.message);
    }
}

async function syncDailyToSheet() {
    if (!AppState.gsheet.webAppUrl) {
        alert('Setup Google Sheets terlebih dahulu!');
        return;
    }
    
    try {
        addLogEntry('Mengirim data harian...', '');
        
        const response = await fetch(AppState.gsheet.webAppUrl, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                type: 'daily',
                date: new Date().toLocaleDateString('id-ID'),
                checklist: AppState.checklist,
                reflections: AppState.reflections
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            addLogEntry('✓ Data harian tersimpan', 'success');
            alert('Data harian berhasil disimpan!');
        } else {
            throw new Error(result.error || 'Gagal menyimpan');
        }
    } catch (error) {
        addLogEntry('✗ Gagal sync: ' + error.message, 'error');
        alert('Gagal sync: ' + error.message);
    }
}

async function loadDailyFromSheet() {
    if (!AppState.gsheet.webAppUrl) return;
    
    try {
        const today = new Date().toLocaleDateString('id-ID');
        const response = await fetch(`${AppState.gsheet.webAppUrl}?type=daily&date=${encodeURIComponent(today)}`, {
            method: 'GET',
            redirect: 'follow'
        });
        
        const result = await response.json();
        
        if (result.success && result.data) {
            // Load checklist
            const items = document.querySelectorAll('.checklist-item');
            result.data.checklist.forEach((checked, index) => {
                if (items[index]) {
                    if (checked) {
                        items[index].classList.add('checked');
                    } else {
                        items[index].classList.remove('checked');
                    }
                }
            });
            updateProgress();
            
            // Load reflections
            if (result.data.reflections) {
                AppState.reflections = result.data.reflections;
                loadReflections();
            }
            
            saveToLocalStorage();
            addLogEntry('✓ Data hari ini dimuat', 'success');
        }
    } catch (error) {
        console.log('Auto-load daily failed:', error);
    }
}

async function syncPairwiseToSheet() {
    if (!AppState.gsheet.webAppUrl) {
        alert('Setup Google Sheets terlebih dahulu!');
        return;
    }
    
    if (Object.keys(AppState.pairwise.scores).length === 0) {
        alert('Belum ada hasil Pairwise untuk disimpan');
        return;
    }
    
    // Sort and prepare data
    const results = AppState.pairwise.options
        .map((opt, i) => ({ text: opt, score: AppState.pairwise.scores[i] || 0, rank: 0 }))
        .sort((a, b) => b.score - a.score)
        .map((item, idx) => ({ ...item, rank: idx + 1 }));
    
    try {
        addLogEntry('Mengirim hasil Pairwise...', '');
        
        const response = await fetch(AppState.gsheet.webAppUrl, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                type: 'pairwise',
                totalComparisons: AppState.pairwise.comparisons.length,
                results: results
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            addLogEntry('✓ Hasil Pairwise tersimpan', 'success');
            alert('Hasil prioritas berhasil disimpan!');
        } else {
            throw new Error(result.error || 'Gagal menyimpan');
        }
    } catch (error) {
        addLogEntry('✗ Gagal sync: ' + error.message, 'error');
        alert('Gagal sync: ' + error.message);
    }
}

function addLogEntry(message, type) {
    const container = document.getElementById('log-entries');
    const emptyMsg = container.querySelector('.log-empty');
    if (emptyMsg) emptyMsg.remove();
    
    const time = new Date().toLocaleTimeString('id-ID');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `
        <span class="log-time">${time}</span>
        <span class="log-message ${type}">${message}</span>
    `;
    
    container.insertBefore(entry, container.firstChild);
    
    // Keep only last 10 entries
    while (container.children.length > 10) {
        container.removeChild(container.lastChild);
    }
}

// ==================== DATA MANAGEMENT ====================
function exportAllData() {
    const data = {
        version: '2.0',
        exportDate: new Date().toISOString(),
        theme: AppState.theme,
        checklist: AppState.checklist,
        reflections: AppState.reflections,
        timer: {
            settings: AppState.timer.settings,
            stats: AppState.timer.stats,
            sound: AppState.timer.sound
        },
        pairwise: {
            options: AppState.pairwise.options
        },
        kanban: {
            tasks: AppState.kanban.tasks,
            taskIdCounter: AppState.kanban.taskIdCounter
        },
        gsheet: AppState.gsheet
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sync-planner-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importAllData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            
            if (data.checklist) AppState.checklist = data.checklist;
            if (data.reflections) AppState.reflections = data.reflections;
            if (data.timer) {
                if (data.timer.settings) AppState.timer.settings = data.timer.settings;
                if (data.timer.stats) AppState.timer.stats = data.timer.stats;
                if (data.timer.sound) AppState.timer.sound = data.timer.sound;
            }
            if (data.pairwise?.options) AppState.pairwise.options = data.pairwise.options;
            if (data.kanban) {
                if (data.kanban.tasks) AppState.kanban.tasks = data.kanban.tasks;
                if (data.kanban.taskIdCounter) AppState.kanban.taskIdCounter = data.kanban.taskIdCounter;
            }
            if (data.gsheet) AppState.gsheet = data.gsheet;
            if (data.theme) setTheme(data.theme);
            
            saveToLocalStorage();
            
            // Reload UI
            loadChecklistState();
            loadReflections();
            loadTimerSettings();
            renderOptionsList();
            renderKanbanTasks();
            loadGSheetSettings();
            
            alert('Data berhasil diimport!');
        } catch (error) {
            alert('File tidak valid: ' + error.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function clearAllData() {
    if (confirm('PERINGATAN: Semua data akan dihapus! Lanjutkan?')) {
        if (confirm('Yakin? Tindakan ini tidak bisa dibatalkan.')) {
            localStorage.removeItem('sync-planner-data');
            location.reload();
        }
    }
}

// ==================== LOCAL STORAGE ====================
function saveToLocalStorage() {
    try {
        const data = {
            checklist: AppState.checklist,
            reflections: AppState.reflections,
            timer: {
                settings: AppState.timer.settings,
                stats: AppState.timer.stats,
                sound: AppState.timer.sound,
                currentSession: AppState.timer.currentSession
            },
            pairwise: {
                options: AppState.pairwise.options,
                scores: AppState.pairwise.scores
            },
            kanban: {
                tasks: AppState.kanban.tasks,
                taskIdCounter: AppState.kanban.taskIdCounter
            },
            gsheet: AppState.gsheet,
            lastSaved: new Date().toISOString()
        };
        
        localStorage.setItem('sync-planner-data', JSON.stringify(data));
    } catch (error) {
        console.error('Failed to save to localStorage:', error);
        // Handle quota exceeded
        if (error.name === 'QuotaExceededError') {
            alert('Storage penuh! Hapus beberapa data atau export backup.');
        }
    }
}

function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem('sync-planner-data');
        if (!saved) return;
        
        const data = JSON.parse(saved);
        
        // Check if data is from today (for checklist reset)
        const lastSaved = new Date(data.lastSaved);
        const today = new Date();
        const isNewDay = lastSaved.toDateString() !== today.toDateString();
        
        if (isNewDay) {
            // Reset daily data
            AppState.checklist = [];
            AppState.reflections = { good: '', improve: '', gratitude: '', sedona: '' };
            AppState.timer.stats = { pomodoros: 0, focusTime: 0, breaks: 0, streak: 0 };
            AppState.timer.currentSession = 1;
        } else {
            if (data.checklist) AppState.checklist = data.checklist;
            if (data.reflections) AppState.reflections = data.reflections;
            if (data.timer?.stats) AppState.timer.stats = data.timer.stats;
            if (data.timer?.currentSession) AppState.timer.currentSession = data.timer.currentSession;
        }
        
        // Load persistent data
        if (data.timer?.settings) AppState.timer.settings = data.timer.settings;
        if (data.timer?.sound) AppState.timer.sound = data.timer.sound;
        if (data.pairwise?.options) AppState.pairwise.options = data.pairwise.options;
        if (data.pairwise?.scores) AppState.pairwise.scores = data.pairwise.scores;
        if (data.kanban?.tasks) AppState.kanban.tasks = data.kanban.tasks;
        if (data.kanban?.taskIdCounter) AppState.kanban.taskIdCounter = data.kanban.taskIdCounter;
        if (data.gsheet) AppState.gsheet = data.gsheet;
        
        // Update UI
        loadChecklistState();
        loadReflections();
        loadTimerSettings();
        renderOptionsList();
        loadGSheetSettings();
        
    } catch (error) {
        console.error('Failed to load from localStorage:', error);
    }
}

// ==================== PWA ====================
let deferredPrompt;

function initPWA() {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
    
    // Register service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed:', err));
    }
    
    // Listen for install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        // Show install banner if not dismissed recently
        const dismissed = localStorage.getItem('pwa-banner-dismissed');
        const dismissedTime = dismissed ? parseInt(dismissed) : 0;
        const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
        
        if (daysSinceDismissed > 7) {
            document.getElementById('pwa-install-banner').classList.add('show');
        }
    });
}

function installPWA() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choice) => {
            if (choice.outcome === 'accepted') {
                console.log('PWA installed');
            }
            deferredPrompt = null;
            document.getElementById('pwa-install-banner').classList.remove('show');
        });
    }
}

function dismissPWABanner() {
    document.getElementById('pwa-install-banner').classList.remove('show');
    localStorage.setItem('pwa-banner-dismissed', Date.now().toString());
}

// ==================== UTILITIES ====================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Close modal on outside click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        closeTaskModal();
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // ESC to close modal
    if (e.key === 'Escape') {
        closeTaskModal();
    }
    
    // Ctrl/Cmd + S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveToLocalStorage();
    }
});
