import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Configure Google Provider with Gmail Send and Google Sheets Scopes
export const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/spreadsheets"
];

export const provider = new GoogleAuthProvider();
SCOPES.forEach((s) => provider.addScope(s));
provider.setCustomParameters({
  login_hint: "hugoviajante@gmail.com",
  prompt: "consent"
});

// Cache token in memory
let cachedAccessToken: string | null = null;
let cachedUser: User | null = null;
let isSigningIn = false;

// Listeners
type AuthListener = (user: User | null, token: string | null) => void;
const listeners = new Set<AuthListener>();

export function subscribeGmailAuth(listener: AuthListener): () => void {
  listeners.add(listener);
  listener(cachedUser, cachedAccessToken);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners() {
  listeners.forEach((l) => l(cachedUser, cachedAccessToken));
}

// Request token using native Google Identity Services (GSI)
export function requestTokenViaGSI(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !(window as any).google?.accounts?.oauth2) {
      return reject(
        new Error(
          "Biblioteca Google Identity Services ainda está inicializando. Tente novamente em alguns segundos."
        )
      );
    }
    try {
      const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: firebaseConfig.oAuthClientId,
        scope: SCOPES.join(" "),
        hint: "hugoviajante@gmail.com",
        callback: (resp: any) => {
          if (resp.error) {
            return reject(new Error(resp.error_description || resp.error));
          }
          if (resp.access_token) {
            resolve(resp.access_token);
          } else {
            reject(new Error("Nenhum token de acesso foi retornado pelo Google."));
          }
        }
      });
      tokenClient.requestAccessToken({ prompt: "consent" });
    } catch (err) {
      reject(err);
    }
  });
}

// Check if server already has an active persisted session
export async function checkServerSession(): Promise<boolean> {
  try {
    const res = await fetch("/api/gmail/active-token");
    if (res.ok) {
      const data = await res.json();
      if (data.connected) {
        notifyListeners();
        return true;
      }
    }
  } catch (e) {
    console.warn("Aviso ao checar sessão no servidor:", e);
  }
  return false;
}

// Initialize Auth
export function initGmailAuth(
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) {
  checkServerSession();
  return onAuthStateChanged(auth, async (user) => {
    cachedUser = user;
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      if (!isSigningIn && !cachedAccessToken) {
        if (onAuthFailure) onAuthFailure();
      }
    }
    notifyListeners();
  });
}

// Sign in with Google (requests Gmail send permission)
export async function signInWithGmail(): Promise<{ email: string; accessToken: string }> {
  isSigningIn = true;
  try {
    let token: string | null = null;
    let email = "hugoviajante@gmail.com";

    // Method 1: Try Firebase Auth standard popup
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        token = credential.accessToken;
        cachedUser = result.user;
        email = result.user.email || email;
      }
    } catch (fbErr: any) {
      console.warn("Firebase popup falhou, acionando Google Identity Services direto:", fbErr?.message || fbErr);
    }

    // Method 2: If Firebase popup failed or domain was restricted, use native Google Identity Services
    if (!token) {
      token = await requestTokenViaGSI();
    }

    if (!token) {
      throw new Error("Não foi possível obter o token de envio do Gmail.");
    }

    cachedAccessToken = token;

    // Notify backend about active token for 24/7 background dispatches
    try {
      await fetch("/api/gmail/active-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: cachedAccessToken,
          email
        })
      });
    } catch (syncErr) {
      console.warn("Aviso ao sincronizar token com backend:", syncErr);
    }

    notifyListeners();
    return { email, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Erro no login com Google Gmail:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
}

export function getCachedGmailToken(): string | null {
  return cachedAccessToken;
}

export async function getAccessToken(): Promise<string | null> {
  return cachedAccessToken;
}

export function getCachedGmailUser(): User | null {
  return cachedUser;
}

export async function logoutGmail(): Promise<void> {
  await signOut(auth);
  cachedAccessToken = null;
  cachedUser = null;
  try {
    await fetch("/api/gmail/active-token", {
      method: "DELETE"
    });
  } catch (e) {
    console.warn(e);
  }
  notifyListeners();
}

