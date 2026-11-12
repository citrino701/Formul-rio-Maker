import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "./components/Navbar";
import { FormEditor } from "./components/FormEditor";
import { FormPreview } from "./components/FormPreview";
import { AiGeneratorModal } from "./components/AiGeneratorModal";
import { FieldEditorModal } from "./components/FieldEditorModal";
import { PdfExportModal } from "./components/PdfExportModal";
import { TemplateSelectorModal } from "./components/TemplateSelectorModal";
import { ShareLinkModal } from "./components/ShareLinkModal";
import { FormResponsesModal } from "./components/FormResponsesModal";
import { FormCreatedSuccessModal } from "./components/FormCreatedSuccessModal";
import { DeleteFormModal } from "./components/DeleteFormModal";
import { PublicRespondentView } from "./components/PublicRespondentView";
import { EmailIntegrationModal } from "./components/EmailIntegrationModal";
import { TaggedLinksModal } from "./components/TaggedLinksModal";
import { initGmailAuth } from "./services/gmailService";
import { useAutoSave } from "./hooks/useAutoSave";
import { FormStructure, FormField, FormAnswers, FormSummary } from "./types";
import { SAMPLE_BTG_FORM } from "./data/sampleForms";
import {
  Check,
  FolderOpen,
  Plus,
  Download,
  Edit3,
  Eye,
  Link2,
  BarChart3,
  Layers,
  Sparkles,
  Trash2,
  Clock,
  Loader2,
  AlertCircle,
  Mail
} from "lucide-react";

const STORAGE_KEY = "formcraft_current_form";
const ANSWERS_KEY = "formcraft_current_answers";

