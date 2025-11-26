// ==================== SYNC PLANNER - MAIN JAVASCRIPT ====================
// Version 3.0 - Auto Sync, Pairwise to Kanban, Progress Reports

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
        scores: {},
        lastResults: []
    },
    
    // Kanban
    kanban: {
        tasks: [],
        taskIdCounter: 1,
        draggedTask: null
    },
    
    // Google Sheets & Sync
    gsheet: {
        webAppUrl: ''
    },
    sync: {
        enabled: false,
        interval: 5,
        intervalId: null,
        lastSync: null,
        isSyncing: false
    },
    
    // Progress History
    history: []
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
    initAutoSync();
    renderKanbanTasks();
    updateProgress();
    console.log('🎯 Sync Planner v3.0 initialized');
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
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const targetTab = document.getElementById(`${tabName}-tab`);
    if (targetTab) {
        targetTab.classList.add('active');
    }
    
    const navBtn = document.querySelector(`.nav-tab[data-tab="${tabName}"]`);
    if (navBtn) {
        navBtn.classList.add('active');
    }
    
    // Load progress data when switching to progress tab
    if (tabName === 'progress') {
        showProgress('week');
    }
}

// ==================== CHECKLIST ====================
function toggleCheck(element) {
    element.classList.toggle('checked');
    updateProgress();
    saveChecklistState();
    triggerAutoSync();
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
    triggerAutoSync();
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
    
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.mode === mode) {
            btn.classList.add('active');
        }
    });
    
    const progressRing = document.getElementById('timer-progress');
    if (progressRing) {
        progressRing.className = `timer-ring-progress ${mode}`;
    }
    
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
    triggerAutoSync();
}

function updateTimerDisplay() {
    const minutes = Math.floor(AppState.timer.timeLeft / 60);
    const seconds = AppState.timer.timeLeft % 60;
    const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    document.getElementById('timer-display').textContent = display;
    document.title = `${display} - Sync Planner`;
    
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
    
    const circumference = 816.81;
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
    
    AppState.pairwise.comparisons = [];
    AppState.pairwise.scores = {};
    
    const opts = AppState.pairwise.options;
    for (let i = 0; i < opts.length; i++) {
        AppState.pairwise.scores[i] = 0;
        for (let j = i + 1; j < opts.length; j++) {
            AppState.pairwise.comparisons.push([i, j]);
        }
    }
    
    AppState.pairwise.comparisons.sort(() => Math.random() - 0.5);
    AppState.pairwise.currentIndex = 0;
    
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
    
    // Store results for later use
    AppState.pairwise.lastResults = results;
    
    const container = document.getElementById('results-list');
    container.innerHTML = results.map((item, rank) => {
        const rankClass = rank < 3 ? `rank-${rank + 1}` : '';
        const priorityLabel = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `#${rank + 1}`;
        return `
            <div class="result-item ${rankClass}">
                <span class="result-rank">${priorityLabel}</span>
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

// ==================== PAIRWISE TO KANBAN ====================
function addResultsToKanban() {
    if (!AppState.pairwise.lastResults || AppState.pairwise.lastResults.length === 0) {
        alert('Belum ada hasil pairwise!');
        return;
    }
    
    // Show modal with checkboxes
    const container = document.getElementById('pairwise-kanban-list');
    container.innerHTML = AppState.pairwise.lastResults.map((item, rank) => {
        const priority = rank === 0 ? 'high' : rank <= 2 ? 'medium' : 'low';
        const priorityLabel = rank === 0 ? '🥇 #1' : rank === 1 ? '🥈 #2' : rank === 2 ? '🥉 #3' : `#${rank + 1}`;
        return `
            <label class="pairwise-kanban-item">
                <input type="checkbox" value="${rank}" data-text="${escapeHtml(item.text)}" data-priority="${priority}" checked>
                <span class="pairwise-rank">${priorityLabel}</span>
                <span class="pairwise-text">${escapeHtml(item.text)}</span>
            </label>
        `;
    }).join('');
    
    document.getElementById('pairwise-kanban-modal').classList.add('active');
}

function closePairwiseKanbanModal() {
    document.getElementById('pairwise-kanban-modal').classList.remove('active');
}

