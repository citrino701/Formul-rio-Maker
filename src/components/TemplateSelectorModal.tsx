import React from "react";
import { X, FolderOpen, FileText, CheckCircle2, ArrowRight } from "lucide-react";
import { FormStructure } from "../types";
import {
  SAMPLE_BTG_FORM,
  SAMPLE_ONBOARDING_FORM,
  SAMPLE_SATISFACTION_FORM
} from "../data/sampleForms";

interface TemplateSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (form: FormStructure) => void;
}

export const TemplateSelectorModal: React.FC<TemplateSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate
}) => {
  if (!isOpen) return null;

  const templates = [
    {
      form: SAMPLE_BTG_FORM,
      tag: "Do documento PDF enviado",
      badgeColor: "bg-indigo-100 text-indigo-800",
      description:
        "Formulário completo com 6 blocos estruturados: Contexto essencial, O negócio na visão da equipe, Público & mercado, Marca & comunicação, Objetivos e Confidencialidade."
    },
    {
      form: SAMPLE_ONBOARDING_FORM,
      tag: "Processo Operacional",
      badgeColor: "bg-emerald-100 text-emerald-800",
      description:
        "Ficha de alinhamento com dados fiscais, responsáveis pelo projeto, canais preferidos de comunicação e prazos."
    },
    {
      form: SAMPLE_SATISFACTION_FORM,
      tag: "Feedback & CSAT",
      badgeColor: "bg-amber-100 text-amber-800",
      description:
        "Pesquisa ágil com nota NPS de 0 a 10, caixas de seleção de pontos fortes e campo livre para sugestões."
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <FolderOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Modelos Prontos de Formulário</h2>
              <p className="text-xs text-slate-500">
                Selecione um modelo para carregar imediatamente ou adaptar
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of templates */}
        <div className="p-6 overflow-y-auto space-y-3.5">
          {templates.map((tpl, idx) => {
            const totalFields = tpl.form.sections.reduce((a, s) => a + s.fields.length, 0);
            return (
              <div
                key={idx}
                className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${tpl.badgeColor}`}>
                      {tpl.tag}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      {tpl.form.sections.length} seções • {totalFields} perguntas
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                    {tpl.form.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {tpl.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onSelectTemplate(tpl.form);
                    onClose();
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white hover:bg-indigo-600 text-slate-700 hover:text-white border border-slate-300 hover:border-indigo-600 rounded-xl text-xs font-semibold shadow-2xs transition-all shrink-0"
                >
                  <span>Carregar Modelo</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200/60"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
