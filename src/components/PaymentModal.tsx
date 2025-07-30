
import React from 'react';
import { Loader2 } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}

const PaymentModal = ({ isOpen, onClose, onConfirm, loading }: PaymentModalProps) => {
  // Se o modal está aberto, executar automaticamente a confirmação
  React.useEffect(() => {
    if (isOpen && !loading) {
      console.log('🔥 MODAL - Executando onConfirm automaticamente...');
      onConfirm();
    }
  }, [isOpen, loading, onConfirm]);

  // Se não está carregando, não mostrar nada
  if (!loading) return null;

  // Mostrar apenas um indicador de carregamento simples
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <h4 className="text-lg font-medium text-gray-800 mb-2">Processando Pagamento</h4>
          <p className="text-sm text-gray-600">
            Gerando sua guia de pagamento PIX...
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
