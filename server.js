require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const Database = require('better-sqlite3');
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'data');

// Enable CORS para aceitar requisições de outras portas durante desenvolvimento
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});
const DB_PATH = path.join(DATA_DIR, 'dbm.sqlite');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Discord Bot Security Configuration
const ADMIN_IDS = ['1324784566854221895', '554409578486431794']; // Richard e Breno
const DISCORD_CLIENT = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});
const CHANNEL_IDS = {
    hierarquia: '1368980963752939661',
    chatDBM: '1368981004219453641'
};

const ONLY_VEHICLE = 'Yamara Tenere';
const migrations = `
CREATE TABLE IF NOT EXISTS pilotos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS veiculos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS protocolos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    piloto TEXT NOT NULL,
    veiculo TEXT NOT NULL,
    link TEXT,
    data TEXT NOT NULL,
    inicio TEXT NOT NULL,
    fim TEXT NOT NULL,
    duracao INTEGER NOT NULL,
    status_id INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

db.exec(migrations);

// tabela de auditoria e índices
db.exec(`
CREATE TABLE IF NOT EXISTS protocolos_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    protocolo_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    actor TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    payload TEXT
);

CREATE INDEX IF NOT EXISTS idx_protocolos_data ON protocolos(data);
CREATE INDEX IF NOT EXISTS idx_protocolos_status ON protocolos(status_id);
`);

function ensureColumn(table, column, ddl) {
    const exists = db.prepare(`PRAGMA table_info(${table})`).all().some(r => r.name === column);
    if (!exists) db.exec(ddl);
}

ensureColumn('pilotos', 'cor', "ALTER TABLE pilotos ADD COLUMN cor TEXT");
ensureColumn('protocolos', 'link', "ALTER TABLE protocolos ADD COLUMN link TEXT");
ensureColumn('protocolos', 'status_id', "ALTER TABLE protocolos ADD COLUMN status_id INTEGER NOT NULL DEFAULT 1");

// status seeds
const defaultStatuses = ['ABERTO', 'FINALIZADO', 'ADVERTENCIA', 'NAO PARTICIPANDO', 'INATIVO'];
const insertStatus = db.prepare('INSERT OR IGNORE INTO status (nome) VALUES (?)');
const seedStatuses = db.transaction(statuses => {
    for (const nome of statuses) insertStatus.run(nome);
});
seedStatuses(defaultStatuses);

const getStatusId = nome => {
    const row = db.prepare('SELECT id FROM status WHERE nome = ?').get(nome);
    if (!row) throw new Error('Status não encontrado');
    return row.id;
};

const STATUS_ABERTO = getStatusId('ABERTO');
const STATUS_FINALIZADO = getStatusId('FINALIZADO');
const STATUS_ADVERTENCIA = getStatusId('ADVERTENCIA');
const STATUS_NAO_PARTICIPANDO = getStatusId('NAO PARTICIPANDO');
const STATUS_INATIVO = getStatusId('INATIVO');
const STATUS_NO_DURATION = new Set([
    STATUS_ADVERTENCIA,
    STATUS_NAO_PARTICIPANDO,
    STATUS_INATIVO
]);

// atribui status finalizado a registros antigos sem status ou com duração já calculada
db.prepare('UPDATE protocolos SET status_id = ? WHERE status_id IS NULL OR duracao > 0').run(STATUS_FINALIZADO);

const defaultPilots = [
    { nome: 'Alfa', cor: '#6b7280' },
    { nome: 'Bravo', cor: '#2563eb' },
    { nome: 'Charlie', cor: '#16a34a' },
    { nome: 'Delta', cor: '#d97706' },
    { nome: 'Echo', cor: '#dc2626' }
];

const defaultVehicles = [ONLY_VEHICLE];

const pilotCount = db.prepare('SELECT COUNT(1) as total FROM pilotos').get().total;
if (pilotCount === 0) {
    const insertPilot = db.prepare('INSERT INTO pilotos (nome, cor) VALUES (?, ?)');
    const insertMany = db.transaction(items => {
        for (const { nome, cor } of items) insertPilot.run(nome, cor);
    });
    insertMany(defaultPilots);

    // importa da tabela membros_dbm se existir
    const hasMembros = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='membros_dbm'").get();
    if (hasMembros) {
        const nomes = db.prepare('SELECT nome FROM membros_dbm').all();
        const insertExtra = db.prepare('INSERT OR IGNORE INTO pilotos (nome, cor) VALUES (?, ?)');
        const importTx = db.transaction(rows => {
            for (const { nome } of rows) insertExtra.run(nome, '#6b7280');
        });
        importTx(nomes);
    }
}

// garante tabela de veiculos com apenas o veículo usado
const cleanVehicles = db.prepare('DELETE FROM veiculos WHERE nome != ?');
cleanVehicles.run(ONLY_VEHICLE);
const vehicleExists = db.prepare('SELECT COUNT(1) as total FROM veiculos WHERE nome = ?').get(ONLY_VEHICLE).total;
if (vehicleExists === 0) {
    const insertVehicle = db.prepare('INSERT INTO veiculos (nome) VALUES (?)');
    insertVehicle.run(ONLY_VEHICLE);
}

app.use(express.json());

// Endpoint de teste de saúde
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const api = express.Router();

function calculateDuration(date, start, end) {
    const startTime = new Date(`${date}T${start}`);
    let endTime = new Date(`${date}T${end}`);
    if (endTime < startTime) {
        endTime.setDate(endTime.getDate() + 1);
    }
    return Math.floor((endTime - startTime) / 1000);
}

class ApiError extends Error {
    constructor(status = 500, message = 'Erro interno', code = 'INTERNAL_ERROR') {
        super(message);
        this.status = status;
        this.code = code;
    }
}

function audit(protocoloId, action, payload = {}, actor = 'api') {
    try {
        const insertAudit = db.prepare(
            'INSERT INTO protocolos_audit (protocolo_id, action, actor, payload) VALUES (?, ?, ?, ?)'
        );
        insertAudit.run(protocoloId, action, actor, JSON.stringify(payload));
    } catch (err) {
        console.error('Falha ao gravar auditoria', err.message);
    }
}

const OPEN_ALERT_HOURS = Number(process.env.OPEN_ALERT_HOURS || 6);
const AUTO_ADVERTENCIA = String(process.env.AUTO_ADVERTENCIA || 'false').toLowerCase() === 'true';

function checkOpenProtocols() {
    const openProtocols = db.prepare(
        `SELECT p.id, p.data, p.inicio, p.piloto, p.veiculo, p.status_id, s.nome as status
         FROM protocolos p
         LEFT JOIN status s ON s.id = p.status_id
         WHERE p.status_id = ?`
    ).all(STATUS_ABERTO);

    const now = Date.now();
    const cutoffMs = OPEN_ALERT_HOURS * 60 * 60 * 1000;

    openProtocols.forEach(p => {
        const start = new Date(`${p.data}T${p.inicio}`);
        const diff = now - start.getTime();
        if (Number.isNaN(diff) || diff < 0) return;
        if (diff >= cutoffMs) {
            console.warn(`[ALERTA] Protocolo aberto há ${Math.round(diff / 3600000)}h: #${p.id} ${p.piloto}`);
            if (AUTO_ADVERTENCIA) {
                db.prepare('UPDATE protocolos SET status_id = ?, duracao = 0 WHERE id = ?').run(STATUS_ADVERTENCIA, p.id);
                audit(p.id, 'auto_advertencia', { motivo: 'tempo excedido', horas: OPEN_ALERT_HOURS }, 'system');
            }
        }
    });
}

