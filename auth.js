const jwt = require('jsonwebtoken');
const axios = require('axios');

const JWT_SECRET = process.env.JWT_SECRET || 'seu-secret-super-seguro-mude-em-producao';

// IDs de admins (comando DBM)
const ADMIN_IDS = ['1324784566854221895', '554409578486431794']; // Richard e Breno

// Tipos de permissões
const ROLES = {
    ADMIN: 'admin',      // Richard e Breno - acesso total
    USER: 'user'         // Todos os outros usuários Discord
};

// Obter permissões do usuário baseado no ID
function getUserRole(discordId) {
    return ADMIN_IDS.includes(discordId) ? ROLES.ADMIN : ROLES.USER;
}

// Gerar JWT token
function generateToken(user) {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            avatar: user.avatar,
            role: getUserRole(user.id),
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 dias
        },
        JWT_SECRET,
        { algorithm: 'HS256' }
    );
}

// Verificar token JWT
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}

// Middleware para verificar autenticação
function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1] || req.cookies?.auth_token;
    
    if (!token) {
        return res.status(401).json({ error: 'Sem autenticação', code: 'NO_AUTH' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: 'Token inválido ou expirado', code: 'INVALID_TOKEN' });
    }

    req.user = decoded;
    next();
}

// Middleware para verificar se é admin
function adminMiddleware(req, res, next) {
    authMiddleware(req, res, () => {
        if (req.user.role !== ROLES.ADMIN) {
            return res.status(403).json({ error: 'Acesso negado - Requer permissão de comandante DBM', code: 'FORBIDDEN' });
        }
        next();
    });
}

// Buscar dados do usuário do Discord via token
async function fetchDiscordUser(accessToken) {
    try {
        const response = await axios.get('https://discord.com/api/v10/users/@me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': 'DBM-Bot/1.0'
            }
        });
        return response.data;
    } catch (err) {
        console.error('Erro ao buscar usuário Discord:', err.message);
        return null;
    }
}

module.exports = {
    generateToken,
    verifyToken,
    authMiddleware,
    adminMiddleware,
    getUserRole,
    fetchDiscordUser,
    ROLES,
    ADMIN_IDS,
    JWT_SECRET
};
