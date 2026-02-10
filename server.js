const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const Database = require('better-sqlite3');
const axios = require('axios');
const { Client, GatewayIntentBits } = require('discord.js');
const auth = require('./auth');
const hierarchyConfig = require('./hierarchy-config');
const discordSync = require('./discordSync');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const DB_PATH = path.join(DATA_DIR, 'dbm.sqlite');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Discord Bot
const DISCORD_CLIENT = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const ONLY_VEHICLE = 'Yamaha Tenere';

// --- MIGRAÇÕES ---
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

// Seeds
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

// --- ROTAS DE LOGIN VIA DISCORD ---
api.get('/login', (req, res) => {
  const REDIRECT_URI = (process.env.DISCORD_REDIRECT_URI || '').trim();
  const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

  if (!CLIENT_ID) {
    return res.status(500).send('DISCORD_CLIENT_ID não configurado');
  }

  const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds%20guilds.members.read`;
  res.redirect(authUrl);
});

api.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('Código não fornecido');

  try {
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: (process.env.DISCORD_REDIRECT_URI || '').trim(),
      scope: 'identify guilds guilds.members.read'
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const accessToken = tokenResponse.data.access_token;

    // Buscar dados do usuário no Discord
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const user = userResponse.data;

    // Buscar cargos do usuário no servidor
    const memberResponse = await axios.get(
      `https://discord.com/api/users/@me/guilds/${process.env.DISCORD_GUILD_ID}/member`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const memberData = memberResponse.data;

    // Gerar JWT com role
    const jwtToken = require('./auth').generateToken(user, memberData.roles);

    // Redirecionar para o front com o token
    res.redirect(`/?token=${jwtToken}`);
  } catch (err) {
    console.error('Erro no callback:', err.message);
    if (err.response) {
      console.error('Detalhes do erro Discord:', JSON.stringify(err.response.data, null, 2));
    }
    res.status(500).send('Erro ao autenticar com Discord. Verifique o console do servidor.');
  }
});

// --- ROTAS DE PROTOCOLOS ---
api.get('/protocolos', auth.authMiddleware, (req, res) => {
    try {
        const protocolos = db.prepare(`
            SELECT p.id, p.piloto, p.veiculo, p.link, p.data, p.inicio, p.fim, p.duracao, p.status_id, s.nome as status, p.created_at
            FROM protocolos p LEFT JOIN status s ON s.id = p.status_id ORDER BY p.id DESC
        `).all();
        res.json(protocolos);
    } catch (err) {
        console.error('Erro CRÍTICO ao buscar protocolos:', err.message);
        res.status(500).json({ error: 'Erro de banco de dados. Por favor, resete o banco.' });
    }
});

