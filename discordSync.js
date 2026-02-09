/**
 * Discord Protocol Synchronizer
 * Lê protocolos enviados por outro bot Discord e sincroniza com o site
 */

require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

// Configurações
const OTHER_BOT_ID = '1410682630801854566';
const CHANNEL_ID = '1458929318892666922';
const LOCAL_API_URL = process.env.API_URL || 'http://localhost:3001/api/v1';
const SYNC_INTERVAL = 60000; // 1 minuto
const SYNC_CLIENT = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

let isSyncing = false;
let lastSyncTime = null;

/**
 * Extrai o ID de usuário de uma string como <@123456789>
 */
function extractUserId(text) {
    const match = text.match(/<@(\d+)>/);
    return match ? match[1] : null;
}

/**
 * Extrai o timestamp Unix de <t:1234567890:t> ou <t:1234567890:d>
 */
function extractTimestamp(text) {
    const match = text.match(/<t:(\d+):[dt]>/);
    return match ? parseInt(match[1], 10) : null;
}

/**
 * Converte duração em formato "18m 33s" para segundos
 */
function parseDurationString(durationStr) {
    if (!durationStr) return 0;
    
    let seconds = 0;
    const dayMatch = durationStr.match(/(\d+)d/);
    const hourMatch = durationStr.match(/(\d+)h/);
    const minMatch = durationStr.match(/(\d+)m/);
    const secMatch = durationStr.match(/(\d+)s/);
    
    if (dayMatch) seconds += parseInt(dayMatch[1], 10) * 86400;
    if (hourMatch) seconds += parseInt(hourMatch[1], 10) * 3600;
    if (minMatch) seconds += parseInt(minMatch[1], 10) * 60;
    if (secMatch) seconds += parseInt(secMatch[1], 10);
    
    return seconds;
}

/**
 * Formata segundos para HH:MM:SS
 */
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Extrai data de timestamp Unix (retorna YYYY-MM-DD)
 */
