const form = document.getElementById("protocolForm");
const pilotCards = document.getElementById("pilotCards");
const pilotoSelect = document.getElementById("piloto");
const veiculoSelect = document.getElementById("veiculo");
const fimInput = document.getElementById("fim");
const statusSelect = document.getElementById("status");
const filterPiloto = document.getElementById("filterPiloto");
const filterStatus = document.getElementById("filterStatus");
const filterBusca = document.getElementById("filterBusca");
const filterOrdenacao = document.getElementById("filterOrdenacao");
const filterDataInicio = document.getElementById("filterDataInicio");
const filterDataFim = document.getElementById("filterDataFim");
const filterAplicar = document.getElementById("filterAplicar");
const filterLimpar = document.getElementById("filterLimpar");
const filterToggle = document.getElementById("filterToggle");
const filtersPanel = document.getElementById("filtersPanel");
const exportCsvBtn = document.getElementById("exportCsv");
const openBadge = document.getElementById("openBadge");
const openDrawerBtn = document.getElementById("openDrawer");
const drawer = document.getElementById("protocolDrawer");
const drawerClose = document.getElementById("drawerClose");
const drawerTitle = document.getElementById("drawerTitle");
const editModal = document.getElementById("editModal");
const editPilotoBadge = document.getElementById("editPilotoBadge");
const editVeiculo = document.getElementById("editVeiculo");
const editLink = document.getElementById("editLink");
const editData = document.getElementById("editData");
const editInicio = document.getElementById("editInicio");
const editFim = document.getElementById("editFim");
const editSave = document.getElementById("editSave");
const editClose = document.getElementById("editClose");
const finalizeModal = document.getElementById("finalizeModal");
const finalizeClose = document.getElementById("finalizeClose");
const finalizeConfirm = document.getElementById("finalizeConfirm");
const finalizeFim = document.getElementById("finalizeFim");
const finalizeInfo = document.getElementById("finalizeInfo");
const finalizePreview = document.getElementById("finalizePreview");

let protocols = [];
let filteredProtocols = [];
let editingId = null;
let drawerMode = 'create';
let pilotColors = {};
let currentEditingPiloto = "";
let currentEditingStatus = "";
let cachedVeiculos = [];
let finalizingId = null;
let finalizingProtocol = null;
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

// Função helper para fazer requisições autenticadas
function authFetch(url, options = {}) {
    const token = localStorage.getItem('auth_token');

    if (!token) {
        console.error('[AUTH] Token não encontrado, redirecionando...');
        window.location.href = '/login.html';
        return Promise.reject(new Error('Não autenticado'));
    }

    // Adicionar token no header Authorization
    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };

    return fetch(url, { ...options, headers }).then(res => {
        if (res.status === 401) {
            console.warn('[AUTH] Sessão expirada ou inválida');
            if (window.clearAuth) window.clearAuth();
            window.location.href = '/login.html';
            throw new Error('Sessão expirada');
        }
        return res;
    });
}

async function fetchPilotos() {
    const res = await authFetch("/api/v1/pilotos");
    if (!res.ok) throw new Error("Falha ao carregar pilotos");
    return res.json();
}

async function fetchVeiculos() {
    const res = await authFetch("/api/v1/veiculos");
    if (!res.ok) throw new Error("Falha ao carregar veículos");
    const data = await res.json();
    cachedVeiculos = data;
    return data;
}

async function fetchProtocols() {
    const res = await authFetch("/api/v1/protocolos");
    if (!res.ok) throw new Error("Falha ao carregar protocolos");
    return res.json();
}

function renderPilotos(pilotos) {
    pilotoSelect.innerHTML = '<option value="">Selecione o piloto</option>';
    if (filterPiloto) {
        filterPiloto.innerHTML = '<option value="">Todos os pilotos</option>';
    }
    pilotColors = {};
    pilotos.forEach(({ nome, cor }) => {
        pilotColors[nome] = cor || "#6b7280";
        const option = document.createElement("option");
        option.value = nome;
        option.textContent = nome;
        pilotoSelect.appendChild(option);

        if (filterPiloto) {
            const opt = document.createElement("option");
            opt.value = nome;
            opt.textContent = nome;
            filterPiloto.appendChild(opt);
        }
    });
}

function renderVeiculos(veiculos) {
    veiculoSelect.innerHTML = '<option value="">Selecione o veículo</option>';
    veiculos.forEach(({ nome }) => {
        const option = document.createElement("option");
        option.value = nome;
        option.textContent = nome;
        veiculoSelect.appendChild(option);
    });

    // se só houver um veículo, já pré-seleciona
    if (veiculos.length === 1) {
        veiculoSelect.value = veiculos[0].nome;
    }
}

