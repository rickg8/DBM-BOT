/**
 * Configuração da Hierarquia DBM
 * 
 * Para obter o ID de um cargo:
 * 1. Ative o Modo Desenvolvedor no Discord (Configurações > Avançado > Modo Desenvolvedor)
 * 2. Vá em Configurações do Servidor > Cargos
 * 3. Clique com botão direito no cargo e selecione "Copiar ID"
 */

module.exports = {
    // Hierarquia DBM (da mais alta para a mais baixa)
    rolesDBM: [
        { 
            id: '1368980593997594757',
            name: '・Comandante『DBM』',
            mention: true
        },
        { 
            id: '1368980687999991848',
            name: '・SubComandante『DBM』',
            mention: true
        },
        { 
            id: '1368980735055585290',
            name: '・Instrutor『DBM』',
            mention: true
        },
        { 
            id: '1368980963752939661',
            name: 'DBM ELITE',
            mention: true
        },
        { 
            id: '1368981004219453641',
            name: '・『EQP』DBM',
            mention: true
        }
    ],

    // Cargos autorizados de outras organizações
    authorized: {
        gaf: [
            { id: 'ID_COMANDANTE_GAF', name: '・Comandante『GAF』' },
            { id: 'ID_SUBCOMANDANTE_GAF', name: '・SubComandante『GAF』' }
        ],
        goa: [
            { id: 'ID_COMANDANTE_GOA', name: '・Comandante『GOA』' },
            { id: 'ID_SUBCOMANDANTE_GOA', name: '・SubComandante『GOA』' }
        ]
    },

    // Configurações do comando
    command: {
        prefix: '/',
        name: 'hierarquia dbm',
        aliases: ['hierarquia dbm', 'hierarchy', 'rank'],
        description: 'Mostra a hierarquia completa da organização'
    }
};
