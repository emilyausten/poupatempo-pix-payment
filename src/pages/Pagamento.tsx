

import React, { useState } from 'react';
import { User, Home, Calendar, MessageCircle, Copy, Check, Shield, Lock, CheckCircle, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import PaymentModal from '@/components/PaymentModal';
import { supabase } from '@/integrations/supabase/client';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAutoPushNotifications } from '@/hooks/useAutoPushNotifications';
import { usePixPayment } from '@/hooks/usePixPayment';
import { useRateLimit } from '@/hooks/useRateLimit';

interface PaymentResponse {
  status: number;
  message: string;
  data?: {
    id: string;
    status: string;
    amount: number;
    paymentMethod: string;
    pix?: {
      qrcode: string;
      expirationDate: string;
    };
    qrCode?: string;
    copyPaste?: string;
    pixCode?: string;
  };
  error?: string;
}

const Pagamento = () => {
  console.log('🔥 POUPATEMPO - Página de pagamento carregada!');
  const navigate = useNavigate();
  const { toast } = useToast();
  const [paymentData, setPaymentData] = useState<PaymentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [pixGeneratedAt, setPixGeneratedAt] = useState<Date | null>(null);
  
  // Inicializar sistema de notificações
  const { triggers, sendNotification } = usePushNotifications({ debug: true });
  const { sendPaymentGeneratedMessage, sendPaymentConfirmedMessage } = useAutoPushNotifications();
  
  // Inicializar PIX Payment e rate limiting
  const { createTransaction, loading: pixLoading, error: pixError } = usePixPayment();
  const rateLimit = useRateLimit({
    maxAttempts: 3,
    windowMs: 15 * 60 * 1000, // 15 minutos
    storageKey: 'pix_generation'
  });

  const getServiceInfo = () => {
    const storedService = localStorage.getItem('servicoSelecionado');
    if (storedService) {
      return JSON.parse(storedService);
    }
    // Fallback caso não tenha serviço no localStorage
    return {
      nome: "RG - Primeira Via",
      valor: 63.31
    };
  };

  // Get user data from localStorage
  const getUserData = () => {
    const dadosPessoais = localStorage.getItem('dadosPessoais');
    if (dadosPessoais) {
      return JSON.parse(dadosPessoais);
    }
    // Fallback caso não tenha dados pessoais
    return {
      nomeCompleto: "Usuario Poupatempo",
      email: "usuario@email.com",
      cpf: "12345678901"
    };
  };

  // Get address data from localStorage
  const getAddressData = () => {
    const enderecoData = localStorage.getItem('enderecoData');
    if (enderecoData) {
      return JSON.parse(enderecoData);
    }
    return {
      cep: "01000000",
      rua: "Rua Exemplo",
      numero: "123",
      bairro: "Centro",
      cidade: "São Paulo",
      estado: "SP"
    };
  };

  const serviceInfo = getServiceInfo();
  const userData = getUserData();
  const addressData = getAddressData();

  const handleEmitirPagamento = async () => {
    console.log('🔥 POUPATEMPO - Iniciando geração de PIX via nova API...');
    
    // Validar valor mínimo antes de processar
    if (serviceInfo.valor < 5.00) {
      toast({
        title: "Valor Inválido",
        description: "O valor mínimo para pagamento via PIX é de R$ 5,00",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);

    try {
      // Primeiro gerar o PIX, só salvar no banco se der sucesso
      let pixOrderId = null;

      // Criar payload para nova API PIX
      const pixPayload = {
        postbackUrl: `${window.location.origin}/payment-webhook`,
        paymentMethod: "pix" as const,
        customer: {
          name: userData.nomeCompleto,
          email: userData.email || "test@example.com",
          phone: userData.telefone?.replace(/\D/g, '') || "11999999999",
          document: {
            number: userData.cpf?.replace(/\D/g, '') || "11144477735",
            type: "cpf" as const
          }
        },
        shipping: {
          fee: 0,
          address: {
            street: addressData.rua || "Rua Exemplo",
            streetNumber: addressData.numero || "123",
            zipCode: addressData.cep?.replace(/\D/g, '') || "01000000",
            neighborhood: addressData.bairro || "Centro",
            city: addressData.cidade || "São Paulo",
            state: addressData.estado || "SP",
            country: "Brasil",
            complement: ""
          }
        },
        items: [{
          title: serviceInfo.nome,
          description: `Serviço ${serviceInfo.nome}`,
          unitPrice: serviceInfo.valor, // Enviar valor em reais
          quantity: 1,
          tangible: true
        }],
        isInfoProducts: false
      };

      console.log('🚀 Enviando para nova API PIX:', pixPayload);

      // Chamar nova API PIX
      const result = await createTransaction(pixPayload);
      
      console.log('✅ Resposta da nova API PIX:', result);

      // Agora que deu sucesso, salvar no banco de dados
      const pixOrderData = {
        customer_name: userData.nomeCompleto,
        customer_email: userData.email,
        customer_phone: userData.telefone?.replace(/\D/g, '') || "11999999999",
        customer_cpf: userData.cpf.replace(/\D/g, ''),
        address_street: addressData.rua,
        address_street_number: addressData.numero,
        address_neighborhood: addressData.bairro,
        address_city: addressData.cidade,
        address_state: addressData.estado,
        address_zip_code: addressData.cep?.replace(/\D/g, ''),
        address_country: 'Brasil',
        product_name: serviceInfo.nome,
        quantity: 1,
        amount: serviceInfo.valor,
        status: 'pending',
        transaction_id: result.id,
        pix_code: result.pix_code || result.pixCode || result.qrCode
      };

      console.log('💾 Salvando pedido no banco...', pixOrderData);

      const { error: dbError } = await supabase
        .from('pix_orders')
        .insert(pixOrderData);

      if (dbError) {
        console.error('❌ Erro ao salvar no banco:', dbError);
        // Não quebrar o fluxo se der erro para salvar no banco
      }

      // Enviar WhatsApp
      const pixCode = result.pix_code || result.pixCode || result.qrCode || result.pix_qr_code;
      if (pixCode) {
        try {
          const whatsappData = {
            customerName: userData.nomeCompleto,
            customerPhone: `55${userData.telefone?.replace(/\D/g, '') || "11999999999"}`,
            pixCode: pixCode,
            amount: serviceInfo.valor,
            serviceName: serviceInfo.nome
          };

          await supabase.functions.invoke('send-whatsapp-pix', {
            body: whatsappData
          });
        } catch (whatsappError) {
          console.error('❌ Erro ao enviar WhatsApp:', whatsappError);
        }
      }

      // Formatar resposta para compatibilidade
      console.log('🔍 Resultado da nova API PIX antes da formatação:', result);
      
      const formattedResult = {
        status: 200,
        message: "PIX gerado com sucesso",
        data: {
          id: result.id,
          qrCode: result.pix_qr_code, // Imagem base64 para exibir o QR Code
          qrCodeBase64: result.qr_code_base64,
          copyPaste: result.pix_code || result.pixCode, // Código PIX para copiar e colar
          pixCode: result.pix_code || result.pixCode, // Código PIX para copiar e colar
          status: result.status,
          amount: serviceInfo.valor,
          paymentMethod: "PIX"
        }
      };
      
      console.log('🔍 Resposta formatada:', formattedResult);
      console.log('🔍 QR Code extraído:', formattedResult.data.qrCode);
      console.log('🔍 Sale ID usado:', formattedResult.data.id);
      
      setPaymentData(formattedResult);
      console.log('🔍 PaymentData setado:', JSON.stringify(formattedResult, null, 2));
      setPixGeneratedAt(new Date());
      setShowModal(false);
      
      // Notificações
      sendPaymentGeneratedMessage();
      sendNotification(
        '🔔 Guia de pagamento emitida',
        `💳 Sua guia de pagamento de R$ ${serviceInfo.valor.toFixed(2).replace('.', ',')} foi gerada! Realize o pagamento via PIX.`,
        'payment-generated'
      );
      
      toast({
        title: "Sucesso!",
        description: `Guia PIX de R$ ${serviceInfo.valor.toFixed(2).replace('.', ',')} gerada com sucesso!`,
      });

    } catch (error) {
      console.error('❌ Erro na geração do PIX:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar PIX';
      
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Função para simular pagamento confirmado (apenas para demo)
  const handleSimularPagamentoConfirmado = () => {
    // 🔔 5. Notificação automática de pagamento confirmado
    sendPaymentConfirmedMessage();
    
    // Notificação local também
    sendNotification(
      '🔔 Pagamento confirmado',
      '🎉 Pagamento confirmado com sucesso! Seu agendamento está garantido. Em instantes, você receberá todos os detalhes.',
      'payment-confirmed'
    );
    
    toast({
      title: "🎉 Pagamento Confirmado!",
      description: "Seu agendamento está garantido! Você receberá todas as informações no seu email.",
    });
  };

  // Função para extrair o código PIX corretamente
  const getPixCode = () => {
    console.log('🔍 getPixCode chamada - paymentData:', paymentData);
    
    if (!paymentData?.data) {
      console.log('❌ paymentData ou paymentData.data é null');
      return null;
    }
    
    // Para o QR Code (imagem), usar qrCode
    const qrCode = paymentData.data.qrCode;
    console.log('🔍 QR Code extraído em getPixCode:', qrCode);
    
    return qrCode || null;
  };

  const getCopyPasteCode = () => {
    console.log('🔍 getCopyPasteCode chamada - paymentData:', paymentData);
    
    if (!paymentData?.data) {
      console.log('❌ paymentData ou paymentData.data é null');
      return null;
    }
    
    // Para o código PIX copia e cola, usar copyPaste ou pixCode
    const copyPaste = paymentData.data.copyPaste || paymentData.data.pixCode;
    console.log('🔍 Copy Paste Code extraído:', copyPaste);
    
    return copyPaste || null;
  };

  const handleCopyPixCode = async () => {
    const copyPasteCode = getCopyPasteCode();
    if (copyPasteCode) {
      try {
        await navigator.clipboard.writeText(copyPasteCode);
        setCopied(true);
        toast({
          title: "Copiado!",
          description: "Código PIX copiado para a área de transferência",
        });
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        toast({
          title: "Erro",
          description: "Erro ao copiar código PIX",
          variant: "destructive",
        });
      }
    }
  };

  const handleVoltar = () => {
    // Verificar se é o serviço de licenciamento para voltar para dados adicionais
    const servico = localStorage.getItem('servicoSelecionado');
    if (servico) {
      const servicoData = JSON.parse(servico);
      if (servicoData.nome === 'Licenciamento (CRLV-e)') {
        navigate('/dados-adicionais');
        return;
      }
    }
    navigate('/agendamento');
  };

  const handleLogoClick = () => {
    navigate('/');
  };

  const pixCode = getPixCode();
  console.log('🔍 pixCode final para exibição:', pixCode);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <img 
            src="/lovable-uploads/77c50366-3c6d-4d7b-b8a7-4fa2fc4e1fa3.png" 
            alt="Poupatempo" 
            className="h-8 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={handleLogoClick}
          />
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <Home className="w-4 h-4 text-white" />
            </div>
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto p-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Form Header */}
          <div className="bg-blue-600 text-white px-4 py-3">
            <h1 className="text-lg font-medium">Pagamento</h1>
          </div>

          {/* Form Content */}
          <div className="p-4 space-y-6">

            {!paymentData ? (
              <>
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-800">Resumo do Pedido</h2>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Serviço:</span>
                      <span className="text-gray-800">{serviceInfo.nome}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Valor:</span>
                      <span className="text-gray-800 font-medium">R$ {serviceInfo.valor.toFixed(2).replace('.', ',')}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <div className="space-y-2 text-sm text-gray-700">
                    <p><span className="font-medium text-gray-800">Atenção:</span> Emitir a guia e não realizar o pagamento impedirá a solicitação de novos agendamentos até que a pendência seja regularizada.</p>
                  </div>
                </div>

                {/* Atenção Section */}
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <h3 className="font-semibold text-yellow-800 mb-3">Atenção:</h3>
                  <ul className="space-y-2 text-sm text-yellow-700">
                    <li>• Efetue o pagamento em até 30 minutos</li>
                    <li>• Após a confirmação, você receberá um email de confirmação</li>
                    <li>• Um aviso breve para lembrete será enviado no WhatsApp</li>
                    <li>• Compareça no local na data agendada</li>
                  </ul>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button 
                    variant="outline" 
                    className="flex-1 bg-gray-300 text-gray-700 border-gray-300 hover:bg-gray-400 h-10"
                    onClick={handleVoltar}
                  >
                    Voltar
                  </Button>
                  <Button 
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white h-10"
                    onClick={() => setShowModal(true)}
                  >
                    Emitir Guia de Pagamento
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Warning message for generated PIX */}
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 mb-4">
                  <p className="text-sm text-yellow-800">
                    <span className="font-medium">Atenção:</span> Após a geração do PIX, você terá 30 minutos para efetuar o pagamento.
                  </p>
                </div>

                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-800 text-center">PIX Gerado com Sucesso!</h2>
                  
                  {/* QR Code display */}
                  {pixCode ? (
                    <div className="flex justify-center">
                      <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                        <img
                          src={pixCode}
                          alt="QR Code PIX"
                          className="w-48 h-48 mx-auto"
                          style={{ maxWidth: "100%", height: "auto" }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <p className="text-sm text-red-700">
                        <span className="font-medium">Erro:</span> Código PIX não foi gerado corretamente. Tente gerar novamente.
                      </p>
                    </div>
                  )}

                  {/* PIX Code */}
                  {getCopyPasteCode() && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Código PIX (Copia e Cola)
                      </label>
                      <div className="relative">
                        <textarea
                          value={getCopyPasteCode()?.replace(/Q3PAY_PAGAMENTOS_LTDA/g, 'Poupatempo_pagamentos') || ''}
                          readOnly
                          className="w-full p-3 border border-gray-300 rounded-lg text-xs font-mono bg-gray-50 resize-none"
                          rows={4}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="absolute top-2 right-2"
                          onClick={handleCopyPixCode}
                        >
                          {copied ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Payment Info */}
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Valor:</span>
                        <span className="font-medium">R$ {serviceInfo.valor.toFixed(2).replace('.', ',')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">ID da Transação:</span>
                        <span className="font-mono text-xs">{paymentData.data?.id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Status:</span>
                        <span className="text-orange-600 font-medium">Aguardando Pagamento</span>
                      </div>
                      {pixGeneratedAt && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Expira em:</span>
                          <span className="text-gray-800">
                            {(() => {
                              const expirationTime = new Date(pixGeneratedAt.getTime() + 30 * 60 * 1000); // 30 minutos após a geração
                              return expirationTime.toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                              });
                            })()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Selos de Segurança PIX */}
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-center gap-4 text-xs">
                      <div className="flex items-center gap-1 text-blue-700">
                        <Shield className="w-3 h-3" />
                        <span>PIX Seguro</span>
                      </div>
                      <div className="flex items-center gap-1 text-blue-700">
                        <Lock className="w-3 h-3" />
                        <span>Criptografado</span>
                      </div>
                      <div className="flex items-center gap-1 text-blue-700">
                        <CheckCircle className="w-3 h-3" />
                        <span>Banco Central</span>
                      </div>
                    </div>
                  </div>

                  {pixCode ? (
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <p className="text-sm text-green-700">
                        <span className="font-medium">Como pagar:</span> Abra o aplicativo do seu banco, escaneie o QR Code ou copie e cole o código PIX acima para efetuar o pagamento.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <p className="text-sm text-red-700">
                        <span className="font-medium">Erro:</span> Não foi possível gerar o código PIX. Tente novamente.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3 pt-4">
                  
                  <Button 
                    variant="outline" 
                    className="bg-gray-300 text-gray-700 border-gray-300 hover:bg-gray-400 h-10"
                    onClick={() => {
                      setPaymentData(null);
                      setPixGeneratedAt(null);
                    }}
                  >
                    Gerar Novo PIX
                  </Button>
                  <Button 
                    className="bg-blue-600 hover:bg-blue-700 text-white h-10"
                    onClick={() => navigate('/')}
                  >
                    Finalizar
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      <PaymentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={handleEmitirPagamento}
        loading={loading}
      />

      {/* Footer */}
      <div className="bg-slate-800 text-white mt-auto">
        <div className="max-w-md mx-auto px-4 py-8 text-center">
          <img 
            src="/lovable-uploads/a01f8b20-e4c2-4d31-bfe8-4c0e6d88ddd4.png" 
            alt="Gov.br" 
            className="h-12 mx-auto mb-4"
          />
          <h2 className="text-lg font-medium mb-2">Portal OficiaI</h2>
          <p className="text-sm text-gray-300 mb-6">
            Ministério da Gestão e da Inovação em Serviços Públicos
          </p>
          <div className="border-t border-gray-600 pt-4">
            <p className="text-xs text-gray-400">
              Todos os direitos reservados
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pagamento;

