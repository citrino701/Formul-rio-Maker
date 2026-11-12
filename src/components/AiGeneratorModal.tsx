import React, { useState, useRef } from "react";
import {
  Sparkles,
  X,
  Wand2,
  Loader2,
  AlertCircle,
  UploadCloud,
  FileText,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Check
} from "lucide-react";
import { FormStructure } from "../types";

interface AiGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFormGenerated: (form: FormStructure) => void;
  currentForm?: FormStructure | null;
}

const EXAMPLE_PROMPTS = [
  {
    title: "Briefing de Marca & Diagnóstico",
    prompt:
      "Crie um formulário aprofundado de briefing de marca com blocos: Contexto essencial, O negócio na visão da equipe, Público-alvo, Referências de mercado e Termo de confidencialidade."
  },
  {
    title: "Onboarding de Cliente B2B",
    prompt:
      "Formulário de entrada para novos clientes corporativos: dados cadastrais (CNPJ, razão social), responsáveis pelo projeto, prioridades para os primeiros 60 dias e canais preferidos."
  },
  {
    title: "Pesquisa de Satisfação & NPS",
    prompt:
      "Pesquisa de satisfação com nota NPS de 0 a 10, avaliação por escala de qualidade do atendimento, pontos fortes e sugestões abertas de melhoria."
  },
  {
    title: "Inscrição para Processo Seletivo",
    prompt:
      "Formulário de candidatura com dados pessoais, pretensão salarial, links de LinkedIn e portfólio, nível de senioridade e disponibilidade de início."
  }
];