// Encode UTF-8 email into RFC 2822 Base64url format for Gmail API
function encodeRfc2822Email(headers: Record<string, string>, htmlBody: string): string {
  const boundary = "boundary_" + Math.random().toString(36).substring(2);
  let message = "";
  for (const [key, value] of Object.entries(headers)) {
    message += `${key}: ${value}\r\n`;
  }
  message += `MIME-Version: 1.0\r\n`;
  message += `Content-Type: text/html; charset="UTF-8"\r\n\r\n`;
  message += `${htmlBody}\r\n`;

  const bytes = new TextEncoder().encode(message);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Send email using official Gmail API
export async function sendEmailViaGmail(params: {
  to: string;
  subject: string;
  htmlBody: string;
  senderName?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!cachedAccessToken) {
    throw new Error("Você precisa estar conectado com sua conta Google (Gmail) para enviar.");
  }

  const senderEmail = cachedUser?.email || "hugoviajante@gmail.com";
  const senderName = params.senderName || cachedUser?.displayName || "Hugo Gomes Pinheiro";

  const raw = encodeRfc2822Email(
    {
      From: `"${senderName}" <${senderEmail}>`,
      To: params.to,
      Subject: params.subject
    },
    params.htmlBody
  );

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cachedAccessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ raw })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const msg = errData.error?.message || `Erro ${res.status} ao enviar pelo Gmail.`;
    throw new Error(msg);
  }

  const data = await res.json();
  return { success: true, id: data.id };
}

// Helper to build nice HTML email for confirmation
export function buildConfirmationEmailHtml(params: {
  formTitle: string;
  submissionId: string;
  respondentName: string;
  answers: Record<string, any>;
  isAdminCopy?: boolean;
}): string {
  const { formTitle, submissionId, respondentName, answers, isAdminCopy } = params;

  let answersRows = "";
  for (const [key, val] of Object.entries(answers)) {
    let displayVal = "";
    if (Array.isArray(val)) {
      displayVal = val.join(", ");
    } else if (typeof val === "boolean") {
      displayVal = val ? "Sim" : "Não";
    } else {
      displayVal = String(val ?? "");
    }

    if (displayVal.trim()) {
      answersRows += `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px 14px; font-size: 12px; font-weight: bold; color: #475569; width: 40%; vertical-align: top; background-color: #f8fafc;">
            ${key}
          </td>
          <td style="padding: 10px 14px; font-size: 13px; color: #0f172a; vertical-align: top;">
            ${displayVal}
          </td>
        </tr>
      `;
    }
  }

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #0f172a; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #cbd5e1; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .header { background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); color: #ffffff; padding: 28px 24px; text-align: center; }
        .badge { display: inline-block; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
        .title { font-size: 22px; font-weight: 800; margin: 0; }
        .subtitle { font-size: 13px; opacity: 0.9; margin: 6px 0 0 0; }
        .content { padding: 28px 24px; }
        .greeting { font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 20px; background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 14px 16px; border-radius: 4px 8px 8px 4px; }
        .meta-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 12px 16px; font-size: 12px; color: #1e40af; margin-bottom: 24px; }
        .table-title { font-size: 13px; font-weight: 700; text-transform: uppercase; color: #475569; letter-spacing: 0.05em; margin-bottom: 10px; }
        .answers-table { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 24px; }
        .footer { background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center; font-size: 11px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="badge">${isAdminCopy ? "Notificação para Administrador" : "Comprovante de Preenchimento"}</div>
          <h1 class="title">${formTitle}</h1>
          <p class="subtitle">${isAdminCopy ? "Novo envio recebido no sistema" : "Enviado por Hugo Gomes Pinheiro"}</p>
        </div>
        <div class="content">
          ${
            isAdminCopy
              ? `<div style="background-color: #dbeafe; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 4px; font-size: 13px; color: #1e3a8a; margin-bottom: 20px;">
                  <strong>Nova resposta cadastrada no formulário!</strong><br/>
                  Respondente: <strong>${respondentName}</strong><br/>
                  Protocolo: <strong>${submissionId}</strong>
                </div>`
              : `<div class="greeting">
                  Olá, <strong>${respondentName}</strong>! Confirmamos o recebimento das suas respostas para o formulário <strong>"${formTitle}"</strong>. Segue abaixo a relação de dados enviados para sua conferência e protocolo.
                </div>`
          }

          <div class="meta-box">
            <div style="margin-bottom: 4px;"><strong>Protocolo Oficial:</strong> ${submissionId}</div>
            <div><strong>Data e Hora:</strong> ${new Date().toLocaleString("pt-BR")}</div>
          </div>

          <div class="table-title">Resumo das Respostas:</div>
          <table class="answers-table">
            ${answersRows || `<tr><td style="padding: 12px; font-size: 12px; color: #64748b;">Nenhuma resposta para exibir</td></tr>`}
          </table>

          <p style="font-size: 12px; color: #64748b; margin-top: 16px; line-height: 1.5;">
            Em caso de dúvidas ou necessidade de retificação, responda diretamente a este e-mail.
          </p>
        </div>
        <div class="footer">
          <p style="margin: 0;">Enviado a partir da conta de <strong>Hugo Gomes Pinheiro</strong> (hugoviajante@gmail.com).</p>
          <p style="margin: 4px 0 0 0;">${formTitle} • Todos os direitos reservados</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