function fillEditVeiculos(veiculos, value) {
    editVeiculo.innerHTML = "";
    veiculos.forEach(({ nome }) => {
        const option = document.createElement("option");
        option.value = nome;
        option.textContent = nome;
        editVeiculo.appendChild(option);
    });
    editVeiculo.value = value || (veiculos[0] ? veiculos[0].nome : "");
}

/* =========================
   UTILIDADES
========================= */

function isNonCounting(status) {
    return NON_COUNT_STATUSES.includes((status || '').toUpperCase());
}

// calcula duração considerando virada de dia
function calculateDuration(date, start, end) {
    const startTime = new Date(`${date}T${start}`);
    let endTime = new Date(`${date}T${end}`);
    if (endTime < startTime) endTime.setDate(endTime.getDate() + 1);
    return Math.floor((endTime - startTime) / 1000);
}

function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
}

function formatDateDisplay(dateStr) {
    if (!dateStr || !dateStr.includes('-')) return dateStr || '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

function renderDiscordLink(link) {
    if (!link) return '-';
    const iconPath = 'assets/icons/discord-icon-svgrepo-com.svg';
    return `<a class="icon-link" href="${link}" target="_blank" rel="noopener noreferrer" title="Abrir link">
              <img src="${iconPath}" alt="Discord" />
            </a>`;
}

function notify(message, type = 'info') {
    if (window.toast) {
        if (type === 'error') return window.toast.error(message);
        if (type === 'success') return window.toast.success(message);
        return window.toast.info(message);
    }
    console.log(message);
}

async function confirmDelete() {
    if (window.Swal) {
        const result = await Swal.fire({
            title: 'Apagar protocolo?',
            text: 'Esta ação não pode ser desfeita.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Apagar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#1e4db7',
            cancelButtonColor: '#4b5563',
            reverseButtons: true,
        });
        return result.isConfirmed;
    }
    return confirm('Apagar este protocolo?');
}

function statusTitle(p) {
    if (!p) return '';
    const status = (p.status || 'FINALIZADO').toUpperCase();
    if (status === 'ABERTO') return 'Protocolo em andamento';
    if (isNonCounting(status)) return 'Não contabiliza horas';
    if (p.fim) return `Finalizado às ${p.fim}`;
    return 'Protocolo finalizado';
}

function updateOpenBadge() {
    if (!openBadge) return;
    const openCount = protocols.filter(p => (p.status || '').toUpperCase() === 'ABERTO').length;
    openBadge.textContent = `Abertos: ${openCount}`;
    openBadge.classList.toggle('low', openCount === 0);
}

function syncFimWithStatus() {
    if (!fimInput || !statusSelect) return;
    const statusVal = (statusSelect.value || 'FINALIZADO').toUpperCase();
    const isOpen = statusVal === 'ABERTO';
    const noDuration = isNonCounting(statusVal);
    if (isOpen || noDuration) {
        fimInput.value = "";
        fimInput.disabled = true;
    } else {
        fimInput.disabled = false;
    }
}

statusSelect?.addEventListener("change", syncFimWithStatus);

function applyFilters() {
    filteredProtocols = protocols.filter(p => {
        const statusVal = (p.status || 'FINALIZADO').toUpperCase();
        const text = filterBusca?.value.trim().toLowerCase() || '';
        const pilotOk = !filterPiloto?.value || p.piloto === filterPiloto.value;
        const statusOk = !filterStatus?.value || statusVal === filterStatus.value;
        const startOk = !filterDataInicio?.value || p.data >= filterDataInicio.value;
        const endOk = !filterDataFim?.value || p.data <= filterDataFim.value;
        const textOk = !text || [p.piloto, p.veiculo, p.link, p.status].some(val => String(val || '').toLowerCase().includes(text));
        return pilotOk && statusOk && startOk && endOk && textOk;
    });

    const sort = filterOrdenacao?.value || 'data_desc';
    const sorter = {
        data_desc: (a, b) => new Date(b.data) - new Date(a.data),
        data_asc: (a, b) => new Date(a.data) - new Date(b.data),
        dur_desc: (a, b) => b.duracao - a.duracao,
        dur_asc: (a, b) => a.duracao - b.duracao
    }[sort];
    if (sorter) filteredProtocols.sort(sorter);

    saveFilters();
    renderPilotCards();
}

function saveFilters() {
    try {
        const payload = {
            piloto: filterPiloto?.value || '',
            status: filterStatus?.value || '',
            busca: filterBusca?.value || '',
            ordenacao: filterOrdenacao?.value || 'data_desc',
            dataInicio: filterDataInicio?.value || '',
            dataFim: filterDataFim?.value || ''
        };
        localStorage.setItem('dbm_filters', JSON.stringify(payload));
    } catch (err) {
        console.warn('Não foi possível salvar filtros', err);
    }
}

function restoreFilters() {
    try {
        const raw = localStorage.getItem('dbm_filters');
        if (!raw) return;
        const payload = JSON.parse(raw);
        if (filterPiloto) filterPiloto.value = payload.piloto || '';
        if (filterStatus) filterStatus.value = payload.status || '';
        if (filterBusca) filterBusca.value = payload.busca || '';
        if (filterOrdenacao) filterOrdenacao.value = payload.ordenacao || 'data_desc';
        if (filterDataInicio) filterDataInicio.value = payload.dataInicio || '';
        if (filterDataFim) filterDataFim.value = payload.dataFim || '';
    } catch (err) {
        console.warn('Não foi possível restaurar filtros', err);
    }
}

filterAplicar?.addEventListener("click", applyFilters);
filterLimpar?.addEventListener("click", () => {
    if (filterPiloto) filterPiloto.value = "";
    if (filterStatus) filterStatus.value = "";
    if (filterBusca) filterBusca.value = "";
    if (filterOrdenacao) filterOrdenacao.value = "data_desc";
    if (filterDataInicio) filterDataInicio.value = "";
    if (filterDataFim) filterDataFim.value = "";
    filteredProtocols = [];
    saveFilters();
    renderPilotCards();
});

filterToggle?.addEventListener("click", () => {
    if (!filtersPanel) return;
    const isCollapsed = filtersPanel.classList.toggle("collapsed");
    if (filterToggle) filterToggle.textContent = isCollapsed ? "Mostrar filtros" : "Ocultar filtros";
});

/* =========================
   RENDERIZAÇÃO
========================= */

function renderPilotCards() {
    if (!pilotCards) return;
    pilotCards.innerHTML = "";

    const list = filteredProtocols.length ? filteredProtocols : protocols;

    if (list.length === 0) {
        pilotCards.innerHTML = '<p class="muted">Nenhum protocolo ainda.</p>';
        return;
    }

    const groups = list.reduce((acc, p) => {
        acc[p.piloto] = acc[p.piloto] || [];
        acc[p.piloto].push(p);
        return acc;
    }, {});

    const pilotosOrdenados = Object.keys(groups).sort();
    pilotosOrdenados.forEach((piloto, idx) => {
        const entries = groups[piloto].sort((a, b) => new Date(b.data) - new Date(a.data));
        const totalSeconds = entries.reduce((sum, p) => {
            const statusVal = (p.status || '').toUpperCase();
            if (isNonCounting(statusVal)) return sum;
            return sum + p.duracao;
        }, 0);
        const color = pilotColors[piloto] || "#4b5563";

        const rows = entries.map(p => {
            const statusVal = (p.status || '').toUpperCase();
            const isOpen = statusVal === 'ABERTO';
            const noDuration = isNonCounting(statusVal);
            const duracaoDisplay = noDuration ? '—' : formatDuration(p.duracao);
            const statusBadge = `<span class="status-badge ${isOpen ? 'open' : (noDuration ? 'warn' : 'closed')}" title="${statusTitle(p)}">${p.status || 'FINALIZADO'}</span>`;
            const finalizeBtn = isOpen
                ? `<button type="button" class="action" data-id="${p.id}" data-action="finalizar">Finalizar Protocolo</button>`
                : '';

            return `
                    <tr class="${isOpen ? 'row-open' : ''}">
                        <td data-label="Data">${formatDateDisplay(p.data)}</td>
                        <td data-label="Início">${p.inicio}</td>
                        <td data-label="Fim">${p.fim}</td>
                        <td data-label="Duração">${duracaoDisplay}</td>
                        <td data-label="Veículo">${p.veiculo}</td>
                        <td data-label="Link">${renderDiscordLink(p.link)}</td>
                        <td data-label="Status">${statusBadge}</td>
                        <td data-label="Ações">
                            ${finalizeBtn}
                            <button type="button" class="action" data-id="${p.id}" data-action="edit">🛠️</button>
                            <button type="button" class="action danger" data-id="${p.id}" data-action="delete">🗑️</button>
                        </td>
                    </tr>
                `;
        }).join("");

        const totalRow = `
                    <tr class="total-row">
                        <td data-label="Total" colspan="3">Total</td>
                        <td data-label="Duração">${formatDuration(totalSeconds)}</td>
                        <td data-label="" colspan="4"></td>
                    </tr>
                `;

        const card = document.createElement("div");
        card.className = "pilot-card";
        card.innerHTML = `
                    <header>
                        <span class="pilot-badge" style="background:${color}">${piloto}</span>
                        <span class="totals">${entries.length} protocolo(s) · ${formatDuration(totalSeconds)}</span>
                    </header>
                    <div class="table-scroll">
                      <table class="data-table">
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Início</th>
                                <th>Fim</th>
                                <th>Duração</th>
                                <th>Veículo</th>
                                <th>Link</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                            ${totalRow}
                        </tbody>
                      </table>
                    </div>
                `;

        pilotCards.appendChild(card);

        if (idx < pilotosOrdenados.length - 1) {
            const divider = document.createElement("div");
            divider.className = "table-divider";
            pilotCards.appendChild(divider);
        }
    });
}

/* =========================
   EVENTO DE SUBMIT
========================= */

form.addEventListener("submit", async e => {
    e.preventDefault();

    const piloto = document.getElementById("piloto").value.trim();
    const veiculo = document.getElementById("veiculo").value.trim();
    const link = document.getElementById("link").value.trim();
    const data = document.getElementById("data").value;
    const inicio = document.getElementById("inicio").value;
    const fim = document.getElementById("fim").value;
    const status = (statusSelect?.value || 'FINALIZADO').toUpperCase();

    const noDuration = isNonCounting(status);
    const duracao = status === 'ABERTO' || noDuration ? 0 : calculateDuration(data, inicio, fim);
    if (!piloto || !veiculo || !data || !inicio || (status !== 'ABERTO' && !noDuration && (!fim || duracao <= 0))) {
        notify("Preencha todos os campos e garanta que a duração seja positiva.", 'error');
        return;
    }

    try {
        if (drawerMode === 'finalize' && editingId) {
            const res = await authFetch(`/api/v1/protocolos/${editingId}/finalizar`, {
                method: "PUT",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fim, status })
            });
            if (!res.ok) {
                let errMsg = "Erro ao finalizar protocolo";
                try {
                    const data = await res.json();
                    errMsg = data?.error || data?.message || errMsg;
                } catch (_) { /* ignore parse error */ }
                throw new Error(errMsg);
            }
            await loadProtocols();
            form.reset();
            if (statusSelect) statusSelect.value = 'FINALIZADO';
            syncFimWithStatus();
            closeDrawerPanel();
            editingId = null;
            drawerMode = 'create';
            return;
        }

        const isEditing = Boolean(editingId);
        const url = isEditing ? `/api/v1/protocolos/${editingId}` : "/api/v1/protocolos";
        const method = isEditing ? "PUT" : "POST";

        const res = await authFetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ piloto, veiculo, link, data, inicio, fim: (status === 'ABERTO' || noDuration) ? null : (fim || null), status })
        });

        if (!res.ok) {
            let errMsg = "Erro ao salvar protocolo";
            try {
                const data = await res.json();
                errMsg = data?.error || data?.message || errMsg;
            } catch (_) { /* ignore parse error */ }
            throw new Error(errMsg);
        }

        await loadProtocols();
        form.reset();
        if (statusSelect) statusSelect.value = 'FINALIZADO';
        if (fimInput) fimInput.disabled = false;
        syncFimWithStatus();
        closeDrawerPanel();
        editingId = null;
        form.querySelector("button[type='submit']").textContent = "Adicionar Protocolo";
    } catch (err) {
        notify(err.message || "Falha ao salvar protocolo", 'error');
    }
});

