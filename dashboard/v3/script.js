/* ESTADO Y PERSISTENCIA EN BD */
const State = {
    jobs: [],
    projects: [],
    tools: [],
    activeTab: 'jobs',
    editingId: null,
    searchTerm: '',
    statusFilter: 'Todos',
    projectSort: 'desc',
    kanban: null,
    reminders: [],
    calendarDate: new Date(),
    reminderNotified: new Set(),
    activeReminderId: null,
    reminderQueue: [],
};
let currentUser = null;
let saveQueue = Promise.resolve();

const TABLES = { jobs: 'dashboard_jobs', projects: 'dashboard_projects', tools: 'dashboard_tools' };
const REMINDERS_TABLE = 'dashboard_reminders';


const escapeHTML = value => String(value ?? '').replace(/[&<>\"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;'
}[char]));
const safeColor = value => /^#[0-9a-fA-F]{6}$/.test(String(value || '')) ? String(value) : '#6366f1';
const safeURL = value => {
    const raw = String(value || '').trim();

    if (!raw) return '';

    try {
        const url = new URL(raw, window.location.origin);

        return ['http:', 'https:'].includes(url.protocol)
            ? url.href
            : '';
    } catch {
        return '';
    }
};
const Storage = {
    async loadAll() {
        if (!currentUser) throw new Error('No hay una sesión activa.');
        const results = await Promise.all(Object.entries(TABLES).map(async ([key, table]) => {
            const { data, error } = await window.supabaseClient.from(table).select('id,data').eq('user_id', currentUser.id);
            if (error) throw error;
            State[key] = (data || []).map(row => ({ ...row.data, id: /^\d+$/.test(row.id) ? Number(row.id) : row.id }));
        }));
        const { data: reminders, error: reminderError } = await window.supabaseClient.from(REMINDERS_TABLE).select('*').eq('user_id', currentUser.id).order('reminder_date', { ascending: true });
        if (reminderError) throw reminderError;
        State.reminders = (reminders || []).map(row => ({ id: row.id, title: row.title, description: row.description || '', date: row.reminder_date, time: row.reminder_time || '', color: row.color || '#6366f1', relation_type: row.relation_type || '', relation_id: row.relation_id || '', relation_label: row.relation_label || '', completed: !!row.completed, notified_at: row.notified_at || null }));
        return results;
    },
    saveAll() {
        if (!currentUser) return Promise.resolve();
        // Serialize writes to avoid overlapping saves from rapid UI interactions.
        saveQueue = saveQueue.then(async () => {
            for (const [key, table] of Object.entries(TABLES)) {
                const rows = State[key].map(item => ({ id: String(item.id), user_id: currentUser.id, data: item, updated_at: new Date().toISOString() }));
                if (rows.length) {
                    const { error } = await window.supabaseClient.from(table).upsert(rows, { onConflict: 'user_id,id' });
                    if (error) throw error;
                }
            }
        }).catch(error => { console.error('Error guardando en la base de datos:', error); Notify('No se pudieron guardar los cambios en la nube. Revisá la conexión.', 'error'); });
        return saveQueue;
    },
    async removeItem(key, id) {
        const table = TABLES[key];
        if (!table || !currentUser) return;
        const { error } = await window.supabaseClient.from(table).delete().eq('user_id', currentUser.id).eq('id', String(id));
        if (error) { console.error(error); Notify('No se pudo eliminar el registro en la nube.', 'error'); }
    }
};

/* VERSIONADO */
const APP_VERSION = "v3.4.0";
document.getElementById("appVersion").innerText = APP_VERSION;

/* THEME */
function setTheme(theme) {
  document.body.className = document.body.className.replace(/theme-\w+/g, '');
  if (theme) document.body.classList.add(theme);
  localStorage.setItem('theme', theme);
}

const savedTheme = localStorage.getItem('theme');
if (savedTheme) document.body.classList.add(savedTheme);


