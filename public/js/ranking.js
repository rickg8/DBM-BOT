const rankingList = document.getElementById("rankingList");
const searchInput = document.getElementById("rankingSearch");
const highlightBtn = document.getElementById("highlightMe");

function notify(message, type = 'info') {
    if (window.toast) {
        if (type === 'error') return window.toast.error(message);
        if (type === 'success') return window.toast.success(message);
        return window.toast.info(message);
    }
    console.log(message);
}

// ===== AUTENTICAÇÃO =====
function getAuthToken() {
    return localStorage.getItem('auth_token');
}

function getAuthHeaders() {
    const token = getAuthToken();
    const headers = {
        'Content-Type': 'application/json'
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

function checkAuth() {
    const token = getAuthToken();
    if (!token) {
        window.location.href = '/login.html';
    }
}

function logout() {
    window.clearAuth();
    window.location.href = '/login.html';
}

// Função helper para fazer requisições autenticadas
function authFetch(url, options = {}) {
    const token = localStorage.getItem('auth_token');

    if (!token) {
        console.error('[AUTH] Token não encontrado, redirecionando...');
        window.location.href = '/login.html';
        return Promise.reject(new Error('Não autenticado'));
    }

    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };

    return fetch(url, { ...options, headers });
}

async function fetchPilotos() {
    const res = await authFetch("/api/v1/pilotos");
    if (!res.ok) throw new Error("Falha ao carregar pilotos");
    return res.json();
}

async function fetchProtocols() {
    const res = await authFetch("/api/v1/protocolos");
    if (!res.ok) throw new Error("Falha ao carregar protocolos");
    return res.json();
}

function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
}

function showSkeleton() {
    rankingList.innerHTML = '<li><div class="skeleton skeleton-line"></div></li><li><div class="skeleton skeleton-line"></div></li>';
}

function showErrorState(msg) {
    rankingList.innerHTML = `<li><div class="error-state"><strong>${msg}</strong><div class="empty-actions"><button class="pill" onclick="location.reload()">Recarregar</button></div></div></li>`;
}

function renderRanking(protocols, pilotColors, searchTerm = '', currentUser = null) {
    const finalized = protocols.filter(p => (p.status || 'FINALIZADO').toUpperCase() === 'FINALIZADO');
    rankingList.innerHTML = "";
    if (!finalized.length) {
        rankingList.innerHTML = '<li class="muted">Nenhum protocolo ainda.</li>';
        return;
    }

    const totals = finalized.reduce((acc, p) => {
        acc[p.piloto] = (acc[p.piloto] || 0) + p.duracao;
        return acc;
    }, {});

    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);

    const filtered = searchTerm
        ? sorted.filter(([name]) => name.toLowerCase().includes(searchTerm.toLowerCase()))
        : sorted;

    filtered.forEach(([name, seconds]) => {
        const color = pilotColors[name] || "#4b5563";
        const li = document.createElement("li");
        const isMe = currentUser && currentUser.username && name.toLowerCase() === currentUser.username.toLowerCase();
        li.innerHTML = `<span class="pilot-badge" style="background:${color}">${name}</span> — ${formatDuration(seconds)}`;
        if (isMe) li.classList.add('highlight');
        rankingList.appendChild(li);
    });

    if (!filtered.length) {
        rankingList.innerHTML = '<li class="muted">Nenhum piloto encontrado.</li>';
    }
}

async function init() {
    // Verificar autenticação
    checkAuth();

    if (window.uiHelpers) {
        window.uiHelpers.renderSessionChip('sessionStatus');
        const logoutBtn = document.getElementById('logoutBtn');
        logoutBtn?.addEventListener('click', async () => {
            const ok = await window.uiHelpers.confirmLogout();
            if (ok) logout();
        });
    }

    showSkeleton();

    try {
        const [pilotos, protocols] = await Promise.all([fetchPilotos(), fetchProtocols()]);
        const pilotColors = pilotos.reduce((acc, { nome, cor }) => {
            acc[nome] = cor || "#6b7280";
            return acc;
        }, {});
        const session = window.uiHelpers ? window.uiHelpers.getSession() : null;
        renderRanking(protocols, pilotColors, "", session);

        searchInput?.addEventListener('input', (e) => {
            renderRanking(protocols, pilotColors, e.target.value, session);
        });

        highlightBtn?.addEventListener('click', () => {
            if (!session) return notify('Faça login para destacar seu usuário.', 'info');
            renderRanking(protocols, pilotColors, searchInput?.value || "", session);
            notify('Seu usuário foi destacado no ranking.', 'success');
        });
    } catch (err) {
        console.error(err);
        showErrorState("Não foi possível carregar o ranking.");
        notify("Não foi possível carregar o ranking.", 'error');
    }
}

init();