export default function App() {
  // Check if current URL is a respondent link (?respond=form_id)
  const [respondentFormId, setRespondentFormId] = useState<string | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("respond");
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [form, setForm] = useState<FormStructure>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Falha ao recuperar formulário salvo:", e);
    }
    return SAMPLE_BTG_FORM;
  });

  const [answers, setAnswers] = useState<FormAnswers>(() => {
    try {
      const saved = localStorage.getItem(ANSWERS_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Falha ao recuperar respostas salvas:", e);
    }
    return {};
  });

  // Server forms list and statistics
  const [allForms, setAllForms] = useState<FormSummary[]>([]);
  const [responseCount, setResponseCount] = useState<number>(0);

  // Modals
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isResponsesModalOpen, setIsResponsesModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isTaggedModalOpen, setIsTaggedModalOpen] = useState(false);
  const [isFormCreatedModalOpen, setIsFormCreatedModalOpen] = useState(false);
  const [createdFormForModal, setCreatedFormForModal] = useState<FormStructure | null>(null);

  // Form deletion confirmation modal state
  const [formToDelete, setFormToDelete] = useState<{
    id: string;
    title: string;
    responseCount?: number;
  } | null>(null);
  const [isDeletingForm, setIsDeletingForm] = useState(false);

  const [fieldEditorState, setFieldEditorState] = useState<{
    isOpen: boolean;
    field: FormField | null;
    sectionId: string;
  }>({
    isOpen: false,
    field: null,
    sectionId: form.sections[0]?.id || "sec_1"
  });

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Storage key for last active form
  const LAST_FORM_ID_KEY = "btg_last_active_form_id";

  // Ref to track previous response count to detect newly arrived responses
  const prevResponseCountRef = React.useRef<number | null>(null);

  // Fetch all forms and current form stats from server
  const refreshFormsList = useCallback(async () => {
    try {
      const res = await fetch("/api/forms");
      if (!res.ok) {
        return;
      }
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        return;
      }
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        return;
      }
      if (data && data.success && Array.isArray(data.forms)) {
        setAllForms(data.forms);
        const current = data.forms.find((f: any) => f.id === form.id);
        if (current) {
          const newCount = current.responseCount || 0;
          // Check if response count increased
          if (
            prevResponseCountRef.current !== null &&
            newCount > prevResponseCountRef.current
          ) {
            const diff = newCount - prevResponseCountRef.current;
            showToast(
              `📩 ${diff === 1 ? "Nova resposta recebida" : `${diff} novas respostas recebidas`}! E-mails de confirmação disparados para o respondente e hugoviajante@gmail.com.`
            );
          }
          prevResponseCountRef.current = newCount;
          setResponseCount(newCount);
        }
      }
    } catch (err) {
      console.warn("Aviso ao sincronizar formulários:", err);
    }
  }, [form.id]);

  useEffect(() => {
    initGmailAuth();
  }, []);

  useEffect(() => {
    refreshFormsList();

    // Background unattended synchronization every 15s to capture incoming external responses
    const interval = setInterval(() => { if (!document.hidden) refreshFormsList(); }, 60000);

    // Sync immediately when user returns to tab after hours
    const onFocus = () => refreshFormsList();
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshFormsList]);

  // Restore last active form on first load if different
  useEffect(() => {
    try {
      const savedLastId = localStorage.getItem(LAST_FORM_ID_KEY);
      if (savedLastId && savedLastId !== form.id) {
        fetch(`/api/forms/${encodeURIComponent(savedLastId)}`)
          .then(async (res) => {
            if (!res.ok) return null;
            const ct = res.headers.get("content-type") || "";
            if (!ct.includes("application/json")) return null;
            try {
              return await res.json();
            } catch {
              return null;
            }
          })
          .then((data) => {
            if (data?.success && data.form) {
              setForm(data.form);
              setResponseCount(data.responseCount || 0);
            }
          })
          .catch((e) => console.warn("Aviso ao restaurar último formulário ativo:", e));
      }
    } catch (e) {
      console.warn(e);
    }
  }, []);

  // Sync with server whenever form changes
  const saveFormToServer = useCallback(async (formToSave: FormStructure) => {
    try {
      await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formToSave)
      });
      refreshFormsList();
    } catch (err) {
      console.error("Erro ao salvar formulário no servidor:", err);
      throw err;
    }
  }, [refreshFormsList]);

  // Hook useAutoSave: monitors form changes and triggers saveFormToServer after 2s of inactivity
  const {
    status: autoSaveStatus,
    lastSavedAt,
    saveNow,
    resetLastSaved
  } = useAutoSave<FormStructure>({
    data: form,
    onSave: saveFormToServer,
    debounceMs: 2000
  });

  // Sync with localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    } catch (e) {
      console.error(e);
    }
  }, [form]);

  useEffect(() => {
    try {
      localStorage.setItem(ANSWERS_KEY, JSON.stringify(answers));
    } catch (e) {
      console.error(e);
    }
  }, [answers]);

  const handleFormChange = (updated: FormStructure) => {
    setForm(updated);
    // useAutoSave will automatically debounce and trigger saveFormToServer after 2s of inactivity
  };

  const handleOpenFieldEditor = (field: FormField | null, sectionId: string) => {
    setFieldEditorState({
      isOpen: true,
      field,
      sectionId
    });
  };

  const handleSaveField = (savedField: FormField, targetSectionId: string) => {
    const isEditing = Boolean(fieldEditorState.field);

    const updatedSections = form.sections.map((sec) => {
      const cleanFields = sec.fields.filter((f) => f.id !== savedField.id);

      if (sec.id === targetSectionId) {
        if (isEditing) {
          const existingIdx = sec.fields.findIndex((f) => f.id === savedField.id);
          if (existingIdx !== -1) {
            const next = [...sec.fields];
            next[existingIdx] = savedField;
            return { ...sec, fields: next };
          } else {
            return { ...sec, fields: [...cleanFields, savedField] };
          }
        } else {
          return { ...sec, fields: [...cleanFields, savedField] };
        }
      }

      return { ...sec, fields: cleanFields };
    });

    const updatedForm = {
      ...form,
      sections: updatedSections,
      updatedAt: new Date().toISOString()
    };

    setForm(updatedForm);
    saveFormToServer(updatedForm);
    showToast(isEditing ? "Campo personalizado atualizado!" : "Novo campo adicionado!");
  };

  const handleFormGeneratedByAi = (generatedForm: FormStructure) => {
    const finalized = {
      ...generatedForm,
      id: generatedForm.id || `form_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setForm(finalized);
    setAnswers({});
    saveFormToServer(finalized);
    setCreatedFormForModal(finalized);
    setIsFormCreatedModalOpen(true);
    refreshFormsList();
  };

  const handleSelectFormById = async (formId: string) => {
    try {
      const res = await fetch(`/api/forms/${encodeURIComponent(formId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.form) {
          setForm(data.form);
          setResponseCount(data.responseCount || 0);
          setAnswers({});
          try {
            localStorage.setItem(LAST_FORM_ID_KEY, formId);
          } catch (e) {
            console.warn(e);
          }
          showToast(`Formulário "${data.form.title}" selecionado!`);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleNewForm = () => {
    const blankForm: FormStructure = {
      id: `form_${Date.now()}`,
      title: "Novo Formulário Personalizado",
      subtitle: "Preencha as informações solicitadas",
      estimatedTime: "5 a 10 minutos",
      openingMessage: "Por favor, responda com atenção às perguntas a seguir.",
      closingMessage: "Agradecemos pela colaboração! Suas respostas foram recebidas com sucesso.",
      sections: [
        {
          id: `sec_${Date.now()}`,
          title: "01. Identificação Geral",
          description: "Dados básicos para início do contato.",
          fields: [
            { id: `f_${Date.now()}_1`, label: "Nome Completo", type: "text", required: true },
            { id: `f_${Date.now()}_2`, label: "E-mail Principal", type: "email", required: true },
            { id: `f_${Date.now()}_3`, label: "WhatsApp de Contato", type: "phone", required: true }
          ]
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setForm(blankForm);
    setAnswers({});
    saveFormToServer(blankForm);
    setCreatedFormForModal(blankForm);
    setIsFormCreatedModalOpen(true);
    refreshFormsList();
  };

  const handleOpenDeleteModal = (formId: string, formTitle?: string) => {
    const targetSummary = allForms.find((f) => f.id === formId);
    setFormToDelete({
      id: formId,
      title: formTitle || targetSummary?.title || form.title,
      responseCount: targetSummary !== undefined ? targetSummary.responseCount : responseCount
    });
  };

  const handleConfirmDeleteForm = async () => {
    if (!formToDelete) return;
    setIsDeletingForm(true);
    try {
      const res = await fetch(`/api/forms/${encodeURIComponent(formToDelete.id)}`, {
        method: "DELETE"
      });
      if (res.ok) {
        showToast(`Formulário "${formToDelete.title}" excluído com sucesso!`);
        const targetId = formToDelete.id;
        const remainingForms = allForms.filter((f) => f.id !== targetId);

        if (targetId === form.id) {
          if (remainingForms.length > 0) {
            await handleSelectFormById(remainingForms[0].id);
          } else {
            handleNewForm();
          }
        }
        await refreshFormsList();
        setFormToDelete(null);
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || "Erro ao excluir formulário.");
      }
    } catch (err) {
      console.error("Erro ao excluir formulário:", err);
      alert("Erro de conexão ao excluir formulário.");
    } finally {
      setIsDeletingForm(false);
    }
  };

  const handleSelectTemplate = (template: FormStructure) => {
    const newForm = {
      ...template,
      id: `form_${Date.now()}`,
      updatedAt: new Date().toISOString()
    };
    setForm(newForm);
    setAnswers({});
    saveFormToServer(newForm);
    showToast(`Modelo "${template.title}" carregado!`);
  };

  const handlePrintNative = () => {
    setActiveTab("preview");
    setTimeout(() => {
      window.print();
    }, 250);
  };

  // If user entered via respondent link (?respond=...)
  if (respondentFormId) {
    return (
      <PublicRespondentView
        formId={respondentFormId}
        initialForm={form.id === respondentFormId ? form : null}
        onExitRespondentMode={() => {
          window.history.pushState({}, "", window.location.pathname);
          setRespondentFormId(null);
        }}
      />
    );
  }

  return (
    <div
      className={`min-h-screen ${
        activeTab === "edit"
          ? "bg-gradient-to-b from-[#FAFBFD] via-[#F3F7FC] to-[#E5EFF9]"
          : "bg-gradient-to-b from-[#FDFDFD] via-[#EFF5FA] to-[#DFECF7]"
      } text-slate-900 flex flex-col selection:bg-indigo-100 selection:text-indigo-900 font-sans transition-colors duration-300`}
    >
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAiGenerator={() => setIsAiModalOpen(true)}
        onOpenPdfExport={() => setIsPdfModalOpen(true)}
        onOpenTemplates={() => setIsTemplateModalOpen(true)}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        onOpenResponsesModal={() => setIsResponsesModalOpen(true)}
        onOpenTaggedLinks={() => setIsTaggedModalOpen(true)}
        onNewForm={handleNewForm}
        onPrintNative={handlePrintNative}
        formTitle={form.title}
        currentFormLogo={form.logoUrl}
        responseCount={responseCount}
        allForms={allForms}
        currentFormId={form.id}
        onSelectForm={handleSelectFormById}
        onDeleteForm={handleOpenDeleteModal}
        onOpenEmailSettings={() => setIsEmailModalOpen(true)}
      />

      {/* Informative notification if current form has 0 responses but another form has saved responses */}
      {(() => {
        const otherFormsWithResponses = allForms.filter(
          (f) => f.id !== form.id && (f.responseCount || 0) > 0
        );
        if (responseCount === 0 && otherFormsWithResponses.length > 0) {
          return (
            <div className="bg-amber-50/95 border-b border-amber-200 px-4 sm:px-6 py-2.5 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-3 shadow-2xs print:hidden">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Você está visualizando o formulário <strong>"{form.title}"</strong> (0 respostas). Há respostas registradas em outros formulários:
                  {otherFormsWithResponses.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => handleSelectFormById(f.id)}
                      className="ml-1.5 font-bold underline text-amber-900 hover:text-amber-950 cursor-pointer"
                    >
                      "{f.title}" ({f.responseCount} {f.responseCount === 1 ? "resposta" : "respostas"})
                    </button>
                  ))}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsResponsesModalOpen(true)}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs transition-colors shrink-0 cursor-pointer"
                >
                  Ver Todas as Respostas
                </button>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 md:p-8 space-y-6">
        {/* Clean Minimalist Form Header Bar with Clear Separation */}
        <div className="bg-white/95 backdrop-blur-xs rounded-3xl p-4 sm:p-5 border-2 border-slate-300 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3.5 min-w-0">
            {form.logoUrl && (
              <div className="w-14 h-12 rounded-2xl bg-slate-50 border border-slate-200 p-1 flex items-center justify-center shrink-0 shadow-2xs">
                <img
                  src={form.logoUrl}
                  alt="Logo"
                  referrerPolicy="no-referrer"
                  className="max-h-full max-w-full object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = "none";
                  }}
                />
              </div>
            )}
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                  Formulário Ativo
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {form.sections.length} seções • {form.sections.reduce((acc, s) => acc + s.fields.length, 0)} perguntas
                </span>
              </div>
              <h2 className="text-base sm:text-xl font-extrabold text-slate-900 truncate">
                {form.title}
              </h2>
            </div>
          </div>

          {/* Core Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
            {/* Button 1: Gerar link para responder */}
            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-xs transition-all hover:scale-101 border border-emerald-700"
            >
              <Link2 className="w-4 h-4" />
              <span>Gerar link para responder</span>
            </button>

            {/* Button 2: Ver respostas do formulário */}
            <button
              type="button"
              onClick={() => setIsResponsesModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-2 border-indigo-200 rounded-2xl text-xs sm:text-sm font-bold transition-all"
            >
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              <span>Ver respostas</span>
              <span className="bg-indigo-600 text-white text-[11px] font-extrabold px-2 py-0.5 rounded-full">
                {responseCount}
              </span>
            </button>

            {/* Button 3: Exportar PDF */}
            <button
              type="button"
              onClick={() => setIsPdfModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-slate-50 border-2 border-slate-300 text-slate-700 rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-2xs"
            >
              <Download className="w-4 h-4 text-rose-600" />
              <span className="hidden sm:inline">Exportar PDF</span>
            </button>

            {/* Button 4: Excluir formulário */}
            <button
              type="button"
              onClick={() => handleOpenDeleteModal(form.id, form.title)}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-white hover:bg-rose-50 border-2 border-rose-200 hover:border-rose-300 text-rose-600 hover:text-rose-700 rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-2xs"
              title="Excluir este formulário permanentemente"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span className="hidden sm:inline">Excluir</span>
            </button>
          </div>
        </div>

        {/* View Switcher Tabs with Auto-save Status & Darker Separator Line */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 rounded-2xl border-2 border-slate-300 shadow-2xs print:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("edit")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === "edit"
                  ? "bg-indigo-600 text-white shadow-xs border border-indigo-700"
                  : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Edit3 className="w-4 h-4" />
              <span>Editar Formulário</span>
            </button>
            <button
              onClick={() => setActiveTab("preview")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === "preview"
                  ? "bg-indigo-600 text-white shadow-xs border border-indigo-700"
                  : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>Modo Respondente (Preenchimento)</span>
            </button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Real-time Auto-save Indicator */}
            <div className="flex items-center text-xs font-semibold">
              {autoSaveStatus === "saving" && (
                <span className="flex items-center gap-1.5 text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                  <span>Salvando...</span>
                </span>
              )}
              {autoSaveStatus === "saved" && (
                <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                  <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" />
                  <span>
                    Salvo {lastSavedAt ? `às ${lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
                  </span>
                </span>
              )}
              {autoSaveStatus === "pending" && (
                <span className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>Alterações não salvas</span>
                </span>
              )}
            </div>

            <button
              onClick={() => setIsTemplateModalOpen(true)}
              className="text-xs text-slate-600 hover:text-indigo-700 flex items-center gap-1 font-bold px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors border border-slate-200"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Modelos</span>
            </button>
          </div>
        </div>

        {/* View Component */}
        {activeTab === "edit" ? (
          <FormEditor
            form={form}
            onChange={handleFormChange}
            onOpenFieldEditor={handleOpenFieldEditor}
            onOpenAiGenerator={() => setIsAiModalOpen(true)}
            onDeleteForm={() => handleOpenDeleteModal(form.id, form.title)}
          />
        ) : (
          <FormPreview
            form={form}
            answers={answers}
            onAnswersChange={setAnswers}
            onOpenPdfExport={() => setIsPdfModalOpen(true)}
            onResponseSubmitted={refreshFormsList}
          />
        )}
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Form Created Success Pop-Up Modal */}
      <FormCreatedSuccessModal
        isOpen={isFormCreatedModalOpen}
        onClose={() => setIsFormCreatedModalOpen(false)}
        form={createdFormForModal}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        onOpenPreview={() => setActiveTab("preview")}
        onContinueEditing={() => setActiveTab("edit")}
      />

      {/* Share Link Modal ("Gerar link para responder") */}
      <ShareLinkModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        form={form}
        responseCount={responseCount}
        onOpenPreview={() => setActiveTab("preview")}
        onOpenResponses={() => setIsResponsesModalOpen(true)}
        onOpenTaggedLinks={() => setIsTaggedModalOpen(true)}
      />

      {/* Tagged Links & Google Sheets Tracker Modal */}
      <TaggedLinksModal
        isOpen={isTaggedModalOpen}
        onClose={() => setIsTaggedModalOpen(false)}
        form={form}
        onUpdateForm={handleFormChange}
      />

      {/* Form Responses Dashboard Modal ("Ver respostas do formulário") */}
      <FormResponsesModal
        isOpen={isResponsesModalOpen}
        onClose={() => {
          setIsResponsesModalOpen(false);
          refreshFormsList();
        }}
        form={form}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        allForms={allForms}
        onSelectForm={handleSelectFormById}
      />

      {/* AI Generator Modal (Text Instructions OR Document Upload) */}
      <AiGeneratorModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onFormGenerated={handleFormGeneratedByAi}
        currentForm={form}
      />

      {/* Custom Field Editor Modal */}
      <FieldEditorModal
        isOpen={fieldEditorState.isOpen}
        onClose={() => setFieldEditorState({ ...fieldEditorState, isOpen: false })}
        onSave={handleSaveField}
        initialField={fieldEditorState.field}
        currentSectionId={fieldEditorState.sectionId}
        sections={form.sections}
      />

      {/* PDF Export Modal */}
      <PdfExportModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        form={form}
        answers={answers}
        onNativePrint={handlePrintNative}
      />

      {/* Template Selector Modal */}
      <TemplateSelectorModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        onSelectTemplate={handleSelectTemplate}
      />

      {/* Delete Form Confirmation Modal */}
      <DeleteFormModal
        isOpen={!!formToDelete}
        onClose={() => setFormToDelete(null)}
        onConfirm={handleConfirmDeleteForm}
        formTitle={formToDelete?.title || ""}
        responseCount={formToDelete?.responseCount || 0}
        isDeleting={isDeletingForm}
      />

      {/* Email Integration & Testing Modal */}
      <EmailIntegrationModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
      />
    </div>
  );
}
