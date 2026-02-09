require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const Database = require('better-sqlite3');
const axios = require('axios'); // Para o OAuth2
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const auth = require('./auth');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const DB_PATH = path.join(DATA_DIR, 'dbm.sqlite');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Discord Bot Security Configuration
const DISCORD_CLIENT = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});
const CHANNEL_IDS = {
    hierarquia: '1368980963752939661',
    chatDBM: '1368981004219453641'
};

const ONLY_VEHICLE = 'Yamara Tenere';

// --- MANUTENÇÃO DAS MIGRAÇÕES ORIGINAIS DO BRENO ---
const migrations = `
CREATE TABLE IF NOT EXISTS pilotos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    cor TEXT
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
`;

db.exec(migrations);

function ensureColumn(table, column, ddl) {
    const exists = db.prepare(`PRAGMA table_info(${table})`).all().some(r => r.name === column);
    if (!exists) db.exec(ddl);
}

ensureColumn('pilotos', 'cor', "ALTER TABLE pilotos ADD COLUMN cor TEXT");
ensureColumn('protocolos', 'link', "ALTER TABLE protocolos ADD COLUMN link TEXT");
ensureColumn('protocolos', 'status_id', "ALTER TABLE protocolos ADD COLUMN status_id INTEGER NOT NULL DEFAULT 1");

// Status seeds
const defaultStatuses = ['ABERTO', 'FINALIZADO', 'ADVERTENCIA', 'NAO PARTICIPANDO', 'INATIVO'];
const insertStatus = db.prepare('INSERT OR IGNORE INTO status (nome) VALUES (?)');
defaultStatuses.forEach(nome => insertStatus.run(nome));

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
const STATUS_NO_DURATION = new Set([STATUS_ADVERTENCIA, STATUS_NAO_PARTICIPANDO, STATUS_INATIVO]);

// Garante veículo único
db.prepare('DELETE FROM veiculos WHERE nome != ?').run(ONLY_VEHICLE);
if (db.prepare('SELECT COUNT(1) as total FROM veiculos WHERE nome = ?').get(ONLY_VEHICLE).total === 0) {
    db.prepare('INSERT INTO veiculos (nome) VALUES (?)').run(ONLY_VEHICLE);
}

app.use(express.json());
const api = express.Router();

// --- FUNÇÕES DE LÓGICA DO BRENO ---
function calculateDuration(date, start, end) {
    const startTime = new Date(`${date}T${start}`);
    let endTime = new Date(`${date}T${end}`);
    if (endTime < startTime) endTime.setDate(endTime.getDate() + 1);
    return Math.floor((endTime - startTime) / 1000);
}

function audit(protocoloId, action, payload = {}, actor = 'api') {
    try {
        const insertAudit = db.prepare('INSERT INTO protocolos_audit (protocolo_id, action, actor, payload) VALUES (?, ?, ?, ?)');
        insertAudit.run(protocoloId, action, actor, JSON.stringify(payload));
    } catch (err) { console.error('Falha ao gravar auditoria', err.message); }
}

// --- ROTAS DE PROTOCOLOS COM PROTEÇÃO POR CARGO ---

api.get('/protocolos', auth.authMiddleware, (req, res) => {
    const protocolos = db.prepare(`
        SELECT p.id, p.piloto, p.veiculo, p.link, p.data, p.inicio, p.fim, p.duracao, p.status_id, s.nome as status, p.created_at
        FROM protocolos p LEFT JOIN status s ON s.id = p.status_id ORDER BY p.id DESC
    `).all();
    res.json(protocolos);
});

