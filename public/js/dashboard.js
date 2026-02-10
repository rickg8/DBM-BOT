const summaryCards = document.getElementById("summaryCards");
const chartDays = document.getElementById("chartDays");
const topPilotsBody = document.getElementById("topPilots");
const recentBody = document.getElementById("recentProtocols");
const heroTotal = document.getElementById("heroTotal");
const statusTotalEl = document.getElementById("statusTotal");
const statusFinalizedEl = document.getElementById("statusFinalized");
const statusOpenEl = document.getElementById("statusOpen");
const statusWarningsEl = document.getElementById("statusWarnings");
const highlightPilotName = document.getElementById("highlightPilotName");
const highlightPilotMeta = document.getElementById("highlightPilotMeta");
const highlightHoursEl = document.getElementById("highlightHours");
const highlightProtocolsEl = document.getElementById("highlightProtocols");
const highlightLastDateEl = document.getElementById("highlightLastDate");
const highlightProfileLink = document.getElementById("highlightProfileLink");
const highlightNoteEl = document.getElementById("highlightNote");
const NON_COUNT_STATUSES = ['ADVERTENCIA', 'NAO PARTICIPANDO', 'INATIVO'];
let cachedProtocols = [];
let filteredProtocols = [];

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

function addDays(date, amount) {
    const clone = new Date(date);
    clone.setDate(clone.getDate() + amount);
    return clone;
}

function toIsoDate(date) {
    return date.toISOString().split('T')[0];
}

function getPeriodBounds(protocols) {
    const dates = protocols
        .map(p => p.data)
        .filter(Boolean)
        .sort();
    if (!dates.length) return null;
    const lastDate = new Date(dates[dates.length - 1]);
    lastDate.setHours(0, 0, 0, 0);
    const currentStart = addDays(lastDate, -6);
    const previousEnd = addDays(currentStart, -1);
    const previousStart = addDays(previousEnd, -6);
    return {
        currentStart,
        currentEnd: lastDate,
        previousStart,
        previousEnd
    };
}

function getTotalsInRange(protocols, startDate, endDate) {
    if (!startDate || !endDate) return null;
    const start = toIsoDate(startDate);
    const end = toIsoDate(endDate);
    const totals = {
        protocols: 0,
        hours: 0,
        active: 0,
        nonCount: 0
    };
    const pilots = new Set();
    protocols.forEach(p => {
        if (!p.data) return;
        if (p.data >= start && p.data <= end) {
            totals.protocols += 1;
            pilots.add(p.piloto);
            const duration = Number(p.duracao) || 0;
            totals.hours += duration;
            if (isNonCounting(p.status)) {
                totals.nonCount += 1;
            }
        }
    });
    totals.active = pilots.size;
    return totals;
}

function buildTrend(current, previous, { isPercent = false } = {}) {
    if (current == null || previous == null) {
        return { arrow: '➖', label: '', tone: 'muted' };
    }
    const diff = current - previous;
    if (diff === 0) {
        return { arrow: '➖', label: '0', tone: 'muted' };
    }
    const sign = diff > 0 ? '+' : '-';
    const arrow = diff > 0 ? '⬆️' : '⬇️';
    let label;
    if (isPercent) {
        const rate = previous ? Math.round((Math.abs(diff) / previous) * 100) : Math.abs(diff);
        label = `${sign}${rate}${previous ? '%' : ''}`;
    } else {
        label = `${sign}${Math.abs(diff)}`;
    }
    const tone = diff > 0 ? 'positive' : 'negative';
    return { arrow, label, tone };
}

function renderStatusCard(total, finalized, open, warnings) {
    if (statusTotalEl) statusTotalEl.textContent = total ?? '0';
    if (statusFinalizedEl) statusFinalizedEl.textContent = finalized ?? '0';
    if (statusOpenEl) statusOpenEl.textContent = open ?? '0';
    if (statusWarningsEl) statusWarningsEl.textContent = warnings ?? '0';
}

