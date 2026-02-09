const jwt = require('jsonwebtoken');
const axios = require('axios');

const JWT_SECRET = process.env.JWT_SECRET || 'seu-secret-super-seguro';
const ADMIN_IDS = ['1324784566854221895', '554409578486431794']; // Richard e Breno

const ROLES = {
    ADMIN: 'admin',      // Richard e Breno (Comandantes)
    EQUIPE: 'equipe',    // Membros com cargo no Discord
    USER: 'user'         // Visitantes/Pilotos sem cargo
};

// IDs dos cargos no seu servidor (Pegue esses IDs no Discord)
const ROLE_IDS = {
    EQUIPE_DBM: '1368980963752939661', // Exemplo: Use o ID do cargo de Equipe
};

function getUserRole(discordId, memberData = null) {
    if (ADMIN_IDS.includes(discordId)) return ROLES.ADMIN;
    
    // Se o bot encontrou o membro no servidor e ele tem o cargo de equipe
    if (memberData && memberData.roles && memberData.roles.includes(ROLE_IDS.EQUIPE_DBM)) {
        return ROLES.EQUIPE;
    }
    
    return ROLES.USER;
}

function generateToken(user, roles = []) {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            avatar: user.avatar,
            role: getUserRole(user.id, { roles }), // Define o cargo no Token
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
        },
        JWT_SECRET,
        { algorithm: 'HS256' }
    );
}

function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}

function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1] || req.query.token;
    
    if (!token) return res.status(401).json({ error: 'Acesso negado', code: 'NO_AUTH' });

    const decoded = verifyToken(token);
    if (!decoded) return res.status(401).json({ error: 'Sessão expirada', code: 'INVALID_TOKEN' });

    req.user = decoded;
    next();
}

// Bloqueia quem não é Richard, Breno ou Admin
function adminMiddleware(req, res, next) {
    authMiddleware(req, res, () => {
        if (req.user.role !== ROLES.ADMIN) {
            return res.status(403).json({ error: 'Somente o Comando DBM pode realizar esta ação.' });
        }
        next();
    });
}

module.exports = {
    generateToken,
    verifyToken,
    authMiddleware,
    adminMiddleware,
    ROLES,
    ADMIN_IDS
};