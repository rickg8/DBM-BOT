# DBM — Evento de Patrulha

Aplicação Node + Express + SQLite para registrar e acompanhar protocolos do evento DBM. Inclui painel web (protocolos, ranking, dashboard) e sincronização automática com mensagens de outro bot Discord.

## Requisitos

- Node.js 18+ (recomendado)

## Estrutura

- `public/` — frontend estático (HTML, CSS, JS, assets)
- `server.js` — API + serve estáticos + inicializa sincronizador
- `discordSync.js` — sincronização de protocolos via Discord
- `auth.js` — JWT e middleware
- `data/` — banco SQLite (`dbm.sqlite` criado automaticamente)
- `docs/` — guias de uso/deploy (GitHub, Render, Replit, etc.)

## Instalação

```bash
npm install
```

## Executar

```bash
# porta padrão 3001; pode alterar com PORT
PORT=4000 npm start
```

O servidor expõe a API em `/api/v1` e serve a UI a partir de `public/`.

## Variáveis de ambiente

- `DISCORD_TOKEN` — token do bot (habilita sincronização e bot interno)
- `JWT_SECRET` — segredo para assinar tokens JWT
- `PORT` — porta do servidor (padrão 3001)
- `API_URL` — (opcional) URL base que o sincronizador usa; padrão `http://localhost:3001/api/v1`

Exemplo em `.env.example`.

## Status disponíveis

- ABERTO
- FINALIZADO
- ADVERTENCIA (não contabiliza duração)
- NAO PARTICIPANDO (não contabiliza duração)
- INATIVO (não contabiliza duração)

## Rotas principais (API) – base `/api/v1`

- `GET /pilotos` — lista pilotos
- `GET /veiculos` — lista veículos
- `GET /status` — lista status cadastrados
- `GET /protocolos` — lista protocolos
- `POST /protocolos` — cria protocolo
- `PUT /protocolos/:id` — edita protocolo
- `PUT /protocolos/:id/finalizar` — finaliza protocolo (ou ajusta status)
- `DELETE /protocolos/:id` — remove protocolo

## Páginas (serviço estático)

- `/index.html` — lançar protocolos e ver por piloto
- `/ranking.html` — ranking de horas finalizadas
- `/dashboard.html` — visão geral, últimos lançamentos e horas por dia
- `/login.html` — login simples que gera JWT

## Sincronização Automática de Protocolos (Discord)

- Monitora o canal `1458929318892666922` e lê mensagens do bot `1410682630801854566`.
- Faz parsing de embeds/conteúdo e envia para a API `/api/v1/protocolos`.
- Extrai data, hora de início/fim, piloto, veículo, duração e status.
- Executa a cada 1 minuto; evita duplicar mensagens já sincronizadas.
- Habilite definindo `DISCORD_TOKEN`; `API_URL` é opcional (padrão localhost:3001).

## Docs e guias

- Guias de push, deploy (Render/Replit) e resumo da implementação estão em `docs/`.

## Notas

- Único veículo habilitado por padrão: `Yamara Tenere`.
- Banco fica em `data/dbm.sqlite`; se usar Render, monte o volume em `/data` (veja `docs/RENDER_DISK_SETUP.md`).
