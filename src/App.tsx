import React, { useState, useEffect, useCallback } from "react";
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
  Mail,
  ArrowLeft,
  Copy,
  Settings,
  FileText
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
  // Tela atual: lista de formulários ("home") ou edição de um formulário ("editor")
  const [view, setView] = useState<"home" | "editor">("home");
  const [formsLoaded, setFormsLoaded] = useState(false);
  const [copiedFormId, setCopiedFormId] = useState<string | null>(null);
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
        setFormsLoaded(true);
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
              `📩 ${diff === 1 ? "Nova resposta recebida" : `${diff} novas respostas recebidas`}!`
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
      const res = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formToSave)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Falha ao salvar (HTTP ${res.status})`);
      }
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

  // Avisa antes de fechar a aba se ainda tem alteração não salva
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (autoSaveStatus === "pending" || autoSaveStatus === "saving" || autoSaveStatus === "error") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [autoSaveStatus]);

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
    setActiveTab("edit");
    setView("editor");
    refreshFormsList();
  };

  const handleSelectFormById = async (formId: string): Promise<FormStructure | null> => {
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
          return data.form as FormStructure;
        }
      }
    } catch (err) {
      console.error(err);
    }
    return null;
  };

  // Antes de sair do formulário atual, salva o que ainda estava esperando os 2s do auto-save
  const flushPendingSave = async () => {
    if (autoSaveStatus === "pending" || autoSaveStatus === "error") {
      try {
        await saveNow();
      } catch {
        /* o status de erro já aparece na barra */
      }
    }
  };

  const goHome = async () => {
    await flushPendingSave();
    setView("home");
  };

  // Abre um formulário da lista no editor
  const openFormInEditor = async (formId: string) => {
    await flushPendingSave();
    if (formId !== form.id) {
      const loaded = await handleSelectFormById(formId);
      if (!loaded) {
        showToast("Não foi possível abrir esse formulário.");
        return;
      }
    }
    setActiveTab("edit");
    setView("editor");
  };

  const openResponsesFor = async (formId?: string) => {
    if (formId && formId !== form.id) {
      await flushPendingSave();
      await handleSelectFormById(formId);
    }
    setIsResponsesModalOpen(true);
  };

  const copyRespondLink = async (formId: string) => {
    const url = `${window.location.origin}/?respond=${encodeURIComponent(formId)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copie o link:", url);
    }
    setCopiedFormId(formId);
    setTimeout(() => setCopiedFormId(null), 2000);
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
    setActiveTab("edit");
    setView("editor");
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
          setView("home");
          if (remainingForms.length > 0) {
            await handleSelectFormById(remainingForms[0].id);
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
    setActiveTab("edit");
    setView("editor");
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

  const totalQuestions = form.sections.reduce((acc, s) => acc + s.fields.length, 0);
  const totalResponses = allForms.reduce((acc, f) => acc + (f.responseCount || 0), 0);
  const formatWhen = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days <= 0) return `hoje, ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    if (days === 1) return "ontem";
    return d.toLocaleDateString("pt-BR");
  };

  return (
    <div className="min-h-screen bg-[#F6F6F3] text-[#16181D] flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Cabeçalho do app */}
      <header className="bg-white border-b border-[#E4E4DE] print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-3 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={goHome}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <span className="w-8 h-8 rounded-lg bg-[#16181D] text-white flex items-center justify-center font-bold text-sm">F</span>
            <span className="font-semibold text-[15px]">Formulário Maker</span>
          </button>
          <nav className="flex items-center gap-1">
            <button
              type="button"
              onClick={goHome}
              className={`px-3.5 py-2 rounded-lg text-sm cursor-pointer ${view === "home" ? "bg-[#EEF0FB] text-[#2F4AC0] font-semibold" : "text-[#4A4E57] hover:bg-slate-100 font-medium"}`}
            >
              Formulários
            </button>
            <button
              type="button"
              onClick={() => openResponsesFor()}
              className="px-3.5 py-2 rounded-lg text-sm text-[#4A4E57] hover:bg-slate-100 font-medium cursor-pointer"
            >
              Respostas
            </button>
            <button
              type="button"
              onClick={() => setIsEmailModalOpen(true)}
              aria-label="Configurações de e-mail"
              title="Configurações de e-mail"
              className="w-10 h-10 rounded-lg text-[#4A4E57] hover:bg-slate-100 flex items-center justify-center cursor-pointer"
            >
              <Settings className="w-5 h-5" />
            </button>
          </nav>
        </div>
      </header>

      {view === "home" ? (
        /* ------------------------------------------------------------ LISTA */
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-10 space-y-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Meus formulários</h1>
              <p className="text-[15px] text-[#5B606B]">
                {allForms.length} {allForms.length === 1 ? "formulário" : "formulários"} · {totalResponses} {totalResponses === 1 ? "resposta" : "respostas"} no total
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(true)}
                className="h-11 px-4 rounded-xl border border-[#D6D6CF] bg-white text-sm font-medium hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
              >
                <FolderOpen className="w-4 h-4" />
                Modelos
              </button>
              <button
                type="button"
                onClick={() => setIsAiModalOpen(true)}
                className="h-11 px-4 rounded-xl border border-[#2F4AC0] bg-[#EEF0FB] text-[#2F4AC0] text-sm font-semibold hover:bg-[#E2E6FA] flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                Criar com IA
              </button>
              <button
                type="button"
                onClick={handleNewForm}
                className="h-11 px-5 rounded-xl bg-[#2F4AC0] hover:bg-[#2840A8] text-white text-sm font-semibold flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Novo formulário
              </button>
            </div>
          </div>

          {!formsLoaded ? (
            <div className="bg-white border border-[#E4E4DE] rounded-2xl p-10 flex items-center justify-center gap-3 text-[#5B606B]">
              <Loader2 className="w-5 h-5 animate-spin" />
              Carregando seus formulários...
            </div>
          ) : allForms.length === 0 ? (
            <div className="bg-white border border-[#E4E4DE] rounded-2xl p-10 text-center space-y-3">
              <p className="text-lg font-semibold">Nenhum formulário ainda</p>
              <p className="text-[#5B606B] text-sm">Comece um do zero, de um modelo ou peça para a IA montar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {allForms.map((f) => (
                <article key={f.id} className="bg-white border border-[#E4E4DE] rounded-2xl p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-2">
                    {(f.responseCount || 0) > 0 ? (
                      <span className="text-xs font-semibold text-[#1E7A46] bg-[#E6F4EC] px-2.5 py-1 rounded-full">Recebendo respostas</span>
                    ) : (
                      <span className="text-xs font-semibold text-[#8A5300] bg-[#FBF0DD] px-2.5 py-1 rounded-full">Sem respostas</span>
                    )}
                    <span className="text-xs text-[#5B606B]">editado {formatWhen(f.updatedAt)}</span>
                  </div>
                  <button type="button" onClick={() => openFormInEditor(f.id)} className="text-left space-y-1 cursor-pointer">
                    <h2 className="text-lg font-semibold leading-snug hover:text-[#2F4AC0]">{f.title}</h2>
                    <p className="text-sm text-[#5B606B]">{f.totalQuestions} perguntas · {f.sectionsCount} {f.sectionsCount === 1 ? "bloco" : "blocos"}</p>
                  </button>
                  <button type="button" onClick={() => openResponsesFor(f.id)} className="flex items-baseline gap-2 text-left cursor-pointer">
                    <span className="text-3xl font-bold tracking-tight">{f.responseCount || 0}</span>
                    <span className="text-sm text-[#5B606B] hover:text-[#2F4AC0]">
                      {(f.responseCount || 0) === 1 ? "resposta" : "respostas"}
                      {f.lastResponseAt ? ` · última ${formatWhen(f.lastResponseAt)}` : ""}
                    </span>
                  </button>
                  <div className="flex gap-2 mt-auto">
                    <button
                      type="button"
                      onClick={() => copyRespondLink(f.id)}
                      className="flex-1 h-11 rounded-xl border border-[#2F4AC0] bg-[#EEF0FB] text-[#2F4AC0] text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {copiedFormId === f.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiedFormId === f.id ? "Copiado!" : "Copiar link"}
                    </button>
                    <button
                      type="button"
                      onClick={() => openFormInEditor(f.id)}
                      className="flex-1 h-11 rounded-xl border border-[#D6D6CF] text-sm font-medium hover:bg-slate-50 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                      Editar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>
      ) : (
        /* ------------------------------------------------------------ EDITOR */
        <>
          {/* Barra fixa: tudo que importa fica sempre à vista */}
          <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-[#E4E4DE] print:hidden">
            <div className="max-w-6xl mx-auto px-4 sm:px-8 py-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={goHome}
                className="flex items-center gap-1.5 text-sm font-medium text-[#4A4E57] hover:text-[#16181D] cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Formulários
              </button>
              <div className="min-w-0 flex-1 flex items-center gap-3">
                <span className="font-semibold truncate">{form.title}</span>
                <span className="hidden md:inline text-xs text-[#5B606B] shrink-0">{totalQuestions} perguntas</span>
                <span className="text-xs font-medium shrink-0">
                  {autoSaveStatus === "saving" && (
                    <span className="flex items-center gap-1 text-[#2F4AC0]"><Loader2 className="w-3.5 h-3.5 animate-spin" />Salvando...</span>
                  )}
                  {autoSaveStatus === "saved" && (
                    <span className="flex items-center gap-1 text-[#1E7A46]"><Check className="w-3.5 h-3.5" />Salvo{lastSavedAt ? ` às ${lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}</span>
                  )}
                  {autoSaveStatus === "error" && (
                    <button type="button" onClick={() => saveNow()} className="flex items-center gap-1.5 text-[#B3261E] underline cursor-pointer">
                      <AlertCircle className="w-3.5 h-3.5" />Não salvou, tentar de novo
                    </button>
                  )}
                  {autoSaveStatus === "pending" && (
                    <span className="flex items-center gap-1.5 text-[#8A5300]"><span className="w-2 h-2 rounded-full bg-amber-500" />Salvando em instantes</span>
                  )}
                </span>
              </div>

              <div className="flex items-center rounded-xl bg-[#F0F0EC] p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("edit")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm cursor-pointer ${activeTab === "edit" ? "bg-white shadow-xs font-semibold" : "text-[#4A4E57] font-medium"}`}
                >
                  <Edit3 className="w-4 h-4" />
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("preview")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm cursor-pointer ${activeTab === "preview" ? "bg-white shadow-xs font-semibold" : "text-[#4A4E57] font-medium"}`}
                >
                  <Eye className="w-4 h-4" />
                  Visualizar
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsResponsesModalOpen(true)}
                  className="h-10 px-3 rounded-xl border border-[#D6D6CF] bg-white text-sm font-medium hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                >
                  <BarChart3 className="w-4 h-4" />
                  Respostas
                  <span className="bg-[#2F4AC0] text-white text-xs font-bold px-2 py-0.5 rounded-full">{responseCount}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPdfModalOpen(true)}
                  aria-label="Exportar PDF"
                  title="Exportar PDF"
                  className="w-10 h-10 rounded-xl border border-[#D6D6CF] bg-white hover:bg-slate-50 flex items-center justify-center cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(true)}
                  className="h-10 px-4 rounded-xl bg-[#2F4AC0] hover:bg-[#2840A8] text-white text-sm font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Link2 className="w-4 h-4" />
                  Enviar link
                </button>
              </div>
            </div>
          </div>

          <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-8 py-6 space-y-6">
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
        </>
      )}

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
        onContinueEditing={() => { setActiveTab("edit"); setView("editor"); }}
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