api.post('/protocolos', auth.adminMiddleware, (req, res) => { // APENAS ADMIN ABRE
    const { piloto, veiculo, data, inicio, fim, link, status } = req.body || {};
    if (!piloto || !veiculo || !data || !inicio) return res.status(400).json({ message: 'Campos obrigatórios ausentes.' });
    if (veiculo !== ONLY_VEHICLE) return res.status(400).json({ message: `Veículo inválido. Use ${ONLY_VEHICLE}.` });

    const statusId = status ? getStatusId(status) : STATUS_FINALIZADO;
    const isAberto = statusId === STATUS_ABERTO;
    const isNoDuration = STATUS_NO_DURATION.has(statusId);

    let fimValue = fim || inicio;
    let duracao = 0;
    if (!isAberto && !isNoDuration) {
        duracao = calculateDuration(data, inicio, fimValue);
    }

    const info = db.prepare('INSERT INTO protocolos (piloto, veiculo, link, data, inicio, fim, duracao, status_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
                   .run(piloto, veiculo, link || null, data, inicio, fimValue, duracao, statusId);
    
    const created = db.prepare('SELECT p.*, s.nome as status FROM protocolos p LEFT JOIN status s ON s.id = p.status_id WHERE p.id = ?').get(info.lastInsertRowid);
    audit(created.id, 'create', created, req.user.username);
    res.status(201).json(created);
});

api.put('/protocolos/:id/finalizar', auth.adminMiddleware, (req, res) => { // APENAS ADMIN FINALIZA
    const { id } = req.params;
    const { fim, status } = req.body || {};
    const current = db.prepare('SELECT * FROM protocolos WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ message: 'Registro não encontrado.' });

    const statusId = status ? getStatusId(status) : STATUS_FINALIZADO;
    const isNoDuration = STATUS_NO_DURATION.has(statusId);
    const fimValue = fim || current.inicio;
    const duracao = isNoDuration ? 0 : calculateDuration(current.data, current.inicio, fimValue);

    db.prepare('UPDATE protocolos SET fim = ?, duracao = ?, status_id = ? WHERE id = ?').run(fimValue, duracao, statusId, id);
    const updated = db.prepare('SELECT p.*, s.nome as status FROM protocolos p LEFT JOIN status s ON s.id = p.status_id WHERE p.id = ?').get(id);
    audit(id, 'finalizar', { fim, duracao }, req.user.username);
    res.json(updated);
});

// --- ROTAS DE AUTENTICAÇÃO DISCORD OAUTH2 ---

// Rota para iniciar login Discord
api.get('/login', (req, res) => {
    const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'https://odd-deanne-richard7-d040cbf1.koyeb.app/api/v1/callback';
    const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
    
    if (!CLIENT_ID) {
        return res.status(500).send('DISCORD_CLIENT_ID não configurado');
    }

    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds%20guilds.members.read`;
    
    res.redirect(authUrl);
});

// Rota de callback OAuth2
api.get('/callback', async (req, res) => {
    const { code } = req.query;
    const GUILD_ID = process.env.DISCORD_GUILD_ID || '1368980327342542918';
    const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'https://odd-deanne-richard7-d040cbf1.koyeb.app/api/v1/callback';
    
    if (!code) return res.status(400).send('Código OAuth2 ausente');

    try {
        // Trocar código por access token
        const tokenRes = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: process.env.DISCORD_CLIENT_ID,
            client_secret: process.env.DISCORD_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT_URI,
            scope: 'identify guilds guilds.members.read',
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const access_token = tokenRes.data.access_token;
        
        // Buscar dados do usuário
        const userRes = await axios.get('https://discord.com/api/users/@me', { 
            headers: { Authorization: `Bearer ${access_token}` } 
        });
        
        // Buscar cargos no servidor
        let roles = [];
        try {
            const memberRes = await axios.get(`https://discord.com/api/users/@me/guilds/${GUILD_ID}/member`, { 
                headers: { Authorization: `Bearer ${access_token}` } 
            });
            roles = memberRes.data.roles || [];
            console.log(`✅ Usuário ${userRes.data.username} logado com cargos:`, roles);
        } catch (e) { 
            console.warn('⚠️ Não foi possível ler cargos do usuário');
        }

        // Gerar token JWT com os cargos
        const token = auth.generateToken(userRes.data, roles);
        
        // Cadastrar piloto no banco se não existir
        db.prepare('INSERT OR IGNORE INTO pilotos (nome, cor) VALUES (?, ?)').run(userRes.data.username, '#2563eb');
        
        // Redirecionar com token na URL
        res.redirect(`/index.html?token=${token}`);
    } catch (err) { 
        console.error('❌ Erro no login Discord:', err.response?.data || err.message);
        res.status(500).send('Erro ao autenticar com Discord. Tente novamente.');
    }
});

// Outras rotas menores mantidas
api.get('/pilotos', (req, res) => res.json(db.prepare('SELECT id, nome, cor FROM pilotos ORDER BY nome ASC').all()));
api.get('/veiculos', (req, res) => res.json(db.prepare('SELECT id, nome FROM veiculos ORDER BY nome ASC').all()));

app.use('/api/v1', api);
app.use(express.static(PUBLIC_DIR));

// Inicialização do Bot
DISCORD_CLIENT.once('ready', () => console.log(`🤖 Bot Discord: ${DISCORD_CLIENT.user.tag}`));
DISCORD_CLIENT.login(process.env.DISCORD_TOKEN).catch(e => console.error("Erro Bot:", e.message));

app.listen(PORT, () => console.log(`Backend rodando na porta ${PORT}`));