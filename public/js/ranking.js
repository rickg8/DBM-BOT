const rankingList = document.getElementById("rankingList");
const searchInput = document.getElementById("rankingSearch");
const periodFilter = document.getElementById("periodFilter");
const sortFilter = document.getElementById("sortFilter");
const onlyMeToggle = document.getElementById("onlyMeToggle");
const refreshRanking = document.getElementById("refreshRanking");
const topThree = document.getElementById("topThree");
const lastUpdatedEl = document.getElementById("lastUpdated");
const liveLabel = document.getElementById("liveLabel");
const liveDot = document.getElementById("liveDot");
const syncedState = document.getElementById("syncedState");
const rankingName = document.getElementById("rankingName");
const heroPosition = document.getElementById("heroPosition");
const heroHours = document.getElementById("heroHours");
const heroGap = document.getElementById("heroGap");
const heroDelta = document.getElementById("heroDelta");
const detailName = document.getElementById("detailName");
const detailId = document.getElementById("detailId");
const detailHours = document.getElementById("detailHours");
const detailShare = document.getElementById("detailShare");
const detailPosition = document.getElementById("detailPosition");
const detailDelta = document.getElementById("detailDelta");
const detailAvatar = document.getElementById("detailAvatar");
const detailUpdated = document.getElementById("detailUpdated");

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

const state = {
    pilotos: [],
    pilotLookup: {},
    protocols: [],
    session: null,
    filters: {
        search: '',
        period: 'all',
        sort: 'hours-desc',
        onlyMe: false
    },
    ranking: [],
    lastUpdated: null,
    selectedPilot: null,
    autoScrolled: false
};

function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
}

function formatHoursLabel(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0h';
    const hours = seconds / 3600;
    if (hours >= 10) return `${hours.toFixed(1)} h`;
    return `${hours.toFixed(1)} h`;
}

function formatShortGap(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0';
    const hours = seconds / 3600;
    if (hours >= 1) return `${hours.toFixed(1)} h`;
    const minutes = Math.round(seconds / 60);
    return `${minutes} min`;
}

