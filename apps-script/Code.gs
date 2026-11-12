/**
 * Formulário Maker — banco de dados na planilha
 * ------------------------------------------------------------
 * Este script fica DENTRO da planilha (Extensões → Apps Script).
 * O app na Vercel conversa com ele pelo link de "App da Web".
 *
 * Abas que ele cria sozinho:
 *   • Formulários  → um formulário por linha (estrutura em JSON nas colunas "Dados")
 *   • Respostas · <nome do formulário>  → uma linha por resposta, uma coluna por pergunta
 *   • Cliques      → cliques nos links rastreados
 *   • Config       → configurações do app (e-mail etc.)
 *
 * Você pode ler e filtrar à vontade. Evite editar/apagar as colunas
 * "Dados" e "_dados" — é de lá que o app lê.
 */

// Troque por uma senha qualquer e coloque A MESMA na Vercel (variável SHEETS_SECRET).
const SEGREDO = "troque-esta-senha";

const ABA_FORMS = "Formulários";
const ABA_CLIQUES = "Cliques";
const ABA_CONFIG = "Config";
const CHUNK = 45000; // limite de 50 mil caracteres por célula

const FORM_HEADERS = ["ID", "Título", "Criado em", "Atualizado em", "Aba de respostas", "Respostas", "Dados"];
const RESP_FIXED = ["Protocolo", "Enviado em", "Nome", "E-mail", "Link rastreado", "Status do e-mail", "_dados"];
const CLICK_HEADERS = ["ID", "Formulário", "Link", "Dia", "Horário", "Navegador", "IP", "Concluiu?", "Protocolo", "Timestamp", "_formId", "_tagId", "_userAgent"];

// ------------------------------------------------------------------ entrada

function doGet() {
  return json_({ ok: true, message: "Formulário Maker: banco de dados ativo." });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (err) {
    return json_({ ok: false, error: "JSON inválido" });
  }
  if (body.secret !== SEGREDO) {
    return json_({ ok: false, error: "Senha (SHEETS_SECRET) não confere com a do Apps Script." });
  }
  const fn = ACTIONS[body.action];
  if (!fn) return json_({ ok: false, error: "Ação desconhecida: " + body.action });

  // Leitura não precisa de trava (senão as consultas fazem fila e travam tudo).
  if (READ_ONLY[body.action]) {
    try {
      return json_({ ok: true, data: fn(body) });
    } catch (err) {
      return json_({ ok: false, error: String((err && err.message) || err) });
    }
  }

  // Escrita: uma por vez. Se estiver ocupado por mais de 10s, desiste e o app tenta de novo.
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return json_({ ok: false, busy: true, error: "Planilha ocupada, tente de novo em instantes." });
  }
  try {
    return json_({ ok: true, data: fn(body) });
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  } finally {
    lock.releaseLock();
  }
}

const READ_ONLY = { ping: true, listForms: true, getForm: true, listSubmissions: true, listClicks: true, getConfig: true };