function confirmAddToKanban() {
    const checkboxes = document.querySelectorAll('#pairwise-kanban-list input[type="checkbox"]:checked');
    let added = 0;
    
    checkboxes.forEach(cb => {
        const task = {
            id: AppState.kanban.taskIdCounter++,
            title: cb.dataset.text,
            column: 'todo',
            priority: cb.dataset.priority,
            notes: `Dari Pairwise - Ranking #${parseInt(cb.value) + 1}`,
            link: '',
            created: new Date().toISOString()
        };
        
        AppState.kanban.tasks.push(task);
        added++;
    });
    
    closePairwiseKanbanModal();
    renderKanbanTasks();
    saveToLocalStorage();
    triggerAutoSync();
    
    // Clear pairwise options after adding
    if (confirm(`${added} tugas berhasil ditambahkan ke Kanban!\n\nHapus opsi pairwise yang sudah ditambahkan?`)) {
        AppState.pairwise.options = [];
        AppState.pairwise.lastResults = [];
        renderOptionsList();
        document.getElementById('results-card').style.display = 'none';
    }
    
    // Switch to Kanban tab
    switchTab('kanban');
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
    triggerAutoSync();
}

function renderKanbanTasks() {
    ['backlog', 'todo', 'inprogress', 'done'].forEach(col => {
        const container = document.getElementById(`column-${col}`);
        if (container) container.innerHTML = '';
    });
    
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
        const oldColumn = task.column;
        task.column = column;
        
        // Track completion
        if (column === 'done' && oldColumn !== 'done') {
            task.completed = new Date().toISOString();
        }
        
        renderKanbanTasks();
        saveToLocalStorage();
        triggerAutoSync();
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
    
    const oldColumn = task.column;
    const newColumn = document.getElementById('edit-task-column').value;
    
    task.title = document.getElementById('edit-task-title').value.trim();
    task.priority = document.getElementById('edit-task-priority').value;
    task.column = newColumn;
    task.notes = document.getElementById('edit-task-notes').value.trim();
    task.link = document.getElementById('edit-task-link').value.trim();
    
    // Track completion
    if (newColumn === 'done' && oldColumn !== 'done') {
        task.completed = new Date().toISOString();
    }
    
    closeTaskModal();
    renderKanbanTasks();
    saveToLocalStorage();
    triggerAutoSync();
}

function deleteTask() {
    const taskId = parseInt(document.getElementById('edit-task-id').value);
    if (confirm('Hapus tugas ini?')) {
        AppState.kanban.tasks = AppState.kanban.tasks.filter(t => t.id !== taskId);
        closeTaskModal();
        renderKanbanTasks();
        saveToLocalStorage();
        triggerAutoSync();
    }
}

function quickDeleteTask(taskId) {
    if (confirm('Hapus tugas ini?')) {
        AppState.kanban.tasks = AppState.kanban.tasks.filter(t => t.id !== taskId);
        renderKanbanTasks();
        saveToLocalStorage();
        triggerAutoSync();
    }
}

// ==================== PROGRESS REPORTS ====================
function showProgress(period) {
    // Update button states
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.period === period) {
            btn.classList.add('active');
        }
    });
    
    // Load progress data
    if (AppState.gsheet.webAppUrl) {
        loadProgressFromSheet(period);
    } else {
        loadProgressFromLocal(period);
    }
}

