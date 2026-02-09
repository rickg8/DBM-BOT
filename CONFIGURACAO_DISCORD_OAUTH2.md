# Configuração do Login Discord OAuth2

## Variáveis de Ambiente Necessárias

Você precisa configurar estas variáveis no seu arquivo `.env`:

```env
# Discord Bot Token (para sincronizar protocolos)
DISCORD_TOKEN=SEU_TOKEN_AQUI

# Discord OAuth2 (para login via Discord)
DISCORD_CLIENT_ID=SEU_CLIENT_ID_AQUI
DISCORD_CLIENT_SECRET=SEU_CLIENT_SECRET_AQUI
DISCORD_GUILD_ID=SEU_GUILD_ID_AQUI
DISCORD_REDIRECT_URI=https://odd-deanne-richard7-d040cbf1.koyeb.app/api/v1/callback

# JWT Secret (para autenticação)
JWT_SECRET=sua_chave_secreta_aqui


## Como Configurar o Discord OAuth2

### 1. Acessar o Discord Developer Portal

1. Vá em: https://discord.com/developers/applications
2. Selecione sua aplicação (ou crie uma nova)

### 2. Configurar OAuth2

1. No menu lateral, clique em **OAuth2**
2. Em **Redirects**, adicione:
   ```
   https://odd-deanne-richard7-d040cbf1.koyeb.app/api/v1/callback
   ```
   ⚠️ **IMPORTANTE:** Se estiver testando no seu PC, adicione também:
   `http://localhost:3001/api/v1/callback`

3. Copie o **Client ID** e **Client Secret**

### 3. Configurar Permissões (Scopes)

Os seguintes scopes são necessários:
- `identify` - Para obter informações básicas do usuário
- `guilds` - Para verificar se o usuário está no servidor
- `guilds.members.read` - Para ler os cargos do usuário

## Sistema de Permissões

O sistema possui 3 níveis de acesso:

### 1. **Admin** (Comandantes)
- IDs dos Admins definidos em `auth.js`:
  - Richard: `1324784566854221895`
  - Breno: `554409578486431794`
- **Permissões**: Acesso total (criar, editar, finalizar protocolos)

### 2. **Equipe** (Membros com cargo)
- Usuários com o cargo de Equipe DBM no servidor Discord
- ID do cargo configurado em `auth.js`: `1368980963752939661`
- **Permissões**: Visualização completa

### 3. **User** (Pilotos)
- Qualquer pessoa que fizer login via Discord
- **Permissões**: Visualização básica

## Como Adicionar Mais Cargos de Equipe

Edite o arquivo `auth.js` e adicione os IDs dos cargos:

```javascript
const ROLE_IDS = {
    EQUIPE_DBM: '1368980963752939661',
    MODERADOR: '123456789012345678',  // Adicione aqui
    STAFF: '987654321098765432',      // Adicione aqui
};
```

### Como Obter o ID de um Cargo

1. No Discord, vá em **Configurações do Servidor** > **Cargos**
2. Clique com botão direito no cargo desejado
3. Selecione **Copiar ID** (precisa ter Modo Desenvolvedor ativado)

## Fluxo de Login

1. Usuário acessa `/login.html`
2. Clica no botão "Entrar com Discord"
3. É redirecionado para autorização do Discord
4. Discord redireciona para `/api/v1/callback?code=...`
5. Servidor troca o code por access token
6. Servidor busca dados do usuário e seus cargos
7. Servidor gera JWT com o role apropriado
8. Usuário é redirecionado para `/index.html?token=...`
9. Frontend salva o token e recarrega a página

## Testando

1. Inicie o servidor:
   ```bash
   npm start
   ```

2. Acesse: `http://localhost:3001/login.html`

3. Clique em "Entrar com Discord"

4. Após autorizar, você será redirecionado para o painel

## Solução de Problemas

### Erro "DISCORD_CLIENT_ID não configurado"
- Verifique se o arquivo `.env` existe na raiz do projeto
- Confirme que as variáveis estão definidas corretamente

### Erro "Código OAuth2 ausente"
- Verifique se a URL de callback está correta no Discord Developer Portal
- Confirme que a variável `DISCORD_REDIRECT_URI` está correta

### Usuário não tem permissões corretas
- Verifique se o ID do cargo está correto em `auth.js`
- Confirme que o usuário realmente possui o cargo no servidor Discord
- Veja os logs do servidor para verificar quais cargos foram detectados

### Token expirado
- Os tokens JWT têm validade de 7 dias
- Usuário precisa fazer login novamente após expiração
