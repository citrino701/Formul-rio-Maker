import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import { getStore } from "./store.js";
import { AI_FORM_CONTEXT } from "./aiContext.js";

dotenv.config();

export const app = express();

// A Vercel aceita no máximo ~4,5 MB por requisição.
app.use(express.json({ limit: "4.5mb" }));
app.use(express.urlencoded({ extended: true, limit: "4.5mb" }));

// Escapa texto vindo do formulário antes de colocar no HTML do e-mail
function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Gemini AI Setup
// ---------------------------------------------------------------------------
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY não foi configurada no ambiente.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// JSON Schema for Form Generation
const formSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Título claro e profissional do formulário" },
    subtitle: { type: Type.STRING, description: "Subtítulo ou contexto do formulário" },
    estimatedTime: { type: Type.STRING, description: "Tempo estimado de resposta (ex: '15 a 25 minutos')" },
    openingMessage: { type: Type.STRING, description: "Texto de boas-vindas / orientações no topo do formulário" },
    closingMessage: { type: Type.STRING, description: "Mensagem de agradecimento ou orientações finais após envio" },
    internalGuidelines: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Orientações de uso interno ou critérios para quem vai analisar o formulário"
    },
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "ID único da seção (ex: sec_1)" },
          title: { type: Type.STRING, description: "Título do bloco ou seção (ex: '01. Contexto essencial')" },
          description: { type: Type.STRING, description: "Descrição ou orientações para esta seção" },
          fields: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING, description: "ID único do campo (ex: f_1_1)" },
                label: { type: Type.STRING, description: "A pergunta ou enunciado do campo" },
                type: {
                  type: Type.STRING,
                  description: "Tipo do campo: 'text', 'textarea', 'radio', 'checkbox', 'select', 'email', 'phone', 'number', 'date', 'file', 'scale', 'consent'"
                },
                required: { type: Type.BOOLEAN, description: "Se o preenchimento é obrigatório" },
                placeholder: { type: Type.STRING, description: "Exemplo ou placeholder para o campo" },
                helpText: { type: Type.STRING, description: "Dica, instrução de apoio ou indicação técnica" },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Lista de opções para múltipla escolha, caixas de seleção ou lista suspensa"
                },
                scaleMin: { type: Type.INTEGER, description: "Mínimo para escalas numéricas (ex: 1)" },
                scaleMax: { type: Type.INTEGER, description: "Máximo para escalas numéricas (ex: 5 ou 10)" },
                minLabel: { type: Type.STRING, description: "Rótulo do valor mínimo (ex: Pouco provável)" },
                maxLabel: { type: Type.STRING, description: "Rótulo do valor máximo (ex: Muito provável)" }
              },
              required: ["id", "label", "type", "required"]
            }
          }
        },
        required: ["id", "title", "fields"]
      }
    }
  },
  required: ["title", "sections"]
};

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

// Health check
app.get("/api/health", (_req, res) => {
  let storage: string;
  try { storage = getStore().kind; } catch (e: any) { storage = `erro: ${e.message}`; }
  res.json({ status: "ok", storage, timestamp: new Date().toISOString() });
});

// List all forms with statistics
app.get("/api/forms", async (_req, res) => {
  try {
    const list = (await getStore().listForms()).map(({ form, responseCount, lastResponseAt }) => {
      const sections = Array.isArray(form?.sections) ? form.sections : [];
      const totalQuestions = sections.reduce(
        (acc: number, s: any) => acc + (Array.isArray(s?.fields) ? s.fields.length : 0),
        0
      );
      return {
        id: form.id,
        title: form.title || "Sem título",
        subtitle: form.subtitle || "",
        createdAt: form.createdAt || new Date().toISOString(),
        updatedAt: form.updatedAt || form.createdAt || new Date().toISOString(),
        sectionsCount: sections.length,
        totalQuestions,
        responseCount,
        lastResponseAt
      };
    });

    list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    res.json({ success: true, forms: list });
  } catch (err: any) {
    console.error("Falha ao listar formulários no servidor:", err);
    res.status(500).json({ success: false, error: err.message || "Falha ao listar formulários." });
  }
});

