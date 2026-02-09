# 💾 Persistência de Dados no Render com Disk

## O Problema
SQLite em Render precisa de armazenamento persistente porque a pasta `/data/` é apagada a cada redeploy.

## ✅ Solução: Render Disk (Mais Simples!)

### Passo 1: Adicionar Disk ao seu Service
1. Vá para [https://dashboard.render.com](https://dashboard.render.com)
2. Clique no seu serviço web (DBM Bot)
3. Vá em **"Disks"** (no menu lateral)
4. Clique em **"Add Disk"**

### Passo 2: Configurar o Disco
- **Name**: `dbm-data` (ou qualquer nome)
- **Mount Path**: `/data` (onde o SQLite salva os dados)
- **Size**: 1 GB (suficiente)

5. Clique em **"Create"**

Pronto! Agora todos os dados serão persistidos! 🎉

### Passo 3: Teste
1. Adicione 4 protocolos novamente
2. Atualize a página
3. Vá para outras abas
4. Volte e verifique se os dados continuam

## Quando Funciona?
✅ Redeploys - dados permanecem
✅ Atualizações - nada é perdido
✅ 24/7 rodando - dados salvos

## Se Precisar PostgreSQL no Futuro
Pode sempre migrar depois refatorando o código para async/await.

---

**Pronto! Seus dados agora são seguros!** 🔐
