const summaryCards = document.getElementById("summaryCards");
const chartDays = document.getElementById("chartDays");
const topPilotsBody = document.getElementById("topPilots");
const recentBody = document.getElementById("recentProtocols");
const heroTotal = document.getElementById("heroTotal");
const NON_COUNT_STATUSES = ['ADVERTENCIA', 'NAO PARTICIPANDO', 'INATIVO'];

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

async function fetchPilotos() {
    const res = await fetch("/api/v1/pilotos");
    if (!res.ok) throw new Error("Falha ao carregar pilotos");
    return res.json();
}

async function fetchProtocols() {
    const res = await fetch("/api/v1/protocolos");
    if (!res.ok) throw new Error("Falha ao carregar protocolos");
    return res.json();
}

function isNonCounting(status) {
    return NON_COUNT_STATUSES.includes((status || '').toUpperCase());
}

function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
}

function formatDateDisplay(dateStr) {
    if (!dateStr || !dateStr.includes('-')) return dateStr || '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

function renderDiscordLink(link) {
    if (!link) return '-';
    return `<a class="icon-link" href="${link}" target="_blank" rel="noopener noreferrer" title="Abrir link">
              <img src="assets/icons/discord-icon-svgrepo-com.svg" alt="Discord" />
            </a>`;
}

function formatDateDisplay(dateStr) {
    if (!dateStr || !dateStr.includes('-')) return dateStr || '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

function renderSummary(protocols) {
    const totalProtocols = protocols.length;
    const finalized = protocols.filter(p => (p.status || 'FINALIZADO').toUpperCase() === 'FINALIZADO');
    const openCount = protocols.filter(p => (p.status || 'FINALIZADO').toUpperCase() === 'ABERTO').length;
    const nonCountingCount = protocols.filter(p => isNonCounting(p.status)).length;
    const totalSeconds = finalized.reduce((s, p) => s + p.duracao, 0);
    const avgSeconds = finalized.length ? Math.round(totalSeconds / finalized.length) : 0;
    const uniquePilots = new Set(protocols.map(p => p.piloto)).size;

    if (heroTotal) {
        heroTotal.textContent = totalProtocols;
    }

    const cards = [
        { title: "Protocolos", value: totalProtocols },
        { title: "Horas totais", value: formatDuration(totalSeconds) },
        { title: "Média por protocolo", value: formatDuration(avgSeconds) },
        { title: "Pilotos ativos", value: uniquePilots },
        { title: "Abertos", value: openCount },
        { title: "Não contabilizados", value: nonCountingCount }
    ];

    summaryCards.innerHTML = cards.map(c => `
    <div class="card">
      <div class="card-title">${c.title}</div>
      <div class="card-value">${c.value}</div>
    </div>
  `).join("");
}

function renderDays(protocols) {
    chartDays.innerHTML = "";
    const finalized = protocols.filter(p => (p.status || 'FINALIZADO').toUpperCase() === 'FINALIZADO');

    if (!finalized.length) {
        chartDays.innerHTML = '<p class="muted">Nenhum dado.</p>';
        return;
    }
    const byDay = finalized.reduce((acc, p) => {
        acc[p.data] = (acc[p.data] || 0) + p.duracao;
        return acc;
    }, {});
    const entries = Object.entries(byDay).sort((a, b) => new Date(a[0]) - new Date(b[0]));
    const max = Math.max(...entries.map(([, v]) => v));

    chartDays.innerHTML = entries.map(([day, seconds]) => {
        const pct = max ? (seconds / max) * 100 : 0;
        return `
      <div class="bar-row">
                <span class="bar-label">${formatDateDisplay(day)}</span>
        <div class="bar"><div class="bar-fill" style="width:${pct}%;"></div></div>
        <span class="bar-value">${formatDuration(seconds)}</span>
      </div>
    `;
    }).join("");
}

function renderTopPilots(protocols, pilotColors) {
    topPilotsBody.innerHTML = "";
    const finalized = protocols.filter(p => (p.status || 'FINALIZADO').toUpperCase() === 'FINALIZADO');
    if (!finalized.length) {
        topPilotsBody.innerHTML = '<tr><td colspan="6" class="muted">Nenhum dado.</td></tr>';
        return;
    }
    const groups = finalized.reduce((acc, p) => {
        const g = acc[p.piloto] || { segundos: 0, count: 0, last: null, link: null };
        g.segundos += p.duracao;
        g.count += 1;
        if (!g.last || new Date(p.data) > new Date(g.last.data)) {
            g.last = { data: p.data };
            g.link = p.link || g.link;
        }
        acc[p.piloto] = g;
        return acc;
    }, {});

    const sorted = Object.entries(groups).sort((a, b) => b[1].segundos - a[1].segundos).slice(0, 8);

    topPilotsBody.innerHTML = sorted.map(([piloto, info]) => {
        const media = info.count ? Math.round(info.segundos / info.count) : 0;
        const color = pilotColors[piloto] || "#4b5563";
        return `
      <tr>
        <td><span class="pilot-badge" style="background:${color}">${piloto}</span></td>
        <td>${info.count}</td>
        <td>${formatDuration(info.segundos)}</td>
        <td>${formatDuration(media)}</td>
            <td>${info.last ? formatDateDisplay(info.last.data) : '-'}</td>
            <td>${renderDiscordLink(info.link)}</td>
      </tr>
    `;
    }).join("");
}

function renderRecent(protocols, pilotColors) {
    recentBody.innerHTML = "";
    if (!protocols.length) {
        recentBody.innerHTML = '<tr><td colspan="6" class="muted">Nenhum dado.</td></tr>';
        return;
    }
    const sorted = [...protocols].sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 10);
    recentBody.innerHTML = sorted.map(p => {
        const color = pilotColors[p.piloto] || "#4b5563";
        const isOpen = (p.status || 'FINALIZADO').toUpperCase() === 'ABERTO';
        const isWarn = isNonCounting(p.status);
        const statusClass = isOpen ? 'open' : (isWarn ? 'warn' : 'closed');
        const dur = isWarn ? '—' : formatDuration(p.duracao);
        return `
            <tr class="${isOpen ? 'row-open' : ''}">
        <td>${formatDateDisplay(p.data)}</td>
        <td><span class="pilot-badge" style="background:${color}">${p.piloto}</span></td>
        <td>${dur}</td>
        <td>${p.veiculo}</td>
                <td><span class="status-badge ${statusClass}">${p.status || 'FINALIZADO'}</span></td>
            <td>${renderDiscordLink(p.link)}</td>
      </tr>
    `;
    }).join("");
}

async function init() {
    // Verificar autenticação
    checkAuth();
    
    try {
        const [pilotos, protocols] = await Promise.all([fetchPilotos(), fetchProtocols()]);
        const pilotColors = pilotos.reduce((acc, { nome, cor }) => {
            acc[nome] = cor || "#6b7280";
            return acc;
        }, {});
        renderSummary(protocols);
        renderDays(protocols);
        renderTopPilots(protocols, pilotColors);
        renderRecent(protocols, pilotColors);
    } catch (err) {
        console.error(err);
        alert("Não foi possível carregar o dashboard.");
    }
}

init();
