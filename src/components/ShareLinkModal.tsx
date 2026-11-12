import React, { useState } from "react";
import {
  Link2,
  Copy,
  Check,
  ExternalLink,
  X,
  Share2,
  QrCode,
  Send,
  MessageCircle,
  Mail,
  Eye,
  Sparkles,
  FileSpreadsheet
} from "lucide-react";
import { FormStructure } from "../types";

interface ShareLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: FormStructure;
  onOpenPreview: () => void;
  onOpenResponses?: () => void;
  onOpenTaggedLinks?: () => void;
  responseCount?: number;
}

export const ShareLinkModal: React.FC<ShareLinkModalProps> = ({
  isOpen,
  onClose,
  form,
  onOpenPreview,
  onOpenResponses,
  onOpenTaggedLinks,
  responseCount = 0
}) => {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  if (!isOpen) return null;

  // Generate shareable link
  const baseUrl = window.location.origin + window.location.pathname;
  const shareableUrl = `${baseUrl}?respond=${encodeURIComponent(form.id)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareableUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenDirect = () => {
    window.open(shareableUrl, "_blank");
  };

  // WhatsApp share
  const whatsappText = encodeURIComponent(
    `Olá! Por favor, preencha o formulário "${form.title}":\n${shareableUrl}`
  );
  const whatsappUrl = `https://api.whatsapp.com/send?text=${whatsappText}`;

  // Email share
  const emailSubject = encodeURIComponent(`Formulário: ${form.title}`);
  const emailBody = encodeURIComponent(
    `Olá,\n\nPor favor, acesse o link abaixo para preencher o formulário "${form.title}":\n\n${shareableUrl}\n\nObrigado!`
  );
  const emailUrl = `mailto:?subject=${emailSubject}&body=${emailBody}`;

  // Simple QR Code via Google Charts API or SVG fallback
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    shareableUrl
  )}&bgcolor=ffffff&color=1e1b4b&margin=1`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 via-indigo-500/5 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Link para Responder
              </h2>
              <p className="text-xs text-slate-500">
                Compartilhe com qualquer pessoa para coletar respostas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Target Form Info */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-start justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                Formulário Ativo
              </span>
              <h3 className="text-sm font-bold text-slate-900 mt-1">{form.title}</h3>
              <p className="text-xs text-slate-500">
                {form.sections.length} seções •{" "}
                {form.sections.reduce((acc, s) => acc + s.fields.length, 0)} perguntas
              </p>
            </div>
            {onOpenResponses && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenResponses();
                }}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
              >
                Ver respostas ({responseCount})
              </button>
            )}
          </div>

          {/* Shareable Link Box */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Link de Preenchimento Público
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  readOnly
                  value={shareableUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="bg-transparent text-xs sm:text-sm text-slate-800 outline-hidden w-full font-mono select-all"
                />
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
                  copied
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar Link</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              💡 Qualquer pessoa com este link acessará o formulário pronto para envio.
            </p>
          </div>

          {/* Quick Sharing Channels */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Compartilhar Direto
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 p-2.5 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold transition-colors"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span>WhatsApp</span>
              </a>

              <a
                href={emailUrl}
                className="flex items-center justify-center gap-2 p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                <Mail className="w-4 h-4 text-slate-500" />
                <span>E-mail</span>
              </a>

              <button
                type="button"
                onClick={() => setShowQr(!showQr)}
                className="flex items-center justify-center gap-2 p-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-semibold transition-colors col-span-2 sm:col-span-1"
              >
                <QrCode className="w-4 h-4 text-indigo-600" />
                <span>{showQr ? "Ocultar QR Code" : "Gerar QR Code"}</span>
              </button>
            </div>
          </div>

          {/* QR Code Display */}
          {showQr && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-2 animate-in fade-in">
              <p className="text-xs font-semibold text-slate-700">
                Aponte a câmera do celular para responder:
              </p>
              <div className="inline-block p-2 bg-white rounded-xl shadow-xs border border-slate-200">
                <img
                  src={qrImageUrl}
                  alt="QR Code para responder formulário"
                  className="w-44 h-44 mx-auto rounded-lg"
                  loading="lazy"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Ideal para impressos, apresentações e cartazes
              </p>
            </div>
          )}

          {/* Workflow Explanation Banner */}
          <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl text-xs text-indigo-950 space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-indigo-900">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Como funciona o fluxo de respostas:</span>
            </p>
            <p className="text-[11px] text-indigo-800 leading-relaxed">
              1. Envie este link para os respondentes desejados.
              <br />
              2. Ao preencherem e enviarem, as respostas são salvas <strong>automaticamente para este formulário</strong>.
              <br />
              3. Você poderá ver todas as respostas consolidadas e individuais clicando em <strong>"Ver respostas do formulário"</strong>.
            </p>
          </div>

          {/* Tagged Links Shortcut */}
          <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 bg-emerald-600 text-white rounded-lg shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-900">Precisa rastrear cliques por canal?</p>
                <p className="text-[11px] text-slate-600 truncate">
                  Crie múltiplos links tagueados (Link 1, Link 2) e gere a lista na Planilha do Google (Dia, Horário e Navegador).
                </p>
              </div>
            </div>
            {onOpenTaggedLinks && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenTaggedLinks();
                }}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg transition-colors shrink-0 shadow-2xs cursor-pointer"
              >
                Gerar Lista ↗
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenPreview();
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            <Eye className="w-4 h-4" />
            <span>Testar no Painel</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenDirect}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-colors shadow-2xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Abrir em Nova Aba</span>
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? "Copiado!" : "Copiar Link"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
