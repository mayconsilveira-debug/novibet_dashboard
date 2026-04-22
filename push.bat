@echo off
cd /d "C:\Users\User2\Desktop\vanilla-dashboard"
echo Adicionando arquivos...
git add -A
echo Fazendo commit...
git commit -m "fix: remove ES6 export default causing syntax errors"
echo Enviando para GitHub...
git push origin main
echo.
echo Pronto! Pressione qualquer tecla para fechar.
pause > nul
