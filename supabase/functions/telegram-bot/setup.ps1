# Setup bot Telegram Borneo Etam, membaca isian dari .env.bot (jika ada) lalu:
#   1) menjalankan migrasi SQL  2) menyimpan secret  3) deploy function  4) memasang webhook
# Prasyarat: sudah `supabase login` sekali.
param(
  [string]$SB = "C:\Users\borneo etam\.gemini\antigravity\brain\a3e490a9-e3ab-4353-b797-c4ce4d503a07\scratch\sbcli\node_modules\.bin\supabase.cmd",
  [string]$ProjectRef = "xukpisovkcflcwuhrzkx"
)
$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
Set-Location (Resolve-Path "$here\..\..\..")

# --- baca .env.bot
$cfg = @{}
$envFile = Join-Path $here ".env.bot"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.*)\s*$') { $cfg[$Matches[1]] = $Matches[2].Trim('"', "'") }
  }
}
function Need($k) { if (-not $cfg[$k]) { throw "Isi $k di $envFile dulu." } ; $cfg[$k] }

$botToken = Need "TELEGRAM_BOT_TOKEN"
$geminiKey = Need "GEMINI_API_KEY"
$tgId = Need "ALLOWED_TELEGRAM_ID"
$appUrl = $cfg["APP_BASE_URL"]
$ownerId = $cfg["OWNER_USER_ID"]

Write-Host "[1/4] Migrasi database..." -ForegroundColor Cyan
& $SB db query --remote=$ProjectRef -f "supabase\migrations\20261106120000_telegram_bot.sql"
if ($LASTEXITCODE -ne 0) { throw "Migrasi gagal." }

if (-not $ownerId) {
  Write-Host "OWNER_USER_ID kosong, mencari otomatis dari tabel user..." -ForegroundColor Yellow
  $json = & $SB db query --remote=$ProjectRef --output-format json "select id, email from auth.users order by created_at limit 5"
  Write-Host $json
  throw "Isi OWNER_USER_ID di .env.bot dengan id user yang benar dari daftar di atas, lalu jalankan ulang."
}

$webhookSecret = [guid]::NewGuid().ToString("N")

Write-Host "[2/4] Menyimpan secret..." -ForegroundColor Cyan
& $SB secrets set --project-ref $ProjectRef `
  "TELEGRAM_BOT_TOKEN=$botToken" "TELEGRAM_WEBHOOK_SECRET=$webhookSecret" `
  "ALLOWED_TELEGRAM_ID=$tgId" "OWNER_USER_ID=$ownerId" "GEMINI_API_KEY=$geminiKey" "APP_BASE_URL=$appUrl"
if ($LASTEXITCODE -ne 0) { throw "Gagal menyimpan secret." }

Write-Host "[3/4] Deploy function..." -ForegroundColor Cyan
& $SB functions deploy telegram-bot --project-ref $ProjectRef --no-verify-jwt
if ($LASTEXITCODE -ne 0) { throw "Deploy gagal." }

Write-Host "[4/4] Pasang webhook Telegram..." -ForegroundColor Cyan
$url = "https://$ProjectRef.supabase.co/functions/v1/telegram-bot"
$res = Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$botToken/setWebhook" `
  -Body @{ url = $url; secret_token = $webhookSecret; allowed_updates = '["message","callback_query"]' }
$res | ConvertTo-Json
Write-Host "Selesai. Buka bot di Telegram, kirim /start." -ForegroundColor Green
