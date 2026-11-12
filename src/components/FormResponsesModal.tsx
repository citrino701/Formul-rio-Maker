import React, { useState, useEffect } from "react";
import {
  X,
  FileSpreadsheet,
  Download,
  RefreshCw,
  Trash2,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  ListOrdered,
  Calendar,
  User,
  Mail,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Share2,
  Copy,
  Printer,
  Send,
  Eye,
  Loader2
} from "lucide-react";
import { FormStructure, FormSubmission } from "../types";
import { exportFormToPdf } from "../utils/pdfExport";

interface FormResponsesModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: FormStructure;
  onOpenShareModal: () => void;
  allForms?: any[];
  onSelectForm?: (formId: string) => void;
}

export const FormResponsesModal: React.FC<FormResponsesModalProps> = ({
  isOpen,
  onClose,
  form,
  onOpenShareModal,
  allForms = [],
  onSelectForm
}) => {
  const [activeTab, setActiveTab] = useState<"summary" | "individual">("summary");
  const [selectedFormId, setSelectedFormId] = useState<string>(form.id);
  const [responses, setResponses] = useState<FormSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndividualIdx, setSelectedIndividualIdx] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [customEmailInput, setCustomEmailInput] = useState("");
  const [resendNotification, setResendNotification] = useState<{
    id: string;
    success: boolean;
    message: string;
  } | null>(null);
  const [previewEmailModal, setPreviewEmailModal] = useState<{
    isOpen: boolean;
    subject: string;
    to: string;
    sentAt: string;
    previewText?: string;
  } | null>(null);

  // Sync selectedFormId when form prop changes
  useEffect(() => {
    if (form?.id) {
      setSelectedFormId(form.id);
    }
  }, [form?.id]);

  // Fetch responses from server (supports single form or all forms)
  const fetchResponses = async () => {
    setIsLoading(true);
    try {
      const url =
        selectedFormId === "all"
          ? "/api/responses"
          : `/api/forms/${encodeURIComponent(selectedFormId)}/responses`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.responses)) {
          setResponses(data.responses);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar respostas:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchResponses();
      // Auto-poll responses every 12 seconds while modal is open
      const interval = setInterval(fetchResponses, 12000);
      return () => clearInterval(interval);
    }
  }, [isOpen, selectedFormId]);

  const otherFormsWithResponses = allForms.filter(
    (f) => f.id !== selectedFormId && (f.responseCount || 0) > 0
  );

  const handleResendAutoReply = async (sub: FormSubmission, emailOverride?: string) => {
    setIsResending(true);
    setResendNotification(null);
    try {
      const targetEmail = emailOverride?.trim() || sub.respondentEmail;
      const targetFormId = sub.formId || form.id;

      const res = await fetch(
        `/api/forms/${encodeURIComponent(targetFormId)}/responses/${encodeURIComponent(
          sub.id
        )}/dispatch-emails`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            respondentEmail: targetEmail || "",
            adminEmail: "hugoviajante@gmail.com",
            sendToRespondent: Boolean(targetEmail),
            sendToAdmin: true
          })
        }
      );

      const data = await res.json();
      if (res.ok && data.success) {
        setResendNotification({
          id: sub.id,
          success: true,
          message: `E-mails enviados com sucesso para ${
            targetEmail ? targetEmail + " e " : ""
          }hugoviajante@gmail.com!`
        });
        setCustomEmailInput("");
        fetchResponses();
      } else {
        setResendNotification({
          id: sub.id,
          success: false,
          message: data.error || "Falha ao enviar e-mail de confirmação."
        });
      }
    } catch (err: any) {
      console.error("Erro ao reenviar e-mail:", err);
      setResendNotification({
        id: sub.id,
        success: false,
        message: "Erro de conexão ao tentar enviar o e-mail."
      });
    } finally {
      setIsResending(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchResponses();
      setSelectedIndividualIdx(0);
    }
  }, [isOpen, form.id]);

  if (!isOpen) return null;

  const totalResponses = responses.length;

  // Flatten all fields for reporting
  const allFields = form.sections.flatMap((s) => s.fields);

  // Export to CSV with UTF-8 BOM
  const handleExportCsv = () => {
    if (responses.length === 0) {
      alert("Não há respostas para exportar.");
      return;
    }

    const headers = [
      "ID do Envio",
      "Data e Hora",
      "Nome do Respondente",
      "E-mail",
      ...allFields.map((f) => `"${f.label.replace(/"/g, '""')}"`)
    ];

    const rows = responses.map((sub) => {
      const fieldAnswers = allFields.map((f) => {
        const ans = sub.answers[f.id];
        if (ans === undefined || ans === null) return '""';
        if (Array.isArray(ans)) return `"${ans.join("; ").replace(/"/g, '""')}"`;
        if (typeof ans === "boolean") return ans ? '"Sim"' : '"Não"';
        return `"${String(ans).replace(/"/g, '""')}"`;
      });

      return [
        `"${sub.id}"`,
        `"${new Date(sub.submittedAt).toLocaleString("pt-BR")}"`,
        `"${(sub.respondentName || "").replace(/"/g, '""')}"`,
        `"${(sub.respondentEmail || "").replace(/"/g, '""')}"`,
        ...fieldAnswers
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `respostas_${form.title.toLowerCase().replace(/[^a-z0-9]/g, "_")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export current individual response to PDF
  const handleExportIndividualPdf = (sub: FormSubmission) => {
    exportFormToPdf(
      form,
      {
        mode: "answers",
        companyName: sub.respondentName || "Resposta Individual",
        includeGuidelines: false,
        includeHelpText: false,
        includeNotes: true,
        paperSize: "a4"
      },
      sub.answers
    );
  };

  // Delete a submission
  const handleDeleteSubmission = async (subId: string) => {
    if (confirm("Deseja realmente excluir este registro de resposta?")) {
      try {
        const res = await fetch(`/api/forms/${form.id}/responses/${subId}`, {
          method: "DELETE"
        });
        if (res.ok) {
          setResponses((prev) => prev.filter((r) => r.id !== subId));
          if (selectedIndividualIdx >= responses.length - 1) {
            setSelectedIndividualIdx(Math.max(0, responses.length - 2));
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?respond=${encodeURIComponent(
      form.id
    )}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const currentIndividual = responses[selectedIndividualIdx] || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-md">
                Painel de Respostas
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {totalResponses} {totalResponses === 1 ? "resposta salva" : "respostas salvas"}
              </span>
            </div>
            
            {/* Form Selector Dropdown */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-xs font-semibold text-slate-500">Exibindo:</span>
              <select
                value={selectedFormId}
                onChange={(e) => setSelectedFormId(e.target.value)}
                className="text-xs font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 shadow-2xs focus:ring-2 focus:ring-indigo-500 max-w-[280px] truncate"
              >
                <option value={form.id}>📄 {form.title} (Formulário Atual)</option>
                <option value="all">🌐 Todas as Respostas (Todos os Formulários)</option>
                {allForms
                  .filter((f) => f.id !== form.id)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      📄 {f.title} ({f.responseCount || 0} {f.responseCount === 1 ? "resposta" : "respostas"})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={fetchResponses}
              disabled={isLoading}
              className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-200/60 rounded-xl transition-colors"
              title="Atualizar respostas"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-indigo-600" : ""}`} />
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={totalResponses === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors"
              title="Baixar planilha CSV com todas as respostas"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Exportar CSV</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Informative notification if current form has 0 responses but another form has responses */}
        {otherFormsWithResponses.length > 0 && selectedFormId !== "all" && totalResponses === 0 && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Este formulário ainda não possui respostas salvas, mas encontramos respostas registradas em outros formulários:
                {otherFormsWithResponses.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFormId(f.id)}
                    className="ml-1.5 underline font-bold text-amber-900 hover:text-amber-950 cursor-pointer"
                  >
                    "{f.title}" ({f.responseCount} {f.responseCount === 1 ? "resposta" : "respostas"})
                  </button>
                ))}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedFormId("all")}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors shrink-0"
            >
              Ver Todas as Respostas
            </button>
          </div>
        )}

        {/* Switch Editor Form shortcut if viewing another form */}
        {selectedFormId !== form.id && selectedFormId !== "all" && onSelectForm && (
          <div className="bg-indigo-50 border-b border-indigo-200 px-6 py-2 flex items-center justify-between text-xs text-indigo-900">
            <span>Você está visualizando respostas de outro formulário.</span>
            <button
              type="button"
              onClick={() => {
                onSelectForm(selectedFormId);
                onClose();
              }}
              className="font-bold underline text-indigo-700 hover:text-indigo-950"
            >
              Carregar este formulário no editor principal
            </button>
          </div>
        )}

        {/* Sub-Header: Tabs & Actions */}
        <div className="px-6 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab("summary")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                activeTab === "summary"
                  ? "bg-white text-indigo-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Resumo por Pergunta</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("individual")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                activeTab === "individual"
                  ? "bg-white text-indigo-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>Respostas Individuais ({totalResponses})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyLink}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 py-1 px-2.5 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{copiedLink ? "Link Copiado!" : "Copiar Link para Responder"}</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {totalResponses === 0 ? (
            /* Empty State */
            <div className="py-12 text-center max-w-md mx-auto space-y-4">
              <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto border border-indigo-100 shadow-2xs">
                <BarChart3 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Nenhuma resposta recebida ainda
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Envie o link de preenchimento para seus clientes ou equipe. Assim que alguém responder, os dados aparecerão aqui em tempo real!
                </p>
              </div>
              <div className="pt-2 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenShareModal();
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Gerar Link para Responder</span>
                </button>
              </div>
            </div>
          ) : activeTab === "summary" ? (
            /* Tab 1: Question-by-Question Summary */
            <div className="space-y-6">
              {form.sections.map((section, sIdx) => (
                <div key={section.id} className="space-y-4">
                  <div className="border-b border-slate-200 pb-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      {sIdx + 1}. {section.title}
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {section.fields.map((field, fIdx) => {
                      // Gather all answers for this field
                      const fieldAnswers = responses
                        .map((r) => r.answers[field.id])
                        .filter((val) => val !== undefined && val !== "" && val !== null);

                      return (
                        <div
                          key={field.id}
                          className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-bold text-slate-900 leading-snug">
                                {fIdx + 1}. {field.label}
                              </p>
                              <span className="text-[11px] text-slate-500">
                                {fieldAnswers.length} de {totalResponses} respostas
                              </span>
                            </div>
                            <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                              {field.type}
                            </span>
                          </div>

                          {/* Render based on field type */}
                          {/* Choice Breakdown (radio, checkbox, select) */}
                          {["radio", "checkbox", "select"].includes(field.type) && field.options && (
                            <div className="space-y-2 pt-1">
                              {field.options.map((option, oIdx) => {
                                let count = 0;
                                fieldAnswers.forEach((ans) => {
                                  if (Array.isArray(ans)) {
                                    if (ans.includes(option)) count++;
                                  } else if (ans === option) {
                                    count++;
                                  }
                                });

                                const percentage =
                                  fieldAnswers.length > 0
                                    ? Math.round((count / fieldAnswers.length) * 100)
                                    : 0;

                                return (
                                  <div key={oIdx} className="space-y-1">
                                    <div className="flex justify-between text-xs text-slate-700">
                                      <span className="font-medium">{option}</span>
                                      <span className="font-bold text-slate-900">
                                        {count} ({percentage}%)
                                      </span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-indigo-600 rounded-full transition-all"
                                        style={{ width: `${percentage}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Scale / Rating Breakdown */}
                          {field.type === "scale" && (
                            <div className="space-y-2 pt-1">
                              {(() => {
                                const nums = fieldAnswers.map(Number).filter((n) => !isNaN(n));
                                const avg =
                                  nums.length > 0
                                    ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)
                                    : "0";

                                return (
                                  <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200">
                                    <div>
                                      <span className="text-2xl font-extrabold text-indigo-600">
                                        {avg}
                                      </span>
                                      <span className="text-xs text-slate-400 ml-1">
                                        / {field.scaleMax || 5}
                                      </span>
                                      <p className="text-[11px] text-slate-500">Média Geral</p>
                                    </div>
                                    <div className="text-xs text-slate-600 border-l border-slate-200 pl-4 space-y-0.5">
                                      <p>Total de votos: {nums.length}</p>
                                      <p>Maior nota: {nums.length > 0 ? Math.max(...nums) : "-"}</p>
                                      <p>Menor nota: {nums.length > 0 ? Math.min(...nums) : "-"}</p>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}

                          {/* Text / Paragraph / Freeform list */}
                          {!["radio", "checkbox", "select", "scale"].includes(field.type) && (
                            <div className="max-h-44 overflow-y-auto space-y-1.5 pt-1">
                              {fieldAnswers.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">Sem respostas.</p>
                              ) : (
                                fieldAnswers.map((ans, aIdx) => (
                                  <div
                                    key={aIdx}
                                    className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-800 leading-relaxed"
                                  >
                                    {field.type === "file" && typeof ans === "string" && ans.startsWith("http") ? (
                                      <a
                                        href={ans}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-indigo-600 underline flex items-center gap-1 font-medium"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                        <span>{ans}</span>
                                      </a>
                                    ) : (
                                      <span>{String(ans)}</span>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Tab 2: Individual Submissions */
            currentIndividual && (
              <div className="space-y-6">
                {/* Scrollable Clickable Response Selection Bar */}
                <div className="bg-slate-100 p-3.5 rounded-2xl border-2 border-slate-300 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <ListOrdered className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Selecione a Resposta para Visualizar ({totalResponses} recebidas):
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleExportIndividualPdf(currentIndividual)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border-2 border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors shadow-2xs"
                        title="Exportar esta resposta em PDF"
                      >
                        <Download className="w-3.5 h-3.5 text-rose-600" />
                        <span>Baixar PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSubmission(currentIndividual.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border-2 border-slate-300 rounded-xl transition-colors bg-white"
                        title="Excluir este envio"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Horizontal Scrollable Responses List */}
                  <div className="flex items-center gap-2 overflow-x-auto py-1 px-0.5 scrollbar-thin">
                    {responses.map((sub, idx) => {
                      const isSelected = idx === selectedIndividualIdx;
                      const displayName = sub.respondentName?.trim() || "Anônimo";
                      const dateStr = new Date(sub.submittedAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit"
                      });

                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => setSelectedIndividualIdx(idx)}
                          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                            isSelected
                              ? "bg-indigo-600 text-white shadow-sm border-2 border-indigo-800 scale-102"
                              : "bg-white text-slate-800 hover:bg-slate-50 border-2 border-slate-300"
                          }`}
                        >
                          <span>Resposta {idx + 1} ({displayName})</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                              isSelected
                                ? "bg-indigo-700/80 text-indigo-100"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {dateStr}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Submitter Metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-white rounded-2xl border-2 border-slate-300 text-xs">
                  <div className="flex items-center gap-2 text-slate-900">
                    <User className="w-4 h-4 text-indigo-600" />
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-500">Respondente</p>
                      <p className="font-bold">{currentIndividual.respondentName || "Não identificado"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-slate-900">
                    <Mail className="w-4 h-4 text-indigo-600" />
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-500">E-mail</p>
                      <p className="font-bold truncate">{currentIndividual.respondentEmail || "-"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-slate-900">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-500">Data e Hora</p>
                      <p className="font-bold">
                        {new Date(currentIndividual.submittedAt).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Status de Confirmação Automática por E-mail */}
                <div className="p-4 bg-white rounded-2xl border-2 border-slate-300 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-slate-200 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg">
                        <Mail className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Resposta Automática por E-mail
                        </h5>
                        <p className="text-[11px] text-slate-500">
                          Disparo automático de e-mail ao respondente com confirmação e resumo de respostas.
                        </p>
                      </div>
                    </div>

                    {currentIndividual.autoReply ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-full text-xs font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>E-mail Disparado</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-300 rounded-full text-xs font-semibold">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Pendente / Não disparado</span>
                      </span>
                    )}
                  </div>

                  {/* Detalhes do disparo */}
                  {currentIndividual.autoReply ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="space-y-1">
                          <div>
                            <span className="text-slate-500 font-medium">Destinatário: </span>
                            <span className="font-bold text-slate-900">
                              {currentIndividual.autoReply.recipientEmail || currentIndividual.respondentEmail || "Não informado"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 font-medium">Cópia Administrador: </span>
                            <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                              hugoviajante@gmail.com
                            </span>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-md">
                              Encaminhado
                            </span>
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-500 font-medium">Data do Disparo: </span>
                          <span className="font-bold text-slate-800">
                            {new Date(currentIndividual.autoReply.sentAt).toLocaleString("pt-BR")}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-200">
                        <div className="truncate text-slate-700 text-xs">
                          <span className="text-slate-500 font-medium">Assunto: </span>
                          <span className="font-semibold">"{currentIndividual.autoReply.subject}"</span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewEmailModal({
                                isOpen: true,
                                subject: currentIndividual.autoReply?.subject || "",
                                to: currentIndividual.autoReply?.recipientEmail || "",
                                sentAt: currentIndividual.autoReply?.sentAt || "",
                                previewText: currentIndividual.autoReply?.bodyText
                              })
                            }
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Ver E-mail</span>
                          </button>

                          <button
                            type="button"
                            disabled={isResending}
                            onClick={() => handleResendAutoReply(currentIndividual)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs disabled:opacity-50"
                          >
                            {isResending ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                            <span>Reenviar</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs space-y-2">
                      <p className="text-amber-800">
                        {currentIndividual.respondentEmail
                          ? `O e-mail deste respondente (${currentIndividual.respondentEmail}) foi detectado. Deseja disparar a confirmação agora?`
                          : "Nenhum campo de e-mail foi detectado nesta resposta. Digite um e-mail para enviar o comprovante:"}
                      </p>

                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="email"
                          value={customEmailInput || (currentIndividual.respondentEmail || "")}
                          onChange={(e) => setCustomEmailInput(e.target.value)}
                          placeholder="exemplo@email.com"
                          className="flex-1 p-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
                        />
                        <button
                          type="button"
                          disabled={isResending}
                          onClick={() =>
                            handleResendAutoReply(
                              currentIndividual,
                              customEmailInput || currentIndividual.respondentEmail
                            )
                          }
                          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs disabled:opacity-50 shrink-0"
                        >
                          {isResending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          <span>Disparar Confirmação</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {resendNotification && resendNotification.id === currentIndividual.id && (
                    <div
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                        resendNotification.success
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-rose-50 text-rose-800 border-rose-200"
                      }`}
                    >
                      {resendNotification.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <span>{resendNotification.message}</span>
                    </div>
                  )}
                </div>

                {/* All Sections & Answers */}
                <div className="space-y-6">
                  {form.sections.map((section, sIdx) => (
                    <div key={section.id} className="space-y-3 p-5 bg-white rounded-2xl border-2 border-slate-300">
                      <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider border-b-2 border-slate-200 pb-2">
                        {sIdx + 1}. {section.title}
                      </h4>
                      <div className="space-y-4 pt-1">
                        {section.fields.map((field, fIdx) => {
                          const ans = currentIndividual.answers[field.id];
                          const hasAnswer =
                            ans !== undefined &&
                            ans !== "" &&
                            ans !== null &&
                            (!Array.isArray(ans) || ans.length > 0);

                          return (
                            <div
                              key={field.id}
                              className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-900">
                                  {fIdx + 1}. {field.label}
                                </span>
                                {field.required && (
                                  <span className="text-[10px] font-semibold text-rose-600">
                                    Obrigatória
                                  </span>
                                )}
                              </div>

                              <div className="pt-1">
                                {hasAnswer ? (
                                  Array.isArray(ans) ? (
                                    <div className="flex flex-wrap gap-1.5">
                                      {ans.map((item, i) => (
                                        <span
                                          key={i}
                                          className="px-2 py-0.5 bg-white border border-indigo-200 text-indigo-900 text-xs rounded-md font-medium"
                                        >
                                          ✓ {item}
                                        </span>
                                      ))}
                                    </div>
                                  ) : field.type === "consent" ? (
                                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md inline-block">
                                      ✓ Termo aceito e confirmado
                                    </span>
                                  ) : field.type === "file" &&
                                    typeof ans === "string" &&
                                    ans.startsWith("http") ? (
                                    <a
                                      href={ans}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-xs text-indigo-600 underline font-semibold flex items-center gap-1"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      <span>{ans}</span>
                                    </a>
                                  ) : (
                                    <p className="text-xs text-slate-800 bg-white p-2.5 rounded-lg border border-slate-200 whitespace-pre-wrap leading-relaxed">
                                      {String(ans)}
                                    </p>
                                  )
                                ) : (
                                  <p className="text-xs text-slate-400 italic">Não respondido</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Formulário ID: <code className="font-mono text-slate-700">{form.id}</code>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-xl transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Modal de Pré-visualização do E-mail Disparado */}
      {previewEmailModal && previewEmailModal.isOpen && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full border-2 border-slate-300 shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-4 bg-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-indigo-300" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Visualização do E-mail Enviado
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewEmailModal(null)}
                className="p-1 hover:bg-indigo-900 rounded-lg text-indigo-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs text-slate-800">
              <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-3 space-y-1.5 font-sans">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">Para:</span>
                  <span className="font-bold text-slate-900">{previewEmailModal.to}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">Assunto:</span>
                  <span className="font-bold text-slate-900">{previewEmailModal.subject}</span>
                </div>
                {previewEmailModal.sentAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-bold">Disparado em:</span>
                    <span className="text-slate-600 font-medium">
                      {new Date(previewEmailModal.sentAt).toLocaleString("pt-BR")}
                    </span>
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50/50 border border-slate-200 rounded-xl max-h-60 overflow-y-auto font-mono text-[11px] whitespace-pre-wrap leading-relaxed text-slate-700">
                {previewEmailModal.previewText ||
                  "Comprovante oficial de envio e confirmação do formulário."}
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewEmailModal(null)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors"
              >
                Fechar Visualização
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
