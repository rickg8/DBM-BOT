@echo off
setlocal enabledelayedexpansion

echo [*] Inicializando repositorio Git e fazendo commit...
echo.

cd /d "C:\Users\Richard\Desktop\DBM-main"

REM Verificar se git esta instalado
git --version > nul 2>&1
if errorlevel 1 (
    echo [!] Git nao encontrado. Instalando via chocolatey...
    choco install git -y > nul 2>&1
)

REM Configurar git
echo [*] Configurando git...
git config --global user.name "Richard" > nul 2>&1
git config --global user.email "seu_email@github.com" > nul 2>&1

REM Inicializar repositorio se nao existir
if not exist ".git" (
    echo [*] Inicializando novo repositorio...
    git init
    git branch -M main
) else (
    echo [+] Repositorio ja existe
)

REM Adicionar arquivos
echo [*] Adicionando arquivos...
git add -A

REM Fazer commit
echo [*] Fazendo commit...
git commit -m "feat: adicionar sincronizacao de protocolos do outro bot Discord" -m "- Criar modulo discordSync.js para ler mensagens do bot 1410682630801854566
- Monitor automatico do canal 1458929318892666922
- Parser de embeds e mensagens de protocolo
- Sincronizacao automatica com API local a cada 1 minuto
- Integracao com server.js"

REM Adicionar remote se nao existir
git remote | findstr /R "^origin$" > nul
if errorlevel 1 (
    echo [*] Remote origin nao existe. Pulando...
    echo [!] Execute manualmente: git remote add origin https://github.com/USUARIO/DBM-main.git
    echo [!] E depois: git push -u origin main
) else (
    echo [*] Fazendo push...
    git push origin main
)

echo.
echo [+] Concluido!
pause
