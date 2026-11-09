@echo off
chcp 65001 >nul
title Borneo Etam CCTV - Home Lab Server & Storage Hub

echo =========================================================================
echo    🚀 BORNEO ETAM CCTV & KOMPUTER KASIR - HOME LAB COMMAND CENTER
echo =========================================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js belum terdeteksi di sistem Windows ini.
    echo Silakan install Node.js dari https://nodejs.org/ (versi 18 ke atas).
    pause
    exit /b 1
)

cd /d "%~dp0"

echo [1/3] Memeriksa file konfigurasi (.env)...
if not exist ".env" (
    if exist "..\.env" (
        echo [OK] Menggunakan file .env dari folder utama.
    ) else (
        echo [INFO] File .env belum ditemukan di folder homelab.
        echo Menyalin dari .env.example...
        copy ".env.example" ".env" >nul
        echo [PERHATIAN] Silakan lengkapi SUPABASE_SERVICE_ROLE_KEY di homelab\.env bila perlu.
    )
) else (
    echo [OK] File homelab\.env siap.
)

echo.
echo [2/3] Memeriksa Storage Target 10TB...
if exist "Z:\" (
    echo [OK] Harddisk Z:\ Storage 10TB terdeteksi dan aktif!
) else (
    echo [PERHATIAN] Drive Z:\ belum terdeteksi.
    echo Server tetap dapat berjalan dan data sementara diarahkan ke storage lokal.
)

echo.
echo [3/3] Menjalankan Server & Background Sync Worker...
echo.
echo -------------------------------------------------------------------------
echo [INFO] Tekan Ctrl+C untuk menghentikan server kapan saja.
echo -------------------------------------------------------------------------
echo.

start "Borneo Sync Worker" cmd /k "chcp 65001 >nul && cd /d "%~dp0" && node sync-worker.mjs"
node server.mjs

pause
