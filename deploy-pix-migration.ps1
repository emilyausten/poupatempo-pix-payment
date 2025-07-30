# Script de Deploy da Migração da API PIX (PowerShell)
# Este script facilita o deploy da nova API PIX no Windows

Write-Host "🚀 Iniciando deploy da migração da API PIX..." -ForegroundColor Green

# Verificar se o Supabase CLI está instalado
try {
    $null = Get-Command supabase -ErrorAction Stop
    Write-Host "✅ Supabase CLI encontrado" -ForegroundColor Green
} catch {
    Write-Host "❌ Supabase CLI não encontrado. Instale com: npm install -g supabase" -ForegroundColor Red
    exit 1
}

# Verificar se estamos no diretório correto
if (-not (Test-Path "supabase/config.toml")) {
    Write-Host "❌ Arquivo supabase/config.toml não encontrado. Execute este script na raiz do projeto." -ForegroundColor Red
    exit 1
}

Write-Host "📦 Deployando nova edge function pix-payment..." -ForegroundColor Yellow

# Deploy da nova edge function
try {
    supabase functions deploy pix-payment
    Write-Host "✅ Edge function pix-payment deployada com sucesso!" -ForegroundColor Green
} catch {
    Write-Host "❌ Erro no deploy da edge function" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔧 Configuração necessária:" -ForegroundColor Cyan
Write-Host "1. Acesse o Supabase Dashboard" -ForegroundColor White
Write-Host "2. Vá em Settings > API > Secrets" -ForegroundColor White
Write-Host "3. Adicione a variável:" -ForegroundColor White
Write-Host "   PIX_API_KEY=sk_e7293087d05347013fe02189d192accc599b43cac3cec885" -ForegroundColor Yellow
Write-Host ""
Write-Host "🧪 Para testar a migração:" -ForegroundColor Cyan
Write-Host "1. Execute: npm run dev" -ForegroundColor White
Write-Host "2. Acesse a página de pagamento" -ForegroundColor White
Write-Host "3. Tente gerar um PIX" -ForegroundColor White
Write-Host "4. Verifique os logs no Supabase Dashboard" -ForegroundColor White
Write-Host ""
Write-Host "📋 Arquivos modificados:" -ForegroundColor Cyan
Write-Host "- ✅ supabase/functions/pix-payment/index.ts (novo)" -ForegroundColor Green
Write-Host "- ✅ src/hooks/usePixPayment.ts (novo)" -ForegroundColor Green
Write-Host "- ✅ src/pages/Pagamento.tsx (modificado)" -ForegroundColor Green
Write-Host "- ✅ supabase/config.toml (modificado)" -ForegroundColor Green
Write-Host ""
Write-Host "📚 Documentação completa em: MIGRACAO_API_PIX.md" -ForegroundColor Cyan
Write-Host ""
Write-Host "🎉 Deploy concluído! A nova API PIX está pronta para uso." -ForegroundColor Green 