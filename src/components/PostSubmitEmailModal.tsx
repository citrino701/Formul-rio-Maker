import React, { useState, useEffect } from "react";
import {
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  X,
  UserCheck,
  ShieldCheck,
  Eye,
  Loader2,
  RefreshCw,
  Copy,
  Check
} from "lucide-react";
import { FormStructure, FormAnswers } from "../types";
import {
  getCachedGmailToken,
  getCachedGmailUser,
  subscribeGmailAuth,
  signInWithGmail,
  sendEmailViaGmail,
  buildConfirmationEmailHtml
} from "../services/gmailService";

interface PostSubmitEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: FormStructure;
  submissionId: string;
  respondentEmail?: string;
  respondentName?: string;
  answers: FormAnswers;
  initialAutoReplySent?: boolean;
}

const DEFAULT_ADMIN_EMAIL = "hugoviajante@gmail.com";

export const PostSubmitEmailModal: React.FC<PostSubmitEmailModalProps> = ({
  isOpen,
  onClose,
  form,
  submissionId,
  respondentEmail = "",
  respondentName = "",
  answers,
  initialAutoReplySent = true
}) => {
  const [targetRespondentEmail, setTargetRespondentEmail] = useState(respondentEmail);
  const [adminEmail, setAdminEmail] = useState(DEFAULT_ADMIN_EMAIL);
  const [sendToRespondent, setSendToRespondent] = useState(Boolean(respondentEmail));
  const [sendToAdmin, setSendToAdmin] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [copiedProtocol, setCopiedProtocol] = useState(false);
  const [isGmailConnected, setIsGmailConnected] = useState<boolean>(Boolean(getCachedGmailToken()));
  const [isConnectingGmail, setIsConnectingGmail] = useState(false);
  const [isAutonomousServerReady, setIsAutonomousServerReady] = useState(false);

  // Live status indicators
  const [respondentStatus, setRespondentStatus] = useState<"idle" | "sent" | "failed">(
    initialAutoReplySent && respondentEmail ? "sent" : "idle"
  );
  const [adminStatus, setAdminStatus] = useState<"idle" | "sent" | "failed">(
    initialAutoReplySent ? "sent" : "idle"
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeGmailAuth((_user, token) => {
      setIsGmailConnected(Boolean(token));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const checkServerStatus = async () => {
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
    checkServerStatus();
  }, [isOpen]);

  useEffect(() => {
    if (respondentEmail) {
      setTargetRespondentEmail(respondentEmail);
      setSendToRespondent(true);
    }
  }, [respondentEmail]);

  if (!isOpen) return null;

  const handleConnectGmailInModal = async () => {
    setIsConnectingGmail(true);
    setStatusMessage(null);
    try {
      const { email } = await signInWithGmail();
      setIsGmailConnected(true);
      setStatusMessage(`Conta Google conectada (${email})! Agora clique em 'Disparar E-mails Agora'.`);
    } catch (err: any) {
      setStatusMessage(`Erro ao conectar com Google: ${err.message || "Tente novamente."}`);
    } finally {
      setIsConnectingGmail(false);
    }
  };

  const handleDispatch = async () => {
    setIsSending(true);
    setStatusMessage(null);
    try {
      const token = getCachedGmailToken();
      const user = getCachedGmailUser();
      let sentViaGmailClient = false;

      if (token) {
        // Direct Gmail sending via user's authenticated Google Account!
        try {
          if (sendToRespondent && targetRespondentEmail) {
            const respondentHtml = buildConfirmationEmailHtml({
              formTitle: form.title,
              submissionId,
              respondentName: respondentName || "Prezado(a) Respondente",
              answers,
              isAdminCopy: false
            });
            await sendEmailViaGmail({
              to: targetRespondentEmail.trim(),
              subject: `Confirmação de recebimento: ${form.title}`,
              htmlBody: respondentHtml,
              senderName: user?.displayName || "Hugo Gomes Pinheiro"
            });
            setRespondentStatus("sent");
          }

          if (sendToAdmin && adminEmail) {
            const adminHtml = buildConfirmationEmailHtml({
              formTitle: form.title,
              submissionId,
              respondentName: respondentName || "Prezado(a) Respondente",
              answers,
              isAdminCopy: true
            });
            await sendEmailViaGmail({
              to: adminEmail.trim(),
              subject: `[Novo Envio] ${form.title} - ${respondentName || "Respondente"}`,
              htmlBody: adminHtml,
              senderName: user?.displayName || "Hugo Gomes Pinheiro"
            });
            setAdminStatus("sent");
          }
          sentViaGmailClient = true;
        } catch (gmailErr: any) {
          console.warn("Falha no envio direto via Gmail client, tentando servidor:", gmailErr);
        }
      }

      // Also notify/persist via backend dispatch-emails
      const res = await fetch(
        `/api/forms/${encodeURIComponent(form.id)}/responses/${encodeURIComponent(
          submissionId
        )}/dispatch-emails`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            respondentEmail: targetRespondentEmail.trim(),
            adminEmail: adminEmail.trim(),
            sendToRespondent,
            sendToAdmin
          })
        }
      );

      const data = await res.json();
      if (!sentViaGmailClient && (!res.ok || !data.success)) {
        throw new Error(data.error || "Falha ao enviar e-mails.");
      }

      if (sendToRespondent && targetRespondentEmail) {
        setRespondentStatus("sent");
      }
      if (sendToAdmin && adminEmail) {
        setAdminStatus("sent");
      }

      if (sentViaGmailClient || data.status === "sent") {
        setStatusMessage(
          `E-mails enviados com sucesso diretamente da sua conta Google! ${
            sendToRespondent && targetRespondentEmail ? `Respondente: ${targetRespondentEmail} • ` : ""
          }Cópia Administrador: ${adminEmail}`
        );
      } else {
        setStatusMessage(
          `Registro processado no sistema! Para garantir entrega nas caixas de entrada externas, conecte seu Gmail (${adminEmail}) clicando no botão acima.`
        );
      }
    } catch (err: any) {
      console.error(err);
      setStatusMessage(`Erro ao disparar e-mails: ${err.message || "Tente novamente."}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyProtocol = () => {
    navigator.clipboard.writeText(submissionId);
    setCopiedProtocol(true);
    setTimeout(() => setCopiedProtocol(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95">
        {/* Header */}
        <div className="p-6 bg-linear-to-r from-indigo-700 via-indigo-800 to-slate-900 text-white relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-indigo-200 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold uppercase tracking-wider mb-2">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Formulário Preenchido & Salvo</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <Mail className="w-6 h-6 text-indigo-300" />
            <span>Encaminhar Respostas por E-mail</span>
          </h2>
          <p className="text-xs sm:text-sm text-indigo-100 mt-1 opacity-90">
            Confirmação automática de recebimento e encaminhamento de cópia para o administrador.
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-800 text-xs sm:text-sm">
          {/* Protocol Info Pill */}
          <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-3.5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600">
                Protocolo de Atendimento
              </p>
              <p className="font-mono font-bold text-slate-900 text-xs sm:text-sm mt-0.5">
                {submissionId}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyProtocol}
              className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-700 transition-colors shadow-2xs"
            >
              {copiedProtocol ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>

          {/* Status Alert Banner */}
          {statusMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-emerald-900 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs leading-relaxed font-medium">
                {statusMessage}
              </div>
            </div>
          )}

          {/* Google Account Connection Status */}
          {isAutonomousServerReady ? (
            <div className="px-4 py-3 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-emerald-950">
                    Servidor 24/7 Autônomo Conectado (hugoviajante@gmail.com)
                  </p>
                  <p className="text-[11px] text-emerald-800 leading-snug">
                    Os e-mails são processados e entregues diretamente pelo servidor mesmo se você estiver offline ou com o app fechado.
                  </p>
                </div>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            </div>
          ) : !isGmailConnected ? (
            <div className="p-4 bg-amber-50/90 border border-amber-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-950">
                    Conectar seu Gmail ({adminEmail})
                  </p>
                  <p className="text-[11px] text-amber-800 leading-snug">
                    Para que os e-mails cheguem nas caixas de entrada externas, conecte seu Google ou configure a Senha de App 24/7.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleConnectGmailInModal}
                disabled={isConnectingGmail}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isConnectingGmail ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Mail className="w-3.5 h-3.5" />
                )}
                <span>{isConnectingGmail ? "Autorizando..." : "Conectar com Google"}</span>
              </button>
            </div>
          ) : (
            <div className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-xs font-bold text-emerald-950">
                  Gmail Conectado: hugoviajante@gmail.com (Envio real ativo)
                </span>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          )}

          {/* Destinations Container */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Destinatários do E-mail
            </h3>

            {/* Recipient 1: Respondent Email */}
            <div className="border-2 border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={sendToRespondent}
                    onChange={(e) => setSendToRespondent(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs sm:text-sm">
                    <UserCheck className="w-4 h-4 text-indigo-600" />
                    <span>E-mail do Respondente</span>
                  </div>
                </label>

                {respondentStatus === "sent" && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Enviado</span>
                  </span>
                )}
              </div>

              <div>
                <input
                  type="email"
                  value={targetRespondentEmail}
                  onChange={(e) => setTargetRespondentEmail(e.target.value)}
                  placeholder="E-mail preenchido no formulário (ex: cliente@email.com)"
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden font-medium"
                />
                {!targetRespondentEmail && (
                  <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>Nenhum e-mail foi detectado nas respostas. Digite o e-mail acima para enviar.</span>
                  </p>
                )}
              </div>
            </div>

            {/* Recipient 2: Admin Forwarding (hugoviajante@gmail.com) */}
            <div className="border-2 border-indigo-200 rounded-2xl p-4 bg-indigo-50/40 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={sendToAdmin}
                    onChange={(e) => setSendToAdmin(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs sm:text-sm">
                    <ShieldCheck className="w-4 h-4 text-indigo-700" />
                    <span>Encaminhar para Meu E-mail (Administrador)</span>
                  </div>
                </label>

                {adminStatus === "sent" && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Enviado</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 bg-white border border-indigo-200 rounded-xl px-3.5 py-2">
                <Mail className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="font-bold text-slate-900 text-xs sm:text-sm">{adminEmail}</span>
                <span className="ml-auto text-[10px] font-extrabold uppercase tracking-wider bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md">
                  Cópia Automática
                </span>
              </div>
            </div>
          </div>

          {/* Quick Preview Toggle */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-indigo-600" />
                <span>Visualizar resumo do e-mail</span>
              </span>
              <span className="text-[11px] text-indigo-600 font-semibold">
                {showPreview ? "Ocultar" : "Mostrar"}
              </span>
            </button>

            {showPreview && (
              <div className="p-4 bg-white border-t border-slate-200 space-y-2 max-h-48 overflow-y-auto text-xs">
                <p className="font-bold text-slate-900">
                  Assunto: Confirmação de recebimento: {form.title}
                </p>
                <div className="border-t border-slate-100 pt-2 space-y-1.5">
                  {form.sections.flatMap((s) => s.fields).map((f) => {
                    const ans = answers[f.id];
                    if (ans === undefined || ans === "") return null;
                    return (
                      <div key={f.id} className="flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-2">
                        <span className="font-semibold text-slate-600">{f.label}:</span>
                        <span className="font-medium text-slate-900 sm:text-right">
                          {Array.isArray(ans) ? ans.join(", ") : String(ans)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500 text-center sm:text-left">
            Uma cópia completa com todas as perguntas e respostas é encaminhada.
          </p>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 border border-slate-300 hover:bg-white text-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              Concluir & Fechar
            </button>
            <button
              type="button"
              disabled={isSending || (!sendToRespondent && !sendToAdmin)}
              onClick={handleDispatch}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Disparar E-mails Agora</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
