const FALLBACK_IMAGE = "assets/imgs/Banner.png";

const fleetData = [
    {
        id: "tenere-01",
        nome: "Yamaha Ténéré 700",
        tipo: "moto",
        status: "disponivel",
        base: "central",
        alcance: "Alta",
        autonomiaKm: 350,
        imagem: "assets/imgs/YamahaTenere.png",
        equipamentos: ["Kit APH", "GPS tático", "Câmera on-board"],
        requisitos: ["Licença A", "Treinamento off-road", "Ficha médica ok"],
        observacoes: "Indicada para missões rápidas em terreno misto.",
    },
    {
        id: "resgate-02",
        nome: "Resgate 4x4",
        tipo: "viatura",
        status: "em_missao",
        base: "zona_sul",
        alcance: "Médio",
        autonomiaKm: 500,
        imagem: "assets/imgs/Banner.png",
        equipamentos: ["Desfibrilador", "Oxigênio", "Macas"],
        requisitos: ["CNH D", "Curso APH avançado"],
        observacoes: "Suporte avançado e transporte de vítimas.",
    },
    {
        id: "apoio-01",
        nome: "Van Apoio",
        tipo: "apoio",
        status: "manutencao",
        base: "zona_norte",
        alcance: "Baixo",
        autonomiaKm: 420,
        imagem: "assets/imgs/Banner.png",
        equipamentos: ["Ferramental", "Kit comunicação", "Peças reposição"],
        requisitos: ["CNH B", "Checklist diário"],
        observacoes: "Mobilização rápida para suporte logístico.",
    },
];

const state = {
    filters: {
        busca: "",
        tipo: "",
        status: "",
        base: "",
    },
    filtered: [],
    loading: true,
    error: null,
};

const el = (id) => document.getElementById(id);

const imageFallback = (img) => {
    img.onerror = () => {
        img.onerror = null;
        img.src = FALLBACK_IMAGE;
    };
};

function badgeClass(status) {
    if (status === "disponivel") return "badge success";
    if (status === "em_missao") return "badge warn";
    return "badge error";
}

function statusLabel(status) {
    if (status === "disponivel") return "Disponível";
    if (status === "em_missao") return "Em missão";
    return "Manutenção";
}

function typeLabel(tipo) {
    if (tipo === "moto") return "Moto";
    if (tipo === "viatura") return "Viatura";
    return "Apoio";
}

function applyFilters() {
    const { busca, tipo, status, base } = state.filters;
    const term = busca.trim().toLowerCase();

    state.filtered = fleetData.filter((item) => {
        const matchesTerm = term
            ? [item.nome, item.tipo, item.base, ...(item.equipamentos || [])]
                .join(" ")
                .toLowerCase()
                .includes(term)
            : true;

        const matchesTipo = tipo ? item.tipo === tipo : true;
        const matchesStatus = status ? item.status === status : true;
        const matchesBase = base ? item.base === base : true;

        return matchesTerm && matchesTipo && matchesStatus && matchesBase;
    });

    renderGrid();
    renderActiveFilters();
}

function renderActiveFilters() {
    const container = el("fleetActiveFilters");
    container.innerHTML = "";

    const chips = [];
    if (state.filters.busca) chips.push(labelChip("Busca", state.filters.busca, "busca"));
    if (state.filters.tipo) chips.push(labelChip("Tipo", typeLabel(state.filters.tipo), "tipo"));
    if (state.filters.status) chips.push(labelChip("Status", statusLabel(state.filters.status), "status"));
    if (state.filters.base) chips.push(labelChip("Base", baseLabel(state.filters.base), "base"));

    if (!chips.length) {
        container.innerHTML = '<span class="muted">Nenhum filtro ativo</span>';
        return;
    }

    chips.forEach((chip) => container.appendChild(chip));
}

function labelChip(label, value, key) {
    const chip = document.createElement("button");
    chip.className = "chip removable";
    chip.type = "button";
    chip.innerHTML = `<strong>${label}:</strong> ${value} ×`;
    chip.addEventListener("click", () => {
        state.filters[key] = "";
        syncFiltersFromState();
        applyFilters();
    });
    return chip;
}