function loadProgressFromLocal(period) {
    const now = new Date();
    let startDate = new Date();
    
    switch(period) {
        case 'week':
            startDate.setDate(now.getDate() - 7);
            break;
        case 'month':
            startDate.setMonth(now.getMonth() - 1);
            break;
        case 'quarter':
            startDate.setMonth(now.getMonth() - 3);
            break;
        case 'year':
            startDate.setFullYear(now.getFullYear() - 1);
            break;
    }
    
    // Filter history by period
    const filteredHistory = AppState.history.filter(entry => {
        const entryDate = new Date(entry.date.split('/').reverse().join('-'));
        return entryDate >= startDate;
    });
    
    // Calculate summary
    let totalPomodoros = 0;
    let totalFocus = 0;
    let totalChecklist = 0;
    let days = 0;
    
    filteredHistory.forEach(entry => {
        totalPomodoros += entry.pomodoros || 0;
        totalFocus += entry.focusTime || 0;
        const checked = entry.checklist?.filter(c => c).length || 0;
        const total = entry.checklist?.length || 10;
        totalChecklist += (checked / total) * 100;
        days++;
    });
    
    // Count completed tasks in period
    let completedTasks = 0;
    AppState.kanban.tasks.forEach(task => {
        if (task.column === 'done' && task.completed) {
            const completedDate = new Date(task.completed);
            if (completedDate >= startDate) {
                completedTasks++;
            }
        }
    });
    
    // Update UI
    updateProgressUI({
        tasksCompleted: completedTasks,
        totalPomodoros: totalPomodoros,
        focusHours: Math.round(totalFocus / 60 * 10) / 10,
        avgChecklist: days > 0 ? Math.round(totalChecklist / days) : 0
    }, filteredHistory);
}

async function loadProgressFromSheet(period) {
    try {
        showSyncIndicator('Memuat data progres...');
        
        const response = await fetch(`${AppState.gsheet.webAppUrl}?type=progress&period=${period}`, {
            method: 'GET',
            redirect: 'follow'
        });
        
        const result = await response.json();
        
        if (result.success && result.data) {
            updateProgressUI(result.data.summary, result.data.days);
        } else {
            loadProgressFromLocal(period);
        }
        
        hideSyncIndicator();
    } catch (error) {
        console.error('Failed to load progress:', error);
        loadProgressFromLocal(period);
        hideSyncIndicator();
    }
}

function updateProgressUI(summary, days) {
    // Update summary stats
    document.getElementById('summary-tasks-completed').textContent = summary.tasksCompleted || 0;
    document.getElementById('summary-pomodoros').textContent = summary.totalPomodoros || 0;
    document.getElementById('summary-focus-hours').textContent = `${summary.focusHours || 0}h`;
    document.getElementById('summary-checklist-avg').textContent = `${summary.avgChecklist || 0}%`;
    
    // Calculate ibadah stats from days data
    const ibadahStats = calculateIbadahStats(days);
    updateIbadahUI(ibadahStats);
    
    // Render trend chart
    renderTrendChart(days);
    
    // Render history list
    renderHistoryList(days);
}

function calculateIbadahStats(days) {
    if (!days || days.length === 0) {
        return { tahajud: 0, subuh: 0, dzikirPagi: 0, dzikirPetang: 0, olahraga: 0 };
    }
    
    let tahajud = 0, subuh = 0, dzikirPagi = 0, dzikirPetang = 0, olahraga = 0;
    const total = days.length;
    
    days.forEach(day => {
        if (day.checklist && day.checklist.length >= 10) {
            if (day.checklist[0]) tahajud++;
            if (day.checklist[1]) subuh++;
            if (day.checklist[2]) dzikirPagi++;
            if (day.checklist[7]) dzikirPetang++;
            if (day.checklist[3]) olahraga++;
        } else if (day.checklistPercent !== undefined) {
            // From sheet data, use average
            const pct = day.checklistPercent / 100;
            tahajud += pct > 0.7 ? 1 : 0;
            subuh += pct > 0.6 ? 1 : 0;
            dzikirPagi += pct > 0.5 ? 1 : 0;
            dzikirPetang += pct > 0.4 ? 1 : 0;
            olahraga += pct > 0.3 ? 1 : 0;
        }
    });
    
    return {
        tahajud: Math.round((tahajud / total) * 100),
        subuh: Math.round((subuh / total) * 100),
        dzikirPagi: Math.round((dzikirPagi / total) * 100),
        dzikirPetang: Math.round((dzikirPetang / total) * 100),
        olahraga: Math.round((olahraga / total) * 100)
    };
}