document.addEventListener("click", async e => {
    const btn = e.target.closest(".action");
    if (!btn) return;
    if (!pilotCards || !pilotCards.contains(btn)) return;

    const id = btn.getAttribute("data-id");
    const action = btn.getAttribute("data-action");

    if (action === "delete") {
        const confirmed = await confirmDelete();
        if (!confirmed) return;
        try {
            const res = await authFetch(`/api/v1/protocolos/${id}`, {
                method: "DELETE"
            });
            if (!res.ok) {
                const { message } = await res.json();
                throw new Error(message || "Erro ao apagar");
            }
            await loadProtocols();
        } catch (err) {
            notify(err.message || "Falha ao apagar", 'error');
        }
    }

    if (action === "edit") {
        const current = protocols.find(p => String(p.id) === String(id));
        if (!current) return;
        editingId = id;
        drawerMode = 'edit';
        if (drawerTitle) drawerTitle.textContent = "Editar protocolo";
        pilotoSelect.value = current.piloto;
        veiculoSelect.value = current.veiculo;
        document.getElementById("link").value = current.link || "";
        document.getElementById("data").value = current.data;
        document.getElementById("inicio").value = current.inicio;
        fimInput.value = current.fim || "";
        if (statusSelect) statusSelect.value = (current.status || 'FINALIZADO').toUpperCase();
        syncFimWithStatus();
        const submitBtn = form.querySelector("button[type='submit']");
        if (submitBtn) submitBtn.textContent = "Salvar alterações";
        openDrawerPanel();
    }

    if (action === "finalizar") {
        const current = protocols.find(p => String(p.id) === String(id));
        if (!current) return;
        editingId = id;
        drawerMode = 'finalize';
        if (drawerTitle) drawerTitle.textContent = "Finalizar protocolo";
        pilotoSelect.value = current.piloto;
        veiculoSelect.value = current.veiculo;
        document.getElementById("link").value = current.link || "";
        document.getElementById("data").value = current.data;
        document.getElementById("inicio").value = current.inicio;
        fimInput.value = "";
        if (statusSelect) statusSelect.value = 'FINALIZADO';
        syncFimWithStatus();
        const submitBtn = form.querySelector("button[type='submit']");
        if (submitBtn) submitBtn.textContent = "Finalizar protocolo";
        openDrawerPanel();
    }
});