function renderSummary(protocols) {
    const totalProtocols = protocols.length;
    const finalized = protocols.filter(p => (p.status || 'FINALIZADO').toUpperCase() === 'FINALIZADO');
    const openCount = protocols.filter(p => (p.status || 'FINALIZADO').toUpperCase() === 'ABERTO').length;
    const nonCountingCount = protocols.filter(p => isNonCounting(p.status)).length;
    const totalSeconds = finalized.reduce((s, p) => s + (p.duracao || 0), 0);
    const uniquePilots = new Set(protocols.map(p => p.piloto)).size;

    if (heroTotal) {
        heroTotal.textContent = totalProtocols;
    }

    renderStatusCard(totalProtocols, finalized.length, openCount, nonCountingCount);

    const bounds = getPeriodBounds(protocols);
    const currentTotals = bounds ? getTotalsInRange(protocols, bounds.currentStart, bounds.currentEnd) : null;
    const previousTotals = bounds ? getTotalsInRange(protocols, bounds.previousStart, bounds.previousEnd) : null;

    const metrics = [
        {
            icon: "📄",
            label: "Protocolos",
            value: totalProtocols,
            trend: buildTrend(currentTotals?.protocols, previousTotals?.protocols)
        },
        {
            icon: "⏱️",
            label: "Horas",
            value: formatDuration(totalSeconds),
            trend: buildTrend(currentTotals?.hours, previousTotals?.hours, { isPercent: true })
        },
        {
            icon: "👥",
            label: "Ativos",
            value: uniquePilots,
            trend: buildTrend(currentTotals?.active, previousTotals?.active)
        },
        {
            icon: "⚠️",
            label: "Não cont.",
            value: nonCountingCount,
            trend: buildTrend(currentTotals?.nonCount, previousTotals?.nonCount)
        }
    ];

    if (!summaryCards) return;

    summaryCards.innerHTML = metrics
        .map(metric => `
      <article class="summary-card">
        <span class="summary-icon" aria-hidden="true">${metric.icon}</span>
        <div class="summary-body">
          <p class="summary-label">${metric.label}</p>
          <p class="summary-value">${metric.value ?? '—'}</p>
        </div>
        <div class="summary-trend ${metric.trend.tone}">
          <span aria-hidden="true">${metric.trend.arrow}</span>
          <span>${metric.trend.label || '—'}</span>
        </div>
      </article>
    `)
        .join("");
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
        return [];
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
    const medals = ['🥇', '🥈', '🥉'];
    const entryList = sorted.map(([piloto, info], index) => {
        const media = info.count ? Math.round(info.segundos / info.count) : 0;
        const color = pilotColors[piloto] || "#4b5563";
        const medal = medals[index] || '';
        const position = index + 1;
        const profileUrl = `ranking.html?piloto=${encodeURIComponent(piloto)}`;
        const tooltip = `${position}º lugar • ${info.count} protocolos • Média ${formatDuration(media)}`;
        return {
            piloto,
            info,
            color,
            medal,
            media,
            profileUrl,
            position,
            tooltip
        };
    });

    topPilotsBody.innerHTML = entryList.map(entry => `
        <tr>
            <td data-label="Piloto">
                <a class="pilot-link" href="${entry.profileUrl}" title="${entry.tooltip}">
                    ${entry.medal ? `<span class="medal-icon" aria-hidden="true">${entry.medal}</span>` : ''}
                    <span class="pilot-badge" style="background:${entry.color}">${entry.piloto}</span>
                </a>
            </td>
            <td data-label="Protocolos">${entry.info.count}</td>
            <td data-label="Horas">${formatDuration(entry.info.segundos)}</td>
            <td data-label="Média">${formatDuration(entry.media)}</td>
            <td data-label="Último">${entry.info.last ? formatDateDisplay(entry.info.last.data) : '-'}</td>
            <td data-label="Link">${renderDiscordLink(entry.info.link)}</td>
        </tr>
    `).join("");

    return entryList;
}

