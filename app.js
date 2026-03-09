(() => {
  'use strict';

  // ── State ─────────────────────────────────────────────────────────────────
  let tasks = [];
  let filter = 'all'; // 'all' | 'active' | 'done'
  let reminderTargetId = null;
  const STORAGE_KEY = 'tasks_app_v1';

  // ── Persistence ───────────────────────────────────────────────────────────
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      tasks = raw ? JSON.parse(raw) : sampleTasks();
    } catch {
      tasks = sampleTasks();
    }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); } catch {}
  }

  function sampleTasks() {
    return [
      { id: uid(), text: 'Review project proposal', done: true,  reminder: null },
      { id: uid(), text: 'Refactor the auth module', done: false, reminder: null },
      { id: uid(), text: 'Write unit tests',         done: false, reminder: null },
    ];
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function visibleTasks() {
    if (filter === 'active') return tasks.filter(t => !t.done);
    if (filter === 'done')   return tasks.filter(t => t.done);
    return tasks;
  }

  function formatReminderShort(ts) {
    const d = new Date(ts);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tDay  = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff  = tDay - today;
    const time  = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (diff === 0)        return `today ${time}`;
    if (diff === 86400000) return `tomorrow ${time}`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + time;
  }

  function toLocalDatetimeValue(ts) {
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const input          = document.getElementById('task-input');
  const addBtn         = document.getElementById('add-btn');
  const list           = document.getElementById('task-list');
  const emptyState     = document.getElementById('empty-state');
  const clearDoneBtn   = document.getElementById('clear-done-btn');
  const statDone       = document.getElementById('stat-done');
  const statLeft       = document.getElementById('stat-left');
  const filterBtns     = document.querySelectorAll('.filter-btn');
  const overlay        = document.getElementById('reminder-overlay');
  const closeBtn       = document.getElementById('reminder-close');
  const datetimeInput  = document.getElementById('reminder-datetime');
  const saveReminderBtn  = document.getElementById('reminder-save-btn');
  const clearReminderBtn = document.getElementById('reminder-clear-btn');
  const taskLabel      = document.getElementById('reminder-task-label');
  const quickBtns      = document.querySelectorAll('.quick-btn');
  const toastContainer = document.getElementById('toast-container');

  // ── Render ────────────────────────────────────────────────────────────────
  function render() {
    const visible = visibleTasks();
    list.innerHTML = '';
    visible.forEach(task => list.appendChild(buildItem(task)));
    emptyState.classList.toggle('hidden', visible.length > 0);

    const doneCount = tasks.filter(t => t.done).length;
    const leftCount = tasks.filter(t => !t.done).length;
    statDone.textContent = doneCount;
    statLeft.textContent = leftCount;
    save();
  }

  function buildItem(task) {
    const li = document.createElement('li');
    li.className = 'task-item' + (task.done ? ' done' : '');
    li.dataset.id = task.id;

    // Checkbox
    const check = document.createElement('button');
    check.className = 'task-check';
    check.setAttribute('aria-label', task.done ? 'Mark incomplete' : 'Mark complete');
    check.innerHTML = `
      <svg viewBox="0 0 12 12" fill="none">
        <polyline points="1.5,6 5,9.5 10.5,2.5" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    check.addEventListener('click', () => toggleDone(task.id));

    // Task text
    const textEl = document.createElement('span');
    textEl.className = 'task-text';
    textEl.textContent = task.text;
    textEl.title = 'Double-click to edit';
    textEl.addEventListener('dblclick', () => startEdit(li, task));

    // Reminder time badge
    let timeBadge = null;
    if (task.reminder) {
      timeBadge = document.createElement('span');
      const isOverdue = task.reminder < Date.now() && !task.done;
      timeBadge.className = 'task-reminder-time' + (isOverdue ? ' overdue' : '');
      timeBadge.textContent = '⏰ ' + formatReminderShort(task.reminder);
      timeBadge.title = new Date(task.reminder).toLocaleString();
    }

    // Bell button
    const bell = document.createElement('button');
    bell.className = 'task-reminder-btn' + (task.reminder ? ' has-reminder' : '');
    bell.setAttribute('aria-label', 'Set reminder');
    bell.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M7.5 1.5C5.015 1.5 3 3.515 3 6v3.5L1.5 11h12L12 9.5V6c0-2.485-2.015-4.5-4.5-4.5z"
          stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M6 11.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" stroke-width="1.4"/>
      </svg>`;
    bell.addEventListener('click', () => openReminderModal(task.id));

    // Delete button
    const del = document.createElement('button');
    del.className = 'task-delete';
    del.setAttribute('aria-label', 'Delete task');
    del.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <line x1="2" y1="2" x2="12" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <line x1="12" y1="2" x2="2" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>`;
    del.addEventListener('click', () => deleteTask(task.id, li));

    li.append(check, textEl);
    if (timeBadge) li.append(timeBadge);
    li.append(bell, del);
    return li;
  }

  // ── Task Actions ──────────────────────────────────────────────────────────
  function addTask(text) {
    text = text.trim();
    if (!text) return;
    tasks.unshift({ id: uid(), text, done: false, reminder: null });
    render();
  }

  function toggleDone(id) {
    const task = tasks.find(t => t.id === id);
    if (task) { task.done = !task.done; render(); }
  }

  function deleteTask(id, li) {
    li.classList.add('removing');
    li.addEventListener('animationend', () => {
      tasks = tasks.filter(t => t.id !== id);
      render();
    }, { once: true });
  }

  function startEdit(li, task) {
    if (task.done) return;
    const textEl = li.querySelector('.task-text');
    const editInput = document.createElement('input');
    editInput.className = 'task-edit-input';
    editInput.value = task.text;
    editInput.maxLength = 120;
    textEl.replaceWith(editInput);
    editInput.focus();
    editInput.select();

    function commitEdit() {
      const val = editInput.value.trim();
      if (val) task.text = val;
      render();
    }
    editInput.addEventListener('blur', commitEdit);
    editInput.addEventListener('keydown', e => {
      if (e.key === 'Enter')  editInput.blur();
      if (e.key === 'Escape') { editInput.value = task.text; editInput.blur(); }
    });
  }

  function clearDone() {
    tasks = tasks.filter(t => !t.done);
    render();
  }

  // ── Reminder Modal ────────────────────────────────────────────────────────
  function openReminderModal(id) {
    reminderTargetId = id;
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    taskLabel.textContent = `"${task.text}"`;
    const defaultTime = task.reminder
      ? task.reminder
      : Date.now() + 60 * 60 * 1000;
    datetimeInput.value = toLocalDatetimeValue(defaultTime);
    datetimeInput.min   = toLocalDatetimeValue(Date.now());

    overlay.classList.remove('hidden');
    setTimeout(() => datetimeInput.focus(), 80);
  }

  function closeReminderModal() {
    overlay.classList.add('hidden');
    reminderTargetId = null;
  }

  function saveReminder() {
    if (!reminderTargetId) return;
    const val = datetimeInput.value;
    if (!val) return;

    const ts = new Date(val).getTime();
    if (ts <= Date.now()) {
      showToast('INVALID TIME', 'Please pick a time in the future.', true);
      return;
    }

    const task = tasks.find(t => t.id === reminderTargetId);
    if (task) {
      task.reminder = ts;
      scheduleReminder(task);
      showToast('REMINDER SET', `"${task.text}" — ${formatReminderShort(ts)}`);
      render();
    }
    closeReminderModal();
  }

  function clearReminder() {
    if (!reminderTargetId) return;
    const task = tasks.find(t => t.id === reminderTargetId);
    if (task) { task.reminder = null; render(); }
    closeReminderModal();
  }

  // Modal event listeners
  closeBtn.addEventListener('click', closeReminderModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeReminderModal(); });
  saveReminderBtn.addEventListener('click', saveReminder);
  clearReminderBtn.addEventListener('click', clearReminder);

  quickBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mins = parseInt(btn.dataset.mins, 10);
      const base = datetimeInput.value
        ? new Date(datetimeInput.value).getTime()
        : Date.now();
      datetimeInput.value = toLocalDatetimeValue(base + mins * 60 * 1000);
    });
  });

  document.addEventListener('keydown', e => {
    if (overlay.classList.contains('hidden')) return;
    if (e.key === 'Escape') closeReminderModal();
    if (e.key === 'Enter' && document.activeElement !== datetimeInput) saveReminder();
  });

  // ── Notification Scheduler ────────────────────────────────────────────────
  const scheduledTimers = {};

  function requestNotifPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  function scheduleReminder(task) {
    if (!task.reminder) return;
    if (scheduledTimers[task.id]) {
      clearTimeout(scheduledTimers[task.id]);
      delete scheduledTimers[task.id];
    }
    const delay = task.reminder - Date.now();
    if (delay <= 0) return;
    scheduledTimers[task.id] = setTimeout(() => {
      delete scheduledTimers[task.id];
      fireReminder(task);
    }, delay);
  }

  function fireReminder(task) {
    const live = tasks.find(t => t.id === task.id);
    if (live && !live.done) {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('⏰ Task Reminder', { body: task.text });
      }
      showToast('⏰ REMINDER', task.text, false, true);
    }
  }

  function scheduleAllReminders() {
    tasks.forEach(task => {
      if (task.reminder && task.reminder > Date.now() && !task.done) {
        scheduleReminder(task);
      }
    });
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  function showToast(title, msg, isError = false, isPersistent = false) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <span class="toast-icon">${isError ? '✕' : '⏰'}</span>
      <div class="toast-body">
        <div class="toast-title" style="${isError ? 'color:var(--accent2)' : ''}">${title}</div>
        <div class="toast-msg">${msg}</div>
      </div>
      <button class="toast-close" aria-label="Dismiss">&times;</button>`;
    toastContainer.appendChild(toast);

    const dismiss = () => {
      toast.classList.add('dismiss');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    };
    toast.querySelector('.toast-close').addEventListener('click', dismiss);
    if (!isPersistent) setTimeout(dismiss, 4000);
  }

  // ── Filters ───────────────────────────────────────────────────────────────
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filter = btn.dataset.filter;
      render();
    });
  });

  // ── Input Events ──────────────────────────────────────────────────────────
  addBtn.addEventListener('click', () => {
    addTask(input.value);
    input.value = '';
    input.focus();
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      addTask(input.value);
      input.value = '';
    }
  });

  clearDoneBtn.addEventListener('click', clearDone);

  // ── Init ──────────────────────────────────────────────────────────────────
  load();
  requestNotifPermission();
  scheduleAllReminders();
  render();
})();