const ACTIONS = {
  ping: function () { return { pong: true }; },

  listForms: function () {
    return readForms_().map(formWithStats_);
  },

  getForm: function (b) {
    const r = findForm_(b.formId);
    return r ? formWithStats_(r) : null;
  },

  saveForm: function (b) {
    saveForm_(b.form);
    return b.form;
  },

  deleteForm: function (b) {
    const r = findForm_(b.formId);
    if (!r) return false;
    const sheet = r.respTab ? ss_().getSheetByName(r.respTab) : null;
    if (sheet) ss_().deleteSheet(sheet);
    formsSheet_().deleteRow(r.row);
    // remove cliques do formulário
    const cs = clicksSheet_();
    const vals = dataRows_(cs, CLICK_HEADERS.length);
    for (let i = vals.length - 1; i >= 0; i--) {
      if (String(vals[i][10]) === b.formId) cs.deleteRow(i + 2);
    }
    return true;
  },

  listSubmissions: function (b) {
    if (b.formId) {
      const r = findForm_(b.formId);
      if (!r || !r.respTab) return [];
      const sheet = ss_().getSheetByName(r.respTab);
      return sheet ? readSubmissions_(sheet) : [];
    }
    let all = [];
    readForms_().forEach(function (r) {
      const sheet = r.respTab ? ss_().getSheetByName(r.respTab) : null;
      if (sheet) all = all.concat(readSubmissions_(sheet));
    });
    return all;
  },

  addSubmission: function (b) {
    const r = findForm_(b.form.id);
    if (!r) throw new Error("Formulário não encontrado: " + b.form.id);
    const sheet = ensureRespSheet_(r);
    syncRespHeaders_(sheet, b.form);
    // se a mesma resposta chegar duas vezes (nova tentativa), só atualiza a linha
    const already = findRowById_(sheet, b.submission.id);
    writeSubmissionRow_(sheet, b.form, b.submission, already || null);
    updateFormCount_(r.row, sheet);

    // marca o clique mais recente desse link como concluído
    if (b.submission.tagId) {
      const cs = clicksSheet_();
      const vals = dataRows_(cs, CLICK_HEADERS.length);
      for (let i = vals.length - 1; i >= 0; i--) {
        if (String(vals[i][10]) === b.form.id && String(vals[i][11]) === b.submission.tagId && vals[i][7] !== "Sim") {
          cs.getRange(i + 2, 8, 1, 2).setValues([["Sim", b.submission.id]]);
          break;
        }
      }
    }
    return b.submission;
  },

  updateSubmission: function (b) {
    const r = findForm_(b.form.id);
    if (!r || !r.respTab) throw new Error("Formulário não encontrado: " + b.form.id);
    const sheet = ss_().getSheetByName(r.respTab);
    const row = findRowById_(sheet, b.submission.id);
    if (!row) throw new Error("Resposta não encontrada: " + b.submission.id);
    syncRespHeaders_(sheet, b.form);
    writeSubmissionRow_(sheet, b.form, b.submission, row);
    return b.submission;
  },

  deleteSubmission: function (b) {
    const r = findForm_(b.formId);
    if (!r || !r.respTab) return false;
    const sheet = ss_().getSheetByName(r.respTab);
    if (!sheet) return false;
    const row = findRowById_(sheet, b.submissionId);
    if (!row) return false;
    sheet.deleteRow(row);
    updateFormCount_(r.row, sheet);
    return true;
  },

  addClick: function (b) {
    const c = b.click;
    const formRow = findForm_(c.formId);
    if (findRowById_(clicksSheet_(), c.id)) return c; // já registrado
    clicksSheet_().appendRow(safeRow_([
      c.id, formRow ? formRow.form.title : c.formId, c.tagName, text_(c.dia), text_(c.horario), c.navegador, text_(c.ip),
      c.completed ? "Sim" : "Não", c.submissionId || "", text_(c.timestamp), c.formId, c.tagId, c.userAgent || ""
    ]));
    return c;
  },

  listClicks: function (b) {
    return dataRows_(clicksSheet_(), CLICK_HEADERS.length)
      .filter(function (v) { return !b.formId || String(v[10]) === b.formId; })
      .map(function (v) {
        return {
          id: String(v[0]), formId: String(v[10]), tagId: String(v[11]), tagName: String(v[2]),
          dia: String(v[3]), horario: String(v[4]), navegador: String(v[5]), ip: String(v[6]),
          completed: v[7] === "Sim", submissionId: v[8] ? String(v[8]) : undefined,
          timestamp: String(v[9]), userAgent: String(v[12] || "")
        };
      });
  },

  getConfig: function (b) {
    const sheet = configSheet_();
    const vals = dataRows_(sheet, 2);
    for (let i = 0; i < vals.length; i++) {
      if (vals[i][0] === b.key) return parseJson_(vals[i][1]);
    }
    return null;
  },

  setConfig: function (b) {
    const sheet = configSheet_();
    const vals = dataRows_(sheet, 2);
    const cell = "j:" + JSON.stringify(b.value === undefined ? null : b.value);
    for (let i = 0; i < vals.length; i++) {
      if (vals[i][0] === b.key) {
        sheet.getRange(i + 2, 2).setValue(cell);
        return true;
      }
    }
    sheet.appendRow([b.key, cell]);
    return true;
  }
};

// ------------------------------------------------------------------ formulários

function readForms_() {
  const sheet = formsSheet_();
  const lastCol = Math.max(sheet.getLastColumn(), FORM_HEADERS.length);
  const rows = dataRows_(sheet, lastCol);
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const v = rows[i];
    if (!v[0]) continue;
    const jsonText = joinChunks_(v.slice(FORM_HEADERS.length - 1));
    const form = parseJson_(jsonText);
    if (!form) continue;
    out.push({ row: i + 2, id: String(v[0]), respTab: String(v[4] || ""), form: form });
  }
  return out;
}

