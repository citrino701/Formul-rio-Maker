/**
 * Copia os formulários e respostas que estão em data/forms_db.json
 * (o banco antigo, local) para a planilha do Google.
 *
 * Uso (uma vez só):
 *   SHEETS_WEBAPP_URL="https://script.google.com/macros/s/.../exec" \
 *   SHEETS_SECRET="sua-senha" \
 *   npx tsx scripts/migrar-para-planilha.ts
 */
import fs from "fs";
import path from "path";
import { getStore } from "../server/store.js";

async function main() {
  if (!process.env.SHEETS_WEBAPP_URL) {
    console.error("Defina SHEETS_WEBAPP_URL e SHEETS_SECRET antes de rodar.");
    process.exit(1);
  }
  const file = process.argv[2] || path.join(process.cwd(), "data", "forms_db.json");
  const db = JSON.parse(fs.readFileSync(file, "utf-8"));
  const store = getStore();

  await store.getConfig("ping"); // testa conexão e senha

  for (const form of Object.values<any>(db.forms || {})) {
    if (db.taggedLinks?.[form.id]) form.taggedLinks = db.taggedLinks[form.id];
    await store.saveForm(form);
    const subs: any[] = db.submissions?.[form.id] || [];
    for (const sub of subs) {
      const { bodyHtml, ...autoReply } = sub.autoReply || {};
      await store.addSubmission(form, { ...sub, formId: form.id, autoReply: sub.autoReply ? autoReply : null });
    }
    for (const click of db.linkClicks?.[form.id] || []) {
      await store.addClick({ ...click, formId: form.id });
    }
    console.log(`✔ ${form.title} — ${subs.length} resposta(s)`);
  }

  // config de e-mail antiga (sem senhas: essas ficam nas variáveis da Vercel)
  const emailFile = path.join(path.dirname(file), "email_config.json");
  if (fs.existsSync(emailFile)) {
    const cfg = JSON.parse(fs.readFileSync(emailFile, "utf-8"));
    for (const k of ["gmailAppPassword", "resendApiKey", "brevoApiKey", "smtpPass"]) delete cfg[k];
    await store.setConfig("email", cfg);
    console.log("✔ Configuração de e-mail");
  }
  console.log("Pronto! Abra a planilha para conferir.");
}

main().catch((err) => {
  console.error("Falhou:", err.message || err);
  process.exit(1);
});
