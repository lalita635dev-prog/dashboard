/* ESTADO INICIAL */
const State = {
    jobs: JSON.parse(localStorage.getItem('jobs')) || [],
    projects: JSON.parse(localStorage.getItem('projects')) || [],
    tools: JSON.parse(localStorage.getItem('tools')) || [],
    activeTab: 'jobs',
    editingId: null,
    searchTerm: '',
    statusFilter: 'Todos' // Para la mejora 3
};

const Storage = {
    saveAll() {
        localStorage.setItem('jobs', JSON.stringify(State.jobs));
        localStorage.setItem('projects', JSON.stringify(State.projects));
        localStorage.setItem('tools', JSON.stringify(State.tools));
    }
};

/* MEJORA 5: SISTEMA DE TOASTS */
const Notify = (msg, type = 'success') => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const colors = {
        success: 'bg-green-600',
        info: 'bg-indigo-600',
        error: 'bg-red-600'
    };
    toast.className = `toast ${colors[type]} text-white px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm flex items-center gap-2`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : 'ℹ️'}</span> ${msg}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
};

/* MEJORA 4: COPIADO RÁPIDO */
const CopyText = (text) => {
    navigator.clipboard.writeText(text).then(() => {
        Notify('Copiado al portapapeles');
    });
};

const UI = {
    init() {
        this.showJobs();
        document.getElementById('globalSearch').oninput = (e) => {
            State.searchTerm = e.target.value.toLowerCase();
            this.refreshCurrentTab();
        };
    },
    resetTabs() {
        document.querySelectorAll('.tab').forEach(b => {
            b.classList.remove('bg-indigo-600', 'font-bold');
            b.classList.add('bg-white/10');
        });
        document.getElementById('filterBar').classList.add('hidden');
        this.hideForms();
    },
    hideForms() {
        document.getElementById('formJobs').classList.add('hidden');
        document.getElementById('formProjects').classList.add('hidden');
        document.getElementById('formTools').classList.add('hidden');
    },
    clearInputs() {
        State.editingId = null;
        document.querySelectorAll('input, textarea').forEach(el => {
            if (el.id !== 'globalSearch') el.value = '';
        });
    },
    setFilter(status) {
        State.statusFilter = status;
        document.querySelectorAll('.f-btn').forEach(btn => {
            btn.classList.replace('bg-indigo-600', 'bg-white/5');
            if (btn.innerText === status) btn.classList.replace('bg-white/5', 'bg-indigo-600');
        });
        Projects.render();
    },
    showFormByTab() {
        if (!State.editingId) this.clearInputs();
        if (State.activeTab === 'jobs') document.getElementById('formJobs').classList.toggle('hidden');
        if (State.activeTab === 'projects') document.getElementById('formProjects').classList.toggle('hidden');
        if (State.activeTab === 'tools') document.getElementById('formTools').classList.toggle('hidden');
    },
    showJobs() { this.resetTabs(); State.activeTab = 'jobs'; document.getElementById('tab-jobs').classList.add('bg-indigo-600', 'font-bold'); Jobs.render(); },
    showProjects() {
        this.resetTabs();
        State.activeTab = 'projects';
        document.getElementById('tab-projects').classList.add('bg-indigo-600', 'font-bold');
        document.getElementById('filterBar').classList.remove('hidden');
        Projects.render();
    },
    showTools() { this.resetTabs(); State.activeTab = 'tools'; document.getElementById('tab-tools').classList.add('bg-indigo-600', 'font-bold'); Tools.render(); },
    refreshCurrentTab() {
        if (State.activeTab === 'jobs') Jobs.render();
        if (State.activeTab === 'projects') Projects.render();
        if (State.activeTab === 'tools') Tools.render();
    }
};

