const jwt = require('jsonwebtoken');
const axios = require('axios');

const JWT_SECRET = process.env.JWT_SECRET || 'seu-secret-super-seguro';
const ADMIN_IDS = ['1324784566854221895', '554409578486431794']; // Richard e Breno

const ROLES = {
    ADMIN: 'admin',      // Richard e Breno (Comandantes)
    EQUIPE: 'equipe',    // Membros com cargo no Discord
    USER: 'user'         // Visitantes/Pilotos sem cargo
};

// IDs dos cargos no seu servidor Discord
const ROLE_IDS = {
    // Adicione aqui os IDs dos cargos que devem ter permissão de Equipe
    EQUIPE_DBM: '1368980963752939661',
    // Adicione mais cargos se necessário
    // MODERADOR: '123456789012345678',
    // STAFF: '987654321098765432',
};

/**
 * Determina o role do usuário baseado no Discord ID e nos cargos do servidor
 * @param {string} discordId - ID do usuário no Discord
 * @param {object} memberData - Dados do membro no servidor (roles array)
 * @returns {string} - Role do usuário (admin, equipe ou user)
 */
function getUserRole(discordId, memberData = null) {
    // Admins têm prioridade máxima
    if (ADMIN_IDS.includes(discordId)) {
        return ROLES.ADMIN;
    }
    
    // Se o bot encontrou os cargos do usuário no servidor
    if (memberData && memberData.roles && Array.isArray(memberData.roles)) {
        // Verificar se tem algum cargo de equipe
        const hasEquipeRole = memberData.roles.some(roleId => 
            Object.values(ROLE_IDS).includes(roleId)
        );
        
        if (hasEquipeRole) {
            return ROLES.EQUIPE;
        }
    }
    
    // Usuário padrão (piloto sem cargo)
    return ROLES.USER;
}

/**
 * Gera um token JWT com os dados do usuário e seu role
 * @param {object} user - Dados do usuário do Discord
 * @param {array} roles - Array de IDs de cargos do usuário no servidor
 * @returns {string} - Token JWT
 */
function generateToken(user, roles = []) {
    const role = getUserRole(user.id, { roles });
    
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            avatar: user.avatar,
            role: role,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 dias
        },
        JWT_SECRET,
        { algorithm: 'HS256' }
    );
}

/**
 * Verifica e decodifica um token JWT
 * @param {string} token - Token JWT
 * @returns {object|null} - Dados decodificados ou null se inválido
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        console.warn('Token inválido ou expirado:', err.message);
        return null;
    }
}

/**
 * Middleware de autenticação - verifica se o token é válido
 */
function authMiddleware(req, res, next) {
    let token = req.headers.authorization?.split(' ')[1] || req.query.token;
    
    // Se não achou no header, tenta pegar do cookie
    if (!token && req.headers.cookie) {
        const match = req.headers.cookie.match(/auth_token=([^;]+)/);
        if (match) token = match[1];
    }
    
    if (!token) {
        return res.status(401).json({ 
            error: 'Acesso negado. Faça login para continuar.', 
            code: 'NO_AUTH' 
        });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ 
            error: 'Sessão expirada. Faça login novamente.', 
            code: 'INVALID_TOKEN' 
        });
    }

    req.user = decoded;
    next();
}

/**
 * Middleware de autorização - apenas Admins podem executar ações
 */
function adminMiddleware(req, res, next) {
    authMiddleware(req, res, () => {
        if (req.user.role !== ROLES.ADMIN) {
            return res.status(403).json({ 
                error: 'Somente o Comando DBM (Admins) pode realizar esta ação.',
                code: 'FORBIDDEN',
                requiredRole: 'admin',
                userRole: req.user.role
            });
        }
        next();
    });
}

/**
 * Middleware de autorização - Equipe e Admins podem executar ações
 */
function equipeMiddleware(req, res, next) {
    authMiddleware(req, res, () => {
        if (req.user.role !== ROLES.ADMIN && req.user.role !== ROLES.EQUIPE) {
            return res.status(403).json({ 
                error: 'Você precisa ser membro da Equipe DBM para realizar esta ação.',
                code: 'FORBIDDEN',
                requiredRole: 'equipe ou admin',
                userRole: req.user.role
            });
        }
        next();
    });
}

module.exports = {
    generateToken,
    verifyToken,
    authMiddleware,
    adminMiddleware,
    equipeMiddleware,
    ROLES,
    ADMIN_IDS,
    ROLE_IDS
};