import React, { useState } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  Copy,
  ChevronUp,
  ChevronDown,
  Sliders,
  Clock,
  Sparkles,
  Layers,
  HelpCircle,
  CheckSquare,
  Radio,
  AlignLeft,
  Type,
  Mail,
  Phone,
  Hash,
  Calendar,
  Upload,
  Star,
  ShieldCheck,
  FileSpreadsheet,
  Palette,
  Image as ImageIcon,
  X,
  Check,
  Eye,
  SlidersHorizontal,
  Loader2,
  GitBranch,
  ExternalLink,
  ArrowRight,
  Link2
} from "lucide-react";
import { FormStructure, FormSection, FormField, FieldType, TaggedLink } from "../types";
import { getFieldConditionSummary, createFieldsMap } from "../utils/conditionalLogic";
import { TaggedLinksModal } from "./TaggedLinksModal";
import {
  resizeImageFile,
  PRESET_BACKGROUNDS,
  PRESET_LOGOS
} from "../utils/imageUtils";

interface FormEditorProps {
  form: FormStructure;
  onChange: (updated: FormStructure) => void;
  onOpenFieldEditor: (field: FormField | null, sectionId: string) => void;
  onOpenAiGenerator: () => void;
  onDeleteForm?: () => void;
}

const TYPE_ICONS: Record<FieldType, React.ElementType> = {
  text: Type,
  textarea: AlignLeft,
  radio: Radio,
  checkbox: CheckSquare,
  select: FileSpreadsheet,
  email: Mail,
  phone: Phone,
  number: Hash,
  date: Calendar,
  file: Upload,
  scale: Star,
  consent: ShieldCheck
};

const TYPE_LABELS: Record<FieldType, string> = {
  text: "Resposta curta",
  textarea: "Parágrafo",
  radio: "Múltipla escolha",
  checkbox: "Caixas de seleção",
  select: "Lista suspensa",
  email: "E-mail",
  phone: "Telefone / WhatsApp",
  number: "Número",
  date: "Data",
  file: "Upload / Link",
  scale: "Escala numérica",
  consent: "Termo de aceite"
};