setInterval(checkOpenProtocols, 10 * 60 * 1000);

// Função assíncrona para enviar mensagens de boas-vindas automáticas
async function sendWelcomeMessage(userId, username, roleType = 'elite') {
    try {
        if (!DISCORD_CLIENT.isReady()) return;
        const channel = await DISCORD_CLIENT.channels.fetch(CHANNEL_IDS.chatDBM);
        if (channel.type !== ChannelType.GuildText) return;
        
        const message = `🎖️ **BEM-VINDO À EQUIPE!** Parabéns por integrar o corpo de patrulha do DBM!\n\n<@${userId}> foi promovido(a) para a equipe de ${roleType === 'elite' ? 'Elite' : 'Equipe'}.`;
        await channel.send(message);
    } catch (err) {
        console.error('Erro ao enviar mensagem de boas-vindas:', err.message);
    }
}

// ===== REQUIRE AUTENTICAÇÃO =====
const auth = require('./auth');

// Função auxiliar para middleware de autenticação para rotas importantes
function requireAuth(req, res, next) {
    auth.authMiddleware(req, res, next);
}

// Função auxiliar para middleware de admin
function requireAdmin(req, res, next) {
    auth.adminMiddleware(req, res, next);
}

api.get('/pilotos', (req, res) => {
    const pilotos = db.prepare('SELECT id, nome, cor FROM pilotos ORDER BY nome ASC').all();
    res.json(pilotos);
});

api.get('/veiculos', (req, res) => {
    const veiculos = db.prepare('SELECT id, nome FROM veiculos ORDER BY nome ASC').all();
    res.json(veiculos);
});

