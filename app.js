// ==================== SYNC PLANNER v3.1 ====================
// With Header Sync Control & Deep Work Integration

// ==================== APP STATE ====================
const AppState = {
    // Checklist
    checklist: Array(10).fill(false),
    
    // Reflections
    reflections: {
        good: '',
        improve: '',
        gratitude: '',
        sedona: ''
    },
    
    // Deep Work Sessions
    deepWork: {
        tasks: ['', '', '', ''],
        completed: [false, false, false, false],
        currentSession: 0
    },
    
    // Pomodoro Timer
    timer: {
        mode: 'work',
        timeLeft: 25 * 60,
        totalTime: 25 * 60,
        isRunning: false,
        interval: null,
        session: 1,
        pomodoros: 0,
        focusTime: 0,
        breaks: 0,
        streak: 0,
        currentTask: ''
    },
    
    // Timer Settings
    timerSettings: {
        work: 25,
        shortBreak: 5,
        longBreak: 15,
        soundEnabled: true,
        volume: 50
    },
    
    // Pairwise
    pairwise: {
        options: [],
        comparisons: [],
        currentIndex: 0,
        scores: {},
        results: []
    },
    
    // Kanban
    tasks: [],
    
    // Sync
    sync: {
        enabled: false,
        interval: 5,
        intervalId: null,
        lastSync: null,
        isSyncing: false,
        connected: false,
        gsheetUrl: ''
    },
    
    // History for Progress
    history: [],
    
    // Logs
    logs: []
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    loadFromLocalStorage();
    initializeUI();
    updateDate();
    initializeSync();
    
    // Auto-update timer display in planner
    setInterval(updatePlannerTimerDisplay, 1000);
});

function initializeUI() {
    updateChecklistUI();
    updateProgressBar();
    updateReflectionsUI();
    updateDeepWorkUI();
    updateTimerDisplay();
    updatePomodoroStats();
    renderKanbanBoard();
    updateKanbanStats();
    loadTheme();
    showProgress('week');
}

function updateDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = new Date().toLocaleDateString('id-ID', options);
    document.getElementById('current-date').textContent = dateStr;
}

// ==================== SYNC PANEL (HEADER) ====================
function toggleSyncPanel() {
    const panel = document.getElementById('sync-panel');
    panel.classList.toggle('show');
}

function updateSyncStatusUI() {
    const icon = document.getElementById('sync-icon');
    const label = document.getElementById('sync-label');
    const connectionRow = document.getElementById('sync-connection-row');
    const headerConnection = document.getElementById('header-connection-text');
    
    if (AppState.sync.isSyncing) {
        icon.textContent = '🔄';
        icon.classList.add('spinning');
        label.textContent = 'Syncing...';
    } else if (AppState.sync.connected) {
        icon.classList.remove('spinning');
        if (AppState.sync.enabled) {
            icon.textContent = '🟢';
            label.textContent = 'Auto Sync';
        } else {
            icon.textContent = '🔵';
            label.textContent = 'Connected';
        }
        headerConnection.innerHTML = '🟢 Terhubung';
    } else {
        icon.classList.remove('spinning');
        icon.textContent = '⚪';
        label.textContent = 'Offline';
        headerConnection.innerHTML = '⚪ Belum terhubung';
    }
    
    // Update last sync time
    const lastSyncEl = document.getElementById('header-last-sync');
    if (AppState.sync.lastSync) {
        const time = new Date(AppState.sync.lastSync);
        lastSyncEl.textContent = time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } else {
        lastSyncEl.textContent = 'Belum pernah';
    }
    
    // Sync header controls with state
    document.getElementById('header-auto-sync').checked = AppState.sync.enabled;
    document.getElementById('header-sync-interval').value = AppState.sync.interval;
}

function updateAutoSyncFromHeader() {
    AppState.sync.enabled = document.getElementById('header-auto-sync').checked;
    AppState.sync.interval = parseInt(document.getElementById('header-sync-interval').value);
    
    if (AppState.sync.enabled && AppState.sync.connected) {
        startAutoSync();
    } else {
        stopAutoSync();
    }
    
    updateSyncStatusUI();
    saveToLocalStorage();
    addLog(AppState.sync.enabled ? 'Auto sync diaktifkan' : 'Auto sync dinonaktifkan');
}

function initializeSync() {
    // Load saved URL
    const savedUrl = localStorage.getItem('syncplanner_gsheet_url');
    if (savedUrl) {
        AppState.sync.gsheetUrl = savedUrl;
        document.getElementById('gsheet-url').value = savedUrl;
        
        // Test connection silently
        testConnectionSilent();
    }
    
    updateSyncStatusUI();
}

async function testConnectionSilent() {
    if (!AppState.sync.gsheetUrl) return;
    
    try {
        const response = await fetch(AppState.sync.gsheetUrl + '?type=sync');
        if (response.ok) {
            AppState.sync.connected = true;
            
            // Start auto sync if enabled
            if (AppState.sync.enabled) {
                startAutoSync();
            }
        }
    } catch (e) {
        AppState.sync.connected = false;
    }
    
    updateSyncStatusUI();
    updateConnectionStatus();
}

function startAutoSync() {
    stopAutoSync();
    
    if (!AppState.sync.enabled || !AppState.sync.connected) return;
    
    const intervalMs = AppState.sync.interval * 60 * 1000;
    AppState.sync.intervalId = setInterval(() => {
        performAutoSync();
    }, intervalMs);
    
    addLog(`Auto sync aktif (setiap ${AppState.sync.interval} menit)`);
}

function stopAutoSync() {
    if (AppState.sync.intervalId) {
        clearInterval(AppState.sync.intervalId);
        AppState.sync.intervalId = null;
    }
}

async function manualSync() {
    if (!AppState.sync.gsheetUrl) {
        alert('Silakan masukkan URL Google Apps Script di Settings terlebih dahulu.');
        return;
    }
    
    await performAutoSync();
}