/* =========================
   INIT
========================= */

async function loadProtocols() {
    if (pilotCards) {
        pilotCards.innerHTML = `
          <div class="skeleton-card skeleton"></div>
          <div class="skeleton-card skeleton"></div>
        `;
    }
    try {
        protocols = await fetchProtocols();
        applyFilters();
        updateOpenBadge();
    } catch (err) {
        console.error(err);
        if (pilotCards) {
            pilotCards.innerHTML = `<div class="error-state"><strong>Erro ao carregar protocolos.</strong><div class="empty-actions"><button class="pill" onclick="location.reload()">Recarregar</button></div></div>`;
        }
        notify("Não foi possível carregar os protocolos.", 'error');
    }
}

function openDrawerPanel() {
    if (drawer) {
        drawer.classList.remove("hidden");
        document.body.classList.add('drawer-open');
    }
    drawerMode = drawerMode || 'create';
    if (drawerMode === 'create') {
        if (drawerTitle) drawerTitle.textContent = "Novo protocolo";
        const submitBtn = form?.querySelector("button[type='submit']");
        if (submitBtn) submitBtn.textContent = "Adicionar Protocolo";
    }
}

function closeDrawerPanel() {
    if (drawer) {
        drawer.classList.add("hidden");
        document.body.classList.remove('drawer-open');
    }
    drawerMode = 'create';
}