api.get('/protocolos', (req, res) => {
    const protocolos = db.prepare(
        `SELECT p.id, p.piloto, p.veiculo, p.link, p.data, p.inicio, p.fim, p.duracao, p.status_id, s.nome as status, p.created_at
         FROM protocolos p
         LEFT JOIN status s ON s.id = p.status_id
         ORDER BY p.id DESC`
    ).all();
    res.json(protocolos);
});

api.get('/status', (req, res) => {
    const statuses = db.prepare('SELECT id, nome FROM status ORDER BY id ASC').all();
    res.json(statuses);
});

api.put('/protocolos/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    const { piloto, veiculo, data, inicio, fim, link, status } = req.body || {};

    const existing = db.prepare('SELECT * FROM protocolos WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ message: 'Registro não encontrado.' });

    if (!piloto || !veiculo || !data || !inicio) {
        return res.status(400).json({ message: 'Campos obrigatórios ausentes.' });
    }

    if (veiculo !== ONLY_VEHICLE) {
        return res.status(400).json({ message: `Veículo inválido. Use ${ONLY_VEHICLE}.` });
    }

    const statusId = status ? getStatusId(status) : db.prepare('SELECT status_id FROM protocolos WHERE id = ?').get(id)?.status_id;
    const isAberto = statusId === STATUS_ABERTO;
    const isNoDuration = STATUS_NO_DURATION.has(statusId);
    if (!isAberto && !isNoDuration && !fim) {
        return res.status(400).json({ message: 'Fim é obrigatório para protocolos finalizados.' });
    }

    const fimValue = fim || inicio;
    const duracao = isAberto || isNoDuration ? 0 : calculateDuration(data, inicio, fimValue);
    if (!isAberto && !isNoDuration && (Number.isNaN(duracao) || duracao <= 0)) {
        return res.status(400).json({ message: 'Duração inválida.' });
    }

    const update = db.prepare(
        'UPDATE protocolos SET piloto = ?, veiculo = ?, link = ?, data = ?, inicio = ?, fim = ?, duracao = ?, status_id = ? WHERE id = ?'
    );

    update.run(piloto, veiculo, link || null, data, inicio, fimValue, duracao, statusId || STATUS_FINALIZADO, id);

    const updated = db.prepare(
        `SELECT p.id, p.piloto, p.veiculo, p.link, p.data, p.inicio, p.fim, p.duracao, p.status_id, s.nome as status, p.created_at
         FROM protocolos p LEFT JOIN status s ON s.id = p.status_id WHERE p.id = ?`
    ).get(id);

    audit(id, 'update', updated, 'api');

    res.json(updated);
});

api.post('/protocolos', (req, res) => {
    const { piloto, veiculo, data, inicio, fim, link, status } = req.body || {};

    if (!piloto || !veiculo || !data || !inicio) {
        return res.status(400).json({ message: 'Campos obrigatórios ausentes.' });
    }

    if (veiculo !== ONLY_VEHICLE) {
        return res.status(400).json({ message: `Veículo inválido. Use ${ONLY_VEHICLE}.` });
    }

    const statusId = status ? getStatusId(status) : STATUS_FINALIZADO;
    const isAberto = statusId === STATUS_ABERTO;
    const isNoDuration = STATUS_NO_DURATION.has(statusId);

    let fimValue = fim || inicio;
    let duracao = 0;

    if (!isAberto && !isNoDuration && !fim) {
        return res.status(400).json({ message: 'Fim é obrigatório para protocolos finalizados.' });
    }
    if (!isAberto && !isNoDuration) {
        duracao = calculateDuration(data, inicio, fimValue);
        if (Number.isNaN(duracao) || duracao <= 0) {
            return res.status(400).json({ message: 'Duração inválida.' });
        }
    }

    const insert = db.prepare(
        'INSERT INTO protocolos (piloto, veiculo, link, data, inicio, fim, duracao, status_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );

    const info = insert.run(piloto, veiculo, link || null, data, inicio, fimValue, duracao, statusId);
    const created = db.prepare(
        `SELECT p.id, p.piloto, p.veiculo, p.link, p.data, p.inicio, p.fim, p.duracao, p.status_id, s.nome as status, p.created_at
         FROM protocolos p LEFT JOIN status s ON s.id = p.status_id WHERE p.id = ?`
    ).get(info.lastInsertRowid);

    audit(created.id, 'create', created, 'api');

    res.status(201).json(created);
});

api.delete('/protocolos/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    const del = db.prepare('DELETE FROM protocolos WHERE id = ?').run(id);
    if (del.changes === 0) return res.status(404).json({ message: 'Registro não encontrado.' });
    audit(id, 'delete', {}, 'api');
    res.json({ message: 'Registro removido.' });
});

