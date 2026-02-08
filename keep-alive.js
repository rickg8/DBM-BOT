// Keep-alive para manter o Replit rodando
const http = require('http');

function keepAlive() {
    try {
        const url = process.env.REPLIT_URL || 'http://localhost:3001';
        http.get(url, (response) => {
            console.log(`[Keep-Alive] ${new Date().toLocaleString()} - Status: ${response.statusCode}`);
        }).on('error', (error) => {
            console.error('[Keep-Alive] Erro:', error.message);
        });
    } catch (error) {
        console.error('[Keep-Alive] Erro:', error);
    }
}

// Ping a cada 5 minutos
setInterval(keepAlive, 5 * 60 * 1000);

console.log('[Keep-Alive] Iniciado!');
