/**
 * Camada de armazenamento.
 *
 * - Com SHEETS_WEBAPP_URL definida (produção / Vercel): tudo vai para a planilha
 *   do Google via Apps Script (veja apps-script/Code.gs).
 * - Sem ela (rodando no seu computador): usa o arquivo local data/forms_db.json,
 *   como o app fazia antes.
 */
import fs from "fs";
import path from "path";

export interface FormStats {
  form: any;
  responseCount: number;
  lastResponseAt: string | null;
}

export interface Store {
  kind: "sheets" | "file";
  listForms(): Promise<FormStats[]>;
  getForm(formId: string): Promise<FormStats | null>;
  saveForm(form: any): Promise<any>;
  deleteForm(formId: string): Promise<boolean>;
  listSubmissions(formId?: string): Promise<any[]>;
  addSubmission(form: any, submission: any): Promise<any>;
  updateSubmission(form: any, submission: any): Promise<any>;
  deleteSubmission(formId: string, submissionId: string): Promise<boolean>;
  addClick(click: any): Promise<any>;
  listClicks(formId: string): Promise<any[]>;
  getConfig<T = any>(key: string): Promise<T | null>;
  setConfig(key: string, value: any): Promise<void>;
}

// ---------------------------------------------------------------------------
// Google Sheets via Apps Script
// ---------------------------------------------------------------------------
class SheetsStore implements Store {
  kind = "sheets" as const;
  constructor(private url: string, private secret: string) {}

  // Cache curto das leituras: a tela consulta a cada poucos segundos e cada
  // ida ao Google leva 1-2s. Qualquer escrita limpa o cache.
  private cache = new Map<string, { at: number; value: any }>();
  private static CACHE_MS = 8000;
  private static READS = new Set(["listForms", "getForm", "listSubmissions", "listClicks", "getConfig"]);

  private async call<T>(action: string, payload: Record<string, any> = {}): Promise<T> {
    const isRead = SheetsStore.READS.has(action);
    const key = isRead ? action + JSON.stringify(payload) : "";
    if (isRead) {
      const hit = this.cache.get(key);
      if (hit && Date.now() - hit.at < SheetsStore.CACHE_MS) return hit.value as T;
    } else {
      this.cache.clear();
    }

    let lastErr: any;
    // Até 2 tentativas, cada uma com no máximo 25s (a Vercel corta em 60s).
    for (let attempt = 1; attempt <= 2; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 25_000);
      try {
        const res = await fetch(this.url, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ secret: this.secret, action, ...payload }),
          redirect: "follow",
          signal: ctrl.signal
        });
        const text = await res.text();
        let data: any;
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(
            `Planilha respondeu algo inesperado (HTTP ${res.status}). Confira se o App da Web está com acesso "Qualquer pessoa". Início da resposta: ${text.slice(0, 120)}`
          );
        }
        if (!data.ok) {
          const e: any = new Error(`Planilha: ${data.error}`);
          e.busy = Boolean(data.busy);
          throw e;
        }
        if (isRead) this.cache.set(key, { at: Date.now(), value: data.data });
        return data.data as T;
      } catch (err: any) {
        lastErr = err?.name === "AbortError" ? new Error("A planilha demorou demais para responder (25s).") : err;
        const retryable = err?.busy || (!String(err?.message || "").startsWith("Planilha") && err?.name !== "AbortError");
        if (!retryable || attempt === 2) break;
        await new Promise((r) => setTimeout(r, 1500));
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr;
  }

  listForms() { return this.call<FormStats[]>("listForms"); }
  getForm(formId: string) { return this.call<FormStats | null>("getForm", { formId }); }
  saveForm(form: any) { return this.call<any>("saveForm", { form }); }
  deleteForm(formId: string) { return this.call<boolean>("deleteForm", { formId }); }
  listSubmissions(formId?: string) { return this.call<any[]>("listSubmissions", { formId }); }
  addSubmission(form: any, submission: any) { return this.call<any>("addSubmission", { form, submission }); }
  updateSubmission(form: any, submission: any) { return this.call<any>("updateSubmission", { form, submission }); }
  deleteSubmission(formId: string, submissionId: string) {
    return this.call<boolean>("deleteSubmission", { formId, submissionId });
  }
  addClick(click: any) { return this.call<any>("addClick", { click }); }
  listClicks(formId: string) { return this.call<any[]>("listClicks", { formId }); }
  getConfig<T>(key: string) { return this.call<T | null>("getConfig", { key }); }
  async setConfig(key: string, value: any) { await this.call("setConfig", { key, value }); }
}

