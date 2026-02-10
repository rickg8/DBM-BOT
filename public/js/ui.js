// UI helpers: toasts, session, loading states
(function () {
    const ICONS = {
        success: '✅',
        error: '⚠️',
        info: 'ℹ️'
    };

    function ensureToastStack() {
        let stack = document.getElementById('toast-stack');
        if (!stack) {
            stack = document.createElement('div');
            stack.id = 'toast-stack';
            document.body.appendChild(stack);
        }
        return stack;
    }

    function showToast(message, type = 'info') {
        const stack = ensureToastStack();
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        toast.innerHTML = `<span class="icon">${ICONS[type] || ICONS.info}</span><span>${message}</span>`;
        stack.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 220);
        }, 3200);
    }

    function parseJwt(token) {
        if (!token) return null;
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (err) {
            console.warn('Não foi possível decodificar o token', err);
            return null;
        }
    }

    function getSession() {
        const token = localStorage.getItem('auth_token');
        const decoded = parseJwt(token);
        return decoded ? { token, ...decoded } : null;
    }

    function roleLabel(role) {
        if (role === 'admin') return 'Comando';
        if (role === 'equipe') return 'Equipe';
        return 'Piloto';
    }

    function renderRoleBadge(role) {
        const label = roleLabel(role);
        return `<span class="role-badge ${role || 'user'}" title="${label}">${label}</span>`;
    }

    function renderSessionChip(targetId) {
        const target = document.getElementById(targetId);
        if (!target) return;
        const session = getSession();
        if (!session) {
            target.innerHTML = '<span class="muted">Não autenticado</span>';
            return;
        }
        const username = session.username || session.id || 'usuário';
        target.innerHTML = `<div class="session-chip" aria-live="polite">Logado como <strong>@${username}</strong>${renderRoleBadge(session.role)}</div>`;
    }

    function setButtonLoading(btn, isLoading, labelWhile) {
        if (!btn) return;
        if (isLoading) {
            btn.dataset.originalText = btn.textContent;
            btn.textContent = labelWhile || 'Carregando...';
            btn.disabled = true;
            btn.classList.add('is-loading');
        } else {
            const original = btn.dataset.originalText;
            if (original) btn.textContent = original;
            btn.disabled = false;
            btn.classList.remove('is-loading');
        }
    }

    function confirmLogout() {
        return new Promise(resolve => {
            const confirmed = window.confirm('Deseja sair da sessão?');
            resolve(confirmed);
        });
    }

    window.toast = {
        success: (msg) => showToast(msg, 'success'),
        error: (msg) => showToast(msg, 'error'),
        info: (msg) => showToast(msg, 'info'),
    };

    window.uiHelpers = {
        parseJwt,
        getSession,
        renderSessionChip,
        renderRoleBadge,
        setButtonLoading,
        confirmLogout,
    };
})();
