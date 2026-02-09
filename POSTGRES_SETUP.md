# 🗄️ Guia de Configuração do Banco de Dados no Render

## O Problema
SQLite no Render não persiste dados porque a pasta `/data/` é apagada a cada redeploy.

## ✅ A Solução: PostgreSQL Gratuito no Render

### Passo 1: Criar um novo PostgreSQL no Render
1. Vá para [https://dashboard.render.com](https://dashboard.render.com)
2. Clique em **"New"** → **"PostgreSQL"**
3. Configure:
   - **Name**: `dbm-postgres` (ou qualquer nome)
   - **Database**: `dbm_db`
   - **User**: `default_user` (automático)
   - **Region**: São Paulo (SP)
   - **Plan**: Free

4. Clique em **"Create Database"**
5. **Copie a "Internal Database URL"** (vai parecer com: `postgresql://user:pass@host:port/db`)

### Passo 2: Adicionar ao seu Web Service
1. Vá para seu serviço web (DBM Bot)
2. Clique em **"Environment"**
3. Adicione a variável:
   - **Key**: `DATABASE_URL`
   - **Value**: Cole a URL do PostgreSQL

4. Clique em **"Manual Deploy"** para redeploy

### Passo 3: Verificar se funciona
- Adicione 4 protocolos novamente
- Atualize a página
- Se aparecer ainda 4 protocolos, funcionou! ✅

---

## Alternativa: Manter SQLite
Se não quiser usar PostgreSQL, pode usar **Render Disk** (armazenamento persistente):
1. Em seu serviço, vá em **"Disks"**
2. Adicione um disco de 1GB
3. Aponte para `/data/` (onde fica o banco SQLite)

---

## Dúvidas?
Se não funcionar, me manda o link do Render para I verificar os logs! 🔗