// ---------------------------------------------------------------------------
// Arquivo JSON local (desenvolvimento)
// ---------------------------------------------------------------------------
interface FileDb {
  forms: Record<string, any>;
  submissions: Record<string, any[]>;
  linkClicks: Record<string, any[]>;
  config: Record<string, any>;
}

class FileStore implements Store {
  kind = "file" as const;
  private file: string;
  private db: FileDb;

  constructor(dir: string) {
    this.file = path.join(dir, "forms_db.json");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    let parsed: any = {};
    try {
      if (fs.existsSync(this.file)) parsed = JSON.parse(fs.readFileSync(this.file, "utf-8"));
    } catch (err) {
      console.error("[FileStore] Não consegui ler o banco local, começando vazio:", err);
    }
    this.db = {
      forms: parsed.forms || {},
      submissions: parsed.submissions || {},
      linkClicks: parsed.linkClicks || {},
      config: parsed.config || {}
    };
    // migra a config antiga (data/email_config.json), se existir
    const oldEmail = path.join(dir, "email_config.json");
    if (!this.db.config.email && fs.existsSync(oldEmail)) {
      try { this.db.config.email = JSON.parse(fs.readFileSync(oldEmail, "utf-8")); } catch {}
    }
  }

  private persist() {
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.db, null, 2), "utf-8");
    fs.renameSync(tmp, this.file);
  }

  private stats(form: any): FormStats {
    const subs = this.db.submissions[form.id] || [];
    return { form, responseCount: subs.length, lastResponseAt: subs[subs.length - 1]?.submittedAt || null };
  }

  async listForms() { return Object.values(this.db.forms).map((f) => this.stats(f)); }
  async getForm(formId: string) { const f = this.db.forms[formId]; return f ? this.stats(f) : null; }
  async saveForm(form: any) {
    this.db.forms[form.id] = form;
    this.db.submissions[form.id] ||= [];
    this.persist();
    return form;
  }
  async deleteForm(formId: string) {
    if (!this.db.forms[formId]) return false;
    delete this.db.forms[formId];
    delete this.db.submissions[formId];
    delete this.db.linkClicks[formId];
    this.persist();
    return true;
  }
  async listSubmissions(formId?: string) {
    if (formId) return [...(this.db.submissions[formId] || [])];
    return Object.values(this.db.submissions).flat();
  }
  async addSubmission(form: any, submission: any) {
    (this.db.submissions[form.id] ||= []).push(submission);
    if (submission.tagId) {
      const clicks = this.db.linkClicks[form.id] || [];
      const target = [...clicks].reverse().find((c) => c.tagId === submission.tagId && !c.completed);
      if (target) { target.completed = true; target.submissionId = submission.id; }
    }
    this.persist();
    return submission;
  }
  async updateSubmission(form: any, submission: any) {
    const list = this.db.submissions[form.id] || [];
    const i = list.findIndex((s) => s.id === submission.id);
    if (i === -1) throw new Error("Resposta não encontrada.");
    list[i] = submission;
    this.persist();
    return submission;
  }
  async deleteSubmission(formId: string, submissionId: string) {
    const list = this.db.submissions[formId] || [];
    const i = list.findIndex((s) => s.id === submissionId);
    if (i === -1) return false;
    list.splice(i, 1);
    this.persist();
    return true;
  }
  async addClick(click: any) {
    (this.db.linkClicks[click.formId] ||= []).push(click);
    this.persist();
    return click;
  }
  async listClicks(formId: string) { return [...(this.db.linkClicks[formId] || [])]; }
  async getConfig(key: string) { return this.db.config[key] ?? null; }
  async setConfig(key: string, value: any) { this.db.config[key] = value; this.persist(); }
}

let storeInstance: Store | null = null;

export function getStore(): Store {
  if (storeInstance) return storeInstance;
  const url = process.env.SHEETS_WEBAPP_URL?.trim();
  if (url) {
    const secret = process.env.SHEETS_SECRET?.trim() || "";
    storeInstance = new SheetsStore(url, secret);
    console.log("[Store] Usando planilha do Google (Apps Script).");
  } else {
    if (process.env.VERCEL) {
      throw new Error("SHEETS_WEBAPP_URL não configurada na Vercel. Sem ela os dados não seriam salvos.");
    }
    storeInstance = new FileStore(path.join(process.cwd(), "data"));
    console.log("[Store] Usando arquivo local data/forms_db.json.");
  }
  return storeInstance;
}