export const FormEditor: React.FC<FormEditorProps> = ({
  form,
  onChange,
  onOpenFieldEditor,
  onOpenAiGenerator,
  onDeleteForm
}) => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [isOptimizingLogo, setIsOptimizingLogo] = useState(false);
  const [isOptimizingBg, setIsOptimizingBg] = useState(false);
  const [isTaggedModalOpen, setIsTaggedModalOpen] = useState(false);

  const fieldsMap = React.useMemo(() => createFieldsMap(form.sections), [form.sections]);

  // Update header metadata
  const handleUpdateMeta = (key: keyof FormStructure, value: any) => {
    onChange({
      ...form,
      [key]: value,
      updatedAt: new Date().toISOString()
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsOptimizingLogo(true);
    try {
      const dataUrl = await resizeImageFile(file, { maxWidth: 600, maxHeight: 300, quality: 0.85 });
      handleUpdateMeta("logoUrl", dataUrl);
    } catch (err) {
      console.error("Erro ao processar logo:", err);
      alert("Não foi possível carregar a imagem. Tente outro arquivo.");
    } finally {
      setIsOptimizingLogo(false);
    }
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsOptimizingBg(true);
    try {
      const dataUrl = await resizeImageFile(file, { maxWidth: 1600, maxHeight: 1000, quality: 0.80 });
      handleUpdateMeta("backgroundImage", dataUrl);
    } catch (err) {
      console.error("Erro ao processar imagem de fundo:", err);
      alert("Não foi possível carregar a imagem. Tente outro arquivo.");
    } finally {
      setIsOptimizingBg(false);
    }
  };

  // Section actions
  const handleAddSection = () => {
    const newSection: FormSection = {
      id: `sec_${Date.now()}`,
      title: `Novo Bloco ${form.sections.length + 1}`,
      description: "Descrição dos objetivos deste bloco de perguntas.",
      fields: []
    };
    onChange({
      ...form,
      sections: [...form.sections, newSection],
      updatedAt: new Date().toISOString()
    });
  };

  const handleUpdateSection = (sectionId: string, updates: Partial<FormSection>) => {
    const updatedSections = form.sections.map((s) =>
      s.id === sectionId ? { ...s, ...updates } : s
    );
    onChange({ ...form, sections: updatedSections, updatedAt: new Date().toISOString() });
  };

  const handleDeleteSection = (sectionId: string) => {
    if (form.sections.length <= 1) {
      alert("O formulário deve ter pelo menos uma seção.");
      return;
    }
    if (confirm("Tem certeza que deseja remover esta seção e todos os seus campos?")) {
      const updatedSections = form.sections.filter((s) => s.id !== sectionId);
      onChange({ ...form, sections: updatedSections, updatedAt: new Date().toISOString() });
    }
  };

  const handleMoveSection = (index: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= form.sections.length) return;

    const sections = [...form.sections];
    const temp = sections[index];
    sections[index] = sections[targetIdx];
    sections[targetIdx] = temp;

    onChange({ ...form, sections, updatedAt: new Date().toISOString() });
  };

  // Field actions
  const handleDeleteField = (sectionId: string, fieldId: string) => {
    const updatedSections = form.sections.map((sec) => {
      if (sec.id === sectionId) {
        return {
          ...sec,
          fields: sec.fields.filter((f) => f.id !== fieldId)
        };
      }
      return sec;
    });
    onChange({ ...form, sections: updatedSections, updatedAt: new Date().toISOString() });
  };

  const handleDuplicateField = (sectionId: string, field: FormField) => {
    const duplicatedField: FormField = {
      ...field,
      id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      label: `${field.label} (Cópia)`
    };

    const updatedSections = form.sections.map((sec) => {
      if (sec.id === sectionId) {
        const fieldIndex = sec.fields.findIndex((f) => f.id === field.id);
        const newFields = [...sec.fields];
        newFields.splice(fieldIndex + 1, 0, duplicatedField);
        return { ...sec, fields: newFields };
      }
      return sec;
    });
    onChange({ ...form, sections: updatedSections, updatedAt: new Date().toISOString() });
  };

  const handleMoveField = (sectionId: string, fieldIndex: number, direction: "up" | "down") => {
    const updatedSections = form.sections.map((sec) => {
      if (sec.id === sectionId) {
        const targetIdx = direction === "up" ? fieldIndex - 1 : fieldIndex + 1;
        if (targetIdx < 0 || targetIdx >= sec.fields.length) return sec;

        const newFields = [...sec.fields];
        const temp = newFields[fieldIndex];
        newFields[fieldIndex] = newFields[targetIdx];
        newFields[targetIdx] = temp;

        return { ...sec, fields: newFields };
      }
      return sec;
    });
    onChange({ ...form, sections: updatedSections, updatedAt: new Date().toISOString() });
  };

  const handleQuickAddField = (sectionId: string, type: FieldType) => {
    const defaultLabels: Record<FieldType, string> = {
      text: "Nova pergunta de resposta curta",
      textarea: "Nova pergunta detalhada (parágrafo)",
      radio: "Selecione uma das opções",
      checkbox: "Marque as opções aplicáveis",
      select: "Selecione uma opção",
      email: "E-mail para contato",
      phone: "Telefone / WhatsApp",
      number: "Quantidade ou valor numérico",
      date: "Data de referência",
      file: "Envio de links ou documentos",
      scale: "Em uma escala de 1 a 5, avalie sua experiência",
      consent: "Declaro que li e concordo com os termos"
    };

    const newField: FormField = {
      id: `field_${Date.now()}`,
      label: defaultLabels[type] || "Nova pergunta",
      type,
      required: false,
      options: ["radio", "checkbox", "select"].includes(type)
        ? ["Opção 1", "Opção 2", "Opção 3", "Outro"]
        : type === "consent"
        ? ["Li e estou de acordo."]
        : undefined,
      scaleMin: type === "scale" ? 1 : undefined,
      scaleMax: type === "scale" ? 5 : undefined
    };

    const updatedSections = form.sections.map((sec) => {
      if (sec.id === sectionId) {
        return { ...sec, fields: [...sec.fields, newField] };
      }
      return sec;
    });

    onChange({ ...form, sections: updatedSections, updatedAt: new Date().toISOString() });
  };

  const totalQuestions = form.sections.reduce((acc, s) => acc + s.fields.length, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Header Info Card */}
      <div className="bg-white rounded-3xl p-6 border-2 border-slate-300 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between border-b-2 border-slate-200 pb-3 gap-2">
          <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
            Título e mensagens
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span>{form.sections.length} Blocos</span>
              <span>•</span>
              <span>{totalQuestions} Perguntas</span>
            </div>
            {onDeleteForm && (
              <button
                type="button"
                onClick={onDeleteForm}
                className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 font-bold flex items-center gap-1.5 transition-colors"
                title="Excluir este formulário permanentemente"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir Formulário</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Título do Formulário *
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => handleUpdateMeta("title", e.target.value)}
              placeholder="Ex: Formulário de Diagnóstico"
              className="w-full p-3 text-base font-bold text-slate-900 bg-slate-50 border-2 border-slate-300 rounded-xl focus:bg-white focus:border-indigo-600"
            />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              <span>Tempo Estimado</span>
            </label>
            <input
              type="text"
              value={form.estimatedTime || ""}
              onChange={(e) => handleUpdateMeta("estimatedTime", e.target.value)}
              placeholder="Ex: 5 a 10 minutos"
              className="w-full p-3 text-sm text-slate-800 bg-slate-50 border-2 border-slate-300 rounded-xl focus:bg-white focus:border-indigo-600"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Subtítulo / Objetivo
          </label>
          <input
            type="text"
            value={form.subtitle || ""}
            onChange={(e) => handleUpdateMeta("subtitle", e.target.value)}
            placeholder="Ex: Preencha as informações para alinhamento"
            className="w-full p-2.5 text-sm text-slate-800 bg-slate-50 border-2 border-slate-300 rounded-xl focus:bg-white focus:border-indigo-600"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Mensagem de Abertura / Orientações Iniciais
          </label>
          <textarea
            rows={2}
            value={form.openingMessage || ""}
            onChange={(e) => handleUpdateMeta("openingMessage", e.target.value)}
            placeholder="Ex: Este formulário tem como finalidade coletar dados essenciais..."
            className="w-full p-2.5 text-xs sm:text-sm text-slate-700 bg-slate-50 border-2 border-slate-300 rounded-xl focus:bg-white focus:border-indigo-600"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Mensagem de Agradecimento Pós-Envio
          </label>
          <input
            type="text"
            value={form.closingMessage || ""}
            onChange={(e) => handleUpdateMeta("closingMessage", e.target.value)}
            placeholder="Ex: Suas respostas foram computadas com sucesso!"
            className="w-full p-2.5 text-xs sm:text-sm text-slate-700 bg-slate-50 border-2 border-slate-300 rounded-xl focus:bg-white focus:border-indigo-600"
          />
        </div>

      </div>

      {/* Sections List */}
      <div className="space-y-6">
        {form.sections.map((section, sIdx) => (
          <div
            key={section.id}
            id={`section-${section.id}`}
            className="bg-white rounded-3xl border-2 border-slate-300 shadow-xs overflow-hidden transition-all"
          >
            {/* Section Header */}
            <div className="p-4 sm:p-5 bg-slate-50 border-b-2 border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {sIdx + 1}
                  </span>
                  <input
                    type="text"
                    value={section.title}
                    onChange={(e) => handleUpdateSection(section.id, { title: e.target.value })}
                    placeholder="Título da Seção / Bloco"
                    className="text-base font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white px-1.5 py-0.5 rounded-sm outline-hidden flex-1"
                  />
                </div>
                <input
                  type="text"
                  value={section.description || ""}
                  onChange={(e) => handleUpdateSection(section.id, { description: e.target.value })}
                  placeholder="Descrição ou orientações para esta seção..."
                  className="w-full text-xs text-slate-500 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white px-1.5 py-0.5 rounded-sm outline-hidden"
                />
              </div>

              {/* Section Actions */}
              <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  disabled={sIdx === 0}
                  onClick={() => handleMoveSection(sIdx, "up")}
                  className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded-lg hover:bg-slate-200/60"
                  title="Mover seção para cima"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={sIdx === form.sections.length - 1}
                  onClick={() => handleMoveSection(sIdx, "down")}
                  className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded-lg hover:bg-slate-200/60"
                  title="Mover seção para baixo"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteSection(section.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                  title="Excluir seção"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Section Fields */}
            <div className="p-4 sm:p-5 space-y-3">
              {section.fields.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <p className="text-xs text-slate-500 mb-3">Esta seção ainda não tem nenhum campo.</p>
                  <button
                    type="button"
                    onClick={() => onOpenFieldEditor(null, section.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Primeiro Campo
                  </button>
                </div>
              ) : (
                section.fields.map((field, fIdx) => {
                  const Icon = TYPE_ICONS[field.type] || Type;
                  const conditionSummary = getFieldConditionSummary(field, fieldsMap);
                  const isConditional = field.conditionalLogic?.enabled;

                  return (
                    <div
                      key={field.id}
                      className={`p-3.5 border rounded-xl transition-all group ${
                        isConditional
                          ? "bg-purple-50/40 hover:bg-purple-50/70 border-purple-200"
                          : "bg-slate-50/70 hover:bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <span className="text-xs font-bold text-slate-400 w-5 pt-0.5">
                            {fIdx + 1}.
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-medium text-slate-700 shadow-2xs">
                                <Icon className="w-3 h-3 text-indigo-600" />
                                <span>{TYPE_LABELS[field.type] || field.type}</span>
                              </span>
                              {field.required && (
                                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                  Obrigatória
                                </span>
                              )}
                              {conditionSummary && (
                                <button
                                  type="button"
                                  onClick={() => onOpenFieldEditor(field, section.id)}
                                  className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-100/90 hover:bg-purple-200 px-2 py-0.5 rounded-md border border-purple-300 transition-colors shadow-2xs"
                                  title="Clique para editar as regras de exibição condicional deste campo"
                                >
                                  <GitBranch className="w-3 h-3 text-purple-600 shrink-0" />
                                  <span className="truncate max-w-[260px]">{conditionSummary}</span>
                                </button>
                              )}
                            </div>

                            <p className="text-sm font-bold text-slate-900 leading-snug">
                              {field.label}
                            </p>

                            {field.helpText && (
                              <p className="text-xs text-slate-500 italic mt-1 flex items-start gap-1">
                                <HelpCircle className="w-3 h-3 shrink-0 mt-0.5 text-slate-400" />
                                <span>{field.helpText}</span>
                              </p>
                            )}

                            {field.options && field.options.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {field.options.map((opt, oIdx) => (
                                  <span
                                    key={oIdx}
                                    className="text-[11px] bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md"
                                  >
                                    {opt}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Field Actions */}
                        <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => onOpenFieldEditor(field, section.id)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isConditional
                                ? "text-purple-700 bg-purple-100 hover:bg-purple-200"
                                : "text-slate-400 hover:text-purple-600 hover:bg-white"
                            }`}
                            title={isConditional ? "Editar lógica condicional (ativa)" : "Configurar lógica condicional"}
                          >
                            <GitBranch className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenFieldEditor(field, section.id)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors"
                            title="Editar campo personalizado"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicateField(section.id, field)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors"
                            title="Duplicar campo"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={fIdx === 0}
                            onClick={() => handleMoveField(section.id, fIdx, "up")}
                            className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-25 hover:bg-white rounded-lg"
                            title="Mover para cima"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={fIdx === section.fields.length - 1}
                            onClick={() => handleMoveField(section.id, fIdx, "down")}
                            className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-25 hover:bg-white rounded-lg"
                            title="Mover para baixo"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteField(section.id, field.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Excluir campo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Add Custom Field Toolbar */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => onOpenFieldEditor(null, section.id)}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Novo Campo Personalizado</span>
                </button>

                {/* Quick One-Click Types */}
                <div className="flex items-center gap-1 overflow-x-auto py-1">
                  <span className="text-[11px] text-slate-400 font-medium hidden sm:inline mr-1">
                    Adicionar rápido:
                  </span>
                  <button
                    type="button"
                    onClick={() => handleQuickAddField(section.id, "text")}
                    className="px-2 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium shrink-0"
                  >
                    + Texto
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAddField(section.id, "textarea")}
                    className="px-2 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium shrink-0"
                  >
                    + Parágrafo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAddField(section.id, "radio")}
                    className="px-2 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium shrink-0"
                  >
                    + Múltipla Escolha
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAddField(section.id, "checkbox")}
                    className="px-2 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium shrink-0"
                  >
                    + Caixas de Seleção
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAddField(section.id, "consent")}
                    className="px-2 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium shrink-0"
                  >
                    + Termo
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Add Section Button */}
        <button
          type="button"
          onClick={handleAddSection}
          className="w-full py-4 border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/20 text-slate-600 hover:text-indigo-700 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Adicionar Novo Bloco / Seção ao Formulário</span>
        </button>
      </div>

      {/* Mais opções: e-mail automático, redirecionamento, links e visual (fechado por padrão) */}
      <details className="group bg-white rounded-3xl border-2 border-slate-300 shadow-xs">
        <summary className="cursor-pointer list-none p-5 flex items-center justify-between gap-3 select-none">
          <div>
            <span className="block text-sm font-bold text-slate-900">Mais opções do formulário</span>
            <span className="block text-xs text-slate-500">E-mail automático, redirecionamento no final, links rastreados e visual</span>
          </div>
          <span className="text-xs font-bold text-indigo-700 group-open:hidden">Abrir</span>
          <span className="text-xs font-bold text-indigo-700 hidden group-open:inline">Fechar</span>
        </summary>
        <div className="p-4 sm:p-5 pt-0 space-y-6">
      <div className="bg-white rounded-3xl p-6 border-2 border-slate-300 shadow-xs space-y-3">
        {/* Resposta Automática por E-mail */}
        <div className="pt-2 border-t-2 border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Resposta Automática por E-mail
                </h4>
                <p className="text-[11px] text-slate-500">
                  Dispara uma confirmação personalizada ao respondente usando o campo de e-mail identificado.
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.autoReply?.enabled !== false}
                onChange={(e) => {
                  const current = form.autoReply || { enabled: true };
                  handleUpdateMeta("autoReply", { ...current, enabled: e.target.checked });
                }}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {form.autoReply?.enabled !== false && (
            <div className="p-3.5 bg-indigo-50/50 border-2 border-indigo-200 rounded-2xl space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Nome do Remetente</label>
                  <input
                    type="text"
                    value={form.autoReply?.senderName || ""}
                    onChange={(e) => {
                      const current = form.autoReply || { enabled: true };
                      handleUpdateMeta("autoReply", { ...current, senderName: e.target.value });
                    }}
                    placeholder={form.title || "Nome da sua empresa / equipe"}
                    className="w-full p-2 bg-white border-2 border-slate-300 rounded-lg text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Assunto do E-mail</label>
                  <input
                    type="text"
                    value={form.autoReply?.subject || ""}
                    onChange={(e) => {
                      const current = form.autoReply || { enabled: true };
                      handleUpdateMeta("autoReply", { ...current, subject: e.target.value });
                    }}
                    placeholder={`Confirmação de recebimento: ${form.title || "Formulário"}`}
                    className="w-full p-2 bg-white border-2 border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">
                  Mensagem Personalizada no Corpo do E-mail
                </label>
                <textarea
                  rows={2}
                  value={form.autoReply?.customMessage || ""}
                  onChange={(e) => {
                    const current = form.autoReply || { enabled: true };
                    handleUpdateMeta("autoReply", { ...current, customMessage: e.target.value });
                  }}
                  placeholder="Olá, {{name}}! Confirmamos o recebimento das suas respostas para o formulário. Segue o protocolo de atendimento e resumo das informações enviadas."
                  className="w-full p-2 bg-white border-2 border-slate-300 rounded-lg text-slate-800"
                />
                <p className="text-[10px] text-slate-500">
                  Tags suportadas: <code className="bg-white px-1 py-0.5 rounded border border-slate-200">{"{{name}}"}</code> para o nome do respondente, <code className="bg-white px-1 py-0.5 rounded border border-slate-200">{"{{formTitle}}"}</code> para o título e <code className="bg-white px-1 py-0.5 rounded border border-slate-200">{"{{protocolo}}"}</code> para o número de protocolo.
                </p>
              </div>

              <div className="pt-1 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="includeAnswersSummary"
                  checked={form.autoReply?.includeAnswersSummary !== false}
                  onChange={(e) => {
                    const current = form.autoReply || { enabled: true };
                    handleUpdateMeta("autoReply", { ...current, includeAnswersSummary: e.target.checked });
                  }}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="includeAnswersSummary" className="text-slate-700 font-medium cursor-pointer">
                  Anexar resumo detalhado das respostas no e-mail de confirmação
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Redirecionamento Automático Pós-Envio Card */}
      <div className="bg-white rounded-3xl p-6 border-2 border-slate-300 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b-2 border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg">
              <ExternalLink className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Redirecionamento Automático Pós-Envio
              </h3>
              <p className="text-[11px] text-slate-500">
                Encaminhe o respondente automaticamente para qualquer link desejado após o envio.
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={form.redirectConfig?.enabled === true}
              onChange={(e) => {
                const current = form.redirectConfig || {
                  enabled: false,
                  url: "",
                  delaySeconds: 3,
                  buttonText: "Ir para o link agora"
                };
                handleUpdateMeta("redirectConfig", {
                  ...current,
                  enabled: e.target.checked
                });
              }}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>

        {form.redirectConfig?.enabled && (
          <div className="p-4 bg-emerald-50/50 border-2 border-emerald-200 rounded-2xl space-y-3 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-800 flex items-center justify-between">
                <span>Link / URL de Destino para Redirecionamento</span>
                <span className="text-[10px] text-emerald-700 font-semibold">Obrigatório com http:// ou https://</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={form.redirectConfig?.url || ""}
                  onChange={(e) => {
                    const current = form.redirectConfig || { enabled: true, url: "" };
                    handleUpdateMeta("redirectConfig", { ...current, url: e.target.value });
                  }}
                  placeholder="Ex: https://seusite.com.br, https://wa.me/5511999999999 ou link de confirmação..."
                  className="w-full p-2.5 bg-white border-2 border-slate-300 focus:border-emerald-600 rounded-xl text-slate-900"
                />
                {form.redirectConfig?.url && (
                  <a
                    href={form.redirectConfig.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 bg-white border-2 border-slate-300 text-slate-600 hover:text-emerald-700 hover:border-emerald-500 rounded-xl transition-colors shrink-0"
                    title="Testar link em nova aba"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Tempo de Espera antes do Redirecionamento */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Tempo de Espera antes de Encaminhar</span>
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: "Imediato (0s)", value: 0 },
                    { label: "3 seg", value: 3 },
                    { label: "5 seg", value: 5 },
                    { label: "10 seg", value: 10 }
                  ].map((opt) => {
                    const isSelected = (form.redirectConfig?.delaySeconds ?? 3) === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          const current = form.redirectConfig || { enabled: true, url: "" };
                          handleUpdateMeta("redirectConfig", { ...current, delaySeconds: opt.value });
                        }}
                        className={`p-2 rounded-xl text-center text-xs font-bold border transition-all ${
                          isSelected
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Texto do Botão */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-800">
                  Texto do Botão Direto (Opcional)
                </label>
                <input
                  type="text"
                  value={form.redirectConfig?.buttonText || ""}
                  onChange={(e) => {
                    const current = form.redirectConfig || { enabled: true, url: "" };
                    handleUpdateMeta("redirectConfig", { ...current, buttonText: e.target.value });
                  }}
                  placeholder="Ir para o link agora"
                  className="w-full p-2.5 bg-white border-2 border-slate-300 focus:border-emerald-600 rounded-xl text-slate-900"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="redirectNewTab"
                checked={form.redirectConfig?.openInNewTab === true}
                onChange={(e) => {
                  const current = form.redirectConfig || { enabled: true, url: "" };
                  handleUpdateMeta("redirectConfig", { ...current, openInNewTab: e.target.checked });
                }}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="redirectNewTab" className="text-slate-700 font-medium cursor-pointer">
                Abrir link em nova aba (mantém o comprovante de envio aberto nesta tela)
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Links Tagueados & Rastreamento de Cliques Card */}
      <div className="bg-white rounded-3xl p-6 border-2 border-slate-300 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between border-b-2 border-slate-200 pb-3 gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Links Tagueados & Rastreamento de Cliques
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  Google Planilhas / Excel
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Crie links individuais (Link 1, Link 2) que registram Horário, Navegador e Dia de cada clique.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsTaggedModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>Gerar Lista de Tagueamento</span>
          </button>
        </div>

        {/* Tagged Links Preview Pill Box */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-700">
              Links configurados para este formulário: ({(form.taggedLinks || []).length})
            </span>
            <button
              type="button"
              onClick={() => setIsTaggedModalOpen(true)}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline"
            >
              + Gerenciar e Criar Novos Links
            </button>
          </div>

          {(form.taggedLinks || []).length === 0 ? (
            <div className="text-center py-4 bg-white rounded-xl border border-dashed border-slate-300 text-xs text-slate-500">
              Nenhum link tagueado criado ainda. Clique em <strong>"Gerar Lista de Tagueamento"</strong> para criar "Link tagueado 1", "Link tagueado 2" e sincronizar com sua planilha do Google.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(form.taggedLinks || []).map((tag, idx) => (
                <div
                  key={tag.id}
                  className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-2xs"
                >
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-900 block truncate">
                      {tag.name || `Link ${idx + 1}`}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      tag={tag.id}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsTaggedModalOpen(true)}
                    className="text-xs text-emerald-700 font-bold hover:underline shrink-0"
                  >
                    Ver Cliques & Planilha ↗
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Personalização Visual & Apresentação Card */}
      <div className="bg-white rounded-3xl p-6 border-2 border-slate-300 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between border-b-2 border-slate-200 pb-3 gap-2">
          <div className="flex items-center gap-2">
            <div
              className="p-1.5 rounded-lg text-white"
              style={{ backgroundColor: form.themeColor || "#4f46e5" }}
            >
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Personalização Visual & Apresentação
              </h3>
              <p className="text-[11px] text-slate-500">
                Defina a cor temática, imagem de fundo, logotipo superior e o modo interativo.
              </p>
            </div>
          </div>

          <span
            className="px-2.5 py-1 text-[11px] font-bold rounded-full border flex items-center gap-1.5"
            style={{
              backgroundColor: `${form.themeColor || "#4f46e5"}15`,
              color: form.themeColor || "#4f46e5",
              borderColor: `${form.themeColor || "#4f46e5"}40`
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: form.themeColor || "#4f46e5" }}
            />
            <span>{form.themeColor || "#4f46e5"}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Coluna 1: Cor de Destaque & Modo de Exibição */}
          <div className="space-y-4">
            {/* Cor Personalizada */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-slate-600" />
                <span>Cor Personalizada do Formulário</span>
              </label>

              {/* Paleta rápida */}
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { name: "Índigo", color: "#4f46e5" },
                  { name: "Azul Real", color: "#2563eb" },
                  { name: "Oceano", color: "#0891b2" },
                  { name: "Esmeralda", color: "#059669" },
                  { name: "Âmbar", color: "#d97706" },
                  { name: "Rubi", color: "#e11d48" },
                  { name: "Violeta", color: "#7c3aed" },
                  { name: "Grafite", color: "#0f172a" }
                ].map((p) => {
                  const isSelected = (form.themeColor || "#4f46e5").toLowerCase() === p.color.toLowerCase();
                  return (
                    <button
                      key={p.color}
                      type="button"
                      onClick={() => handleUpdateMeta("themeColor", p.color)}
                      title={p.name}
                      className={`w-7 h-7 rounded-full transition-transform flex items-center justify-center border-2 ${
                        isSelected ? "scale-115 border-slate-900 shadow-md ring-2 ring-slate-400/50" : "border-white shadow-2xs hover:scale-105"
                      }`}
                      style={{ backgroundColor: p.color }}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                    </button>
                  );
                })}

                {/* Seletor Customizado Hex */}
                <div className="flex items-center gap-1.5 ml-1 pl-2 border-l border-slate-200">
                  <input
                    type="color"
                    value={form.themeColor || "#4f46e5"}
                    onChange={(e) => handleUpdateMeta("themeColor", e.target.value)}
                    className="w-7 h-7 rounded-lg border-2 border-slate-300 cursor-pointer p-0 bg-transparent"
                    title="Escolher qualquer cor hexadecimal"
                  />
                  <input
                    type="text"
                    value={form.themeColor || "#4f46e5"}
                    onChange={(e) => handleUpdateMeta("themeColor", e.target.value)}
                    placeholder="#4f46e5"
                    className="w-20 p-1.5 text-xs font-mono font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-lg text-center"
                  />
                </div>
              </div>
            </div>

            {/* Modo de Exibição das Perguntas */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
                <span>Dinâmica das Perguntas</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleUpdateMeta("displayMode", "step-by-step")}
                  className={`p-3 rounded-2xl text-left border-2 transition-all ${
                    (form.displayMode || "step-by-step") === "step-by-step"
                      ? "bg-indigo-50/70 border-indigo-500 shadow-xs"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100/70"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900">Passo a Passo</span>
                    {(form.displayMode || "step-by-step") === "step-by-step" && (
                      <Check className="w-3.5 h-3.5 text-indigo-600 font-bold" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    A cada pergunta respondida, surge a próxima de forma focada e dinâmica.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleUpdateMeta("displayMode", "all-at-once")}
                  className={`p-3 rounded-2xl text-left border-2 transition-all ${
                    form.displayMode === "all-at-once"
                      ? "bg-indigo-50/70 border-indigo-500 shadow-xs"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100/70"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900">Todas de Uma Vez</span>
                    {form.displayMode === "all-at-once" && (
                      <Check className="w-3.5 h-3.5 text-indigo-600 font-bold" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Exibe todas as perguntas em formato contínuo de rolagem na página.
                  </p>
                </button>
              </div>
            </div>
          </div>

          {/* Coluna 2: Logo Superior & Imagem de Fundo */}
          <div className="space-y-4">
            {/* Logotipo Superior */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-slate-600" />
                  <span>Logotipo da Marca (Topo)</span>
                </label>
                {form.logoUrl && (
                  <button
                    type="button"
                    onClick={() => handleUpdateMeta("logoUrl", undefined)}
                    className="text-[11px] text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    <span>Remover Logo</span>
                  </button>
                )}
              </div>

              {form.logoUrl ? (
                <div className="p-3 bg-slate-50 border-2 border-slate-200 rounded-2xl flex items-center gap-3">
                  <div className="w-16 h-14 bg-white border border-slate-300 rounded-xl p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                    <img
                      src={form.logoUrl}
                      alt="Logo Preview"
                      referrerPolicy="no-referrer"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-xs font-bold text-slate-900">Logotipo ativo</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-slate-500">Posição:</span>
                      {(["left", "center", "right"] as const).map((pos) => (
                        <button
                          key={pos}
                          type="button"
                          onClick={() => handleUpdateMeta("logoPosition", pos)}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${
                            (form.logoPosition || "center") === pos
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {pos === "left" ? "Esquerda" : pos === "center" ? "Centro" : "Direita"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <label className="flex-1 cursor-pointer py-2.5 px-3 bg-slate-50 hover:bg-slate-100 border-2 border-dashed border-slate-300 rounded-xl text-center text-xs font-bold text-slate-700 transition-colors flex items-center justify-center gap-2">
                      {isOptimizingLogo ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                          <span>Otimizando imagem...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Upload do Logo (Câmera / Arquivo)</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isOptimizingLogo}
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                    </label>
                  </div>
                  <input
                    type="url"
                    placeholder="Ou cole a URL da imagem do logo..."
                    onChange={(e) => {
                      if (e.target.value.trim().startsWith("http") || e.target.value.trim().startsWith("data:image")) {
                        handleUpdateMeta("logoUrl", e.target.value.trim());
                      }
                    }}
                    className="w-full p-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:bg-white"
                  />
                  {/* Presets Rápidos de Logo */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Modelos:</span>
                    {PRESET_LOGOS.map((pl) => (
                      <button
                        key={pl.id}
                        type="button"
                        onClick={() => handleUpdateMeta("logoUrl", pl.url)}
                        className="text-[10px] text-indigo-700 hover:text-indigo-900 font-bold bg-indigo-50/80 hover:bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200 transition-colors"
                      >
                        {pl.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Imagem de Fundo */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-slate-600" />
                  <span>Imagem de Fundo</span>
                </label>
                {form.backgroundImage && (
                  <button
                    type="button"
                    onClick={() => handleUpdateMeta("backgroundImage", undefined)}
                    className="text-[11px] text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    <span>Remover Fundo</span>
                  </button>
                )}
              </div>

              {form.backgroundImage ? (
                <div className="p-3 bg-slate-50 border-2 border-slate-200 rounded-2xl space-y-2.5">
                  <div className="relative h-16 rounded-xl overflow-hidden border border-slate-300">
                    <img
                      src={form.backgroundImage}
                      alt="Background Preview"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-2xs flex items-center justify-center text-white text-[11px] font-bold">
                      Fundo Configurado
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                    <span className="text-slate-600 font-medium">Contraste / Overlay:</span>
                    <div className="flex items-center gap-1">
                      {[
                        { id: "light", label: "Claro Suave" },
                        { id: "dark", label: "Escuro" },
                        { id: "none", label: "Sem Filtro" }
                      ].map((ov) => (
                        <button
                          key={ov.id}
                          type="button"
                          onClick={() => handleUpdateMeta("backgroundOverlay", ov.id)}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${
                            (form.backgroundOverlay || "light") === ov.id
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {ov.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <label className="flex-1 cursor-pointer py-2.5 px-3 bg-slate-50 hover:bg-slate-100 border-2 border-dashed border-slate-300 rounded-xl text-center text-xs font-bold text-slate-700 transition-colors flex items-center justify-center gap-2">
                      {isOptimizingBg ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                          <span>Otimizando imagem...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Upload de Fundo (Foto / Arquivo)</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isOptimizingBg}
                        className="hidden"
                        onChange={handleBgUpload}
                      />
                    </label>
                  </div>
                  <input
                    type="url"
                    placeholder="Ou cole a URL da imagem de fundo..."
                    onChange={(e) => {
                      if (e.target.value.trim().startsWith("http") || e.target.value.trim().startsWith("data:image")) {
                        handleUpdateMeta("backgroundImage", e.target.value.trim());
                      }
                    }}
                    className="w-full p-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:bg-white"
                  />
                  {/* Presets Rápidos de Fundo */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Presets:</span>
                    {PRESET_BACKGROUNDS.map((pb) => (
                      <button
                        key={pb.id}
                        type="button"
                        onClick={() => handleUpdateMeta("backgroundImage", pb.url)}
                        className="text-[10px] text-indigo-700 hover:text-indigo-900 font-bold bg-indigo-50/80 hover:bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200 transition-colors"
                      >
                        {pb.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

        </div>
      </details>

      {/* Modal de Links Tagueados e Planilha do Google */}
      <TaggedLinksModal
        isOpen={isTaggedModalOpen}
        onClose={() => setIsTaggedModalOpen(false)}
        form={form}
        onUpdateForm={onChange}
      />
    </div>
  );
};
