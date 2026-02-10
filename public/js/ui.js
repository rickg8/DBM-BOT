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
        target.innerHTML = `<div class="session-chip" aria-live="polite"><strong>@${username}</strong>${renderRoleBadge(session.role)}</div>`;
    }

    function detectRoute() {
        const path = window.location.pathname;
        if (path.includes('dashboard')) return 'dashboard';
        if (path.includes('ranking')) return 'ranking';
        return 'protocolos';
    }

    function initialsFromName(name) {
        if (!name) return 'US';
        const parts = name.trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return 'US';
        const first = parts[0]?.[0] || '';
        const last = parts.length > 1 ? parts[parts.length - 1]?.[0] || '' : '';
        return `${first}${last}`.toUpperCase() || 'US';
    }

    function applyAvatar(el, session) {
        if (!el) return;
        const avatarUrl = session?.avatar || session?.picture || session?.avatarUrl;
        const fallback = initialsFromName(session?.username || session?.name || 'Usuário');
        el.textContent = fallback;
        el.classList.remove('has-photo');
        el.style.backgroundImage = 'none';
        if (avatarUrl) {
            el.style.backgroundImage = `url(${avatarUrl})`;
            el.classList.add('has-photo');
        }
    }

    function populateShellUser(session) {
        const name = session?.username || session?.name || 'Usuário';
        const role = roleLabel(session?.role);
        const sidebarName = document.getElementById('sidebarUsername');
        const sidebarRole = document.getElementById('sidebarRole');
        const topbarName = document.getElementById('topbarName');
        const topbarRole = document.getElementById('topbarRole');
        if (sidebarName) sidebarName.textContent = name;
        if (sidebarRole) sidebarRole.textContent = role || 'Conectado';
        if (topbarName) topbarName.textContent = name;
        if (topbarRole) topbarRole.textContent = role || 'Conectado';

        applyAvatar(document.getElementById('sidebarAvatar'), session);
        applyAvatar(document.getElementById('topbarAvatar'), session);
    }

    function initShellLayout(options = {}) {
        const route = options.route || detectRoute();
        const session = getSession();
        populateShellUser(session);

        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebarBackdrop');
        const toggle = document.getElementById('sidebarToggle');
        const closeBtn = document.getElementById('sidebarClose');
        const userChip = document.getElementById('topbarUserChip');
        const dropdown = document.getElementById('userDropdown');
        const logoutAction = document.getElementById('logoutAction');

        const openSidebar = () => {
            sidebar?.classList.add('is-open');
            backdrop?.classList.add('is-visible');
        };

        const closeSidebar = () => {
            sidebar?.classList.remove('is-open');
            backdrop?.classList.remove('is-visible');
        };

        toggle?.addEventListener('click', () => {
            const isOpen = sidebar?.classList.contains('is-open');
            isOpen ? closeSidebar() : openSidebar();
        });

        closeBtn?.addEventListener('click', closeSidebar);
        backdrop?.addEventListener('click', closeSidebar);

        const navLinks = document.querySelectorAll('.sidebar-link');
        navLinks.forEach(link => {
            const linkRoute = link.dataset.route;
            if (linkRoute === route) link.classList.add('active');
            link.addEventListener('click', closeSidebar);
        });

        const closeDropdown = () => {
            if (!dropdown || !userChip) return;
            dropdown.classList.remove('open');
            userChip.setAttribute('aria-expanded', 'false');
        };

        userChip?.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdown?.classList.contains('open');
            dropdown?.classList.toggle('open', !isOpen);
            userChip.setAttribute('aria-expanded', (!isOpen).toString());
        });

        document.addEventListener('click', (e) => {
            if (!dropdown || !userChip) return;
            if (dropdown.contains(e.target) || userChip.contains(e.target)) return;
            closeDropdown();
        });

        logoutAction?.addEventListener('click', async () => {
            const ok = await confirmLogout();
            if (!ok) return;
            if (typeof options.onLogout === 'function') return options.onLogout();
            if (typeof window.logout === 'function') return window.logout();
            window.clearAuth?.();
            window.location.href = '/login.html';
        });
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
        initShellLayout,
    };
})();
