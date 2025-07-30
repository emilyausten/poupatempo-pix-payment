import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncPayCustomer {
  name: string;
  email: string;
  phone?: string;
  cpf: string;
  externaRef?: string;
  address?: {
    street?: string;
    streetNumber?: string;
    complement?: string;
    zipCode?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

interface SyncPayItem {
  title: string;
  quantity: number;
  unitPrice: number;
  tangible: boolean;
}

interface SyncPayRequest {
  amount: number;
  customer: SyncPayCustomer;
  items: SyncPayItem[];
  postbackUrl: string;
  pix?: {
    expiresInDays?: number;
  };
  metadata?: string;
  traceable?: boolean;
  ip?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 SyncPay Edge Function - Iniciando processamento...');
    console.log('🔍 Método da requisição:', req.method);
    console.log('🔍 Headers da requisição:', Object.fromEntries(req.headers.entries()));

    let payload;
    const body = await req.text();
    console.log('📦 Body bruto recebido:', body);
    
    if (!body || body.trim() === '') {
      console.error('❌ Body vazio ou inválido');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Body da requisição vazio',
          details: 'Nenhum dados foi enviado na requisição'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    try {
      payload = JSON.parse(body);
      console.log('📦 Payload parseado:', JSON.stringify(payload, null, 2));
    } catch (jsonError) {
      console.error('❌ Erro ao fazer parse do JSON:', jsonError);
      console.error('❌ Body que causou erro:', body);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'JSON inválido',
          details: jsonError.message,
          received_body: body
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // API Key da SyncPay (obtida do Supabase Secrets)
    const SYNCPAY_API_KEY = Deno.env.get('SYNCPAY_API_KEY');
    const SYNCPAY_API_URL = 'https://api.syncpay.pro/v1/gateway/api/';

    if (!SYNCPAY_API_KEY) {
      console.error('❌ SYNCPAY_API_KEY não configurada');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'API Key da SyncPay não configurada',
          details: 'Configure a SYNCPAY_API_KEY nos secrets do Supabase'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validar CPF antes de enviar
    const cpf = payload.customer?.cpf?.replace(/\D/g, '');
    if (!cpf || cpf.length !== 11) {
      console.error('❌ CPF inválido:', cpf);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'CPF inválido',
          details: 'CPF deve ter 11 dígitos numéricos'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Payload conforme modelo completo da documentação SyncPay
    const valorEmReais = Math.max(payload.amount || 1.49, 1.49);
    
    console.log(`💰 Valor em reais: R$ ${valorEmReais}`);
    
    const syncPayPayload = {
      "amount": valorEmReais, // Valor em reais (não centavos)
      "customer": {
        "name": payload.customer?.name || "Cliente",
        "email": payload.customer?.email || "cliente@email.com", 
        "cpf": cpf,
        "phone": payload.customer?.phone?.replace(/\D/g, '') || "9999999999",
        "externaRef": "",
        "address": {
          "street": payload.customer?.address?.street || "Rua Exemplo",
          "streetNumber": payload.customer?.address?.streetNumber || "123",
          "complement": payload.customer?.address?.complement || "",
          "zipCode": payload.customer?.address?.zipCode?.replace(/\D/g, '') || "01000000",
          "neighborhood": payload.customer?.address?.neighborhood || "Centro",
          "city": payload.customer?.address?.city || "São Paulo",
          "state": payload.customer?.address?.state || "SP",
          "country": payload.customer?.address?.country || "br"
        }
      },
      "checkout": {
        "utm_source": "poupatempo_app",
        "utm_medium": "app_mobile", 
        "utm_campaign": "agendamento_servicos",
        "utm_term": payload.items?.[0]?.title?.toLowerCase().replace(/\s+/g, '_') || "servico",
        "utm_content": "pagamento_pix_checkout"
      },
      "pix": {
        "expiresInDays": 2
      },
      "items": [{
        "title": payload.items?.[0]?.title || "Serviço Poupatempo",
        "quantity": 1,
        "unitPrice": valorEmReais,
        "tangible": true
      }],
      "postbackUrl": payload.postbackUrl || "https://exemplo.com/webhook",
      "metadata": payload.metadata || `Agendamento ${payload.items?.[0]?.title || 'Serviço'} - Cliente: ${payload.customer?.name || 'Cliente'}`,
      "traceable": true
    };

    console.log('📤 Enviando para SyncPay:', JSON.stringify(syncPayPayload, null, 2));

    // Autenticação: API Key codificada em Base64 (conforme especificação)
    const encodedApiKey = btoa(SYNCPAY_API_KEY);
    console.log('🔑 Usando API Key codificada em Base64');

    let response;
    let responseText;
    
    try {
      response = await fetch(SYNCPAY_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${encodedApiKey}` // API Key codificada em Base64
        },
        body: JSON.stringify(syncPayPayload),
      });

      responseText = await response.text();
      console.log('📥 Status SyncPay:', response.status);
      console.log('📥 Response Headers:', Object.fromEntries(response.headers.entries()));
      console.log('📥 Resposta SyncPay:', responseText);

    } catch (fetchError) {
      console.error('❌ Erro no fetch para SyncPay:', fetchError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Erro de conectividade com SyncPay',
          details: fetchError.message,
          sent_payload: syncPayPayload
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!response.ok) {
      console.error('❌ Erro na API SyncPay:', response.status, responseText);
      
      // Retornar erro detalhado para debug
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Erro SyncPay ${response.status}`,
          details: responseText,
          sent_payload: syncPayPayload,
          api_url: SYNCPAY_API_URL,
          headers_sent: {
            'Content-Type': 'application/json',
            'Authorization': `Basic [HIDDEN FOR SECURITY]`
          }
        }),
        { 
          status: 200, // Retornar 200 mas com success: false
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
      console.log('✅ Resposta SyncPay processada:', data);
    } catch (parseError) {
      console.error('❌ Erro ao fazer parse da resposta SyncPay:', parseError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Resposta SyncPay inválida',
          details: responseText,
          parse_error: parseError.message
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verificar se a SyncPay retornou erro na resposta
    if (data.errCode || data.error || data.status === 'error') {
      console.error('❌ SyncPay retornou erro:', data);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Erro SyncPay: ${data.errCode || data.error}`,
          details: data.message || JSON.stringify(data),
          sent_payload: syncPayPayload
        }),
        { 
          status: 400, // Retornar erro real
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verificar se a resposta tem os dados essenciais do PIX conforme resposta da SyncPay
    if (!data.paymentCode && !data.paymentCodeBase64) {
      console.error('❌ Resposta SyncPay sem código PIX:', data);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Resposta SyncPay sem código PIX',
          details: 'A resposta não contém paymentCode ou paymentCodeBase64',
          response_data: data
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verificar se a resposta tem status de sucesso
    if (data.status !== 'success') {
      console.error('❌ SyncPay não retornou sucesso:', data);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `SyncPay retornou status: ${data.status}`,
          details: data.message || JSON.stringify(data)
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }


    // Formatar resposta compatível baseada no formato real da SyncPay
    const formattedResponse = {
      success: true,
      data: {
        id: data.idTransaction || data.client_id,
        status: data.status_transaction || data.status || 'pending',
        pix_code: data.paymentCode,
        pix_qr_code: data.paymentCode,
        pixCode: data.paymentCode,
        qrCode: data.paymentCode,
        qr_code_base64: data.paymentCodeBase64,
        amount: valorEmReais,
        paymentMethod: 'pix',
        transaction: data
      }
    };

    console.log('📋 Resposta formatada:', formattedResponse);

    return new Response(
      JSON.stringify(formattedResponse),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Erro geral na edge function:', error);
    console.error('❌ Stack trace:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Erro interno do servidor',
        details: error.message,
        stack: error.stack
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});