// Listar Pilotos
api.get('/pilotos', auth.authMiddleware, (req, res) => {
    try {
        let pilotos = db.prepare('SELECT nome, cor FROM pilotos').all();
        if (pilotos.length === 0) {
            const distinct = db.prepare('SELECT DISTINCT piloto as nome FROM protocolos').all();
            pilotos = distinct.map(p => ({ nome: p.nome, cor: '#6b7280' }));
        }
        res.json(pilotos);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Listar Veículos
api.get('/veiculos', auth.authMiddleware, (req, res) => {
    try {
        const veiculos = db.prepare('SELECT nome FROM veiculos').all();
        res.json(veiculos);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Listar Status
api.get('/status', auth.authMiddleware, (req, res) => {
    try {
        const status = db.prepare('SELECT nome FROM status').all();
        res.json(status);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Criar Protocolo (Usado pelo Sincronizador)
api.post('/protocolos', auth.authMiddleware, (req, res) => {
    try {
        const { piloto, veiculo, link, data, inicio, fim, status } = req.body;
        
        let duracao = 0;
        if (fim && status !== 'ABERTO') {
            const d1 = new Date(`${data}T${inicio}`);
            let d2 = new Date(`${data}T${fim}`);
            if (d2 < d1) d2.setDate(d2.getDate() + 1);
            duracao = Math.floor((d2 - d1) / 1000);
        }

        const statusId = getStatusId(status || 'FINALIZADO');

        const stmt = db.prepare(`
            INSERT INTO protocolos (piloto, veiculo, link, data, inicio, fim, duracao, status_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const info = stmt.run(piloto, veiculo, link, data, inicio, fim || '', duracao, statusId);

        db.prepare('INSERT OR IGNORE INTO pilotos (nome) VALUES (?)').run(piloto);

        db.prepare('INSERT INTO protocolos_audit (protocolo_id, action, actor, payload) VALUES (?, ?, ?, ?)')
          .run(info.lastInsertRowid, 'CREATE', req.user.username || 'System', JSON.stringify(req.body));

        res.json({ id: info.lastInsertRowid, message: 'Protocolo criado' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Editar Protocolo
api.put('/protocolos/:id', auth.authMiddleware, (req, res) => {
    try {
        const { id } = req.params;
        const { piloto, veiculo, link, data, inicio, fim, status } = req.body;

        let duracao = 0;
        if (fim && status !== 'ABERTO') {
            const d1 = new Date(`${data}T${inicio}`);
            let d2 = new Date(`${data}T${fim}`);
            if (d2 < d1) d2.setDate(d2.getDate() + 1);
            duracao = Math.floor((d2 - d1) / 1000);
        }

        const statusId = getStatusId(status);

        const stmt = db.prepare(`
            UPDATE protocolos 
            SET piloto=?, veiculo=?, link=?, data=?, inicio=?, fim=?, duracao=?, status_id=?
            WHERE id=?
        `);
        stmt.run(piloto, veiculo, link, data, inicio, fim || '', duracao, statusId, id);

        db.prepare('INSERT INTO protocolos_audit (protocolo_id, action, actor, payload) VALUES (?, ?, ?, ?)')
          .run(id, 'UPDATE', req.user.username || 'System', JSON.stringify(req.body));

        res.json({ message: 'Atualizado com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Finalizar Protocolo
api.put('/protocolos/:id/finalizar', auth.authMiddleware, (req, res) => {
    try {
        const { id } = req.params;
        const { fim, status } = req.body;

        const current = db.prepare('SELECT * FROM protocolos WHERE id = ?').get(id);
        if (!current) return res.status(404).json({ error: 'Protocolo não encontrado' });

        const d1 = new Date(`${current.data}T${current.inicio}`);
        let d2 = new Date(`${current.data}T${fim}`);
        if (d2 < d1) d2.setDate(d2.getDate() + 1);
        const duracao = Math.floor((d2 - d1) / 1000);

        const statusId = getStatusId(status || 'FINALIZADO');

        db.prepare('UPDATE protocolos SET fim=?, duracao=?, status_id=? WHERE id=?')
          .run(fim, duracao, statusId, id);

        db.prepare('INSERT INTO protocolos_audit (protocolo_id, action, actor, payload) VALUES (?, ?, ?, ?)')
          .run(id, 'FINALIZE', req.user.username || 'System', JSON.stringify({ fim, duracao }));

        res.json({ message: 'Protocolo finalizado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Deletar Protocolo
api.delete('/protocolos/:id', auth.authMiddleware, (req, res) => {
    try {
        const { id } = req.params;
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Apenas administradores podem deletar protocolos.' });
        }
        db.prepare('DELETE FROM protocolos WHERE id=?').run(id);
        res.json({ message: 'Deletado com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.use('/api/v1', api);
app.use(express.static(PUBLIC_DIR));

// Inicialização do Bot
DISCORD_CLIENT.once('ready', () => {
    console.log(`🤖 Bot Discord: ${DISCORD_CLIENT.user.tag}`);
});

// --- CONFIGURAÇÃO DO COMANDO /HIERARQUIA ---
const commands = [
    new SlashCommandBuilder()
        .setName('hierarquia')
        .setDescription('Exibe a hierarquia atualizada do DBM')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Iniciando registro do comando /hierarquia dbm');
        await rest.put(
            Routes.applicationGuildCommands(
                process.env.DISCORD_CLIENT_ID, // ID do bot
                process.env.DISCORD_GUILD_ID   // ID do servidor
            ),
            { body: commands },
        );
        console.log('✅ Comando /hierarquia registrado!');
    } catch (error) {
        console.error('❌ Erro ao registrar comando:', error);
    }
})();

// --- RESPOSTA DO BOT AO COMANDO ---
DISCORD_CLIENT.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === 'hierarquia') {
        try {
            const guild = interaction.guild;
            await guild.members.fetch();

            let hierarchyText = '🛵 **Hierarquia DBM** 🛵\n';

            for (const roleData of hierarchyConfig.rolesDBM) {
                const role = guild.roles.cache.get(roleData.id);
                if (!role) continue;

                const members = guild.members.cache.filter(m => m.roles.cache.has(roleData.id));
                hierarchyText += `@${role.name} (${members.size})\n`;
                members.forEach(member => {
                    hierarchyText += `  • ${member.user.username}\n`;
                });
                hierarchyText += '\n';
            }

            hierarchyText += `*Total de membros: ${guild.memberCount}*\n`;
            hierarchyText += `*Atualizado em: ${new Date().toLocaleDateString('pt-BR')}*`;

            await interaction.reply(hierarchyText);
        } catch (error) {
            console.error('Erro ao executar /hierarquia:', error);
            await interaction.reply('Ocorreu um erro ao buscar a hierarquia.');
        }
    }
});

// Login do bot
DISCORD_CLIENT.login(process.env.DISCORD_TOKEN).catch(e => console.error("Erro Bot:", e.message));

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    
    // Iniciar o sincronizador de protocolos
    try {
        discordSync.initializeSync();
    } catch (e) {
        console.error('Falha ao iniciar sincronizador:', e.message);
    }
});