// Get single form
app.get("/api/forms/:id", async (req, res) => {
  try {
    const stats = await getStore().getForm(req.params.id);
    if (!stats) {
      res.status(404).json({ error: "Formulário não encontrado." });
      return;
    }
    res.json({
      success: true,
      form: stats.form,
      responseCount: stats.responseCount,
      lastResponseAt: stats.lastResponseAt
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Erro ao carregar formulário." });
  }
});

// Save / Update a form
app.post("/api/forms", async (req, res) => {
  try {
    const form = req.body;
    if (!form || !form.title || !Array.isArray(form.sections)) {
      res.status(400).json({ error: "Estrutura do formulário inválida." });
      return;
    }

    const now = new Date().toISOString();
    const updatedForm = {
      ...form,
      id: form.id || `form_${Date.now()}`,
      createdAt: form.createdAt || now,
      updatedAt: now
    };

    await getStore().saveForm(updatedForm);
    res.json({ success: true, form: updatedForm });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Erro ao salvar formulário." });
  }
});

// Delete a form
app.delete("/api/forms/:id", async (req, res) => {
  try {
    const removed = await getStore().deleteForm(req.params.id);
    if (!removed) {
      res.status(404).json({ error: "Formulário não encontrado." });
      return;
    }
    res.json({ success: true, message: "Formulário excluído com sucesso." });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Erro ao excluir formulário." });
  }
});
// ---------------------------------------------------------------------------
// Tagged Links & Click Tracking Management
// ---------------------------------------------------------------------------
function parseUserAgent(uaString?: string): string {
  if (!uaString) return "Navegador padrão";
  const ua = uaString.toLowerCase();
  let browser = "Navegador Web";
  let os = "Dispositivo";

  if (ua.includes("edg/")) browser = "Microsoft Edge";
  else if (ua.includes("chrome/") && !ua.includes("chromium/")) browser = "Google Chrome";
  else if (ua.includes("safari/") && !ua.includes("chrome/")) browser = "Apple Safari";
  else if (ua.includes("firefox/")) browser = "Mozilla Firefox";
  else if (ua.includes("opera/") || ua.includes("opr/")) browser = "Opera";
  else if (ua.includes("brave")) browser = "Brave Browser";

  if (ua.includes("iphone")) os = "iPhone (iOS)";
  else if (ua.includes("ipad")) os = "iPad (iPadOS)";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("windows nt 10") || ua.includes("windows nt 11")) os = "Windows 10/11";
  else if (ua.includes("windows nt")) os = "Windows";
  else if (ua.includes("macintosh") || ua.includes("mac os x")) os = "macOS";
  else if (ua.includes("linux")) os = "Linux";

  return `${browser} • ${os}`;
}

// Contadores de cliques/conclusões calculados a partir da aba "Cliques"
function tagsWithCounts(form: any, clicks: any[]) {
  const tags = Array.isArray(form?.taggedLinks) ? form.taggedLinks : [];
  return tags.map((t: any) => ({
    ...t,
    clicksCount: clicks.filter((c) => c.tagId === t.id).length,
    completedCount: clicks.filter((c) => c.tagId === t.id && c.completed).length
  }));
}

// Track a click on a tagged link
app.post("/api/track/click", async (req, res) => {
  try {
    const { formId, tagId, tagName } = req.body;
    if (!formId || !tagId) {
      res.status(400).json({ error: "formId e tagId são obrigatórios." });
      return;
    }

    const form = (await getStore().getForm(formId))?.form;
    if (!form) {
      res.status(404).json({ error: "Formulário não encontrado." });
      return;
    }

    form.taggedLinks = Array.isArray(form.taggedLinks) ? form.taggedLinks : [];
    let tagObj = form.taggedLinks.find((t: any) => t.id === tagId);
    if (!tagObj) {
      tagObj = { id: tagId, name: tagName || `Link ${tagId}`, createdAt: new Date().toISOString(), clicksCount: 0, completedCount: 0 };
      form.taggedLinks.push(tagObj);
      await getStore().saveForm(form);
    }

    const now = new Date();
    const dia = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const horario = now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const rawUa = (req.headers["user-agent"] as string) || "";
    const navegador = parseUserAgent(rawUa);
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";

    const clickRecord = {
      id: `clk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      formId,
      tagId,
      tagName: tagObj.name,
      dia,
      horario,
      navegador,
      userAgent: rawUa,
      ip,
      completed: false,
      timestamp: now.toISOString()
    };

    await getStore().addClick(clickRecord);
    res.json({ success: true, click: clickRecord, tag: tagObj });
  } catch (err: any) {
    console.error("Erro ao registrar clique de link:", err);
    res.status(500).json({ error: err.message || "Erro ao registrar clique." });
  }
});

// Get tagged links and clicks for a form
app.get("/api/forms/:id/tags", async (req, res) => {
  try {
    const formId = req.params.id;
    const form = (await getStore().getForm(formId))?.form;
    if (!form) {
      res.status(404).json({ error: "Formulário não encontrado." });
      return;
    }
    const clicks = await getStore().listClicks(formId);
    res.json({ success: true, taggedLinks: tagsWithCounts(form, clicks), clicks });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Erro ao obter tags do formulário." });
  }
});

// Create or update tagged links for a form
app.post("/api/forms/:id/tags", async (req, res) => {
  try {
    const formId = req.params.id;
    const { taggedLinks, newTag } = req.body;
    const form = (await getStore().getForm(formId))?.form;
    if (!form) {
      res.status(404).json({ error: "Formulário não encontrado." });
      return;
    }
    form.taggedLinks = Array.isArray(form.taggedLinks) ? form.taggedLinks : [];

    if (Array.isArray(taggedLinks)) {
      form.taggedLinks = taggedLinks;
    } else if (newTag && newTag.name) {
      form.taggedLinks.push({
        id: newTag.id || `tag_${Date.now()}`,
        name: String(newTag.name).trim(),
        createdAt: new Date().toISOString(),
        clicksCount: 0,
        completedCount: 0
      });
    }

    await getStore().saveForm(form);
    const clicks = await getStore().listClicks(formId);
    res.json({ success: true, taggedLinks: tagsWithCounts(form, clicks) });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Erro ao salvar tags do formulário." });
  }
});

// Delete a tagged link
app.delete("/api/forms/:id/tags/:tagId", async (req, res) => {
  try {
    const { id: formId, tagId } = req.params;
    const form = (await getStore().getForm(formId))?.form;
    if (form) {
      form.taggedLinks = (form.taggedLinks || []).filter((t: any) => t.id !== tagId);
      await getStore().saveForm(form);
    }
    res.json({ success: true, message: "Link tagueado removido com sucesso." });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Erro ao remover tag." });
  }
});
// ---------------------------------------------------------------------------
// Auto-Reply Confirmation & Admin Forwarding Email Dispatcher
// ---------------------------------------------------------------------------
const DEFAULT_ADMIN_EMAIL = "hugoviajante@gmail.com";





interface ServerEmailConfig {
  mode: "gmail_app_password" | "resend" | "brevo" | "smtp" | "webhook";
  gmailUser: string;
  gmailAppPassword?: string;
  resendApiKey?: string;
  resendFrom?: string;
  brevoApiKey?: string;
  brevoSender?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecure?: boolean;
  smtpFrom?: string;
  webhookUrl?: string;
  adminEmail: string;
  senderName: string;
  autoSendRespondent: boolean;
  autoSendAdmin: boolean;
  lastTestedAt?: string;
  lastTestStatus?: "success" | "error";
  lastTestMessage?: string;
}

function defaultEmailConfig(): ServerEmailConfig {
  return {
    mode: "gmail_app_password",
    gmailUser: process.env.GMAIL_USER || DEFAULT_ADMIN_EMAIL,
    gmailAppPassword: process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS || "",
    resendApiKey: process.env.RESEND_API_KEY || "",
    resendFrom: process.env.RESEND_FROM || "Formulários <onboarding@resend.dev>",
    brevoApiKey: process.env.BREVO_API_KEY || "",
    brevoSender: process.env.BREVO_SENDER || DEFAULT_ADMIN_EMAIL,
    smtpHost: process.env.SMTP_HOST || "",
    smtpPort: Number(process.env.SMTP_PORT || 587),
    smtpUser: process.env.SMTP_USER || "",
    smtpPass: process.env.SMTP_PASS || "",
    smtpSecure: Number(process.env.SMTP_PORT) === 465,
    smtpFrom: process.env.SMTP_FROM || DEFAULT_ADMIN_EMAIL,
    webhookUrl: process.env.EMAIL_WEBHOOK_URL || "",
    adminEmail: process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL,
    senderName: process.env.SENDER_NAME || "Hugo Gomes Pinheiro",
    autoSendRespondent: true,
    autoSendAdmin: true
  };
}

// Mescla o que foi salvo pelo painel (aba "Config" da planilha) com as variáveis de ambiente.
// Campo vazio no painel nunca apaga a credencial que está na Vercel.
function mergeEmailConfig(saved: Partial<ServerEmailConfig> | null): ServerEmailConfig {
  const base = defaultEmailConfig();
  if (!saved) return base;
  return {
    ...base,
    ...saved,
    gmailUser: saved.gmailUser || base.gmailUser,
    gmailAppPassword: saved.gmailAppPassword || base.gmailAppPassword,
    resendApiKey: saved.resendApiKey || base.resendApiKey,
    brevoApiKey: saved.brevoApiKey || base.brevoApiKey,
    smtpHost: saved.smtpHost || base.smtpHost,
    smtpUser: saved.smtpUser || base.smtpUser,
    smtpPass: saved.smtpPass || base.smtpPass,
    webhookUrl: saved.webhookUrl || base.webhookUrl
  } as ServerEmailConfig;
}

async function saveEmailConfig(config: ServerEmailConfig) {
  try {
    await getStore().setConfig("email", config);
    configLoadedAt = Date.now();
  } catch (err) {
    console.error("[EmailConfig] Falha ao salvar configuração:", err);
  }
}

let activeEmailConfig: ServerEmailConfig = defaultEmailConfig();
let activeGmailOAuthSession: { token: string; email: string; updatedAt: string } | null = null;
let configLoadedAt = 0;
const CONFIG_TTL_MS = 15_000;

// Recarrega config de e-mail e sessão do Gmail da planilha (com cache curto).
async function refreshConfig(force = false) {
  if (!force && Date.now() - configLoadedAt < CONFIG_TTL_MS) return;
  try {
    const [email, gmail] = await Promise.all([
      getStore().getConfig<Partial<ServerEmailConfig>>("email"),
      getStore().getConfig<{ token: string; email: string; updatedAt: string }>("gmailSession")
    ]);
    activeEmailConfig = mergeEmailConfig(email);
    activeGmailOAuthSession = gmail?.token ? gmail : null;
    configLoadedAt = Date.now();
  } catch (err) {
    console.warn("[Config] Não consegui ler a config da planilha, usando variáveis de ambiente:", err);
  }
}

async function saveGmailSession(session: { token: string; email: string; updatedAt: string } | null) {
  try {
    await getStore().setConfig("gmailSession", session);
  } catch (e) {
    console.warn("[GmailOAuth] Falha ao salvar sessão:", e);
  }
}

app.use(async (req, _res, next) => {
  if (/^\/api\/(email|gmail|responses|forms\/[^/]+\/responses)/.test(req.path)) {
    await refreshConfig();
  }
  next();
});

function isAutonomousEmailConfigured(): { autonomous: boolean; provider: string; details: string } {
  if (activeEmailConfig.gmailAppPassword?.trim() || process.env.GMAIL_APP_PASSWORD) {
    return {
      autonomous: true,
      provider: "gmail_app_password",
      details: `Gmail via Senha de Aplicativo (${activeEmailConfig.gmailUser || DEFAULT_ADMIN_EMAIL}) - 24/7 Ativo`
    };
  }
  if (activeEmailConfig.resendApiKey?.trim() || process.env.RESEND_API_KEY) {
    return {
      autonomous: true,
      provider: "resend",
      details: "Resend API - 24/7 Ativo"
    };
  }
  if (activeEmailConfig.brevoApiKey?.trim() || process.env.BREVO_API_KEY) {
    return {
      autonomous: true,
      provider: "brevo",
      details: "Brevo API - 24/7 Ativo"
    };
  }
  if (
    (activeEmailConfig.smtpHost?.trim() && activeEmailConfig.smtpUser?.trim() && activeEmailConfig.smtpPass?.trim()) ||
    (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
  ) {
    return {
      autonomous: true,
      provider: "smtp",
      details: `SMTP Personalizado (${activeEmailConfig.smtpHost || process.env.SMTP_HOST}) - 24/7 Ativo`
    };
  }
  if (activeEmailConfig.webhookUrl?.trim() || process.env.EMAIL_WEBHOOK_URL) {
    return {
      autonomous: true,
      provider: "webhook",
      details: "Webhook de Automação Externo - 24/7 Ativo"
    };
  }
  return {
    autonomous: false,
    provider: "none",
    details: "Nenhum método autônomo de servidor configurado. Configure a Senha de Aplicativo do Gmail para envio 24/7 sem navegador."
  };
}



function encodeRfc2822(from: string, to: string, subject: string, html: string): string {
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?utf-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset="UTF-8"`,
    ``,
    html
  ];
  return Buffer.from(lines.join("\r\n"), "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

interface AutoReplyResult {
  sent: boolean;
  recipientEmail?: string;
  recipientName?: string;
  adminForwardEmail?: string;
  adminForwardSent?: boolean;
  subject?: string;
  sentAt?: string;
  status?: "sent" | "simulated";
  previewText?: string;
  htmlBody?: string;
  error?: string;
}

async function sendAutoReplyConfirmation(
  form: any,
  submissionId: string,
  respondentEmail: string,
  respondentName: string,
  answers: Record<string, any>,
  adminForwardEmail: string = DEFAULT_ADMIN_EMAIL,
  options?: { sendToRespondent?: boolean; sendToAdmin?: boolean }
): Promise<AutoReplyResult> {
  try {
    const config = form.autoReply || { enabled: true };
    if (config.enabled === false) {
      return { sent: false };
    }

    const recipientName = String(respondentName || "Prezado(a) Respondente").replace(/\s+/g, " ").trim().slice(0, 120);
    const formTitle = form.title || "Formulário";

    // Format custom subject
    let subject = config.subject || "Confirmação de recebimento: {{formTitle}}";
    subject = subject
      .replace(/{{formTitle}}/g, formTitle)
      .replace(/{{name}}/g, recipientName)
      .replace(/{{protocolo}}/g, submissionId);

    // Format custom greeting / message
    let customGreeting =
      config.customMessage ||
      `Olá, {{name}}! Confirmamos o recebimento das suas respostas para o formulário "{{formTitle}}". Abaixo você encontra o resumo das informações enviadas para sua conferência e protocolo de atendimento.`;
    customGreeting = customGreeting
      .replace(/{{formTitle}}/g, formTitle)
      .replace(/{{name}}/g, recipientName)
      .replace(/{{protocolo}}/g, submissionId);

    // Build answers summary table
    let answersHtmlRows = "";
    let answersTextRows = "";

    if (config.includeAnswersSummary !== false) {
      for (const section of form.sections || []) {
        for (const field of section.fields || []) {
          const val = answers[field.id];
          if (val !== undefined && val !== null && val !== "") {
            let displayVal = "";
            if (Array.isArray(val)) {
              displayVal = val.join(", ");
            } else if (typeof val === "boolean") {
              displayVal = val ? "Sim / Concordo" : "Não";
            } else {
              displayVal = String(val);
            }

            answersHtmlRows += `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 14px; font-size: 12px; font-weight: bold; color: #475569; width: 40%; vertical-align: top; background-color: #f8fafc;">
                  ${esc(field.label)}
                </td>
                <td style="padding: 10px 14px; font-size: 13px; color: #0f172a; vertical-align: top;">
                  ${esc(displayVal).replace(/\n/g, "<br/>")}
                </td>
              </tr>
            `;

            answersTextRows += `• ${field.label}: ${displayVal}\n`;
          }
        }
      }
    }

    const htmlBody = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #0f172a; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #cbd5e1; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { background: linear-gradient(135deg, #4338ca 0%, #1e1b4b 100%); color: #ffffff; padding: 28px 24px; text-align: center; }
          .badge { display: inline-block; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
          .title { font-size: 22px; font-weight: 800; margin: 0; }
          .subtitle { font-size: 13px; opacity: 0.9; margin: 6px 0 0 0; }
          .content { padding: 28px 24px; }
          .greeting { font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 20px; background-color: #f8fafc; border-left: 4px solid #6366f1; padding: 14px 16px; border-radius: 4px 8px 8px 4px; }
          .meta-box { background: #e0e7ff; border: 1px solid #c7d2fe; border-radius: 10px; padding: 12px 16px; font-size: 12px; color: #312e81; margin-bottom: 24px; }
          .table-title { font-size: 13px; font-weight: 700; text-transform: uppercase; color: #475569; letter-spacing: 0.05em; margin-bottom: 10px; }
          .answers-table { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 24px; }
          .footer { background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center; font-size: 11px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="badge">Comprovante de Envio</div>
            <h1 class="title">${esc(formTitle)}</h1>
            <p class="subtitle">Resposta automática gerada pelo sistema</p>
          </div>
          <div class="content">
            <div class="greeting">
              ${esc(customGreeting).replace(/\n/g, "<br/>")}
            </div>

            <div class="meta-box">
              <div style="margin-bottom: 4px;"><strong>Protocolo:</strong> ${esc(submissionId)}</div>
              <div><strong>Data de Envio:</strong> ${new Date().toLocaleString("pt-BR")}</div>
            </div>

            ${
              answersHtmlRows
                ? `
              <div class="table-title">Resumo das Suas Respostas:</div>
              <table class="answers-table">
                ${answersHtmlRows}
              </table>
            `
                : ""
            }

            <p style="font-size: 12px; color: #64748b; margin-top: 16px; line-height: 1.5;">
              Caso precise retificar alguma informação ou tenha dúvidas, favor entrar em contato com o organizador deste formulário informando o seu protocolo.
            </p>
          </div>
          <div class="footer">
            <p style="margin: 0;">Este é um e-mail de confirmação automático enviado para <strong>${esc(respondentEmail)}</strong>.</p>
            <p style="margin: 4px 0 0 0;">${esc(config.senderName || formTitle)} • Todos os direitos reservados</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textBody = `${subject}\n\n${customGreeting}\n\nProtocolo: ${submissionId}\nData: ${new Date().toLocaleString("pt-BR")}\n\nResumo:\n${answersTextRows}\n\nE-mail enviado automaticamente para ${respondentEmail}.`;

    const fromAddress = process.env.SMTP_FROM || process.env.RESEND_FROM || `"${config.senderName || formTitle}" <confirmacao@app.internal>`;
    const sendToRespondent = options?.sendToRespondent !== false && Boolean(respondentEmail);
    const sendToAdmin = options?.sendToAdmin !== false && Boolean(adminForwardEmail);

    let isRealDelivery = false;
    let providerUsed = "simulated";
    let messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const adminNoticeHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background-color: #e0e7ff; border: 2px solid #818cf8; border-radius: 12px; padding: 14px 18px; margin-bottom: 20px; color: #1e1b4b;">
        <strong style="font-size: 14px; display: block; margin-bottom: 4px;">📩 Encaminhamento para Administrador: ${esc(adminForwardEmail)}</strong>
        <div style="font-size: 13px; line-height: 1.5;">
          Novo preenchimento recebido no formulário <strong>"${esc(formTitle)}"</strong>.<br/>
          <strong>Respondente:</strong> ${esc(recipientName)} &lt;${esc(respondentEmail || "não informado")}&gt;<br/>
          <strong>Protocolo:</strong> ${esc(submissionId)}
        </div>
      </div>
      ${htmlBody}
    `;
    const adminTextBody = `[Cópia para Administrador: ${adminForwardEmail}]\nNovo envio recebido no formulário "${formTitle}":\nRespondente: ${recipientName} <${respondentEmail || "não informado"}>\nProtocolo: ${submissionId}\n\n${textBody}`;

    // -------------------------------------------------------------
    // Provider 1: Gmail via Google App Password (Nodemailer 24/7 Autonomous)
    // Works 24/7 without browser open, without popup, never expires!
    // -------------------------------------------------------------
    const gmailUser = (activeEmailConfig.gmailUser || process.env.GMAIL_USER || DEFAULT_ADMIN_EMAIL).trim();
    const gmailAppPass = (activeEmailConfig.gmailAppPassword || process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS || "").replace(/\s+/g, "");

    if (!isRealDelivery && gmailUser && gmailAppPass) {
      try {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: gmailUser,
            pass: gmailAppPass
          }
        });

        const gmailFrom = `"${config.senderName || activeEmailConfig.senderName || formTitle}" <${gmailUser}>`;

        if (sendToRespondent && respondentEmail) {
          const info = await transporter.sendMail({
            from: gmailFrom,
            to: respondentEmail,
            subject,
            text: textBody,
            html: htmlBody
          });
          if (info.messageId) messageId = info.messageId;
        }

        if (sendToAdmin && adminForwardEmail) {
          await transporter.sendMail({
            from: gmailFrom,
            to: adminForwardEmail,
            subject: `[Novo Envio] ${formTitle} - ${recipientName}`,
            text: adminTextBody,
            html: adminNoticeHtml
          });
        }

        isRealDelivery = true;
        providerUsed = "gmail_app_password_24_7";
        console.log(`[AutoReply 24/7] E-mails enviados com sucesso de forma autônoma via Gmail SMTP (${gmailUser}) para respondente e ${adminForwardEmail}`);
      } catch (gmailErr: any) {
        console.warn("[AutoReply 24/7] Falha no envio via Gmail App Password:", gmailErr?.message || gmailErr);
      }
    }

    // -------------------------------------------------------------
    // Provider 2: Resend API (Autonomous Server Delivery)
    // -------------------------------------------------------------
    const resendKey = (activeEmailConfig.resendApiKey || process.env.RESEND_API_KEY || "").trim();
    if (!isRealDelivery && resendKey) {
      try {
        const recipients = [];
        if (sendToRespondent && respondentEmail) recipients.push(respondentEmail);
        if (sendToAdmin && adminForwardEmail) recipients.push(adminForwardEmail);

        const resendSender = activeEmailConfig.resendFrom || process.env.RESEND_FROM || "onboarding@resend.dev";

        for (const to of recipients) {
          const isAdm = to === adminForwardEmail;
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              from: resendSender.includes("@") ? resendSender : "onboarding@resend.dev",
              to: [to],
              subject: isAdm ? `[Novo Envio] ${formTitle} - ${recipientName}` : subject,
              html: isAdm ? adminNoticeHtml : htmlBody,
              text: isAdm ? adminTextBody : textBody
            })
          });
          if (res.ok) {
            const data: any = await res.json();
            if (data.id) messageId = data.id;
            isRealDelivery = true;
            providerUsed = "resend";
            console.log(`[AutoReply 24/7] E-mail enviado com sucesso via Resend para ${to}`);
          }
        }
      } catch (resendErr: any) {
        console.warn("[AutoReply 24/7] Erro ao enviar via Resend API:", resendErr?.message || resendErr);
      }
    }

    // -------------------------------------------------------------
    // Provider 3: Brevo API (Autonomous Server Delivery)
    // -------------------------------------------------------------
    const brevoKey = (activeEmailConfig.brevoApiKey || process.env.BREVO_API_KEY || "").trim();
    if (!isRealDelivery && brevoKey) {
      try {
        const recipients = [];
        if (sendToRespondent && respondentEmail) recipients.push({ email: respondentEmail, isAdm: false });
        if (sendToAdmin && adminForwardEmail) recipients.push({ email: adminForwardEmail, isAdm: true });

        const brevoSenderEmail = activeEmailConfig.brevoSender || process.env.BREVO_SENDER || DEFAULT_ADMIN_EMAIL;

        for (const item of recipients) {
          const res = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
              "api-key": brevoKey,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              sender: { email: brevoSenderEmail, name: config.senderName || activeEmailConfig.senderName || formTitle },
              to: [{ email: item.email }],
              subject: item.isAdm ? `[Novo Envio] ${formTitle} - ${recipientName}` : subject,
              htmlContent: item.isAdm ? adminNoticeHtml : htmlBody,
              textContent: item.isAdm ? adminTextBody : textBody
            })
          });
          if (res.ok) {
            isRealDelivery = true;
            providerUsed = "brevo";
            console.log(`[AutoReply 24/7] E-mail enviado com sucesso via Brevo para ${item.email}`);
          }
        }
      } catch (brevoErr: any) {
        console.warn("[AutoReply 24/7] Erro ao enviar via Brevo API:", brevoErr?.message || brevoErr);
      }
    }

    // -------------------------------------------------------------
    // Provider 4: Custom SMTP (Nodemailer 24/7 Autonomous)
    // -------------------------------------------------------------
    const smtpHost = activeEmailConfig.smtpHost || process.env.SMTP_HOST;
    const smtpUser = activeEmailConfig.smtpUser || process.env.SMTP_USER;
    const smtpPass = activeEmailConfig.smtpPass || process.env.SMTP_PASS;

    if (!isRealDelivery && smtpHost && smtpUser && smtpPass) {
      try {
        const port = Number(activeEmailConfig.smtpPort || process.env.SMTP_PORT || 587);
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port,
          secure: activeEmailConfig.smtpSecure ?? port === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass
          }
        });

        const customFrom = activeEmailConfig.smtpFrom || process.env.SMTP_FROM || `"${config.senderName || formTitle}" <${smtpUser}>`;

        if (sendToRespondent && respondentEmail) {
          const info = await transporter.sendMail({
            from: customFrom,
            to: respondentEmail,
            subject,
            text: textBody,
            html: htmlBody
          });
          if (info.messageId) messageId = info.messageId;
        }

        if (sendToAdmin && adminForwardEmail) {
          await transporter.sendMail({
            from: customFrom,
            to: adminForwardEmail,
            subject: `[Novo Envio] ${formTitle} - ${recipientName}`,
            text: adminTextBody,
            html: adminNoticeHtml
          });
        }

        isRealDelivery = true;
        providerUsed = "nodemailer_smtp";
        console.log(`[AutoReply 24/7] E-mails enviados com sucesso via SMTP Personalizado (${smtpHost})`);
      } catch (smtpErr: any) {
        console.warn("[AutoReply 24/7] Falha no envio SMTP:", smtpErr?.message || smtpErr);
      }
    }

    // -------------------------------------------------------------
    // Provider 5: Webhook Dispatcher (Zapier, Make, n8n, etc.)
    // -------------------------------------------------------------
    const webhookEndpoint = activeEmailConfig.webhookUrl || process.env.EMAIL_WEBHOOK_URL;
    if (webhookEndpoint) {
      try {
        await fetch(webhookEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "form.response.submitted",
            submissionId,
            formTitle,
            respondentName: recipientName,
            respondentEmail: respondentEmail || null,
            adminEmail: adminForwardEmail,
            subject,
            answers,
            submittedAt: new Date().toISOString()
          })
        });
        if (!isRealDelivery) {
          isRealDelivery = true;
          providerUsed = "webhook";
          console.log(`[AutoReply 24/7] Webhook disparado com sucesso para ${webhookEndpoint}`);
        }
      } catch (webhookErr: any) {
        console.warn("[AutoReply 24/7] Erro no envio para webhook:", webhookErr?.message || webhookErr);
      }
    }

    // -------------------------------------------------------------
    // Provider 6: Gmail OAuth API (Hugo's Connected Browser Account - Fallback)
    // -------------------------------------------------------------
    if (!isRealDelivery && activeGmailOAuthSession?.token) {
      try {
        const gmailToken = activeGmailOAuthSession.token;
        const sender = `"${config.senderName || activeEmailConfig.senderName || "Hugo Gomes Pinheiro"}" <${activeGmailOAuthSession.email || DEFAULT_ADMIN_EMAIL}>`;

        if (sendToRespondent && respondentEmail) {
          const raw = encodeRfc2822(sender, respondentEmail, subject, htmlBody);
          const gRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${gmailToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ raw })
          });
          if (gRes.ok) {
            const data: any = await gRes.json();
            if (data.id) messageId = data.id;
            isRealDelivery = true;
            providerUsed = "gmail_oauth_real";
            console.log(`[GmailOAuth] E-mail de confirmação enviado via Gmail API para ${respondentEmail}`);
          }
        }

        if (sendToAdmin && adminForwardEmail) {
          const rawAdm = encodeRfc2822(sender, adminForwardEmail, `[Novo Envio] ${formTitle} - ${recipientName}`, adminNoticeHtml);
          const gResAdm = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${gmailToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ raw: rawAdm })
          });
          if (gResAdm.ok) {
            isRealDelivery = true;
            providerUsed = "gmail_oauth_real";
            console.log(`[GmailOAuth] Cópia encaminhada via Gmail API para administrador ${adminForwardEmail}`);
          }
        }
      } catch (gmailOAuthErr: any) {
        console.warn("[GmailOAuth] Erro de conexão com Gmail API:", gmailOAuthErr?.message || gmailOAuthErr);
      }
    }

    if (!isRealDelivery) {
      console.log(`[AutoReply] Disparo automático simulado para respondente: ${respondentEmail || "nenhum"} e cópia encaminhada para administrador: ${adminForwardEmail} | Assunto: ${subject} | Protocolo: ${submissionId}`);
    }

    const resultRecord: AutoReplyResult = {
      sent: true,
      recipientEmail: respondentEmail || undefined,
      recipientName,
      adminForwardEmail,
      adminForwardSent: sendToAdmin,
      subject,
      sentAt: new Date().toISOString(),
      status: isRealDelivery ? "sent" : "simulated",
      previewText: textBody.substring(0, 200),
      htmlBody
    };

    // Store in memory history (last 50 dispatches)
    recordDispatchHistory({
      submissionId,
      formTitle,
      respondentEmail: respondentEmail || null,
      adminEmail: adminForwardEmail,
      provider: providerUsed,
      status: resultRecord.status || "simulated",
      timestamp: resultRecord.sentAt || new Date().toISOString(),
      subject
    });

    return resultRecord;
  } catch (err: any) {
    console.error("[AutoReply] Erro ao processar resposta automática:", err);
    return {
      sent: false,
      error: err.message || "Erro ao processar e-mail de resposta automática."
    };
  }
}

// In-memory record of recent email dispatches
const recentEmailDispatches: Array<{
  id: string;
  submissionId: string;
  formTitle: string;
  respondentEmail: string | null;
  adminEmail: string;
  provider: string;
  status: "sent" | "simulated" | "failed";
  timestamp: string;
  subject: string;
}> = [];

function recordDispatchHistory(entry: Omit<typeof recentEmailDispatches[0], "id">) {
  const item = {
    id: `disp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ...entry
  };
  recentEmailDispatches.unshift(item);
  if (recentEmailDispatches.length > 50) {
    recentEmailDispatches.pop();
  }
}

// Shared core handler to record any form submission reliably
// Ordem: 1) salva na planilha  2) dispara e-mails  3) atualiza o status do e-mail.
// Assim a resposta do cliente nunca se perde, mesmo se o e-mail falhar.
async function recordFormSubmission(
  form: any,
  payload: {
    answers: Record<string, any>;
    respondentName?: string;
    respondentEmail?: string;
    tagId?: string;
  }
) {
  const { answers, respondentName, respondentEmail, tagId } = payload;

  let detectedName = respondentName;
  let detectedEmail = respondentEmail;

  if (!detectedName || !detectedEmail) {
    for (const section of form.sections || []) {
      for (const field of section.fields || []) {
        const val = answers[field.id];
        if (typeof val === "string" && val.trim()) {
          const l = String(field.label || "").toLowerCase();
          if (!detectedEmail && (field.type === "email" || l.includes("email") || l.includes("e-mail"))) {
            detectedEmail = val.trim();
          } else if (
            !detectedName &&
            field.type === "text" &&
            (l.includes("nome") || l.includes("empresa") || l.includes("marca") || l.includes("responsável"))
          ) {
            detectedName = val.trim();
          }
        }
      }
    }
  }

  const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const tagName: string | undefined = tagId
    ? (form.taggedLinks || []).find((t: any) => t.id === tagId)?.name
    : undefined;

  const submission: any = {
    id: submissionId,
    formId: form.id,
    formTitle: form.title,
    submittedAt: new Date().toISOString(),
    answers,
    respondentName: detectedName || "Respondente Anônimo",
    respondentEmail: detectedEmail || null,
    autoReply: null,
    tagId: tagId || null,
    tagName: tagName || null
  };

  // 1) salva primeiro
  await getStore().addSubmission(form, submission);

  // 2) e-mails (respondente + você)
  let autoReplyResult: AutoReplyResult = { sent: false };
  try {
    autoReplyResult = await sendAutoReplyConfirmation(
      form,
      submissionId,
      detectedEmail || "",
      detectedName || "Respondente",
      answers,
      activeEmailConfig.adminEmail || DEFAULT_ADMIN_EMAIL,
      { sendToRespondent: Boolean(detectedEmail), sendToAdmin: true }
    );
  } catch (err) {
    console.error("[Submission] Falha ao disparar e-mails (resposta já salva):", err);
  }

  // 3) registra o status do e-mail na planilha
  if (autoReplyResult.sent) {
    submission.autoReply = {
      sentAt: autoReplyResult.sentAt || new Date().toISOString(),
      recipientEmail: autoReplyResult.recipientEmail || detectedEmail || null,
      recipientName: autoReplyResult.recipientName || detectedName,
      adminForwardEmail: autoReplyResult.adminForwardEmail || DEFAULT_ADMIN_EMAIL,
      adminForwardSent: autoReplyResult.adminForwardSent ?? true,
      subject: autoReplyResult.subject,
      bodyText: autoReplyResult.previewText,
      status: autoReplyResult.status || "sent"
    };
    try {
      await getStore().updateSubmission(form, submission);
    } catch (err) {
      console.warn("[Submission] Resposta salva, mas não consegui atualizar o status do e-mail:", err);
    }
  }

  return {
    success: true,
    submissionId: submission.id,
    submission,
    message: "Respostas registradas com sucesso e persistidas!",
    autoReplySent: Boolean(submission.autoReply && submission.autoReply.recipientEmail),
    autoReplyTo: detectedEmail || null,
    adminForwardEmail: submission.autoReply?.adminForwardEmail || DEFAULT_ADMIN_EMAIL,
    adminForwardSent: autoReplyResult.adminForwardSent ?? false,
    autoReplySubject: submission.autoReply?.subject || null,
    tagId: tagId || null,
    tagName: tagName || null
  };
}

// Global endpoint: Get all responses across all forms (with form metadata)
app.get("/api/responses", async (_req, res) => {
  try {
    const [forms, submissions] = await Promise.all([getStore().listForms(), getStore().listSubmissions()]);
    const titles: Record<string, string> = {};
    for (const f of forms) titles[f.form.id] = f.form.title;
    const allList: any[] = submissions.map((s: any) => ({
      ...s,
      formTitle: titles[s.formId] || s.formTitle || "Formulário Desconhecido"
    }));

    // Sort descending by submittedAt
    allList.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    res.json({
      success: true,
      total: allList.length,
      responses: allList
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Erro ao carregar todas as respostas." });
  }
});

// General POST endpoint for external integrations, webhooks, or public submissions
app.post("/api/responses", async (req, res) => {
  try {
    const { formId, answers, respondentName, respondentEmail, tagId } = req.body;
    const targetFormId = formId || (await getStore().listForms())[0]?.form.id;
    const form = targetFormId ? (await getStore().getForm(targetFormId))?.form : null;
    if (!form) {
      res.status(404).json({ error: `Formulário '${targetFormId}' não encontrado.` });
      return;
    }

    if (!answers || typeof answers !== "object") {
      res.status(400).json({ error: "Respostas são obrigatórias e devem ser um objeto." });
      return;
    }

    const result = await recordFormSubmission(form, { answers, respondentName, respondentEmail, tagId });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Erro ao registrar respostas." });
  }
});

// Submit responses to a specific form (Public endpoint)
app.post("/api/forms/:id/responses", async (req, res) => {
  try {
    const formId = req.params.id;
    const form = (await getStore().getForm(formId))?.form;
    if (!form) {
      res.status(404).json({ error: "Formulário não encontrado ou inativo." });
      return;
    }

    const { answers, respondentName, respondentEmail, tagId } = req.body;
    if (!answers || typeof answers !== "object") {
      res.status(400).json({ error: "Respostas são obrigatórias." });
      return;
    }

    const result = await recordFormSubmission(form, { answers, respondentName, respondentEmail, tagId });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Erro ao registrar respostas." });
  }
});

// ---------------------------------------------------------------------------
// Dedicated Email Integration Endpoints & Background Response Detector
// ---------------------------------------------------------------------------

// Trigger dual email notification for a detected submission
app.post("/api/email/notify-submission", async (req, res) => {
  try {
    const {
      formId,
      submissionId,
      respondentEmail,
      respondentName,
      answers,
      adminEmail = DEFAULT_ADMIN_EMAIL
    } = req.body;

    let targetForm: any = formId ? (await getStore().getForm(formId))?.form || null : null;
    let targetSubmission: any = null;

    if (submissionId) {
      const all = await getStore().listSubmissions(formId || undefined);
      targetSubmission = all.find((s: any) => s.id === submissionId) || null;
      if (targetSubmission && !targetForm) {
        targetForm = (await getStore().getForm(targetSubmission.formId))?.form || null;
      }
    }

    if (!targetForm) {
      targetForm = {
        id: formId || "form_generic",
        title: "Novo Preenchimento de Formulário",
        sections: []
      };
    }

    const emailToUse = (respondentEmail || targetSubmission?.respondentEmail || "").trim();
    const nameToUse = (respondentName || targetSubmission?.respondentName || "Respondente").trim();
    const answersToUse = answers || targetSubmission?.answers || {};
    const subId = submissionId || targetSubmission?.id || `sub_${Date.now()}`;

    const dispatchResult = await sendAutoReplyConfirmation(
      targetForm,
      subId,
      emailToUse,
      nameToUse,
      answersToUse,
      adminEmail,
      { sendToRespondent: Boolean(emailToUse), sendToAdmin: true }
    );

    if (targetSubmission) {
      targetSubmission.autoReply = {
        sentAt: new Date().toISOString(),
        recipientEmail: emailToUse || null,
        recipientName: nameToUse,
        adminForwardEmail: adminEmail,
        adminForwardSent: true,
        subject: dispatchResult.subject,
        status: dispatchResult.status,
        bodyText: dispatchResult.previewText
      };
      if (targetForm?.sections?.length) await getStore().updateSubmission(targetForm, targetSubmission);
    }

    res.json({
      success: true,
      message: `E-mails disparados com sucesso para ${emailToUse ? emailToUse + " e " : ""}${adminEmail}!`,
      respondentEmail: emailToUse,
      adminEmail,
      dispatchResult
    });
  } catch (err: any) {
    console.error("[EmailNotification] Erro ao disparar notificação:", err);
    res.status(500).json({ success: false, error: err.message || "Erro no envio de e-mails." });
  }
});

// Endpoint: Obter configurações persistentes de e-mail do servidor
app.get("/api/email/config", (_req, res) => {
  const autoInfo = isAutonomousEmailConfigured();
  res.json({
    success: true,
    config: {
      mode: activeEmailConfig.mode || "gmail_app_password",
      gmailUser: activeEmailConfig.gmailUser || DEFAULT_ADMIN_EMAIL,
      hasGmailAppPassword: Boolean(activeEmailConfig.gmailAppPassword?.trim() || process.env.GMAIL_APP_PASSWORD),
      resendFrom: activeEmailConfig.resendFrom || "Formulários <onboarding@resend.dev>",
      hasResendApiKey: Boolean(activeEmailConfig.resendApiKey?.trim() || process.env.RESEND_API_KEY),
      brevoSender: activeEmailConfig.brevoSender || DEFAULT_ADMIN_EMAIL,
      hasBrevoApiKey: Boolean(activeEmailConfig.brevoApiKey?.trim() || process.env.BREVO_API_KEY),
      smtpHost: activeEmailConfig.smtpHost || "",
      smtpPort: activeEmailConfig.smtpPort || 587,
      smtpUser: activeEmailConfig.smtpUser || "",
      hasSmtpPass: Boolean(activeEmailConfig.smtpPass?.trim() || process.env.SMTP_PASS),
      smtpSecure: activeEmailConfig.smtpSecure ?? false,
      smtpFrom: activeEmailConfig.smtpFrom || DEFAULT_ADMIN_EMAIL,
      webhookUrl: activeEmailConfig.webhookUrl || "",
      adminEmail: activeEmailConfig.adminEmail || DEFAULT_ADMIN_EMAIL,
      senderName: activeEmailConfig.senderName || "Hugo Gomes Pinheiro",
      autoSendRespondent: activeEmailConfig.autoSendRespondent !== false,
      autoSendAdmin: activeEmailConfig.autoSendAdmin !== false,
      isServerAutonomous: autoInfo.autonomous,
      activeProviderName: autoInfo.details,
      lastTestedAt: activeEmailConfig.lastTestedAt || null,
      lastTestStatus: activeEmailConfig.lastTestStatus || null,
      lastTestMessage: activeEmailConfig.lastTestMessage || null
    }
  });
});

// Endpoint: Salvar configurações de envio autônomo (Offline 24/7)
app.post("/api/email/config", async (req, res) => {
  try {
    const body = req.body || {};

    activeEmailConfig = {
      ...activeEmailConfig,
      mode: body.mode || activeEmailConfig.mode || "gmail_app_password",
      gmailUser: (body.gmailUser !== undefined ? String(body.gmailUser).trim() : activeEmailConfig.gmailUser) || DEFAULT_ADMIN_EMAIL,
      gmailAppPassword: body.gmailAppPassword !== undefined && body.gmailAppPassword !== ""
        ? String(body.gmailAppPassword).trim()
        : (body.keepGmailAppPassword !== false ? activeEmailConfig.gmailAppPassword : ""),
      resendApiKey: body.resendApiKey !== undefined && body.resendApiKey !== ""
        ? String(body.resendApiKey).trim()
        : (body.keepResendApiKey !== false ? activeEmailConfig.resendApiKey : ""),
      resendFrom: body.resendFrom || activeEmailConfig.resendFrom,
      brevoApiKey: body.brevoApiKey !== undefined && body.brevoApiKey !== ""
        ? String(body.brevoApiKey).trim()
        : (body.keepBrevoApiKey !== false ? activeEmailConfig.brevoApiKey : ""),
      brevoSender: body.brevoSender || activeEmailConfig.brevoSender,
      smtpHost: body.smtpHost !== undefined ? String(body.smtpHost).trim() : activeEmailConfig.smtpHost,
      smtpPort: body.smtpPort ? Number(body.smtpPort) : activeEmailConfig.smtpPort,
      smtpUser: body.smtpUser !== undefined ? String(body.smtpUser).trim() : activeEmailConfig.smtpUser,
      smtpPass: body.smtpPass !== undefined && body.smtpPass !== ""
        ? String(body.smtpPass).trim()
        : (body.keepSmtpPass !== false ? activeEmailConfig.smtpPass : ""),
      smtpSecure: body.smtpSecure !== undefined ? Boolean(body.smtpSecure) : activeEmailConfig.smtpSecure,
      smtpFrom: body.smtpFrom || activeEmailConfig.smtpFrom,
      webhookUrl: body.webhookUrl !== undefined ? String(body.webhookUrl).trim() : activeEmailConfig.webhookUrl,
      adminEmail: body.adminEmail ? String(body.adminEmail).trim() : activeEmailConfig.adminEmail || DEFAULT_ADMIN_EMAIL,
      senderName: body.senderName ? String(body.senderName).trim() : activeEmailConfig.senderName || "Hugo Gomes Pinheiro",
      autoSendRespondent: body.autoSendRespondent !== undefined ? Boolean(body.autoSendRespondent) : true,
      autoSendAdmin: body.autoSendAdmin !== undefined ? Boolean(body.autoSendAdmin) : true
    };

    await saveEmailConfig(activeEmailConfig);
    const autoInfo = isAutonomousEmailConfigured();

    res.json({
      success: true,
      message: "Configuração de e-mail 24/7 salva com sucesso no servidor!",
      isServerAutonomous: autoInfo.autonomous,
      activeProviderName: autoInfo.details
    });
  } catch (err: any) {
    console.error("[EmailConfig] Erro ao salvar configurações:", err);
    res.status(500).json({ success: false, error: err.message || "Erro ao salvar configurações de e-mail." });
  }
});

// Test email transport directly to admin (hugoviajante@gmail.com)
app.post("/api/email/test", async (req, res) => {
  try {
    const targetEmail = (req.body.targetEmail || activeEmailConfig.adminEmail || DEFAULT_ADMIN_EMAIL).trim();
    const autoInfo = isAutonomousEmailConfigured();

    const mockForm = {
      id: "form_test_verification",
      title: "Verificação de Envio Autônomo 24/7",
      sections: [
        {
          id: "sec_test",
          title: "Diagnóstico de Infraestrutura",
          fields: [
            { id: "fld_status", label: "Status da Conexão", type: "text" },
            { id: "fld_destino", label: "Destinatário Principal", type: "text" },
            { id: "fld_provedor", label: "Provedor Ativo", type: "text" },
            { id: "fld_horario", label: "Horário do Disparo", type: "text" }
          ]
        }
      ]
    };

    const testAnswers = {
      fld_status: autoInfo.autonomous ? "Autônomo (Offline Ready 24/7)" : "Aguardando Configuração de Senha de App",
      fld_destino: targetEmail,
      fld_provedor: autoInfo.details,
      fld_horario: new Date().toLocaleString("pt-BR")
    };

    const testSubId = `test_${Date.now()}`;
    const result = await sendAutoReplyConfirmation(
      mockForm,
      testSubId,
      targetEmail,
      "Hugo Gomes Pinheiro (Admin)",
      testAnswers,
      DEFAULT_ADMIN_EMAIL,
      { sendToRespondent: true, sendToAdmin: targetEmail !== DEFAULT_ADMIN_EMAIL }
    );

    // Save test result in config
    activeEmailConfig.lastTestedAt = new Date().toISOString();
    activeEmailConfig.lastTestStatus = result.status === "sent" ? "success" : "error";
    activeEmailConfig.lastTestMessage = result.status === "sent"
      ? `E-mail entregue com sucesso via ${autoInfo.details}`
      : "Disparo processado em modo simulado (servidor aguarda credencial real 24/7).";
    await saveEmailConfig(activeEmailConfig);

    res.json({
      success: true,
      message: result.status === "sent"
        ? `E-mail de teste entregue com sucesso para ${targetEmail}!`
        : `Disparo registrado para ${targetEmail}. Para entrega real 24/7 sem navegador aberto, configure a Senha de Aplicativo do Gmail.`,
      targetEmail,
      status: result.status,
      isServerAutonomous: autoInfo.autonomous,
      providerDetails: autoInfo.details,
      subject: result.subject,
      previewText: result.previewText,
      sentAt: result.sentAt
    });
  } catch (err: any) {
    console.error("[EmailTest] Erro ao disparar e-mail de teste:", err);
    activeEmailConfig.lastTestedAt = new Date().toISOString();
    activeEmailConfig.lastTestStatus = "error";
    activeEmailConfig.lastTestMessage = err.message || "Erro desconhecido ao testar conexão.";
    await saveEmailConfig(activeEmailConfig);

    res.status(500).json({ success: false, error: err.message || "Falha ao enviar e-mail de teste." });
  }
});

// Sync active Gmail OAuth token from frontend session
app.post("/api/gmail/active-token", async (req, res) => {
  const { token, email } = req.body;
  if (!token) {
    res.status(400).json({ error: "Token é obrigatório." });
    return;
  }
  activeGmailOAuthSession = {
    token,
    email: email || DEFAULT_ADMIN_EMAIL,
    updatedAt: new Date().toISOString()
  };
  await saveGmailSession(activeGmailOAuthSession);
  console.log(`[GmailOAuth] Sessão ativa registrada para ${activeGmailOAuthSession.email}`);
  res.json({ success: true, email: activeGmailOAuthSession.email });
});

app.get("/api/gmail/active-token", (_req, res) => {
  res.json({
    connected: !!activeGmailOAuthSession?.token,
    email: activeGmailOAuthSession?.email || null,
    updatedAt: activeGmailOAuthSession?.updatedAt || null
  });
});

app.delete("/api/gmail/active-token", async (_req, res) => {
  activeGmailOAuthSession = null;
  await saveGmailSession(null);
  res.json({ success: true, message: "Sessão do Gmail desconectada." });
});

// Proxy route to send email via Gmail API
app.post("/api/gmail/send", async (req, res) => {
  try {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "") || activeGmailOAuthSession?.token;
    if (!bearer) {
      res.status(401).json({ error: "Não autenticado com Google (Gmail)." });
      return;
    }

    const { to, subject, html, text } = req.body;
    if (!to || !subject) {
      res.status(400).json({ error: "Destinatário ('to') e assunto ('subject') são obrigatórios." });
      return;
    }

    const sender = `"${req.body.senderName || "Hugo Gomes Pinheiro"}" <${activeGmailOAuthSession?.email || DEFAULT_ADMIN_EMAIL}>`;
    const raw = encodeRfc2822(sender, to, subject, html || text || "");

    const gRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ raw })
    });

    if (!gRes.ok) {
      const err = await gRes.json().catch(() => ({}));
      res.status(gRes.status).json({ error: err.error?.message || "Erro no envio via Gmail API." });
      return;
    }

    const gData = await gRes.json();
    res.json({ success: true, id: gData.id, to, subject });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Erro interno ao enviar via Gmail." });
  }
});

// Get status and history of the email service
app.get("/api/email/status", (_req, res) => {
  const autoInfo = isAutonomousEmailConfigured();
  let activeProvider = "simulated";
  let isRealConfigured = false;

  if (autoInfo.autonomous) {
    activeProvider = autoInfo.provider;
    isRealConfigured = true;
  } else if (activeGmailOAuthSession?.token) {
    activeProvider = "gmail_oauth_real";
    isRealConfigured = true;
  }

  res.json({
    success: true,
    activeProvider,
    isRealConfigured,
    isServerAutonomous: autoInfo.autonomous,
    providerDetails: autoInfo.details,
    adminEmail: activeEmailConfig.adminEmail || DEFAULT_ADMIN_EMAIL,
    senderName: activeEmailConfig.senderName,
    gmailConnected: !!activeGmailOAuthSession?.token,
    gmailAccount: activeGmailOAuthSession?.email || activeEmailConfig.gmailUser || null,
    recentDispatches: recentEmailDispatches.slice(0, 15),
    totalRecordedDispatches: recentEmailDispatches.length
  });
});

// (O antigo "vigia" que rodava a cada 10s foi removido: na Vercel não existe
// processo rodando o tempo todo. Agora a resposta é salva primeiro e o e-mail
// é disparado na mesma requisição; se falhar, fica "Pendente" na planilha e
// dá pra reenviar pelo painel de respostas.)

// Re-send / test auto-reply for any existing submission
app.post("/api/forms/:id/responses/:responseId/resend-email", async (req, res) => {
  try {
    const { id: formId, responseId } = req.params;
    const form = (await getStore().getForm(formId))?.form;
    if (!form) {
      res.status(404).json({ error: "Formulário não encontrado." });
      return;
    }

    const submissions = await getStore().listSubmissions(formId);
    const submission = submissions.find((s: any) => s.id === responseId);
    if (!submission) {
      res.status(404).json({ error: "Resposta não encontrada." });
      return;
    }

    const targetEmail = req.body.email || submission.respondentEmail;
    if (!targetEmail) {
      res.status(400).json({ error: "Nenhum e-mail de destinatário informado ou identificado." });
      return;
    }

    const result = await sendAutoReplyConfirmation(
      form,
      submission.id,
      targetEmail,
      submission.respondentName || "Respondente",
      submission.answers
    );

    if (result.sent) {
      submission.autoReply = {
        sentAt: result.sentAt || new Date().toISOString(),
        recipientEmail: targetEmail,
        recipientName: submission.respondentName,
        subject: result.subject || "Confirmação de recebimento",
        bodyText: result.previewText || "",
        status: result.status || "sent"
      };
      await getStore().updateSubmission(form, submission);

      res.json({
        success: true,
        message: `E-mail de confirmação enviado para ${targetEmail}!`,
        autoReply: submission.autoReply
      });
    } else {
      res.status(500).json({ error: result.error || "Falha ao enviar e-mail." });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Erro ao reenviar e-mail." });
  }
});

// Dual email dispatch endpoint (called by the post-submission popup)
app.post("/api/forms/:id/responses/:submissionId/dispatch-emails", async (req, res) => {
  try {
    const { id: formId, submissionId } = req.params;
    const {
      respondentEmail,
      adminEmail = DEFAULT_ADMIN_EMAIL,
      sendToRespondent = true,
      sendToAdmin = true,
      customNote
    } = req.body;

    const form = (await getStore().getForm(formId))?.form;
    if (!form) {
      res.status(404).json({ success: false, error: "Formulário não encontrado." });
      return;
    }

    const submissions = await getStore().listSubmissions(formId);
    const submission = submissions.find((s: any) => s.id === submissionId);
    if (!submission) {
      res.status(404).json({ success: false, error: "Submissão de resposta não encontrada." });
      return;
    }

    const targetRespondent = (respondentEmail || submission.respondentEmail || "").trim();
    const targetAdmin = (adminEmail || DEFAULT_ADMIN_EMAIL).trim();

    const dispatchResult = await sendAutoReplyConfirmation(
      form,
      submission.id,
      targetRespondent,
      submission.respondentName || "Respondente",
      submission.answers,
      targetAdmin,
      {
        sendToRespondent: Boolean(sendToRespondent && targetRespondent),
        sendToAdmin: Boolean(sendToAdmin && targetAdmin)
      }
    );

    if (targetRespondent) {
      submission.respondentEmail = targetRespondent;
    }

    submission.autoReply = {
      sentAt: new Date().toISOString(),
      recipientEmail: targetRespondent || null,
      recipientName: submission.respondentName,
      adminForwardEmail: targetAdmin,
      adminForwardSent: Boolean(sendToAdmin && targetAdmin),
      subject: dispatchResult.subject,
      status: dispatchResult.status,
      bodyText: dispatchResult.previewText
    };
    await getStore().updateSubmission(form, submission);

    res.json({
      success: true,
      message: "Disparo de e-mails processado com sucesso!",
      respondentEmail: targetRespondent,
      respondentSent: Boolean(sendToRespondent && targetRespondent),
      adminEmail: targetAdmin,
      adminSent: Boolean(sendToAdmin && targetAdmin),
      dispatchResult
    });
  } catch (err: any) {
    console.error("[DispatchEmails] Erro ao despachar e-mails:", err);
    res.status(500).json({ success: false, error: err.message || "Erro no envio de e-mails." });
  }
});

// Get all responses for a specific form
app.get("/api/forms/:id/responses", async (req, res) => {
  try {
    const formId = req.params.id;
    const stats = await getStore().getForm(formId);
    if (!stats) {
      res.status(404).json({ error: "Formulário não encontrado." });
      return;
    }
    const submissions = await getStore().listSubmissions(formId);
    res.json({
      success: true,
      formTitle: stats.form.title,
      totalResponses: submissions.length,
      responses: submissions
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Erro ao carregar respostas." });
  }
});

// Delete a single response
app.delete("/api/forms/:id/responses/:responseId", async (req, res) => {
  try {
    const { id: formId, responseId } = req.params;
    const removed = await getStore().deleteSubmission(formId, responseId);
    if (!removed) {
      res.status(404).json({ error: "Resposta não encontrada." });
      return;
    }
    res.json({ success: true, message: "Resposta removida." });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Erro ao remover resposta." });
  }
});

// ---------------------------------------------------------------------------
// AI Form Generation (Text Prompt OR Document Upload - PDF, TXT, DOCX, Image)
// ---------------------------------------------------------------------------
app.post("/api/generate-form", async (req, res) => {
  const { prompt = "", fileData, mimeType, fileName, language = "pt-BR" } = req.body;

  if ((!prompt || !prompt.trim()) && !fileData) {
    res.status(400).json({
      error: "Por favor, forneça instruções por texto ou envie um documento para criar o formulário."
    });
    return;
  }

  // Try Gemini AI first
  try {
    const ai = getGeminiClient();

    const systemInstruction = `Você é um especialista sênior em design de formulários de alta conversão, pesquisas de diagnóstico empresarial, briefing, onboarding e coleta de dados estratégicos.
Seu objetivo é analisar as instruções fornecidas e/ou o documento anexado (PDF, texto ou imagem) e criar a estrutura completa de um formulário inteligente, pronto para uso e preenchimento online.

Diretrizes obrigatórias:
1. Extraia o contexto do documento ou instrução e organize em blocos lógicos estruturados (ex: '01. Contexto essencial', '02. O negócio na visão da equipe', etc.).
2. Para cada pergunta, determine o tipo de campo correto:
   - 'text': resposta curta (nomes, cargos, sites, cidades, CNPJ).
   - 'textarea': parágrafo (explicações, descrição de problemas, percepções, objetivos).
   - 'radio': múltipla escolha com seleção única.
   - 'checkbox': caixas de seleção com múltiplas opções possíveis.
   - 'select': lista suspensa.
   - 'email': e-mail de contato.
   - 'phone': telefone ou WhatsApp.
   - 'number': valores numéricos ou quantidades.
   - 'date': datas.
   - 'file': solicitação de envio de arquivos ou links (Drive, WeTransfer, etc.).
   - 'scale': escala numérica (ex: 1 a 5 ou 0 a 10 para NPS/CSAT).
   - 'consent': termo de autorização/confidencialidade ("Li e estou de acordo").
3. Para campos de escolha ('radio', 'checkbox', 'select'), forneça SEMPRE uma lista rica e completa de opções relevantes.
4. Inclua instruções de apoio em 'helpText' para orientar o preenchimento ou explicar a indicação técnica da pergunta.
5. Defina 'required' de forma criteriosa: dados essenciais de identificação devem ser obrigatórios, reflexões mais profundas ou dados secundários podem ser opcionais.
6. Crie mensagens de boas-vindas ('openingMessage') e de agradecimento/orientações pós-envio ('closingMessage') humanizadas e elegantes.
7. Idioma de saída: ${language}.
${AI_FORM_CONTEXT ? `\nContexto fixo de quem cria os formulários (siga sempre):\n${AI_FORM_CONTEXT}` : ""}`;

    const contents: any[] = [];

    if (fileData && mimeType) {
      const base64Clean = fileData.replace(/^data:.*?;base64,/, "");
      contents.push({
        inlineData: {
          mimeType: mimeType === "application/pdf" ? "application/pdf" : mimeType,
          data: base64Clean
        }
      });
    }

    const userPromptText = prompt
      ? `Instruções do usuário:\n"""${prompt}"""\n${fileName ? `(Documento anexo: ${fileName})` : ""}`
      : `Analise atentamente o documento anexo "${fileName || "documento"}" e crie o formulário completo e estruturado baseado em todas as perguntas, seções e diretrizes presentes nele.`;

    contents.push(userPromptText);

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: formSchema,
        temperature: 0.2,
      },
    });

    const outputText = response.text;
    if (outputText) {
      const formData = JSON.parse(outputText);
      const formId = `form_${Date.now()}`;
      const now = new Date().toISOString();

      const finalizedForm = {
        ...formData,
        id: formId,
        createdAt: now,
        updatedAt: now,
        sections: (formData.sections || []).map((sec: any, sIdx: number) => ({
          ...sec,
          id: sec.id || `sec_${sIdx + 1}`,
          fields: (sec.fields || []).map((field: any, fIdx: number) => ({
            ...field,
            id: field.id || `f_${sIdx + 1}_${fIdx + 1}`
          }))
        }))
      };

      await getStore().saveForm(finalizedForm);

      res.json({ success: true, form: finalizedForm, generatedBy: "gemini" });
      return;
    }
  } catch (error: any) {
    console.warn("Aviso: Gemini API indisponível ou com erro, usando gerador contextual inteligente:", error?.message);
  }

  // Smart Contextual Fallback Generator (guarantees form creation succeeds seamlessly)
  try {
    const rawText = (prompt || fileName || "Formulário Personalizado").trim();
    const cleanTitle = rawText.split("\n")[0].replace(/[#*"-]/g, "").trim().slice(0, 60) || "Formulário Personalizado";
    const lower = rawText.toLowerCase();

    const formId = `form_${Date.now()}`;
    const now = new Date().toISOString();

    let fallbackForm: any;

    if (lower.includes("satisfação") || lower.includes("nps") || lower.includes("feedback") || lower.includes("avaliação")) {
      fallbackForm = {
        id: formId,
        title: "Pesquisa de Satisfação e Avaliação de Experiência",
        subtitle: "Avaliação do nível de serviço, qualidade do atendimento e percepção geral.",
        estimatedTime: "3 a 5 minutos",
        openingMessage: "Sua opinião sincera é muito importante para aperfeiçoarmos nossos processos e atendimento.",
        closingMessage: "Agradecemos pelo seu tempo! Suas respostas foram computadas e serão analisadas com carinho.",
        internalGuidelines: ["Acompanhar notas abaixo de 7 em até 24 horas", "Consolidar médias no relatório mensal"],
        createdAt: now,
        updatedAt: now,
        sections: [
          {
            id: "sec_1",
            title: "01. Dados de Identificação",
            description: "Informações básicas sobre o respondente.",
            fields: [
              { id: "f_1_1", label: "Nome Completo", type: "text", required: true, placeholder: "Seu nome ou empresa" },
              { id: "f_1_2", label: "E-mail de Contato", type: "email", required: true, placeholder: "email@exemplo.com" },
              { id: "f_1_3", label: "Telefone / WhatsApp", type: "phone", required: false, placeholder: "(00) 00000-0000" }
            ]
          },
          {
            id: "sec_2",
            title: "02. Avaliação de Qualidade e NPS",
            description: "Métricas de satisfação e recomendação.",
            fields: [
              {
                id: "f_2_1",
                label: "Em uma escala de 0 a 10, qual a probabilidade de você recomendar nossos serviços a um colega?",
                type: "scale",
                required: true,
                scaleMin: 0,
                scaleMax: 10,
                minLabel: "Pouco provável",
                maxLabel: "Muito provável",
                helpText: "0 a 6: Detratores | 7 a 8: Neutros | 9 a 10: Promotores"
              },
              {
                id: "f_2_2",
                label: "Como você avalia a agilidade e a cordialidade no atendimento?",
                type: "radio",
                required: true,
                options: ["Excelente", "Muito Bom", "Regular", "Insatisfatório"]
              },
              {
                id: "f_2_3",
                label: "Quais aspectos mais se destacaram positivamente?",
                type: "checkbox",
                required: false,
                options: ["Rapidez na entrega", "Clareza das informações", "Suporte técnico", "Relação custo-benefício", "Facilidade de contato"]
              }
            ]
          },
          {
            id: "sec_3",
            title: "03. Comentários e Sugestões",
            description: "Espaço aberto para observações e melhorias.",
            fields: [
              { id: "f_3_1", label: "O que podemos fazer para aprimorar ainda mais sua experiência?", type: "textarea", required: false, placeholder: "Deixe aqui suas sugestões, críticas ou elogios..." },
              { id: "f_3_2", label: "Autorizo o uso anônimo desta avaliação para fins de melhoria contínua.", type: "consent", required: true, options: ["Estou de acordo."] }
            ]
          }
        ]
      };
    } else if (lower.includes("onboarding") || lower.includes("cliente") || lower.includes("b2b") || lower.includes("cadastro")) {
      fallbackForm = {
        id: formId,
        title: "Ficha de Onboarding e Alinhamento Inicial",
        subtitle: "Mapeamento dos dados essenciais para o início das operações e projetos.",
        estimatedTime: "7 a 10 minutos",
        openingMessage: "Seja muito bem-vindo! Preencha este formulário para que possamos iniciar o projeto com alinhamento total.",
        closingMessage: "Dados recebidos com sucesso! Nossa equipe técnica entrará em contato para os próximos passos.",
        internalGuidelines: ["Verificar CNPJ e dados de contato", "Agendar reunião de kick-off em até 48h"],
        createdAt: now,
        updatedAt: now,
        sections: [
          {
            id: "sec_1",
            title: "01. Informações Cadastrais da Empresa",
            description: "Dados formais e pontos focais de contato.",
            fields: [
              { id: "f_1_1", label: "Razão Social / Nome da Marca", type: "text", required: true, placeholder: "Ex: Nexus Soluções Digitais" },
              { id: "f_1_2", label: "CNPJ", type: "text", required: true, placeholder: "00.000.000/0001-00" },
              { id: "f_1_3", label: "Nome do Responsável Principal", type: "text", required: true, placeholder: "Nome e sobrenome" },
              { id: "f_1_4", label: "E-mail do Responsável", type: "email", required: true, placeholder: "responsavel@empresa.com" },
              { id: "f_1_5", label: "WhatsApp Corporativo", type: "phone", required: true, placeholder: "(11) 99999-9999" }
            ]
          },
          {
            id: "sec_2",
            title: "02. Escopo e Expectativas do Projeto",
            description: "Objetivos estratégicos e prazos prioritários.",
            fields: [
              { id: "f_2_1", label: "Qual é a principal prioridade ou entrega esperada para os primeiros 60 dias?", type: "textarea", required: true, placeholder: "Descreva o resultado chave que considera indispensável..." },
              { id: "f_2_2", label: "Nível de urgência da implementação:", type: "radio", required: true, options: ["Crítica (início imediato)", "Alta (próximas 2 semanas)", "Média (ao longo do mês)"] },
              { id: "f_2_3", label: "Canais preferenciais para comunicação e alinhamentos:", type: "checkbox", required: true, options: ["WhatsApp", "E-mail", "Google Meet / Zoom", "Slack", "Telefone"] }
            ]
          },
          {
            id: "sec_3",
            title: "03. Documentos e Links de Acesso",
            description: "Materiais de apoio e diretrizes.",
            fields: [
              { id: "f_3_1", label: "Link de pasta na nuvem com arquivos ou briefing (Drive, Dropbox, etc.):", type: "file", required: false, placeholder: "https://drive.google.com/..." },
              { id: "f_3_2", label: "Declaro que as informações fornecidas são autênticas e concordo com os termos de início.", type: "consent", required: true, options: ["Li e estou de acordo."] }
            ]
          }
        ]
      };
    } else if (lower.includes("vaga") || lower.includes("candidat") || lower.includes("emprego") || lower.includes("seletivo") || lower.includes("rh")) {
      fallbackForm = {
        id: formId,
        title: "Inscrição para Processo Seletivo",
        subtitle: "Formulário de candidatura, análise curricular e histórico profissional.",
        estimatedTime: "5 a 8 minutos",
        openingMessage: "Obrigado pelo seu interesse em fazer parte do nosso time! Por favor, responda com atenção às perguntas a seguir.",
        closingMessage: "Candidatura registrada com sucesso! Caso seu perfil seja selecionado, entraremos em contato para as entrevistas.",
        internalGuidelines: ["Triagem pelo RH em até 5 dias úteis", "Verificar pretensão e disponibilidade"],
        createdAt: now,
        updatedAt: now,
        sections: [
          {
            id: "sec_1",
            title: "01. Dados Pessoais e Contato",
            description: "Identificação do candidato.",
            fields: [
              { id: "f_1_1", label: "Nome Completo", type: "text", required: true, placeholder: "Seu nome completo" },
              { id: "f_1_2", label: "E-mail Principal", type: "email", required: true, placeholder: "candidato@email.com" },
              { id: "f_1_3", label: "Telefone / WhatsApp", type: "phone", required: true, placeholder: "(11) 99999-9999" },
              { id: "f_1_4", label: "Cidade e Estado de Residência", type: "text", required: true, placeholder: "Ex: São Paulo, SP" }
            ]
          },
          {
            id: "sec_2",
            title: "02. Perfil Profissional e Experiência",
            description: "Trajetória, competências e objetivos de carreira.",
            fields: [
              { id: "f_2_1", label: "Link do Perfil no LinkedIn / Portfólio", type: "text", required: true, placeholder: "https://linkedin.com/in/..." },
              { id: "f_2_2", label: "Link do Currículo (PDF no Google Drive, Dropbox ou site pessoal)", type: "file", required: true, placeholder: "https://drive.google.com/..." },
              { id: "f_2_3", label: "Qual é o seu nível de senioridade na área?", type: "radio", required: true, options: ["Júnior", "Pleno", "Sênior", "Especialista / Liderança"] },
              { id: "f_2_4", label: "Resuma em poucas linhas sua principal conquista profissional recente:", type: "textarea", required: true, placeholder: "Fale sobre um desafio relevante que você superou..." }
            ]
          },
          {
            id: "sec_3",
            title: "03. Condições e Disponibilidade",
            description: "Expectativas contratuais e início.",
            fields: [
              { id: "f_3_1", label: "Pretensão Salarial ou Remuneração PJ (mensal aproximada):", type: "text", required: true, placeholder: "R$ 0.000,00" },
              { id: "f_3_2", label: "Disponibilidade para início:", type: "radio", required: true, options: ["Imediata", "Em 15 dias", "Em 30 dias", "A negociar"] },
              { id: "f_3_3", label: "Autorizo o armazenamento dos meus dados curriculares para este e futuros processos seletivos.", type: "consent", required: true, options: ["Autorizo."] }
            ]
          }
        ]
      };
    } else {
      // General Structured Form based on the user's prompt text
      fallbackForm = {
        id: formId,
        title: cleanTitle.length > 5 ? cleanTitle : "Formulário Estruturado Personalizado",
        subtitle: `Formulário gerado com base nas diretrizes: ${rawText.slice(0, 100)}...`,
        estimatedTime: "5 a 10 minutos",
        openingMessage: "Por favor, preencha todos os campos solicitados com atenção.",
        closingMessage: "Muito obrigado pelas respostas! Suas informações foram computadas com sucesso.",
        internalGuidelines: ["Revisar respostas coletadas no painel do formulário"],
        createdAt: now,
        updatedAt: now,
        sections: [
          {
            id: "sec_1",
            title: "01. Identificação Inicial",
            description: "Dados essenciais para contato e registro.",
            fields: [
              { id: "f_1_1", label: "Nome Completo", type: "text", required: true, placeholder: "Seu nome ou organização" },
              { id: "f_1_2", label: "E-mail Principal", type: "email", required: true, placeholder: "email@exemplo.com" },
              { id: "f_1_3", label: "Telefone ou WhatsApp", type: "phone", required: true, placeholder: "(00) 00000-0000" }
            ]
          },
          {
            id: "sec_2",
            title: "02. Perguntas e Informações Principais",
            description: "Campos específicos solicitados nas suas instruções.",
            fields: [
              { id: "f_2_1", label: `Detalhes sobre: ${cleanTitle}`, type: "textarea", required: true, placeholder: "Descreva com o máximo de detalhes..." },
              { id: "f_2_2", label: "Qual é o principal objetivo ou necessidade?", type: "radio", required: true, options: ["Atendimento prioritário", "Consultoria / Diagnóstico", "Contratação de serviço", "Outro"] },
              { id: "f_2_3", label: "Quais tópicos são relevantes no seu caso?", type: "checkbox", required: false, options: ["Prazo curto", "Alta qualidade", "Custo competitivo", "Suporte continuado"] },
              { id: "f_2_4", label: "Em uma escala de 1 a 5, qual é a urgência desta demanda?", type: "scale", required: true, scaleMin: 1, scaleMax: 5, minLabel: "Baixa", maxLabel: "Urgente" }
            ]
          },
          {
            id: "sec_3",
            title: "03. Observações e Confirmação",
            description: "Comentários finais e autorização.",
            fields: [
              { id: "f_3_1", label: "Alguma informação adicional que deseja incluir?", type: "textarea", required: false, placeholder: "Espaço para observações livres..." },
              { id: "f_3_2", label: "Declaro que as informações preenchidas são verdadeiras e concordo com o envio.", type: "consent", required: true, options: ["Li e concordo."] }
            ]
          }
        ]
      };
    }

    await getStore().saveForm(fallbackForm);

    res.json({ success: true, form: fallbackForm, generatedBy: "smart_fallback" });
  } catch (fallbackError: any) {
    console.error("Erro no fallback:", fallbackError);
    res.status(500).json({ error: "Não foi possível gerar o formulário." });
  }
});

// Refine or add fields to an existing form
app.post("/api/refine-form", async (req, res) => {
  try {
    const { currentForm, instruction } = req.body;

    if (!currentForm || !instruction) {
      res.status(400).json({ error: "Formulário atual e instrução de ajuste são obrigatórios." });
      return;
    }

    const ai = getGeminiClient();

    const systemInstruction = `Você é um especialista em otimização de formulários.
O usuário possui um formulário estruturado em JSON e solicitou uma alteração ou enriquecimento específico.
Mantenha a coerência, preserve os IDs e campos existentes sempre que possível, e aplique estritamente as alterações solicitadas (como adicionar campos, reestruturar seções, mudar tipos de perguntas ou ajustar textos).
Retorne o JSON do formulário completo atualizado segundo o mesmo esquema.
${AI_FORM_CONTEXT ? `\nContexto fixo de quem cria os formulários (siga sempre):\n${AI_FORM_CONTEXT}` : ""}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `Formulário atual:\n${JSON.stringify(currentForm, null, 2)}\n\nInstrução de alteração:\n"""${instruction}"""`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: formSchema,
        temperature: 0.2,
      },
    });

    const outputText = response.text;
    if (!outputText) {
      throw new Error("Não foi possível obter resposta do modelo de IA.");
    }

    const updatedFormData = JSON.parse(outputText);
    const finalizedForm = {
      ...updatedFormData,
      id: currentForm.id,
      updatedAt: new Date().toISOString()
    };

    // Save in db
    await getStore().saveForm(finalizedForm);

    res.json({ success: true, form: finalizedForm });
  } catch (error: any) {
    console.error("Erro ao refinar formulário:", error);
    res.status(500).json({
      error: error.message || "Falha interna ao refinar formulário.",
    });
  }
});

// Endpoints /api/* desconhecidos sempre respondem JSON (nunca o index.html)
app.all("/api/*", (req, res) => {
  res.status(404).json({ success: false, error: `Endpoint não encontrado: ${req.method} ${req.path}` });
});

export default app;