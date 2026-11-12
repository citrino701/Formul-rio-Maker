import React from "react";
import {
  CheckCircle2,
  X,
  Link2,
  Eye,
  Edit3,
  Sparkles,
  Layers,
  Clock,
  ArrowRight
} from "lucide-react";
import { FormStructure } from "../types";

interface FormCreatedSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: FormStructure | null;
  onOpenShareModal: () => void;
  onOpenPreview: () => void;
  onContinueEditing: () => void;
}

export const FormCreatedSuccessModal: React.FC<FormCreatedSuccessModalProps> = ({
  isOpen,
  onClose,
  form,
  onOpenShareModal,
  onOpenPreview,
  onContinueEditing
}) => {
  if (!isOpen || !form) return null;

  const totalQuestions = form.sections.reduce((acc, s) => acc + s.fields.length, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-slate-300 max-w-lg w-full overflow-hidden animate-in zoom-in-95 flex flex-col">
        {/* Top Header Badge */}
        <div className="p-6 sm:p-8 bg-gradient-to-b from-emerald-50 via-slate-50 to-white border-b-2 border-slate-300 text-center relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-16 h-16 rounded-2xl bg-emerald-600 text-white mx-auto flex items-center justify-center shadow-lg shadow-emerald-600/20 mb-4 animate-bounce">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            Pop-up de Confirmação
          </span>

          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Formulário Criado com Sucesso!
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-sm mx-auto">
            A estrutura foi gerada e já está salva. Você pode gerar o link para enviar a qualquer pessoa agora mesmo.
          </p>
        </div>

        {/* Form Details Card */}
        <div className="p-6 space-y-4">
          <div className="p-4 rounded-2xl bg-slate-50 border-2 border-slate-300">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Título do Formulário
            </p>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
              {form.title}
            </h3>
            {form.subtitle && (
              <p className="text-xs text-slate-600 mt-1">{form.subtitle}</p>
            )}

            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-3 pt-3 border-t border-slate-200 text-xs text-slate-600 font-medium">
              <span className="flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                {form.sections.length} {form.sections.length === 1 ? "Seção" : "Seções"}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                {totalQuestions} {totalQuestions === 1 ? "Pergunta" : "Perguntas"}
              </span>
              {form.estimatedTime && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    {form.estimatedTime}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Action Choice Buttons */}
          <div className="space-y-2 pt-2">
            {/* Primary Action 1: Gerar link para responder */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenShareModal();
              }}
              className="w-full flex items-center justify-center gap-2 p-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm font-bold shadow-sm transition-all hover:scale-101 border border-emerald-700"
            >
              <Link2 className="w-4 h-4" />
              <span>Gerar link para responder</span>
              <ArrowRight className="w-4 h-4 ml-auto" />
            </button>

            {/* Action 2: Modo Respondente / Testar preenchimento */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPreview();
                }}
                className="flex items-center justify-center gap-1.5 p-3 bg-white hover:bg-slate-50 text-slate-700 border-2 border-slate-300 rounded-xl text-xs font-bold transition-colors"
              >
                <Eye className="w-4 h-4 text-indigo-600" />
                <span>Testar Envio</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onContinueEditing();
                }}
                className="flex items-center justify-center gap-1.5 p-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-2 border-indigo-300 rounded-xl text-xs font-bold transition-colors"
              >
                <Edit3 className="w-4 h-4 text-indigo-600" />
                <span>Editar Campos</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
