const rankingList = document.getElementById("rankingList");

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

function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
}

function renderRanking(protocols, pilotColors) {
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

    sorted.forEach(([name, seconds]) => {
        const color = pilotColors[name] || "#4b5563";
        const li = document.createElement("li");
        li.innerHTML = `<span class="pilot-badge" style="background:${color}">${name}</span> — ${formatDuration(seconds)}`;
        rankingList.appendChild(li);
    });
}

async function init() {
    try {
        const [pilotos, protocols] = await Promise.all([fetchPilotos(), fetchProtocols()]);
        const pilotColors = pilotos.reduce((acc, { nome, cor }) => {
            acc[nome] = cor || "#6b7280";
            return acc;
        }, {});
        renderRanking(protocols, pilotColors);
    } catch (err) {
        console.error(err);
        alert("Não foi possível carregar o ranking.");
    }
}

init();
