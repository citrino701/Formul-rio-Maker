import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  CheckCircle2,
  Clock,
  Send,
  AlertCircle,
  FileText,
  Download,
  ArrowLeft,
  ArrowRight,
  Loader2,
  ShieldCheck,
  ExternalLink,
  RotateCcw,
  Mail,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Layers,
  List,
  Check
} from "lucide-react";
import { FormStructure, FormAnswers, FormSection, FormField } from "../types";
import { exportFormToPdf } from "../utils/pdfExport";
import { isFieldVisible, createFieldsMap } from "../utils/conditionalLogic";

interface PublicRespondentViewProps {
  formId: string;
  initialForm?: FormStructure | null;
  onExitRespondentMode?: () => void;
  isAdminPreview?: boolean;
}

export const PublicRespondentView: React.FC<PublicRespondentViewProps> = ({
  formId,
  initialForm,
  onExitRespondentMode,
  isAdminPreview = false
}) => {
  const [form, setForm] = useState<FormStructure | null>(initialForm || null);
  const [submittedRespondentEmail, setSubmittedRespondentEmail] = useState<string>("");
  const [submittedRespondentName, setSubmittedRespondentName] = useState<string>("");
  
  // LocalStorage keys for drafts and receipts per form
  const DRAFT_KEY = `btg_draft_${formId}`;
  const RECEIPT_KEY = `btg_receipt_${formId}`;

  // Initialize answers from draft if available
  const [answers, setAnswers] = useState<FormAnswers>(() => {
    try {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed && typeof parsed === "object") {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Falha ao recuperar rascunho de respostas:", e);
    }
    return {};
  });

  const [hasRestoredDraft, setHasRestoredDraft] = useState<boolean>(() => {
    try {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      return Boolean(savedDraft && Object.keys(JSON.parse(savedDraft)).length > 0);
    } catch {
      return false;
    }
  });

  const [previousSubmission, setPreviousSubmission] = useState<{
    submissionId: string;
    submittedAt: string;
  } | null>(() => {
    try {
      const savedReceipt = localStorage.getItem(RECEIPT_KEY);
      if (savedReceipt) {
        return JSON.parse(savedReceipt);
      }
    } catch {
      return null;
    }
    return null;
  });

  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(!initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [autoReplyInfo, setAutoReplyInfo] = useState<{
    sent: boolean;
    to?: string;
    subject?: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Presentation & Step-by-Step Mode
  const [displayMode, setDisplayMode] = useState<"step-by-step" | "all-at-once">(
    initialForm?.displayMode || "step-by-step"
  );
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Tagged link tracking (detects ?tag=... in URL)
  const [currentTagId] = useState<string | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("tag") || params.get("tag_id") || null;
    } catch {
      return null;
    }
  });
  const hasTrackedClickRef = useRef(false);

  // Post-submission auto redirect countdown
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  const [isRedirectCancelled, setIsRedirectCancelled] = useState(false);

  // Track click on tagged link once on load
  useEffect(() => {
    if (!currentTagId || isAdminPreview || hasTrackedClickRef.current) return;
    hasTrackedClickRef.current = true;

    fetch("/api/track/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formId, tagId: currentTagId })
    }).catch((err) => console.warn("Aviso ao registrar clique tagueado:", err));
  }, [currentTagId, formId, isAdminPreview]);

  // Handle post-submission auto redirect timer
  useEffect(() => {
    if (
      !isSubmitted ||
      !form?.redirectConfig?.enabled ||
      !form.redirectConfig.url ||
      isRedirectCancelled
    ) {
      return;
    }

    const targetUrl = form.redirectConfig.url.trim();
    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      return;
    }

    const delay = form.redirectConfig.delaySeconds ?? 3;
    if (delay === 0) {
      if (form.redirectConfig.openInNewTab) {
        window.open(targetUrl, "_blank");
      } else {
        window.location.href = targetUrl;
      }
      return;
    }

    setRedirectCountdown(delay);
    const interval = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          if (form.redirectConfig?.openInNewTab) {
            window.open(targetUrl, "_blank");
          } else {
            window.location.href = targetUrl;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isSubmitted, form?.redirectConfig, isRedirectCancelled]);

  // Auto-save draft whenever answers change (with 1s debounce)
  useEffect(() => {
    const answeredCount = Object.keys(answers).length;
    if (answeredCount === 0 || isSubmitted) return;

    const timer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(answers));
        setLastDraftSavedAt(new Date());
      } catch (err) {
        console.warn("Erro ao salvar rascunho no localStorage:", err);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [answers, DRAFT_KEY, isSubmitted]);

  // Load form from server if not provided or to ensure fresh data
  useEffect(() => {
    const loadForm = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/forms/${encodeURIComponent(formId)}`);
        const ct = res.headers.get("content-type") || "";
        if (res.ok && ct.includes("application/json")) {
          const data = await res.json().catch(() => null);
          if (data?.success && data.form) {
            setForm(data.form);
            if (data.form.displayMode) {
              setDisplayMode(data.form.displayMode);
            }
          }
        } else if (!initialForm) {
          setErrorMessage("Formulário não encontrado ou link expirado.");
        }
      } catch (err: any) {
        console.error("Erro ao carregar formulário:", err);
        if (!initialForm) {
          setErrorMessage("Não foi possível carregar o formulário. Verifique sua conexão.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (!initialForm || initialForm.id !== formId) {
      loadForm();
    }
  }, [formId, initialForm]);

  // When changing steps, focus the input if possible
  useEffect(() => {
    setStepError(null);
    if (inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [currentStepIndex, displayMode]);

  // Fields map for fast conditional evaluation
  const fieldsMap = useMemo(() => (form ? createFieldsMap(form.sections) : new Map<string, FormField>()), [form]);

  // Flatten questions for Step-by-Step mode (filtering only currently visible questions)
  const flatQuestions = useMemo(() => {
    if (!form) return [];
    const list: {
      field: FormField;
      section: FormSection;
      sectionIndex: number;
      questionIndex: number;
    }[] = [];
    form.sections.forEach((sec, sIdx) => {
      sec.fields.forEach((f) => {
        if (isFieldVisible(f, answers, fieldsMap)) {
          list.push({
            field: f,
            section: sec,
            sectionIndex: sIdx,
            questionIndex: list.length
          });
        }
      });
    });
    return list;
  }, [form, answers, fieldsMap]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 text-center space-y-4 max-w-sm w-full">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">Carregando formulário...</p>
        </div>
      </div>
    );
  }

  if (errorMessage || !form) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 text-center space-y-4 max-w-md w-full">
          <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Formulário Indisponível</h2>
          <p className="text-xs text-slate-500">{errorMessage || "O formulário solicitado não existe."}</p>
          {onExitRespondentMode && (
            <button
              type="button"
              onClick={onExitRespondentMode}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao Início</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Visual Theme configs
  const themeColor = form.themeColor || "#4f46e5";
  const logoUrl = form.logoUrl;
  const logoPosition = form.logoPosition || "center";
  const bgImage = form.backgroundImage;
  const bgOverlay = form.backgroundOverlay || "light";

  // Calculate overall required fields completion (only visible required fields)
  const allRequiredFields = useMemo(() => {
    if (!form) return [];
    return form.sections
      .flatMap((s) => s.fields)
      .filter((f) => f.required && isFieldVisible(f, answers, fieldsMap));
  }, [form, answers, fieldsMap]);

  const isFieldAnswered = (f: FormField) => {
    const val = answers[f.id];
    if (val === undefined || val === null || val === "") return false;
    if (Array.isArray(val) && val.length === 0) return false;
    if (f.type === "consent" && val !== true) return false;
    return true;
  };

  const answeredRequiredCount = allRequiredFields.filter(isFieldAnswered).length;

  const progressPercent =
    allRequiredFields.length > 0
      ? Math.round((answeredRequiredCount / allRequiredFields.length) * 100)
      : 100;

  // Calculate section-by-section completion
  const getSectionStatus = (section: FormSection) => {
    const fields = (section.fields || []).filter((f) => isFieldVisible(f, answers, fieldsMap));
    if (fields.length === 0) {
      return {
        isCompleted: true,
        totalFields: 0,
        answeredFields: 0,
        requiredFieldsCount: 0,
        answeredRequiredCount: 0
      };
    }

    const requiredFields = fields.filter((f) => f.required);
    const totalFields = fields.length;
    const answeredFields = fields.filter(isFieldAnswered).length;
    const answeredRequiredCount = requiredFields.filter(isFieldAnswered).length;

    let isCompleted = false;
    if (requiredFields.length > 0) {
      isCompleted = answeredRequiredCount === requiredFields.length;
    } else {
      isCompleted = answeredFields > 0;
    }

    return {
      isCompleted,
      totalFields,
      answeredFields,
      requiredFieldsCount: requiredFields.length,
      answeredRequiredCount
    };
  };

  const sectionStatuses = form.sections.map((sec, idx) => ({
    section: sec,
    index: idx,
    ...getSectionStatus(sec)
  }));

  const completedSectionsCount = sectionStatuses.filter((s) => s.isCompleted).length;
  const totalSectionsCount = form.sections.length;
  const sectionsProgressPercent =
    totalSectionsCount > 0
      ? Math.round((completedSectionsCount / totalSectionsCount) * 100)
      : 0;

  const handleInputChange = (fieldId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
    setValidationErrors((prev) => prev.filter((id) => id !== fieldId));
    setStepError(null);
  };

  const handleCheckboxToggle = (fieldId: string, option: string) => {
    const currentList: string[] = Array.isArray(answers[fieldId]) ? answers[fieldId] : [];
    const updated = currentList.includes(option)
      ? currentList.filter((item) => item !== option)
      : [...currentList, option];
    handleInputChange(fieldId, updated);
  };

  // Step-by-Step auto-advance when a question is answered
  const handleAutoAdvance = (fieldId: string, value: any) => {
    handleInputChange(fieldId, value);
    // Smooth delay so the respondent sees their selection before the next question appears
    setTimeout(() => {
      goToNextStep();
    }, 280);
  };

  const goToNextStep = () => {
    const currentQ = flatQuestions[currentStepIndex];
    if (currentQ && currentQ.field.required && !isFieldAnswered(currentQ.field)) {
      setStepError("Esta pergunta é obrigatória. Por favor, responda para continuar.");
      return;
    }
    setStepError(null);
    if (currentStepIndex < flatQuestions.length) {
      setCurrentStepIndex((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goToPrevStep = () => {
    setStepError(null);
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(`section-${sectionId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    // Validate required fields
    const missing: string[] = [];
    allRequiredFields.forEach((f) => {
      if (!isFieldAnswered(f)) {
        missing.push(f.id);
      }
    });

    if (missing.length > 0) {
      setValidationErrors(missing);
      // In step-by-step mode, jump to the first unanswered required question
      if (displayMode === "step-by-step") {
        const firstUnansweredIndex = flatQuestions.findIndex((q) => missing.includes(q.field.id));
        if (firstUnansweredIndex !== -1) {
          setCurrentStepIndex(firstUnansweredIndex);
          setStepError("Preencha esta pergunta obrigatória antes de finalizar o envio.");
          return;
        }
      } else {
        const firstEl = document.getElementById(`field-${missing[0]}`);
        if (firstEl) {
          firstEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
      return;
    }

    setIsSubmitting(true);
    try {
      // Extract respondent name and email from answers
      let respondentName: string | undefined;
      let respondentEmail: string | undefined;

      form.sections.forEach((sec) => {
        sec.fields.forEach((f) => {
          const val = answers[f.id];
          if (typeof val === "string" && val.trim()) {
            const l = f.label.toLowerCase();
            if (!respondentEmail && (f.type === "email" || l.includes("email") || l.includes("e-mail"))) {
              respondentEmail = val.trim();
            } else if (
              !respondentName &&
              f.type === "text" &&
              (l.includes("nome") || l.includes("empresa") || l.includes("marca") || l.includes("responsável"))
            ) {
              respondentName = val.trim();
            }
          }
        });
      });

      const res = await fetch(`/api/forms/${encodeURIComponent(form.id)}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          respondentName,
          respondentEmail,
          tagId: currentTagId || undefined
        })
      });

      const ct = res.headers.get("content-type") || "";
      let data: any = {};
      if (ct.includes("application/json")) {
        data = await res.json().catch(() => ({}));
      }
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Falha ao enviar respostas. Tente novamente.");
      }

      setSubmissionId(data.submissionId);
      if (data.autoReplySent) {
        setAutoReplyInfo({
          sent: true,
          to: data.autoReplyTo,
          subject: data.autoReplySubject
        });
      } else {
        setAutoReplyInfo(null);
      }

      // Save receipt to localStorage and clear draft
      try {
        localStorage.removeItem(DRAFT_KEY);
        localStorage.setItem(
          RECEIPT_KEY,
          JSON.stringify({
            submissionId: data.submissionId,
            submittedAt: new Date().toISOString(),
            respondentName,
            respondentEmail
          })
        );
        setPreviousSubmission({
          submissionId: data.submissionId,
          submittedAt: new Date().toISOString()
        });
        setHasRestoredDraft(false);
      } catch (storageErr) {
        console.warn("Aviso ao atualizar storage local pós envio:", storageErr);
      }

      setSubmittedRespondentEmail(respondentEmail || "");
      setSubmittedRespondentName(respondentName || "");
      setIsSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Ocorreu um erro ao enviar suas respostas. Suas respostas permanecem salvas localmente neste dispositivo para que você possa tentar novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearDraft = () => {
    if (confirm("Deseja realmente limpar suas respostas preenchidas neste formulário?")) {
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch (e) {
        console.warn(e);
      }
      setAnswers({});
      setHasRestoredDraft(false);
      setValidationErrors([]);
      setStepError(null);
      setCurrentStepIndex(0);
    }
  };

  const handleResetForNewSubmission = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem(RECEIPT_KEY);
    } catch (e) {
      console.warn(e);
    }
    setPreviousSubmission(null);
    setAnswers({});
    setIsSubmitted(false);
    setSubmissionId(null);
    setAutoReplyInfo(null);
    setCurrentStepIndex(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDownloadPdfReceipt = () => {
    exportFormToPdf(
      form,
      {
        mode: "answers",
        companyName: "Comprovante de Envio",
        includeGuidelines: false,
        includeHelpText: false,
        includeNotes: false,
        paperSize: "a4"
      },
      answers
    );
  };

  // Render question field input
  const renderFieldInput = (field: FormField, autoAdvance = false) => {
    const value = answers[field.id];

    switch (field.type) {
      case "text":
      case "email":
      case "phone":
      case "number":
      case "date":
      case "file":
        return (
          <div className="space-y-3">
            <input
              ref={inputRef as any}
              type={
                field.type === "email"
                  ? "email"
                  : field.type === "phone"
                  ? "tel"
                  : field.type === "number"
                  ? "number"
                  : field.type === "date"
                  ? "date"
                  : field.type === "file"
                  ? "url"
                  : "text"
              }
              value={value || ""}
              placeholder={
                field.placeholder ||
                (field.type === "file"
                  ? "Cole aqui o link do arquivo (Google Drive, Dropbox, etc.)..."
                  : "Digite sua resposta...")
              }
              onChange={(e) => handleInputChange(field.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && autoAdvance) {
                  e.preventDefault();
                  goToNextStep();
                }
              }}
              className="w-full px-4 py-3.5 text-sm sm:text-base bg-white border-2 border-slate-300 rounded-2xl outline-hidden transition-all text-slate-900 shadow-2xs focus:border-indigo-600"
              style={{
                borderColor: value ? themeColor : undefined
              }}
            />
            {field.type === "file" && (
              <p className="text-xs text-slate-400">
                Certifique-se de que a permissão do link esteja definida como "Qualquer pessoa com o link".
              </p>
            )}
          </div>
        );

      case "textarea":
        return (
          <textarea
            ref={inputRef as any}
            rows={4}
            value={value || ""}
            placeholder={field.placeholder || "Escreva detalhadamente sua resposta..."}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            className="w-full px-4 py-3.5 text-sm sm:text-base bg-white border-2 border-slate-300 rounded-2xl outline-hidden transition-all text-slate-900 shadow-2xs focus:border-indigo-600"
            style={{
              borderColor: value ? themeColor : undefined
            }}
          />
        );

      case "select":
        return (
          <select
            value={value || ""}
            onChange={(e) => {
              if (autoAdvance) {
                handleAutoAdvance(field.id, e.target.value);
              } else {
                handleInputChange(field.id, e.target.value);
              }
            }}
            className="w-full px-4 py-3.5 text-sm sm:text-base bg-white border-2 border-slate-300 rounded-2xl outline-hidden transition-all text-slate-900 shadow-2xs"
            style={{
              borderColor: value ? themeColor : undefined
            }}
          >
            <option value="">Selecione uma opção...</option>
            {field.options?.map((opt, oIdx) => (
              <option key={oIdx} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );

      case "radio":
        return (
          <div className="space-y-2.5 pt-1">
            {field.options?.map((option, oIdx) => {
              const isChecked = value === option;
              return (
                <label
                  key={oIdx}
                  onClick={() => {
                    if (autoAdvance) {
                      handleAutoAdvance(field.id, option);
                    } else {
                      handleInputChange(field.id, option);
                    }
                  }}
                  className={`flex items-center gap-3.5 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    isChecked
                      ? "shadow-sm font-bold"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50/80 hover:border-slate-300"
                  }`}
                  style={
                    isChecked
                      ? {
                          backgroundColor: `${themeColor}12`,
                          borderColor: themeColor,
                          color: themeColor
                        }
                      : {}
                  }
                >
                  <input
                    type="radio"
                    name={`radio-${field.id}`}
                    value={option}
                    checked={isChecked}
                    onChange={() => {}}
                    className="w-4 h-4 cursor-pointer"
                    style={{ accentColor: themeColor }}
                  />
                  <span className="text-sm sm:text-base flex-1">{option}</span>
                  {isChecked && <Check className="w-4 h-4 shrink-0" style={{ color: themeColor }} />}
                </label>
              );
            })}
          </div>
        );

      case "checkbox":
        return (
          <div className="space-y-2.5 pt-1">
            {field.options?.map((option, oIdx) => {
              const currentList: string[] = Array.isArray(value) ? value : [];
              const isChecked = currentList.includes(option);
              return (
                <label
                  key={oIdx}
                  onClick={() => handleCheckboxToggle(field.id, option)}
                  className={`flex items-center gap-3.5 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    isChecked
                      ? "shadow-sm font-bold"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50/80 hover:border-slate-300"
                  }`}
                  style={
                    isChecked
                      ? {
                          backgroundColor: `${themeColor}12`,
                          borderColor: themeColor,
                          color: themeColor
                        }
                      : {}
                  }
                >
                  <input
                    type="checkbox"
                    value={option}
                    checked={isChecked}
                    onChange={() => {}}
                    className="w-4 h-4 rounded-sm cursor-pointer"
                    style={{ accentColor: themeColor }}
                  />
                  <span className="text-sm sm:text-base flex-1">{option}</span>
                  {isChecked && <Check className="w-4 h-4 shrink-0" style={{ color: themeColor }} />}
                </label>
              );
            })}
          </div>
        );

      case "scale": {
        const scaleCount = (field.scaleMax || 5) - (field.scaleMin || 1) + 1;
        return (
          <div className="space-y-3 pt-1">
            <div
              className={`gap-1.5 sm:gap-2 ${
                scaleCount > 5
                  ? "grid grid-cols-5 sm:flex sm:items-center sm:justify-between"
                  : "flex items-center justify-between"
              }`}
            >
              {Array.from(
                { length: scaleCount },
                (_, i) => (field.scaleMin || 1) + i
              ).map((num) => {
                const isSelected = value === num;
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      if (autoAdvance) {
                        handleAutoAdvance(field.id, num);
                      } else {
                        handleInputChange(field.id, num);
                      }
                    }}
                    className={`min-h-[48px] flex-1 py-3 sm:py-3.5 text-sm sm:text-base font-bold rounded-2xl border-2 transition-all ${
                      isSelected
                        ? "text-white shadow-md scale-102"
                        : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100"
                    }`}
                    style={
                      isSelected
                        ? {
                            backgroundColor: themeColor,
                            borderColor: themeColor
                          }
                        : {}
                    }
                  >
                    {num}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-slate-500 px-1">
              <span>{field.minLabel || "Pouco provável"}</span>
              <span>{field.maxLabel || "Muito provável"}</span>
            </div>
          </div>
        );
      }

      case "consent":
        return (
          <label
            onClick={() => {
              const nextVal = value !== true;
              if (autoAdvance && nextVal) {
                handleAutoAdvance(field.id, true);
              } else {
                handleInputChange(field.id, nextVal);
              }
            }}
            className="flex items-start gap-3.5 p-4 bg-slate-50/80 border-2 border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-100/70 transition-colors"
            style={
              value === true
                ? {
                    backgroundColor: `${themeColor}12`,
                    borderColor: themeColor
                  }
                : {}
            }
          >
            <input
              type="checkbox"
              checked={value === true}
              onChange={() => {}}
              className="w-5 h-5 rounded-md mt-0.5 cursor-pointer"
              style={{ accentColor: themeColor }}
            />
            <span className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed">
              {field.placeholder || "Li, concordo e autorizo o envio destas respostas para o formulário."}
            </span>
          </label>
        );

      default:
        return null;
    }
  };

  // Step-by-Step active question
  const currentQ = flatQuestions[currentStepIndex];
  const isReviewStep = currentStepIndex >= flatQuestions.length;

  return (
    <div className="min-h-screen relative text-slate-900 pb-20 font-sans flex flex-col justify-between selection:bg-indigo-100 selection:text-indigo-900">
      {/* Universal Fixed Background Layer for Mobile & Desktop (Bypasses mobile Safari background-attachment bug) */}
      {bgImage ? (
        <>
          <div
            className="fixed inset-0 pointer-events-none z-0 bg-cover bg-center bg-no-repeat transition-all duration-500"
            style={{ backgroundImage: `url("${bgImage}")` }}
          />
          {/* Subtle Contrast Overlay for Readability on Mobile & Desktop */}
          <div
            className={`fixed inset-0 pointer-events-none z-0 ${
              bgOverlay === "dark"
                ? "bg-slate-950/75 backdrop-blur-xs"
                : bgOverlay === "none"
                ? "bg-transparent"
                : "bg-slate-900/15 backdrop-blur-[2px]"
            }`}
          />
        </>
      ) : (
        <div className="fixed inset-0 pointer-events-none z-0 bg-gradient-to-b from-[#FAFBFD] via-[#EEF5FB] to-[#DCEAF6]" />
      )}

      {/* Main Content Wrapper */}
      <div className="relative z-10 w-full flex-1 flex flex-col">
        {/* Top Notification Bar for Admin Preview */}
        {isAdminPreview && (
          <div className="bg-slate-900/90 backdrop-blur-md text-white px-4 py-2.5 text-xs flex items-center justify-between sticky top-0 z-50 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span
                className="px-2 py-0.5 rounded-md font-bold uppercase tracking-wider text-[10px] text-white"
                style={{ backgroundColor: themeColor }}
              >
                Pré-visualização do Respondente
              </span>
              <span className="hidden sm:inline text-slate-300">
                É exatamente assim que os respondentes visualizam e enviam suas respostas.
              </span>
            </div>
            {onExitRespondentMode && (
              <button
                onClick={onExitRespondentMode}
                className="underline hover:text-white font-medium shrink-0"
              >
                Voltar ao Editor
              </button>
            )}
          </div>
        )}

        {/* Top Floating Control Bar: Sections / Questions Progress + Mode Switch */}
        {!isSubmitted && (
          <div
            className={`sticky z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-2xs transition-all ${
              isAdminPreview ? "top-[41px]" : "top-0"
            }`}
          >
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
              {/* Progress info */}
              <div className="flex items-center gap-2.5 min-w-0">
                {logoUrl && (
                  <div className="h-7 max-w-[70px] sm:max-w-[100px] flex items-center justify-center shrink-0 pr-1.5 border-r border-slate-200">
                    <img
                      src={logoUrl}
                      alt={form.title}
                      referrerPolicy="no-referrer"
                      className="max-h-6 max-w-full object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = "none";
                      }}
                    />
                  </div>
                )}
                <div
                  className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold text-white shadow-2xs"
                  style={{ backgroundColor: themeColor }}
                >
                  {displayMode === "step-by-step" ? (
                    isReviewStep ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      currentStepIndex + 1
                    )
                  ) : (
                    completedSectionsCount
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 tracking-tight">
                      {displayMode === "step-by-step"
                        ? isReviewStep
                          ? "Revisão e Confirmação"
                          : `Pergunta ${currentStepIndex + 1} de ${flatQuestions.length}`
                        : `${completedSectionsCount} de ${totalSectionsCount} seções`}
                    </span>
                    <span
                      className="text-[10px] font-extrabold px-2 py-0.2 rounded-full text-white"
                      style={{ backgroundColor: themeColor }}
                    >
                      {displayMode === "step-by-step"
                        ? `${Math.round(
                            (Math.min(currentStepIndex, flatQuestions.length) / (flatQuestions.length || 1)) * 100
                          )}%`
                        : `${sectionsProgressPercent}%`}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate hidden sm:block">
                    {displayMode === "step-by-step"
                      ? isReviewStep
                        ? "Todas as perguntas foram respondidas! Revise antes do envio final."
                        : `Bloco ${currentQ?.sectionIndex + 1}: ${currentQ?.section.title}`
                      : `${answeredRequiredCount} de ${allRequiredFields.length} obrigatórios preenchidos`}
                  </p>
                </div>
              </div>

              {/* Mode Toggle & Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setDisplayMode((prev) => (prev === "step-by-step" ? "all-at-once" : "step-by-step"))
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors"
                  title="Alternar entre modo passo a passo e visualização contínua"
                >
                  {displayMode === "step-by-step" ? (
                    <>
                      <List className="w-3.5 h-3.5" />
                      <span className="hidden xs:inline">Ver Tudo</span>
                    </>
                  ) : (
                    <>
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span className="hidden xs:inline">Passo a Passo</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Micro Progress Line at Top */}
            <div className="w-full h-1 bg-slate-200/60 overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{
                  backgroundColor: themeColor,
                  width: `${
                    displayMode === "step-by-step"
                      ? Math.round(
                          (Math.min(currentStepIndex, flatQuestions.length) / (flatQuestions.length || 1)) * 100
                        )
                      : progressPercent
                  }%`
                }}
              />
            </div>
          </div>
        )}

        {/* Main Body */}
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 w-full space-y-4">
          {/* Previous Submission Alert */}
          {!isSubmitted && previousSubmission && (
            <div className="bg-emerald-50/95 backdrop-blur-xs border border-emerald-300 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xs animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-emerald-950 block">
                    Você já possui uma resposta registrada neste dispositivo
                  </span>
                  <span className="text-[11px] text-emerald-800">
                    Protocolo: <strong className="font-mono font-bold">{previousSubmission.submissionId}</strong> • Enviado em {new Date(previousSubmission.submittedAt).toLocaleString("pt-BR")}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetForNewSubmission}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Enviar Nova Resposta
                </button>
              </div>
            </div>
          )}

          {/* Draft Restored Banner */}
          {!isSubmitted && hasRestoredDraft && Object.keys(answers).length > 0 && (
            <div className="bg-indigo-50/90 backdrop-blur-xs border border-indigo-200 px-4 py-2.5 rounded-2xl flex items-center justify-between gap-3 text-xs text-indigo-900 shadow-2xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="truncate">
                  <strong>Rascunho recuperado:</strong> Suas respostas digitadas anteriormente continuam salvas no seu navegador.
                </span>
              </div>
              <button
                type="button"
                onClick={handleClearDraft}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold underline shrink-0 cursor-pointer"
              >
                Limpar Rascunho
              </button>
            </div>
          )}

          {/* Post-Submission Card */}
          {isSubmitted ? (
            <div className="bg-white rounded-3xl shadow-lg border border-slate-200 p-8 sm:p-12 text-center space-y-6 animate-in fade-in zoom-in-95">
              {/* Logo in success if available */}
              {logoUrl && (
                <div className={`flex justify-center mb-2`}>
                  <img
                    src={logoUrl}
                    alt={form.title}
                    className="max-h-16 max-w-[220px] object-contain"
                  />
                </div>
              )}

              <div
                className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto text-white shadow-md"
                style={{ backgroundColor: themeColor }}
              >
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <span
                  className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border"
                  style={{
                    color: themeColor,
                    borderColor: `${themeColor}30`,
                    backgroundColor: `${themeColor}10`
                  }}
                >
                  Envio Confirmado
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
                  Respostas Registradas com Sucesso!
                </h1>
                <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                  {form.closingMessage ||
                    "Agradecemos imensamente por responder com atenção. Seus dados foram computados em nossa base."}
                </p>
              </div>

              {/* Protocol Badge */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl max-w-md mx-auto text-left flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Protocolo de Envio
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-800">
                      {submissionId || `PROT-${Date.now().toString().slice(-8)}`}
                    </span>
                  </div>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  {new Date().toLocaleDateString("pt-BR")}
                </span>
              </div>

              {/* Dual Email Confirmation Status Badge */}
              <div className="p-4 bg-emerald-50/90 border border-emerald-200 rounded-2xl max-w-md mx-auto text-left flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Mail className="w-4 h-4 text-emerald-700" />
                </div>
                <div className="text-xs text-emerald-950 space-y-0.5 flex-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <span>Confirmação Enviada por E-mail</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  </p>
                  <p className="text-emerald-800 text-[11px] leading-relaxed">
                    Um comprovante foi disparado automaticamente para{" "}
                    <strong>{submittedRespondentEmail || "seu e-mail"}</strong> e para a organização (<strong>hugoviajante@gmail.com</strong>).
                  </p>
                </div>
              </div>

              {/* Auto Redirect Notification Banner */}
              {form.redirectConfig?.enabled && form.redirectConfig.url && (
                <div className="p-4 bg-indigo-50/90 border-2 border-indigo-200 rounded-2xl max-w-md mx-auto text-left space-y-3 animate-in fade-in">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                        {redirectCountdown !== null ? redirectCountdown : "↗"}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-indigo-950 block">
                          Redirecionamento Automático Configurado
                        </span>
                        <span className="text-[11px] text-indigo-700">
                          {isRedirectCancelled ? (
                            "Redirecionamento pausado para você consultar seus dados."
                          ) : redirectCountdown !== null && redirectCountdown > 0 ? (
                            <>
                              Encaminhando você para o link em{" "}
                              <strong className="font-bold text-indigo-950">{redirectCountdown}s</strong>...
                            </>
                          ) : (
                            "Encaminhando..."
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={form.redirectConfig.url}
                      target={form.redirectConfig.openInNewTab ? "_blank" : "_self"}
                      rel="noreferrer"
                      className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold text-center transition-colors inline-flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <span>{form.redirectConfig.buttonText || "Acessar link agora"}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    {!isRedirectCancelled && redirectCountdown !== null && redirectCountdown > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsRedirectCancelled(true);
                          setRedirectCountdown(null);
                        }}
                        className="py-2 px-3 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold transition-colors shrink-0"
                      >
                        Permanecer aqui
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleDownloadPdfReceipt}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all"
                  style={{ backgroundColor: themeColor }}
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar Comprovante em PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetForNewSubmission}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-2xl text-xs sm:text-sm font-bold transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Novo Preenchimento</span>
                </button>
              </div>
            </div>
          ) : displayMode === "step-by-step" ? (
            /* ============================================================ */
            /* MODO PASSO A PASSO (ONE QUESTION AT A TIME)                  */
            /* "A cada pergunta respondida, aparece a próxima pergunta"     */
            /* ============================================================ */
            <div className="space-y-6">
              {/* Header Top Card: Logo, Title & Opening */}
              <div className="bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200/90 p-5 sm:p-8 space-y-4">
                {/* Brand Logo */}
                {logoUrl && (
                  <div
                    className={`flex pb-2 ${
                      logoPosition === "left"
                        ? "justify-start"
                        : logoPosition === "right"
                        ? "justify-end"
                        : "justify-center"
                    }`}
                  >
                    <img
                      src={logoUrl}
                      alt={form.title}
                      referrerPolicy="no-referrer"
                      className="max-h-16 sm:max-h-20 w-auto max-w-[280px] object-contain drop-shadow-2xs"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = "none";
                      }}
                    />
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <span
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: themeColor }}
                  >
                    Formulário Interativo
                  </span>
                  {form.estimatedTime && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 px-3 py-1 rounded-full font-medium">
                      <Clock className="w-3.5 h-3.5" style={{ color: themeColor }} />
                      <span>{form.estimatedTime}</span>
                    </span>
                  )}
                </div>

                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                    {form.title}
                  </h1>
                  {form.subtitle && (
                    <p className="text-xs sm:text-sm text-slate-600 mt-1">{form.subtitle}</p>
                  )}
                </div>

                {form.openingMessage && currentStepIndex === 0 && (
                  <div
                    className="p-4 rounded-2xl text-xs sm:text-sm leading-relaxed border"
                    style={{
                      backgroundColor: `${themeColor}08`,
                      borderColor: `${themeColor}25`,
                      color: "#1e293b"
                    }}
                  >
                    {form.openingMessage}
                  </div>
                )}
              </div>

              {/* Active Question Card OR Review Step */}
              {!isReviewStep && currentQ ? (
                <div
                  key={currentQ.field.id}
                  className="bg-white/95 backdrop-blur-md rounded-3xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300"
                >
                  {/* Step Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="px-2.5 py-0.5 rounded-full text-xs font-bold border"
                        style={{
                          backgroundColor: `${themeColor}12`,
                          color: themeColor,
                          borderColor: `${themeColor}30`
                        }}
                      >
                        Bloco {currentQ.sectionIndex + 1} • {currentQ.section.title}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-slate-400">
                      Pergunta {currentStepIndex + 1} de {flatQuestions.length}
                    </div>
                  </div>

                  {/* Question Title & Details */}
                  <div className="space-y-2">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
                      {currentQ.field.label}
                      {currentQ.field.required && (
                        <span className="text-rose-600 font-bold ml-1.5" title="Campo obrigatório">
                          *
                        </span>
                      )}
                    </h2>
                    {currentQ.field.helpText && (
                      <p className="text-xs sm:text-sm text-slate-500 italic">
                        💡 {currentQ.field.helpText}
                      </p>
                    )}
                  </div>

                  {/* Step Error Notification */}
                  {stepError && (
                    <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl flex items-center gap-2 animate-in shake">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{stepError}</span>
                    </div>
                  )}

                  {/* Interactive Question Input */}
                  <div className="pt-1">
                    {renderFieldInput(currentQ.field, true)}
                  </div>

                  {/* Step Footer Actions */}
                  <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={goToPrevStep}
                      disabled={currentStepIndex === 0}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:pointer-events-none rounded-xl transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Pergunta Anterior</span>
                    </button>

                    <div className="w-full sm:w-auto flex items-center gap-2">
                      {/* If optional and empty, allow skipping */}
                      {!currentQ.field.required && !isFieldAnswered(currentQ.field) && (
                        <button
                          type="button"
                          onClick={() => {
                            setStepError(null);
                            setCurrentStepIndex((prev) => prev + 1);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="flex-1 sm:flex-initial px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                          Pular Pergunta
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={goToNextStep}
                        className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 py-3 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all"
                        style={{ backgroundColor: themeColor }}
                      >
                        <span>
                          {currentStepIndex === flatQuestions.length - 1
                            ? "Concluir e Revisar"
                            : "Próxima Pergunta"}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Keyboard shortcut tip */}
                  <p className="text-[11px] text-slate-400 text-center">
                    Dica: Pressione <kbd className="px-1.5 py-0.5 bg-slate-100 rounded border text-slate-600 font-mono text-[10px]">Enter ↵</kbd> ou selecione uma opção para avançar automaticamente.
                  </p>
                </div>
              ) : (
                /* Review Step before final submit */
                <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: themeColor }}>
                        Etapa Final
                      </span>
                      <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                        Revisão de Respostas
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Confira abaixo o resumo do que foi respondido antes de enviar o formulário.
                      </p>
                    </div>
                    <span
                      className="px-3 py-1 rounded-full text-xs font-bold text-white flex items-center gap-1.5"
                      style={{ backgroundColor: themeColor }}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{flatQuestions.length} Perguntas</span>
                    </span>
                  </div>

                  {/* Validation Errors Notice if any */}
                  {validationErrors.length > 0 && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 space-y-1">
                      <p className="font-bold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Atenção: existem campos obrigatórios pendentes.</span>
                      </p>
                      <p className="text-rose-700 text-[11px]">
                        Clique nas perguntas marcadas abaixo para respondê-las.
                      </p>
                    </div>
                  )}

                  {/* Answers summary list */}
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {flatQuestions.map((q, idx) => {
                      const val = answers[q.field.id];
                      const answered = isFieldAnswered(q.field);
                      const isMissingRequired = q.field.required && !answered;

                      return (
                        <div
                          key={q.field.id}
                          onClick={() => {
                            setCurrentStepIndex(idx);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                            isMissingRequired
                              ? "bg-rose-50/70 border-rose-300 hover:bg-rose-100/50"
                              : answered
                              ? "bg-slate-50/70 border-slate-200 hover:bg-slate-100/70"
                              : "bg-slate-50/30 border-slate-200/60 hover:bg-slate-100/50"
                          }`}
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-slate-400">
                                #{idx + 1}
                              </span>
                              <p className="text-xs font-bold text-slate-900 truncate">
                                {q.field.label}
                              </p>
                              {q.field.required && (
                                <span className="text-rose-600 text-xs font-bold">*</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 line-clamp-1">
                              {answered
                                ? Array.isArray(val)
                                  ? val.join(", ")
                                  : typeof val === "boolean"
                                  ? val
                                    ? "Concordo / Sim"
                                    : "Não"
                                  : String(val)
                                : isMissingRequired
                                ? "Obrigatório não respondido — clique para preencher"
                                : "Não respondido (opcional)"}
                            </p>
                          </div>

                          <div className="shrink-0 pt-0.5">
                            {answered ? (
                              <span
                                className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full"
                                style={{
                                  backgroundColor: `${themeColor}15`,
                                  color: themeColor
                                }}
                              >
                                <Check className="w-3 h-3" />
                                <span>Editar</span>
                              </span>
                            ) : isMissingRequired ? (
                              <span className="text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                                Preencher
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400">Pular</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Final Submit Button */}
                  <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentStepIndex(flatQuestions.length - 1);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                    >
                      ← Voltar à Última Pergunta
                    </button>

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleSubmit()}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 text-white rounded-2xl text-sm font-bold shadow-md hover:shadow-lg transition-all"
                      style={{ backgroundColor: themeColor }}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Enviando Respostas...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Enviar Respostas do Formulário</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ============================================================ */
            /* MODO TODAS AS PERGUNTAS DE UMA VEZ (ALL AT ONCE)             */
            /* ============================================================ */
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Header Info Card */}
              <div className="bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200/90 p-5 sm:p-8 space-y-4">
                {/* Brand Logo */}
                {logoUrl && (
                  <div
                    className={`flex pb-2 ${
                      logoPosition === "left"
                        ? "justify-start"
                        : logoPosition === "right"
                        ? "justify-end"
                        : "justify-center"
                    }`}
                  >
                    <img
                      src={logoUrl}
                      alt={form.title}
                      referrerPolicy="no-referrer"
                      className="max-h-16 sm:max-h-20 w-auto max-w-[280px] object-contain drop-shadow-2xs"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = "none";
                      }}
                    />
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <span
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: themeColor }}
                  >
                    Formulário Oficial
                  </span>
                  {form.estimatedTime && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 px-3 py-1 rounded-full font-medium">
                      <Clock className="w-3.5 h-3.5" style={{ color: themeColor }} />
                      Tempo estimado: {form.estimatedTime}
                    </span>
                  )}
                </div>

                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    {form.title}
                  </h1>
                  {form.subtitle && (
                    <p className="text-sm font-semibold text-slate-600 mt-1">{form.subtitle}</p>
                  )}
                </div>

                {form.openingMessage && (
                  <div
                    className="p-4 rounded-2xl text-xs sm:text-sm leading-relaxed border"
                    style={{
                      backgroundColor: `${themeColor}08`,
                      borderColor: `${themeColor}25`,
                      color: "#1e293b"
                    }}
                  >
                    {form.openingMessage}
                  </div>
                )}

                {/* Progress Indicator */}
                <div className="pt-2">
                  <div className="flex justify-between text-xs text-slate-500 font-medium mb-1.5">
                    <span>Campos obrigatórios preenchidos</span>
                    <span className="font-bold" style={{ color: themeColor }}>
                      {progressPercent}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        backgroundColor: themeColor,
                        width: `${progressPercent}%`
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Error Banner */}
              {validationErrors.length > 0 && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-xs text-rose-800 animate-in shake">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Por favor, preencha todos os campos obrigatórios marcados em vermelho.</p>
                    <p className="text-[11px] text-rose-700 mt-0.5">
                      Faltam {validationErrors.length} {validationErrors.length === 1 ? "pergunta" : "perguntas"} obrigatórias.
                    </p>
                  </div>
                </div>
              )}

              {/* Sections */}
              {form.sections.map((section, sIdx) => {
                const sStatus = sectionStatuses[sIdx];
                return (
                  <div
                    key={section.id}
                    id={`section-${section.id}`}
                    className="bg-white/95 backdrop-blur-md rounded-3xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6 scroll-mt-36 sm:scroll-mt-32 transition-all"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                      <div>
                        <span
                          className="text-[11px] font-bold uppercase tracking-wider"
                          style={{ color: themeColor }}
                        >
                          Bloco {sIdx + 1}
                        </span>
                        <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">
                          {section.title}
                        </h2>
                        {section.description && (
                          <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                            {section.description}
                          </p>
                        )}
                      </div>

                      {sStatus?.isCompleted ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-bold shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Seção Concluída</span>
                        </span>
                      ) : sStatus && sStatus.requiredFieldsCount > 0 ? (
                        <span className="text-xs font-medium text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200 shrink-0">
                          {sStatus.answeredRequiredCount} de {sStatus.requiredFieldsCount} obrigatórios
                        </span>
                      ) : null}
                    </div>

                    <div className="space-y-6">
                      {section.fields
                        .filter((field) => isFieldVisible(field, answers, fieldsMap))
                        .map((field) => {
                        const hasError = validationErrors.includes(field.id);
                        return (
                          <div
                            key={field.id}
                            id={`field-${field.id}`}
                            className={`space-y-2 p-3 sm:p-4 rounded-2xl transition-all animate-in fade-in slide-in-from-top-1 duration-200 ${
                              hasError
                                ? "bg-rose-50/60 border-2 border-rose-400"
                                : "bg-slate-50/40 border border-slate-200/80 hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <label className="text-xs sm:text-sm font-bold text-slate-800 leading-snug">
                                {field.label}
                                {field.required && <span className="text-rose-600 ml-1 font-bold">*</span>}
                              </label>
                            </div>

                            {field.helpText && (
                              <p className="text-xs text-slate-500 italic leading-relaxed">
                                💡 {field.helpText}
                              </p>
                            )}

                            <div className="pt-1">{renderFieldInput(field, false)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Bottom Submit Actions */}
              <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-sm border border-slate-200 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-500 text-center sm:text-left">
                  <span className="font-semibold text-slate-700">Pronto para finalizar?</span>
                  <p>Revise suas respostas antes de clicar em enviar.</p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 text-white rounded-2xl text-sm font-bold shadow-md hover:shadow-lg transition-all"
                  style={{ backgroundColor: themeColor }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Enviando Respostas...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Enviar Respostas do Formulário</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </main>
      </div>
    </div>
  );
};