/* NOTIFICACIONES */
const Notify = (msg, type = 'success') => {
    const container = document.getElementById('toast-container');
    if(!container) return;
    const toast = document.createElement('div');
    const colors = {
        success: 'bg-green-600',
        info: 'bg-indigo-600',
        error: 'bg-red-600'
    };
    toast.className = `toast ${colors[type]} text-white px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm flex items-center gap-2`;
    toast.textContent = `${type === 'success' ? '✅' : 'ℹ️'} ${msg}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
};

/* COPIADO RÁPIDO */
const CopyText = (text) => {
    if(!text) return;
    navigator.clipboard.writeText(text).then(() => {
        Notify('Copiado al portapapeles');
    });
};

const UI = {
    init() {
        this.showHome();
        document.getElementById('globalSearch').addEventListener('input', (e) => {
            State.searchTerm = e.target.value.toLowerCase();
            this.refreshCurrentTab();
        });
        document.getElementById('projectSort').addEventListener('change', (e) => {
            State.projectSort = e.target.value;
            Projects.render();
        });
        document.getElementById('projectStatusFilter').addEventListener('change', (e) => {
            this.setFilter(e.target.value);
        });
    },
    resetTabs() {
        document.querySelectorAll('.tab').forEach(b => {
            b.classList.remove('bg-indigo-600', 'font-bold');
            b.classList.add('bg-white/10');
        });
        document.getElementById('filterBar').classList.add('hidden');
        this.hideForms();
        document.getElementById('btnNew').classList.remove('hidden');
        document.getElementById('globalSearch').classList.remove('hidden');
    },
    hideForms() {
        document.getElementById('formJobs').classList.add('hidden');
        document.getElementById('formProjects').classList.add('hidden');
        document.getElementById('formTools').classList.add('hidden');
    },
    clearInputs() {
        State.editingId = null;
        document.querySelectorAll('input, textarea, select').forEach(el => {
            if (el.id !== 'globalSearch') el.value = '';
        });
    },
    setFilter(status) {
    State.statusFilter = status;
        Projects.render();
    },
    showFormByTab() {
        if (!State.editingId) this.clearInputs();
        if (State.activeTab === 'jobs') document.getElementById('formJobs').classList.toggle('hidden');
        if (State.activeTab === 'projects') document.getElementById('formProjects').classList.toggle('hidden');
        if (State.activeTab === 'tools') document.getElementById('formTools').classList.toggle('hidden');
    },
    showHome() {
        State.kanban = null;
        this.resetTabs();

        State.activeTab = 'home';

        document.getElementById('tab-home')
            .classList.add('bg-indigo-600', 'font-bold');

        document.getElementById('btnNew').classList.add('hidden');
        document.getElementById('globalSearch').classList.add('hidden');
        document.getElementById('filterBar').classList.add('hidden');

        Home.render();
    },
    showJobs() { State.kanban = null; this.resetTabs(); State.activeTab = 'jobs'; document.getElementById('tab-jobs').classList.add('bg-indigo-600', 'font-bold'); Jobs.render(); },
    showProjects() {
        State.kanban = null; this.resetTabs();
        State.activeTab = 'projects';
        document.getElementById('tab-projects').classList.add('bg-indigo-600', 'font-bold');
        document.getElementById('filterBar').classList.remove('hidden');
        Projects.render();
    },
    showTools() { State.kanban = null; this.resetTabs(); State.activeTab = 'tools'; document.getElementById('tab-tools').classList.add('bg-indigo-600', 'font-bold'); Tools.render(); },
    showCalendar() { State.kanban = null; this.resetTabs(); State.activeTab = 'calendar'; document.getElementById('tab-calendar').classList.add('bg-indigo-600', 'font-bold'); document.getElementById('btnNew').classList.add('hidden'); document.getElementById('globalSearch').classList.add('hidden'); Calendar.render(); },
    refreshCurrentTab() {
    if (State.activeTab === 'home') Home.render();
    if (State.activeTab === 'jobs') Jobs.render();
    if (State.activeTab === 'projects') Projects.render();
    if (State.activeTab === 'tools') Tools.render();
    if (State.activeTab === 'calendar') Calendar.render();
    }
};

/* HOME / PÁGINA PRINCIPAL */
const Home = {
    render() {
        const container = document.getElementById('mainContentList');
        if (!container) return;

        const nickname = currentUser?.user_metadata?.nickname?.trim();
        const greetingName = nickname || currentUser?.email || 'usuario';

        const sectionStats = [
            { name: 'Trabajos', count: State.jobs.length, icon: '🗃️' },
            { name: 'Proyectos', count: State.projects.length, icon: '🧩' },
            { name: 'Herramientas', count: State.tools.length, icon: '🧰' },
            {
                name: 'Agenda',
                count: State.reminders.filter(r => !r.completed).length,
                icon: '📅'
            }
        ];

        const maxSectionCount = Math.max(
            1,
            ...sectionStats.map(section => section.count)
        );

        // Próximos recordatorios pendientes.
        const today = Calendar.dateKey(new Date());
        const reminders = [...State.reminders]
            .filter(r => !r.completed)
            .sort((a, b) =>
                `${a.date} ${a.time || '09:00'}`.localeCompare(
                    `${b.date} ${b.time || '09:00'}`
                )
            )
            .slice(0, 5);

        // Tareas Kanban cuyo vencimiento está dentro del mes actual.
        const now = new Date();
        const monthStart =
            `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const monthEnd = Calendar.dateKey(
            new Date(now.getFullYear(), now.getMonth() + 1, 0)
        );

        const dueTasks = [
            ...State.projects.flatMap(project =>
                (project.kanbanTasks || []).map(task => ({
                    ...task,
                    parentId: project.id,
                    parentName: project.name,
                    parentType: 'projects',
                    parentLabel: 'Proyecto'
                }))
            ),
            ...State.jobs.flatMap(job =>
                (job.kanbanTasks || []).map(task => ({
                    ...task,
                    parentId: job.id,
                    parentName: job.name,
                    parentType: 'jobs',
                    parentLabel: 'Trabajo'
                }))
            )
        ]
            .filter(task =>
                task.dueDate &&
                task.dueDate >= monthStart &&
                task.dueDate <= monthEnd &&
                task.status !== 'done'
            )
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

        const formatDate = value => {
            if (!value) return 'Sin fecha';
            const parts = value.split('-');
            return parts.length === 3
                ? `${parts[2]}/${parts[1]}/${parts[0]}`
                : value;
        };

        container.innerHTML = `
            <section class="space-y-7">

                <!-- SALUDO -->
                <div class="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 p-7 md:p-9 shadow-xl">
                    <div class="relative z-10 flex flex-wrap items-center justify-between gap-5">
                        <div>
                            <p class="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-indigo-300">
                                Tu espacio de trabajo
                            </p>
                            <h2 class="text-3xl md:text-4xl font-black text-white">
                                ¡Hola, ${escapeHTML(greetingName)}! 👋
                            </h2>
                            <p class="mt-3 max-w-xl text-sm text-slate-300">
                                Este es tu resumen de hoy. Organizá tus actividades y mantené
                                todo bajo control desde un solo lugar.
                            </p>
                        </div>

                        <button data-action="open-profile"
                            class="rounded-xl border border-white/15 bg-white/10 px-5 py-3
                                   text-sm font-bold text-white hover:bg-white/20">
                            ⚙️ Editar perfil
                        </button>
                    </div>

                </div>

                <!-- ESTADÍSTICAS GENERALES -->
                <section class="rounded-2xl border border-white/10 bg-slate-900/60 p-5 md:p-6">
                    <div class="mb-5">
                        <h3 class="text-xl font-black text-white">📊 Resumen de tu Dashboard</h3>
                        <p class="mt-1 text-sm text-slate-400">
                            Cantidad de elementos registrados en cada sección.
                        </p>
                    </div>

                    <div class="space-y-5">
                        ${sectionStats.map(section => {
                            const percentage = Math.round(
                                (section.count / maxSectionCount) * 100
                            );

                            return `
                                <div>
                                    <div class="mb-2 flex items-center justify-between gap-3">
                                        <span class="text-sm font-semibold text-slate-200">
                                            ${section.icon} ${section.name}
                                        </span>
                                        <span class="text-sm font-black text-white tabular-nums">
                                            ${section.count}
                                        </span>
                                    </div>

                                    <div class="h-3 overflow-hidden rounded-full bg-white/10">
                                        <div class="h-full rounded-full bg-indigo-500 transition-all duration-500"
                                            style="width: ${percentage}%;">
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </section>

                <!-- RECORDATORIOS -->
                <section class="rounded-2xl border border-white/10 bg-slate-900/50 p-5 md:p-6">
                    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h3 class="text-xl font-black text-white">📅 Próximos recordatorios</h3>
                            <p class="mt-1 text-sm text-slate-400">
                                Tus próximas actividades programadas.
                            </p>
                        </div>
                        <div class="flex gap-2">
                            <button data-action="reminder-new"
                                class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white">
                                ＋ Nuevo
                            </button>
                            <button data-action="show-calendar"
                                class="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white">
                                Ver agenda →
                            </button>
                        </div>
                    </div>

                    ${reminders.length ? `
                        <div class="space-y-3">
                            ${reminders.map(r => `
                                <article class="rounded-xl border border-white/10 bg-black/20 p-4"
                                    style="border-left:4px solid ${safeColor(r.color)}">
                                    <div class="flex flex-wrap items-start justify-between gap-3">
                                        <button data-action="reminder-edit" data-id="${escapeHTML(r.id)}"
                                            class="min-w-0 flex-1 text-left">
                                            <p class="break-words font-bold text-white">
                                                ${escapeHTML(r.title)}
                                            </p>
                                            <p class="mt-1 text-xs text-slate-400">
                                                ${formatDate(r.date)} · ${escapeHTML(r.time || '09:00')}
                                                ${r.relation_label
                                                    ? ` · ${escapeHTML(r.relation_label)}`
                                                    : ''}
                                            </p>
                                            ${r.description ? `
                                                <p class="mt-2 text-sm text-slate-400">
                                                    ${escapeHTML(r.description)}
                                                </p>
                                            ` : ''}
                                        </button>
                                        <div class="flex flex-wrap gap-2">
                                            <button data-action="reminder-edit" data-id="${escapeHTML(r.id)}"
                                                class="rounded-lg bg-white/10 px-3 py-2 text-xs text-white">
                                                Editar
                                            </button>
                                            <button data-action="reminder-done" data-id="${escapeHTML(r.id)}"
                                                class="rounded-lg bg-emerald-600/20 px-3 py-2 text-xs text-emerald-200">
                                                ✓ Realizado
                                            </button>
                                            <button data-action="reminder-delete" data-id="${escapeHTML(r.id)}"
                                                class="rounded-lg bg-red-600/20 px-3 py-2 text-xs text-red-200">
                                                Eliminar
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            `).join('')}
                        </div>
                    ` : `
                        <div class="rounded-xl border border-dashed border-white/10 p-7 text-center">
                            <p class="text-3xl">🌤️</p>
                            <p class="mt-2 font-bold text-white">No tenés recordatorios pendientes</p>
                            <p class="mt-1 text-sm text-slate-400">
                                Podés crear uno para organizar tu próxima actividad.
                            </p>
                        </div>
                    `}
                </section>

                <!-- TAREAS KANBAN DEL MES -->
                <section class="rounded-2xl border border-white/10 bg-slate-900/50 p-5 md:p-6">
                    <div class="mb-5">
                        <h3 class="text-xl font-black text-white">🎯 Tareas que vencen este mes</h3>
                        <p class="mt-1 text-sm text-slate-400">
                            Tareas de proyectos y trabajos que vencen durante este mes.
                        </p>
                    </div>

                    ${dueTasks.length ? `
                        <div class="grid gap-3 md:grid-cols-2">
                            ${dueTasks.map(task => `
                                <button data-action="open-kanban"
                                    data-type="${task.parentType}"
                                    data-id="${escapeHTML(task.parentId)}"
                                    class="rounded-xl border border-white/10 bg-black/20 p-4 text-left
                                           transition hover:border-indigo-400/50 hover:bg-white/5">
                                    <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                                        <span class="rounded-full bg-indigo-500/20 px-2 py-1 text-[10px]
                                                     font-bold uppercase text-indigo-200">
                                            ${task.parentLabel}
                                        </span>
                                        <span class="text-xs ${task.dueDate < today
                                            ? 'font-bold text-red-300'
                                            : 'text-slate-400'}">
                                            ${task.dueDate < today ? 'Vencida:' : 'Vence:'}
                                            ${formatDate(task.dueDate)}
                                        </span>
                                    </div>
                                    <p class="font-bold text-white">${escapeHTML(task.title)}</p>
                                    <p class="mt-1 text-xs text-slate-400">
                                        ${escapeHTML(task.parentName)} · Abrir tablero →
                                    </p>
                                </button>
                            `).join('')}
                        </div>
                    ` : `
                        <div class="rounded-xl border border-dashed border-white/10 p-7 text-center">
                            <p class="text-3xl">✨</p>
                            <p class="mt-2 font-bold text-white">No hay tareas Kanban pendientes con vencimiento este mes</p>
                            <p class="mt-1 text-sm text-slate-400">
                                Cuando agregues vencimientos a tus tableros, aparecerán acá.
                            </p>
                        </div>
                    `}
                </section>

                <!-- ACCESOS DIRECTOS -->
                <section>
                    <div class="mb-4">
                        <h3 class="text-xl font-black text-white">🚀 Tus secciones</h3>
                        <p class="mt-1 text-sm text-slate-400">
                            Entrá directamente a la sección que necesitás.
                        </p>
                    </div>

                    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <button data-action="show-jobs"
                            class="rounded-2xl border border-white/10 bg-slate-900/60 p-5 text-left
                                   transition hover:-translate-y-1 hover:border-indigo-400/50">
                            <span class="text-2xl">🗃️</span>
                            <p class="mt-3 font-black text-white">Trabajos</p>
                            <p class="mt-1 text-sm text-slate-400">${State.jobs.length} registrados</p>
                            <p class="mt-4 text-xs font-bold text-indigo-300">Abrir trabajos →</p>
                        </button>

                        <button data-action="show-projects"
                            class="rounded-2xl border border-white/10 bg-slate-900/60 p-5 text-left
                                   transition hover:-translate-y-1 hover:border-indigo-400/50">
                            <span class="text-2xl">🧩</span>
                            <p class="mt-3 font-black text-white">Proyectos</p>
                            <p class="mt-1 text-sm text-slate-400">${State.projects.length} registrados</p>
                            <p class="mt-4 text-xs font-bold text-indigo-300">Abrir proyectos →</p>
                        </button>

                        <button data-action="show-tools"
                            class="rounded-2xl border border-white/10 bg-slate-900/60 p-5 text-left
                                   transition hover:-translate-y-1 hover:border-indigo-400/50">
                            <span class="text-2xl">🧰</span>
                            <p class="mt-3 font-black text-white">Herramientas</p>
                            <p class="mt-1 text-sm text-slate-400">${State.tools.length} guardadas</p>
                            <p class="mt-4 text-xs font-bold text-indigo-300">Abrir herramientas →</p>
                        </button>

                        <button data-action="show-calendar"
                            class="rounded-2xl border border-white/10 bg-slate-900/60 p-5 text-left
                                   transition hover:-translate-y-1 hover:border-indigo-400/50">
                            <span class="text-2xl">📅</span>
                            <p class="mt-3 font-black text-white">Agenda</p>
                            <p class="mt-1 text-sm text-slate-400">
                                ${State.reminders.filter(r => !r.completed).length} pendientes
                            </p>
                            <p class="mt-4 text-xs font-bold text-indigo-300">Abrir agenda →</p>
                        </button>
                    </div>
                </section>

            </section>
        `;
    }
};

/* TRABAJOS */
const Jobs = {
    render() {
        const c = document.getElementById('mainContentList');
        c.innerHTML = '';
        State.jobs.filter(j => String(j.name || '').toLowerCase().includes(State.searchTerm)).forEach(j => {
            const card = document.createElement('div');
            card.className = 'relative bg-slate-900/60 p-6 rounded-tr-[40px] border-l-4 border-indigo-500 shadow-xl mb-6';
            card.className += " active:scale-95 transition";
            card.innerHTML = `
                <div class="absolute top-0 right-0 bg-indigo-600 text-white text-[9px] font-black px-4 py-1.5 rounded-bl-xl uppercase tracking-widest">PERFIL TRABAJO</div>
                <div class="flex justify-between items-start mb-6">
                    <div>
                        <h3 class="text-3xl font-black text-white">${escapeHTML(j.name)}</h3>
                        <p class="text-indigo-400 font-bold text-xs uppercase">${escapeHTML(j.role || '')} • ${escapeHTML(j.contract || '')}</p>
                    </div>
                    <div class="flex gap-3 items-center">
                        <button data-action="open-kanban" data-type="jobs" data-id="${escapeHTML(j.id)}" class="rounded-lg bg-indigo-600/20 border border-indigo-500/30 px-3 py-1.5 text-xs font-bold text-indigo-200 hover:bg-indigo-600/40">📋 Tablero</button>
                        <button data-action="job-edit" data-id="${escapeHTML(j.id)}" class="text-indigo-400 hover:scale-125 transition">✏️</button>
                        <button data-action="job-remove" data-id="${escapeHTML(j.id)}" class="text-red-400 hover:scale-125 transition">✖</button>
                    </div>
                </div>
                <div class="grid md:grid-cols-2 gap-8">
                    <div>
                        <div class="flex items-center gap-2">
                             ${j.link && safeURL(j.link) ? `<a rel="noopener noreferrer" href="${escapeHTML(safeURL(j.link))}" target="_blank" class="bg-indigo-500/20 px-4 py-2 rounded-xl text-white text-sm border border-indigo-500/30">🔗 ${escapeHTML(j.linkName || 'Acceso')}</a>` : ''}
                             ${j.link ? `<button data-action="job-copy-link" data-id="${escapeHTML(j.id)}" class="text-xs text-white/40 hover:text-white">📋</button>` : ''}
                        </div>
                        <div class="relative mt-4 p-4 bg-black/20 rounded-xl text-sm italic text-slate-400 border border-white/5 whitespace-pre-line group">
                            ${escapeHTML(j.notes || 'Sin notas.')}
                            <button data-action="job-copy-notes" data-id="${escapeHTML(j.id)}" class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition text-[10px] bg-indigo-500 text-white px-2 py-1 rounded">COPIAR</button>
                        </div>
                    </div>
                    <div class="bg-white/5 p-4 rounded-xl border border-white/5">
                        <div id="todos-job-${escapeHTML(j.id)}" class="space-y-1 mb-3"></div>
                        <div class="flex gap-2">
                            <input id="input-job-${escapeHTML(j.id)}" class="bg-black/20 p-2 rounded text-xs flex-1 text-white border border-white/10 focus:outline-none" placeholder="Nueva tarea..." data-enter-action="job-add-todo" data-id="${escapeHTML(j.id)}">
                            <button data-action="job-add-todo" data-id="${escapeHTML(j.id)}" class="bg-green-600 px-3 rounded text-white font-bold">+</button>
                        </div>
                    </div>
                </div>`;
            c.appendChild(card);
            this.renderTodos(j);
        });
    },
    renderTodos(job) {
        const c = document.getElementById(`todos-job-${job.id}`);
        if(!c) return;
        c.innerHTML = (job.todos || []).map((t, i) => `
            <div class="flex justify-between items-center group/item text-sm text-white/70">
                <div class="flex gap-2 items-center">
                    <input type="checkbox" ${t.done ? 'checked' : ''} data-action="job-toggle-todo" data-id="${escapeHTML(job.id)}" data-index="${i}" class="accent-indigo-500">
                    <span class="${t.done ? 'line-through opacity-40' : ''}">${escapeHTML(t.text)}</span>
                </div>
                <button data-action="job-remove-todo" data-id="${escapeHTML(job.id)}" data-index="${i}" class="opacity-0 group-hover/item:opacity-100 text-red-400 text-[10px]">ELIMINAR</button>
            </div>`).join('');
    },
    save() {
        const name = document.getElementById('jName').value.trim();
        if (!name) return;
        
        const data = { 
            id: State.editingId || Date.now(), 
            name, 
            role: document.getElementById('jRole').value, 
            contract: document.getElementById('jContract').value, 
            linkName: document.getElementById('jLinkName').value, 
            link: document.getElementById('jUrl').value, 
            notes: document.getElementById('jNotes').value, 
            todos: State.editingId ? (State.jobs.find(j => j.id === State.editingId)?.todos || []) : [],
            kanbanTasks: State.editingId ? (State.jobs.find(j => j.id === State.editingId)?.kanbanTasks || []) : []
        };

        if (State.editingId) {
            State.jobs = State.jobs.map(j => j.id === State.editingId ? data : j);
        } else {
            State.jobs.push(data);
        }

        Storage.saveAll(); UI.clearInputs(); UI.hideForms(); this.render();
        Notify(State.editingId ? 'Cambios guardados' : 'Trabajo guardado');
    },
    edit(id) {
        const j = State.jobs.find(x => x.id === id);
        if(!j) return;
        State.editingId = id;
        document.getElementById('formJobs').classList.remove('hidden');
        
        // RELLENAR TODOS LOS CAMPOS
        document.getElementById('jName').value = j.name || '';
        document.getElementById('jRole').value = j.role || '';
        document.getElementById('jContract').value = j.contract || '';
        document.getElementById('jLinkName').value = j.linkName || '';
        document.getElementById('jUrl').value = j.link || '';
        document.getElementById('jNotes').value = j.notes || '';
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    remove(id) { if (confirm('¿Eliminar trabajo?')) { State.jobs = State.jobs.filter(j => j.id !== id); Storage.removeItem('jobs', id); Storage.saveAll(); this.render(); Notify('Trabajo eliminado', 'error'); } },
    addTodo(id) {
        const input = document.getElementById(`input-job-${id}`);
        if (!input.value.trim()) return;
        const job = State.jobs.find(j => j.id === id);
        if (!job.todos) job.todos = [];
        job.todos.push({ text: input.value, done: false });
        Storage.saveAll(); this.renderTodos(job); input.value = '';
        Notify('Tarea agregada');
    },
    toggleTodo(id, i) {
        const job = State.jobs.find(j => j.id === id);
        job.todos[i].done = !job.todos[i].done;
        Storage.saveAll(); this.renderTodos(job);
        if (job.todos[i].done) Notify('Tarea completada');
    },
    removeTodo(id, i) {
        const job = State.jobs.find(j => j.id === id);
        job.todos.splice(i, 1);
        Storage.saveAll(); this.renderTodos(job);
        Notify('Tarea eliminada', 'info');
    }
};

/* PROYECTOS */
const Projects = {
    render() {
        const c = document.getElementById('mainContentList');
        c.innerHTML = '';
        // Estados disponibles y cantidad de proyectos por estado.
        const statusOptions = [
            'En diseño',
            'En desarrollo',
            'Testing',
            'Producción',
            'Mantenimiento',
            'Offline',
            'Sin Estado'
        ];

        const statusCounts = {
            'Todos': State.projects.length
        };

        statusOptions.forEach(status => {
            statusCounts[status] = State.projects.filter(project => {
                const projectStatus = String(project.status || '').trim();

                if (status === 'Sin Estado') {
                    return projectStatus === '';
                }

                return projectStatus === status;
            }).length;
        });

        // Actualizar opciones del desplegable sin perder la selección.
        const statusSelect = document.getElementById('projectStatusFilter');

        if (statusSelect) {
            statusSelect.innerHTML = [
                `<option value="Todos">Todos (${statusCounts['Todos']})</option>`,
                ...statusOptions.map(status =>
                    `<option value="${escapeHTML(status)}">${escapeHTML(status)} (${statusCounts[status]})</option>`
                )
            ].join('');

            statusSelect.value = State.statusFilter;
        }

        let filtered = State.projects.filter(p =>
            String(p.name || '').toLowerCase().includes(State.searchTerm)
        );

        if (State.statusFilter !== 'Todos') {
            filtered = filtered.filter(p => {
                const projectStatus = String(p.status || '').trim();

                if (State.statusFilter === 'Sin Estado') {
                    return projectStatus === '';
                }

                return projectStatus === State.statusFilter;
            });
        }
        filtered.sort((a, b) => {
            const dateA = Date.parse(a.updatedAt || '') || 0;
            const dateB = Date.parse(b.updatedAt || '') || 0;

            return State.projectSort === 'asc'
                ? dateA - dateB
                : dateB - dateA;
        });

        if(filtered.length === 0) {
            c.innerHTML = `<div class="text-center py-20 text-slate-500">No hay proyectos en esta categoría.</div>`;
        }

        filtered.forEach(p => {
            const card = document.createElement('div');
            card.className = 'bg-white/5 p-6 rounded-3xl border border-white/10 mb-6 backdrop-blur-sm';
            card.className += " active:scale-95 transition";
            card.innerHTML = `
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h3 class="text-2xl font-bold text-white">${escapeHTML(p.name)}</h3>
                        <div class="flex flex-wrap gap-2 text-[10px] uppercase font-bold mt-2 text-indigo-300">
                            <span class="bg-indigo-500/20 px-2 py-0.5 rounded">
                                ${escapeHTML(p.status || 'Sin estado')}
                            </span>
                            
                            <span class="bg-white/5 px-2 py-0.5 rounded">
                                Versión: ${escapeHTML(p.version || 'Sin versión')}
                            </span>
                            
                            <span class="bg-white/5 px-2 py-0.5 rounded">
                                Cliente: ${escapeHTML(p.client || 'Sin cliente')}
                            </span>

                            <span class="bg-white/5 px-2 py-0.5 rounded">
                                Último cambio: ${p.updatedAt
                                ? escapeHTML(new Date(p.updatedAt).toLocaleDateString('es-AR'))
                                    : 'Sin registro'}
                            </span>
                        </div>
                    </div>
                    <div class="flex gap-2 items-center">
                        <button data-action="open-kanban" data-type="projects" data-id="${escapeHTML(p.id)}" class="rounded-lg bg-indigo-600/20 border border-indigo-500/30 px-3 py-1.5 text-xs font-bold text-indigo-200 hover:bg-indigo-600/40">📋 Tablero</button>
                        <button data-action="project-edit" data-id="${escapeHTML(p.id)}" class="hover:scale-125 transition">✏️</button>
                        <button data-action="project-remove" data-id="${escapeHTML(p.id)}" class="text-red-400 hover:scale-125 transition">✖</button>
                    </div>
                </div>
                
                <div class="grid md:grid-cols-2 gap-8">
                    <div>
                        <div class="flex flex-wrap gap-2 mb-4">
                            ${this.getLinkBtn(p.link, '🌐', 'Proyecto')}
                            ${this.getLinkBtn(p.qa, '🔗', 'URL')}
                            ${this.getLinkBtn(p.docs, '📄', 'Docs')}
                            ${this.getLinkBtn(p.videos, '🎬', 'Videos')}
                            ${this.getLinkBtn(p.secure, '🔐', 'Archivos Cifrados')}
                        </div>
                        <div class="relative group bg-black/30 p-4 rounded-xl text-sm text-slate-400 italic border border-white/5">
                            ${escapeHTML(p.notes || 'Sin notas.')}
                            <button data-action="project-copy-notes" data-id="${escapeHTML(p.id)}" class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-white/10 p-1 rounded">📋</button>
                        </div>
                    </div>

                    <div class="bg-indigo-900/10 p-4 rounded-xl border border-indigo-500/10">
                        <div id="todos-proj-${escapeHTML(p.id)}" class="space-y-1 mb-3"></div>
                        <div class="flex gap-2">
                            <input id="input-proj-${escapeHTML(p.id)}" class="bg-black/40 p-2 rounded text-xs flex-1 text-white border border-white/10 focus:outline-none" placeholder="Nueva tarea..." data-enter-action="project-add-todo" data-id="${escapeHTML(p.id)}">
                            <button data-action="project-add-todo" data-id="${escapeHTML(p.id)}" class="bg-indigo-600 px-3 rounded text-white font-bold">+</button>
                        </div>
                    </div>
                </div>
            `;
            c.appendChild(card);
            this.renderTodos(p);
        });
    },
    getLinkBtn(url, emoji, label) {
        const href = safeURL(String(url || '').trim());
        if (!href) return '';
        return `
        <div class="flex items-center gap-1 bg-white/5 rounded-lg px-2 py-1 border border-white/5">
            <a href="${escapeHTML(href)}" rel="noopener noreferrer" target="_blank" class="text-xs text-white/70 hover:text-white">${escapeHTML(emoji)} ${escapeHTML(label)}</a>
            <button data-action="copy-url" data-url="${escapeHTML(url)}" class="text-[10px] text-white/30 hover:text-white">📋</button>
        </div>`;
    },
    renderTodos(proj) {
        const c = document.getElementById(`todos-proj-${proj.id}`);
        if(!c) return;
        c.innerHTML = (proj.todos || []).map((t, i) => `
            <div class="flex justify-between items-center group/item text-xs text-white/70">
                <div class="flex gap-2 items-center">
                    <input type="checkbox" ${t.done ? 'checked' : ''} data-action="project-toggle-todo" data-id="${escapeHTML(proj.id)}" data-index="${i}">
                    <span class="${t.done ? 'line-through opacity-40' : ''}">${escapeHTML(t.text)}</span>
                </div>
                <button data-action="project-remove-todo" data-id="${escapeHTML(proj.id)}" data-index="${i}" class="opacity-0 group-hover/item:opacity-100 text-red-500 transition">✖</button>
            </div>`).join('');
    },
    save() {
        const name = document.getElementById('pName').value.trim();
        if (!name) return;
        
        const data = { 
            id: State.editingId || Date.now(), 
            name, 
            status: document.getElementById('pStatus').value, 
            version: document.getElementById('pVersion').value, 
            date: document.getElementById('pDate').value,
            updatedAt: document.getElementById('pUpdatedAt').value,
            client: document.getElementById('pClient').value, 
            link: document.getElementById('pLink').value.trim(),
            qa: document.getElementById('pQaLink').value.trim(),
            docs: document.getElementById('pDocs').value.trim(),
            videos: document.getElementById('pVideos').value.trim(),
            secure: document.getElementById('pSecure').value.trim(),
            notes: document.getElementById('pNotes').value, 
            todos: State.editingId ? (State.projects.find(p => p.id === State.editingId)?.todos || []) : [],
            kanbanTasks: State.editingId ? (State.projects.find(p => p.id === State.editingId)?.kanbanTasks || []) : []
        };

        if (State.editingId) {
            State.projects = State.projects.map(p => p.id === State.editingId ? data : p);
        } else {
            State.projects.push(data);
        }

        Storage.saveAll(); UI.clearInputs(); UI.hideForms(); this.render();
        Notify('Proyecto guardado');
    },
    edit(id) {
        const p = State.projects.find(x => x.id === id);
        if(!p) return;
        State.editingId = id;
        document.getElementById('formProjects').classList.remove('hidden');
        
        // RELLENAR TODOS LOS CAMPOS
        document.getElementById('pName').value = p.name || '';
        document.getElementById('pStatus').value = p.status ?? 'En diseño';
        document.getElementById('pVersion').value = p.version || '';
        document.getElementById('pDate').value = p.date || '';
        document.getElementById('pUpdatedAt').value = p.updatedAt ? String(p.updatedAt).slice(0, 10) : '';
        document.getElementById('pClient').value = p.client || '';
        document.getElementById('pLink').value = p.link || '';
        document.getElementById('pQaLink').value = p.qa || '';
        document.getElementById('pDocs').value = p.docs || '';
        document.getElementById('pVideos').value = p.videos || '';
        document.getElementById('pSecure').value = p.secure || '';
        document.getElementById('pNotes').value = p.notes || '';
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    remove(id) { if (confirm('¿Eliminar proyecto?')) { State.projects = State.projects.filter(p => p.id !== id); Storage.removeItem('projects', id); Storage.saveAll(); this.render(); Notify('Proyecto eliminado', 'error'); } },
    addTodo(id) {
        const input = document.getElementById(`input-proj-${id}`);
        if (!input.value.trim()) return;
        const p = State.projects.find(x => x.id === id);
        if (!p.todos) p.todos = [];
        p.todos.push({ text: input.value, done: false });
        Storage.saveAll(); this.renderTodos(p); input.value = '';
        Notify('Tarea agregada');
    },
    toggleTodo(id, i) {
        const p = State.projects.find(x => x.id === id);
        p.todos[i].done = !p.todos[i].done;
        Storage.saveAll(); this.renderTodos(p);
        if (p.todos[i].done) Notify('Tarea completada');
    },
    removeTodo(id, i) {
        const p = State.projects.find(x => x.id === id);
        p.todos.splice(i, 1);
        Storage.saveAll(); this.renderTodos(p);
        Notify('Tarea eliminada', 'info');
    }
};

/* TABLEROS KANBAN: las tareas se guardan dentro del registro JSON del proyecto/trabajo. */
const Kanban = {
    statuses: [
        { id: 'pending', label: 'Pendiente', color: 'border-slate-500' },
        { id: 'progress', label: 'En progreso', color: 'border-blue-500' },
        { id: 'review', label: 'En revisión', color: 'border-amber-500' },
        { id: 'done', label: 'Completada', color: 'border-emerald-500' }
    ],
    parent() {
        if (!State.kanban) return null;
        const list = State.kanban.type === 'jobs' ? State.jobs : State.projects;
        return list.find(item => String(item.id) === String(State.kanban.id)) || null;
    },
    open(type, id) {
        const list = type === 'jobs' ? State.jobs : State.projects;
        const parent = list.find(item => String(item.id) === String(id));
        if (!parent) return;
        if (!Array.isArray(parent.kanbanTasks)) parent.kanbanTasks = [];
        State.kanban = { type, id: parent.id };
        document.getElementById('filterBar').classList.add('hidden');
        UI.hideForms();
        this.render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    back() {
        const type = State.kanban?.type;
        State.kanban = null;
        if (type === 'jobs') UI.showJobs(); else UI.showProjects();
    },
    render() {
        const parent = this.parent();
        const container = document.getElementById('mainContentList');
        if (!parent || !container) { this.back(); return; }
        const tasks = Array.isArray(parent.kanbanTasks) ? parent.kanbanTasks : [];
        const typeLabel = State.kanban.type === 'jobs' ? 'Trabajo' : 'Proyecto';
        container.innerHTML = `
            <section class="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div><button data-action="kanban-back" class="mb-3 rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20">← Volver a ${typeLabel.toLowerCase()}s</button>
                <p class="text-xs font-bold uppercase tracking-widest text-indigo-300">Tablero Kanban · ${typeLabel}</p>
                <h2 class="mt-1 text-3xl font-black text-white">${escapeHTML(parent.name)}</h2>
                <p class="mt-1 text-sm text-slate-400">${tasks.length} tarea${tasks.length === 1 ? '' : 's'} · Los vencimientos no generan notificaciones</p>
              </div>
              <button data-action="kanban-add" class="rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white hover:bg-indigo-500">＋ Nueva tarea</button>
            </section>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">${this.statuses.map(status => {
                const columnTasks = tasks.filter(task => (task.status || 'pending') === status.id);
                return `<section class="min-w-0 rounded-2xl border border-white/10 bg-black/15 p-3">
                  <div class="mb-3 flex items-center justify-between border-b border-white/10 pb-3"><h3 class="font-black text-white">${status.label}</h3><span class="rounded-full bg-white/10 px-2.5 py-1 text-xs text-slate-300">${columnTasks.length}</span></div>
                  <div class="space-y-3">${columnTasks.length ? columnTasks.map(task => this.taskHTML(task, status)).join('') : '<p class="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-slate-500">Sin tareas</p>'}</div>
                </section>`;
            }).join('')}</div>`;
    },
    taskHTML(task, status) {
        const due = task.dueDate ? new Date(`${task.dueDate}T00:00:00`) : null;
        const overdue = due && due < new Date(new Date().toDateString()) && task.status !== 'done';
        const priority = { low: 'Baja', medium: 'Media', high: 'Alta' }[task.priority] || 'Media';
        const priorityClass = task.priority === 'high' ? 'bg-red-500/20 text-red-300' : task.priority === 'low' ? 'bg-slate-500/20 text-slate-300' : 'bg-amber-500/20 text-amber-200';
        return `<article class="rounded-xl border-l-4 ${status.color} border border-white/10 bg-slate-900/90 p-3 shadow-lg">
          <div class="mb-2 flex items-start justify-between gap-2"><h4 class="break-words font-bold text-white">${escapeHTML(task.title)}</h4><div class="flex shrink-0 gap-1"><button data-action="kanban-edit" data-task-id="${escapeHTML(task.id)}" class="rounded px-1.5 text-sm text-indigo-300 hover:bg-white/10" aria-label="Editar tarea">✏️</button><button data-action="kanban-delete" data-task-id="${escapeHTML(task.id)}" class="rounded px-1.5 text-sm text-red-300 hover:bg-white/10" aria-label="Eliminar tarea">✕</button></div></div>
          ${task.description ? `<p class="mb-3 whitespace-pre-line break-words text-sm text-slate-400">${escapeHTML(task.description)}</p>` : ''}
          <div class="mb-3 flex flex-wrap gap-1.5"><span class="rounded-full px-2 py-1 text-[11px] ${priorityClass}">Prioridad ${priority.toLowerCase()}</span>${task.label ? `<span class="rounded-full bg-indigo-500/20 px-2 py-1 text-[11px] text-indigo-200">${escapeHTML(task.label)}</span>` : ''}</div>
          ${task.dueDate ? `<p class="mb-3 text-xs ${overdue ? 'font-bold text-red-300' : 'text-slate-400'}">📅 ${overdue ? 'Vencida · ' : 'Vence · '}${escapeHTML(task.dueDate)}</p>` : ''}
          <label class="block text-[11px] text-slate-500">Mover a</label><select data-action="kanban-move" data-task-id="${escapeHTML(task.id)}" class="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 p-2 text-xs text-white">${this.statuses.map(item => `<option value="${item.id}" ${item.id === (task.status || 'pending') ? 'selected' : ''}>${item.label}</option>`).join('')}</select>
        </article>`;
    },
    openForm(task = null) {
        const form = document.getElementById('kanbanTaskForm');
        if (!form) return;
        form.reset();
        document.getElementById('kanbanTaskId').value = task?.id || '';
        document.getElementById('kanbanTaskTitle').value = task?.title || '';
        document.getElementById('kanbanTaskDescription').value = task?.description || '';
        document.getElementById('kanbanTaskPriority').value = task?.priority || 'medium';
        document.getElementById('kanbanTaskDueDate').value = task?.dueDate || '';
        document.getElementById('kanbanTaskLabel').value = task?.label || '';
        document.getElementById('kanbanTaskStatus').value = task?.status || 'pending';
        document.getElementById('kanbanTaskModalTitle').textContent = task ? 'Editar tarea' : 'Nueva tarea';
        document.getElementById('kanbanTaskModal').classList.remove('hidden');
        document.getElementById('kanbanTaskTitle').focus();
    },
    save(event) {
        event.preventDefault();
        const parent = this.parent();
        if (!parent) return;
        const title = document.getElementById('kanbanTaskTitle').value.trim();
        if (!title) { Notify('El título es obligatorio', 'error'); return; }
        if (!Array.isArray(parent.kanbanTasks)) parent.kanbanTasks = [];
        
        const id = document.getElementById('kanbanTaskId').value;
        const previous = parent.kanbanTasks.find(task => String(task.id) === String(id));
        const task = {
            id: previous?.id || (crypto.randomUUID ? crypto.randomUUID() : `task-${Date.now()}-${Math.random().toString(16).slice(2)}`),
            title,
            description: document.getElementById('kanbanTaskDescription').value.trim(),
            priority: document.getElementById('kanbanTaskPriority').value,
            dueDate: document.getElementById('kanbanTaskDueDate').value,
            label: document.getElementById('kanbanTaskLabel').value.trim(),
            status: document.getElementById('kanbanTaskStatus').value,
            createdAt: previous?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        if (previous) parent.kanbanTasks = parent.kanbanTasks.map(item => String(item.id) === String(id) ? task : item);
        else parent.kanbanTasks.push(task);
        document.getElementById('kanbanTaskModal').classList.add('hidden');
        Storage.saveAll(); this.render(); Notify(previous ? 'Tarea actualizada' : 'Tarea creada');
    },
    edit(taskId) { const task = this.parent()?.kanbanTasks?.find(item => String(item.id) === String(taskId)); if (task) this.openForm(task); },
    remove(taskId) {
        const parent = this.parent();
        if (!parent || !confirm('¿Eliminar esta tarea del tablero?')) return;
        parent.kanbanTasks = (parent.kanbanTasks || []).filter(item => String(item.id) !== String(taskId));
        Storage.saveAll(); this.render(); Notify('Tarea eliminada', 'info');
    },
    move(taskId, status) {
        const parent = this.parent();
        if (!parent) return;

        const task = (parent.kanbanTasks || []).find(
            item => String(item.id) === String(taskId)
        );

        if (!task || !this.statuses.some(item => item.id === status)) return;

        // Comprobar si la tarea ya estaba completada.
        const wasCompleted = task.status === 'done';

        // Actualizar el estado de la tarea.
        task.status = status;
        task.updatedAt = new Date().toISOString();

        // Actualizar el proyecto o trabajo solamente al pasar a Completada.
        if (status === 'done' && !wasCompleted) {
            parent.updatedAt = new Date().toISOString();
        }

        Storage.saveAll();
        this.render();
        Notify('Estado actualizado');
    }
};

/* AGENDA / RECORDATORIOS */
const Calendar = {
    monthNames: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
    weekdays: ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'],
    dateKey(date) { const y=date.getFullYear(); const m=String(date.getMonth()+1).padStart(2,'0'); const d=String(date.getDate()).padStart(2,'0'); return `${y}-${m}-${d}`; },
    render() {
        const container = document.getElementById('mainContentList');
        if (!container) return;
        const year=State.calendarDate.getFullYear(), month=State.calendarDate.getMonth();
        const first=new Date(year,month,1); const offset=(first.getDay()+6)%7; const days=new Date(year,month+1,0).getDate();
        const cells=[];
        for(let i=0;i<offset;i++) cells.push('<div class="min-h-24 rounded-xl border border-white/5 bg-black/10 p-2 opacity-40"></div>');
        for(let day=1;day<=days;day++) {
            const date=this.dateKey(new Date(year,month,day));
            const items=State.reminders.filter(r=>r.date===date);
            cells.push(`<div class="min-h-24 rounded-xl border border-white/10 bg-slate-900/50 p-2"><div class="mb-2 text-xs font-black ${date===this.dateKey(new Date())?'text-indigo-300':''}">${day}</div><div class="space-y-1">${items.slice(0,3).map(r=>`<button data-action="reminder-edit" data-id="${escapeHTML(r.id)}" title="${escapeHTML(r.title)}" class="block w-full truncate rounded-md px-1.5 py-1 text-left text-[10px] ${r.completed?'opacity-50 line-through':''}" style="background:${safeColor(r.color)}33;border-left:3px solid ${safeColor(r.color)}">${r.time?escapeHTML(r.time)+' ':''}${escapeHTML(r.title)}</button>`).join('')}${items.length>3?`<p class="text-[10px] text-slate-400">+${items.length-3} más</p>`:''}</div></div>`);
        }
        container.innerHTML=`<section class="space-y-5"><div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="text-3xl font-black text-white">📅 Agenda</h2><p class="mt-1 text-sm text-slate-400">Crea tus recordatorios.</p></div><button data-action="reminder-new" class="rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white">＋ Nuevo recordatorio</button></div><div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-3"><div class="flex items-center gap-3"><button data-action="calendar-prev" class="rounded-lg bg-white/10 px-3 py-2" aria-label="Mes anterior">‹</button><h3 class="min-w-44 text-center text-xl font-black text-white">${this.monthNames[month]} ${year}</h3><button data-action="calendar-next" class="rounded-lg bg-white/10 px-3 py-2" aria-label="Mes siguiente">›</button></div><button data-action="calendar-today" class="rounded-lg bg-white/10 px-3 py-2 text-sm">Hoy</button></div><div class="grid grid-cols-7 gap-2">${this.weekdays.map(d=>`<div class="py-1 text-center text-xs font-bold uppercase text-slate-400">${d}</div>`).join('')}${cells.join('')}</div><div class="space-y-3"><h3 class="text-xl font-black text-white">Próximos recordatorios</h3>${this.listHTML()}</div></section>`;
    },
    listHTML() {
        const today = this.dateKey(new Date());

        const rows = [...State.reminders].sort((a, b) =>
            (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))
        );

        if (!rows.length) {
            return '<p class="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">No tenés recordatorios.</p>';
        }

        return `<div class="space-y-2">
            ${rows.map(r => `
                <article class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3"
                    style="border-left:4px solid ${safeColor(r.color)}">

                    <div class="min-w-0 flex-1">
                        <div class="flex flex-wrap items-center gap-2">
                            <p class="font-bold text-white">${escapeHTML(r.title)}</p>
                            ${r.completed
                                ? '<span class="rounded-full bg-emerald-600/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">Completado</span>'
                                : ''}
                        </div>

                        <p class="text-xs text-slate-400">
                            ${escapeHTML(r.date)}
                            ${r.time ? ` · ${escapeHTML(r.time)}` : ''}
                            ${r.relation_label ? ` · ${escapeHTML(r.relation_label)}` : ''}
                            ${!r.completed && r.date < today ? ' · Vencido' : ''}
                        </p>

                        ${r.description
                            ? `<p class="mt-1 whitespace-pre-line text-sm text-slate-400">${escapeHTML(r.description)}</p>`
                            : ''}
                    </div>

                    <div class="flex flex-wrap gap-2">
                        ${!r.completed ? `
                            <button data-action="reminder-done"
                                data-id="${escapeHTML(r.id)}"
                                class="rounded-lg bg-emerald-600/20 px-3 py-1.5 text-xs text-emerald-200">
                                Realizado
                            </button>
                        ` : ''}

                        <button data-action="reminder-edit"
                            data-id="${escapeHTML(r.id)}"
                            class="rounded-lg bg-white/10 px-3 py-1.5 text-xs">
                            Editar
                        </button>

                        <button data-action="reminder-delete"
                            data-id="${escapeHTML(r.id)}"
                            class="rounded-lg bg-red-600/20 px-3 py-1.5 text-xs text-red-200">
                            Eliminar
                        </button>
                    </div>
                </article>
            `).join('')}
        </div>`;
    },
    relatedOptions(type) {
        if(type==='project') return State.projects.map(x=>({id:String(x.id),label:`Proyecto: ${x.name}`}));
        if(type==='job') return State.jobs.map(x=>({id:String(x.id),label:`Trabajo: ${x.name}`}));
        if(type==='task') return [...State.projects.map(p=>(p.kanbanTasks||[]).map(t=>({id:`projects:${p.id}:${t.id}`,label:`Tarea: ${t.title} · ${p.name}`}))).flat(),...State.jobs.map(j=>(j.kanbanTasks||[]).map(t=>({id:`jobs:${j.id}:${t.id}`,label:`Tarea: ${t.title} · ${j.name}`}))).flat()];
        return [];
    },
    relationChanged() {
        const type=document.getElementById('reminderRelation').value, wrap=document.getElementById('reminderTargetWrap'), select=document.getElementById('reminderTarget');
        const options=this.relatedOptions(type); wrap.classList.toggle('hidden',!type || !options.length);
        select.innerHTML=options.map(o=>`<option value="${escapeHTML(o.id)}">${escapeHTML(o.label)}</option>`).join('');
        if(type && !options.length) { select.innerHTML='<option value="">No hay elementos disponibles</option>'; }
    },
    openForm(reminder=null) {
        const form=document.getElementById('reminderForm'); form.reset();
        document.getElementById('reminderId').value=reminder?.id||'';
        document.getElementById('reminderTitle').value=reminder?.title||'';
        document.getElementById('reminderDescription').value=reminder?.description||'';
        document.getElementById('reminderDate').value=reminder?.date||this.dateKey(new Date());
        document.getElementById('reminderTime').value=reminder?.time||'';
        document.getElementById('reminderColor').value=reminder?.color||'#6366f1';
        document.getElementById('reminderRelation').value=reminder?.relation_type||'';
        this.relationChanged();
        if(reminder?.relation_id) document.getElementById('reminderTarget').value=reminder.relation_id;
        document.getElementById('reminderModalTitle').textContent=reminder?'Editar recordatorio':'Nuevo recordatorio';
        document.getElementById('reminderModal').classList.remove('hidden');
    },
    async save(event) {
        event.preventDefault(); if(!currentUser) return;
        const id=document.getElementById('reminderId').value;
        const type=document.getElementById('reminderRelation').value;
        const target=document.getElementById('reminderTarget').value;
        let relationId='', relationLabel='';
        if(type==='project') { const x=State.projects.find(i=>String(i.id)===target); relationId=target; relationLabel=x?`Proyecto: ${x.name}`:''; }
        if(type==='job') { const x=State.jobs.find(i=>String(i.id)===target); relationId=target; relationLabel=x?`Trabajo: ${x.name}`:''; }
        if(type==='task' && target) { const [kind,parentId,taskId]=target.split(':'); const list=kind==='jobs'?State.jobs:State.projects; const parent=list.find(i=>String(i.id)===parentId); const task=parent?.kanbanTasks?.find(i=>String(i.id)===taskId); relationId=target; relationLabel=task?`Tarea: ${task.title} · ${parent.name}`:''; }
        const payload={user_id:currentUser.id,title:document.getElementById('reminderTitle').value.trim(),description:document.getElementById('reminderDescription').value.trim(),reminder_date:document.getElementById('reminderDate').value,reminder_time:document.getElementById('reminderTime').value||null,color:safeColor(document.getElementById('reminderColor').value),relation_type:type||null,relation_id:relationId||null,relation_label:relationLabel||null};
        if(!payload.title||!payload.reminder_date) { Notify('Completá el título y la fecha','error'); return; }
        let result;
        if(id) result=await window.supabaseClient.from(REMINDERS_TABLE).update(payload).eq('id',id).eq('user_id',currentUser.id).select().single();
        else result=await window.supabaseClient.from(REMINDERS_TABLE).insert(payload).select().single();
        if(result.error) { console.error(result.error); Notify('No se pudo guardar. Verificá que ejecutaste la migración SQL de recordatorios.','error'); return; }
        const row=result.data, item={id:row.id,title:row.title,description:row.description||'',date:row.reminder_date,time:row.reminder_time||'',color:safeColor(row.color),relation_type:row.relation_type||'',relation_id:row.relation_id||'',relation_label:row.relation_label||'',completed:!!row.completed,notified_at:row.notified_at||null};
        const ix=State.reminders.findIndex(r=>String(r.id)===String(item.id)); if(ix>=0) State.reminders[ix]=item; else State.reminders.push(item);
        document.getElementById('reminderModal').classList.add('hidden'); UI.refreshCurrentTab();; Notify('Recordatorio guardado');
    },
    async update(id, changes, message) {
        const result=await window.supabaseClient.from(REMINDERS_TABLE).update(changes).eq('id',id).eq('user_id',currentUser.id).select().single();
        if(result.error) { console.error(result.error); Notify('No se pudo actualizar el recordatorio','error'); return; }
        const row=result.data, item=State.reminders.find(r=>String(r.id)===String(id)); if(item) Object.assign(item,{completed:!!row.completed,notified_at:row.notified_at||null});
        UI.refreshCurrentTab(); Notify(message);
    },
    async remove(id) {
        if(!confirm('¿Eliminar este recordatorio?')) return;
        const {error}=await window.supabaseClient.from(REMINDERS_TABLE).delete().eq('id',id).eq('user_id',currentUser.id);
        if(error) { console.error(error); Notify('No se pudo eliminar el recordatorio','error'); return; }
        State.reminders=State.reminders.filter(r=>String(r.id)!==String(id)); UI.refreshCurrentTab(); Notify('Recordatorio eliminado','info');
    },
    showAlert(reminder) {
        if (!reminder) return;

        State.activeReminderId = String(reminder.id);

        const modal = document.getElementById('reminderAlertModal');
        const card = document.getElementById('reminderAlertCard');

        document.getElementById('reminderAlertTitle').textContent =
            reminder.title;

        document.getElementById('reminderAlertDate').textContent =
            `${reminder.date} · ${reminder.time || '09:00'}` +
            (reminder.relation_label ? ` · ${reminder.relation_label}` : '');

        document.getElementById('reminderAlertDescription').textContent =
            reminder.description || 'No hay una descripción adicional.';

        card.style.borderTopColor = safeColor(reminder.color);
        modal.classList.remove('hidden');
    },

    showNextAlert() {
        if (State.activeReminderId !== null) return;

        while (State.reminderQueue.length) {
            const next = State.reminderQueue.shift();

            const reminder = State.reminders.find(
                r => String(r.id) === String(next.id)
            );

            if (!reminder || reminder.completed) continue;

            this.showAlert(reminder);
            return;
        }
    },

    closeAlert() {
        document.getElementById('reminderAlertModal').classList.add('hidden');
        State.activeReminderId = null;
        this.showNextAlert();
    },

    async snooze(minutes) {
        const id = State.activeReminderId;
        if (id === null) return;

        const reminder = State.reminders.find(
            r => String(r.id) === String(id)
        );

        if (!reminder) {
            this.closeAlert();
            return;
        }

        const newDate = new Date(Date.now() + minutes * 60 * 1000);
        const date = this.dateKey(newDate);
        const time = `${String(newDate.getHours()).padStart(2, '0')}:${String(newDate.getMinutes()).padStart(2, '0')}`;

        const result = await window.supabaseClient
            .from(REMINDERS_TABLE)
            .update({
                reminder_date: date,
                reminder_time: time,
                notified_at: null
            })
            .eq('id', id)
            .eq('user_id', currentUser.id);

        if (result.error) {
            console.error(result.error);
            Notify('No se pudo posponer el recordatorio.', 'error');
            return;
        }

        reminder.date = date;
        reminder.time = time;
        reminder.notified_at = null;

        // La nueva fecha/hora tendrá una clave de aviso diferente.
        this.closeAlert();
        UI.refreshCurrentTab();
        Notify(`Recordatorio pospuesto ${minutes} minutos.`, 'info');
    },

    async completeAlert() {
        const id = State.activeReminderId;
        if (id === null) return;

        await this.update(
            id,
            { completed: true },
            'Recordatorio marcado como realizado'
        );

        const reminder = State.reminders.find(
            r => String(r.id) === String(id)
        );

        if (reminder?.completed) {
            this.closeAlert();
        }
    },

    checkDue() {
        if (!currentUser) return;

        const now = new Date();
        const currentDate = this.dateKey(now);
        const currentTime =
            `${String(now.getHours()).padStart(2, '0')}:` +
            `${String(now.getMinutes()).padStart(2, '0')}`;

        for (const r of State.reminders) {
            const reminderTime = (r.time || '09:00').slice(0, 5);

            if (
                r.completed ||
                r.date !== currentDate ||
                reminderTime > currentTime
            ) {
                continue;
            }

            const key =
                `${currentUser.id}:${r.id}:${r.date}:${reminderTime}`;

            if (State.reminderNotified.has(key)) continue;

            State.reminderNotified.add(key);
            State.reminderQueue.push({ id: r.id });
        }

        this.showNextAlert();
    },
};

