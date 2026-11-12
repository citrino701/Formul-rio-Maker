import React, { useState, useEffect } from "react";
import {
  Link2,
  Copy,
  Check,
  ExternalLink,
  X,
  FileSpreadsheet,
  Download,
  Plus,
  Trash2,
  Clock,
  Calendar,
  Globe,
  Loader2,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Share2
} from "lucide-react";
import { FormStructure, TaggedLink, LinkClickLog } from "../types";
import {
  extractSpreadsheetId,
  syncTaggedClicksToGoogleSheet,
  generateTaggedClicksCsv,
  downloadCsvFile
} from "../services/sheetsService";
import { getAccessToken, requestTokenViaGSI, checkServerSession } from "../services/gmailService";

interface TaggedLinksModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: FormStructure;
  onUpdateForm: (updated: FormStructure) => void;
}

export const TaggedLinksModal: React.FC<TaggedLinksModalProps> = ({
  isOpen,
  onClose,
  form,
  onUpdateForm
}) => {
  const [taggedLinks, setTaggedLinks] = useState<TaggedLink[]>(form.taggedLinks || []);
  const [clicks, setClicks] = useState<LinkClickLog[]>([]);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("all");
  const [isLoadingData, setIsLoadingData] = useState(false);

  // New Link creation form
  const [newTagName, setNewTagName] = useState("");
  const [isCreatingTag, setIsCreatingTag] = useState(false);

  // Google Sheets generation
  const [spreadsheetUrl, setSpreadsheetUrl] = useState("");
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [sheetSyncSuccess, setSheetSyncSuccess] = useState<{
    title: string;
    url: string;
    tabs: string[];
    total: number;
  } | null>(null);
  const [sheetSyncError, setSheetSyncError] = useState<string | null>(null);

  // Copy feedback
  const [copiedLinkIndex, setCopiedLinkIndex] = useState<string | null>(null);
  const [copiedCsv, setCopiedCsv] = useState(false);

  // Load existing tags and clicks from server
  const loadTagsAndClicks = async () => {
    try {
      setIsLoadingData(true);
      const res = await fetch(`/api/forms/${encodeURIComponent(form.id)}/tags`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const serverTags = data.taggedLinks || [];
          setTaggedLinks(serverTags);
          setClicks(data.clicks || []);
          if (JSON.stringify(serverTags) !== JSON.stringify(form.taggedLinks)) {
            onUpdateForm({
              ...form,
              taggedLinks: serverTags
            });
          }
        }
      }
    } catch (err) {
      console.warn("Erro ao buscar dados de tagueamento:", err);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTagsAndClicks();
    }
  }, [isOpen, form.id]);

  if (!isOpen) return null;

  const baseUrl = window.location.origin + window.location.pathname;

  const getTagUrl = (tagId: string) => {
    return `${baseUrl}?respond=${encodeURIComponent(form.id)}&tag=${encodeURIComponent(tagId)}`;
  };

  const handleCopy = (tagId: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLinkIndex(tagId);
    setTimeout(() => setCopiedLinkIndex(null), 2500);
  };

  // Create a new tagged link (e.g. "Link tagueado 1", "Link tagueado 2")
  const handleCreateTag = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = newTagName.trim();
    if (!name) return;

    setIsCreatingTag(true);
    try {
      const nextNumber = taggedLinks.length + 1;
      const tagId = `tag_${Date.now().toString().slice(-6)}`;
      const newTag: TaggedLink = {
        id: tagId,
        name: name || `Link tagueado ${nextNumber}`,
        createdAt: new Date().toISOString(),
        clicksCount: 0,
        completedCount: 0
      };

      const res = await fetch(`/api/forms/${encodeURIComponent(form.id)}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newTag })
      });

      if (res.ok) {
        const data = await res.json();
        const updated = data.taggedLinks || [...taggedLinks, newTag];
        setTaggedLinks(updated);
        onUpdateForm({
          ...form,
          taggedLinks: updated
        });
        setNewTagName("");
      }
    } catch (err) {
      console.error("Erro ao criar link tagueado:", err);
    } finally {
      setIsCreatingTag(false);
    }
  };

  // Quick preset creation: creates "Link tagueado 1" or "Link tagueado 2"
  const handleQuickAdd = async (presetName: string) => {
    setNewTagName(presetName);
    setIsCreatingTag(true);
    try {
      const tagId = `tag_${Date.now().toString().slice(-6)}`;
      const newTag: TaggedLink = {
        id: tagId,
        name: presetName,
        createdAt: new Date().toISOString(),
        clicksCount: 0,
        completedCount: 0
      };

      const res = await fetch(`/api/forms/${encodeURIComponent(form.id)}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newTag })
      });

      if (res.ok) {
        const data = await res.json();
        const updated = data.taggedLinks || [...taggedLinks, newTag];
        setTaggedLinks(updated);
        onUpdateForm({
          ...form,
          taggedLinks: updated
        });
        setNewTagName("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingTag(false);
    }
  };

  // Delete a tagged link
  const handleDeleteTag = async (tagId: string) => {
    if (!confirm("Deseja realmente remover este link tagueado? O histórico de cliques anteriores será mantido.")) {
      return;
    }
    try {
      await fetch(`/api/forms/${encodeURIComponent(form.id)}/tags/${encodeURIComponent(tagId)}`, {
        method: "DELETE"
      });
      const updated = taggedLinks.filter((t) => t.id !== tagId);
      setTaggedLinks(updated);
      onUpdateForm({
        ...form,
        taggedLinks: updated
      });
    } catch (err) {
      console.error("Erro ao remover tag:", err);
    }
  };

  // Generate & Insert into Google Sheets
  const handleGenerateGoogleSheet = async () => {
    setSheetSyncError(null);
    setSheetSyncSuccess(null);

    const sheetId = extractSpreadsheetId(spreadsheetUrl);
    if (!sheetId) {
      setSheetSyncError("Por favor, cole um link válido de uma Planilha do Google (Google Sheets).");
      return;
    }

    setIsSyncingSheet(true);
    try {
      // Get or request Google OAuth Access Token
      let token = await getAccessToken();
      if (!token) {
        try {
          token = await requestTokenViaGSI();
        } catch (gsiErr: any) {
          throw new Error(
            gsiErr.message ||
              "Não foi possível obter autorização do Google. Clique em 'Conectar Google' no topo ou autorize a integração de planilhas."
          );
        }
      }

      if (!token) {
        throw new Error("Token de autorização do Google Sheets indisponível. Faça login com o Google.");
      }

      // Synchronize tagged clicks to Google Sheet
      const result = await syncTaggedClicksToGoogleSheet({
        spreadsheetId: sheetId,
        accessToken: token,
        formTitle: form.title || "Formulário",
        taggedLinks: taggedLinks.length > 0 ? taggedLinks : [
          { id: "geral", name: "Link Geral", createdAt: new Date().toISOString() }
        ],
        clicks
      });

      setSheetSyncSuccess({
        title: result.spreadsheetTitle || "Planilha do Google",
        url: result.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
        tabs: result.tabsUpdated || [],
        total: result.totalClicksExported
      });
    } catch (err: any) {
      console.error("Erro ao gerar na planilha Google:", err);
      setSheetSyncError(err.message || "Falha ao sincronizar dados com o Google Sheets.");
    } finally {
      setIsSyncingSheet(false);
    }
  };

  // Download CSV / Excel file
  const handleDownloadCsv = () => {
    const csvData = generateTaggedClicksCsv({
      formTitle: form.title,
      taggedLinks,
      clicks
    });
    const filename = `Tagueamento_${(form.title || "Formulario").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsvFile(csvData, filename);
  };

  // Copy structured text to clipboard
  const handleCopyFormattedTable = () => {
    const csvData = generateTaggedClicksCsv({
      formTitle: form.title,
      taggedLinks,
      clicks
    });
    navigator.clipboard.writeText(csvData);
    setCopiedCsv(true);
    setTimeout(() => setCopiedCsv(false), 2500);
  };

  // Filter clicks list
  const filteredClicks =
    selectedTagFilter === "all"
      ? clicks
      : clicks.filter((c) => c.tagId === selectedTagFilter);

  const totalClicksCount = clicks.length;
  const totalCompletedCount = clicks.filter((c) => c.completed).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 via-indigo-500/5 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Gerenciador de Links Tagueados & Planilha
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                  Rastreamento 24/7
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Crie múltiplos links para rastrear Dia, Horário e Navegador de quem clicou e quem finalizou
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Quick Metrics Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Links Criados
              </span>
              <span className="text-xl font-black text-slate-900">{taggedLinks.length}</span>
            </div>
            <div className="p-3.5 bg-indigo-50/70 rounded-2xl border border-indigo-200">
              <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider block">
                Total de Cliques
              </span>
              <span className="text-xl font-black text-indigo-900">{totalClicksCount}</span>
            </div>
            <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                Preenchimentos
              </span>
              <span className="text-xl font-black text-emerald-900">{totalCompletedCount}</span>
            </div>
            <div className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200">
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
                Conversão Geral
              </span>
              <span className="text-xl font-black text-amber-900">
                {totalClicksCount > 0
                  ? `${Math.round((totalCompletedCount / totalClicksCount) * 100)}%`
                  : "0%"}
              </span>
            </div>
          </div>

          {/* Section 1: Create and Manage Tagged Links */}
          <div className="bg-slate-50/80 rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Link2 className="w-4 h-4 text-emerald-600" />
                  <span>Seus Links Tagueados</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Cada link encaminha a pessoa para o formulário e armazena os cliques de forma individual.
                </p>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Criar Rápido:</span>
                <button
                  type="button"
                  onClick={() => handleQuickAdd("Link tagueado 1")}
                  disabled={isCreatingTag}
                  className="px-2.5 py-1 text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg transition-colors shadow-2xs"
                >
                  + Link 1
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAdd("Link tagueado 2")}
                  disabled={isCreatingTag}
                  className="px-2.5 py-1 text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg transition-colors shadow-2xs"
                >
                  + Link 2
                </button>
              </div>
            </div>

            {/* Custom Input */}
            <form onSubmit={handleCreateTag} className="flex gap-2">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Ex: Link tagueado 1, Campanha WhatsApp, Instagram Stories..."
                className="flex-1 px-3.5 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl text-slate-900 focus:border-indigo-600"
              />
              <button
                type="submit"
                disabled={isCreatingTag || !newTagName.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs shrink-0"
              >
                {isCreatingTag ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span>Criar Link Tagueado</span>
              </button>
            </form>

            {/* Links List */}
            <div className="space-y-2.5 pt-1">
              {taggedLinks.length === 0 ? (
                <div className="text-center py-6 bg-white rounded-xl border border-dashed border-slate-300 text-xs text-slate-500">
                  Nenhum link tagueado criado ainda. Clique em <strong>+ Link 1</strong> ou <strong>+ Link 2</strong> acima para começar.
                </div>
              ) : (
                taggedLinks.map((tag, idx) => {
                  const tagUrl = getTagUrl(tag.id);
                  const isCopied = copiedLinkIndex === tag.id;
                  const tagClicks = clicks.filter((c) => c.tagId === tag.id);
                  const completed = tagClicks.filter((c) => c.completed).length;

                  return (
                    <div
                      key={tag.id}
                      className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center text-xs font-bold">
                            {idx + 1}
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-slate-900">
                            {tag.name}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                            tag={tag.id}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                            {tagClicks.length} {tagClicks.length === 1 ? "clique" : "cliques"} • {completed} {completed === 1 ? "envio" : "envios"}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteTag(tag.id)}
                            title="Remover link tagueado"
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* URL Box */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <input
                            type="text"
                            readOnly
                            value={tagUrl}
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                            className="bg-transparent text-[11px] text-slate-700 outline-hidden w-full font-mono select-all"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCopy(tag.id, tagUrl)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                            isCopied
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-900 hover:bg-slate-800 text-white"
                          }`}
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copiar Link</span>
                            </>
                          )}
                        </button>

                        <a
                          href={tagUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-lg transition-colors"
                          title="Testar link em nova aba"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Section 2: "Gerar lista de tagueamento" -> Inserir na Planilha do Google */}
          <div className="bg-gradient-to-br from-emerald-50/70 via-indigo-50/40 to-white rounded-2xl p-5 border-2 border-emerald-300 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md inline-block">
                  Ação Solicitada
                </span>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
                  <span>Gerar Lista de Tagueamento no Google Sheets / Excel</span>
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                  Insira o link de qualquer planilha do Google. Ao apertar em <strong>Gerar lista de tagueamento</strong>, o sistema insere automaticamente as informações de <strong>Horário</strong>, <strong>Navegador</strong> e <strong>Dia</strong>, gerando de forma separada as informações de cada link tagueado (ex: aba do Link 1 e aba do Link 2).
                </p>
              </div>
            </div>

            {/* Input Google Sheet Link */}
            <div className="space-y-2 pt-1">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span>Link da Planilha do Google (Google Sheets)</span>
              </label>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 min-w-0 bg-white border-2 border-slate-300 focus-within:border-emerald-600 rounded-xl px-3 py-2 flex items-center gap-2 shadow-2xs">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                  <input
                    type="url"
                    value={spreadsheetUrl}
                    onChange={(e) => setSpreadsheetUrl(e.target.value)}
                    placeholder="Cole aqui: https://docs.google.com/spreadsheets/d/.../edit"
                    className="bg-transparent text-xs sm:text-sm text-slate-900 outline-hidden w-full placeholder:text-slate-400"
                  />
                  {spreadsheetUrl && (
                    <button
                      type="button"
                      onClick={() => setSpreadsheetUrl("")}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleGenerateGoogleSheet}
                  disabled={isSyncingSheet || !spreadsheetUrl.trim()}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md shrink-0"
                >
                  {isSyncingSheet ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Inserindo na Planilha...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-emerald-200" />
                      <span>Gerar Lista de Tagueamento</span>
                    </>
                  )}
                </button>
              </div>

              {/* Status & Feedback */}
              {sheetSyncSuccess && (
                <div className="p-4 bg-emerald-100/90 border border-emerald-300 rounded-xl text-xs text-emerald-950 flex items-start justify-between gap-3 animate-in fade-in">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-sm">
                        Sucesso! Informações inseridas na planilha "{sheetSyncSuccess.title}".
                      </p>
                      <p className="text-emerald-800 text-[11px] mt-0.5">
                        Foram criadas/atualizadas {sheetSyncSuccess.tabs.length} abas separadas ({sheetSyncSuccess.tabs.join(", ")}), registrando {sheetSyncSuccess.total} cliques com Dia, Horário e Navegador.
                      </p>
                    </div>
                  </div>

                  <a
                    href={sheetSyncSuccess.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white rounded-lg font-bold text-xs hover:bg-emerald-800 transition-colors shrink-0"
                  >
                    <span>Abrir Planilha</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {sheetSyncError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5 animate-in shake">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">Aviso na sincronização:</p>
                    <p className="text-[11px] mt-0.5 text-rose-700">{sheetSyncError}</p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      💡 Dica: Você também pode usar os botões abaixo para <strong>Baixar em Excel (.csv)</strong> ou <strong>Copiar Tabela</strong> e colar direto na sua planilha.
                    </p>
                  </div>
                </div>
              )}

              {/* Alternative Export Buttons */}
              <div className="pt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-colors shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>Baixar em Excel (.csv separado por link)</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyFormattedTable}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-colors shadow-2xs"
                >
                  {copiedCsv ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Tabela Copiada para Área de Transferência!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-600" />
                      <span>Copiar Tabela (Colar no Excel / Sheets)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={loadTagsAndClicks}
                  disabled={isLoadingData}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl ml-auto"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? "animate-spin" : ""}`} />
                  <span>Atualizar Dados</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: Live Click Logs Table */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Histórico de Cliques Registrados ({filteredClicks.length})
                </h3>
              </div>

              {/* Tag Filter Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedTagFilter("all")}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                    selectedTagFilter === "all"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Todos ({clicks.length})
                </button>
                {taggedLinks.map((tag) => {
                  const count = clicks.filter((c) => c.tagId === tag.id).length;
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => setSelectedTagFilter(tag.id)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                        selectedTagFilter === tag.id
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {tag.name} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[10px] font-bold sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3.5">Link Tagueado</th>
                      <th className="py-2.5 px-3.5">Dia / Data</th>
                      <th className="py-2.5 px-3.5">Horário</th>
                      <th className="py-2.5 px-3.5">Navegador & Dispositivo</th>
                      <th className="py-2.5 px-3.5">Status de Conversão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {filteredClicks.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          {isLoadingData ? (
                            <div className="flex items-center justify-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                              <span>Carregando cliques...</span>
                            </div>
                          ) : (
                            "Nenhum clique registrado ainda para este filtro. Compartilhe o link tagueado para começar a capturar dados."
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredClicks.map((click) => (
                        <tr key={click.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3.5 font-bold text-slate-900">
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px]">
                              {click.tagName || click.tagId}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 font-mono text-slate-700">
                            {click.dia || "-"}
                          </td>
                          <td className="py-2.5 px-3.5 font-mono text-slate-700">
                            {click.horario || "-"}
                          </td>
                          <td className="py-2.5 px-3.5 text-slate-700 font-medium">
                            {click.navegador || "Navegador padrão"}
                          </td>
                          <td className="py-2.5 px-3.5">
                            {click.completed ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-bold text-[10px]">
                                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                <span>Preencheu e Enviou</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-medium text-[10px]">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>Apenas Clicou</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            💡 Os dados de cliques continuam sendo computados continuamente mesmo em segundo plano.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