function updateIbadahUI(stats) {
    const ibadahItems = [
        { id: 'tahajud', value: stats.tahajud },
        { id: 'subuh', value: stats.subuh },
        { id: 'dzikir-pagi', value: stats.dzikirPagi },
        { id: 'dzikir-petang', value: stats.dzikirPetang },
        { id: 'olahraga', value: stats.olahraga }
    ];
    
    ibadahItems.forEach(item => {
        const fill = document.getElementById(`ibadah-${item.id}`);
        const pct = document.getElementById(`ibadah-${item.id}-pct`);
        if (fill) fill.style.width = `${item.value}%`;
        if (pct) pct.textContent = `${item.value}%`;
    });
}

function renderTrendChart(days) {
    const container = document.getElementById('trend-chart');
    if (!days || days.length === 0) {
        container.innerHTML = '<div class="empty-state"><span>📊</span><p>Belum ada data untuk ditampilkan</p></div>';
        return;
    }
    
    // Simple bar chart using CSS
    const maxPct = 100;
    const chartHtml = days.slice(-14).map((day, i) => {
        const pct = day.checklistPercent || 0;
        const date = day.date ? day.date.split('/').slice(0, 2).join('/') : `Day ${i + 1}`;
        const color = pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)';
        return `
            <div class="chart-bar-container">
                <div class="chart-bar" style="height: ${pct}%; background: ${color};" title="${pct}%"></div>
                <span class="chart-label">${date}</span>
            </div>
        `;
    }).join('');
    
    container.innerHTML = `<div class="chart-bars">${chartHtml}</div>`;
}

function renderHistoryList(days) {
    const container = document.getElementById('history-list');
    if (!days || days.length === 0) {
        container.innerHTML = '<div class="empty-state"><span>📊</span><p>Belum ada data riwayat</p></div>';
        return;
    }
    
    // Show last 10 days
    const recentDays = days.slice(-10).reverse();
    
    container.innerHTML = recentDays.map(day => {
        const pct = day.checklistPercent || 0;
        const statusClass = pct >= 80 ? 'success' : pct >= 50 ? 'warning' : 'danger';
        const pomodoros = day.pomodoros || 0;
        const focus = day.focusTime || 0;
        
        return `
            <div class="history-item">
                <div class="history-date">${day.date || 'N/A'}</div>
                <div class="history-stats">
                    <span class="history-checklist ${statusClass}">${pct}% checklist</span>
                    <span class="history-pomodoro">🍅 ${pomodoros}</span>
                    <span class="history-focus">⏱️ ${focus}m</span>
                </div>
            </div>
        `;
    }).join('');
}

// ==================== AUTO SYNC ====================
function initAutoSync() {
    const autoSyncCheckbox = document.getElementById('auto-sync-enabled');
    const syncIntervalSelect = document.getElementById('sync-interval');
    
    if (autoSyncCheckbox) autoSyncCheckbox.checked = AppState.sync.enabled;
    if (syncIntervalSelect) syncIntervalSelect.value = AppState.sync.interval;
    
    if (AppState.sync.enabled && AppState.gsheet.webAppUrl) {
        startAutoSync();
    }
    
    updateLastSyncDisplay();
}

function updateAutoSyncSettings() {
    AppState.sync.enabled = document.getElementById('auto-sync-enabled').checked;
    AppState.sync.interval = parseInt(document.getElementById('sync-interval').value);
    
    saveToLocalStorage();
    
    if (AppState.sync.enabled && AppState.gsheet.webAppUrl) {
        startAutoSync();
    } else {
        stopAutoSync();
    }
}

function startAutoSync() {
    stopAutoSync();
    
    const intervalMs = AppState.sync.interval * 60 * 1000;
    AppState.sync.intervalId = setInterval(() => {
        performAutoSync();
    }, intervalMs);
    
    console.log(`Auto sync started (every ${AppState.sync.interval} minutes)`);
}

function stopAutoSync() {
    if (AppState.sync.intervalId) {
        clearInterval(AppState.sync.intervalId);
        AppState.sync.intervalId = null;
    }
}

function triggerAutoSync() {
    // Debounced auto sync on data change
    if (AppState.sync.enabled && AppState.gsheet.webAppUrl && !AppState.sync.isSyncing) {
        // Sync after 3 seconds of no changes
        clearTimeout(AppState.sync.debounceTimer);
        AppState.sync.debounceTimer = setTimeout(() => {
            performAutoSync();
        }, 3000);
    }
}