export const AiGeneratorModal: React.FC<AiGeneratorModalProps> = ({
  isOpen,
  onClose,
  onFormGenerated,
  currentForm
}) => {
  const [inputMethod, setInputMethod] = useState<"text" | "document">("text");
  const [instruction, setInstruction] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showExamples, setShowExamples] = useState(false);

  // Document upload state
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    size: number;
    mimeType: string;
    base64: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setErrorMessage("O documento selecionado é maior que 25MB. Por favor, envie um arquivo menor.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string) || "";
      setUploadedFile({
        name: file.name,
        size: file.size,
        mimeType: file.type || "application/pdf",
        base64
      });
      setErrorMessage(null);
    };
    reader.onerror = () => {
      setErrorMessage("Falha ao ler o arquivo selecionado.");
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setErrorMessage("O documento selecionado é maior que 25MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string) || "";
      setUploadedFile({
        name: file.name,
        size: file.size,
        mimeType: file.type || "application/pdf",
        base64
      });
      setErrorMessage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleCreate = async (customPrompt?: string) => {
    const textToUse = (customPrompt !== undefined ? customPrompt : instruction).trim();

    if (inputMethod === "text" && !textToUse) {
      setErrorMessage("Por favor, digite as instruções do formulário no campo de texto.");
      return;
    }
    if (inputMethod === "document" && !uploadedFile) {
      setErrorMessage("Por favor, envie um documento (PDF, texto ou imagem) para gerar o formulário.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const payload: any = {
        language: "pt-BR",
        prompt: textToUse
      };

      if (inputMethod === "document" && uploadedFile) {
        payload.fileData = uploadedFile.base64;
        payload.mimeType = uploadedFile.mimeType;
        payload.fileName = uploadedFile.name;
      }

      const response = await fetch("/api/generate-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok || !data.success || !data.form) {
        throw new Error(data.error || "Erro ao gerar formulário.");
      }

      onFormGenerated(data.form);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Ocorreu um erro ao gerar o formulário.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-slate-400 max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header - Clicking the title also triggers creation if ready */}
        <div className="px-6 py-5 border-b-2 border-slate-300 flex items-center justify-between bg-gradient-to-r from-indigo-50/80 via-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <button
                type="button"
                onClick={() => handleCreate()}
                disabled={isLoading}
                className="text-left group flex items-center gap-2"
                title="Clique para Criar Formulário"
              >
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  Criar Formulário com IA
                </h2>
                <span className="hidden sm:inline-block text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                  Clique para Criar
                </span>
              </button>
              <p className="text-xs text-slate-500">
                Gera campos personalizados e seções lógicas automaticamente
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-2xl text-xs font-semibold text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Mode Selector Tabs (Instrução por Texto vs Envio de Documento) with dark borders */}
          <div className="flex p-1 bg-slate-100 rounded-2xl border-2 border-slate-300">
            <button
              type="button"
              onClick={() => {
                setInputMethod("text");
                setErrorMessage(null);
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                inputMethod === "text"
                  ? "bg-white text-indigo-950 shadow-xs border-2 border-slate-300"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Wand2 className="w-4 h-4 text-indigo-600" />
              <span>Escrever Instruções</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setInputMethod("document");
                setErrorMessage(null);
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                inputMethod === "document"
                  ? "bg-white text-indigo-950 shadow-xs border-2 border-slate-300"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <UploadCloud className="w-4 h-4 text-indigo-600" />
              <span>Enviar Documento (PDF / TXT)</span>
            </button>
          </div>

          {/* Option A: Text Instruction */}
          {inputMethod === "text" && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Instruções para o Formulário:
                </label>
                <textarea
                  rows={5}
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="Exemplo: Crie um formulário de diagnóstico e onboarding para novos clientes. Preciso de identificação da empresa, canal preferencial de contato, principais objetivos dos primeiros 60 dias, escala de satisfação de 1 a 10 e termo de consentimento..."
                  className="w-full p-4 text-xs sm:text-sm bg-slate-50 border-2 border-slate-300 rounded-2xl focus:bg-white focus:border-indigo-600 outline-hidden transition-all text-slate-800 placeholder:text-slate-400"
                />
              </div>

              {/* Collapsible examples - HIDDEN by default as explicitly requested */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowExamples(!showExamples)}
                  className="text-xs font-semibold text-slate-500 hover:text-indigo-600 flex items-center gap-1.5 transition-colors"
                >
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                  <span>{showExamples ? "Ocultar sugestões de exemplo" : "Ver sugestões de exemplo (opcional)"}</span>
                  {showExamples ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showExamples && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 p-3 bg-slate-50 border-2 border-slate-200 rounded-2xl animate-in fade-in">
                    {EXAMPLE_PROMPTS.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setInstruction(item.prompt);
                          setShowExamples(false);
                        }}
                        className="text-left p-2.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/50 transition-all text-xs"
                      >
                        <p className="font-bold text-slate-800 text-xs">{item.title}</p>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{item.prompt}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Option B: Document Upload */}
          {inputMethod === "document" && (
            <div className="space-y-3">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  uploadedFile
                    ? "border-emerald-500 bg-emerald-50/40"
                    : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.docx,.png,.jpg,.jpeg"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {uploadedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{uploadedFile.name}</p>
                      <p className="text-xs text-slate-500">
                        {(uploadedFile.size / 1024).toFixed(1)} KB • Arquivo carregado
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadedFile(null);
                      }}
                      className="text-xs text-rose-600 hover:underline font-bold mt-1"
                    >
                      Remover e escolher outro
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-slate-800">
                      Arraste um PDF ou documento aqui
                    </p>
                    <p className="text-xs text-slate-500">
                      Suporta PDF, TXT, DOCX ou imagem (até 25MB)
                    </p>
                    <span className="mt-1 px-3 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs">
                      Selecionar Arquivo
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer with High-Visibility "Criar Formulário" Button */}
        <div className="px-6 py-4 border-t-2 border-slate-300 flex items-center justify-between gap-3 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-200 transition-colors"
          >
            Cancelar
          </button>

          {/* Main "Criar Formulário" Action */}
          <button
            type="button"
            onClick={() => handleCreate()}
            disabled={isLoading || (inputMethod === "text" && !instruction.trim()) || (inputMethod === "document" && !uploadedFile)}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs sm:text-sm font-extrabold rounded-2xl shadow-sm transition-all border border-indigo-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Criando Formulário com IA...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 text-amber-300" />
                <span>Criar Formulário</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