/* HERRAMIENTAS */
const Tools = {
    render() {
        const container = document.getElementById('mainContentList');
        container.innerHTML = '';
        const filtered = State.tools.filter(t => String(t.name || '').toLowerCase().includes(State.searchTerm) || String(t.category || '').toLowerCase().includes(State.searchTerm));
        
        if(filtered.length === 0) {
            container.innerHTML = `<div class="text-center py-20 text-slate-500">No se encontraron herramientas.</div>`;
        }

        const groups = filtered.reduce((acc, t) => {
            const cat = t.category || 'General';
            acc[cat] = acc[cat] || [];
            acc[cat].push(t);
            return acc;
        }, {});

        Object.entries(groups).forEach(([cat, list]) => {
            const section = document.createElement('div');
            section.innerHTML = `
                <h3 class="text-indigo-400 font-black uppercase mb-4 border-b border-white/5 pb-2 text-sm tracking-widest">${escapeHTML(cat)}</h3>
                <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                    ${list.map(t => `
                        <div class="group relative bg-white/5 p-4 rounded-2xl border border-white/5 hover:bg-blue-600/10 transition-all text-center">
                            <div class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex gap-1">
                                <button data-action="tool-edit" data-id="${escapeHTML(t.id)}" class="text-[10px] bg-black p-1 rounded">✏️</button>
                                <button data-action="tool-remove" data-id="${escapeHTML(t.id)}" class="text-[10px] bg-black p-1 rounded">✖</button>
                            </div>
                            ${safeURL(t.url) ? `<a href="${escapeHTML(safeURL(t.url))}" rel="noopener noreferrer" target="_blank">` : '<div>'}
                                <div class="text-3xl mb-2">${escapeHTML(t.icon || '🚀')}</div>
                                <div class="text-xs font-bold truncate text-white">${escapeHTML(t.name)}</div>
                            ${safeURL(t.url) ? '</a>' : '</div>'}
                            <button data-action="copy-tool-url" data-id="${escapeHTML(t.id)}" class="text-[10px] text-white/20 hover:text-white mt-1">Copiar URL</button>
                        </div>
                    `).join('')}
                </div>`;
            container.appendChild(section);
        });
    },
    save() {
        const name = document.getElementById('tName').value.trim();
        if (!name) return;
        const data = { id: State.editingId || Date.now(), name, url: document.getElementById('tUrl').value, category: document.getElementById('tCategory').value || 'General', icon: document.getElementById('tIcon').value || '🚀' };
        if (State.editingId) State.tools = State.tools.map(t => t.id === State.editingId ? data : t);
        else State.tools.push(data);
        Storage.saveAll(); UI.clearInputs(); UI.hideForms(); this.render();
        Notify('Herramienta guardada');
    },
    edit(id) {
        const t = State.tools.find(x => x.id === id);
        if(!t) return;
        State.editingId = id;
        document.getElementById('formTools').classList.remove('hidden');
        document.getElementById('tName').value = t.name || '';
        document.getElementById('tUrl').value = t.url || '';
        document.getElementById('tCategory').value = t.category || '';
        document.getElementById('tIcon').value = t.icon || '';
    },
    remove(id) { if (confirm('¿Eliminar?')) { State.tools = State.tools.filter(t => t.id !== id); Storage.removeItem('tools', id); Storage.saveAll(); this.render(); Notify('Herramienta eliminada', 'error'); } }
};