function renderHighlight(entries) {
    if (!entries?.length) {
        if (highlightPilotName) highlightPilotName.textContent = '—';
        if (highlightPilotMeta) highlightPilotMeta.textContent = 'Aguardando dados';
        if (highlightHoursEl) highlightHoursEl.textContent = '—';
        if (highlightProtocolsEl) highlightProtocolsEl.textContent = '—';
        if (highlightLastDateEl) highlightLastDateEl.textContent = '—';
        highlightProfileLink?.setAttribute('aria-disabled', 'true');
        highlightProfileLink?.removeAttribute('href');
        if (highlightNoteEl) highlightNoteEl.textContent = 'Ainda sem destaque.';
        return;
    }

    const leader = entries[0];
    highlightPilotName && (highlightPilotName.textContent = leader.piloto);
    if (highlightPilotMeta) {
        const badge = leader.medal ? `${leader.medal} ` : '';
        highlightPilotMeta.textContent = `${badge}${leader.position}º • ${leader.info.count} protocolos`;
    }
    highlightHoursEl && (highlightHoursEl.textContent = formatDuration(leader.info.segundos));
    highlightProtocolsEl && (highlightProtocolsEl.textContent = `${leader.info.count} protocolos`);
    highlightLastDateEl && (highlightLastDateEl.textContent = leader.info.last ? formatDateDisplay(leader.info.last.data) : '—');
    if (highlightProfileLink) {
        highlightProfileLink.href = leader.profileUrl;
        highlightProfileLink.removeAttribute('aria-disabled');
    }
    if (highlightNoteEl) {
        highlightNoteEl.textContent = leader.info.last
            ? `Último protocolo em ${formatDateDisplay(leader.info.last.data)}`
            : 'Atualizado agora';
    }
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
        <td data-label="Data">${formatDateDisplay(p.data)}</td>
        <td data-label="Piloto"><span class="pilot-badge" style="background:${color}">${p.piloto}</span></td>
        <td data-label="Duração">${dur}</td>
        <td data-label="Veículo">${p.veiculo}</td>
                <td data-label="Status"><span class="status-badge ${statusClass}">${p.status || 'FINALIZADO'}</span></td>
            <td data-label="Link">${renderDiscordLink(p.link)}</td>
      </tr>
    `;
    }).join("");
}

function applyDashboardFilters(pilotColors) {
    const statusChips = document.querySelectorAll('#statusChips .chip');
    let status = '';
    statusChips.forEach(chip => {
        if (chip.classList.contains('active')) status = chip.dataset.status || '';
    });
    const start = document.getElementById('dateStart')?.value;
    const end = document.getElementById('dateEnd')?.value;

    filteredProtocols = cachedProtocols.filter(p => {
        const statusVal = (p.status || 'FINALIZADO').toUpperCase();
        const statusOk = !status || statusVal === status;
        const startOk = !start || p.data >= start;
        const endOk = !end || p.data <= end;
        return statusOk && startOk && endOk;
    });

    const list = filteredProtocols.length ? filteredProtocols : cachedProtocols;
    renderSummary(list);
    renderDays(list);
    const topEntries = renderTopPilots(list, pilotColors);
    renderHighlight(topEntries);
    renderRecent(list, pilotColors);
}

function showSkeletons() {
    if (summaryCards) {
        summaryCards.innerHTML = '<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>';
    }
    if (chartDays) {
        chartDays.innerHTML = '<div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div>';
    }
    if (topPilotsBody) {
        topPilotsBody.innerHTML = '<tr><td colspan="6"><div class="skeleton skeleton-line"></div></td></tr>';
    }
    if (recentBody) {
        recentBody.innerHTML = '<tr><td colspan="6"><div class="skeleton skeleton-line"></div></td></tr>';
    }
    renderHighlight([]);
}

function showErrorState(msg) {
    const html = `<tr><td colspan="6"><div class="error-state"><strong>${msg}</strong><div class="empty-actions"><button class="pill" onclick="location.reload()">Recarregar</button></div></div></td></tr>`;
    if (summaryCards) summaryCards.innerHTML = `<div class="error-state"><strong>${msg}</strong></div>`;
    if (chartDays) chartDays.innerHTML = `<div class="error-state"><strong>${msg}</strong></div>`;
    if (topPilotsBody) topPilotsBody.innerHTML = html;
    if (recentBody) recentBody.innerHTML = html;
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

    showSkeletons();

    try {
        const [pilotos, protocols] = await Promise.all([fetchPilotos(), fetchProtocols()]);
        const pilotColors = pilotos.reduce((acc, { nome, cor }) => {
            acc[nome] = cor || "#6b7280";
            return acc;
        }, {});
        cachedProtocols = protocols;

        document.querySelectorAll('#statusChips .chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('#statusChips .chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                applyDashboardFilters(pilotColors);
            });
        });

        document.getElementById('dateStart')?.addEventListener('change', () => applyDashboardFilters(pilotColors));
        document.getElementById('dateEnd')?.addEventListener('change', () => applyDashboardFilters(pilotColors));

        applyDashboardFilters(pilotColors);
    } catch (err) {
        console.error(err);
        showErrorState("Não foi possível carregar o dashboard.");
        notify("Não foi possível carregar o dashboard.", 'error');
    }
}

init();
