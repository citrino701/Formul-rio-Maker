import { TaggedLink, LinkClickLog } from "../types";

/**
 * Extracts Google Spreadsheet ID from various URL formats
 * Example: https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0
 */
export function extractSpreadsheetId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();
  // Regex to match /d/SPREADSHEET_ID/
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  // Check if it's already a raw ID (no slashes, length > 20)
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

export interface SheetExportResult {
  success: boolean;
  spreadsheetTitle?: string;
  spreadsheetUrl?: string;
  tabsUpdated?: string[];
  totalClicksExported: number;
  message?: string;
}

/**
 * Synchronizes tagged clicks with Google Sheets via REST API
 * Creates separate tabs or organized sections for each tagged link as requested:
 * "Se eu criei 2 links, link tagueado 1 e link tagueado 2... deve gerar de forma separada na planilha essas 2 infos"
 */
export async function syncTaggedClicksToGoogleSheet(params: {
  spreadsheetId: string;
  accessToken: string;
  formTitle: string;
  taggedLinks: TaggedLink[];
  clicks: LinkClickLog[];
}): Promise<SheetExportResult> {
  const { spreadsheetId, accessToken, formTitle, taggedLinks, clicks } = params;

  if (!spreadsheetId) {
    throw new Error("ID da planilha inválido ou link incorreto.");
  }
  if (!accessToken) {
    throw new Error("Token de autenticação do Google Sheets não encontrado. Por favor, conecte sua conta Google.");
  }

  // 1. Fetch spreadsheet metadata to check existing sheets
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });

  if (!metaRes.ok) {
    const errBody = await metaRes.json().catch(() => ({}));
    const errMsg = errBody.error?.message || metaRes.statusText;
    if (metaRes.status === 403 || metaRes.status === 401) {
      throw new Error(`Permissão negada no Google Sheets: certifique-se de que a planilha foi compartilhada ou que você possui permissão de edição. Detalhes: ${errMsg}`);
    }
    if (metaRes.status === 404) {
      throw new Error("Planilha não encontrada. Verifique se o link ou ID da planilha está correto.");
    }
    throw new Error(`Erro ao acessar planilha do Google: ${errMsg}`);
  }

  const metaData = await metaRes.json();
  const spreadsheetTitle = metaData.properties?.title || "Planilha do Google";
  const existingSheetTitles: string[] = (metaData.sheets || []).map(
    (s: any) => s.properties?.title as string
  );

  // Determine which tabs to create / update
  // For each tagged link, we will have a dedicated tab named after the link (e.g. "Link tagueado 1", "Link tagueado 2")
  const tabsToEnsure: { tag: TaggedLink; title: string; clicks: LinkClickLog[] }[] = [];

  // Group clicks by tagId
  const clicksByTag = new Map<string, LinkClickLog[]>();
  for (const c of clicks) {
    const list = clicksByTag.get(c.tagId) || [];
    list.push(c);
    clicksByTag.set(c.tagId, list);
  }

  for (const tag of taggedLinks) {
    // Sanitize tab title (Google Sheets max title is 100 chars, no [ ] * ? : / \)
    const cleanTitle = (tag.name || `Link ${tag.id}`).replace(/[:\\/?*\[\]]/g, "-").slice(0, 80);
    tabsToEnsure.push({
      tag,
      title: cleanTitle,
      clicks: clicksByTag.get(tag.id) || []
    });
  }

  // If there are clicks for deleted or unassigned tags, group them into "Outros Links"
  const knownTagIds = new Set(taggedLinks.map((t) => t.id));
  const otherClicks = clicks.filter((c) => !knownTagIds.has(c.tagId));
  if (otherClicks.length > 0) {
    tabsToEnsure.push({
      tag: { id: "outros", name: "Outros Links", createdAt: new Date().toISOString() },
      title: "Outros Links Tagueados",
      clicks: otherClicks
    });
  }

  // 2. Add missing tabs using batchUpdate
  const newSheetsToAdd = tabsToEnsure.filter((item) => !existingSheetTitles.includes(item.title));
  if (newSheetsToAdd.length > 0) {
    const addSheetRequests = newSheetsToAdd.map((item) => ({
      addSheet: {
        properties: {
          title: item.title,
          gridProperties: {
            rowCount: 200,
            columnCount: 10
          }
        }
      }
    }));

    const addRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ requests: addSheetRequests })
      }
    );

    if (!addRes.ok) {
      console.warn("Aviso ao adicionar novas abas no Google Sheets:", await addRes.text());
    }
  }

  // 3. Write structured data to each tab
  const tabsUpdated: string[] = [];
  let totalClicksExported = 0;

  for (const item of tabsToEnsure) {
    const rows: (string | number)[][] = [
      // Row 1: Banner Info
      [`Tagueamento: ${item.tag.name}`, `Formulário: ${formTitle}`, `Atualizado em: ${new Date().toLocaleString("pt-BR")}`],
      // Row 2: Headers
      ["Dia / Data", "Horário", "Navegador e Dispositivo", "Status de Acesso", "ID do Clique / Protocolo"]
    ];

    if (item.clicks.length === 0) {
      rows.push(["(Nenhum clique registrado ainda para este link)", "-", "-", "-", "-"]);
    } else {
      for (const click of item.clicks) {
        rows.push([
          click.dia || "-",
          click.horario || "-",
          click.navegador || "Navegador padrão",
          click.completed ? "Concluiu e Enviou Formulário" : "Apenas Clicou no Link",
          click.submissionId ? `Protocolo: ${click.submissionId}` : click.id
        ]);
        totalClicksExported++;
      }
    }

    // Overwrite range starting at A1 in that tab
    const range = `'${item.title.replace(/'/g, "''")}'!A1:E${rows.length + 10}`;
    const writeRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
        range
      )}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          range,
          majorDimension: "ROWS",
          values: rows
        })
      }
    );

    if (writeRes.ok) {
      tabsUpdated.push(item.title);
    } else {
      console.error(`Erro ao escrever na aba ${item.title}:`, await writeRes.text());
    }
  }

  // 4. Also update or create a consolidated "Resumo de Tagueamento" tab
  try {
    const summaryTitle = "Resumo Tagueamento";
    if (!existingSheetTitles.includes(summaryTitle) && !newSheetsToAdd.some((s) => s.title === summaryTitle)) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: { title: summaryTitle }
              }
            }
          ]
        })
      });
    }

    const summaryRows: (string | number)[][] = [
      [`Painel de Tagueamento do Formulário: ${formTitle}`],
      ["Link Tagueado", "Total de Cliques", "Conclusões / Envios", "Taxa de Conversão", "Data de Criação"],
      ...taggedLinks.map((tag) => {
        const tagClicks = clicksByTag.get(tag.id) || [];
        const completed = tagClicks.filter((c) => c.completed).length;
        const rate = tagClicks.length > 0 ? `${Math.round((completed / tagClicks.length) * 100)}%` : "0%";
        return [
          tag.name,
          tagClicks.length,
          completed,
          rate,
          tag.createdAt ? new Date(tag.createdAt).toLocaleDateString("pt-BR") : "-"
        ];
      })
    ];

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${summaryTitle}'!A1:E${summaryRows.length + 5}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          range: `'${summaryTitle}'!A1:E${summaryRows.length + 5}`,
          majorDimension: "ROWS",
          values: summaryRows
        })
      }
    );
    tabsUpdated.push(summaryTitle);
  } catch (summaryErr) {
    console.warn("Aviso ao gerar aba de resumo:", summaryErr);
  }

  return {
    success: true,
    spreadsheetTitle,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    tabsUpdated,
    totalClicksExported,
    message: `Dados gerados com sucesso em ${tabsUpdated.length} abas na planilha "${spreadsheetTitle}"!`
  };
}

