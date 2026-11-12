import React, { useState, useEffect } from "react";
import {
  FileText,
  Sparkles,
  Download,
  Eye,
  Edit3,
  Plus,
  FolderOpen,
  Printer,
  Link2,
  BarChart3,
  ChevronDown,
  Trash2,
  Check,
  Search,
  X,
  Mail,
  FileSpreadsheet
} from "lucide-react";
import { FormSummary } from "../types";
import { subscribeGmailAuth, getCachedGmailToken } from "../services/gmailService";

interface NavbarProps {
  activeTab: "edit" | "preview";
  setActiveTab: (tab: "edit" | "preview") => void;
  onOpenAiGenerator: () => void;
  onOpenPdfExport: () => void;
  onOpenTemplates: () => void;
  onOpenShareModal: () => void;
  onOpenResponsesModal: () => void;
  onOpenTaggedLinks?: () => void;
  onNewForm: () => void;
  onPrintNative: () => void;
  formTitle: string;
  currentFormLogo?: string;
  responseCount: number;
  allForms: FormSummary[];
  currentFormId: string;
  onSelectForm: (id: string) => void;
  onDeleteForm?: (id: string, title?: string) => void;
  onOpenEmailSettings?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenAiGenerator,
  onOpenPdfExport,
  onOpenTemplates,
  onOpenShareModal,
  onOpenResponsesModal,
  onOpenTaggedLinks,
  onNewForm,
  onPrintNative,
  formTitle,
  currentFormLogo,
  responseCount,
  allForms,
  currentFormId,
  onSelectForm,
  onDeleteForm,
  onOpenEmailSettings
}) => {
  const [isFormDropdownOpen, setIsFormDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isGmailConnected, setIsGmailConnected] = useState<boolean>(Boolean(getCachedGmailToken()));
  const [isAutonomousServerReady, setIsAutonomousServerReady] = useState(false);

  useEffect(() => {
    const unsub = subscribeGmailAuth((_user, token) => {
      setIsGmailConnected(Boolean(token));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const checkEmailStatus = async () => {
      try {
        const res = await fetch("/api/email/status");
        if (res.ok) {
          const data = await res.json();
          setIsAutonomousServerReady(Boolean(data.isServerAutonomous));
        }
      } catch {
        // ignore
      }
    };
    checkEmailStatus();
    const interval = setInterval(() => { if (!document.hidden) checkEmailStatus(); }, 120000);
    return () => clearInterval(interval);
  }, []);

  const filteredForms = allForms.filter((f) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    return (
      (f.title && f.title.toLowerCase().includes(query)) ||
      (f.subtitle && f.subtitle.toLowerCase().includes(query))
    );
  });

  return (
    <header className="sticky top-0 z-30 bg-white border-b-2 border-slate-300 shadow-xs print:hidden">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Brand & Form Selector Dropdown */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 border border-slate-200 text-indigo-600 flex items-center justify-center shadow-xs shrink-0 overflow-hidden p-1">
            {currentFormLogo ? (
              <img
                src={currentFormLogo}
                alt="Logo"
                referrerPolicy="no-referrer"
                className="max-h-full max-w-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = "none";
                }}
              />
            ) : (
              <FileText className="w-5 h-5 text-indigo-600" />
            )}
          </div>

          <div className="relative min-w-0">
            <button
              type="button"
              onClick={() => {
                const nextState = !isFormDropdownOpen;
                setIsFormDropdownOpen(nextState);
                if (!nextState) setSearchQuery("");
              }}
              className="flex items-center gap-1.5 text-left group hover:bg-slate-100 p-1.5 rounded-xl transition-colors max-w-xs sm:max-w-sm md:max-w-md border border-slate-200"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">
                    Formulário Selecionado
                  </span>
                  {responseCount > 0 && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded border border-emerald-200">
                      {responseCount} {responseCount === 1 ? "resposta" : "respostas"}
                    </span>
                  )}
                </div>
                <h1 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate flex items-center gap-1">
                  <span>{formTitle || "Novo Formulário"}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-700 shrink-0" />
                </h1>
              </div>
            </button>

            {/* Forms Dropdown Menu */}
            {isFormDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => {
                    setIsFormDropdownOpen(false);
                    setSearchQuery("");
                  }}
                />
                <div className="absolute left-0 mt-1 w-80 sm:w-96 bg-white border-2 border-slate-300 rounded-2xl shadow-xl z-50 p-2.5 space-y-2 animate-in fade-in zoom-in-95">
                  <div className="px-1 py-1 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-800">Seus Formulários</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                        {filteredForms.length}
                        {searchQuery.trim() ? ` de ${allForms.length}` : ""}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsFormDropdownOpen(false);
                        setSearchQuery("");
                        onNewForm();
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 px-2 py-1 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Novo</span>
                    </button>
                  </div>

                  {/* Search Input Bar */}
                  <div className="relative flex items-center">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                    <input
                      id="navbar-form-search-input"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Pesquisar formulários por título..."
                      autoFocus
                      className="w-full pl-8 pr-7 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden transition-all"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md transition-colors"
                        title="Limpar pesquisa"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Forms List */}
                  <div className="max-h-64 overflow-y-auto space-y-1 pr-0.5">
                    {filteredForms.length > 0 ? (
                      filteredForms.map((f) => (
                        <div
                          key={f.id}
                          className={`group p-2 sm:p-2.5 rounded-xl text-left transition-all flex items-center justify-between gap-2 ${
                            f.id === currentFormId
                              ? "bg-indigo-50 border-2 border-indigo-300 text-indigo-950 font-bold"
                              : "hover:bg-slate-100/80 text-slate-700 border border-transparent"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onSelectForm(f.id);
                              setIsFormDropdownOpen(false);
                              setSearchQuery("");
                            }}
                            className="min-w-0 flex-1 text-left cursor-pointer focus:outline-hidden"
                          >
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold truncate text-slate-900">{f.title || "Sem título"}</p>
                              {f.id === currentFormId && (
                                <span className="shrink-0 text-[9px] bg-indigo-600 text-white font-extrabold px-1.5 py-0.5 rounded-md">
                                  Ativo
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {f.totalQuestions} perguntas • {f.responseCount} respostas
                            </p>
                          </button>

                          <div className="flex items-center gap-1 shrink-0">
                            {onDeleteForm && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteForm(f.id, f.title);
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title={`Excluir formulário "${f.title || 'Sem título'}"`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-6 px-3 text-center space-y-2">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                          <Search className="w-4 h-4" />
                        </div>
                        <p className="text-xs font-bold text-slate-700">Nenhum formulário encontrado</p>
                        <p className="text-[11px] text-slate-400 max-w-[200px] mx-auto truncate">
                          Não encontramos nada para "{searchQuery}"
                        </p>
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
                        >
                          Limpar filtro
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t-2 border-slate-200 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsFormDropdownOpen(false);
                        setSearchQuery("");
                        onOpenAiGenerator();
                      }}
                      className="w-full py-2 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-indigo-200"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Criar Novo Formulário com IA</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Center Tabs: Editor vs Preview */}
        <div className="hidden lg:flex items-center bg-slate-100 p-1 rounded-xl border-2 border-slate-300">
          <button
            id="tab-edit-mode"
            onClick={() => setActiveTab("edit")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "edit"
                ? "bg-white text-slate-900 shadow-2xs border border-slate-300"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
            Editar
          </button>
          <button
            id="tab-preview-mode"
            onClick={() => setActiveTab("preview")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "preview"
                ? "bg-white text-slate-900 shadow-2xs border border-slate-300"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-indigo-600" />
            Preencher
          </button>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* BOTÃO CRUCIAL 1: "Gerar link para responder" */}
          <button
            id="btn-generate-share-link"
            onClick={onOpenShareModal}
            className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors shrink-0 border border-emerald-700"
            title="Gerar link de compartilhamento para coletar respostas"
          >
            <Link2 className="w-4 h-4" />
            <span>Gerar link para responder</span>
          </button>

          {/* BOTÃO LINKS TAGUEADOS / PLANILHA GOOGLE */}
          {onOpenTaggedLinks && (
            <button
              id="btn-open-tagged-links"
              onClick={onOpenTaggedLinks}
              className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-bold text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-300 rounded-xl transition-colors shrink-0 cursor-pointer shadow-2xs"
              title="Gerenciar Links Tagueados e Gerar Lista na Planilha do Google (Dia, Horário e Navegador)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span className="hidden sm:inline">Links Tagueados</span>
              <span className="sm:hidden">Tagueamento</span>
            </button>
          )}

          {/* BOTÃO CRUCIAL 2: "Ver respostas do formulário" */}
          <button
            id="btn-view-form-responses"
            onClick={onOpenResponsesModal}
            className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-bold text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border-2 border-indigo-200 rounded-xl transition-colors shrink-0"
            title="Visualizar todas as respostas enviadas para este formulário"
          >
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            <span className="hidden md:inline">Ver respostas do formulário</span>
            <span className="md:hidden">Respostas</span>
            <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-0.5">
              {responseCount}
            </span>
          </button>

          {/* BOTÃO E-MAIL INTEGRADO (hugoviajante@gmail.com) */}
          {onOpenEmailSettings && (
            <button
              id="btn-email-integration"
              onClick={onOpenEmailSettings}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-bold rounded-xl transition-all shrink-0 cursor-pointer ${
                isAutonomousServerReady
                  ? "text-emerald-950 bg-emerald-100/80 hover:bg-emerald-200 border-2 border-emerald-400"
                  : isGmailConnected
                  ? "text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300"
                  : "text-indigo-950 bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200"
              }`}
              title={
                isAutonomousServerReady
                  ? "Envio Autônomo 24/7 Ativo pelo Servidor (Mesmo com o app fechado e offline para hugoviajante@gmail.com)"
                  : isGmailConnected
                  ? "Gmail Oficial Conectado pelo Navegador (hugoviajante@gmail.com)"
                  : "Configurar envio de e-mails 24/7 mesmo com app fechado (hugoviajante@gmail.com)"
              }
            >
              <div className="relative">
                <Mail className={`w-4 h-4 ${isAutonomousServerReady || isGmailConnected ? "text-emerald-600" : "text-indigo-600"}`} />
                <span
                  className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ring-2 ring-white ${
                    isAutonomousServerReady
                      ? "bg-emerald-500 animate-pulse"
                      : isGmailConnected
                      ? "bg-emerald-500"
                      : "bg-amber-400"
                  }`}
                />
              </div>
              <span className="hidden xl:inline">
                {isAutonomousServerReady
                  ? "E-mail 24/7 Ativo (Servidor)"
                  : isGmailConnected
                  ? "Gmail Ativo (Navegador)"
                  : "Configurar E-mail 24/7"}
              </span>
              <span className="xl:hidden hidden sm:inline">
                {isAutonomousServerReady ? "E-mail 24/7" : isGmailConnected ? "Gmail Ativo" : "E-mail 24/7"}
              </span>
            </button>
          )}

          {/* PDF Export Button */}
          <button
            id="btn-open-pdf-export"
            onClick={onOpenPdfExport}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 border-2 border-slate-300 rounded-xl transition-colors"
            title="Exportar formulário em PDF"
          >
            <Download className="w-3.5 h-3.5 text-rose-600" />
            <span className="hidden lg:inline">PDF</span>
          </button>
        </div>
      </div>

      {/* Mobile Sub-Navigation Bar */}
      <div className="lg:hidden border-t border-slate-200 bg-slate-50 px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center bg-slate-200/70 p-0.5 rounded-lg w-full">
          <button
            onClick={() => setActiveTab("edit")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-md text-center transition-all ${
              activeTab === "edit" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600"
            }`}
          >
            Editar Formulário
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-md text-center transition-all ${
              activeTab === "preview" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600"
            }`}
          >
            Modo Respondente
          </button>
        </div>
      </div>
    </header>
  );
};
