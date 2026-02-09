/**
 * Configuração da Hierarquia DBM
 * 
 * Para obter o ID de um cargo:
 * 1. Ative o Modo Desenvolvedor no Discord (Configurações > Avançado > Modo Desenvolvedor)
 * 2. Vá em Configurações do Servidor > Cargos
 * 3. Clique com botão direito no cargo e selecione "Copiar ID"
 */

module.exports = {
    // Hierarquia (da mais alta para a mais baixa)
    roles: [
        { 
            id: '1368980327342542918', 
            name: '👑 Fundador', 
            emoji: '👑',
            description: 'Fundador da organização'
        },
        { 
            id: '1368980593997594757', 
            name: '⭐ Comandante', 
            emoji: '⭐',
            description: 'Comando supremo da DBM'
        },
        { 
            id: '1368980687999991848', 
            name: '🎖️ Sub-Comandante', 
            emoji: '🎖️',
            description: 'Auxiliam o comando'
        },
        { 
            id: '1368980735055585290', 
            name: '🔰 Equipe DBM', 
            emoji: '🔰',
            description: 'Equipe operacional'
        },
        { 
            id: '1368980963752939661', 
            name: '🏍️ Piloto', 
            emoji: '🏍️',
            description: 'Pilotos ativos'
        }
    ],

    // Configurações do comando
    command: {
        prefix: '/',
        name: 'hierarquia',
        aliases: ['hierarquia', 'hierarchy', 'rank'],
        description: 'Mostra a hierarquia completa da organização'
    }
};