/* TRABAJOS */
const Jobs = {
    render() {
        const c = document.getElementById('mainContentList');
        c.innerHTML = '';
        State.jobs.filter(j => j.name.toLowerCase().includes(State.searchTerm)).forEach(j => {
            const card = document.createElement('div');
            card.className = 'relative bg-slate-900/60 p-6 rounded-tr-[40px] border-l-4 border-indigo-500 shadow-xl mb-6';
            card.innerHTML = `
                <div class="absolute top-0 right-0 bg-indigo-600 text-white text-[9px] font-black px-4 py-1.5 rounded-bl-xl uppercase tracking-widest">PERFIL TRABAJO</div>
                <div class="flex justify-between items-start mb-6">
                    <div>
                        <h3 class="text-3xl font-black text-white">${j.name}</h3>
                        <p class="text-indigo-400 font-bold text-xs uppercase">${j.role || ''} • ${j.contract || ''}</p>
                    </div>
                    <div class="flex gap-3">
                        <button onclick="Jobs.edit(${j.id})" class="text-indigo-400">✏️</button>
                        <button onclick="Jobs.remove(${j.id})" class="text-red-400">✖</button>
                    </div>
                </div>
                <div class="grid md:grid-cols-2 gap-8">
                    <div>
                        <div class="flex items-center gap-2">
                             ${j.link ? `<a href="${j.link}" target="_blank" class="bg-indigo-500/20 px-4 py-2 rounded-xl text-white text-sm border border-indigo-500/30">🔗 ${j.linkName || 'Acceso'}</a>` : ''}
                             <button onclick="CopyText('${j.link}')" class="text-xs text-white/40 hover:text-white">📋</button>
                        </div>
                        <div class="relative mt-4 p-4 bg-black/20 rounded-xl text-sm italic text-slate-400 border border-white/5 whitespace-pre-line group">
                            ${j.notes || ''}
                            <button onclick="CopyText('${j.notes}')" class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition text-[10px] bg-indigo-500 text-white px-2 py-1 rounded">COPIAR NOTA</button>
                        </div>
                    </div>
                    <div class="bg-white/5 p-4 rounded-xl border border-white/5">
                        <div id="todos-job-${j.id}" class="space-y-1 mb-3"></div>
                        <div class="flex gap-2">
                            <input id="input-job-${j.id}" class="bg-black/20 p-2 rounded text-xs flex-1 text-white border border-white/10" placeholder="Nueva tarea..." onkeypress="if(event.key==='Enter') Jobs.addTodo(${j.id})">
                            <button onclick="Jobs.addTodo(${j.id})" class="bg-green-600 px-3 rounded text-white font-bold">+</button>
                        </div>
                    </div>
                </div>`;
            c.appendChild(card);
            this.renderTodos(j);
        });
    },
    renderTodos(job) {
        const c = document.getElementById(`todos-job-${job.id}`);
        c.innerHTML = (job.todos || []).map((t, i) => `
            <div class="flex justify-between items-center group/item text-sm text-white/70">
                <div class="flex gap-2 items-center">
                    <input type="checkbox" ${t.done ? 'checked' : ''} onchange="Jobs.toggleTodo(${job.id}, ${i})" class="accent-indigo-500">
                    <span class="${t.done ? 'line-through opacity-40' : ''}">${t.text}</span>
                </div>
                <button onclick="Jobs.removeTodo(${job.id}, ${i})" class="opacity-0 group-hover/item:opacity-100 text-red-400 text-[10px]">ELIMINAR</button>
            </div>`).join('');
    },
    save() {
        const name = document.getElementById('jName').value.trim();
        if (!name) return;
        const data = { id: State.editingId || Date.now(), name, role: document.getElementById('jRole').value, contract: document.getElementById('jContract').value, linkName: document.getElementById('jLinkName').value, link: document.getElementById('jUrl').value, notes: document.getElementById('jNotes').value, todos: State.editingId ? (State.jobs.find(j => j.id === State.editingId)?.todos || []) : [] };
        if (State.editingId) State.jobs = State.jobs.map(j => j.id === State.editingId ? data : j);
        else State.jobs.push(data);
        Storage.saveAll(); UI.clearInputs(); UI.hideForms(); this.render();
        Notify('Trabajo guardado');
    },
    edit(id) {
        const j = State.jobs.find(x => x.id === id);
        State.editingId = id;
        document.getElementById('formJobs').classList.remove('hidden');
        document.getElementById('jName').value = j.name;
        document.getElementById('jRole').value = j.role;
        document.getElementById('jNotes').value = j.notes;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    remove(id) { if (confirm('¿Eliminar trabajo?')) { State.jobs = State.jobs.filter(j => j.id !== id); Storage.saveAll(); this.render(); Notify('Trabajo eliminado', 'error'); } },
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

        let filtered = State.projects.filter(p => p.name.toLowerCase().includes(State.searchTerm));
        if (State.statusFilter !== 'Todos') {
            filtered = filtered.filter(p => p.status === State.statusFilter);
        }

        filtered.forEach(p => {
            const card = document.createElement('div');
            card.className = 'bg-white/5 p-6 rounded-3xl border border-white/10 mb-6 backdrop-blur-sm';
            card.innerHTML = `
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h3 class="text-2xl font-bold text-white">${p.name}</h3>
                        <div class="flex flex-wrap gap-2 text-[10px] uppercase font-bold mt-1 text-indigo-300">
                            <span class="bg-indigo-500/20 px-2 py-0.5 rounded">${p.status || 'Estado'}</span>
                            <span>${p.client || 'Sin Cliente'}</span>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="Projects.edit(${p.id})">✏️</button>
                        <button onclick="Projects.remove(${p.id})" class="text-red-400">✖</button>
                    </div>
                </div>
                
                <div class="grid md:grid-cols-2 gap-8">
                    <div>
                        <div class="flex flex-wrap gap-2 mb-4">
                            ${this.getLinkBtn(p.link, '🌐', 'Proyecto')}
                            ${this.getLinkBtn(p.qa, '🧪', 'QA')}
                            ${this.getLinkBtn(p.docs, '📄', 'Docs')}
                            ${this.getLinkBtn(p.videos, '🎬', 'Videos')}
                            ${this.getLinkBtn(p.secure, '🔐', 'Cifrados')}
                        </div>
                        <div class="relative group bg-black/30 p-4 rounded-xl text-sm text-slate-400 italic border border-white/5">
                            ${p.notes || 'Sin notas.'}
                            <button onclick="CopyText('${p.notes}')" class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-white/10 p-1 rounded">📋</button>
                        </div>
                    </div>

                    <div class="bg-indigo-900/10 p-4 rounded-xl border border-indigo-500/10">
                        <div id="todos-proj-${p.id}" class="space-y-1 mb-3"></div>
                        <div class="flex gap-2">
                            <input id="input-proj-${p.id}" class="bg-black/40 p-2 rounded text-xs flex-1 text-white border border-white/10" placeholder="Nueva tarea..." onkeypress="if(event.key==='Enter') Projects.addTodo(${p.id})">
                            <button onclick="Projects.addTodo(${p.id})" class="bg-indigo-600 px-3 rounded text-white font-bold">+</button>
                        </div>
                    </div>
                </div>
            `;
            c.appendChild(card);
            this.renderTodos(p);
        });
    },
    getLinkBtn(url, emoji, label) {
        if (!url) return '';
        return `
        <div class="flex items-center gap-1 bg-white/5 rounded-lg px-2 py-1 border border-white/5">
            <a href="${url}" target="_blank" class="text-xs text-white/70">${emoji} ${label}</a>
            <button onclick="CopyText('${url}')" class="text-[10px] hover:text-white">📋</button>
        </div>`;
    },
    renderTodos(proj) {
        const c = document.getElementById(`todos-proj-${proj.id}`);
        c.innerHTML = (proj.todos || []).map((t, i) => `
            <div class="flex justify-between items-center group/item text-xs text-white/70">
                <div class="flex gap-2 items-center">
                    <input type="checkbox" ${t.done ? 'checked' : ''} onchange="Projects.toggleTodo(${proj.id}, ${i})">
                    <span class="${t.done ? 'line-through opacity-40' : ''}">${t.text}</span>
                </div>
                <button onclick="Projects.removeTodo(${proj.id}, ${i})" class="opacity-0 group-hover/item:opacity-100 text-red-500">✖</button>
            </div>`).join('');
    },
    save() {
        const name = document.getElementById('pName').value.trim();
        if (!name) return;
        const data = { id: State.editingId || Date.now(), name, status: document.getElementById('pStatus').value, version: document.getElementById('pVersion').value, date: document.getElementById('pDate').value, client: document.getElementById('pClient').value, link: document.getElementById('pLink').value, qa: document.getElementById('pQaLink').value, docs: document.getElementById('pDocs').value, videos: document.getElementById('pVideos').value, secure: document.getElementById('pSecure').value, notes: document.getElementById('pNotes').value, todos: State.editingId ? (State.projects.find(p => p.id === State.editingId)?.todos || []) : [] };
        if (State.editingId) State.projects = State.projects.map(p => p.id === State.editingId ? data : p);
        else State.projects.push(data);
        Storage.saveAll(); UI.clearInputs(); UI.hideForms(); this.render();
        Notify('Proyecto guardado');
    },
    edit(id) {
        const p = State.projects.find(x => x.id === id);
        State.editingId = id;
        document.getElementById('formProjects').classList.remove('hidden');
        document.getElementById('pName').value = p.name;
        document.getElementById('pStatus').value = p.status;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    remove(id) { if (confirm('¿Eliminar proyecto?')) { State.projects = State.projects.filter(p => p.id !== id); Storage.saveAll(); this.render(); Notify('Proyecto eliminado', 'error'); } },
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

/* HERRAMIENTAS */
const Tools = {
    render() {
        const container = document.getElementById('mainContentList');
        container.innerHTML = '';
        const filtered = State.tools.filter(t => t.name.toLowerCase().includes(State.searchTerm) || t.category.toLowerCase().includes(State.searchTerm));
        const groups = filtered.reduce((acc, t) => {
            const cat = t.category || 'General';
            acc[cat] = acc[cat] || [];
            acc[cat].push(t);
            return acc;
        }, {});

        Object.entries(groups).forEach(([cat, list]) => {
            const section = document.createElement('div');
            section.innerHTML = `
                <h3 class="text-indigo-400 font-black uppercase mb-4 border-b border-white/5 pb-2 text-sm tracking-widest">${cat}</h3>
                <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                    ${list.map(t => `
                        <div class="group relative bg-white/5 p-4 rounded-2xl border border-white/5 hover:bg-blue-600/10 transition-all text-center">
                            <div class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex gap-1">
                                <button onclick="Tools.edit(${t.id})" class="text-[10px] bg-black p-1 rounded">✏️</button>
                                <button onclick="Tools.remove(${t.id})" class="text-[10px] bg-black p-1 rounded">✖</button>
                            </div>
                            <a href="${t.url}" target="_blank">
                                <div class="text-3xl mb-2">${t.icon || '🔗'}</div>
                                <div class="text-xs font-bold truncate text-white">${t.name}</div>
                            </a>
                            <button onclick="CopyText('${t.url}')" class="text-[10px] text-white/20 hover:text-white mt-1">Copiar URL</button>
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
        State.editingId = id;
        document.getElementById('formTools').classList.remove('hidden');
        document.getElementById('tName').value = t.name;
        document.getElementById('tUrl').value = t.url;
        document.getElementById('tCategory').value = t.category;
    },
    remove(id) { if (confirm('¿Eliminar?')) { State.tools = State.tools.filter(t => t.id !== id); Storage.saveAll(); this.render(); Notify('Herramienta eliminada', 'error'); } }
};

const Backup = {
    exportJSON() {
        const blob = new Blob([JSON.stringify(State, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `backup.json`;
        a.click();
        Notify('Backup exportado');
    },
    importJSON(file) {
        const r = new FileReader();
        r.onload = e => {
            const json = JSON.parse(e.target.result);
            State.jobs = json.jobs || [];
            State.projects = json.projects || [];
            State.tools = json.tools || [];
            Storage.saveAll();
            location.reload();
        };
        r.readAsText(file);
    }
};

UI.init();