async function performAutoSync() {
    if (AppState.sync.isSyncing || !AppState.sync.gsheetUrl) return;
    
    AppState.sync.isSyncing = true;
    updateSyncStatusUI();
    
    try {
        const today = new Date().toLocaleDateString('id-ID');
        
        // Prepare data
        const syncData = {
            type: 'fullSync',
            tasks: AppState.tasks,
            daily: {
                date: today,
                checklist: AppState.checklist,
                reflections: AppState.reflections,
                deepWork: AppState.deepWork,
                pomodoros: AppState.timer.pomodoros,
                focusTime: AppState.timer.focusTime
            }
        };
        
        const response = await fetch(AppState.sync.gsheetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(syncData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            AppState.sync.lastSync = new Date().toISOString();
            AppState.sync.connected = true;
            addLog('✅ Sync berhasil', 'success');
            saveToLocalStorage();
        } else {
            throw new Error(result.error || 'Sync gagal');
        }
    } catch (error) {
        addLog('❌ Sync gagal: ' + error.message, 'error');
    } finally {
        AppState.sync.isSyncing = false;
        updateSyncStatusUI();
    }
}

// ==================== THEME ====================
function toggleTheme() {
    const body = document.body;
    const isDark = body.getAttribute('data-theme') === 'dark';
    body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    document.querySelector('.theme-icon').textContent = isDark ? '🌙' : '☀️';
    localStorage.setItem('syncplanner_theme', isDark ? 'light' : 'dark');
}

function loadTheme() {
    const savedTheme = localStorage.getItem('syncplanner_theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    document.querySelector('.theme-icon').textContent = savedTheme === 'dark' ? '☀️' : '🌙';
}

// ==================== NAVIGATION ====================
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabName + '-tab').classList.add('active');
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    if (tabName === 'progress') {
        showProgress('week');
    }
}

// ==================== CHECKLIST ====================
function toggleCheck(element) {
    const index = parseInt(element.dataset.index);
    AppState.checklist[index] = !AppState.checklist[index];
    element.classList.toggle('checked');
    updateProgressBar();
    saveToLocalStorage();
    triggerAutoSync();
}

function updateChecklistUI() {
    const items = document.querySelectorAll('.checklist-item');
    items.forEach((item, index) => {
        if (AppState.checklist[index]) {
            item.classList.add('checked');
        } else {
            item.classList.remove('checked');
        }
    });
}

function updateProgressBar() {
    const completed = AppState.checklist.filter(Boolean).length;
    const total = AppState.checklist.length;
    const percent = Math.round((completed / total) * 100);
    
    document.getElementById('progress-fill').style.width = percent + '%';
    document.getElementById('progress-text').textContent = percent + '%';
}

// ==================== REFLECTIONS ====================
function saveReflections() {
    AppState.reflections = {
        good: document.getElementById('reflection-good').value,
        improve: document.getElementById('reflection-improve').value,
        gratitude: document.getElementById('reflection-gratitude').value,
        sedona: document.getElementById('reflection-sedona').value
    };
    saveToLocalStorage();
    triggerAutoSync();
}

function updateReflectionsUI() {
    document.getElementById('reflection-good').value = AppState.reflections.good || '';
    document.getElementById('reflection-improve').value = AppState.reflections.improve || '';
    document.getElementById('reflection-gratitude').value = AppState.reflections.gratitude || '';
    document.getElementById('reflection-sedona').value = AppState.reflections.sedona || '';
}

// ==================== DEEP WORK ====================
function saveDeepWorkTasks() {
    for (let i = 1; i <= 4; i++) {
        const input = document.getElementById('dw-task-' + i);
        if (input) {
            AppState.deepWork.tasks[i - 1] = input.value;
        }
    }
    saveToLocalStorage();
}

function updateDeepWorkUI() {
    // Update task inputs
    for (let i = 1; i <= 4; i++) {
        const input = document.getElementById('dw-task-' + i);
        const status = document.getElementById('dw-status-' + i);
        
        if (input) {
            input.value = AppState.deepWork.tasks[i - 1] || '';
        }
        
        if (status) {
            if (AppState.deepWork.completed[i - 1]) {
                status.textContent = '✅';
            } else if (AppState.deepWork.currentSession === i && AppState.timer.isRunning) {
                status.textContent = '🔥';
            } else {
                status.textContent = '⏸️';
            }
        }
    }
}

function startDeepWorkSession(sessionNum) {
    // Set current task from deep work
    const taskInput = document.getElementById('dw-task-' + sessionNum);
    const taskName = taskInput ? taskInput.value : 'Sesi ' + sessionNum;
    
    // Update app state
    AppState.deepWork.currentSession = sessionNum;
    AppState.timer.currentTask = taskName || 'Deep Work Sesi ' + sessionNum;
    
    // Reset timer to work mode
    setTimerMode('work');
    
    // Switch to pomodoro tab
    switchTab('pomodoro');
    
    // Update current task display
    document.getElementById('current-task-name').textContent = AppState.timer.currentTask;
    
    // Start the timer
    startTimer();
    
    // Update deep work UI
    updateDeepWorkUI();
}