function baseLabel(base) {
    if (base === "central") return "Central";
    if (base === "zona_sul") return "Zona Sul";
    return "Zona Norte";
}

function renderGrid() {
    const grid = el("fleetGrid");
    grid.innerHTML = "";

    if (state.loading) {
        renderSkeleton(grid);
        el("fleetTotal").textContent = "–";
        return;
    }

    if (state.error) {
        renderError(grid, state.error);
        el("fleetTotal").textContent = "0";
        return;
    }

    if (!state.filtered.length) {
        renderEmpty(grid);
        el("fleetTotal").textContent = "0";
        return;
    }

    state.filtered.forEach((item) => {
        const card = document.createElement("article");
        card.className = "fleet-card";

        const header = document.createElement("div");
        header.className = "fleet-header";
        header.innerHTML = `<div class="fleet-title">
                <p class="eyebrow small">${typeLabel(item.tipo)}</p>
                <h3>${item.nome}</h3>
            </div>
            <span class="badge ${badgeClass(item.status)}">${statusLabel(item.status)}</span>`;

        const media = document.createElement("div");
        media.className = "fleet-media";
        const img = document.createElement("img");
        img.src = item.imagem || FALLBACK_IMAGE;
        img.alt = `Imagem de ${item.nome}`;
        img.loading = "lazy";
        imageFallback(img);
        media.appendChild(img);

        const body = document.createElement("div");
        body.className = "fleet-body";
        body.innerHTML = `<p class="muted">Base: ${baseLabel(item.base)} • Alcance: ${item.alcance} • Autonomia: ${item.autonomiaKm} km</p>`;

        const tags = document.createElement("div");
        tags.className = "fleet-tags";
        tags.innerHTML = `<h4>Equipamentos</h4>`;
        const eq = document.createElement("div");
        eq.className = "chips";
        item.equipamentos.forEach((e) => {
            const chip = document.createElement("span");
            chip.className = "chip";
            chip.textContent = e;
            eq.appendChild(chip);
        });
        tags.appendChild(eq);

        const reqWrap = document.createElement("div");
        reqWrap.className = "fleet-tags";
        reqWrap.innerHTML = `<h4>Requisitos</h4>`;
        const req = document.createElement("div");
        req.className = "chips";
        item.requisitos.forEach((r) => {
            const chip = document.createElement("span");
            chip.className = "chip";
            chip.textContent = r;
            req.appendChild(chip);
        });
        reqWrap.appendChild(req);

        const cardActions = document.createElement("div");
        cardActions.className = "card-actions";
        const detailsBtn = document.createElement("button");
        detailsBtn.className = "action ghost";
        detailsBtn.textContent = "Detalhes";
        detailsBtn.addEventListener("click", () => openDrawer(item));

        const selectBtn = document.createElement("button");
        selectBtn.className = "action primary";
        selectBtn.textContent = "Reservar";
        selectBtn.addEventListener("click", () => alert(`Reservado: ${item.nome}`));

        cardActions.append(detailsBtn, selectBtn);

        card.append(header, media, body, tags, reqWrap, cardActions);
        grid.appendChild(card);
    });

    el("fleetTotal").textContent = state.filtered.length;
}

function renderSkeleton(grid) {
    const skeletons = Array.from({ length: 6 }).map(() => {
        const s = document.createElement("div");
        s.className = "skeleton-card";
        s.innerHTML = `
            <div class="skeleton-line tiny"></div>
            <div class="skeleton-line short"></div>
            <div class="skeleton-media"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line short"></div>
        `;
        return s;
    });
    skeletons.forEach((s) => grid.appendChild(s));
}

function renderEmpty(grid) {
    const block = document.createElement("div");
    block.className = "state-block";
    block.innerHTML = `
        <h3>Nenhum veículo encontrado</h3>
        <p class="muted">Ajuste os filtros ou limpe para ver toda a frota.</p>
        <button class="pill" type="button" id="resetFleetFilters">Limpar filtros</button>
    `;
    grid.appendChild(block);
    const reset = block.querySelector("#resetFleetFilters");
    reset.addEventListener("click", clearFilters);
}

