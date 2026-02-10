@echo off
echo ==========================================
echo      LIMPEZA DE BANCO DE DADOS
echo ==========================================
echo.
echo [AVISO] Isso vai apagar todos os protocolos antigos para corrigir o erro.
echo Voce deve FECHAR o servidor (janela do node/npm) antes de continuar.
echo.
pause
echo.
if exist "data\dbm.sqlite" (
    del "data\dbm.sqlite"
    echo [OK] Banco de dados deletado com sucesso.
    echo Ao iniciar o servidor novamente, um novo banco corrigido sera criado.
) else (
    echo [INFO] Arquivo de banco de dados nao encontrado (ja esta limpo).
)
echo.
pause