function updatePlannerTimerDisplay() {
    // Update mini timer in planner
    const timerEl = document.getElementById('planner-timer');
    const modeEl = document.getElementById('planner-mode');
    const pomodorosEl = document.getElementById('planner-pomodoros');
    const focusEl = document.getElementById('planner-focus');
    
    if (timerEl) {
        const minutes = Math.floor(AppState.timer.timeLeft / 60);
        const seconds = AppState.timer.timeLeft % 60;
        timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    if (modeEl) {
        if (AppState.timer.isRunning) {
            modeEl.textContent = AppState.timer.mode === 'work' ? '🔥 Fokus' : '☕ Istirahat';
        } else {
            modeEl.textContent = 'Ready';
        }
    }
    
    if (pomodorosEl) {
        pomodorosEl.textContent = AppState.timer.pomodoros;
    }
    
    if (focusEl) {
        focusEl.textContent = AppState.timer.focusTime + 'm';
    }
    
    // Update deep work statuses
    updateDeepWorkUI();
}

// ==================== POMODORO TIMER ====================
function setTimerMode(mode) {
    AppState.timer.mode = mode;
    
    let duration;
    switch (mode) {
        case 'work':
            duration = AppState.timerSettings.work * 60;
            break;
        case 'short-break':
            duration = AppState.timerSettings.shortBreak * 60;
            break;
        case 'long-break':
            duration = AppState.timerSettings.longBreak * 60;
            break;
    }
    
    AppState.timer.timeLeft = duration;
    AppState.timer.totalTime = duration;
    
    // Update UI
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
    
    const progress = document.getElementById('timer-progress');
    progress.classList.remove('work', 'short-break', 'long-break');
    progress.classList.add(mode);
    
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const minutes = Math.floor(AppState.timer.timeLeft / 60);
    const seconds = AppState.timer.timeLeft % 60;
    
    document.getElementById('timer-display').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    const modeLabels = {
        'work': 'Deep Work',
        'short-break': 'Istirahat Pendek',
        'long-break': 'Istirahat Panjang'
    };
    document.getElementById('timer-mode-label').textContent = modeLabels[AppState.timer.mode];
    
    // Update ring progress
    const progress = (AppState.timer.totalTime - AppState.timer.timeLeft) / AppState.timer.totalTime;
    const circumference = 2 * Math.PI * 130;
    document.getElementById('timer-progress').style.strokeDashoffset = circumference * (1 - progress);
    
    document.getElementById('session-info').textContent = `Sesi ${AppState.timer.session} dari 4 🍅`;
}

function startTimer() {
    if (AppState.timer.isRunning) return;
    
    AppState.timer.isRunning = true;
    document.getElementById('btn-timer-start').style.display = 'none';
    document.getElementById('btn-timer-pause').style.display = 'inline-flex';
    
    AppState.timer.interval = setInterval(() => {
        AppState.timer.timeLeft--;
        
        if (AppState.timer.mode === 'work') {
            AppState.timer.focusTime++;
        }
        
        updateTimerDisplay();
        
        if (AppState.timer.timeLeft <= 0) {
            timerComplete();
        }
    }, 1000);
}

function pauseTimer() {
    AppState.timer.isRunning = false;
    clearInterval(AppState.timer.interval);
    
    document.getElementById('btn-timer-start').style.display = 'inline-flex';
    document.getElementById('btn-timer-pause').style.display = 'none';
}

function resetTimer() {
    pauseTimer();
    setTimerMode(AppState.timer.mode);
}

function skipTimer() {
    pauseTimer();
    timerComplete();
}

function timerComplete() {
    pauseTimer();
    playNotificationSound();
    
    if (AppState.timer.mode === 'work') {
        AppState.timer.pomodoros++;
        AppState.timer.streak++;
        
        // Mark deep work session as complete
        if (AppState.deepWork.currentSession > 0) {
            AppState.deepWork.completed[AppState.deepWork.currentSession - 1] = true;
            updateSessionDot(AppState.deepWork.currentSession, true);
        }
        
        AppState.timer.session++;
        
        // Auto switch to break
        if (AppState.timer.session > 4) {
            AppState.timer.session = 1;
            setTimerMode('long-break');
        } else {
            setTimerMode('short-break');
        }
        
        // Check if all 4 deep work sessions completed
        const completedSessions = AppState.deepWork.completed.filter(Boolean).length;
        if (completedSessions >= 4) {
            // Auto check the deep work item in checklist
            AppState.checklist[4] = true;
            updateChecklistUI();
            updateProgressBar();
        }
    } else {
        AppState.timer.breaks++;
        setTimerMode('work');
    }
    
    updatePomodoroStats();
    updateDeepWorkUI();
    saveToLocalStorage();
    triggerAutoSync();
    
    // Show notification
    if (Notification.permission === 'granted') {
        new Notification('Sync Planner', {
            body: AppState.timer.mode === 'work' ? 'Waktu istirahat!' : 'Kembali fokus!',
            icon: '🍅'
        });
    }
}

function updateSessionDot(session, completed) {
    const dot = document.getElementById('session-dot-' + session);
    if (dot) {
        if (completed) {
            dot.classList.add('completed');
        } else {
            dot.classList.remove('completed');
        }
    }
}

function updatePomodoroStats() {
    document.getElementById('stat-pomodoros').textContent = AppState.timer.pomodoros;
    document.getElementById('stat-focus-time').textContent = Math.floor(AppState.timer.focusTime / 60) + 'm';
    document.getElementById('stat-breaks').textContent = AppState.timer.breaks;
    document.getElementById('stat-streak').textContent = AppState.timer.streak;
    
    // Update session dots
    for (let i = 1; i <= 4; i++) {
        updateSessionDot(i, AppState.deepWork.completed[i - 1]);
    }
}

function updateTimerSettings() {
    AppState.timerSettings.work = parseInt(document.getElementById('setting-work').value) || 25;
    AppState.timerSettings.shortBreak = parseInt(document.getElementById('setting-short-break').value) || 5;
    AppState.timerSettings.longBreak = parseInt(document.getElementById('setting-long-break').value) || 15;
    
    if (!AppState.timer.isRunning) {
        setTimerMode(AppState.timer.mode);
    }
    
    saveToLocalStorage();
}

function updateSoundSettings() {
    AppState.timerSettings.soundEnabled = document.getElementById('sound-enabled').checked;
    AppState.timerSettings.volume = parseInt(document.getElementById('sound-volume').value);
    saveToLocalStorage();
}

function playNotificationSound() {
    if (!AppState.timerSettings.soundEnabled) return;
    
    const audio = document.getElementById('notification-sound');
    audio.volume = AppState.timerSettings.volume / 100;
    audio.play().catch(() => {});
}

function testSound() {
    playNotificationSound();
}

// ==================== PAIRWISE COMPARISON ====================
function addOption() {
    const input = document.getElementById('option-input');
    const text = input.value.trim();
    
    if (!text) return;
    if (AppState.pairwise.options.length >= 10) {
        alert('Maksimal 10 opsi');
        return;
    }
    
    AppState.pairwise.options.push(text);
    input.value = '';
    renderOptions();
}

function handleOptionKeypress(e) {
    if (e.key === 'Enter') addOption();
}

function removeOption(index) {
    AppState.pairwise.options.splice(index, 1);
    renderOptions();
}

function clearAllOptions() {
    AppState.pairwise.options = [];
    renderOptions();
    resetComparison();
}

function renderOptions() {
    const container = document.getElementById('options-list');
    const count = document.getElementById('options-count');
    const startBtn = document.getElementById('btn-start-comparison');
    
    count.textContent = AppState.pairwise.options.length + ' opsi';
    startBtn.disabled = AppState.pairwise.options.length < 3;
    
    if (AppState.pairwise.options.length === 0) {
        container.innerHTML = '<div class="empty-state"><span>📝</span><p>Tambahkan minimal 3 opsi.</p></div>';
        return;
    }
    
    container.innerHTML = AppState.pairwise.options.map((opt, i) => `
        <div class="option-item">
            <span class="option-number">${i + 1}</span>
            <span class="option-text">${opt}</span>
            <button class="option-delete" onclick="removeOption(${i})">✕</button>
        </div>
    `).join('');
}

function startComparison() {
    const options = AppState.pairwise.options;
    if (options.length < 3) return;
    
    // Generate all pairs
    AppState.pairwise.comparisons = [];
    AppState.pairwise.scores = {};
    
    options.forEach(opt => AppState.pairwise.scores[opt] = 0);
    
    for (let i = 0; i < options.length; i++) {
        for (let j = i + 1; j < options.length; j++) {
            AppState.pairwise.comparisons.push([options[i], options[j]]);
        }
    }
    
    // Shuffle
    AppState.pairwise.comparisons.sort(() => Math.random() - 0.5);
    AppState.pairwise.currentIndex = 0;
    
    document.getElementById('comparison-card').style.display = 'block';
    document.getElementById('results-card').style.display = 'none';
    
    showComparison();
}

function showComparison() {
    const pair = AppState.pairwise.comparisons[AppState.pairwise.currentIndex];
    
    document.getElementById('option-text-a').textContent = pair[0];
    document.getElementById('option-text-b').textContent = pair[1];
    
    const progress = ((AppState.pairwise.currentIndex) / AppState.pairwise.comparisons.length) * 100;
    document.getElementById('comparison-progress-fill').style.width = progress + '%';
    document.getElementById('comparison-progress-text').textContent = 
        `${AppState.pairwise.currentIndex + 1} / ${AppState.pairwise.comparisons.length}`;
}

function selectOption(choice) {
    const pair = AppState.pairwise.comparisons[AppState.pairwise.currentIndex];
    const winner = choice === 'a' ? pair[0] : pair[1];
    
    AppState.pairwise.scores[winner]++;
    AppState.pairwise.currentIndex++;
    
    if (AppState.pairwise.currentIndex >= AppState.pairwise.comparisons.length) {
        showResults();
    } else {
        showComparison();
    }
}

function showResults() {
    document.getElementById('comparison-card').style.display = 'none';
    document.getElementById('results-card').style.display = 'block';
    
    // Sort by score
    const sorted = Object.entries(AppState.pairwise.scores)
        .sort((a, b) => b[1] - a[1]);
    
    AppState.pairwise.results = sorted;
    
    const container = document.getElementById('results-list');
    const medals = ['🥇', '🥈', '🥉'];
    
    container.innerHTML = sorted.map(([text, score], i) => `
        <div class="result-item ${i < 3 ? 'rank-' + (i + 1) : ''}">
            <span class="result-rank">${medals[i] || '#' + (i + 1)}</span>
            <span class="result-text">${text}</span>
            <span class="result-score">${score} poin</span>
        </div>
    `).join('');
}

function resetComparison() {
    document.getElementById('comparison-card').style.display = 'none';
    document.getElementById('results-card').style.display = 'none';
    AppState.pairwise.currentIndex = 0;
}

// ==================== PAIRWISE TO KANBAN ====================
function addResultsToKanban() {
    if (AppState.pairwise.results.length === 0) return;
    
    const container = document.getElementById('pairwise-kanban-list');
    container.innerHTML = AppState.pairwise.results.map(([text], i) => `
        <div class="pairwise-item">
            <input type="checkbox" id="pk-${i}" checked>
            <label for="pk-${i}">
                <span class="pw-rank">#${i + 1}</span>
                <span class="pw-text">${text}</span>
            </label>
        </div>
    `).join('');
    
    document.getElementById('pairwise-kanban-modal').classList.add('active');
}

function closePairwiseKanbanModal() {
    document.getElementById('pairwise-kanban-modal').classList.remove('active');
}

function confirmAddToKanban() {
    const checkboxes = document.querySelectorAll('#pairwise-kanban-list input:checked');
    
    checkboxes.forEach((cb, i) => {
        const index = parseInt(cb.id.replace('pk-', ''));
        const [text] = AppState.pairwise.results[index];
        
        let priority = 'low';
        if (index === 0) priority = 'high';
        else if (index <= 2) priority = 'medium';
        
        const task = {
            id: Date.now() + index,
            title: text,
            column: 'todo',
            priority: priority,
            notes: `Dari Pairwise - Ranking #${index + 1}`,
            created: new Date().toISOString()
        };
        
        AppState.tasks.push(task);
    });
    
    renderKanbanBoard();
    updateKanbanStats();
    saveToLocalStorage();
    closePairwiseKanbanModal();
    
    alert('Berhasil ditambahkan ke Kanban!');
    switchTab('kanban');
}

// ==================== PAIRWISE TO DEEP WORK ====================
function addResultsToDeepWork() {
    if (AppState.pairwise.results.length === 0) return;
    
    const container = document.getElementById('pairwise-deepwork-list');
    const maxItems = Math.min(4, AppState.pairwise.results.length);
    
    container.innerHTML = AppState.pairwise.results.slice(0, maxItems).map(([text], i) => `
        <div class="pairwise-item">
            <input type="checkbox" id="pdw-${i}" checked>
            <label for="pdw-${i}">
                <span class="pw-rank">#${i + 1}</span>
                <span class="pw-text">${text}</span>
            </label>
        </div>
    `).join('');
    
    document.getElementById('pairwise-deepwork-modal').classList.add('active');
}

function closePairwiseDeepWorkModal() {
    document.getElementById('pairwise-deepwork-modal').classList.remove('active');
}

function confirmAddToDeepWork() {
    const checkboxes = document.querySelectorAll('#pairwise-deepwork-list input:checked');
    let sessionIndex = 0;
    
    checkboxes.forEach(cb => {
        if (sessionIndex >= 4) return;
        
        const index = parseInt(cb.id.replace('pdw-', ''));
        const [text] = AppState.pairwise.results[index];
        
        AppState.deepWork.tasks[sessionIndex] = text;
        document.getElementById('dw-task-' + (sessionIndex + 1)).value = text;
        sessionIndex++;
    });
    
    saveToLocalStorage();
    closePairwiseDeepWorkModal();
    
    alert('Berhasil ditambahkan ke Deep Work!');
    switchTab('planner');
}

// ==================== KANBAN BOARD ====================
function quickAddTask() {
    const input = document.getElementById('quick-task-input');
    const priority = document.getElementById('quick-task-priority').value;
    const title = input.value.trim();
    
    if (!title) return;
    
    const task = {
        id: Date.now(),
        title: title,
        column: 'todo',
        priority: priority,
        notes: '',
        created: new Date().toISOString()
    };
    
    AppState.tasks.push(task);
    input.value = '';
    
    renderKanbanBoard();
    updateKanbanStats();
    saveToLocalStorage();
    triggerAutoSync();
}

function handleQuickTaskKeypress(e) {
    if (e.key === 'Enter') quickAddTask();
}

function renderKanbanBoard() {
    const columns = ['backlog', 'todo', 'inprogress', 'done'];
    
    columns.forEach(col => {
        const container = document.getElementById('column-' + col);
        const tasks = AppState.tasks.filter(t => t.column === col);
        
        container.innerHTML = tasks.map(task => `
            <div class="task-card priority-${task.priority}" draggable="true" 
                 ondragstart="handleDragStart(event, '${task.id}')"
                 ondragend="handleDragEnd(event)">
                <div class="task-header">
                    <span class="task-title">${task.title}</span>
                    <div class="task-actions">
                        <button class="task-btn" onclick="editTask('${task.id}')">✏️</button>
                        <button class="task-btn delete" onclick="quickDeleteTask('${task.id}')">🗑️</button>
                    </div>
                </div>
                <span class="task-priority ${task.priority}">${getPriorityLabel(task.priority)}</span>
                ${task.notes ? `<div class="task-notes">${task.notes}</div>` : ''}
            </div>
        `).join('');
        
        document.getElementById('count-' + col).textContent = tasks.length;
    });
}

function getPriorityLabel(priority) {
    const labels = { high: '🔴 Tinggi', medium: '🟡 Sedang', low: '🟢 Rendah' };
    return labels[priority] || priority;
}

function updateKanbanStats() {
    document.getElementById('stat-total').textContent = AppState.tasks.length;
    document.getElementById('stat-in-progress').textContent = 
        AppState.tasks.filter(t => t.column === 'inprogress').length;
    document.getElementById('stat-done').textContent = 
        AppState.tasks.filter(t => t.column === 'done').length;
}

// Drag and Drop
let draggedTaskId = null;

function handleDragStart(e, taskId) {
    draggedTaskId = taskId;
    e.target.classList.add('dragging');
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
}

function handleDragOver(e) {
    e.preventDefault();
}

function handleDrop(e, column) {
    e.preventDefault();
    
    const task = AppState.tasks.find(t => t.id.toString() === draggedTaskId);
    if (task) {
        task.column = column;
        
        if (column === 'done' && !task.completed) {
            task.completed = new Date().toISOString();
        }
        
        renderKanbanBoard();
        updateKanbanStats();
        saveToLocalStorage();
        triggerAutoSync();
    }
    
    draggedTaskId = null;
}

// Task Modal
function editTask(taskId) {
    const task = AppState.tasks.find(t => t.id.toString() === taskId);
    if (!task) return;
    
    document.getElementById('edit-task-id').value = task.id;
    document.getElementById('edit-task-title').value = task.title;
    document.getElementById('edit-task-priority').value = task.priority;
    document.getElementById('edit-task-column').value = task.column;
    document.getElementById('edit-task-notes').value = task.notes || '';
    
    document.getElementById('task-modal').classList.add('active');
}

function closeTaskModal() {
    document.getElementById('task-modal').classList.remove('active');
}

function saveTaskEdit() {
    const taskId = document.getElementById('edit-task-id').value;
    const task = AppState.tasks.find(t => t.id.toString() === taskId);
    
    if (task) {
        task.title = document.getElementById('edit-task-title').value;
        task.priority = document.getElementById('edit-task-priority').value;
        task.column = document.getElementById('edit-task-column').value;
        task.notes = document.getElementById('edit-task-notes').value;
        
        renderKanbanBoard();
        updateKanbanStats();
        saveToLocalStorage();
        triggerAutoSync();
    }
    
    closeTaskModal();
}

function deleteTask() {
    const taskId = document.getElementById('edit-task-id').value;
    AppState.tasks = AppState.tasks.filter(t => t.id.toString() !== taskId);
    
    renderKanbanBoard();
    updateKanbanStats();
    saveToLocalStorage();
    triggerAutoSync();
    closeTaskModal();
}

function quickDeleteTask(taskId) {
    if (confirm('Hapus tugas ini?')) {
        AppState.tasks = AppState.tasks.filter(t => t.id.toString() !== taskId);
        renderKanbanBoard();
        updateKanbanStats();
        saveToLocalStorage();
        triggerAutoSync();
    }
}

// ==================== PROGRESS REPORTS ====================
function showProgress(period) {
    // Update active button
    document.querySelectorAll('.period-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-period="${period}"]`).classList.add('active');
    
    // Load and display data
    loadProgressData(period);
}

function loadProgressData(period) {
    let days = 7;
    switch (period) {
        case 'month': days = 30; break;
        case 'quarter': days = 90; break;
        case 'year': days = 365; break;
    }
    
    // Calculate from history
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    const filteredHistory = AppState.history.filter(h => {
        const date = parseDate(h.date);
        return date >= startDate && date <= now;
    });
    
    // Calculate summary
    let totalPomodoros = 0;
    let totalFocus = 0;
    let totalChecklist = 0;
    
    filteredHistory.forEach(day => {
        totalPomodoros += day.pomodoros || 0;
        totalFocus += day.focusTime || 0;
        
        if (day.checklist) {
            const checked = day.checklist.filter(Boolean).length;
            totalChecklist += (checked / day.checklist.length) * 100;
        }
    });
    
    const avgChecklist = filteredHistory.length > 0 ? 
        Math.round(totalChecklist / filteredHistory.length) : 0;
    
    // Count completed tasks in period
    const completedTasks = AppState.tasks.filter(t => {
        if (t.column !== 'done' || !t.completed) return false;
        const completedDate = new Date(t.completed);
        return completedDate >= startDate && completedDate <= now;
    }).length;
    
    // Update UI
    document.getElementById('summary-tasks-completed').textContent = completedTasks;
    document.getElementById('summary-pomodoros').textContent = totalPomodoros;
    document.getElementById('summary-focus-hours').textContent = Math.round(totalFocus / 60) + 'h';
    document.getElementById('summary-checklist-avg').textContent = avgChecklist + '%';
    
    // Update ibadah stats
    updateIbadahStats(filteredHistory);
    
    // Render trend chart
    renderTrendChart(filteredHistory.slice(-14));
    
    // Render history list
    renderHistoryList(filteredHistory.slice(-10).reverse());
}

function updateIbadahStats(history) {
    const stats = {
        tahajud: 0,
        subuh: 0,
        dzikirPagi: 0,
        dzikirPetang: 0,
        deepwork: 0
    };
    
    const total = history.length || 1;
    
    history.forEach(day => {
        if (day.checklist) {
            if (day.checklist[0]) stats.tahajud++;
            if (day.checklist[1]) stats.subuh++;
            if (day.checklist[2]) stats.dzikirPagi++;
            if (day.checklist[7]) stats.dzikirPetang++;
            if (day.checklist[4]) stats.deepwork++;
        }
    });
    
    const items = [
        { id: 'tahajud', value: stats.tahajud },
        { id: 'subuh', value: stats.subuh },
        { id: 'dzikir-pagi', value: stats.dzikirPagi },
        { id: 'dzikir-petang', value: stats.dzikirPetang },
        { id: 'deepwork', value: stats.deepwork }
    ];
    
    items.forEach(item => {
        const pct = Math.round((item.value / total) * 100);
        const fill = document.getElementById('ibadah-' + item.id);
        const pctEl = document.getElementById('ibadah-' + item.id + '-pct');
        
        if (fill) fill.style.width = pct + '%';
        if (pctEl) pctEl.textContent = pct + '%';
    });
}

function renderTrendChart(days) {
    const container = document.getElementById('trend-chart');
    
    if (days.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Belum ada data trend.</p></div>';
        return;
    }
    
    const maxPct = 100;
    
    container.innerHTML = `
        <div class="chart-bars">
            ${days.map(day => {
                const checked = day.checklist ? day.checklist.filter(Boolean).length : 0;
                const pct = Math.round((checked / 10) * 100);
                const height = (pct / maxPct) * 150;
                
                let color = '#10b981';
                if (pct < 50) color = '#ef4444';
                else if (pct < 80) color = '#f59e0b';
                
                const dateStr = day.date.split('/').slice(0, 2).join('/');
                
                return `
                    <div class="chart-bar-container">
                        <div class="chart-bar" style="height: ${height}px; background: ${color};" title="${pct}%"></div>
                        <span class="chart-label">${dateStr}</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderHistoryList(days) {
    const container = document.getElementById('history-list');
    
    if (days.length === 0) {
        container.innerHTML = '<div class="empty-state"><span>📊</span><p>Belum ada data riwayat.</p></div>';
        return;
    }
    
    container.innerHTML = days.map(day => {
        const checked = day.checklist ? day.checklist.filter(Boolean).length : 0;
        const pct = Math.round((checked / 10) * 100);
        
        let statusClass = 'success';
        if (pct < 50) statusClass = 'danger';
        else if (pct < 80) statusClass = 'warning';
        
        return `
            <div class="history-item">
                <span class="history-date">${day.date}</span>
                <div class="history-stats">
                    <span class="history-checklist ${statusClass}">${pct}%</span>
                    <span class="history-pomodoro">🍅 ${day.pomodoros || 0}</span>
                    <span class="history-focus">⏱️ ${day.focusTime || 0}m</span>
                </div>
            </div>
        `;
    }).join('');
}

function parseDate(dateStr) {
    if (!dateStr) return new Date(0);
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return new Date(dateStr);
}

// ==================== SETTINGS & SYNC ====================
function toggleAppsScript() {
    const el = document.getElementById('apps-script-code');
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function copyAppsScript() {
    alert('Silakan download file Code.gs dari repository GitHub.');
}

async function testConnection() {
    const url = document.getElementById('gsheet-url').value.trim();
    if (!url) {
        alert('Masukkan URL terlebih dahulu');
        return;
    }
    
    const statusEl = document.getElementById('connection-status');
    statusEl.innerHTML = '<span class="status-icon">⏳</span><span class="status-text">Testing...</span>';
    
    try {
        const response = await fetch(url + '?type=sync');
        const data = await response.json();
        
        if (data.success) {
            AppState.sync.connected = true;
            statusEl.classList.add('connected');
            statusEl.innerHTML = '<span class="status-icon">🟢</span><span class="status-text">Terhubung!</span>';
            addLog('✅ Koneksi berhasil', 'success');
        } else {
            throw new Error('Response tidak valid');
        }
    } catch (e) {
        AppState.sync.connected = false;
        statusEl.classList.remove('connected');
        statusEl.classList.add('error');
        statusEl.innerHTML = '<span class="status-icon">🔴</span><span class="status-text">Gagal: ' + e.message + '</span>';
        addLog('❌ Koneksi gagal: ' + e.message, 'error');
    }
    
    updateSyncStatusUI();
}

function updateConnectionStatus() {
    const statusEl = document.getElementById('connection-status');
    if (AppState.sync.connected) {
        statusEl.classList.add('connected');
        statusEl.classList.remove('error');
        statusEl.innerHTML = '<span class="status-icon">🟢</span><span class="status-text">Terhubung</span>';
    } else {
        statusEl.classList.remove('connected');
        statusEl.innerHTML = '<span class="status-icon">⚪</span><span class="status-text">Belum terhubung</span>';
    }
}

function saveGSheetSettings() {
    const url = document.getElementById('gsheet-url').value.trim();
    AppState.sync.gsheetUrl = url;
    localStorage.setItem('syncplanner_gsheet_url', url);
    
    addLog('💾 URL disimpan');
    alert('URL berhasil disimpan!');
    
    testConnectionSilent();
}

async function syncTasksToSheet() {
    if (!AppState.sync.gsheetUrl) {
        alert('Masukkan URL terlebih dahulu');
        return;
    }
    
    try {
        const response = await fetch(AppState.sync.gsheetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'tasks', tasks: AppState.tasks })
        });
        
        const result = await response.json();
        if (result.success) {
            addLog('⬆️ Tasks uploaded', 'success');
            alert('Tasks berhasil diupload!');
        } else {
            throw new Error(result.error);
        }
    } catch (e) {
        addLog('❌ Upload gagal: ' + e.message, 'error');
        alert('Gagal: ' + e.message);
    }
}

async function loadTasksFromSheet() {
    if (!AppState.sync.gsheetUrl) {
        alert('Masukkan URL terlebih dahulu');
        return;
    }
    
    try {
        const response = await fetch(AppState.sync.gsheetUrl + '?type=tasks');
        const result = await response.json();
        
        if (result.success && result.data) {
            AppState.tasks = result.data;
            renderKanbanBoard();
            updateKanbanStats();
            saveToLocalStorage();
            addLog('⬇️ Tasks downloaded', 'success');
            alert('Tasks berhasil didownload!');
        }
    } catch (e) {
        addLog('❌ Download gagal: ' + e.message, 'error');
        alert('Gagal: ' + e.message);
    }
}

async function syncDailyToSheet() {
    if (!AppState.sync.gsheetUrl) {
        alert('Masukkan URL terlebih dahulu');
        return;
    }
    
    const today = new Date().toLocaleDateString('id-ID');
    
    try {
        const response = await fetch(AppState.sync.gsheetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'daily',
                date: today,
                checklist: AppState.checklist,
                reflections: AppState.reflections,
                deepWork: AppState.deepWork,
                pomodoros: AppState.timer.pomodoros,
                focusTime: AppState.timer.focusTime
            })
        });
        
        const result = await response.json();
        if (result.success) {
            addLog('⬆️ Daily data uploaded', 'success');
            alert('Data harian berhasil diupload!');
        }
    } catch (e) {
        addLog('❌ Upload gagal: ' + e.message, 'error');
        alert('Gagal: ' + e.message);
    }
}

