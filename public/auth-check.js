// Script de autenticação global - executa IMEDIATAMENTE
console.log('[AUTH-CHECK] Script carregado, URL:', window.location.pathname);

// Função global para limpar autenticação
window.clearAuth = function() {
    console.log('[AUTH] Limpando autenticação...');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_role');
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    document.cookie = 'user_id=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    document.cookie = 'user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
};

(function() {
    // NÃO redirecionar da página de login
    if (window.location.pathname === '/login.html' || window.location.pathname.endsWith('login.html')) {
        console.log('[AUTH-CHECK] Estamos na página de login, pulando verificação');
        return;
    }

    // Pegar token do localStorage
    const tokenLS = localStorage.getItem('auth_token');
    console.log('[AUTH-CHECK] Token localStorage:', tokenLS ? 'EXISTE' : 'NULO');

    // Pegar token do cookie
    const cookies = document.cookie.split(';').map(c => c.trim());
    const tokenCookie = cookies.find(c => c.startsWith('auth_token='))?.split('=')[1];
    console.log('[AUTH-CHECK] Token cookie:', tokenCookie ? 'EXISTE' : 'NULO');

    // Usar token de qualquer origem
    const token = tokenLS || tokenCookie;
    console.log('[AUTH-CHECK] Token final validado:', token ? 'SIM' : 'NÃO');

    // Se não tem token ou é inválido, limpar e redirecionar para login
    if (!token || token === 'null' || token === 'undefined' || token.trim() === '') {
        console.log('[AUTH-CHECK] ⚠️ Nenhum token válido encontrado, limpando dados...');
        
        window.clearAuth();
        
        console.log('[AUTH-CHECK] 🔄 Redirecionando para /login.html...');
        
        // Redirecionar IMEDIATAMENTE para login
        window.location.href = '/login.html';
    } else {
        console.log('[AUTH-CHECK] ✅ Token válido encontrado, acesso permitido');
    }
})();