/**
 * Generates CSV content formatted for Excel / Google Sheets with UTF-8 BOM
 * Separates sections by tagged link cleanly
 */
export function generateTaggedClicksCsv(params: {
  formTitle: string;
  taggedLinks: TaggedLink[];
  clicks: LinkClickLog[];
}): string {
  const { formTitle, taggedLinks, clicks } = params;
  const clicksByTag = new Map<string, LinkClickLog[]>();
  for (const c of clicks) {
    const list = clicksByTag.get(c.tagId) || [];
    list.push(c);
    clicksByTag.set(c.tagId, list);
  }

  const lines: string[] = [];
  lines.push(`"RELATÓRIO DE TAGUEAMENTO - ${formTitle.replace(/"/g, '""')}"`);
  lines.push(`"Gerado em";"${new Date().toLocaleString("pt-BR")}"`);
  lines.push("");

  for (const tag of taggedLinks) {
    const tagClicks = clicksByTag.get(tag.id) || [];
    lines.push(`"=== ${tag.name.toUpperCase().replace(/"/g, '""')} ==="`);
    lines.push(`"Dia / Data";"Horário";"Navegador";"Status";"Identificador"`);
    if (tagClicks.length === 0) {
      lines.push(`"(Nenhum clique registrado)";"-";"-";"-";"-"`);
    } else {
      for (const click of tagClicks) {
        lines.push(
          `"${click.dia}";"${click.horario}";"${(click.navegador || "").replace(/"/g, '""')}";"${
            click.completed ? "Concluiu e Enviou" : "Apenas Clicou"
          }";"${(click.submissionId || click.id || "").replace(/"/g, '""')}"`
        );
      }
    }
    lines.push("");
  }

  // Prepend UTF-8 BOM for Excel compatibility
  return "\uFEFF" + lines.join("\r\n");
}

/**
 * Downloads CSV file directly in browser
 */
export function downloadCsvFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