function renderError(grid, message) {
    const block = document.createElement("div");
    block.className = "state-block";
    block.innerHTML = `
        <h3>Erro ao carregar</h3>
        <p class="muted">${message}</p>
        <button class="pill" type="button" id="retryFleet">Tentar novamente</button>
    `;
    grid.appendChild(block);
    block.querySelector("#retryFleet").addEventListener("click", () => loadFleet());
}

function syncStateFromInputs(prefix = "fleet") {
    state.filters.busca = el(`${prefix}Busca`).value;
    state.filters.tipo = el(`${prefix}Tipo`).value;
    state.filters.status = el(`${prefix}Status`).value;
    state.filters.base = el(`${prefix}Base`).value;
}

function syncFiltersFromState() {
    ["fleet", "sheet"].forEach((prefix) => {
        el(`${prefix}Busca`).value = state.filters.busca;
        el(`${prefix}Tipo`).value = state.filters.tipo;
        el(`${prefix}Status`).value = state.filters.status;
        el(`${prefix}Base`).value = state.filters.base;
    });
}

function clearFilters() {
    state.filters = { busca: "", tipo: "", status: "", base: "" };
    syncFiltersFromState();
    applyFilters();
}

function openDrawer(item) {
    el("fleetDrawer").classList.remove("hidden");
    el("drawerTitle").textContent = item.nome;
    const body = el("drawerBody");
    body.innerHTML = `
        <div class="fleet-media"><img src="${item.imagem || FALLBACK_IMAGE}" alt="Imagem de ${item.nome}" loading="lazy" /></div>
        <p class="muted">${statusLabel(item.status)} • ${typeLabel(item.tipo)} • ${baseLabel(item.base)}</p>
    <p>${item.observacoes || ""}</p>
    <div>
      <p class="eyebrow small">Equipamentos</p>
      <div class="chips">${item.equipamentos.map((e) => `<span class="chip">${e}</span>`).join("")}</div>
    </div>
    <div>
      <p class="eyebrow small">Requisitos</p>
      <div class="chips">${item.requisitos.map((r) => `<span class="chip">${r}</span>`).join("")}</div>
    </div>
  `;
    const img = body.querySelector("img");
    if (img) imageFallback(img);
}

function closeDrawer() {
    el("fleetDrawer").classList.add("hidden");
}

function initFilters() {
    el("fleetApply").addEventListener("click", () => {
        syncStateFromInputs("fleet");
        applyFilters();
    });
    el("fleetClear").addEventListener("click", clearFilters);
    el("openFilters").addEventListener("click", openSheet);

    el("sheetApply").addEventListener("click", () => {
        syncStateFromInputs("sheet");
        applyFilters();
        closeSheet();
    });

    el("sheetClose").addEventListener("click", closeSheet);
}

function openSheet() {
    el("fleetFiltersBackdrop").classList.add("visible");
    el("fleetFiltersSheet").classList.add("open");
}

function closeSheet() {
    el("fleetFiltersBackdrop").classList.remove("visible");
    el("fleetFiltersSheet").classList.remove("open");
}

function wireGlobal() {
    el("fleetFiltersBackdrop").addEventListener("click", closeSheet);
    el("drawerClose").addEventListener("click", closeDrawer);
}

function loadFleet() {
    state.loading = true;
    state.error = null;
    renderGrid();

    // Simula carregamento; substituir por fetch real quando a API estiver pronta.
    setTimeout(() => {
        try {
            applyFilters();
            state.loading = false;
            renderGrid();
        } catch (err) {
            state.loading = false;
            state.error = "Não foi possível carregar a frota.";
            renderGrid();
        }
    }, 200);
}

function init() {
    initFilters();
    wireGlobal();
    syncFiltersFromState();
    loadFleet();
}

document.addEventListener("DOMContentLoaded", init);
