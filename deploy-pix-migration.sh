#!/bin/bash

# Script de Deploy da Migração da API PIX
# Este script facilita o deploy da nova API PIX

echo "🚀 Iniciando deploy da migração da API PIX..."

# Verificar se o Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI não encontrado. Instale com: npm install -g supabase"
    exit 1
fi

# Verificar se estamos no diretório correto
if [ ! -f "supabase/config.toml" ]; then
    echo "❌ Arquivo supabase/config.toml não encontrado. Execute este script na raiz do projeto."
    exit 1
fi

echo "📦 Deployando nova edge function pix-payment..."

# Deploy da nova edge function
supabase functions deploy pix-payment

if [ $? -eq 0 ]; then
    echo "✅ Edge function pix-payment deployada com sucesso!"
else
    echo "❌ Erro no deploy da edge function"
    exit 1
fi

echo ""
echo "🔧 Configuração necessária:"
echo "1. Acesse o Supabase Dashboard"
echo "2. Vá em Settings > API > Secrets"
echo "3. Adicione a variável:"
echo "   PIX_API_KEY=sk_e7293087d05347013fe02189d192accc599b43cac3cec885"
echo ""
echo "🧪 Para testar a migração:"
echo "1. Execute: npm run dev"
echo "2. Acesse a página de pagamento"
echo "3. Tente gerar um PIX"
echo "4. Verifique os logs no Supabase Dashboard"
echo ""
echo "📋 Arquivos modificados:"
echo "- ✅ supabase/functions/pix-payment/index.ts (novo)"
echo "- ✅ src/hooks/usePixPayment.ts (novo)"
echo "- ✅ src/pages/Pagamento.tsx (modificado)"
echo "- ✅ supabase/config.toml (modificado)"
echo ""
echo "📚 Documentação completa em: MIGRACAO_API_PIX.md"
echo ""
echo "🎉 Deploy concluído! A nova API PIX está pronta para uso." 