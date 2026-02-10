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
];

const state = {
    filters: {
        busca: "",
        tipo: "",
        status: "",
        base: "",
    },
    filtered: fleetData,
};

const el = (id) => document.getElementById(id);

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

    state.filtered.forEach((item) => {
        const card = document.createElement("article");
        card.className = "fleet-card";

        const cover = document.createElement("div");
        cover.className = "fleet-cover";
        cover.style.backgroundImage = `url(${item.imagem})`;

        const meta = document.createElement("div");
        meta.className = "fleet-meta";
        meta.innerHTML = `<div>
        <p class="eyebrow small">${typeLabel(item.tipo)}</p>
        <h3>${item.nome}</h3>
      </div>
      <span class="badge ${badgeClass(item.status)}">${statusLabel(item.status)}</span>`;

        const body = document.createElement("div");
        body.className = "fleet-body";
        body.innerHTML = `<p class="muted">Alcance: ${item.alcance} • Autonomia: ${item.autonomiaKm} km</p>`;

        const eq = document.createElement("div");
        eq.className = "chips";
        item.equipamentos.forEach((e) => {
            const chip = document.createElement("span");
            chip.className = "chip";
            chip.textContent = e;
            eq.appendChild(chip);
        });

        const cardActions = document.createElement("div");
        cardActions.className = "card-actions";
        const detailsBtn = document.createElement("button");
        detailsBtn.className = "action ghost";
        detailsBtn.textContent = "Detalhes";
        detailsBtn.addEventListener("click", () => openDrawer(item));

        const selectBtn = document.createElement("button");
        selectBtn.className = "action";
        selectBtn.textContent = "Reservar";
        selectBtn.addEventListener("click", () => alert(`Reservado: ${item.nome}`));

        cardActions.append(detailsBtn, selectBtn);

        card.append(cover, meta, body, eq, cardActions);
        grid.appendChild(card);
    });

    el("fleetTotal").textContent = state.filtered.length;
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
    <div class="fleet-cover" style="background-image: url(${item.imagem})"></div>
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

function init() {
    initFilters();
    wireGlobal();
    syncFiltersFromState();
    applyFilters();
}

document.addEventListener("DOMContentLoaded", init);