const Auth = {
    mode: 'login',
    setMode(mode) {
        this.mode = mode;
        const registering = mode === 'register';
        const recovering = mode === 'recovery';
        const modeToggle = document.getElementById('authModeToggle');
        modeToggle.classList.toggle('hidden', recovering);
        modeToggle.textContent = registering ? 'Ya tengo una cuenta · Ingresar' : 'Crear cuenta';
        document.getElementById('authSubmit').textContent = recovering ? 'Guardar contraseña nueva' : (registering ? 'Crear cuenta' : 'Ingresar');
        document.getElementById('authHelp').textContent = recovering ? 'Elegí una contraseña nueva de al menos 8 caracteres.' : (registering ? 'Usá un correo válido y una contraseña de al menos 8 caracteres.' : 'Ingresá con tu cuenta.');
        document.getElementById('authReset').classList.toggle('hidden', registering || recovering);
        document.getElementById('legalAcceptance').classList.toggle('hidden', !registering);
        document.getElementById('acceptTerms').required = registering;
        document.getElementById('acceptPrivacy').required = registering;
        if (!registering) { document.getElementById('acceptTerms').checked = false; document.getElementById('acceptPrivacy').checked = false; }
        document.getElementById('authPassword').autocomplete = registering || recovering ? 'new-password' : 'current-password';
        document.getElementById('authPassword').placeholder = recovering ? 'Nueva contraseña' : 'Mínimo 8 caracteres';
        document.getElementById('authMessage').textContent = '';
    },
    message(text) { document.getElementById('authMessage').textContent = text; },
    async submit(event) {
        event.preventDefault();
        const email = document.getElementById('authEmail').value.trim();
        const password = document.getElementById('authPassword').value;
        const button = document.getElementById('authSubmit');
        button.disabled = true; button.textContent = 'Procesando…'; this.message('');
        try {
            if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
            if (this.mode === 'register' && (!document.getElementById('acceptTerms').checked || !document.getElementById('acceptPrivacy').checked)) {
                throw new Error('Para crear la cuenta, tenés que aceptar los términos y la política de privacidad.');
            }
            if (this.mode === 'recovery') {
                const { error } = await window.supabaseClient.auth.updateUser({ password });
                if (error) throw error;
                this.message('Contraseña actualizada. Ya podés ingresar con ella.');
                await window.supabaseClient.auth.signOut();
                this.setMode('login');
                this.message('Contraseña actualizada. Iniciá sesión con tu nueva contraseña.');
                return;
            }
            const result = this.mode === 'register'
                ? await window.supabaseClient.auth.signUp({ email, password, options: { data: {
                    terms_accepted: true,
                    terms_accepted_at: new Date().toISOString(),
                    terms_version: '1.0',
                    privacy_accepted: true,
                    privacy_accepted_at: new Date().toISOString(),
                    privacy_version: '1.0',
                    nickname: ''
                } } })
                : await window.supabaseClient.auth.signInWithPassword({ email, password });
            if (result.error) throw result.error;
            if (this.mode === 'register' && !result.data.session) {
                this.message('Cuenta creada. Revisá tu correo para confirmar la dirección y luego iniciá sesión.');
            } else if (result.data.session) {
                await App.enter(result.data.session.user);
            }
        } catch (error) { this.message(error.message || 'No se pudo completar la operación.'); }
        finally { button.disabled = false; button.textContent = this.mode === 'recovery' ? 'Guardar contraseña nueva' : (this.mode === 'register' ? 'Crear cuenta' : 'Ingresar'); }
    },
    async resetPassword() {
        const email = document.getElementById('authEmail').value.trim();
        if (!email) return this.message('Ingresá tu correo electrónico primero.');
        try {
            const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}${location.pathname}` });
            if (error) throw error;
            this.message('Si el correo está registrado, recibirás un enlace para restablecer la contraseña.');
        } catch (error) { this.message(error.message || 'No se pudo enviar el correo.'); }
    },
    async signOut() { await window.supabaseClient.auth.signOut(); location.reload(); }
};

const Profile = {
    message(text, isError = false) {
        const node = document.getElementById('profileMessage');
        node.textContent = text;
        node.classList.toggle('text-red-300', isError);
        node.classList.toggle('text-amber-300', !isError);
    },
    async saveNickname(event) {
        event.preventDefault();
        const nickname = document.getElementById('profileNickname').value.trim();
        if (nickname.length > 40) return this.message('El apodo no puede superar los 40 caracteres.', true);
        try {
            const { data, error } = await window.supabaseClient.auth.updateUser({ data: { nickname } });
            if (error) throw error;
            currentUser = data.user || currentUser;
            document.getElementById('currentUser').textContent = nickname || currentUser.email || 'Sesión activa';
            this.message('Apodo actualizado correctamente.');
        } catch (error) { this.message(error.message || 'No se pudo guardar el apodo.', true); }
    },
    async changePassword(event) {
        event.preventDefault();
        const password = document.getElementById('profileNewPassword').value;
        const confirmation = document.getElementById('profileConfirmPassword').value;
        if (password.length < 8) return this.message('La contraseña debe tener al menos 8 caracteres.', true);
        if (password !== confirmation) return this.message('Las contraseñas no coinciden.', true);
        try {
            const { error } = await window.supabaseClient.auth.updateUser({ password });
            if (error) throw error;
            document.getElementById('passwordForm').reset();
            this.message('Contraseña actualizada correctamente.');
        } catch (error) { this.message(error.message || 'No se pudo cambiar la contraseña.', true); }
    },
    downloadBackup() {
        const backup = {
            app: 'Dashboard de Trabajo',
            version: APP_VERSION,
            exportedAt: new Date().toISOString(),
            account: { email: currentUser?.email || '', nickname: currentUser?.user_metadata?.nickname || '' },
            jobs: State.jobs,
            projects: State.projects,
            tools: State.tools,
            reminders: State.reminders
        };
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `dashboard-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        Notify('Backup JSON descargado.');
    }
};

