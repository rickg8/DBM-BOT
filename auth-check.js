// Script de autenticação global - executa IMEDIATAMENTE

(function() {
    // NÃO redirecionar da página de login
    if (window.location.pathname === '/login.html' || window.location.pathname.endsWith('login.html')) {
        return;
    }

    // Pegar token do localStorage
    const token = localStorage.getItem('auth_token');

    // Se não tem token ou é inválido, redireciona para login
    if (!token || token === null || token === 'null' || token === 'undefined' || token.trim() === '') {
        // Limpar localStorage de valores inválidos
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_role');
        
        // Redirecionar IMEDIATAMENTE para login
        window.location.href = '/login.html';
    }
})();