async function loadDailyFromSheet() {
    if (!AppState.sync.gsheetUrl) {
        alert('Masukkan URL terlebih dahulu');
        return;
    }
    
    const today = new Date().toLocaleDateString('id-ID');
    
    try {
        const response = await fetch(AppState.sync.gsheetUrl + '?type=daily&date=' + encodeURIComponent(today));
        const result = await response.json();
        
        if (result.success && result.data) {
            AppState.checklist = result.data.checklist || Array(10).fill(false);
            AppState.reflections = result.data.reflections || {};
            AppState.timer.pomodoros = result.data.pomodoros || 0;
            AppState.timer.focusTime = result.data.focusTime || 0;
            
            if (result.data.deepWork) {
                AppState.deepWork = result.data.deepWork;
            }
            
            updateChecklistUI();
            updateProgressBar();
            updateReflectionsUI();
            updateDeepWorkUI();
            updatePomodoroStats();
            saveToLocalStorage();
            
            addLog('⬇️ Daily data downloaded', 'success');
            alert('Data harian berhasil didownload!');
        }
    } catch (e) {
        addLog('❌ Download gagal: ' + e.message, 'error');
        alert('Gagal: ' + e.message);
    }
}

// ==================== ACTIVITY LOG ====================
function addLog(message, type = 'info') {
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    
    AppState.logs.unshift({ time, message, type });
    AppState.logs = AppState.logs.slice(0, 50);
    
    renderLogs();
}

