@echo off
chcp 65001 >nul
title Borneo Etam CCTV - Cloudflare Tunnel (Home Lab Gateway)

echo =========================================================================
echo    🌐 BORNEO ETAM CCTV - CLOUDFLARE SECURE TUNNEL SETUP
echo =========================================================================
echo.
echo Tunnel ini menghubungkan Home Lab kantor ke Cloud Supabase secara aman
echo TANPA perlu IP Publik Statis dan TANPA port forwarding di router!
echo.

cd /d "%~dp0"

set "CF_EXE=cloudflared.exe"

where cloudflared >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    set "CF_CMD=cloudflared"
    goto RUN_TUNNEL
)

if exist "%CF_EXE%" (
    set "CF_CMD=%~dp0%CF_EXE%"
    goto RUN_TUNNEL
)

echo [INFO] cloudflared belum ditemukan di komputer ini.
echo Mengunduh cloudflared official dari Cloudflare GitHub...
powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe'"

if exist "%CF_EXE%" (
    echo [OK] Berhasil mengunduh cloudflared.exe!
    set "CF_CMD=%~dp0%CF_EXE%"
    goto RUN_TUNNEL
) else (
    echo [ERROR] Gagal mengunduh otomatis. Silakan unduh manual dari:
    echo https://github.com/cloudflare/cloudflared/releases
    pause
    exit /b 1
)

:RUN_TUNNEL
echo.
echo =========================================================================
echo [LANGKAH AKTIVASI HYBRID]:
echo 1. Tunggu hingga Cloudflare menampilkan link https://xxxx.trycloudflare.com
echo 2. Buka terminal atau jalankan perintah ini untuk menyambungkan ke Cloud:
echo    sb secrets set BORNEO_HOMELAB_URL="https://xxxx.trycloudflare.com"
echo =========================================================================
echo.
echo Menjalankan Tunnel ke http://localhost:8787 ...
echo.

"%CF_CMD%" tunnel --url http://localhost:8787

pause