const Legal = {
    documents: {
        terms: {
            title: 'Términos y condiciones',
            html: `<p><strong>Última actualización:</strong> Octubre de 2026.</p>
                <p>Al crear una cuenta y utilizar Dashboard de Trabajo, aceptás estos términos. Si no estás de acuerdo, no crees una cuenta ni utilices la plataforma.</p>
                <h3 class="font-bold text-white">1. Servicio</h3><p>Dashboard de Trabajo es una herramienta de organización para registrar y administrar trabajos, proyectos y herramientas. El servicio se ofrece actualmente sin cargo y puede modificarse, interrumpirse o discontinuarse.</p>
                <h3 class="font-bold text-white">2. Cuenta y seguridad</h3><p>Debés proporcionar una dirección de correo válida, mantener la confidencialidad de tus credenciales y utilizar la plataforma de forma lícita. Sos responsable de la actividad realizada desde tu cuenta.</p>
                <h3 class="font-bold text-white">3. Información del usuario</h3><p>Los datos que ingreses son responsabilidad tuya. No guardes contraseñas de terceros, datos sensibles ni información que no tengas autorización para almacenar. El botón Backup permite descargar una copia JSON de los registros de tu cuenta; guardala en un lugar seguro.</p>
                <h3 class="font-bold text-white">4. Uso aceptable</h3><p>No intentes acceder a datos de otras cuentas, interferir con la seguridad, abusar del servicio ni utilizarlo para actividades ilegales.</p>
                <h3 class="font-bold text-white">5. Disponibilidad y responsabilidad</h3><p>La plataforma se ofrece “tal cual”, sin garantía de disponibilidad ininterrumpida ni de conservación permanente de los datos. En esta etapa gratuita pueden ocurrir cambios, interrupciones o pérdida de información. Mantené copias de seguridad de los datos importantes.</p>
                <h3 class="font-bold text-white">6. Cambios y contacto</h3><p>Estos términos pueden actualizarse cuando cambie el servicio. La versión vigente se mostrará en esta ventana. Para consultas, utilizá los canales de contacto publicados por la responsable del proyecto.</p>`
        },
        privacy: {
            title: 'Política de privacidad',
            html: `<p><strong>Última actualización:</strong> Octubre de 2026.</p>
                <p>Esta política explica cómo se trata la información cuando utilizás Dashboard de Trabajo.</p>
                <h3 class="font-bold text-white">1. Datos que se procesan</h3><p>Se procesa tu correo electrónico para gestionar la cuenta y la autenticación; el apodo que elijas; y los trabajos, proyectos y herramientas que guardes. Si aceptás los documentos al registrarte, se guardan en los metadatos de la cuenta la fecha y la versión aceptada.</p>
                <h3 class="font-bold text-white">2. Finalidad</h3><p>Los datos se utilizan para prestar las funciones de la aplicación, sincronizar tu información y administrar el acceso a tu cuenta. No ingreses información sensible o de terceros sin autorización.</p>
                <h3 class="font-bold text-white">3. Almacenamiento y proveedores</h3><p>La aplicación está alojada en Render y utiliza Supabase para autenticación y almacenamiento de datos. Estos proveedores procesan información técnica necesaria para prestar sus servicios conforme a sus propias condiciones y políticas.</p>
                <h3 class="font-bold text-white">4. Acceso y seguridad</h3><p>Las políticas de seguridad de la base de datos restringen los registros de trabajos, proyectos y herramientas a la cuenta propietaria. Ningún sistema puede garantizar seguridad absoluta; protegé tu contraseña y tus archivos de backup.</p>
                <h3 class="font-bold text-white">5. Conservación y eliminación</h3><p>Los datos se conservan mientras la cuenta y los registros permanezcan activos. Para consultar o solicitar la eliminación de una cuenta o datos, contactá a la responsable del proyecto. La eliminación puede estar sujeta a las funciones disponibles y a obligaciones legales aplicables.</p>
                <h3 class="font-bold text-white">6. Cambios</h3><p>Esta política puede actualizarse para reflejar cambios en la aplicación. La versión y fecha vigentes se mostrarán aquí.</p>`
        }
    },
    open(kind) {
        const doc = this.documents[kind];
        if (!doc) return;
        document.getElementById('legalTitle').textContent = doc.title;
        const content = document.getElementById('legalContent');
        content.replaceChildren();
        const template = document.createElement('template');
        template.innerHTML = doc.html;
        content.appendChild(template.content.cloneNode(true));
        document.getElementById('legalModal').classList.remove('hidden');
    }
};

