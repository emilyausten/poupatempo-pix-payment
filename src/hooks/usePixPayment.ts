import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Interfaces para nova API PIX
interface PixCustomer {
  name: string;
  email: string;
  phone: string;
  documentType: string;
  document: string;
}

interface PixItem {
  title: string;
  amount: number;
  quantity: number;
  tangible: boolean;
  externalRef: string;
}

interface PixAPIRequest {
  amount: number;
  method: string;
  metadata: {
    sellerExternalRef: string;
  };
  customer: PixCustomer;
  items: PixItem[];
}

interface PixResponse {
  id: string;
  status: string;
  pix_code?: string;
  pix_qr_code?: string;
  qr_code_base64?: string;
  pixCode?: string;
  qrCode?: string;
  transaction?: any;
  pix?: any;
}

interface PixRequest {
  postbackUrl: string;
  paymentMethod: 'pix';
  customer: {
    name: string;
    email: string;
    phone: string;
    document: {
      number: string;
      type: 'cpf';
    };
  };
  shipping: {
    fee: number;
    address: {
      street: string;
      streetNumber: string;
      zipCode: string;
      neighborhood: string;
      city: string;
      state: string;
      country: string;
      complement?: string;
    };
  };
  items: {
    title: string;
    description: string;
    unitPrice: number;
    quantity: number;
    tangible: boolean;
  }[];
  isInfoProducts: boolean;
}

interface PaymentDetails {
  id: string;
  status: string;
  pix_code?: string;
  pix_qr_code?: string;
  qr_code_base64?: string;
}

export const usePixPayment = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTransaction = async (payload: PixRequest): Promise<PixResponse> => {
    console.log('🚀 PIX PAYMENT - Criando transação com payload:', payload);
    
    // Validação do valor mínimo da nova API (R$ 5,00 = 500 centavos)
    const totalAmount = payload.items.reduce((total, item) => total + (item.unitPrice * item.quantity), 0);
    if (totalAmount < 5.00) {
      throw new Error('Valor mínimo para pagamento via PIX é de R$ 5,00');
    }
    
    console.log(`💰 Valor total calculado: R$ ${totalAmount} (será enviado em centavos)`);
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('🚀 PIX PAYMENT - Criando transação via API...');
      
      // Mapear payload para formato da nova API PIX
      const pixPayload: PixAPIRequest = {
        amount: Math.round(totalAmount * 100), // Enviar em centavos
        method: "PIX",
        metadata: {
          sellerExternalRef: `SPO_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        },
        customer: {
          name: payload.customer.name,
          email: payload.customer.email,
          phone: payload.customer.phone.replace(/\D/g, ''),
          documentType: "CPF",
          document: payload.customer.document.number.replace(/\D/g, '')
        },
        items: payload.items.map((item, index) => ({
          title: item.title,
          amount: Math.round(item.unitPrice * 100), // Valor em centavos
          quantity: item.quantity,
          tangible: item.tangible,
          externalRef: `item_${index}_${Date.now()}`
        }))
      };

      console.log('📤 Payload completo para PIX API:', JSON.stringify(pixPayload, null, 2));

      console.log('📤 Enviando para PIX API via Edge Function:', pixPayload);

      const { data, error } = await supabase.functions.invoke('pix-payment', {
        body: pixPayload,
      });

      console.log('📥 Resposta completa da edge function:', { data, error });

      if (error) {
        console.error('❌ Erro na edge function:', error);
        throw new Error(`Erro na edge function: ${error.message}`);
      }

      if (!data) {
        console.error('❌ Data é null/undefined:', data);
        throw new Error('Edge function retornou dados vazios');
      }

      console.log('📋 Data recebida:', data);

      if (!data.success) {
        console.error('❌ API PIX retornou erro:', data);
        console.error('📤 Payload que foi enviado:', data.sent_payload);
        console.error('🔗 URL da API:', data.api_url);
        throw new Error(`Erro PIX API: ${data.error || 'Erro desconhecido'} - Detalhes: ${data.details}`);
      }

      console.log('✅ Resposta PIX API recebida:', data.data);
      
      return data.data;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido na API PIX';
      console.error('❌ PIX PAYMENT - Erro:', errorMessage);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getPaymentDetails = async (transactionId: string): Promise<PaymentDetails> => {
    console.log('🔍 PIX PAYMENT - Buscando detalhes da transação:', transactionId);
    
    try {
      // Nova API não possui endpoint público para buscar detalhes
      // Retornamos um placeholder para manter compatibilidade
      console.log('⚠️ PIX PAYMENT - Endpoint de consulta não disponível');
      
      return {
        id: transactionId,
        status: 'pending',
        pix_code: '',
        pix_qr_code: '',
        qr_code_base64: '',
      };
    } catch (err) {
      console.error('❌ PIX PAYMENT - Erro ao buscar detalhes:', err);
      throw err;
    }
  };

  return {
    createTransaction,
    getPaymentDetails,
    loading,
    error,
  };
};

export type { PixRequest, PixResponse, PixCustomer, PixItem }; 