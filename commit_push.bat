@echo off
echo ==========================================
echo      AUTOMACAO DE UPLOAD GITHUB
echo ==========================================

:: Verifica se o git foi iniciado
if not exist .git (
    echo [AVISO] Repositorio nao inicializado.
    echo Inicializando git...
    git init
    echo.
    echo Configurando repositorio remoto: https://github.com/rickg8/DBM-BOT.git
    git remote add origin https://github.com/rickg8/DBM-BOT.git
    git branch -M main
)

:: Garante que o link do repositorio esta correto (caso tenha mudado)
git remote set-url origin https://github.com/rickg8/DBM-BOT.git 2>NUL

echo.
echo [1/3] Adicionando arquivos...
git add .

echo.
echo [2/3] Criando commit...
set /p msg="Mensagem do Commit (Enter para padrao): "
if "%msg%"=="" set msg="update: atualizacao automatica do projeto"
git commit -m "%msg%"

echo.
echo [3/3] Enviando para o GitHub...
git push -u origin main

echo.
echo ==========================================
echo            CONCLUIDO!
echo ==========================================
pause