import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Interfaces para SyncPay API
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

interface SyncPayAPIRequest {
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

interface SyncPayResponse {
  id: string;
  status: string;
  pix_code?: string;
  pix_qr_code?: string;
  qr_code_base64?: string;
  pixCode?: string;
  qrCode?: string;
  transaction?: any;
}

interface SyncPayRequest {
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

export const useSyncPay = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTransaction = async (payload: SyncPayRequest): Promise<SyncPayResponse> => {
    console.log('🚀 SYNCPAY - Criando transação com payload:', payload);
    
    // Validação do valor mínimo da SyncPay (R$ 1,49 = 149 centavos)
    const totalAmount = payload.items.reduce((total, item) => total + (item.unitPrice * item.quantity), 0);
    if (totalAmount < 1.49) {
      throw new Error('Valor mínimo para pagamento via PIX é de R$ 1,49');
    }
    
    console.log(`💰 Valor total calculado: R$ ${totalAmount} (será enviado em reais)`);
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('🚀 SYNCPAY - Criando transação via API...');
      
      // Mapear payload para formato SyncPay API
      const syncPayPayload: SyncPayAPIRequest = {
        amount: Math.max(totalAmount, 1.49), // Enviar em reais (não centavos)
        customer: {
          name: payload.customer.name,
          email: payload.customer.email,
          cpf: payload.customer.document.number,
          phone: payload.customer.phone,
          address: {
            street: payload.shipping.address.street,
            streetNumber: payload.shipping.address.streetNumber,
            complement: payload.shipping.address.complement,
            zipCode: payload.shipping.address.zipCode,
            neighborhood: payload.shipping.address.neighborhood,
            city: payload.shipping.address.city,
            state: payload.shipping.address.state,
            country: payload.shipping.address.country
          }
        },
        items: payload.items.map(item => ({
          title: item.title,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          tangible: item.tangible
        })),
        postbackUrl: payload.postbackUrl
      };

      console.log('📤 Enviando para SyncPay via Edge Function:', syncPayPayload);

      const { data, error } = await supabase.functions.invoke('syncpay-payment', {
        body: syncPayPayload,
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
        console.error('❌ API SyncPay retornou erro:', data);
        console.error('📤 Payload que foi enviado:', data.sent_payload);
        console.error('🔗 URL da API:', data.api_url);
        console.error('🔑 Headers enviados:', data.headers_sent);
        throw new Error(`Erro SyncPay: ${data.error || 'Erro desconhecido'} - Detalhes: ${data.details}`);
      }

      console.log('✅ Resposta SyncPay recebida:', data.data);
      
      return data.data;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido na API SyncPay';
      console.error('❌ SYNCPAY - Erro:', errorMessage);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getPaymentDetails = async (transactionId: string): Promise<PaymentDetails> => {
    console.log('🔍 SYNCPAY - Buscando detalhes da transação:', transactionId);
    
    try {
      // SyncPay não possui endpoint público para buscar detalhes
      // Retornamos um placeholder para manter compatibilidade
      console.log('⚠️ SYNCPAY - Endpoint de consulta não disponível');
      
      return {
        id: transactionId,
        status: 'pending',
        pix_code: '',
        pix_qr_code: '',
        qr_code_base64: '',
      };
    } catch (err) {
      console.error('❌ SYNCPAY - Erro ao buscar detalhes:', err);
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

export type { SyncPayRequest, SyncPayResponse, SyncPayCustomer, SyncPayItem };