# Migração da API SyncPay para Nova API PIX

## Resumo da Migração

Este documento descreve a migração da API SyncPay para uma nova API de PIX baseada na especificação OpenAPI fornecida.

## Principais Mudanças

### 1. Nova Edge Function
- **Arquivo**: `supabase/functions/pix-payment/index.ts`
- **Endpoint**: `/transactions`
- **Método**: POST
- **API Key**: `sk_e7293087d05347013fe02189d192accc599b43cac3cec885`

### 2. Novo Hook React
- **Arquivo**: `src/hooks/usePixPayment.ts`
- **Interface**: Mantém compatibilidade com `useSyncPay`
- **Validação**: Valor mínimo alterado de R$ 1,49 para R$ 5,00

### 3. Atualizações na Página de Pagamento
- **Arquivo**: `src/pages/Pagamento.tsx`
- **Hook**: Migrado de `useSyncPay` para `usePixPayment`
- **Validação**: Atualizada para valor mínimo de R$ 5,00

## Diferenças da API

### SyncPay (Antiga)
- **Valor mínimo**: R$ 1,49
- **Formato**: Valores em reais
- **Autenticação**: Basic Auth com API Key em Base64
- **Endpoint**: `https://api.syncpay.pro/v1/gateway/api/`

### Nova API PIX
- **Valor mínimo**: R$ 5,00
- **Formato**: Valores em centavos
- **Autenticação**: Header `x-api-key`
- **Endpoint**: `https://api.siliumpay.com.br/transactions`

## Estrutura do Payload

### Nova API PIX
```json
{
  "amount": 500,
  "method": "PIX",
  "metadata": {
    "sellerExternalRef": "SPO_1234567890_abc123"
  },
  "customer": {
    "name": "Nome do Cliente",
    "email": "cliente@email.com",
    "phone": "11999999999",
    "documentType": "CPF",
    "document": "12345678901"
  },
  "items": [
    {
      "title": "Serviço Poupatempo",
      "amount": 500,
      "quantity": 1,
      "tangible": true,
      "externalRef": "item_0_1234567890"
    }
  ]
}
```

## Configuração do Supabase

### Secrets Necessários
```bash
# Configurar no Supabase Dashboard > Settings > API > Secrets
PIX_API_KEY=sk_e7293087d05347013fe02189d192accc599b43cac3cec885
```

### Edge Functions
```toml
[functions.pix-payment]
verify_jwt = false
```

## Compatibilidade

A migração mantém total compatibilidade com a interface existente:

- ✅ Mesma estrutura de payload de entrada
- ✅ Mesma estrutura de resposta
- ✅ Mesmos métodos do hook (`createTransaction`, `getPaymentDetails`)
- ✅ Mesmas propriedades de estado (`loading`, `error`)

## Validações Atualizadas

### Valor Mínimo
- **Antes**: R$ 1,49
- **Agora**: R$ 5,00

### Formato de Valores
- **Antes**: Reais (ex: 63.31)
- **Agora**: Centavos (ex: 6331)

## Logs e Debug

A nova implementação mantém os mesmos logs detalhados:
- 🚀 Início do processamento
- 📦 Payload recebido
- 📤 Payload enviado para API
- 📥 Resposta da API
- ✅ Sucesso ou ❌ Erro

## Próximos Passos

1. **Deploy das Edge Functions**:
   ```bash
   supabase functions deploy pix-payment
   ```

2. **Configurar API Key**:
   - Acessar Supabase Dashboard
   - Settings > API > Secrets
   - Adicionar `PIX_API_KEY`

3. **Testar Integração**:
   - Verificar logs das edge functions
   - Testar geração de PIX
   - Validar QR Code

4. **Monitoramento**:
   - Verificar logs de erro
   - Monitorar taxa de sucesso
   - Acompanhar tempo de resposta

## Rollback

Em caso de problemas, é possível fazer rollback:

1. Reverter importação em `Pagamento.tsx`:
   ```typescript
   import { useSyncPay } from '@/hooks/useSyncPay';
   ```

2. Reverter hook:
   ```typescript
   const { createTransaction, loading: syncPayLoading, error: syncPayError } = useSyncPay();
   ```

3. Reverter validação de valor mínimo para R$ 1,49

## Arquivos Modificados

- ✅ `supabase/functions/pix-payment/index.ts` (novo)
- ✅ `src/hooks/usePixPayment.ts` (novo)
- ✅ `src/pages/Pagamento.tsx` (modificado)
- ✅ `supabase/config.toml` (modificado)
- ✅ `supabase/functions/verify-payment-status/index.ts` (comentários)
- ✅ `supabase/functions/check-all-pending-payments/index.ts` (comentários)

## Status da Migração

- ✅ Nova edge function criada
- ✅ Novo hook criado
- ✅ Página de pagamento atualizada
- ✅ Configuração do Supabase atualizada
- ✅ Documentação criada
- ⏳ Aguardando deploy e testes 