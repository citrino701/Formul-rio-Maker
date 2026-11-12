import React from "react";
import { AlertTriangle, Trash2, X, Loader2 } from "lucide-react";

interface DeleteFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  formTitle: string;
  responseCount?: number;
  isDeleting?: boolean;
}

export const DeleteFormModal: React.FC<DeleteFormModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  formTitle,
  responseCount = 0,
  isDeleting = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 border-2 border-slate-200 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs">
              <Trash2 className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                Excluir Formulário?
              </h3>
              <p className="text-xs text-slate-500">
                Esta ação não pode ser desfeita.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs sm:text-sm text-slate-700 leading-relaxed">
          <p>
            Tem certeza de que deseja excluir permanentemente o formulário{" "}
            <strong className="text-slate-900 font-bold">"{formTitle}"</strong>?
          </p>

          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Aviso Importante</span>
            </div>
            <p className="text-rose-700">
              O formulário deixará de aceitar respostas, os links públicos gerados ficarão indisponíveis e{" "}
              <strong>
                {responseCount === 1
                  ? "1 resposta recebida será apagada"
                  : `${responseCount} respostas recebidas serão apagadas`}
              </strong>{" "}
              da base de dados.
            </p>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs sm:text-sm font-bold transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Excluindo...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Sim, Excluir Formulário</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
