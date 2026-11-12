import React, { useState, useEffect } from "react";
import {
  Mail,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Send,
  ExternalLink,
  ShieldCheck,
  Server,
  Zap,
  Check,
  X,
  LogOut,
  Key,
  Eye,
  EyeOff,
  Globe,
  Radio,
  Lock,
  HelpCircle
} from "lucide-react";
import {
  signInWithGmail,
  logoutGmail,
  getCachedGmailUser,
  getCachedGmailToken,
  subscribeGmailAuth,
  sendEmailViaGmail,
  buildConfirmationEmailHtml
} from "../services/gmailService";
import { User } from "firebase/auth";
import { ServerEmailSettings } from "../types";

interface EmailIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmailIntegrationModal: React.FC<EmailIntegrationModalProps> = ({
  isOpen,
  onClose
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(getCachedGmailUser());
  const [hasToken, setHasToken] = useState<boolean>(Boolean(getCachedGmailToken()));
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Active configuration tab
  const [activeTab, setActiveTab] = useState<
    "app_password" | "cloud_api" | "custom_smtp" | "webhook" | "oauth_tab"
  >("app_password");

  // Server persistent configuration state
  const [emailConfig, setEmailConfig] = useState<ServerEmailSettings>({
    mode: "gmail_app_password",
    gmailUser: "hugoviajante@gmail.com",
    gmailAppPassword: "",
    hasGmailAppPassword: false,
    resendApiKey: "",
    hasResendApiKey: false,
    resendFrom: "Formulários <onboarding@resend.dev>",
    brevoApiKey: "",
    hasBrevoApiKey: false,
    brevoSender: "hugoviajante@gmail.com",
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPass: "",
    hasSmtpPass: false,
    smtpSecure: false,
    smtpFrom: "hugoviajante@gmail.com",
    webhookUrl: "",
    adminEmail: "hugoviajante@gmail.com",
    senderName: "Hugo Gomes Pinheiro",
    autoSendRespondent: true,
    autoSendAdmin: true,
    isServerAutonomous: false
  });

  const [inputGmailPassword, setInputGmailPassword] = useState("");
  const [showGmailPassword, setShowGmailPassword] = useState(false);
  const [inputResendKey, setInputResendKey] = useState("");
  const [inputBrevoKey, setInputBrevoKey] = useState("");
  const [inputSmtpHost, setInputSmtpHost] = useState("");
  const [inputSmtpPort, setInputSmtpPort] = useState(587);
  const [inputSmtpUser, setInputSmtpUser] = useState("");
  const [inputSmtpPass, setInputSmtpPass] = useState("");
  const [inputWebhookUrl, setInputWebhookUrl] = useState("");

  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [statusData, setStatusData] = useState<{
    activeProvider: string;
    isRealConfigured: boolean;
    isServerAutonomous?: boolean;
    providerDetails?: string;
    adminEmail: string;
    senderName?: string;
    gmailConnected?: boolean;
    gmailAccount?: string | null;
    recentDispatches: Array<{
      id: string;
      submissionId: string;
      formTitle: string;
      respondentEmail: string | null;
      adminEmail: string;
      provider: string;
      status: "sent" | "simulated" | "failed";
      timestamp: string;
      subject: string;
    }>;
    totalRecordedDispatches: number;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    const unsub = subscribeGmailAuth((user, token) => {
      setCurrentUser(user);
      setHasToken(Boolean(token));
    });
    return () => unsub();
  }, []);

  const fetchStatusAndConfig = async () => {
    setIsLoading(true);
    try {
      const [statusRes, configRes] = await Promise.all([
        fetch("/api/email/status"),
        fetch("/api/email/config")
      ]);

      if (statusRes.ok) {
        const sData = await statusRes.json();
        if (sData.success) {
          setStatusData(sData);
        }
      }

      if (configRes.ok) {
        const cData = await configRes.json();
        if (cData.success && cData.config) {
          setEmailConfig(cData.config);
          setInputSmtpHost(cData.config.smtpHost || "");
          setInputSmtpPort(cData.config.smtpPort || 587);
          setInputSmtpUser(cData.config.smtpUser || "");
          setInputWebhookUrl(cData.config.webhookUrl || "");
        }
      }
    } catch (err) {
      console.error("Erro ao carregar dados do serviço de e-mail:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatusAndConfig();
      setTestResult(null);
      setSaveFeedback(null);
    }
  }, [isOpen]);

  const handleSaveAppPassword = async () => {
    setIsSavingConfig(true);
    setSaveFeedback(null);
    setTestResult(null);

    try {
      const cleanPass = inputGmailPassword.trim().replace(/\s+/g, "");
      const res = await fetch("/api/email/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "gmail_app_password",
          gmailUser: "hugoviajante@gmail.com",
          gmailAppPassword: cleanPass || undefined,
          keepGmailAppPassword: cleanPass === "" && emailConfig.hasGmailAppPassword
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSaveFeedback({
          success: true,
          message: "Credencial salva com sucesso! O servidor agora está preparado para enviar e-mails 24/7 sem navegador."
        });
        setInputGmailPassword("");
        await fetchStatusAndConfig();
      } else {
        setSaveFeedback({
          success: false,
          message: data.error || "Erro ao salvar credencial no servidor."
        });
      }
    } catch (err: any) {
      setSaveFeedback({
        success: false,
        message: err.message || "Erro de conexão ao salvar."
      });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSaveCloudApi = async () => {
    setIsSavingConfig(true);
    setSaveFeedback(null);
    try {
      const payload: any = {
        mode: inputResendKey ? "resend" : "brevo"
      };
      if (inputResendKey.trim()) payload.resendApiKey = inputResendKey.trim();
      if (inputBrevoKey.trim()) payload.brevoApiKey = inputBrevoKey.trim();

      const res = await fetch("/api/email/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSaveFeedback({
          success: true,
          message: "Chave de API salva com sucesso no servidor!"
        });
        setInputResendKey("");
        setInputBrevoKey("");
        await fetchStatusAndConfig();
      } else {
        setSaveFeedback({
          success: false,
          message: data.error || "Erro ao salvar chave de API."
        });
      }
    } catch (err: any) {
      setSaveFeedback({ success: false, message: err.message });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSaveSmtp = async () => {
    setIsSavingConfig(true);
    setSaveFeedback(null);
    try {
      const res = await fetch("/api/email/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "smtp",
          smtpHost: inputSmtpHost.trim(),
          smtpPort: Number(inputSmtpPort),
          smtpUser: inputSmtpUser.trim(),
          smtpPass: inputSmtpPass.trim() || undefined,
          keepSmtpPass: inputSmtpPass === "" && emailConfig.hasSmtpPass,
          smtpSecure: Number(inputSmtpPort) === 465
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSaveFeedback({
          success: true,
          message: "Configurações de SMTP salvas com sucesso!"
        });
        setInputSmtpPass("");
        await fetchStatusAndConfig();
      } else {
        setSaveFeedback({
          success: false,
          message: data.error || "Erro ao salvar SMTP."
        });
      }
    } catch (err: any) {
      setSaveFeedback({ success: false, message: err.message });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSaveWebhook = async () => {
    setIsSavingConfig(true);
    setSaveFeedback(null);
    try {
      const res = await fetch("/api/email/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "webhook",
          webhookUrl: inputWebhookUrl.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSaveFeedback({
          success: true,
          message: "Webhook de notificação salvo com sucesso!"
        });
        await fetchStatusAndConfig();
      } else {
        setSaveFeedback({
          success: false,
          message: data.error || "Erro ao salvar webhook."
        });
      }
    } catch (err: any) {
      setSaveFeedback({ success: false, message: err.message });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setTestResult(null);
    try {
      const { email } = await signInWithGmail();
      setTestResult({
        success: true,
        message: `Conectado com sucesso como ${email}! As notificações dispararão via Gmail enquanto você estiver no navegador.`
      });
      fetchStatusAndConfig();
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Não foi possível conectar com o Google."
      });
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await logoutGmail();
      setTestResult({
        success: true,
        message: "Sessão temporária do Gmail desconectada."
      });
      fetchStatusAndConfig();
    } catch (e: any) {
      console.error(e);
    }
  };

  // Test sending via autonomous server backend!
  const handleSendTestEmail = async () => {
    setIsSendingTest(true);
    setTestResult(null);
    try {
      const adminEmail = "hugoviajante@gmail.com";

      // Trigger backend autonomous test endpoint
      const res = await fetch("/api/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetEmail: adminEmail })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        if (data.status === "sent") {
          setTestResult({
            success: true,
            message: `E-mail de teste ENTREGUE COM SUCESSO via ${data.providerDetails || "Servidor"} para ${data.targetEmail}! Verifique sua caixa de entrada.`
          });
        } else {
          setTestResult({
            success: false,
            message: `Aviso: Para enviar 24/7 sem precisar de navegador aberto, configure a Senha de Aplicativo do Gmail (16 letras) na aba 'Gmail Oficial (24/7)' acima.`
          });
        }
        fetchStatusAndConfig();
      } else {
        setTestResult({
          success: false,
          message: data.error || "Erro ao processar envio de e-mail de teste."
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Falha na conexão com o serviço de e-mail."
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  if (!isOpen) return null;

  const isAutonomous = Boolean(emailConfig.isServerAutonomous || statusData?.isServerAutonomous);
  const isGmailOAuthActive = Boolean(hasToken || statusData?.gmailConnected);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shadow-xs">
              <Mail className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base leading-tight">
                  Envio Automático de E-mails 24/7
                </h3>
                {isAutonomous ? (
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Offline Ready
                  </span>
                ) : (
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                    Aguardando Credencial 24/7
                  </span>
                )}
              </div>
              <p className="text-xs text-blue-200 mt-0.5">
                Disparo autônomo para o respondente e cópia em <strong>hugoviajante@gmail.com</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Autonomous Status Banner */}
        <div className={`px-6 py-3 border-b flex items-center justify-between text-xs ${
          isAutonomous
            ? "bg-emerald-50 text-emerald-950 border-emerald-200"
            : "bg-amber-50 text-amber-950 border-amber-200"
        }`}>
          <div className="flex items-center gap-2">
            {isAutonomous ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <div>
              <strong>
                {isAutonomous
                  ? "Servidor 100% Autônomo e Ativo (Offline Ready):"
                  : "Modo Atual: Requer que a aba esteja aberta no navegador"}
              </strong>{" "}
              <span>
                {isAutonomous
                  ? "Qualquer resposta enviada chegará por e-mail imediatamente, mesmo com seu navegador fechado ou offline!"
                  : "Para que o sistema continue enviando e-mails 24h por dia mesmo quando você não estiver com o app aberto, configure a Senha de Aplicativo abaixo."}
              </span>
            </div>
          </div>
          <span className="text-[11px] font-bold shrink-0 ml-2 px-2 py-0.5 rounded bg-white/70 border">
            {statusData?.activeProvider || "Simulado"}
          </span>
        </div>

        {/* Tabs Selection Bar */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-2 overflow-x-auto gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("app_password")}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === "app_password"
                ? "border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-2xs"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Gmail Oficial (Senha de App - 24/7)</span>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-1.5 py-0.2 rounded">
              Recomendado
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("cloud_api")}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === "cloud_api"
                ? "border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-2xs"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Resend / Brevo (API)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("custom_smtp")}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === "custom_smtp"
                ? "border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-2xs"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>SMTP Próprio</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("webhook")}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === "webhook"
                ? "border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-2xs"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Webhook (Make/Zapier)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("oauth_tab")}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === "oauth_tab"
                ? "border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-2xs"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Login Google (Temporário)</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* TAB 1: GMAIL APP PASSWORD (RECOMMENDED) */}
          {activeTab === "app_password" && (
            <div className="space-y-4">
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 text-xs text-indigo-950 space-y-2">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-indigo-700" />
                  <h4 className="font-bold text-sm text-indigo-900">
                    Envio Nativo pelo Gmail hugoviajante@gmail.com (Nunca expira)
                  </h4>
                </div>
                <p className="leading-relaxed text-indigo-900/90">
                  O Google permite que você gere uma <strong>Senha de Aplicativo de 16 letras</strong> exclusiva para sistemas como este.
                  Ela permite que o servidor envie e-mails em seu nome <strong>24 horas por dia, 7 dias por semana</strong>, de forma segura e sem precisar que nenhuma janela ou guia do navegador fique aberta.
                </p>
              </div>

              {/* Form Input for App Password */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    Conta Gmail Remetente
                  </label>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    {emailConfig.hasGmailAppPassword ? "Senha de App Configurada no Servidor" : "Não configurado"}
                  </span>
                </div>
                <input
                  type="text"
                  readOnly
                  value="hugoviajante@gmail.com"
                  className="w-full px-3.5 py-2 text-xs font-mono bg-slate-100 border border-slate-300 rounded-xl text-slate-700 cursor-not-allowed"
                />

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>Senha de Aplicativo Google (16 caracteres)</span>
                      {emailConfig.hasGmailAppPassword && (
                        <span className="text-[10px] text-emerald-600 font-bold">
                          (Já salva: ••••••••••••••••)
                        </span>
                      )}
                    </label>
                    <a
                      href="https://myaccount.google.com/apppasswords"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                    >
                      <span>Gerar Senha de App no Google</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="relative">
                    <input
                      type={showGmailPassword ? "text" : "password"}
                      value={inputGmailPassword}
                      onChange={(e) => setInputGmailPassword(e.target.value)}
                      placeholder={
                        emailConfig.hasGmailAppPassword
                          ? "Insira uma nova senha apenas se quiser alterar..."
                          : "Ex: abcd efgh ijkl mnop"
                      }
                      className="w-full px-3.5 py-2.5 text-xs font-mono bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGmailPassword(!showGmailPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showGmailPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Espaços serão removidos automaticamente.
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleSaveAppPassword}
                    disabled={isSavingConfig}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingConfig ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Salvando no Servidor...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Salvar Credencial 24/7</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Step by step guide */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs text-slate-600">
                <h5 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                  <HelpCircle className="w-4 h-4 text-blue-600" />
                  <span>Passo a passo rápido (Leva 30 segundos):</span>
                </h5>
                <ol className="list-decimal list-inside space-y-1.5 text-[12px] text-slate-700">
                  <li>
                    Acesse{" "}
                    <a
                      href="https://myaccount.google.com/apppasswords"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 font-bold underline"
                    >
                      myaccount.google.com/apppasswords
                    </a>{" "}
                    (Faça login com hugoviajante@gmail.com).
                  </li>
                  <li>
                    No campo <strong>Nome do app</strong>, digite <em>Formulários</em> e clique em <strong>Criar</strong>.
                  </li>
                  <li>
                    O Google exibirá um código amarelo de 16 letras (ex: <code className="bg-slate-200 px-1 rounded">abcd efgh ijkl mnop</code>).
                  </li>
                  <li>
                    Copie esse código, cole no campo acima e clique em <strong>Salvar Credencial 24/7</strong>.
                  </li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 2: RESEND / BREVO (CLOUD API) */}
          {activeTab === "cloud_api" && (
            <div className="space-y-4">
              <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 text-xs text-blue-950 space-y-1">
                <h4 className="font-bold text-sm text-blue-900">
                  Provedores de E-mail Transacional (Nuvem 24/7)
                </h4>
                <p className="leading-relaxed text-blue-900/90">
                  Alternativa gratuita excelente para disparo em lote. O Resend oferece 3.000 envios/mês gratuitos e o Brevo 300 envios/dia.
                </p>
              </div>

              <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-800">
                      Chave de API do Resend (re_...)
                    </label>
                    <a
                      href="https://resend.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-indigo-600 font-bold flex items-center gap-1"
                    >
                      <span>Obter chave no Resend</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <input
                    type="password"
                    value={inputResendKey}
                    onChange={(e) => setInputResendKey(e.target.value)}
                    placeholder={
                      emailConfig.hasResendApiKey ? "Chave salva (••••••••)" : "Cole sua chave re_..."
                    }
                    className="w-full px-3.5 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl"
                  />
                </div>

                <div className="pt-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-800">
                      Chave de API do Brevo (xkeysib-...)
                    </label>
                    <a
                      href="https://app.brevo.com/settings/keys/api"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-indigo-600 font-bold flex items-center gap-1"
                    >
                      <span>Obter chave no Brevo</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <input
                    type="password"
                    value={inputBrevoKey}
                    onChange={(e) => setInputBrevoKey(e.target.value)}
                    placeholder={
                      emailConfig.hasBrevoApiKey ? "Chave salva (••••••••)" : "Cole sua chave xkeysib-..."
                    }
                    className="w-full px-3.5 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveCloudApi}
                    disabled={isSavingConfig}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Salvar Chave de API
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CUSTOM SMTP */}
          {activeTab === "custom_smtp" && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                  Configurações de Servidor SMTP Próprio
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Servidor SMTP (Host)
                    </label>
                    <input
                      type="text"
                      value={inputSmtpHost}
                      onChange={(e) => setInputSmtpHost(e.target.value)}
                      placeholder="Ex: smtp.hostinger.com ou mail.meusite.com"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Porta SMTP
                    </label>
                    <input
                      type="number"
                      value={inputSmtpPort}
                      onChange={(e) => setInputSmtpPort(Number(e.target.value))}
                      placeholder="587 ou 465"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Usuário / E-mail
                    </label>
                    <input
                      type="text"
                      value={inputSmtpUser}
                      onChange={(e) => setInputSmtpUser(e.target.value)}
                      placeholder="seu@dominio.com"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Senha do SMTP
                    </label>
                    <input
                      type="password"
                      value={inputSmtpPass}
                      onChange={(e) => setInputSmtpPass(e.target.value)}
                      placeholder={emailConfig.hasSmtpPass ? "Senha salva (••••••••)" : "Senha da conta"}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleSaveSmtp}
                    disabled={isSavingConfig}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Salvar SMTP
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: WEBHOOK */}
          {activeTab === "webhook" && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                  Webhook de Notificação (Zapier, Make, n8n)
                </h4>
                <p className="text-xs text-slate-600">
                  Receba um POST em tempo real com todos os dados da resposta e protocolo para disparar notificações por WhatsApp, Discord, Telegram ou CRM.
                </p>
                <input
                  type="url"
                  value={inputWebhookUrl}
                  onChange={(e) => setInputWebhookUrl(e.target.value)}
                  placeholder="https://hook.eu1.make.com/..."
                  className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-300 rounded-xl"
                />
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleSaveWebhook}
                    disabled={isSavingConfig}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Salvar Webhook
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: OAUTH TAB */}
          {activeTab === "oauth_tab" && (
            <div className="space-y-4">
              <div className={`p-5 rounded-2xl border transition-all ${
                isGmailOAuthActive
                  ? "bg-emerald-50/80 border-emerald-300"
                  : "bg-blue-50/80 border-blue-200"
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${isGmailOAuthActive ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                      <h4 className="text-sm font-bold text-slate-900">
                        {isGmailOAuthActive ? "Sessão Google Conectada" : "Conectar com Google (Temporário)"}
                      </h4>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {isGmailOAuthActive
                        ? `Conectado como ${currentUser?.email || "hugoviajante@gmail.com"}. O token temporário enviará e-mails enquanto sua aba estiver aberta.`
                        : "Conecte sua conta do Google para envio rápido enquanto estiver utilizando o app."}
                    </p>
                  </div>

                  <div className="shrink-0">
                    {isGmailOAuthActive ? (
                      <button
                        type="button"
                        onClick={handleGoogleLogout}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-rose-50 border border-slate-300 hover:border-rose-300 text-slate-700 hover:text-rose-700 text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-2xs"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Desconectar</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={isSigningIn}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 border-2 border-slate-300 hover:border-blue-500 rounded-xl font-bold text-xs text-slate-800 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 48 48">
                          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                        </svg>
                        <span>{isSigningIn ? "Conectando..." : "Conectar com Google"}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Feedback messages for saving */}
          {saveFeedback && (
            <div
              className={`p-3 rounded-xl text-xs font-medium border flex items-start gap-2 ${
                saveFeedback.success
                  ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                  : "bg-rose-50 text-rose-900 border-rose-200"
              }`}
            >
              {saveFeedback.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span>{saveFeedback.message}</span>
            </div>
          )}

          {/* Universal Test Trigger Card */}
          <div className="border border-indigo-200 bg-indigo-50/80 rounded-2xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-indigo-950 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-indigo-600" />
                  <span>Testar Envio Real 24/7 (Simular Respondente Offline)</span>
                </h4>
                <p className="text-xs text-indigo-900/80 mt-0.5">
                  Dispara um teste autônomo diretamente do servidor para <strong>hugoviajante@gmail.com</strong> sem depender de nenhuma janela aberta.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={isSendingTest}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
              >
                {isSendingTest ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Disparando pelo Servidor...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Testar Agora</span>
                  </>
                )}
              </button>
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-xl text-xs font-medium border flex items-start gap-2 ${
                  testResult.success
                    ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                    : "bg-amber-50 text-amber-950 border-amber-200"
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          {/* Double Notification Architecture Explanation */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs text-slate-600">
            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Garantia de Entrega Dupla 24/7:</span>
            </h4>
            <ul className="space-y-1.5 text-[12px] list-disc list-inside">
              <li>
                <strong>Para o Respondente:</strong> Recebe o protocolo oficial e o comprovante completo em nome de <strong>Hugo Gomes Pinheiro (hugoviajante@gmail.com)</strong>.
              </li>
              <li>
                <strong>Para Você (hugoviajante@gmail.com):</strong> Uma cópia detalhada com todas as respostas cai diretamente na sua caixa de entrada, mesmo que você esteja dormindo, viajando ou sem computador.
              </li>
            </ul>
          </div>

          {/* Recent Dispatches List */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Histórico de Disparos Registrados
              </h4>
              <button
                type="button"
                onClick={fetchStatusAndConfig}
                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
                <span>Atualizar lista</span>
              </button>
            </div>

            {statusData?.recentDispatches && statusData.recentDispatches.length > 0 ? (
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {statusData.recentDispatches.map((disp) => (
                  <div key={disp.id} className="p-3 text-xs hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-slate-900 truncate">
                        {disp.formTitle || "Formulário"}
                      </div>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                        disp.provider.includes("24_7") || disp.provider === "resend" || disp.provider === "brevo"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                          : disp.provider === "gmail_oauth_real"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                      }`}>
                        <Check className="w-3 h-3" />
                        <span>
                          {disp.provider === "gmail_app_password_24_7"
                            ? "Gmail 24/7 (Autônomo)"
                            : disp.provider === "resend"
                            ? "Resend API (24/7)"
                            : disp.provider === "brevo"
                            ? "Brevo API (24/7)"
                            : disp.provider === "nodemailer_smtp"
                            ? "SMTP 24/7"
                            : disp.provider === "gmail_oauth_real"
                            ? "Gmail OAuth (Navegador)"
                            : "Simulado"}
                        </span>
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>
                        Respondente:{" "}
                        <strong className="text-slate-800">
                          {disp.respondentEmail || "Não informado"}
                        </strong>
                      </span>
                      <span>
                        Admin: <strong className="text-indigo-700">{disp.adminEmail}</strong>
                      </span>
                      <span className="text-slate-400">
                        {new Date(disp.timestamp).toLocaleTimeString("pt-BR")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-500">
                Nenhum disparo registrado ainda.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          <span className="text-[11px] text-slate-500">
            Remetente Oficial: <strong>hugoviajante@gmail.com</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
