@echo off
chcp 65001 >nul
title Maquette M comme Maman
rem Lance la base, le serveur Django et la maquette, puis ouvre le navigateur.
rem Rien n est modifie dans back/ : ce script ne fait que demarrer.
set "BACK=%~dp0..\back"
set "PY=%BACK%\.venv\Scripts\python.exe"
if not exist "%PY%" set "PY=python"
echo [1/3] Base PostgreSQL (docker compose)...
pushd "%BACK%"
docker compose up -d
echo [2/3] Serveur Django sur http://localhost:8000 ...
start "Serveur Django (8000)" cmd /k ""%PY%" manage.py runserver 8000"
popd
echo [3/3] Maquette sur http://localhost:3200 ...
start "Maquette (3200)" cmd /k ""%PY%" "%~dp0serveur-maquette.py""
timeout /t 5 /nobreak >nul
start "" "http://localhost:3200/index.html"
start "" "http://localhost:3200/plein-ecran.html"
echo.
echo Les deux versions sont ouvertes. Fermez les deux fenetres noires pour tout arreter.
pause