function openModal() {
    if (editModal) editModal.classList.remove("hidden");
}

function closeModal() {
    if (editModal) editModal.classList.add("hidden");
    editingId = null;
    currentEditingPiloto = "";
}

editClose?.addEventListener("click", closeModal);
editModal?.addEventListener("click", e => {
    if (e.target === editModal) closeModal();
});

function openFinalizeModal() {
    finalizeModal?.classList.remove("hidden");
}

function closeFinalizeModal() {
    finalizeModal?.classList.add("hidden");
    finalizingId = null;
    finalizingProtocol = null;
}

finalizeClose?.addEventListener("click", closeFinalizeModal);
finalizeModal?.addEventListener("click", e => {
    if (e.target === finalizeModal) closeFinalizeModal();
});

// Fechar drawer ao clicar fora
drawer?.addEventListener('click', e => {
    if (e.target === drawer) closeDrawerPanel();
});

// Escape para fechar drawer e modais
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        closeDrawerPanel();
        closeModal();
        closeFinalizeModal();
    }
});

editSave?.addEventListener("click", async () => {
    if (!editingId) return;
    const veiculo = editVeiculo.value.trim();
    const link = editLink.value.trim();
    const data = editData.value;
    const inicio = editInicio.value;
    const fim = editFim.value;

    const noDuration = isNonCounting(currentEditingStatus);
    const duracao = currentEditingStatus === 'ABERTO' || noDuration ? 0 : calculateDuration(data, inicio, fim);
    if (!veiculo || !data || !inicio || (currentEditingStatus !== 'ABERTO' && !noDuration && (!fim || duracao <= 0))) {
        notify("Preencha todos os campos e garanta que a duração seja positiva.", 'error');
        return;
    }

    try {
        const res = await authFetch(`/api/v1/protocolos/${editingId}`, {
            method: "PUT",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                piloto: currentEditingPiloto,
                veiculo,
                link,
                data,
                inicio,
                fim: (currentEditingStatus === 'ABERTO' || noDuration) ? null : fim,
                status: currentEditingStatus
            })
        });

        if (!res.ok) {
            let errMsg = "Erro ao salvar protocolo";
            try {
                const data = await res.json();
                errMsg = data?.error || data?.message || errMsg;
            } catch (_) { /* ignore parse error */ }
            throw new Error(errMsg);
        }

        await loadProtocols();
        closeModal();
    } catch (err) {
        notify(err.message || "Erro ao salvar protocolo", 'error');
    }
});

