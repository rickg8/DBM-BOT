# DBM — Evento de Patrulha

Aplicação simples (Node + Express + SQLite) para registrar e acompanhar protocolos do evento DBM. Interface web inclusa para lançar protocolos, ver ranking e acompanhar o dashboard.

## Requisitos

- Node.js 18+ (recomendado)

## Instalação

```bash
npm install
```

## Executar

```bash
# porta padrão 3001; pode alterar com PORT
PORT=4000 npm start
```

O servidor expõe a API em `/api/v1` e serve os arquivos estáticos (index, ranking, dashboard).

## Status disponíveis

- ABERTO
- FINALIZADO
- ADVERTENCIA (não contabiliza duração)
- NAO PARTICIPANDO (não contabiliza duração)
- INATIVO (não contabiliza duração)

## Rotas principais (API)

- `GET /api/v1/pilotos` — lista pilotos
- `GET /api/v1/veiculos` — lista veículos
- `GET /api/v1/status` — lista status cadastrados
- `GET /api/v1/protocolos` — lista protocolos
- `POST /api/v1/protocolos` — cria protocolo
- `PUT /api/v1/protocolos/:id` — edita protocolo
- `PUT /api/v1/protocolos/:id/finalizar` — finaliza protocolo (ou ajusta status)
- `DELETE /api/v1/protocolos/:id` — remove protocolo

## Páginas

- `index.html` — lançar protocolos e ver por piloto
- `ranking.html` — ranking de horas finalizadas
- `dashboard.html` — visão geral, últimos lançamentos e horas por dia

## 🔄 Sincronização Automática de Protocolos (NEW!)

A partir dessa versão, o servidor **monitora automaticamente** mensagens de protocolo de outro bot Discord e sincroniza com sua API local.

### Como Funciona

1. O sincronizador conecta ao Discord
2. Monitora o canal: `1458929318892666922`
3. Lê mensagens do bot: `1410682630801854566`
4. Faz parsing automático de embeds com dados de protocolo
5. Sincroniza dados com a API `/api/v1/protocolos`
6. Executa a cada 1 minuto

### Dados Extraídos Automaticamente

- ✅ Data do protocolo
- ✅ Hora de início
- ✅ Hora de término (retorno)
- ✅ Piloto
- ✅ Veículo
- ✅ Duração (calculada automaticamente)
- ✅ Status (FINALIZADO/ABERTO)

### Configuração Necessária

Seu `.env` deve conter:
```env
DISCORD_TOKEN=seu_token_do_bot
PORT=3001
```

O sincronizador iniciará **automaticamente** quando você rodar `npm start`.

### Logs

O sincronizador mostra logs quando:
- Conecta ao Discord
- Encontra protocolos novos
- Sincroniza com sucesso
- Detecta erros

## Notas

- Banco SQLite em `data/dbm.sqlite` (criado automaticamente).
- Só há um veículo habilitado por padrão: `Yamara Tenere`.
- Sincronizador usa `discordSync.js` - módulo separado para melhor organização.
