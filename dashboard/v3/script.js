/* ESTADO Y PERSISTENCIA EN SUPABASE */
const State = { jobs: [], projects: [], tools: [], activeTab: 'jobs', editingId: null, searchTerm: '', statusFilter: 'Todos' };
let currentUser = null;
let saveQueue = Promise.resolve();

const TABLES = { jobs: 'dashboard_jobs', projects: 'dashboard_projects', tools: 'dashboard_tools' };
const Storage = {
    async loadAll() {
        if (!currentUser) throw new Error('No hay una sesión activa.');
        const results = await Promise.all(Object.entries(TABLES).map(async ([key, table]) => {
            const { data, error } = await window.supabaseClient.from(table).select('id,data').eq('user_id', currentUser.id);
            if (error) throw error;
            State[key] = (data || []).map(row => ({ ...row.data, id: /^\d+$/.test(row.id) ? Number(row.id) : row.id }));
        }));
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
        }).catch(error => { console.error('Error guardando en Supabase:', error); Notify('No se pudieron guardar los cambios en la nube. Revisá la conexión.', 'error'); });
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
const APP_VERSION = "v3.0.0";
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
    toast.innerHTML = `<span>${type === 'success' ? '✅' : 'ℹ️'}</span> ${msg}`;
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
        document.querySelectorAll('input, textarea, select').forEach(el => {
            if (el.id !== 'globalSearch') el.value = '';
        });
    },
    setFilter(status) {
        State.statusFilter = status;
        document.querySelectorAll('.f-btn').forEach(btn => {
            btn.classList.remove('bg-indigo-600');
            btn.classList.add('bg-white/5');
            if (btn.innerText === status) {
                btn.classList.replace('bg-white/5', 'bg-indigo-600');
            }
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
            card.className += " active:scale-95 transition";
            card.innerHTML = `
                <div class="absolute top-0 right-0 bg-indigo-600 text-white text-[9px] font-black px-4 py-1.5 rounded-bl-xl uppercase tracking-widest">PERFIL TRABAJO</div>
                <div class="flex justify-between items-start mb-6">
                    <div>
                        <h3 class="text-3xl font-black text-white">${j.name}</h3>
                        <p class="text-indigo-400 font-bold text-xs uppercase">${j.role || ''} • ${j.contract || ''}</p>
                    </div>
                    <div class="flex gap-3">
                        <button onclick="Jobs.edit(${j.id})" class="text-indigo-400 hover:scale-125 transition">✏️</button>
                        <button onclick="Jobs.remove(${j.id})" class="text-red-400 hover:scale-125 transition">✖</button>
                    </div>
                </div>
                <div class="grid md:grid-cols-2 gap-8">
                    <div>
                        <div class="flex items-center gap-2">
                             ${j.link ? `<a href="${j.link}" target="_blank" class="bg-indigo-500/20 px-4 py-2 rounded-xl text-white text-sm border border-indigo-500/30">🔗 ${j.linkName || 'Acceso'}</a>` : ''}
                             ${j.link ? `<button onclick="CopyText('${j.link}')" class="text-xs text-white/40 hover:text-white">📋</button>` : ''}
                        </div>
                        <div class="relative mt-4 p-4 bg-black/20 rounded-xl text-sm italic text-slate-400 border border-white/5 whitespace-pre-line group">
                            ${j.notes || 'Sin notas.'}
                            <button onclick="CopyText('${j.notes}')" class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition text-[10px] bg-indigo-500 text-white px-2 py-1 rounded">COPIAR</button>
                        </div>
                    </div>
                    <div class="bg-white/5 p-4 rounded-xl border border-white/5">
                        <div id="todos-job-${j.id}" class="space-y-1 mb-3"></div>
                        <div class="flex gap-2">
                            <input id="input-job-${j.id}" class="bg-black/20 p-2 rounded text-xs flex-1 text-white border border-white/10 focus:outline-none" placeholder="Nueva tarea..." onkeypress="if(event.key==='Enter') Jobs.addTodo(${j.id})">
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
        if(!c) return;
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
        
        const data = { 
            id: State.editingId || Date.now(), 
            name, 
            role: document.getElementById('jRole').value, 
            contract: document.getElementById('jContract').value, 
            linkName: document.getElementById('jLinkName').value, 
            link: document.getElementById('jUrl').value, 
            notes: document.getElementById('jNotes').value, 
            todos: State.editingId ? (State.jobs.find(j => j.id === State.editingId)?.todos || []) : [] 
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

        let filtered = State.projects.filter(p => p.name.toLowerCase().includes(State.searchTerm));
        if (State.statusFilter !== 'Todos') {
            filtered = filtered.filter(p => p.status === State.statusFilter);
        }

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
                        <h3 class="text-2xl font-bold text-white">${p.name}</h3>
                        <div class="flex flex-wrap gap-2 text-[10px] uppercase font-bold mt-1 text-indigo-300">
                            <span class="bg-indigo-500/20 px-2 py-0.5 rounded">${p.status || 'Estado'}</span>
                            <span>${p.client || 'Sin Cliente'}</span>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="Projects.edit(${p.id})" class="hover:scale-125 transition">✏️</button>
                        <button onclick="Projects.remove(${p.id})" class="text-red-400 hover:scale-125 transition">✖</button>
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
                            ${p.notes || 'Sin notas.'}
                            <button onclick="CopyText('${p.notes}')" class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-white/10 p-1 rounded">📋</button>
                        </div>
                    </div>

                    <div class="bg-indigo-900/10 p-4 rounded-xl border border-indigo-500/10">
                        <div id="todos-proj-${p.id}" class="space-y-1 mb-3"></div>
                        <div class="flex gap-2">
                            <input id="input-proj-${p.id}" class="bg-black/40 p-2 rounded text-xs flex-1 text-white border border-white/10 focus:outline-none" placeholder="Nueva tarea..." onkeypress="if(event.key==='Enter') Projects.addTodo(${p.id})">
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
            <a href="${url}" target="_blank" class="text-xs text-white/70 hover:text-white">${emoji} ${label}</a>
            <button onclick="CopyText('${url}')" class="text-[10px] text-white/30 hover:text-white">📋</button>
        </div>`;
    },
    renderTodos(proj) {
        const c = document.getElementById(`todos-proj-${proj.id}`);
        if(!c) return;
        c.innerHTML = (proj.todos || []).map((t, i) => `
            <div class="flex justify-between items-center group/item text-xs text-white/70">
                <div class="flex gap-2 items-center">
                    <input type="checkbox" ${t.done ? 'checked' : ''} onchange="Projects.toggleTodo(${proj.id}, ${i})">
                    <span class="${t.done ? 'line-through opacity-40' : ''}">${t.text}</span>
                </div>
                <button onclick="Projects.removeTodo(${proj.id}, ${i})" class="opacity-0 group-hover/item:opacity-100 text-red-500 transition">✖</button>
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
            client: document.getElementById('pClient').value, 
            link: document.getElementById('pLink').value, 
            qa: document.getElementById('pQaLink').value, 
            docs: document.getElementById('pDocs').value, 
            videos: document.getElementById('pVideos').value, 
            secure: document.getElementById('pSecure').value, 
            notes: document.getElementById('pNotes').value, 
            todos: State.editingId ? (State.projects.find(p => p.id === State.editingId)?.todos || []) : [] 
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
        document.getElementById('pStatus').value = p.status || 'En diseño';
        document.getElementById('pVersion').value = p.version || '';
        document.getElementById('pDate').value = p.date || '';
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

/* HERRAMIENTAS */
const Tools = {
    render() {
        const container = document.getElementById('mainContentList');
        container.innerHTML = '';
        const filtered = State.tools.filter(t => t.name.toLowerCase().includes(State.searchTerm) || t.category.toLowerCase().includes(State.searchTerm));
        
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
                <h3 class="text-indigo-400 font-black uppercase mb-4 border-b border-white/5 pb-2 text-sm tracking-widest">${cat}</h3>
                <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                    ${list.map(t => `
                        <div class="group relative bg-white/5 p-4 rounded-2xl border border-white/5 hover:bg-blue-600/10 transition-all text-center">
                            <div class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex gap-1">
                                <button onclick="Tools.edit(${t.id})" class="text-[10px] bg-black p-1 rounded">✏️</button>
                                <button onclick="Tools.remove(${t.id})" class="text-[10px] bg-black p-1 rounded">✖</button>
                            </div>
                            <a href="${t.url}" target="_blank">
                                <div class="text-3xl mb-2">${t.icon || '🚀'}</div>
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

const Backup = {
    exportJSON() {
        const blob = new Blob([JSON.stringify({ version: APP_VERSION, exportedAt: new Date().toISOString(), jobs: State.jobs, projects: State.projects, tools: State.tools }, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `backup_${new Date().toLocaleDateString()}.json`;
        a.click();
        Notify('Backup exportado');
    },
};

const Auth = {
    mode: 'login',
    setMode(mode) {
        this.mode = mode;
        const registering = mode === 'register';
        const recovering = mode === 'recovery';
        document.getElementById('authTabLogin').classList.toggle('hidden', recovering);
        document.getElementById('authTabRegister').classList.toggle('hidden', recovering);
        document.getElementById('authTabLogin').className = `flex-1 rounded-xl px-3 py-2 font-bold text-white ${registering ? 'bg-white/10' : 'bg-indigo-600'}`;
        document.getElementById('authTabRegister').className = `flex-1 rounded-xl px-3 py-2 font-bold text-white ${registering ? 'bg-indigo-600' : 'bg-white/10'}`;
        document.getElementById('authSubmit').textContent = recovering ? 'Guardar contraseña nueva' : (registering ? 'Crear cuenta' : 'Ingresar');
        document.getElementById('authHelp').textContent = recovering ? 'Elegí una contraseña nueva de al menos 8 caracteres.' : (registering ? 'Usá un correo válido y una contraseña de al menos 8 caracteres.' : 'Ingresá con tu cuenta.');
        document.getElementById('authReset').classList.toggle('hidden', registering || recovering);
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
                ? await window.supabaseClient.auth.signUp({ email, password })
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

const App = {
    async enter(user) {
        currentUser = user;
        try {
            await Storage.loadAll();
            document.getElementById('authGate').classList.add('hidden');
            ['appHeader', 'appMain', 'appFooter', 'userBar'].forEach(id => document.getElementById(id).classList.remove('hidden'));
            document.getElementById('currentUser').textContent = user.email || 'Sesión activa';
            UI.init();
        } catch (error) {
            console.error(error);
            currentUser = null;
            Auth.message('No se pudieron cargar tus datos. Verificá la configuración de Supabase y las políticas SQL.');
        }
    },
    async start() {
        if (!window.supabase || !window.DASHBOARD_CONFIG || !DASHBOARD_CONFIG.SUPABASE_URL || !DASHBOARD_CONFIG.SUPABASE_ANON_KEY || DASHBOARD_CONFIG.SUPABASE_URL.includes('TU_PROYECTO')) {
            Auth.message('Falta configurar Supabase. Seguí las instrucciones de CONFIGURACION.md.');
            document.getElementById('authSubmit').disabled = true;
            return;
        }
        window.supabaseClient = window.supabase.createClient(DASHBOARD_CONFIG.SUPABASE_URL, DASHBOARD_CONFIG.SUPABASE_ANON_KEY);
        document.getElementById('authForm').addEventListener('submit', event => Auth.submit(event));
        const { data: { session }, error } = await window.supabaseClient.auth.getSession();
        if (error) Auth.message('No se pudo verificar la sesión. Volvé a ingresar.');
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