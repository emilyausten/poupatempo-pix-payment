# Script para configurar automaticamente a API Key no Supabase
# Este script usa a API do Supabase para configurar a variável de ambiente

Write-Host "🔧 Configurando API Key automaticamente..." -ForegroundColor Green

# Verificar se o arquivo .env existe
if (Test-Path ".env") {
    Write-Host "✅ Arquivo .env encontrado" -ForegroundColor Green
} else {
    Write-Host "📝 Criando arquivo .env..." -ForegroundColor Yellow
    New-Item -Path ".env" -ItemType File
}

# Adicionar a API Key ao arquivo .env
$envContent = @"
# API Key da nova API PIX
PIX_API_KEY=sk_e7293087d05347013fe02189d192accc599b43cac3cec885

# Outras variáveis de ambiente (se existirem)
"@

Set-Content -Path ".env" -Value $envContent -Encoding UTF8

Write-Host "✅ API Key configurada no arquivo .env" -ForegroundColor Green

# Verificar se o Supabase CLI está disponível
try {
    $null = npx supabase --version 2>$null
    Write-Host "✅ Supabase CLI disponível via npx" -ForegroundColor Green
    
    Write-Host "🔧 Tentando configurar via Supabase CLI..." -ForegroundColor Yellow
    
    # Tentar configurar via CLI (pode não funcionar sem login)
    try {
        npx supabase secrets set PIX_API_KEY=sk_e7293087d05347013fe02189d192accc599b43cac3cec885
        Write-Host "✅ API Key configurada via CLI" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Não foi possível configurar via CLI (pode precisar de login)" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "⚠️ Supabase CLI não disponível" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📋 Configuração manual necessária:" -ForegroundColor Cyan
Write-Host "1. Acesse: https://supabase.com/dashboard" -ForegroundColor White
Write-Host "2. Selecione seu projeto" -ForegroundColor White
Write-Host "3. Vá em Settings > API > Secrets" -ForegroundColor White
Write-Host "4. Adicione: PIX_API_KEY=sk_e7293087d05347013fe02189d192accc599b43cac3cec885" -ForegroundColor Yellow
Write-Host ""
Write-Host "🧪 Para testar:" -ForegroundColor Cyan
Write-Host "npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "✅ Configuração concluída!" -ForegroundColor Green 