function buildCsv() {
    const list = filteredProtocols.length ? filteredProtocols : protocols;
    if (!list.length) return null;
    const header = ['id', 'piloto', 'veiculo', 'data', 'inicio', 'fim', 'duracao_segundos', 'status', 'link'];
    const rows = list.map(p => [
        p.id,
        p.piloto,
        p.veiculo,
        p.data,
        p.inicio,
        p.fim,
        p.duracao,
        p.status || 'FINALIZADO',
        p.link || ''
    ]);
    const csv = [header, ...rows].map(r => r.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    return csv;
}

exportCsvBtn?.addEventListener("click", () => {
    const csv = buildCsv();
    if (!csv) {
        notify("Não há dados para exportar.", 'info');
        return;
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'protocolos.csv';
    a.click();
    URL.revokeObjectURL(url);
});

function updateFinalizePreview() {
    if (!finalizingProtocol || !finalizeFim || !finalizePreview) return;
    const fimVal = finalizeFim.value;
    if (!fimVal) {
        finalizePreview.textContent = 'Duração: –';
        return;
    }
    const dur = calculateDuration(finalizingProtocol.data, finalizingProtocol.inicio, fimVal);
    if (Number.isNaN(dur) || dur <= 0) {
        finalizePreview.textContent = 'Duração inválida para este horário.';
        return;
    }
    finalizePreview.textContent = `Duração: ${formatDuration(dur)}`;
}

finalizeFim?.addEventListener("input", updateFinalizePreview);

finalizeConfirm?.addEventListener("click", async () => {
    if (!finalizingId || !finalizingProtocol) return;
    const fimVal = finalizeFim.value;
    if (!fimVal || !/^\d{2}:\d{2}$/.test(fimVal)) {
        notify("Informe o horário de fim no formato HH:MM.", 'error');
        return;
    }
    const dur = calculateDuration(finalizingProtocol.data, finalizingProtocol.inicio, fimVal);
    if (Number.isNaN(dur) || dur <= 0) {
        notify("Duração inválida para este horário.", 'error');
        return;
    }
    try {
        const res = await authFetch(`/api/v1/protocolos/${finalizingId}/finalizar`, {
            method: "PUT",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fim: fimVal })
        });
        if (!res.ok) {
            let errMsg = "Erro ao finalizar";
            try {
                const data = await res.json();
                errMsg = data?.error || data?.message || errMsg;
            } catch (_) { /* ignore parse error */ }
            throw new Error(errMsg);
        }
        await loadProtocols();
        closeFinalizeModal();
    } catch (err) {
        notify(err.message || "Erro ao finalizar", 'error');
    }
});

openDrawerBtn?.addEventListener("click", () => {
    drawerMode = 'create';
    form?.reset();
    if (statusSelect) statusSelect.value = 'FINALIZADO';
    syncFimWithStatus();
    openDrawerPanel();
});
drawerClose?.addEventListener("click", closeDrawerPanel);
drawer?.addEventListener("click", e => {
    if (e.target === drawer) closeDrawerPanel();
});

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

    try {
        const [pilotos, veiculos] = await Promise.all([fetchPilotos(), fetchVeiculos()]);
        renderPilotos(pilotos);
        renderVeiculos(veiculos);
        restoreFilters();
        await loadProtocols();
        syncFimWithStatus();
    } catch (err) {
        console.error(err);
        notify("Não foi possível iniciar a aplicação.", 'error');
    }
}

init();
