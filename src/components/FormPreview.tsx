import React, { useState } from "react";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
  Download,
  Upload,
  FileText,
  ShieldCheck,
  Send,
  Mail,
  GitBranch
} from "lucide-react";
import { FormStructure, FormAnswers, FormField } from "../types";
import { isFieldVisible, createFieldsMap, getFieldConditionSummary } from "../utils/conditionalLogic";
import { PostSubmitEmailModal } from "./PostSubmitEmailModal";

interface FormPreviewProps {
  form: FormStructure;
  answers: FormAnswers;
  onAnswersChange: (answers: FormAnswers) => void;
  onOpenPdfExport: () => void;
  onResponseSubmitted?: () => void;
}

export const FormPreview: React.FC<FormPreviewProps> = ({
  form,
  answers,
  onAnswersChange,
  onOpenPdfExport,
  onResponseSubmitted
}) => {
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [submittedRespondentEmail, setSubmittedRespondentEmail] = useState<string>("");
  const [submittedRespondentName, setSubmittedRespondentName] = useState<string>("");
  const [autoReplyNotification, setAutoReplyNotification] = useState<{
    sent: boolean;
    to?: string;
  } | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const fieldsMap = React.useMemo(() => createFieldsMap(form.sections), [form.sections]);

  const handleFieldChange = (fieldId: string, value: any) => {
    onAnswersChange({
      ...answers,
      [fieldId]: value
    });

    if (validationErrors[fieldId]) {
      const updated = { ...validationErrors };
      delete updated[fieldId];
      setValidationErrors(updated);
    }
  };

  const handleCheckboxToggle = (fieldId: string, option: string) => {
    const current = (answers[fieldId] as string[]) || [];
    if (current.includes(option)) {
      handleFieldChange(
        fieldId,
        current.filter((item) => item !== option)
      );
    } else {
      handleFieldChange(fieldId, [...current, option]);
    }
  };

  const handleFillDemoData = () => {
    const demoAnswers: FormAnswers = {};

    form.sections.forEach((sec) => {
      sec.fields.forEach((f) => {
        switch (f.type) {
          case "text":
            if (f.label.toLowerCase().includes("empresa") || f.label.toLowerCase().includes("marca")) {
              demoAnswers[f.id] = "Nexus Soluções Digitais Ltda";
            } else if (f.label.toLowerCase().includes("cidade")) {
              demoAnswers[f.id] = "Curitiba, PR";
            } else if (f.label.toLowerCase().includes("nome")) {
              demoAnswers[f.id] = "Carolina Silva";
            } else if (f.label.toLowerCase().includes("função") || f.label.toLowerCase().includes("cargo")) {
              demoAnswers[f.id] = "Diretora de Operações e Sócia";
            } else if (f.label.toLowerCase().includes("cnpj")) {
              demoAnswers[f.id] = "12.345.678/0001-90";
            } else if (f.label.toLowerCase().includes("site")) {
              demoAnswers[f.id] = "https://nexussolucoes.com.br";
            } else {
              demoAnswers[f.id] = "Resposta de exemplo preenchida para teste";
            }
            break;

          case "textarea":
            demoAnswers[f.id] =
              "Desenvolvemos soluções para digitalização de processos operacionais e redução de gargalos para empresas em crescimento rápido.";
            break;

          case "email":
            demoAnswers[f.id] = "carolina@nexussolucoes.com.br";
            break;

          case "phone":
            demoAnswers[f.id] = "(41) 99123-4567";
            break;

          case "radio":
            demoAnswers[f.id] = f.options?.[1] || f.options?.[0] || "Validação";
            break;

          case "checkbox":
            demoAnswers[f.id] = f.options ? f.options.slice(0, 3) : ["Opção 1"];
            break;

          case "select":
            demoAnswers[f.id] = f.options?.[0] || "";
            break;

          case "scale":
            demoAnswers[f.id] = f.scaleMax ? Math.floor(f.scaleMax * 0.9) : 5;
            break;

          case "consent":
            demoAnswers[f.id] = true;
            break;

          case "file":
            demoAnswers[f.id] = "https://drive.google.com/drive/folders/exemplo-apresentacao";
            break;

          case "date":
            demoAnswers[f.id] = new Date().toISOString().split("T")[0];
            break;

          default:
            demoAnswers[f.id] = "Exemplo";
        }
      });
    });

    onAnswersChange(demoAnswers);
    setValidationErrors({});
  };

  const handleClearAnswers = () => {
    if (confirm("Deseja limpar todas as respostas preenchidas?")) {
      onAnswersChange({});
      setValidationErrors({});
      setSubmitted(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields that are currently visible
    const errors: Record<string, string> = {};
    form.sections.forEach((sec) => {
      sec.fields.forEach((f) => {
        if (f.required && isFieldVisible(f, answers, fieldsMap)) {
          const val = answers[f.id];
          if (
            val === undefined ||
            val === "" ||
            (Array.isArray(val) && val.length === 0) ||
            (f.type === "consent" && !val)
          ) {
            errors[f.id] = "Este campo é obrigatório.";
          }
        }
      });
    });

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      alert(`Existem ${Object.keys(errors).length} campo(s) obrigatório(s) não preenchido(s).`);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

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

    // Submit to backend so it registers in "Ver respostas do formulário"
    try {
      const res = await fetch(`/api/forms/${encodeURIComponent(form.id)}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, respondentName, respondentEmail })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Falha ao salvar respostas no servidor.");
      }

      setSubmittedId(data.submissionId);
      if (data.autoReplySent) {
        setAutoReplyNotification({ sent: true, to: data.autoReplyTo });
      } else {
        setAutoReplyNotification(null);
      }

      setSubmittedRespondentEmail(respondentEmail || "");
      setSubmittedRespondentName(respondentName || "");
      // ONLY set submitted if server confirmed
      setSubmitted(true);
      setIsEmailModalOpen(true);
      if (onResponseSubmitted) {
        onResponseSubmitted();
      }
    } catch (err: any) {
      console.error("Erro ao registrar resposta no servidor:", err);
      setSubmitError(err.message || "Erro de conexão ao salvar respostas no servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalQuestions = form.sections.reduce((acc, s) => acc + s.fields.length, 0);
  const answeredCount = Object.keys(answers).filter((k) => {
    const val = answers[k];
    return val !== undefined && val !== "" && (!Array.isArray(val) || val.length > 0);
  }).length;

  return (
    <div
      className="max-w-3xl mx-auto space-y-6 pb-24 relative rounded-3xl transition-all"
      style={
        form.backgroundImage
          ? {
              backgroundImage: `url("${form.backgroundImage}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              padding: "16px"
            }
          : {}
      }
    >
      {form.backgroundImage && (
        <div
          className={`absolute inset-0 rounded-3xl pointer-events-none ${
            form.backgroundOverlay === "dark"
              ? "bg-slate-950/70 backdrop-blur-xs"
              : form.backgroundOverlay === "none"
              ? "bg-transparent"
              : "bg-slate-900/10 backdrop-blur-[2px]"
          }`}
        />
      )}

      {/* Test Controls Bar */}
      <div className="relative z-10 bg-white/95 backdrop-blur-md rounded-2xl p-4 border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-600">Progresso do Teste:</span>
          <span className="text-xs font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
            {answeredCount} de {totalQuestions} respondidos
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleFillDemoData}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-colors border border-indigo-200"
            title="Preencher todos os campos com dados fictícios para testar"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Preencher Dados de Teste</span>
          </button>

          {answeredCount > 0 && (
            <button
              type="button"
              onClick={handleClearAnswers}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors border border-slate-300"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpar</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenPdfExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs border border-rose-700"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar em PDF</span>
          </button>
        </div>
      </div>

      {/* Form Submission Success Card */}
      {submitted && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-3xl p-6 text-center space-y-3">
          <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-xs border border-emerald-500">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-emerald-900">Formulário Enviado com Sucesso!</h3>
          <p className="text-xs text-emerald-700 max-w-md mx-auto">
            {form.closingMessage || "Obrigado por preencher todas as informações solicitadas."}
          </p>

          {autoReplyNotification?.sent && (
            <div className="p-3 bg-white border border-emerald-300 rounded-xl max-w-md mx-auto text-left flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="text-xs text-emerald-900">
                <span className="font-bold">E-mail de confirmação disparado: </span>
                <span>Enviado automaticamente para {autoReplyNotification.to}</span>
              </div>
            </div>
          )}

          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => setIsEmailModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Ver Status dos E-mails / Reenviar</span>
            </button>
            <button
              type="button"
              onClick={onOpenPdfExport}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              Baixar Respostas em PDF
            </button>
            <button
              type="button"
              onClick={() => setSubmitted(false)}
              className="px-4 py-2 bg-white border-2 border-emerald-300 text-emerald-800 text-xs font-bold rounded-xl hover:bg-emerald-50 transition-colors"
            >
              Continuar Editando Respostas
            </button>
          </div>
        </div>
      )}

      {/* Actual Form Render (Printable & Interactive) */}
      <form
        onSubmit={handleSubmit}
        className="relative z-10 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden transition-all bg-white/95 backdrop-blur-md"
      >
        {/* Top Form Header with optional Logo & Theme styling */}
        <div
          className={`p-6 sm:p-8 border-b border-slate-200/80 ${
            form.backgroundImage
              ? form.backgroundOverlay === "dark"
                ? "bg-slate-950/80 backdrop-blur-xs text-white"
                : "bg-white/90 backdrop-blur-xs"
              : "bg-gradient-to-b from-slate-50/80 to-white"
          }`}
        >
          {/* Top Brand Logo */}
          {form.logoUrl && (
            <div
              className={`flex pb-3 ${
                form.logoPosition === "left"
                  ? "justify-start"
                  : form.logoPosition === "right"
                  ? "justify-end"
                  : "justify-center"
              }`}
            >
              <img
                src={form.logoUrl}
                alt={form.title || "Logo"}
                referrerPolicy="no-referrer"
                className="max-h-16 sm:max-h-20 w-auto max-w-[280px] object-contain drop-shadow-2xs"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = "none";
                }}
              />
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <span
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: form.themeColor || "#4f46e5" }}
              >
                Formulário Oficial
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
                {form.title || "Formulário sem título"}
              </h1>
              {form.subtitle && (
                <p className="text-sm text-slate-600 mt-1 font-medium">{form.subtitle}</p>
              )}
            </div>

            {form.estimatedTime && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-medium shrink-0 self-start">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>{form.estimatedTime}</span>
              </div>
            )}
          </div>

          {form.openingMessage && (
            <div
              className="mt-5 p-4 rounded-xl border text-xs sm:text-sm text-slate-700 leading-relaxed"
              style={{
                backgroundColor: `${form.themeColor || "#4f46e5"}08`,
                borderColor: `${form.themeColor || "#4f46e5"}25`
              }}
            >
              {form.openingMessage}
            </div>
          )}
        </div>

        {/* Sections */}
        <div
          className={`p-6 sm:p-8 space-y-10 ${
            form.backgroundImage
              ? form.backgroundOverlay === "dark"
                ? "bg-slate-900/85 backdrop-blur-xs text-white"
                : "bg-white/90 backdrop-blur-xs"
              : "bg-white"
          }`}
        >
          {form.sections.map((section, sIdx) => (
            <div key={section.id} className="space-y-5">
              {/* Section Header */}
              <div className="border-b border-slate-200 pb-3">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span className="text-indigo-600 font-mono text-sm">{sIdx + 1}.</span>
                  <span>{section.title}</span>
                </h2>
                {section.description && (
                  <p className="text-xs text-slate-500 mt-1">{section.description}</p>
                )}
              </div>

              {/* Fields */}
              <div className="space-y-6">
                {section.fields
                  .filter((field) => isFieldVisible(field, answers, fieldsMap))
                  .map((field, fIdx) => {
                    const error = validationErrors[field.id];
                    const value = answers[field.id];

                    return (
                      <div
                        key={field.id}
                        className={`space-y-2 p-4 rounded-xl transition-all animate-in fade-in slide-in-from-top-1 duration-200 ${
                          error
                            ? "bg-rose-50/60 border border-rose-300"
                            : "hover:bg-slate-50/50 border border-transparent"
                        }`}
                      >
                        {/* Label & Required Indicator */}
                        <div className="flex items-baseline justify-between gap-2 flex-wrap">
                          <label className="block text-sm font-semibold text-slate-900 leading-snug">
                            <span>
                              {fIdx + 1}. {field.label}
                            </span>
                            {field.required && <span className="text-rose-600 ml-1">*</span>}
                          </label>

                          {field.conditionalLogic?.enabled && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full shadow-2xs">
                              <GitBranch className="w-3 h-3 text-purple-600" />
                              <span>Exibido por regra condicional</span>
                            </span>
                          )}
                        </div>

                      {/* Help Text / Dica */}
                      {field.helpText && (
                        <p className="text-xs text-slate-500 italic">
                          {field.helpText}
                        </p>
                      )}

                      {/* Field Input Control */}
                      <div className="pt-1">
                        {/* Text / Short Answer */}
                        {field.type === "text" && (
                          <input
                            type="text"
                            value={value || ""}
                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            placeholder={field.placeholder || "Sua resposta"}
                            className="w-full p-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                          />
                        )}

                        {/* Textarea / Long Answer */}
                        {field.type === "textarea" && (
                          <textarea
                            rows={3}
                            value={value || ""}
                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            placeholder={field.placeholder || "Digite sua resposta detalhada..."}
                            className="w-full p-3 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                          />
                        )}

                        {/* Email */}
                        {field.type === "email" && (
                          <input
                            type="email"
                            value={value || ""}
                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            placeholder={field.placeholder || "exemplo@dominio.com"}
                            className="w-full p-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                          />
                        )}

                        {/* Phone */}
                        {field.type === "phone" && (
                          <input
                            type="tel"
                            value={value || ""}
                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            placeholder={field.placeholder || "(00) 00000-0000"}
                            className="w-full p-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                          />
                        )}

                        {/* Number */}
                        {field.type === "number" && (
                          <input
                            type="number"
                            value={value || ""}
                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            placeholder={field.placeholder || "0"}
                            className="w-full sm:w-48 p-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                          />
                        )}

                        {/* Date */}
                        {field.type === "date" && (
                          <input
                            type="date"
                            value={value || ""}
                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            className="w-full sm:w-56 p-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                          />
                        )}

                        {/* Radio / Single Choice */}
                        {field.type === "radio" && (
                          <div className="space-y-2">
                            {field.options?.map((opt, oIdx) => (
                              <label
                                key={oIdx}
                                className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                                  value === opt
                                    ? "bg-indigo-50/70 border-indigo-500 text-indigo-950 font-medium ring-1 ring-indigo-500"
                                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`radio_${field.id}`}
                                  checked={value === opt}
                                  onChange={() => handleFieldChange(field.id, opt)}
                                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-xs sm:text-sm">{opt}</span>
                              </label>
                            ))}
                          </div>
                        )}

                        {/* Checkbox / Multiple Choice */}
                        {field.type === "checkbox" && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {field.options?.map((opt, oIdx) => {
                              const checked = Array.isArray(value) && value.includes(opt);
                              return (
                                <label
                                  key={oIdx}
                                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                                    checked
                                      ? "bg-indigo-50/70 border-indigo-500 text-indigo-950 font-medium ring-1 ring-indigo-500"
                                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => handleCheckboxToggle(field.id, opt)}
                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <span className="text-xs sm:text-sm">{opt}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}

                        {/* Select / Dropdown */}
                        {field.type === "select" && (
                          <select
                            value={value || ""}
                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            className="w-full p-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                          >
                            <option value="">Selecione uma opção...</option>
                            {field.options?.map((opt, oIdx) => (
                              <option key={oIdx} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        )}

                        {/* Scale / Rating */}
                        {field.type === "scale" && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {Array.from(
                                { length: (field.scaleMax ?? 5) - (field.scaleMin ?? 1) + 1 },
                                (_, i) => (field.scaleMin ?? 1) + i
                              ).map((num) => (
                                <button
                                  key={num}
                                  type="button"
                                  onClick={() => handleFieldChange(field.id, num)}
                                  className={`w-10 h-10 rounded-xl border font-bold text-sm transition-all ${
                                    value === num
                                      ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                                  }`}
                                >
                                  {num}
                                </button>
                              ))}
                            </div>
                            {(field.minLabel || field.maxLabel) && (
                              <div className="flex justify-between text-[11px] text-slate-400 px-1">
                                <span>{field.minLabel}</span>
                                <span>{field.maxLabel}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* File Upload / Link */}
                        {field.type === "file" && (
                          <div className="space-y-2">
                            <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center bg-slate-50/60">
                              <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                              <p className="text-xs text-slate-600 font-medium">
                                Cole o link do arquivo ou pasta (Google Drive, Dropbox, WeTransfer)
                              </p>
                              <input
                                type="text"
                                value={value || ""}
                                onChange={(e) => handleFieldChange(field.id, e.target.value)}
                                placeholder="https://drive.google.com/..."
                                className="mt-2 w-full p-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-800"
                              />
                            </div>
                          </div>
                        )}

                        {/* Consent / Terms */}
                        {field.type === "consent" && (
                          <label className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/70 transition-colors">
                            <input
                              type="checkbox"
                              checked={Boolean(value)}
                              onChange={(e) => handleFieldChange(field.id, e.target.checked)}
                              className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <div className="text-xs sm:text-sm text-slate-800 font-medium">
                              <span>{(field.options && field.options[0]) || "Li e estou de acordo com os termos."}</span>
                            </div>
                          </label>
                        )}
                      </div>

                      {/* Error Message */}
                      {error && (
                        <p className="text-xs text-rose-600 font-medium flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>{error}</span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Submit Error Alert */}
        {submitError && (
          <div className="mx-6 mb-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs sm:text-sm animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <div className="flex-1">
              <strong className="font-bold block">Falha ao salvar respostas:</strong>
              <span>{submitError}</span>
            </div>
          </div>
        )}

        {/* Submit Bottom Bar */}
        <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            * Campos com asterisco são obrigatórios para envio.
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenPdfExport}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-2xs"
            >
              <Download className="w-4 h-4 text-rose-600" />
              <span>Exportar Formulário em PDF</span>
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: form.themeColor || "#4f46e5" }}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Salvando no Servidor...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Registrar Resposta de Teste</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {submittedId && (
        <PostSubmitEmailModal
          isOpen={isEmailModalOpen}
          onClose={() => setIsEmailModalOpen(false)}
          form={form}
          submissionId={submittedId}
          respondentEmail={submittedRespondentEmail}
          respondentName={submittedRespondentName}
          answers={answers}
          initialAutoReplySent={true}
        />
      )}
    </div>
  );
};
