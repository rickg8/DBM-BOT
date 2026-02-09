# Comando /hierarquia

## Como usar

Digite no chat do Discord:
```
/hierarquia
```

## O que o comando faz

O comando `/hierarquia` lista todos os membros do servidor organizados por cargo, da hierarquia mais alta para a mais baixa:

### Exemplo de saída:

```
# 📋 Hierarquia DBM

## 👑 Fundador
- Richard
- Breno

## ⭐ Comandante
- João
- Maria

## 🎖️ Sub-Comandante
- Pedro
- Ana

## 🔰 Equipe DBM
- Carlos
- Julia
- Lucas

## 🏍️ Piloto
- Marcos
- Fernanda
- Gabriel
- Beatriz

*Total de membros: 25*
```

## Configuração

Para ajustar os cargos exibidos, edite o arquivo `hierarchy-config.js`:

```javascript
roles: [
    { 
        id: '1368980327342542918',  // ID do cargo no Discord
        name: '👑 Fundador',         // Nome exibido
        emoji: '👑',                 // Emoji do cargo
        description: 'Fundador da organização'
    },
    // ... mais cargos
]
```

### Como obter o ID de um cargo:

1. Ative o **Modo Desenvolvedor** no Discord
   - Configurações > Avançado > Modo Desenvolvedor (ativar)

2. Vá em **Configurações do Servidor** > **Cargos**

3. Clique com **botão direito** no cargo desejado

4. Selecione **"Copiar ID"**

5. Cole o ID no arquivo `hierarchy-config.js`

## Permissões necessárias

O bot precisa das seguintes permissões:
- ✅ `MessageContent` - Para ler mensagens
- ✅ `Guilds` - Para acessar informações do servidor
- ✅ `SendMessages` - Para enviar a hierarquia no chat

## Troubleshooting

### O comando não responde
- Verifique se o bot está online
- Confirme que o intent `MessageContent` está ativado no Discord Developer Portal

### Alguns cargos não aparecem
- Verifique se os IDs dos cargos em `hierarchy-config.js` estão corretos
- Confirme que o bot pode ver os membros do servidor

### Erro "Este comando só funciona em servidores!"
- O comando só funciona em canais de servidor, não em DMs

## Personalização

Você pode adicionar mais cargos ou remover os existentes editando o array `roles` em `hierarchy-config.js`.

A ordem dos cargos no arquivo determina a ordem de exibição (do topo para baixo da hierarquia).