async function performAutoSync() {
    if (!AppState.gsheet.webAppUrl || AppState.sync.isSyncing) return;
    
    AppState.sync.isSyncing = true;
    showSyncIndicator('Menyinkronkan...');
    
    try {
        const today = new Date().toLocaleDateString('id-ID');
        
        const data = {
            type: 'fullSync',
            tasks: AppState.kanban.tasks,
            daily: {
                date: today,
                checklist: AppState.checklist,
                reflections: AppState.reflections,
                pomodoros: AppState.timer.stats.pomodoros,
                focusTime: AppState.timer.stats.focusTime
            }
        };
        
        const response = await fetch(AppState.gsheet.webAppUrl, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            AppState.sync.lastSync = new Date().toISOString();
            updateLastSyncDisplay();
            addLogEntry('✓ Auto sync berhasil', 'success');
        }
    } catch (error) {
        console.error('Auto sync failed:', error);
        addLogEntry('✗ Auto sync gagal: ' + error.message, 'error');
    } finally {
        AppState.sync.isSyncing = false;
        hideSyncIndicator();
    }
}

function manualSync() {
    if (!AppState.gsheet.webAppUrl) {
        alert('Setup Google Sheets terlebih dahulu!');
        return;
    }
    
    performAutoSync();
}

function showSyncIndicator(text = 'Syncing...') {
    const indicator = document.getElementById('sync-indicator');
    const textEl = indicator.querySelector('.sync-text');
    if (textEl) textEl.textContent = text;
    indicator.classList.add('show');
}

function hideSyncIndicator() {
    document.getElementById('sync-indicator').classList.remove('show');
}

function updateLastSyncDisplay() {
    const el = document.getElementById('last-sync-time');
    if (el) {
        if (AppState.sync.lastSync) {
            const date = new Date(AppState.sync.lastSync);
            el.textContent = date.toLocaleString('id-ID');
        } else {
            el.textContent = 'Belum pernah';
        }
    }
}

// ==================== GOOGLE SHEETS ====================
function toggleAppsScript() {
    const el = document.getElementById('apps-script-code');
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function copyAppsScript() {
    const code = document.getElementById('apps-script-content').textContent;
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
    
    if (AppState.sync.enabled && AppState.gsheet.webAppUrl) {
        startAutoSync();
    }
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
        showSyncIndicator('Uploading tasks...');
        
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
    } finally {
        hideSyncIndicator();
    }
}