function formatTimeLabel(date = new Date()) {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (Number.isNaN(d?.getTime())) return '—';
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

function parseDateSafe(value) {
    const d = new Date(value);
    return Number.isNaN(d?.getTime()) ? null : d;
}

function isFinalized(protocol) {
    return (protocol.status || 'FINALIZADO').toUpperCase() === 'FINALIZADO';
}

function isWithinPeriod(protocol, period) {
    if (period === 'all') return true;
    const date = parseDateSafe(protocol.data);
    if (!date) return true;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const days = diffMs / (1000 * 60 * 60 * 24);
    if (period === '7d') return days <= 7;
    if (period === '30d') return days <= 30;
    if (period === '90d') return days <= 90;
    return true;
}

function buildPilotLookup(pilotos) {
    return pilotos.reduce((acc, pilot) => {
        if (!pilot?.nome) return acc;
        acc[pilot.nome.toLowerCase()] = pilot;
        return acc;
    }, {});
}

function aggregateRanking(protocols, lookup) {
    const totals = new Map();

    protocols.forEach((p) => {
        if (!isFinalized(p)) return;
        const name = p.piloto || 'Desconhecido';
        if (!totals.has(name)) {
            totals.set(name, {
                name,
                seconds: 0,
                lastDate: null
            });
        }
        const entry = totals.get(name);
        entry.seconds += Number(p.duracao) || 0;
        const date = parseDateSafe(p.data);
        if (date && (!entry.lastDate || date > entry.lastDate)) {
            entry.lastDate = date;
        }
    });

    return Array.from(totals.values()).map((entry) => {
        const meta = lookup[entry.name.toLowerCase()] || {};
        return {
            ...entry,
            color: meta.cor || '#4b5563',
            id: meta.id || meta.matricula || meta.discordId || '—',
            avatar: entry.name.slice(0, 2).toUpperCase()
        };
    });
}

function sortRanking(list, sort) {
    const cloned = [...list];
    if (sort === 'hours-asc') return cloned.sort((a, b) => a.seconds - b.seconds);
    if (sort === 'name-asc') return cloned.sort((a, b) => a.name.localeCompare(b.name));
    return cloned.sort((a, b) => b.seconds - a.seconds);
}

function applyFilters() {
    const { search, period, sort, onlyMe } = state.filters;
    const base = state.protocols.filter((p) => isWithinPeriod(p, period));
    let ranking = sortRanking(aggregateRanking(base, state.pilotLookup), sort);

    if (search) {
        const term = search.toLowerCase();
        ranking = ranking.filter((r) => r.name.toLowerCase().includes(term) || String(r.id || '').toLowerCase().includes(term));
    }

    if (onlyMe && state.session?.username) {
        const user = state.session.username.toLowerCase();
        ranking = ranking.filter((r) => r.name.toLowerCase() === user);
    }

    state.ranking = ranking;
    renderTopThree(ranking);
    renderRankingList(ranking);
    updateHero(ranking);
    autoSelectPilot();
}

function showSkeleton() {
    rankingList.innerHTML = '<li class="skeleton skeleton-line"></li><li class="skeleton skeleton-line"></li><li class="skeleton skeleton-line"></li>';
    topThree.innerHTML = '<div class="skeleton skeleton-line"></div>';
}

function showErrorState(msg) {
    rankingList.innerHTML = `<li><div class="error-state"><strong>${msg}</strong><div class="empty-actions"><button class="pill" onclick="location.reload()">Recarregar</button></div></div></li>`;
}

function updateStatusMeta() {
    if (state.lastUpdated) {
        lastUpdatedEl.textContent = formatTimeLabel(state.lastUpdated);
        liveLabel.textContent = 'Ao vivo';
        liveDot?.classList.add('live');
        if (syncedState) syncedState.textContent = 'Sincronizado com a API';
    } else {
        lastUpdatedEl.textContent = '—';
        liveLabel.textContent = 'Carregando';
        liveDot?.classList.remove('live');
        if (syncedState) syncedState.textContent = 'Aguardando dados';
    }
}

function renderTopThree(ranking) {
    if (!topThree) return;
    if (!ranking.length) {
        topThree.innerHTML = '<p class="muted">Nenhum piloto encontrado.</p>';
        return;
    }
    const leaderSeconds = ranking[0]?.seconds || 0;
    const medals = ['gold', 'silver', 'bronze'];
    topThree.innerHTML = '';

    ranking.slice(0, 3).forEach((pilot, index) => {
        const card = document.createElement('div');
        card.className = `top-card ${medals[index] || ''}`;
        const progress = leaderSeconds ? Math.round((pilot.seconds / leaderSeconds) * 100) : 0;
        card.innerHTML = `
          <div class="pilot-chip">
            <span class="medal" aria-hidden="true">${index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</span>
            <div class="avatar avatar-sm" style="background:${pilot.color}">${pilot.avatar}</div>
            <div>
              <div class="user-name">${pilot.name}</div>
              <div class="user-id">${pilot.id || '—'}</div>
            </div>
          </div>
          <div class="hours">${formatHoursLabel(pilot.seconds)}</div>
          <div class="progress-track" aria-hidden="true">
            <div class="progress-fill" style="width:${progress}%"></div>
          </div>
          <p class="progress-badge">${progress}% do líder</p>
        `;
        topThree.appendChild(card);
    });
}

function renderRankingList(ranking) {
    rankingList.innerHTML = '';
    if (!ranking.length) {
        rankingList.innerHTML = '<li class="muted">Nenhum piloto encontrado.</li>';
        return;
    }

    const leaderSeconds = ranking[0]?.seconds || 0;
    ranking.forEach((pilot, index) => {
        const progress = leaderSeconds ? Math.min(100, Math.round((pilot.seconds / leaderSeconds) * 100)) : 0;
        const isMe = state.session?.username && pilot.name.toLowerCase() === state.session.username.toLowerCase();
        const li = document.createElement('li');
        li.className = `ranking-row ${isMe ? 'is-me' : ''}`;
        li.dataset.pilot = pilot.name;
        li.innerHTML = `
          <div class="position">#${index + 1}</div>
          <div class="user-block">
            <div class="avatar avatar-sm" style="background:${pilot.color}">${pilot.avatar}</div>
            <div class="user-info">
              <div class="user-name">${pilot.name}</div>
              <div class="user-id">${pilot.id || 'ID não informado'}</div>
            </div>
          </div>
          <div class="hours">${formatHoursLabel(pilot.seconds)}</div>
          <div class="progress-col">
            <div class="progress-track" role="presentation"><div class="progress-fill" style="width:${progress}%"></div></div>
            <div class="progress-badge">${progress}% do líder</div>
          </div>
        `;
        li.addEventListener('click', () => selectPilot(pilot.name));
        rankingList.appendChild(li);
    });
}

function highlightRow(name) {
    const rows = rankingList.querySelectorAll('.ranking-row');
    rows.forEach((row) => {
        if (row.dataset.pilot === name) {
            row.classList.add('selected');
            if (!state.autoScrolled) {
                row.scrollIntoView({ block: 'center', behavior: 'smooth' });
                state.autoScrolled = true;
            }
        } else {
            row.classList.remove('selected');
        }
    });
}

function computeGapText(ranking) {
    if (!state.session?.username) return 'Entre no sistema para ver sua meta';
    const meIndex = ranking.findIndex((r) => r.name.toLowerCase() === state.session.username.toLowerCase());
    if (meIndex < 0) return 'Fique ativo para aparecer no ranking';
    if (meIndex === 0) return 'Você é o líder 🎉';
    const targetIndex = meIndex <= 2 ? 0 : 2;
    const target = ranking[targetIndex];
    const me = ranking[meIndex];
    const diff = Math.max((target?.seconds || 0) - (me?.seconds || 0), 0);
    return `${formatShortGap(diff)} para ${targetIndex === 0 ? 'o líder' : 'entrar no Top 3'}`;
}

function updateHero(ranking) {
    const leader = ranking[0];
    const userName = state.session?.username;
    const position = userName ? ranking.findIndex((r) => r.name.toLowerCase() === userName.toLowerCase()) : -1;
    const userPilot = position >= 0 ? ranking[position] : null;

    heroPosition.textContent = position >= 0 ? `#${position + 1}` : '—';
    heroHours.textContent = userPilot ? formatHoursLabel(userPilot.seconds) : '—';
    const gapSeconds = leader && userPilot ? Math.max(leader.seconds - userPilot.seconds, 0) : null;
    heroGap.textContent = gapSeconds !== null ? formatShortGap(gapSeconds) : '—';
    heroDelta.textContent = computeGapText(ranking);
}

function renderDetail(pilot, position) {
    if (!pilot) {
        detailName.textContent = 'Selecione um piloto';
        detailId.textContent = 'ID —';
        detailHours.textContent = '—';
        detailShare.textContent = '—';
        detailPosition.textContent = '—';
        detailDelta.textContent = '—';
        detailAvatar.textContent = '';
        detailUpdated.textContent = '—';
        return;
    }

    const leaderSeconds = state.ranking[0]?.seconds || 0;
    const progress = leaderSeconds ? Math.round((pilot.seconds / leaderSeconds) * 100) : 0;
    detailName.textContent = pilot.name;
    detailId.textContent = `ID ${pilot.id || '—'}`;
    detailHours.textContent = formatHoursLabel(pilot.seconds);
    detailShare.textContent = `${progress}% do líder`;
    detailPosition.textContent = `#${position + 1}`;
    const diff = leaderSeconds ? Math.max(leaderSeconds - pilot.seconds, 0) : 0;
    detailDelta.textContent = position === 0 ? 'Piloto líder' : `${formatShortGap(diff)} do líder`;
    detailAvatar.textContent = pilot.avatar;
    detailAvatar.style.background = pilot.color;
    detailUpdated.textContent = pilot.lastDate ? `Último protocolo: ${formatTimeLabel(pilot.lastDate)}` : 'Sem data registrada';
}

function selectPilot(name) {
    const found = state.ranking.find((r) => r.name === name) || state.ranking[0];
    if (!found) return;
    state.selectedPilot = found.name;
    renderDetail(found, state.ranking.indexOf(found));
    highlightRow(found.name);
}

function autoSelectPilot() {
    if (state.selectedPilot) {
        selectPilot(state.selectedPilot);
        return;
    }
    const user = state.session?.username;
    if (user) {
        const me = state.ranking.find((r) => r.name.toLowerCase() === user.toLowerCase());
        if (me) {
            selectPilot(me.name);
            return;
        }
    }
    if (state.ranking[0]) selectPilot(state.ranking[0].name);
}

function bindFilters() {
    searchInput?.addEventListener('input', (e) => {
        state.filters.search = e.target.value;
        applyFilters();
    });

    periodFilter?.addEventListener('change', (e) => {
        state.filters.period = e.target.value;
        applyFilters();
    });

    sortFilter?.addEventListener('change', (e) => {
        state.filters.sort = e.target.value;
        applyFilters();
    });

    onlyMeToggle?.addEventListener('change', (e) => {
        state.filters.onlyMe = e.target.checked;
        applyFilters();
    });

    refreshRanking?.addEventListener('click', () => {
        loadData();
    });
}

async function loadData() {
    showSkeleton();
    try {
        const [pilotos, protocols] = await Promise.all([fetchPilotos(), fetchProtocols()]);
        state.pilotos = pilotos;
        state.protocols = protocols;
        state.pilotLookup = buildPilotLookup(pilotos);
        state.lastUpdated = new Date();
        updateStatusMeta();
        applyFilters();
    } catch (err) {
        console.error(err);
        showErrorState('Não foi possível carregar o ranking.');
        notify('Não foi possível carregar o ranking.', 'error');
    }
}

async function init() {
    checkAuth();

    if (window.uiHelpers) {
        window.uiHelpers.renderSessionChip('sessionStatus');
        state.session = window.uiHelpers.getSession();
        const logoutBtn = document.getElementById('logoutBtn');
        logoutBtn?.addEventListener('click', async () => {
            const ok = await window.uiHelpers.confirmLogout();
            if (ok) logout();
        });
    }

    if (rankingName) rankingName.textContent = 'Horas de voo';

    bindFilters();
    loadData();
}

init();