api.put('/protocolos/:id/finalizar', (req, res) => {
    const { id } = req.params;
    const { fim, status } = req.body || {};

    const current = db.prepare('SELECT * FROM protocolos WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ message: 'Registro não encontrado.' });

    const statusId = status ? getStatusId(status) : STATUS_FINALIZADO;
    const isNoDuration = STATUS_NO_DURATION.has(statusId);
    const fimValue = fim || current.inicio;

    if (!fim && !isNoDuration) {
        return res.status(400).json({ message: 'Horário de finalização é obrigatório.' });
    }

    const duracao = isNoDuration ? 0 : calculateDuration(current.data, current.inicio, fimValue);
    if (!isNoDuration && (Number.isNaN(duracao) || duracao <= 0)) {
        return res.status(400).json({ message: 'Duração inválida.' });
    }

    const update = db.prepare('UPDATE protocolos SET fim = ?, duracao = ?, status_id = ? WHERE id = ?');
    update.run(fimValue, duracao, statusId, id);

    const updated = db.prepare(
        `SELECT p.id, p.piloto, p.veiculo, p.link, p.data, p.inicio, p.fim, p.duracao, p.status_id, s.nome as status, p.created_at
         FROM protocolos p LEFT JOIN status s ON s.id = p.status_id WHERE p.id = ?`
    ).get(id);

    audit(id, 'finalizar', { fim, duracao, status: status || 'FINALIZADO' }, 'api');

    res.json(updated);
});

// ===== AUTENTICAÇÃO =====

// Endpoint de login via Discord
api.post('/login', (req, res) => {
    const { discordId, username, avatar } = req.body;

    if (!discordId) {
        return res.status(400).json({ error: 'Discord ID é obrigatório' });
    }

    // Criar objeto de usuário
    const user = {
        id: discordId,
        username: username || 'Unknown',
        avatar: avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'
    };

    // Gerar token JWT
    const token = auth.generateToken(user);

    res.json({
        message: 'Login realizado com sucesso',
        token,
        user: {
            id: user.id,
            username: user.username,
            role: auth.getUserRole(user.id),
            isAdmin: auth.ADMIN_IDS.includes(user.id)
        }
    });
});

// Endpoint de logout
api.post('/logout', auth.authMiddleware, (req, res) => {
    res.json({ message: 'Logout realizado com sucesso' });
});

// Endpoint para verificar autenticação e obter dados do usuário
api.get('/me', auth.authMiddleware, (req, res) => {
    res.json({
        user: {
            id: req.user.id,
            username: req.user.username,
            role: req.user.role,
            isAdmin: req.user.role === auth.ROLES.ADMIN
        }
    });
});

// Endpoint protegido - apenas admins podem acessar
api.get('/admin/status', auth.adminMiddleware, (req, res) => {
    const stats = {
        totalProtocolos: db.prepare('SELECT COUNT(*) as count FROM protocolos').get().count,
        protocolosAbertos: db.prepare('SELECT COUNT(*) as count FROM protocolos WHERE status_id = ?').get(STATUS_ABERTO).count,
        totalPilotos: db.prepare('SELECT COUNT(*) as count FROM pilotos').get().count,
        ultimasAcoes: db.prepare(`
            SELECT action, actor, created_at FROM protocolos_audit 
            ORDER BY created_at DESC LIMIT 10
        `).all()
    };
    res.json(stats);
});

api.use((req, res) => {
    res.status(404).json({ error: 'Not found', path: req.originalUrl });
});

app.use('/api/v1', api);
app.use('/api', api);

// Servir arquivos estáticos DEPOIS das rotas de API
app.use(express.static(__dirname));

// middleware de erros centralizado
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    const status = err.status || 500;
    const code = err.code || 'INTERNAL_ERROR';
    const message = err.message || 'Erro interno';
    console.error('API error', { status, code, message });
    res.status(status).json({ error: message, code });
});

// Inicializar cliente Discord
DISCORD_CLIENT.once('ready', () => {
    console.log(`🤖 Bot Discord conectado como ${DISCORD_CLIENT.user.tag}`);
});

DISCORD_CLIENT.on('error', err => {
    console.error('Erro no cliente Discord:', err.message);
});

// ⚠️ ATENÇÃO: Insira o token do bot Discord via variável de ambiente DISCORD_TOKEN
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
if (DISCORD_TOKEN && DISCORD_TOKEN !== '') {
    DISCORD_CLIENT.login(DISCORD_TOKEN).catch(err => {
        console.error('Falha ao conectar Discord bot:', err.message);
    });
} else {
    console.warn('⚠️  Bot Discord desativado: nenhum token configurado. Defina a variável de ambiente DISCORD_TOKEN.');
}

// Inicializar sincronizador de protocolos do outro bot
const { initializeSync } = require('./discordSync');
initializeSync();

app.listen(PORT, () => {
    console.log(`DBM backend rodando em http://localhost:${PORT}`);
});