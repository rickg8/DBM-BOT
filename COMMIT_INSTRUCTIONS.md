# Instruções de Push para GitHub

O código foi adicionado/modificado, mas é necessário fazer upload para seu GitHub.

## Option 1: Usando GitHub Desktop (Mais Fácil)

1. Abra o **GitHub Desktop**
2. Clique em **File** → **Add Local Repository**
3. Selecione a pasta: `C:\Users\Richard\Desktop\DBM-main`
4. Selecione **Yes** para criar um novo repositório
5. Em **Current Changes**, todos os arquivos aparecerão
6. Na caixa **Summary**, escreva: `feat: adicionar sincronização de protocolos do outro bot Discord`
7. Na caixa **Description**, escreva:
   ```
   - Criar módulo discordSync.js para ler mensagens do bot 1410682630801854566
   - Monitor automático do canal 1458929318892666922
   - Parser de embeds e mensagens de protocolo
   - Sincronização automática com API local a cada 1 minuto
   - Integração com server.js
   ```
8. Clique em **Commit to main**
9. Clique em **Publish repository** (se for a primeira vez)
10. Clique em **Push origin** (próximas vezes)

## Opção 2: Usando Terminal (Requer Git Instalado)

```powershell
cd c:\Users\Richard\Desktop\DBM-main

# Configurar git (primeira vez)
git config --global user.name "suo_nome"
git config --global user.email "seu_email@github.com"

# Inicializar repositório
git init

# Adicionar todos os arquivos
git add .

# Fazer commit
git commit -m "feat: adicionar sincronização de protocolos do outro bot Discord

- Criar módulo discordSync.js para ler mensagens do bot 1410682630801854566
- Monitor automático do canal 1458929318892666922
- Parser de embeds e mensagens de protocolo
- Sincronização automática com API local a cada 1 minuto
- Integração com server.js"

# Adicionar remote (se não tiver)
git remote add origin https://github.com/seu_usuario/DBM-main.git

# Fazer push
git push -u origin main
```

## Opção 3: Via Web GitHub

1. Vá para https://github.com/new
2. Crie um novo repositório chamado `DBM-main`
3. Copie a pasta `C:\Users\Richard\Desktop\DBM-main` via upload web ou use GitHub Desktop depois

---

## Arquivos Modificados

- ✅ `discordSync.js` - **NOVO** - Módulo de sincronização
- ✅ `server.js` - Modificado para integrar sincronizador
- ✅ `.env` - Já tinha o token configurado
- ✅ `package.json` - Dependências já estão OK

## O que o código faz

**discordSync.js:**
- Conecta a um bot Discord
- Monitora o canal especificado (1458929318892666922)
- Lê mensagens do outro bot (1410682630801854566)
- Faz parse de embeds com dados de protocolo:
  - Número do protocolo
  - Data
  - Hora início
  - Hora retorno (fim)
  - Piloto
  - Veículo
  - Duração
  - Status
- Sincroniza automaticamente com sua API local (`/api/v1/protocolos`)
- Executa sincronização a cada 1 minuto
- Evita duplicação de protocolos

## Como Usar

1. Inicie o servidor: `npm start`
2. O sincronizador lerá automaticamente as mensagens do canal
3. Os protocolos aparecerão em `http://localhost:3001/api/v1/protocolos`
4. Acesse o dashboard: `http://localhost:3001/dashboard.html`

---

**Próximas Etapas:**
- [ ] Instalar Git ou abrir GitHub Desktop
- [ ] Fazer Commit
- [ ] Fazer Push para GitHub
- [ ] Testar o sincronizador com o bot ativo
