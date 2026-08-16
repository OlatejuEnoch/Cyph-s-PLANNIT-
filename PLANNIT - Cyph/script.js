// ========== State ==========
    let tasks = JSON.parse(localStorage.getItem('cypherTodoTasks') || '[]');
    let currentFilter = 'all';
    let currentCategory = '';
    let settings = JSON.parse(localStorage.getItem('cypherTodoSettings') || '{}');
    settings.aiMode = settings.aiMode || 'local';
    settings.apiKey = settings.apiKey || '';
    settings.apiBase = settings.apiBase || 'https://api.openai.com/v1';
    settings.apiModel = settings.apiModel || 'gpt-4o-mini';
    const notifiedIds = new Set(JSON.parse(localStorage.getItem('cypherNotified') || '[]'));

    // Theme
    const root = document.documentElement;
    if (localStorage.getItem('cypherTodoTheme') === 'light') {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }

    // ========== DOM ==========
    const taskList = document.getElementById('taskList');
    const emptyState = document.getElementById('emptyState');
    const statsText = document.getElementById('statsText');
    const aiPrompt = document.getElementById('aiPrompt');
    const aiStatus = document.getElementById('aiStatus');
    const aiModeBadge = document.getElementById('aiModeBadge');
    const liveClock = document.getElementById('liveClock');
    const liveDate = document.getElementById('liveDate');
    const nextReminderEl = document.getElementById('nextReminder');
    const toast = document.getElementById('toast');
    const toastText = document.getElementById('toastText');

    function saveTasks() { localStorage.setItem('cypherTodoTasks', JSON.stringify(tasks)); }
    function saveSettings() { localStorage.setItem('cypherTodoSettings', JSON.stringify(settings)); }
    function saveNotified() { localStorage.setItem('cypherNotified', JSON.stringify([...notifiedIds])); }

    function updateAiBadge() {
      aiModeBadge.textContent = settings.aiMode === 'openai' ? 'API AI' : 'Local AI';
      aiModeBadge.className = settings.aiMode === 'openai'
        ? 'ml-auto text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
        : 'ml-auto text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500';
    }
    updateAiBadge();

    // ========== Clock ==========
    function updateClock() {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      liveClock.textContent = `${h}:${m}:${s}`;
      liveDate.textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
      updateNextReminder(now);
      checkReminders(now);
    }

    function updateNextReminder(now) {
      const upcoming = tasks
        .filter(t => !t.done && t.time)
        .map(t => {
          const [hh, mm] = t.time.split(':').map(Number);
          const d = new Date(now);
          d.setHours(hh, mm, 0, 0);
          if (d <= now) d.setDate(d.getDate() + 1); // next day if past
          return { task: t, at: d };
        })
        .sort((a, b) => a.at - b.at);

      if (upcoming.length === 0) {
        nextReminderEl.textContent = 'None upcoming';
        return;
      }
      const next = upcoming[0];
      const diffMs = next.at - now;
      const mins = Math.round(diffMs / 60000);
      let when;
      if (mins < 60) when = `in ${mins} min`;
      else if (mins < 1440) when = `in ${Math.floor(mins / 60)}h ${mins % 60}m`;
      else when = next.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      nextReminderEl.textContent = `${next.task.text.slice(0, 28)}${next.task.text.length > 28 ? '…' : ''} · ${when}`;
    }

    function showToast(msg) {
      toastText.textContent = msg;
      toast.classList.remove('hidden');
      toast.classList.add('flex');
      clearTimeout(showToast._t);
      showToast._t = setTimeout(() => {
        toast.classList.add('hidden');
        toast.classList.remove('flex');
      }, 8000);
    }
    document.getElementById('toastClose').addEventListener('click', () => {
      toast.classList.add('hidden');
      toast.classList.remove('flex');
    });

    function checkReminders(now) {
      const currentHM = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      tasks.forEach(t => {
        if (t.done || !t.time) return;
        const key = `${t.id}_${currentHM}`;
        if (t.time === currentHM && !notifiedIds.has(key)) {
          notifiedIds.add(key);
          // keep set from growing forever
          if (notifiedIds.size > 200) {
            const arr = [...notifiedIds];
            arr.splice(0, arr.length - 100);
            notifiedIds.clear();
            arr.forEach(x => notifiedIds.add(x));
          }
          saveNotified();

          const msg = `⏰ Reminder: ${t.text}${t.time ? ' at ' + formatTime(t.time) : ''}`;
          showToast(msg);

          if (Notification.permission === 'granted') {
            try {
              new Notification("Cypher's To-Do App", {
                body: t.text + (t.time ? ` · ${formatTime(t.time)}` : ''),
                icon: undefined,
                tag: t.id
              });
            } catch (_) {}
          }
          // subtle beep via Web Audio
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            gain.gain.value = 0.08;
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            osc.stop(ctx.currentTime + 0.4);
          } catch (_) {}
        }
      });
    }

    setInterval(updateClock, 1000);
    updateClock();

    // Notification permission
    document.getElementById('enableNotifBtn').addEventListener('click', async () => {
      if (!('Notification' in window)) {
        alert('Notifications not supported in this browser.');
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        document.getElementById('enableNotifBtn').innerHTML = '<i class="fas fa-bell mr-1"></i> Notifications on';
        document.getElementById('enableNotifBtn').classList.add('text-emerald-600', 'dark:text-emerald-400');
        showToast('Notifications enabled 🔔');
      } else {
        alert('Permission denied. You can still get in-app reminders while the tab is open.');
      }
    });
    if (Notification.permission === 'granted') {
      document.getElementById('enableNotifBtn').innerHTML = '<i class="fas fa-bell mr-1"></i> Notifications on';
      document.getElementById('enableNotifBtn').classList.add('text-emerald-600', 'dark:text-emerald-400');
    }

    // ========== Theme ==========
    document.getElementById('themeToggle').addEventListener('click', () => {
      root.classList.toggle('dark');
      localStorage.setItem('cypherTodoTheme', root.classList.contains('dark') ? 'dark' : 'light');
    });

    // ========== Render ==========
    const catColors = {
      Work: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
      Study: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
      Health: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
      Personal: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
      Chores: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
      Family: 'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300'
    };

    function formatTime(t) {
      if (!t) return '';
      const [h, m] = t.split(':');
      const hour = parseInt(h);
      return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
    }

    function escapeHtml(s) {
      const d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }

    function isDueSoon(task, now) {
      if (!task.time || task.done) return false;
      const [hh, mm] = task.time.split(':').map(Number);
      const target = new Date(now);
      target.setHours(hh, mm, 0, 0);
      const diff = (target - now) / 60000;
      return diff >= -5 && diff <= 15; // 5 min past to 15 min ahead
    }

    function render() {
      const now = new Date();
      let filtered = tasks.filter(t => {
        if (currentFilter === 'active' && t.done) return false;
        if (currentFilter === 'completed' && !t.done) return false;
        if (currentCategory && t.category !== currentCategory) return false;
        return true;
      });

      filtered.sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        if (a.time && b.time) return a.time.localeCompare(b.time);
        if (a.time) return -1;
        if (b.time) return 1;
        return 0;
      });

      taskList.innerHTML = '';
      if (filtered.length === 0) {
        emptyState.classList.remove('hidden');
      } else {
        emptyState.classList.add('hidden');
        filtered.forEach(task => {
          const due = isDueSoon(task, now);
          const li = document.createElement('li');
          li.className = `task-enter flex items-start gap-3 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-3 group hover:border-slate-300 dark:hover:border-slate-600 transition ${task.done ? 'opacity-60' : ''} ${due ? 'pulse-due border-red-400 dark:border-red-500' : ''}`;
          li.innerHTML = `
            <input type="checkbox" class="mt-0.5 w-4.5 h-4.5 rounded accent-indigo-500 cursor-pointer shrink-0" ${task.done ? 'checked' : ''} data-id="${task.id}">
            <div class="flex-1 min-w-0">
              <span class="block text-sm ${task.done ? 'line-through text-slate-400 dark:text-slate-500' : ''}">${escapeHtml(task.text)}</span>
              <div class="flex flex-wrap items-center gap-1.5 mt-1">
                ${task.time ? `<span class="text-[11px] ${due ? 'text-red-500 font-semibold' : 'text-indigo-600 dark:text-indigo-400'}"><i class="far fa-clock mr-0.5"></i>${formatTime(task.time)}${due ? ' · due soon' : ''}</span>` : ''}
                ${task.category ? `<span class="text-[10px] px-1.5 py-0.5 rounded-md ${catColors[task.category] || 'bg-slate-100 dark:bg-slate-800'}">${task.category}</span>` : ''}
                ${task.recurring ? `<span class="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500"><i class="fas fa-redo text-[9px] mr-0.5"></i>${task.recurring}</span>` : ''}
                ${task.fromAI ? `<span class="text-[10px] text-cyan-600 dark:text-cyan-400"><i class="fas fa-robot mr-0.5"></i>AI</span>` : ''}
              </div>
            </div>
            <button class="delete-btn opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition p-1 shrink-0" data-id="${task.id}">
              <i class="fas fa-trash-alt text-xs"></i>
            </button>
          `;
          taskList.appendChild(li);
        });
      }

      const total = tasks.length;
      const done = tasks.filter(t => t.done).length;
      statsText.textContent = `${total - done} active · ${done} done`;

      taskList.querySelectorAll('input[type=checkbox]').forEach(cb => {
        cb.addEventListener('change', e => {
          const task = tasks.find(t => t.id === e.target.dataset.id);
          if (!task) return;
          task.done = e.target.checked;
          if (task.done && task.recurring) {
            tasks.push({ ...task, id: crypto.randomUUID(), done: false, created: Date.now() });
          }
          saveTasks();
          render();
        });
      });

      taskList.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          const id = e.currentTarget.dataset.id;
          tasks = tasks.filter(t => t.id !== id);
          saveTasks();
          render();
        });
      });
    }

    // re-render occasionally so "due soon" updates
    setInterval(() => render(), 30000);

    // ========== Add Task ==========
    document.getElementById('addTaskForm').addEventListener('submit', e => {
      e.preventDefault();
      const text = document.getElementById('taskInput').value.trim();
      if (!text) return;
      tasks.push({
        id: crypto.randomUUID(),
        text,
        time: document.getElementById('taskTime').value || null,
        category: document.getElementById('taskCategory').value || null,
        recurring: document.getElementById('taskRecurring').value || null,
        done: false,
        created: Date.now(),
        fromAI: false
      });
      saveTasks();
      document.getElementById('taskInput').value = '';
      document.getElementById('taskTime').value = '';
      document.getElementById('taskCategory').value = '';
      document.getElementById('taskRecurring').value = '';
      render();
    });

    // ========== Filters ==========
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => {
          b.classList.remove('active', 'bg-indigo-600', 'text-white');
          b.classList.add('bg-slate-200', 'dark:bg-slate-800', 'text-slate-600', 'dark:text-slate-300');
        });
        btn.classList.add('active', 'bg-indigo-600', 'text-white');
        btn.classList.remove('bg-slate-200', 'dark:bg-slate-800', 'text-slate-600', 'dark:text-slate-300');
        currentFilter = btn.dataset.filter;
        render();
      });
    });

    document.querySelectorAll('.cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.cat-btn').forEach(b => {
          b.classList.remove('active', 'bg-indigo-100', 'dark:bg-indigo-900/40', 'text-indigo-700', 'dark:text-indigo-300');
          b.classList.add('bg-slate-200', 'dark:bg-slate-800', 'text-slate-600', 'dark:text-slate-300');
        });
        btn.classList.add('active', 'bg-indigo-100', 'dark:bg-indigo-900/40', 'text-indigo-700', 'dark:text-indigo-300');
        btn.classList.remove('bg-slate-200', 'dark:bg-slate-800', 'text-slate-600', 'dark:text-slate-300');
        currentCategory = btn.dataset.cat;
        render();
      });
    });

    // ========== Clear ==========
    document.getElementById('clearCompleted').addEventListener('click', () => {
      if (confirm('Clear all completed tasks?')) {
        tasks = tasks.filter(t => !t.done);
        saveTasks();
        render();
      }
    });
    document.getElementById('clearAll').addEventListener('click', () => {
      if (confirm('Clear ALL tasks?')) {
        tasks = [];
        saveTasks();
        render();
      }
    });

    // ========== Local AI ==========
    function localGenerate(prompt) {
      const lower = prompt.toLowerCase();
      const out = [];
      const has = (re) => re.test(lower);

      if (has(/morning|wake|routine|start/)) {
        out.push({ text: 'Wake up & hydrate', time: '06:30', category: 'Health' });
        out.push({ text: 'Morning movement / stretch', time: '06:45', category: 'Health' });
        out.push({ text: 'Breakfast', time: '07:15', category: 'Health' });
      }
      if (has(/gym|exercise|workout|run|fitness|yoga|train/)) {
        out.push({ text: 'Gym / Workout', time: '07:45', category: 'Health' });
        out.push({ text: 'Shower & get ready', time: '08:45', category: 'Personal' });
      }
      if (has(/work|job|office|meeting|email|project|deadline/)) {
        out.push({ text: 'Check emails & set priorities', time: '09:00', category: 'Work' });
        out.push({ text: 'Deep work block #1', time: '09:30', category: 'Work' });
        out.push({ text: 'Short break', time: '11:00', category: 'Personal' });
        out.push({ text: 'Meetings / collaboration', time: '11:15', category: 'Work' });
        out.push({ text: 'Lunch', time: '12:30', category: 'Health' });
        out.push({ text: 'Deep work block #2', time: '13:30', category: 'Work' });
        out.push({ text: 'Wrap-up & review', time: '16:30', category: 'Work' });
      }
      if (has(/study|exam|homework|learn|read|class|assignment|school|college/)) {
        out.push({ text: 'Review previous notes', time: '09:00', category: 'Study' });
        out.push({ text: 'Focused study (Pomodoro 1)', time: '09:30', category: 'Study' });
        out.push({ text: 'Break', time: '10:25', category: 'Personal' });
        out.push({ text: 'Focused study (Pomodoro 2)', time: '10:30', category: 'Study' });
        out.push({ text: 'Lunch + rest', time: '12:00', category: 'Health' });
        out.push({ text: 'Practice / active recall', time: '13:00', category: 'Study' });
        out.push({ text: 'Summary & flashcards', time: '14:45', category: 'Study' });
      }
      if (has(/chore|clean|laundry|dishes|house|tidy/)) {
        out.push({ text: 'Tidy living space', time: '17:00', category: 'Chores' });
        out.push({ text: 'Laundry / dishes', time: '17:30', category: 'Chores' });
      }
      if (has(/cook|dinner|meal|food|kitchen/)) {
        out.push({ text: 'Prepare & cook dinner', time: '18:00', category: 'Health' });
      }
      if (has(/family|mom|dad|call|parents|kids|partner/)) {
        out.push({ text: 'Call / check-in with family', time: '19:30', category: 'Family' });
      }
      if (has(/weekend|saturday|sunday|relax|hobby|fun/)) {
        out.push({ text: 'Leisure / hobby time', time: '11:00', category: 'Personal' });
        out.push({ text: 'Outdoor walk or activity', time: '15:00', category: 'Health' });
        out.push({ text: 'Relax & recharge', time: '20:00', category: 'Personal' });
      }

      if (out.length < 4) {
        return [
          { text: 'Morning routine & breakfast', time: '07:00', category: 'Health' },
          { text: 'Priority task #1', time: '08:30', category: 'Work' },
          { text: 'Short break', time: '10:00', category: 'Personal' },
          { text: 'Priority task #2', time: '10:15', category: 'Work' },
          { text: 'Lunch', time: '12:30', category: 'Health' },
          { text: 'Secondary tasks / errands', time: '13:30', category: 'Personal' },
          { text: 'Exercise or movement', time: '16:00', category: 'Health' },
          { text: 'Dinner', time: '18:30', category: 'Health' },
          { text: 'Personal / hobby time', time: '20:00', category: 'Personal' },
          { text: 'Wind down & sleep prep', time: '21:30', category: 'Health' }
        ];
      }

      if (!out.some(g => (g.time || '') >= '21:00')) {
        out.push({ text: 'Wind down (no screens)', time: '21:00', category: 'Health' });
        out.push({ text: 'Prepare tomorrow & sleep', time: '22:00', category: 'Health' });
      }
      out.sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
      return out;
    }

    async function apiGenerate(prompt) {
      const system = `You are a scheduling assistant. Return ONLY a valid JSON array of tasks. Each object: "text" (string), "time" (HH:MM 24h or null), "category" (Work|Study|Health|Personal|Chores|Family or null). 6-12 realistic timed tasks. No markdown.`;
      const res = await fetch(`${settings.apiBase.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
          model: settings.apiModel,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt }
          ],
          temperature: 0.6
        })
      });
      if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 180)}`);
      const data = await res.json();
      let content = data.choices?.[0]?.message?.content || '[]';
      content = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(content);
      if (!Array.isArray(parsed)) throw new Error('Not an array');
      return parsed.map(t => ({
        text: String(t.text || 'Task'),
        time: t.time || null,
        category: t.category || null
      }));
    }

    document.getElementById('aiGenerateBtn').addEventListener('click', async () => {
      const prompt = aiPrompt.value.trim();
      if (!prompt) { aiPrompt.focus(); return; }
      aiStatus.classList.remove('hidden');
      const btn = document.getElementById('aiGenerateBtn');
      btn.disabled = true;
      try {
        let schedule;
        if (settings.aiMode === 'openai' && settings.apiKey) {
          schedule = await apiGenerate(prompt);
        } else {
          await new Promise(r => setTimeout(r, 900 + Math.random() * 600));
          schedule = localGenerate(prompt);
        }
        schedule.forEach(item => {
          tasks.push({
            id: crypto.randomUUID(),
            text: item.text,
            time: item.time,
            category: item.category,
            recurring: null,
            done: false,
            created: Date.now(),
            fromAI: true
          });
        });
        saveTasks();
        render();
        aiPrompt.value = '';
        taskList.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (err) {
        alert('AI failed:\n' + err.message + '\n\nUsing local drafter.');
        localGenerate(prompt).forEach(item => {
          tasks.push({
            id: crypto.randomUUID(),
            text: item.text,
            time: item.time,
            category: item.category,
            recurring: null,
            done: false,
            created: Date.now(),
            fromAI: true
          });
        });
        saveTasks();
        render();
      } finally {
        aiStatus.classList.add('hidden');
        btn.disabled = false;
      }
    });

    // Quick Ideas
    document.getElementById('quickIdeasBtn').addEventListener('click', () => {
      document.getElementById('ideasModal').classList.remove('hidden');
      document.getElementById('ideasModal').classList.add('flex');
    });
    document.getElementById('closeIdeas').addEventListener('click', () => {
      document.getElementById('ideasModal').classList.add('hidden');
      document.getElementById('ideasModal').classList.remove('flex');
    });
    document.querySelectorAll('.idea-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        aiPrompt.value = btn.dataset.idea;
        document.getElementById('ideasModal').classList.add('hidden');
        document.getElementById('ideasModal').classList.remove('flex');
        document.getElementById('aiGenerateBtn').click();
      });
    });
    document.getElementById('ideasModal').addEventListener('click', e => {
      if (e.target.id === 'ideasModal') {
        document.getElementById('ideasModal').classList.add('hidden');
        document.getElementById('ideasModal').classList.remove('flex');
      }
    });

    // Settings
    document.getElementById('settingsBtn').addEventListener('click', () => {
      document.getElementById('aiModeSelect').value = settings.aiMode;
      document.getElementById('apiKeyInput').value = settings.apiKey;
      document.getElementById('apiBaseInput').value = settings.apiBase;
      document.getElementById('apiModelInput').value = settings.apiModel;
      document.getElementById('apiKeySection').classList.toggle('hidden', settings.aiMode !== 'openai');
      document.getElementById('settingsModal').classList.remove('hidden');
      document.getElementById('settingsModal').classList.add('flex');
    });
    document.getElementById('aiModeSelect').addEventListener('change', e => {
      document.getElementById('apiKeySection').classList.toggle('hidden', e.target.value !== 'openai');
    });
    document.getElementById('saveSettings').addEventListener('click', () => {
      settings.aiMode = document.getElementById('aiModeSelect').value;
      settings.apiKey = document.getElementById('apiKeyInput').value.trim();
      settings.apiBase = document.getElementById('apiBaseInput').value.trim() || 'https://api.openai.com/v1';
      settings.apiModel = document.getElementById('apiModelInput').value.trim() || 'gpt-4o-mini';
      saveSettings();
      updateAiBadge();
      document.getElementById('settingsModal').classList.add('hidden');
      document.getElementById('settingsModal').classList.remove('flex');
    });
    document.getElementById('closeSettings').addEventListener('click', () => {
      document.getElementById('settingsModal').classList.add('hidden');
      document.getElementById('settingsModal').classList.remove('flex');
    });
    document.getElementById('settingsModal').addEventListener('click', e => {
      if (e.target.id === 'settingsModal') {
        document.getElementById('settingsModal').classList.add('hidden');
        document.getElementById('settingsModal').classList.remove('flex');
      }
    });

    // Export
    document.getElementById('exportBtn').addEventListener('click', () => {
      document.getElementById('exportModal').classList.remove('hidden');
      document.getElementById('exportModal').classList.add('flex');
    });
    document.getElementById('closeExport').addEventListener('click', () => {
      document.getElementById('exportModal').classList.add('hidden');
      document.getElementById('exportModal').classList.remove('flex');
    });

    function download(filename, content, type) {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }

    document.getElementById('exportJSON').addEventListener('click', () => {
      download('cypher-todo-tasks.json', JSON.stringify(tasks, null, 2), 'application/json');
      document.getElementById('exportModal').classList.add('hidden');
      document.getElementById('exportModal').classList.remove('flex');
    });

    document.getElementById('exportCSV').addEventListener('click', () => {
      const header = 'Text,Time,Category,Recurring,Done,Created\n';
      const rows = tasks.map(t =>
        `"${(t.text || '').replace(/"/g, '""')}",${t.time || ''},${t.category || ''},${t.recurring || ''},${t.done},${new Date(t.created).toISOString()}`
      ).join('\n');
      download('cypher-todo-tasks.csv', header + rows, 'text/csv');
      document.getElementById('exportModal').classList.add('hidden');
      document.getElementById('exportModal').classList.remove('flex');
    });

    document.getElementById('exportPrint').addEventListener('click', () => {
      const win = window.open('', '_blank');
      const sorted = [...tasks].sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return (a.time || '').localeCompare(b.time || '');
      });
      win.document.write(`
        <html><head><title>Cypher's To-Do App</title>
        <style>
          body { font-family: system-ui, sans-serif; padding: 2rem; max-width: 700px; margin: auto; }
          h1 { margin-bottom: 0.25rem; }
          .meta { color: #666; font-size: 0.9rem; margin-bottom: 1.5rem; }
          .task { padding: 0.6rem 0; border-bottom: 1px solid #eee; display: flex; gap: 0.75rem; }
          .done { text-decoration: line-through; color: #999; }
          .time { color: #4f46e5; font-size: 0.85rem; min-width: 70px; }
          .cat { font-size: 0.75rem; background: #f1f5f9; padding: 0.15rem 0.4rem; border-radius: 4px; }
        </style></head><body>
        <h1>Cypher's To-Do App</h1>
        <p class="meta">Exported ${new Date().toLocaleString()} · ${tasks.length} tasks</p>
        ${sorted.map(t => `
          <div class="task ${t.done ? 'done' : ''}">
            <span>${t.done ? '☑' : '☐'}</span>
            <span class="time">${t.time ? formatTime(t.time) : '—'}</span>
            <span style="flex:1">${escapeHtml(t.text)}</span>
            ${t.category ? `<span class="cat">${t.category}</span>` : ''}
          </div>
        `).join('')}
        <script>window.print();<\/script>
        </body></html>
      `);
      win.document.close();
      document.getElementById('exportModal').classList.add('hidden');
      document.getElementById('exportModal').classList.remove('flex');
    });

    render();