function renderLogs() {
    const container = document.getElementById('log-entries');
    
    if (AppState.logs.length === 0) {
        container.innerHTML = '<div class="log-empty">Belum ada aktivitas</div>';
        return;
    }
    
    container.innerHTML = AppState.logs.slice(0, 10).map(log => `
        <div class="log-entry">
            <span class="log-time">${log.time}</span>
            <span class="log-message ${log.type}">${log.message}</span>
        </div>
    `).join('');
}

// ==================== DATA MANAGEMENT ====================
function exportAllData() {
    const data = {
        version: '3.1',
        exportDate: new Date().toISOString(),
        checklist: AppState.checklist,
        reflections: AppState.reflections,
        deepWork: AppState.deepWork,
        timer: {
            pomodoros: AppState.timer.pomodoros,
            focusTime: AppState.timer.focusTime
        },
        timerSettings: AppState.timerSettings,
        tasks: AppState.tasks,
        history: AppState.history
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'syncplanner-backup-' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    URL.revokeObjectURL(url);
    
    addLog('📤 Data exported');
}

function importAllData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (data.checklist) AppState.checklist = data.checklist;
            if (data.reflections) AppState.reflections = data.reflections;
            if (data.deepWork) AppState.deepWork = data.deepWork;
            if (data.tasks) AppState.tasks = data.tasks;
            if (data.history) AppState.history = data.history;
            if (data.timerSettings) AppState.timerSettings = data.timerSettings;
            if (data.timer) {
                AppState.timer.pomodoros = data.timer.pomodoros || 0;
                AppState.timer.focusTime = data.timer.focusTime || 0;
            }
            
            saveToLocalStorage();
            initializeUI();
            
            addLog('📥 Data imported', 'success');
            alert('Data berhasil diimport!');
        } catch (err) {
            alert('Error: File tidak valid');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function clearAllData() {
    if (!confirm('Hapus SEMUA data? Ini tidak bisa dibatalkan!')) return;
    if (!confirm('Yakin? Ketik OK untuk konfirmasi.')) return;
    
    localStorage.removeItem('syncplanner_data');
    location.reload();
}

// ==================== LOCAL STORAGE ====================
function saveToLocalStorage() {
    const today = new Date().toLocaleDateString('id-ID');
    
    // Update today's history
    const todayIndex = AppState.history.findIndex(h => h.date === today);
    const todayData = {
        date: today,
        checklist: [...AppState.checklist],
        reflections: { ...AppState.reflections },
        deepWork: { ...AppState.deepWork },
        pomodoros: AppState.timer.pomodoros,
        focusTime: AppState.timer.focusTime
    };
    
    if (todayIndex >= 0) {
        AppState.history[todayIndex] = todayData;
    } else {
        AppState.history.push(todayData);
    }
    
    // Keep only last 365 days
    AppState.history = AppState.history.slice(-365);
    
    const data = {
        checklist: AppState.checklist,
        reflections: AppState.reflections,
        deepWork: AppState.deepWork,
        timer: {
            pomodoros: AppState.timer.pomodoros,
            focusTime: AppState.timer.focusTime,
            breaks: AppState.timer.breaks,
            streak: AppState.timer.streak
        },
        timerSettings: AppState.timerSettings,
        tasks: AppState.tasks,
        history: AppState.history,
        sync: {
            enabled: AppState.sync.enabled,
            interval: AppState.sync.interval,
            lastSync: AppState.sync.lastSync
        },
        lastSaved: new Date().toISOString()
    };
    
    localStorage.setItem('syncplanner_data', JSON.stringify(data));
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('syncplanner_data');
    if (!saved) return;
    
    try {
        const data = JSON.parse(saved);
        
        // Check if it's a new day
        const today = new Date().toLocaleDateString('id-ID');
        const lastDate = data.lastSaved ? new Date(data.lastSaved).toLocaleDateString('id-ID') : '';
        
        if (lastDate !== today) {
            // New day - reset daily data but keep history
            AppState.checklist = Array(10).fill(false);
            AppState.reflections = { good: '', improve: '', gratitude: '', sedona: '' };
            AppState.deepWork = { tasks: ['', '', '', ''], completed: [false, false, false, false], currentSession: 0 };
            AppState.timer.pomodoros = 0;
            AppState.timer.focusTime = 0;
            AppState.timer.breaks = 0;
            AppState.timer.session = 1;
        } else {
            if (data.checklist) AppState.checklist = data.checklist;
            if (data.reflections) AppState.reflections = data.reflections;
            if (data.deepWork) AppState.deepWork = data.deepWork;
            if (data.timer) {
                AppState.timer.pomodoros = data.timer.pomodoros || 0;
                AppState.timer.focusTime = data.timer.focusTime || 0;
                AppState.timer.breaks = data.timer.breaks || 0;
                AppState.timer.streak = data.timer.streak || 0;
            }
        }
        
        if (data.timerSettings) AppState.timerSettings = data.timerSettings;
        if (data.tasks) AppState.tasks = data.tasks;
        if (data.history) AppState.history = data.history;
        if (data.sync) {
            AppState.sync.enabled = data.sync.enabled || false;
            AppState.sync.interval = data.sync.interval || 5;
            AppState.sync.lastSync = data.sync.lastSync;
        }
        
    } catch (e) {
        console.error('Error loading data:', e);
    }
}

// Debounced auto sync trigger
let syncTimeout = null;
function triggerAutoSync() {
    if (!AppState.sync.enabled || !AppState.sync.connected) return;
    
    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
        performAutoSync();
    }, 5000);
}

// ==================== PWA ====================
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('pwa-install-banner').classList.add('show');
});

function installPWA() {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((result) => {
        deferredPrompt = null;
        document.getElementById('pwa-install-banner').classList.remove('show');
    });
}

function dismissPWABanner() {
    document.getElementById('pwa-install-banner').classList.remove('show');
}

// Register Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('SW registered'))
        .catch(err => console.log('SW error:', err));
}

// Request notification permission
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}
