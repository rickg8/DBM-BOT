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

const ONLY_VEHICLE = 'Yamara Tenere';

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

// --- FUNÇÕES ---
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
// --- ROTAS DE LOGIN VIA DISCORD ---
api.get('/login', (req, res) => {
  const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;
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
      redirect_uri: process.env.DISCORD_REDIRECT_URI,
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

    // Devolver token para o front
    res.json({ token: jwtToken });
  } catch (err) {
    console.error('Erro no callback:', err.message);
    res.status(500).send('Erro ao autenticar com Discord');
  }
});

// --- ROTAS ---
api.get('/protocolos', auth.authMiddleware, (req, res) => {
    const protocolos = db.prepare(`
        SELECT p.id, p.piloto, p.veiculo, p.link, p.data, p.inicio, p.fim, p.duracao, p.status_id, s.nome as status, p.created_at
        FROM protocolos p LEFT JOIN status s ON s.id = p.status_id ORDER BY p.id DESC
    `).all();
    res.json(protocolos);
});

// (demais rotas mantidas iguais...)

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
                '1469882501475602453', // ID do bot
                process.env.DISCORD_GUILD_ID // ID do servidor
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
}); 

app.use('/api/v1', api);