// Conta respostas sem ler a aba inteira (só a última linha).
function formWithStats_(r) {
  const sheet = r.respTab ? ss_().getSheetByName(r.respTab) : null;
  const count = sheet ? Math.max(sheet.getLastRow() - 1, 0) : 0;
  let last = null;
  if (count > 0) {
    const sub = parseJson_(sheet.getRange(sheet.getLastRow(), 7).getValue());
    last = sub ? sub.submittedAt : null;
  }
  return { form: r.form, responseCount: count, lastResponseAt: last };
}

function findForm_(id) {
  const all = readForms_();
  for (let i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
  return null;
}

function saveForm_(form) {
  const sheet = formsSheet_();
  const existing = findForm_(form.id);
  const chunks = toChunks_(JSON.stringify(form));
  const respTab = existing ? existing.respTab : "";
  const meta = [form.id, form.title || "Sem título", form.createdAt || "", form.updatedAt || "", respTab,
    existing ? sheet.getRange(existing.row, 6).getValue() : 0];
  const row = existing ? existing.row : sheet.getLastRow() + 1;

  // limpa colunas de dados antigas antes de regravar
  const lastCol = sheet.getLastColumn();
  if (existing && lastCol >= FORM_HEADERS.length) {
    sheet.getRange(row, FORM_HEADERS.length, 1, lastCol - FORM_HEADERS.length + 1).clearContent();
  }
  const values = safeRow_(meta).concat(chunks);
  ensureHeaderWidth_(sheet, values.length);
  sheet.getRange(row, 1, 1, values.length).setValues([values]);

  // renomeia a aba de respostas se o título mudou
  if (existing && respTab) {
    const tab = ss_().getSheetByName(respTab);
    const wanted = respTabName_(form);
    if (tab && wanted !== respTab && !ss_().getSheetByName(wanted)) {
      tab.setName(wanted);
      sheet.getRange(row, 5).setValue(wanted);
    }
  }
}

function ensureHeaderWidth_(sheet, width) {
  const cur = sheet.getLastColumn();
  if (width <= cur) return;
  const extra = [];
  for (let c = cur + 1; c <= width; c++) extra.push("Dados " + (c - FORM_HEADERS.length + 1));
  sheet.getRange(1, cur + 1, 1, extra.length).setValues([extra]);
}

function updateFormCount_(formRow, respSheet) {
  formsSheet_().getRange(formRow, 6).setValue(Math.max(respSheet.getLastRow() - 1, 0));
}

// ------------------------------------------------------------------ respostas

function respTabName_(form) {
  const clean = String(form.title || "Formulário").replace(/[\[\]\*\?\/\\:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  return "Respostas · " + clean + " (" + String(form.id).slice(-5) + ")";
}

function ensureRespSheet_(r) {
  let sheet = r.respTab ? ss_().getSheetByName(r.respTab) : null;
  if (sheet) return sheet;
  const name = respTabName_(r.form);
  sheet = ss_().getSheetByName(name) || ss_().insertSheet(name);
  sheet.getRange(1, 1, 1, RESP_FIXED.length).setValues([RESP_FIXED]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, RESP_FIXED.length).setFontWeight("bold");
  sheet.hideColumns(RESP_FIXED.length); // esconde a coluna _dados
  formsSheet_().getRange(r.row, 5).setValue(name);
  r.respTab = name;
  return sheet;
}

// Garante uma coluna por pergunta. O ID do campo fica na nota do cabeçalho.
function syncRespHeaders_(sheet, form) {
  const lastCol = Math.max(sheet.getLastColumn(), RESP_FIXED.length);
  const notes = sheet.getRange(1, 1, 1, lastCol).getNotes()[0];
  const known = {};
  for (let c = RESP_FIXED.length; c < lastCol; c++) if (notes[c]) known[notes[c]] = c + 1;

  const fields = allFields_(form);
  let next = lastCol + 1;
  fields.forEach(function (f) {
    const key = "id:" + f.id;
    const label = safeCell_(String(f.label || f.id));
    if (known[key]) {
      sheet.getRange(1, known[key]).setValue(label); // atualiza texto da pergunta
    } else {
      sheet.getRange(1, next).setValue(label).setNote(key).setFontWeight("bold");
      known[key] = next;
      next++;
    }
  });
  return known;
}

function writeSubmissionRow_(sheet, form, sub, row) {
  const known = syncRespHeaders_(sheet, form);
  const lastCol = Math.max(sheet.getLastColumn(), RESP_FIXED.length);
  const values = [];
  for (let i = 0; i < lastCol; i++) values.push("");

  const status = sub.autoReply ? (sub.autoReply.status === "sent" ? "Enviado" : "Simulado") : "Pendente";
  values[0] = sub.id;
  values[1] = formatDate_(sub.submittedAt);
  values[2] = sub.respondentName || "";
  values[3] = text_(sub.respondentEmail || "");
  values[4] = sub.tagName || "";
  values[5] = status;

  let raw = JSON.stringify(sub);
  if (raw.length > CHUNK) {
    // resposta gigante: guarda só os metadados, as respostas ficam nas colunas
    const slim = JSON.parse(raw);
    slim.answers = null;
    slim._answersInColumns = true;
    raw = JSON.stringify(slim);
  }
  values[6] = "j:" + raw;

  const answers = sub.answers || {};
  allFields_(form).forEach(function (f) {
    const col = known["id:" + f.id];
    if (!col) return;
    values[col - 1] = text_(displayValue_(answers[f.id]));
  });

  const safe = safeRow_(values);
  const target = row || sheet.getLastRow() + 1;
  sheet.getRange(target, 1, 1, safe.length).setValues([safe]);
}

function readSubmissions_(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), RESP_FIXED.length);
  const rows = dataRows_(sheet, lastCol);
  const notes = sheet.getRange(1, 1, 1, lastCol).getNotes()[0];
  const out = [];
  rows.forEach(function (v) {
    if (!v[0]) return;
    const sub = parseJson_(v[6]);
    if (!sub) return;
    if (sub._answersInColumns) {
      sub.answers = {};
      for (let c = RESP_FIXED.length; c < lastCol; c++) {
        if (notes[c] && v[c] !== "") sub.answers[String(notes[c]).replace(/^id:/, "")] = String(v[c]);
      }
      delete sub._answersInColumns;
    }
    out.push(sub);
  });
  out.sort(function (a, b) { return String(a.submittedAt).localeCompare(String(b.submittedAt)); });
  return out;
}

function findRowById_(sheet, id) {
  const n = sheet.getLastRow() - 1;
  if (n < 1) return 0;
  const col = sheet.getRange(2, 1, n, 1).getValues();
  for (let i = 0; i < col.length; i++) if (String(col[i][0]) === id) return i + 2;
  return 0;
}

function allFields_(form) {
  const out = [];
  (form.sections || []).forEach(function (s) {
    (s.fields || []).forEach(function (f) { if (f && f.id) out.push(f); });
  });
  return out;
}

function displayValue_(v) {
  if (v === undefined || v === null) return "";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

// ------------------------------------------------------------------ abas

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function getOrCreate_(name, headers) {
  let sheet = ss_().getSheetByName(name);
  if (!sheet) {
    sheet = ss_().insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function formsSheet_() { return getOrCreate_(ABA_FORMS, FORM_HEADERS); }
function clicksSheet_() { return getOrCreate_(ABA_CLIQUES, CLICK_HEADERS); }
function configSheet_() { return getOrCreate_(ABA_CONFIG, ["Chave", "Valor"]); }

function dataRows_(sheet, width) {
  const n = sheet.getLastRow() - 1;
  if (n < 1) return [];
  return sheet.getRange(2, 1, n, Math.max(width, 1)).getValues();
}

// ------------------------------------------------------------------ utilitários

function toChunks_(text) {
  const out = [];
  for (let i = 0; i < text.length; i += CHUNK) out.push("j:" + text.slice(i, i + CHUNK));
  return out.length ? out : ["j:"];
}

function joinChunks_(cells) {
  let s = "";
  for (let i = 0; i < cells.length; i++) {
    const c = String(cells[i] || "");
    if (c.indexOf("j:") === 0) s += c.slice(2);
  }
  return s;
}

function parseJson_(cell) {
  let s = String(cell || "");
  if (s.indexOf("j:") === 0) s = s.slice(2);
  if (!s) return null;
  try { return JSON.parse(s); } catch (e) { return null; }
}

// Evita que respostas como "=SOMA()" ou "+55 11..." virem fórmula.
function safeCell_(v) {
  if (typeof v !== "string") return v;
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function safeRow_(arr) { return arr.map(safeCell_); }

// Força a célula a ficar como texto (senão o Sheets vira "11999998888" em número
// e "12/11/2026" em data). O apóstrofo não aparece na planilha.
function text_(v) {
  const s = String(v === undefined || v === null ? "" : v);
  return s && s.charAt(0) !== "'" ? "'" + s : s;
}

function formatDate_(iso) {
  try {
    return Utilities.formatDate(new Date(iso), "America/Sao_Paulo", "dd/MM/yyyy HH:mm:ss");
  } catch (e) {
    return String(iso || "");
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