const App = {
    async enter(user) {
        currentUser = user;
        try {
            await Storage.loadAll();
            document.getElementById('authGate').classList.add('hidden');
            ['appHeader', 'appMain', 'appFooter', 'userBar'].forEach(id => document.getElementById(id).classList.remove('hidden'));
            const nickname = String(user.user_metadata?.nickname || '').trim();
            document.getElementById('currentUser').textContent = nickname || user.email || 'Sesión activa';
            document.getElementById('profileEmail').textContent = user.email || '';
            document.getElementById('profileNickname').value = nickname;
            UI.init();
        } catch (error) {
            console.error(error);
            currentUser = null;
            Auth.message('No se pudieron cargar tus datos. Contactá al desarrollador.');
        }
    },
    async start() {
        // Delegación de eventos: también cubre tarjetas y tareas que se crean dinámicamente.
        document.addEventListener('click', async event => {
            const control = event.target.closest('[data-action]');
            if (!control) return;
            const id = /^\d+$/.test(control.dataset.id || '') ? Number(control.dataset.id) : control.dataset.id;
            const index = Number(control.dataset.index);
            switch (control.dataset.action) {
                case 'show-home': UI.showHome(); break;
                case 'show-jobs': UI.showJobs(); break;
                case 'show-projects': UI.showProjects(); break;
                case 'show-tools': UI.showTools(); break;
                case 'show-calendar': UI.showCalendar(); break;
                case 'calendar-prev': State.calendarDate = new Date(State.calendarDate.getFullYear(), State.calendarDate.getMonth()-1, 1); Calendar.render(); break;
                case 'calendar-next': State.calendarDate = new Date(State.calendarDate.getFullYear(), State.calendarDate.getMonth()+1, 1); Calendar.render(); break;
                case 'calendar-today': State.calendarDate = new Date(); Calendar.render(); break;
                case 'reminder-new': Calendar.openForm(); break;
                case 'reminder-edit': Calendar.openForm(State.reminders.find(r => String(r.id) === String(control.dataset.id))); break;
                case 'reminder-delete': await Calendar.remove(control.dataset.id); break;
                case 'reminder-done': await Calendar.update(control.dataset.id, { completed: true }, 'Recordatorio marcado como realizado'); break;
                case 'reminder-alert-edit': {
                const reminder = State.reminders.find(
                        r => String(r.id) === String(State.activeReminderId)
                    );

                    if (reminder) {
                        // Ocultar el aviso y abrir el formulario de edición.
                        document.getElementById('reminderAlertModal').classList.add('hidden');
                        State.activeReminderId = null;
                        Calendar.openForm(reminder);
                    }
                    break;
                }

                case 'reminder-alert-snooze':
                    await Calendar.snooze(Number(control.dataset.minutes));
                    break;

                case 'reminder-alert-close':
                    Calendar.closeAlert();
                    break;

                case 'reminder-alert-done':
                    await Calendar.completeAlert();
                    break;
                case 'open-kanban': Kanban.open(control.dataset.type, id); break;
                case 'kanban-back': Kanban.back(); break;
                case 'kanban-add': Kanban.openForm(); break;
                case 'kanban-edit': Kanban.edit(control.dataset.taskId); break;
                case 'kanban-delete': Kanban.remove(control.dataset.taskId); break;
                case 'new-item': UI.showFormByTab(); break;
                case 'hide-forms': UI.hideForms(); break;
                case 'save-job': Jobs.save(); break;
                case 'save-project': Projects.save(); break;
                case 'save-tool': Tools.save(); break;
                case 'filter': UI.setFilter(control.dataset.status); break;
                case 'sign-out': await Auth.signOut(); break;
                case 'open-profile': document.getElementById('profileMessage').textContent = ''; document.getElementById('profileModal').classList.remove('hidden'); break;
                case 'close-modal': document.getElementById(control.dataset.modal)?.classList.add('hidden'); break;
                case 'open-legal': Legal.open(control.dataset.legal); break;
                case 'backup-json': Profile.downloadBackup(); break;
                case 'job-edit': Jobs.edit(id); break;
                case 'job-remove': Jobs.remove(id); break;
                case 'job-add-todo': Jobs.addTodo(id); break;
                case 'job-remove-todo': Jobs.removeTodo(id, index); break;
                case 'job-copy-link': CopyText(State.jobs.find(item => item.id === id)?.link); break;
                case 'job-copy-notes': CopyText(State.jobs.find(item => item.id === id)?.notes); break;
                case 'project-edit': Projects.edit(id); break;
                case 'project-remove': Projects.remove(id); break;
                case 'project-add-todo': Projects.addTodo(id); break;
                case 'project-remove-todo': Projects.removeTodo(id, index); break;
                case 'project-copy-notes': CopyText(State.projects.find(item => item.id === id)?.notes); break;
                case 'copy-url': CopyText(control.dataset.url); break;
                case 'tool-edit': Tools.edit(id); break;
                case 'tool-remove': Tools.remove(id); break;
                case 'copy-tool-url': CopyText(State.tools.find(item => item.id === id)?.url); break;
            }
        });
        document.addEventListener('change', event => {
            const control = event.target.closest('[data-action="job-toggle-todo"], [data-action="project-toggle-todo"]');
            if (!control) return;
            const id = /^\d+$/.test(control.dataset.id || '') ? Number(control.dataset.id) : control.dataset.id;
            const index = Number(control.dataset.index);
            if (control.dataset.action === 'job-toggle-todo') Jobs.toggleTodo(id, index);
            else Projects.toggleTodo(id, index);
        });
        document.addEventListener('click', event => {
            if (['profileModal', 'legalModal', 'kanbanTaskModal'].includes(event.target.id)) event.target.classList.add('hidden');
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                if (State.activeReminderId !== null) return;
                document.getElementById('reminderModal').classList.add('hidden');
                document.getElementById('profileModal').classList.add('hidden');
                document.getElementById('legalModal').classList.add('hidden');
                document.getElementById('kanbanTaskModal').classList.add('hidden');
            }
            if (event.key !== 'Enter') return;
            const control = event.target.closest('[data-enter-action]');
            if (!control) return;
            event.preventDefault();
            const id = /^\d+$/.test(control.dataset.id || '') ? Number(control.dataset.id) : control.dataset.id;
            if (control.dataset.enterAction === 'job-add-todo') Jobs.addTodo(id);
            if (control.dataset.enterAction === 'project-add-todo') Projects.addTodo(id);
        });
        document.querySelectorAll('[data-action="set-theme"]').forEach(control => control.addEventListener('change', () => setTheme(control.value)));
        if (!window.supabase || !window.DASHBOARD_CONFIG || !DASHBOARD_CONFIG.SUPABASE_URL || !DASHBOARD_CONFIG.SUPABASE_ANON_KEY || DASHBOARD_CONFIG.SUPABASE_URL.includes('TU_PROYECTO')) {
            Auth.message('Falta configurar Supabase.');
            document.getElementById('authSubmit').disabled = true;
            return;
        }
        window.supabaseClient = window.supabase.createClient(DASHBOARD_CONFIG.SUPABASE_URL, DASHBOARD_CONFIG.SUPABASE_ANON_KEY);
        document.getElementById('authForm').addEventListener('submit', event => Auth.submit(event));
        document.getElementById('authModeToggle').addEventListener('click', () => Auth.setMode(Auth.mode === 'register' ? 'login' : 'register'));
        document.getElementById('authReset').addEventListener('click', () => Auth.resetPassword());
        document.getElementById('nicknameForm').addEventListener('submit', event => Profile.saveNickname(event));
        document.getElementById('passwordForm').addEventListener('submit', event => Profile.changePassword(event));
        document.getElementById('kanbanTaskForm').addEventListener('submit', event => Kanban.save(event));
        document.getElementById('reminderForm').addEventListener('submit', event => Calendar.save(event));
        document.getElementById('reminderRelation').addEventListener('change', () => Calendar.relationChanged());
        setInterval(() => Calendar.checkDue(), 30000);
        document.addEventListener('change', event => { const control = event.target.closest('[data-action="kanban-move"]'); if (control) Kanban.move(control.dataset.taskId, control.value); });
        const { data: { session }, error } = await window.supabaseClient.auth.getSession();
        if (error) Auth.message('No se pudo completar. Volvé a intentar.');
        if (session) await this.enter(session.user);
        window.supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                ['appHeader', 'appMain', 'appFooter', 'userBar'].forEach(id => document.getElementById(id).classList.add('hidden'));
                document.getElementById('authGate').classList.remove('hidden');
                Auth.setMode('recovery');
                Auth.message('Ingresaste desde el enlace de recuperación.');
            }
            if (event === 'SIGNED_OUT' && currentUser) location.reload();
        });
    }
};
window.Auth = Auth;
window.addEventListener('DOMContentLoaded', () => App.start());