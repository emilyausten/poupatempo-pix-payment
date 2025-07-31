import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface Customer {
  name: string;
  email: string;
  phone: string;
  documentType: string;
  document: string;
}

interface Item {
  title: string;
  amount: number;
  quantity: number;
  tangible: boolean;
  externalRef: string;
}

interface PixRequest {
  amount: number;
  method: string;
  metadata: {
    sellerExternalRef: string;
  };
  customer: Customer;
  items: Item[];
}

interface PixResponse {
  status: boolean;
  data: {
    id: string;
    amount: number;
    customer: {
      id: string;
      externalRef: string | null;
      name: string;
      email: string;
      phone: string;
      documentType: string;
      document: string;
      createdAt: string;
    };
    items: {
      id: string;
      title: string;
      amount: number;
      quantity: number;
      tangible: boolean;
      externalRef: string;
      transactionId: string;
      createdAt: string;
      updatedAt: string;
    }[];
    method: string;
    status: string;
    boleto: any;
    card: any;
    pix: {
      id: string;
      qrcode: string;
      qrcodeUrl: string;
      expirationDate: string;
      copyPaste: string | null;
      createdAt: string;
      updatedAt: string;
      transactionId: string;
    };
    description: string | null;
    installments: any;
    metadata: any;
    paidAt: string | null;
    postbackUrl: string | null;
    createdAt: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 PIX Payment Edge Function - Iniciando processamento...');
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

    // API Key da nova API (obtida do Supabase Secrets)
    const PIX_API_KEY = Deno.env.get('PIX_API_KEY') || 'sk_e7293087d05347013fe02189d192accc599b43cac3cec885';
    
    console.log('🔑 API Key configurada:', PIX_API_KEY ? 'Sim' : 'Não');
    console.log('🔑 API Key (primeiros 10 chars):', PIX_API_KEY ? PIX_API_KEY.substring(0, 10) + '...' : 'Não configurada');
    
    // URL da API baseada na documentação Witetec
    const PIX_API_URL = 'https://api.witetec.net/transactions';

    if (!PIX_API_KEY) {
      console.error('❌ PIX_API_KEY não configurada');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'API Key da PIX não configurada',
          details: 'Configure a PIX_API_KEY nos secrets do Supabase'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validar CPF antes de enviar
    const cpf = payload.customer?.document?.replace(/\D/g, '');
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

    // Calcular valor total em centavos (mínimo R$ 5,00 = 500 centavos)
    // O payload já vem com amount calculado do frontend
    const amountInCents = payload.amount || Math.max(Math.round((payload.items?.[0]?.unitPrice || 5) * 100), 500);
    
    console.log(`💰 Valor em centavos: ${amountInCents} centavos`);
    
    // Gerar referência única para o vendedor
    const sellerExternalRef = `SPO_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Usar o payload com valores dinâmicos do frontend
    const pixPayload: PixRequest = {
      amount: amountInCents,
      method: "PIX",
      metadata: {
        sellerExternalRef: sellerExternalRef
      },
      customer: {
        name: payload.customer?.name || "Cliente",
        email: payload.customer?.email || "cliente@email.com",
        phone: payload.customer?.phone?.replace(/\D/g, '') || "9999999999",
        documentType: "CPF",
        document: cpf
      },
      items: [
        {
          title: payload.items?.[0]?.title || "Serviço Poupatempo",
          amount: amountInCents,
          quantity: 1,
          tangible: true,
          externalRef: `item_0_${Date.now()}`
        }
      ]
    };

    console.log('📤 Payload que será enviado:', JSON.stringify(pixPayload, null, 2));
    console.log('📤 Verificação do amount:', pixPayload.amount);
    console.log('📤 Verificação do items[0].amount:', pixPayload.items[0].amount);
    console.log('📤 Tipo do amount:', typeof pixPayload.amount);
    console.log('📤 Tipo do items[0].amount:', typeof pixPayload.items[0].amount);

    let response;
    let responseText;
    
    try {
      console.log('🌐 Fazendo requisição para:', PIX_API_URL);
      console.log('🔑 Headers enviados:', {
        'Content-Type': 'application/json',
        'x-api-key': PIX_API_KEY ? PIX_API_KEY.substring(0, 10) + '...' : 'Não configurada'
      });
      
      response = await fetch(PIX_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': PIX_API_KEY
        },
        body: JSON.stringify(pixPayload),
      });

      responseText = await response.text();
      console.log('📥 Status PIX API:', response.status);
      console.log('📥 Response Headers:', Object.fromEntries(response.headers.entries()));
      console.log('📥 Resposta PIX API:', responseText);

    } catch (fetchError) {
      console.error('❌ Erro no fetch para PIX API:', fetchError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Erro de conectividade com PIX API',
          details: fetchError.message,
          sent_payload: pixPayload
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!response.ok) {
      console.error('❌ Erro na PIX API:', response.status, responseText);
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Erro PIX API ${response.status}`,
          details: responseText,
          sent_payload: pixPayload,
          api_url: PIX_API_URL
        }),
        { 
          status: 200, // Retornar 200 mas com success: false
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    let data: PixResponse;
    try {
      data = JSON.parse(responseText);
      console.log('✅ Resposta PIX API processada:', data);
    } catch (parseError) {
      console.error('❌ Erro ao fazer parse da resposta PIX API:', parseError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Resposta PIX API inválida',
          details: responseText,
          parse_error: parseError.message
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verificar se a API retornou sucesso
    if (!data.status || !data.data) {
      console.error('❌ PIX API não retornou sucesso:', data);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'PIX API não retornou sucesso',
          details: JSON.stringify(data)
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verificar se a resposta tem os dados essenciais do PIX
    if (!data.data.pix || !data.data.pix.qrcode) {
      console.error('❌ Resposta PIX API sem código PIX:', data);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Resposta PIX API sem código PIX',
          details: 'A resposta não contém dados do PIX',
          response_data: data
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Formatar resposta compatível com o formato anterior
    const formattedResponse = {
      success: true,
      data: {
        id: data.data.id,
        status: data.data.status,
        pix_code: data.data.pix.copyPaste || data.data.pix.qrcode,
        pix_qr_code: data.data.pix.qrcode,
        pixCode: data.data.pix.copyPaste || data.data.pix.qrcode,
        qrCode: data.data.pix.qrcodeUrl, // Para exibir a imagem do QR Code (base64)
        qr_code_base64: data.data.pix.qrcodeUrl,
        copyPaste: data.data.pix.copyPaste || data.data.pix.qrcode, // Código PIX real para copiar e colar (fallback para qrcode se copyPaste for null)
        amount: amountInCents / 100, // Converter de volta para reais para compatibilidade
        paymentMethod: 'pix',
        transaction: data.data,
        pix: data.data.pix
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