function getDateFromTimestamp(unixTimestamp) {
    const date = new Date(unixTimestamp * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Extrai horário de timestamp Unix (retorna HH:MM:SS)
 */
function getTimeFromTimestamp(unixTimestamp) {
    const date = new Date(unixTimestamp * 1000);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

/**
 * Parse da mensagem de protocolo
 * Retorna objeto com os dados extraídos
 */
function parseProtocolMessage(message) {
    try {
        // Se for embed, extrair dados do embed
        if (message.embeds && message.embeds.length > 0) {
            return parseProtocolEmbed(message.embeds[0], message.content);
        }
        
        // Fallback para ParseMessageContent se não houver embed
        return parseProtocolContent(message.content);
    } catch (err) {
        console.error('Erro ao fazer parse da mensagem:', err.message);
        return null;
    }
}

/**
 * Parse de embed de protocolo
 */
function parseProtocolEmbed(embed, plainText = '') {
    const data = {
        protocolo: null,
        data: null,
        inicio: null,
        fim: null,
        piloto: null,
        veiculo: null,
        duracao: null,
        status: 'FINALIZADO',
        link: null
    };

    try {
        // Tentar extrair número do protocolo do título
        if (embed.title) {
            const protoMatch = embed.title.match(/n°(\d+)/i);
            if (protoMatch) data.protocolo = `#${protoMatch[1]}`;
        }

        // Processar fields do embed
        if (embed.fields && Array.isArray(embed.fields)) {
            for (const field of embed.fields) {
                const name = field.name.toLowerCase();
                const value = field.value || '';

                if (name.includes('data')) {
                    const ts = extractTimestamp(value);
                    if (ts) data.data = getDateFromTimestamp(ts);
                }

                if (name.includes('início')) {
                    const ts = extractTimestamp(value);
                    if (ts) data.inicio = getTimeFromTimestamp(ts);
                }

                if (name.includes('veículo') || name.includes('veiculo')) {
                    data.veiculo = value.replace(/`/g, '').trim();
                }

                if (name.includes('piloto')) {
                    data.piloto = value.replace(/[<>@]/g, '').trim();
                    // Se for menção, remover números extras
                    const userMatch = value.match(/\d+/);
                    if (userMatch) {
                        data.pilotoId = userMatch[0];
                    }
                }

                if (name.includes('retorno')) {
                    const ts = extractTimestamp(value);
                    if (ts) data.fim = getTimeFromTimestamp(ts);
                }

                if (name.includes('duração') || name.includes('duracao')) {
                    const durationStr = value.replace(/`/g, '').trim();
                    data.duracao = parseDurationString(durationStr);
                }

                if (name.includes('status')) {
                    if (value.toLowerCase().includes('finalizado') || value.includes('✅')) {
                        data.status = 'FINALIZADO';
                    } else if (value.toLowerCase().includes('aberto') || value.includes('🔓')) {
                        data.status = 'ABERTO';
                    }
                }
            }
        }

        // Extrair URL da mensagem se existir
        if (plainText && plainText.includes('http')) {
            const urlMatch = plainText.match(/(https?:\/\/[^\s]+)/);
            if (urlMatch) data.link = urlMatch[1];
        }

        // Validar dados obrigatórios
        if (!data.data || !data.inicio || !data.piloto || !data.veiculo) {
            console.warn('Campos obrigatórios ausentes no protocolo:', data);
            return null;
        }

        // Se não tem fim mas está finalizado, usar fim = inicio
        if (!data.fim && data.status === 'FINALIZADO') {
            data.fim = data.inicio;
        }

        return data;
    } catch (err) {
        console.error('Erro ao fazer parse do embed:', err.message);
        return null;
    }
}

/**
 * Parse alternativo para conteúdo em texto
 */
function parseProtocolContent(content) {
    const data = {
        protocolo: null,
        data: null,
        inicio: null,
        fim: null,
        piloto: null,
        veiculo: null,
        duracao: null,
        status: 'FINALIZADO',
        link: null
    };

    try {
        // Buscar padrões simples
        const protoMatch = content.match(/protocolo[:\s]+#?(\d+)/i);
        if (protoMatch) data.protocolo = `#${protoMatch[1]}`;

        const dataMatch = content.match(/data[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i);
        if (dataMatch) {
            const [d, m, y] = dataMatch[1].split('/');
            data.data = `${y}-${m}-${d}`;
        }

        const inicioMatch = content.match(/início[:\s]+(\d{1,2}:\d{2})/i);
        if (inicioMatch) data.inicio = inicioMatch[1];

        const fimMatch = content.match(/retorno|fim[:\s]+(\d{1,2}:\d{2})/i);
        if (fimMatch) data.fim = fimMatch[1];

        const pilotoMatch = content.match(/piloto[:\s]+([^\n]+)/i);
        if (pilotoMatch) data.piloto = pilotoMatch[1].replace(/[<>@]/g, '').trim();

        const veiculoMatch = content.match(/veículo|veiculo[:\s]+([^\n]+)/i);
        if (veiculoMatch) data.veiculo = veiculoMatch[1].replace(/`/g, '').trim();

        const statusMatch = content.match(/status[:\s]+(finalizado|aberto)/i);
        if (statusMatch) data.status = statusMatch[1].toUpperCase();

        if (!data.data || !data.inicio || !data.piloto || !data.veiculo) {
            return null;
        }

        if (!data.fim) data.fim = data.inicio;

        return data;
    } catch (err) {
        console.error('Erro ao fazer parse do conteúdo:', err.message);
        return null;
    }
}

/**
 * Sincroniza protocolo com a API local
 */
async function syncProtocolToAPI(protocolData) {
    try {
        const payload = {
            piloto: protocolData.piloto,
            veiculo: protocolData.veiculo || 'Yamara Tenere',
            data: protocolData.data,
            inicio: protocolData.inicio,
            fim: protocolData.fim || protocolData.inicio,
            link: protocolData.link || null,
            status: protocolData.status
        };

        const response = await fetch(`${LOCAL_API_URL}/protocolos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('Erro da API:', error);
            return false;
        }

        const created = await response.json();
        console.log(`✅ Protocolo sincronizado: #${created.id} - ${created.piloto}`);
        return true;
    } catch (err) {
        console.error('Erro ao sincronizar com API:', err.message);
        return false;
    }
}

/**
 * Sincroniza mensagens do canal
 */
async function syncChannelMessages() {
    if (isSyncing) return;
    
    isSyncing = true;
    try {
        const channel = await SYNC_CLIENT.channels.fetch(CHANNEL_ID);
        if (!channel || !channel.isTextBased()) {
            console.error('Canal inválido ou não acessível');
            return;
        }

        // Buscar mensagens recentes do outro bot
        const messages = await channel.messages.fetch({ limit: 10 });
        let syncedCount = 0;

        for (const [, message] of messages) {
            // Pular se não for do outro bot
            if (message.author.id !== OTHER_BOT_ID) continue;

            // Fazer parse da mensagem
            const protocolData = parseProtocolMessage(message);
            if (!protocolData) continue;

            // Verificar se já foi sincronizado (usar ID da mensagem como referência)
            const existing = await checkIfSynced(message.id);
            if (existing) {
                console.log(`⏭️  Protocolo já sincronizado: ${message.id}`);
                continue;
            }

            // Sincronizar com API
            const success = await syncProtocolToAPI(protocolData);
            if (success) {
                syncedCount++;
                await markAsSynced(message.id);
            }
        }

        if (syncedCount > 0) {
            lastSyncTime = new Date();
            console.log(`🔄 Sincronização completa: ${syncedCount} protocolo(s) novo(s)`);
        } else {
            console.log('✓ Nenhum protocolo novo para sincronizar');
        }
    } catch (err) {
        console.error('Erro durante sincronização:', err.message);
    } finally {
        isSyncing = false;
    }
}

/**
 * Verifica se protocolo já foi sincronizado
 * (mantém registro simples em memória ou arquivo)
 */
const syncedMessages = new Set();

async function checkIfSynced(messageId) {
    return syncedMessages.has(messageId);
}

async function markAsSynced(messageId) {
    syncedMessages.add(messageId);
}

/**
 * Inicializa o cliente de sincronização
 */
function initializeSync() {
    SYNC_CLIENT.once('ready', () => {
        console.log(`🔄 Sincronizador Discord conectado como ${SYNC_CLIENT.user.tag}`);
        
        // Sincronizar imediatamente
        syncChannelMessages();
        
        // Sincronizar periodicamente
        setInterval(syncChannelMessages, SYNC_INTERVAL);
    });

    SYNC_CLIENT.on('error', err => {
        console.error('Erro no sincronizador:', err.message);
    });

    const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
    if (!DISCORD_TOKEN || DISCORD_TOKEN === 'TOKEN_AQUI') {
        console.warn('⚠️  Sincronizador desativado: nenhum token Discord configurado');
        return;
    }

    SYNC_CLIENT.login(DISCORD_TOKEN).catch(err => {
        console.error('Falha ao conectar sincronizador:', err.message);
    });
}

module.exports = {
    initializeSync,
    syncProtocolToAPI,
    parseProtocolMessage
};