async function loadTasksFromSheet() {
    if (!AppState.gsheet.webAppUrl) {
        alert('Setup Google Sheets terlebih dahulu!');
        return;
    }
    
    try {
        addLogEntry('Memuat tasks dari Google Sheets...', '');
        showSyncIndicator('Downloading tasks...');
        
        const response = await fetch(`${AppState.gsheet.webAppUrl}?type=tasks`, {
            method: 'GET',
            redirect: 'follow'
        });
        
        const result = await response.json();
        
        if (result.success && result.data) {
            AppState.kanban.tasks = result.data;
            
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
    } finally {
        hideSyncIndicator();
    }
}

async function syncDailyToSheet() {
    if (!AppState.gsheet.webAppUrl) {
        alert('Setup Google Sheets terlebih dahulu!');
        return;
    }
    
    try {
        addLogEntry('Mengirim data harian...', '');
        showSyncIndicator('Uploading daily data...');
        
        const response = await fetch(AppState.gsheet.webAppUrl, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                type: 'daily',
                date: new Date().toLocaleDateString('id-ID'),
                checklist: AppState.checklist,
                reflections: AppState.reflections,
                pomodoros: AppState.timer.stats.pomodoros,
                focusTime: AppState.timer.stats.focusTime
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
    } finally {
        hideSyncIndicator();
    }
}

async function loadDailyFromSheet() {
    if (!AppState.gsheet.webAppUrl) {
        alert('Setup Google Sheets terlebih dahulu!');
        return;
    }
    
    try {
        showSyncIndicator('Downloading daily data...');
        const today = new Date().toLocaleDateString('id-ID');
        const response = await fetch(`${AppState.gsheet.webAppUrl}?type=daily&date=${encodeURIComponent(today)}`, {
            method: 'GET',
            redirect: 'follow'
        });
        
        const result = await response.json();
        
        if (result.success && result.data) {
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
            
            if (result.data.reflections) {
                AppState.reflections = result.data.reflections;
                loadReflections();
            }
            
            saveToLocalStorage();
            addLogEntry('✓ Data hari ini dimuat', 'success');
            alert('Data harian berhasil dimuat!');
        }
    } catch (error) {
        addLogEntry('✗ Gagal memuat: ' + error.message, 'error');
    } finally {
        hideSyncIndicator();
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
    
    while (container.children.length > 10) {
        container.removeChild(container.lastChild);
    }
}

// ==================== DATA MANAGEMENT ====================
function exportAllData() {
    const data = {
        version: '3.0',
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
        gsheet: AppState.gsheet,
        sync: {
            enabled: AppState.sync.enabled,
            interval: AppState.sync.interval
        },
        history: AppState.history
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
            if (data.sync) {
                AppState.sync.enabled = data.sync.enabled;
                AppState.sync.interval = data.sync.interval;
            }
            if (data.history) AppState.history = data.history;
            if (data.theme) setTheme(data.theme);
            
            saveToLocalStorage();
            
            loadChecklistState();
            loadReflections();
            loadTimerSettings();
            renderOptionsList();
            renderKanbanTasks();
            loadGSheetSettings();
            initAutoSync();
            
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
        // Save today's data to history
        const today = new Date().toLocaleDateString('id-ID');
        const existingIndex = AppState.history.findIndex(h => h.date === today);
        
        const todayData = {
            date: today,
            checklist: AppState.checklist,
            reflections: AppState.reflections,
            pomodoros: AppState.timer.stats.pomodoros,
            focusTime: AppState.timer.stats.focusTime
        };
        
        if (existingIndex >= 0) {
            AppState.history[existingIndex] = todayData;
        } else {
            AppState.history.push(todayData);
        }
        
        // Keep only last 365 days
        if (AppState.history.length > 365) {
            AppState.history = AppState.history.slice(-365);
        }
        
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
                scores: AppState.pairwise.scores,
                lastResults: AppState.pairwise.lastResults
            },
            kanban: {
                tasks: AppState.kanban.tasks,
                taskIdCounter: AppState.kanban.taskIdCounter
            },
            gsheet: AppState.gsheet,
            sync: {
                enabled: AppState.sync.enabled,
                interval: AppState.sync.interval,
                lastSync: AppState.sync.lastSync
            },
            history: AppState.history,
            lastSaved: new Date().toISOString()
        };
        
        localStorage.setItem('sync-planner-data', JSON.stringify(data));
    } catch (error) {
        console.error('Failed to save to localStorage:', error);
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
        
        const lastSaved = new Date(data.lastSaved);
        const today = new Date();
        const isNewDay = lastSaved.toDateString() !== today.toDateString();
        
        if (isNewDay) {
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
        
        if (data.timer?.settings) AppState.timer.settings = data.timer.settings;
        if (data.timer?.sound) AppState.timer.sound = data.timer.sound;
        if (data.pairwise?.options) AppState.pairwise.options = data.pairwise.options;
        if (data.pairwise?.scores) AppState.pairwise.scores = data.pairwise.scores;
        if (data.pairwise?.lastResults) AppState.pairwise.lastResults = data.pairwise.lastResults;
        if (data.kanban?.tasks) AppState.kanban.tasks = data.kanban.tasks;
        if (data.kanban?.taskIdCounter) AppState.kanban.taskIdCounter = data.kanban.taskIdCounter;
        if (data.gsheet) AppState.gsheet = data.gsheet;
        if (data.sync) {
            AppState.sync.enabled = data.sync.enabled;
            AppState.sync.interval = data.sync.interval;
            AppState.sync.lastSync = data.sync.lastSync;
        }
        if (data.history) AppState.history = data.history;
        
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
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
    
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed:', err));
    }
    
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
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

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        closeTaskModal();
        closePairwiseKanbanModal();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeTaskModal();
        closePairwiseKanbanModal();
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveToLocalStorage();
    }
});
