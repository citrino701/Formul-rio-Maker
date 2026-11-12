import React, { useState } from "react";
import {
  Download,
  X,
  Printer,
  FileCheck,
  Table,
  CheckCircle,
  FileText,
  Building,
  Settings
} from "lucide-react";
import { FormStructure, FormAnswers, PdfExportConfig } from "../types";
import { exportFormToPdf } from "../utils/pdfExport";

interface PdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: FormStructure;
  answers: FormAnswers;
  onNativePrint: () => void;
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  isOpen,
  onClose,
  form,
  answers,
  onNativePrint
}) => {
  const [mode, setMode] = useState<"blank" | "spec" | "answers">("blank");
  const [companyName, setCompanyName] = useState("");
  const [includeGuidelines, setIncludeGuidelines] = useState(true);
  const [includeHelpText, setIncludeHelpText] = useState(true);
  const [paperSize, setPaperSize] = useState<"a4" | "letter">("a4");
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const totalQuestions = form.sections.reduce((acc, s) => acc + s.fields.length, 0);
  const totalAnswers = Object.keys(answers).filter((k) => {
    const val = answers[k];
    return val !== undefined && val !== "" && (!Array.isArray(val) || val.length > 0);
  }).length;

  const handleExport = () => {
    setIsExporting(true);
    try {
      const config: PdfExportConfig = {
        mode,
        companyName: companyName.trim(),
        includeGuidelines,
        includeHelpText,
        includeNotes: true,
        paperSize
      };
      exportFormToPdf(form, config, mode === "answers" ? answers : undefined);
      onClose();
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      alert("Houve um problema ao compilar o PDF. Tente novamente.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Exportar Formulário em PDF</h2>
              <p className="text-xs text-slate-500">
                Gere um documento PDF profissional com vetorização nítida
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

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Mode Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Escolha o Formato de PDF
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Option 1: Blank for Print */}
              <button
                type="button"
                onClick={() => setMode("blank")}
                className={`p-3 rounded-xl border text-left transition-all ${
                  mode === "blank"
                    ? "bg-rose-50/50 border-rose-500 text-rose-950 ring-1 ring-rose-500"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <FileText className={`w-5 h-5 mb-1.5 ${mode === "blank" ? "text-rose-600" : "text-slate-400"}`} />
                <p className="text-xs font-bold">Impressão Limpa</p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Linhas pontilhadas e caixas para preenchimento físico
                </p>
              </button>

              {/* Option 2: Table Specification */}
              <button
                type="button"
                onClick={() => setMode("spec")}
                className={`p-3 rounded-xl border text-left transition-all ${
                  mode === "spec"
                    ? "bg-rose-50/50 border-rose-500 text-rose-950 ring-1 ring-rose-500"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Table className={`w-5 h-5 mb-1.5 ${mode === "spec" ? "text-rose-600" : "text-slate-400"}`} />
                <p className="text-xs font-bold">Tabela Técnica</p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Ficha com Nº, Pergunta, Tipo, Obrigatória e Indicação
                </p>
              </button>

              {/* Option 3: With Answers */}
              <button
                type="button"
                onClick={() => setMode("answers")}
                className={`p-3 rounded-xl border text-left transition-all ${
                  mode === "answers"
                    ? "bg-rose-50/50 border-rose-500 text-rose-950 ring-1 ring-rose-500"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <FileCheck className={`w-5 h-5 mb-1.5 ${mode === "answers" ? "text-rose-600" : "text-slate-400"}`} />
                <p className="text-xs font-bold">Com Respostas</p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Relatório com respostas preenchidas ({totalAnswers}/{totalQuestions})
                </p>
              </button>
            </div>
          </div>

          {/* Company / Organization Name */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              <Building className="w-3.5 h-3.5" />
              <span>Nome da Empresa ou Consultoria no Cabeçalho (Opcional)</span>
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Ex: Koyo Creative / Sua Empresa"
              className="w-full p-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-rose-500"
            />
          </div>

          {/* Additional Options */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Configurações do Documento
            </span>

            <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeHelpText}
                onChange={(e) => setIncludeHelpText(e.target.checked)}
                className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
              />
              <span>Incluir instruções de apoio e dicas dos campos</span>
            </label>

            {form.internalGuidelines && form.internalGuidelines.length > 0 && (
              <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeGuidelines}
                  onChange={(e) => setIncludeGuidelines(e.target.checked)}
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                />
                <span>Incluir bloco de orientações de uso interno</span>
              </label>
            )}

            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs text-slate-600">Tamanho da Folha:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPaperSize("a4")}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                    paperSize === "a4" ? "bg-rose-600 text-white" : "bg-white border border-slate-200 text-slate-700"
                  }`}
                >
                  A4 (Padrão)
                </button>
                <button
                  type="button"
                  onClick={() => setPaperSize("letter")}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                    paperSize === "letter" ? "bg-rose-600 text-white" : "bg-white border border-slate-200 text-slate-700"
                  }`}
                >
                  Carta (Letter)
                </button>
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>Seções: {form.sections.length}</span>
            <span>Total de Perguntas: {totalQuestions}</span>
            <span>Respostas salvas: {totalAnswers}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              onNativePrint();
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Imprimir no Navegador</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-200/60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? "Gerando PDF..." : "Baixar Arquivo PDF"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
