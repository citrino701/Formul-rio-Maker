import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Plus,
  Trash2,
  ListPlus,
  Sliders,
  HelpCircle,
  CheckCircle2,
  Type,
  AlignLeft,
  CheckSquare,
  Radio,
  List,
  Mail,
  Phone,
  Hash,
  Calendar,
  Upload,
  Star,
  ShieldCheck,
  GitBranch,
  Eye,
  EyeOff,
  Zap
} from "lucide-react";
import { FormField, FieldType, FormSection, FieldCondition, ConditionalLogic, ConditionOperator } from "../types";
import { OPERATOR_LABELS, getFieldConditionSummary, createFieldsMap } from "../utils/conditionalLogic";

interface FieldEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (field: FormField, sectionId: string) => void;
  initialField?: FormField | null;
  currentSectionId: string;
  sections: FormSection[];
}

const FIELD_TYPES: { type: FieldType; label: string; icon: React.ElementType; description: string }[] = [
  { type: "text", label: "Resposta curta", icon: Type, description: "Nomes, cargos, cidades, links curtos" },
  { type: "textarea", label: "Parágrafo / Texto longo", icon: AlignLeft, description: "Descrições, percepções, respostas detalhadas" },
  { type: "radio", label: "Múltipla escolha (Única)", icon: Radio, description: "Apenas uma alternativa selecionável" },
  { type: "checkbox", label: "Caixas de seleção (Múltipla)", icon: CheckSquare, description: "Permite marcar uma ou várias opções" },
  { type: "select", label: "Lista suspensa (Dropdown)", icon: List, description: "Seleção em menu recolhido" },
  { type: "email", label: "E-mail", icon: Mail, description: "Validação de endereço de e-mail" },
  { type: "phone", label: "Telefone / WhatsApp", icon: Phone, description: "Número de contato" },
  { type: "number", label: "Número", icon: Hash, description: "Valores quantitativos e quantidades" },
  { type: "date", label: "Data", icon: Calendar, description: "Seletor de dia, mês e ano" },
  { type: "file", label: "Upload / Link de arquivo", icon: Upload, description: "Envio de arquivos ou link do Drive/Dropbox" },
  { type: "scale", label: "Escala de avaliação (NPS/CSAT)", icon: Star, description: "Notas de 0 a 10 ou 1 a 5" },
  { type: "consent", label: "Termo de aceite / Confirmação", icon: ShieldCheck, description: "Autorização de confidencialidade e regras" }
];

export const FieldEditorModal: React.FC<FieldEditorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialField,
  currentSectionId,
  sections
}) => {
  const [targetSectionId, setTargetSectionId] = useState(currentSectionId);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [required, setRequired] = useState(false);
  const [placeholder, setPlaceholder] = useState("");
  const [helpText, setHelpText] = useState("");
  const [options, setOptions] = useState<string[]>(["Opção 1", "Opção 2"]);
  const [newOptionInput, setNewOptionInput] = useState("");
  const [scaleMin, setScaleMin] = useState(1);
  const [scaleMax, setScaleMax] = useState(5);
  const [minLabel, setMinLabel] = useState("");
  const [maxLabel, setMaxLabel] = useState("");
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkText, setBulkText] = useState("");

  // Conditional Logic state
  const [hasConditionalLogic, setHasConditionalLogic] = useState(false);
  const [conditionalAction, setConditionalAction] = useState<"show" | "hide">("show");
  const [conditionalMatchType, setConditionalMatchType] = useState<"all" | "any">("all");
  const [conditionalRules, setConditionalRules] = useState<FieldCondition[]>([
    { fieldId: "", operator: "equals", value: "" }
  ]);

  // Candidate fields across all sections in the form (excluding the field being edited)
  const candidateFields = useMemo(() => {
    const list: { field: FormField; sectionTitle: string }[] = [];
    sections.forEach((sec) => {
      sec.fields.forEach((f) => {
        if (!initialField || f.id !== initialField.id) {
          list.push({ field: f, sectionTitle: sec.title });
        }
      });
    });
    return list;
  }, [sections, initialField]);

  // Lookup map for fast field inspection
  const allFieldsMap = useMemo(() => {
    return createFieldsMap(sections);
  }, [sections]);

  useEffect(() => {
    if (initialField) {
      setLabel(initialField.label || "");
      setType(initialField.type || "text");
      setRequired(Boolean(initialField.required));
      setPlaceholder(initialField.placeholder || "");
      setHelpText(initialField.helpText || "");
      setOptions(initialField.options && initialField.options.length > 0 ? [...initialField.options] : ["Opção 1", "Opção 2"]);
      setScaleMin(initialField.scaleMin ?? 1);
      setScaleMax(initialField.scaleMax ?? 5);
      setMinLabel(initialField.minLabel || "");
      setMaxLabel(initialField.maxLabel || "");

      if (initialField.conditionalLogic?.enabled) {
        setHasConditionalLogic(true);
        setConditionalAction(initialField.conditionalLogic.action || "show");
        setConditionalMatchType(initialField.conditionalLogic.matchType || "all");
        setConditionalRules(
          initialField.conditionalLogic.rules && initialField.conditionalLogic.rules.length > 0
            ? initialField.conditionalLogic.rules.map((r) => ({ ...r }))
            : [{ fieldId: candidateFields[0]?.field.id || "", operator: "equals", value: "" }]
        );
      } else {
        setHasConditionalLogic(false);
        setConditionalAction("show");
        setConditionalMatchType("all");
        setConditionalRules([{ fieldId: candidateFields[0]?.field.id || "", operator: "equals", value: "" }]);
      }
    } else {
      setLabel("");
      setType("text");
      setRequired(false);
      setPlaceholder("");
      setHelpText("");
      setOptions(["Opção 1", "Opção 2"]);
      setScaleMin(1);
      setScaleMax(5);
      setMinLabel("");
      setMaxLabel("");
      setHasConditionalLogic(false);
      setConditionalAction("show");
      setConditionalMatchType("all");
      setConditionalRules([{ fieldId: candidateFields[0]?.field.id || "", operator: "equals", value: "" }]);
    }
    setTargetSectionId(currentSectionId);
  }, [initialField, currentSectionId, isOpen, candidateFields]);

  if (!isOpen) return null;

  const handleAddOption = () => {
    if (newOptionInput.trim()) {
      setOptions([...options, newOptionInput.trim()]);
      setNewOptionInput("");
    }
  };

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleUpdateOption = (index: number, val: string) => {
    const updated = [...options];
    updated[index] = val;
    setOptions(updated);
  };

  const handleApplyBulkOptions = () => {
    const lines = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length > 0) {
      setOptions(lines);
      setShowBulkAdd(false);
      setBulkText("");
    }
  };

  // Handlers for conditional rules
  const handleAddRule = () => {
    const firstId = candidateFields[0]?.field.id || "";
    setConditionalRules([
      ...conditionalRules,
      { fieldId: firstId, operator: "equals", value: "" }
    ]);
  };

  const handleRemoveRule = (index: number) => {
    if (conditionalRules.length <= 1) {
      setConditionalRules([{ fieldId: "", operator: "equals", value: "" }]);
    } else {
      setConditionalRules(conditionalRules.filter((_, idx) => idx !== index));
    }
  };

  const handleUpdateRule = (index: number, updates: Partial<FieldCondition>) => {
    const updated = [...conditionalRules];
    const prevFieldId = updated[index].fieldId;
    updated[index] = { ...updated[index], ...updates };

    // When changing target field, automatically prefill sensible default value
    if (updates.fieldId && updates.fieldId !== prevFieldId) {
      const target = allFieldsMap.get(updates.fieldId);
      if (target?.options && target.options.length > 0) {
        updated[index].value = target.options[0];
      } else if (target?.type === "consent") {
        updated[index].value = "true";
      } else {
        updated[index].value = "";
      }
    }

    setConditionalRules(updated);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;

    const validRules = conditionalRules.filter(
      (r) => r.fieldId && r.fieldId.trim() !== ""
    );

    const savedField: FormField = {
      id: initialField?.id || `field_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      label: label.trim(),
      type,
      required,
      placeholder: placeholder.trim() || undefined,
      helpText: helpText.trim() || undefined,
      options: ["radio", "checkbox", "select", "consent"].includes(type) ? options : undefined,
      scaleMin: type === "scale" ? scaleMin : undefined,
      scaleMax: type === "scale" ? scaleMax : undefined,
      minLabel: type === "scale" ? minLabel.trim() || undefined : undefined,
      maxLabel: type === "scale" ? maxLabel.trim() || undefined : undefined,
      conditionalLogic:
        hasConditionalLogic && validRules.length > 0
          ? {
              enabled: true,
              action: conditionalAction,
              matchType: conditionalMatchType,
              rules: validRules
            }
          : undefined
    };

    onSave(savedField, targetSectionId);
    onClose();
  };

  const hasOptions = ["radio", "checkbox", "select", "consent"].includes(type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {initialField ? "Editar Campo Personalizado" : "Novo Campo Personalizado"}
              </h3>
              <p className="text-xs text-slate-500">
                Defina a pergunta, tipo de entrada e configurações de validação
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

        {/* Modal Body Form */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Target Section */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Seção / Bloco do Formulário
            </label>
            <select
              value={targetSectionId}
              onChange={(e) => setTargetSectionId(e.target.value)}
              className="w-full p-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-800"
            >
              {sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.title}
                </option>
              ))}
            </select>
          </div>

          {/* Question / Label */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Pergunta / Título do Campo *
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex: Em que estágio a empresa está hoje?"
              className="w-full p-3 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium"
              required
            />
          </div>

          {/* Field Type Selection Grid */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Tipo do Campo
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {FIELD_TYPES.map((item) => {
                const Icon = item.icon;
                const isSelected = type === item.type;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setType(item.type)}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "bg-indigo-50/70 border-indigo-500 text-indigo-900 ring-1 ring-indigo-500"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${isSelected ? "text-indigo-600" : "text-slate-400"}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{item.label}</p>
                      <p className="text-[10px] text-slate-400 line-clamp-1">{item.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Required Toggle */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <p className="text-sm font-semibold text-slate-800">Preenchimento Obrigatório</p>
              <p className="text-xs text-slate-500">
                O respondente não poderá enviar o formulário sem preencher este campo
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Options Management (for Radio, Checkbox, Select, Consent) */}
          {hasOptions && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {type === "consent" ? "Texto do Aceite / Confirmação" : "Opções de Resposta"}
                </label>
                {type !== "consent" && (
                  <button
                    type="button"
                    onClick={() => setShowBulkAdd(!showBulkAdd)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                  >
                    <ListPlus className="w-3.5 h-3.5" />
                    {showBulkAdd ? "Adicionar uma a uma" : "Colar várias opções"}
                  </button>
                )}
              </div>

              {showBulkAdd ? (
                <div className="space-y-2">
                  <textarea
                    rows={4}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder="Cole as opções aqui, uma por linha:&#10;Opção A&#10;Opção B&#10;Opção C"
                    className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowBulkAdd(false)}
                      className="text-xs px-3 py-1.5 text-slate-600 hover:bg-slate-200 rounded-md"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyBulkOptions}
                      className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-md font-medium"
                    >
                      Aplicar Lista
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-400 w-4 text-center">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => handleUpdateOption(idx, e.target.value)}
                        className="flex-1 p-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-500"
                      />
                      {options.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                          title="Remover opção"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}

                  {type !== "consent" && (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={newOptionInput}
                        onChange={(e) => setNewOptionInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddOption();
                          }
                        }}
                        placeholder="Nova opção... (Pressione Enter)"
                        className="flex-1 p-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddOption}
                        className="flex items-center gap-1 px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-medium transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Adicionar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Scale Config */}
          {type === "scale" && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Configurações da Escala
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-600 block mb-1">Nota Mínima</label>
                  <select
                    value={scaleMin}
                    onChange={(e) => setScaleMin(Number(e.target.value))}
                    className="w-full p-2 text-xs bg-white border border-slate-300 rounded-lg"
                  >
                    <option value={0}>0</option>
                    <option value={1}>1</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-600 block mb-1">Nota Máxima</label>
                  <select
                    value={scaleMax}
                    onChange={(e) => setScaleMax(Number(e.target.value))}
                    className="w-full p-2 text-xs bg-white border border-slate-300 rounded-lg"
                  >
                    <option value={5}>5 estrelas / pontos</option>
                    <option value={7}>7 pontos</option>
                    <option value={10}>10 (Padrão NPS)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-600 block mb-1">Rótulo Mínimo (Opcional)</label>
                  <input
                    type="text"
                    value={minLabel}
                    onChange={(e) => setMinLabel(e.target.value)}
                    placeholder="Ex: Pouco provável / Discordo"
                    className="w-full p-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 block mb-1">Rótulo Máximo (Opcional)</label>
                  <input
                    type="text"
                    value={maxLabel}
                    onChange={(e) => setMaxLabel(e.target.value)}
                    placeholder="Ex: Muito provável / Concordo totalmente"
                    className="w-full p-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Lógica de Exibição Condicional (Ex: mostrar campo B apenas se campo A for selecionado) */}
          <div className="p-4 bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-slate-50 border-2 border-indigo-200/80 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <GitBranch className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                      Lógica de Exibição Condicional
                    </span>
                    {hasConditionalLogic && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-600 text-white animate-in fade-in">
                        Ativa
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Exiba ou oculte esta pergunta dinamicamente dependendo da resposta de outro campo
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={hasConditionalLogic}
                  onChange={(e) => setHasConditionalLogic(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {hasConditionalLogic && (
              <div className="space-y-4 pt-2 border-t border-indigo-100">
                {candidateFields.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl">
                    Não há outras perguntas criadas neste formulário para configurar uma regra condicional. Crie ao menos outro campo primeiro.
                  </div>
                ) : (
                  <>
                    {/* Ação: Mostrar ou Ocultar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-white rounded-xl border border-indigo-200/60 shadow-2xs">
                      <span className="text-xs font-bold text-slate-700">Ação da Regra:</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setConditionalAction("show")}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            conditionalAction === "show"
                              ? "bg-indigo-600 text-white shadow-xs"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Mostrar este campo</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConditionalAction("hide")}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            conditionalAction === "hide"
                              ? "bg-rose-600 text-white shadow-xs"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Ocultar este campo</span>
                        </button>
                      </div>
                    </div>

                    {/* Rules List */}
                    <div className="space-y-3">
                      {conditionalRules.map((rule, rIdx) => {
                        const targetField = allFieldsMap.get(rule.fieldId);
                        const isValueLessOp = rule.operator === "is_empty" || rule.operator === "is_not_empty";

                        return (
                          <div
                            key={rIdx}
                            className="p-3.5 bg-white border border-indigo-200/80 rounded-xl space-y-2.5 shadow-2xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-indigo-900 flex items-center gap-1">
                                <Zap className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Condição {rIdx + 1}</span>
                              </span>
                              {conditionalRules.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRule(rIdx)}
                                  className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors"
                                  title="Remover esta condição"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                              {/* 1. Selecionar Campo Alvo */}
                              <div className={isValueLessOp ? "sm:col-span-7" : "sm:col-span-5"}>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                  Se o campo...
                                </label>
                                <select
                                  value={rule.fieldId}
                                  onChange={(e) => handleUpdateRule(rIdx, { fieldId: e.target.value })}
                                  className="w-full p-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium focus:bg-white focus:ring-1 focus:ring-indigo-500 truncate"
                                >
                                  <option value="">Selecione o campo...</option>
                                  {candidateFields.map((cf) => (
                                    <option key={cf.field.id} value={cf.field.id}>
                                      [{cf.sectionTitle}] {cf.field.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* 2. Selecionar Operador */}
                              <div className={isValueLessOp ? "sm:col-span-5" : "sm:col-span-3"}>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                  Regra
                                </label>
                                <select
                                  value={rule.operator}
                                  onChange={(e) =>
                                    handleUpdateRule(rIdx, { operator: e.target.value as ConditionOperator })
                                  }
                                  className="w-full p-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium focus:bg-white focus:ring-1 focus:ring-indigo-500"
                                >
                                  {Object.entries(OPERATOR_LABELS).map(([opKey, opLabel]) => (
                                    <option key={opKey} value={opKey}>
                                      {opLabel}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* 3. Valor Esperado */}
                              {!isValueLessOp && (
                                <div className="sm:col-span-4">
                                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                    Valor da Resposta
                                  </label>
                                  {targetField?.options && targetField.options.length > 0 ? (
                                    <select
                                      value={rule.value || ""}
                                      onChange={(e) => handleUpdateRule(rIdx, { value: e.target.value })}
                                      className="w-full p-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium focus:bg-white focus:ring-1 focus:ring-indigo-500"
                                    >
                                      <option value="">Selecione a opção...</option>
                                      {targetField.options.map((opt, oIdx) => (
                                        <option key={oIdx} value={opt}>
                                          {opt}
                                        </option>
                                      ))}
                                    </select>
                                  ) : targetField?.type === "consent" ? (
                                    <select
                                      value={String(rule.value ?? "true")}
                                      onChange={(e) => handleUpdateRule(rIdx, { value: e.target.value })}
                                      className="w-full p-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium focus:bg-white focus:ring-1 focus:ring-indigo-500"
                                    >
                                      <option value="true">Marcado / Aceito</option>
                                      <option value="false">Não marcado</option>
                                    </select>
                                  ) : (
                                    <input
                                      type="text"
                                      value={rule.value || ""}
                                      onChange={(e) => handleUpdateRule(rIdx, { value: e.target.value })}
                                      placeholder="Ex: Sim, Ativo, etc."
                                      className="w-full p-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:ring-1 focus:ring-indigo-500"
                                    />
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Quick selection pills for options */}
                            {!isValueLessOp && targetField?.options && targetField.options.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                <span className="text-[10px] text-slate-400 font-bold uppercase">Opções rápidas:</span>
                                {targetField.options.map((opt, oIdx) => (
                                  <button
                                    key={oIdx}
                                    type="button"
                                    onClick={() => handleUpdateRule(rIdx, { value: opt })}
                                    className={`px-2 py-0.5 text-[11px] rounded-md font-medium border transition-colors ${
                                      rule.value === opt
                                        ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs font-bold"
                                        : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Multiple rules combination (AND / OR) & Add button */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      {conditionalRules.length > 1 ? (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-600 font-medium">Combinar regras:</span>
                          <div className="flex items-center bg-white border border-indigo-200 rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => setConditionalMatchType("all")}
                              className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors ${
                                conditionalMatchType === "all"
                                  ? "bg-indigo-600 text-white shadow-2xs"
                                  : "text-slate-600 hover:bg-slate-100"
                              }`}
                            >
                              TODAS (E)
                            </button>
                            <button
                              type="button"
                              onClick={() => setConditionalMatchType("any")}
                              className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors ${
                                conditionalMatchType === "any"
                                  ? "bg-indigo-600 text-white shadow-2xs"
                                  : "text-slate-600 hover:bg-slate-100"
                              }`}
                            >
                              QUALQUER UMA (OU)
                            </button>
                          </div>
                        </div>
                      ) : <div />}

                      <button
                        type="button"
                        onClick={handleAddRule}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-300 rounded-xl text-xs font-bold transition-colors shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Adicionar Outra Condição</span>
                      </button>
                    </div>

                    {/* Live preview of the condition summary */}
                    <div className="p-3 bg-white/90 border border-indigo-200 rounded-xl text-xs text-indigo-950 flex items-start gap-2 shadow-2xs">
                      <Zap className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">Como esta pergunta vai se comportar:</span>
                        <p className="text-slate-700 mt-0.5 leading-relaxed">
                          {conditionalRules.some((r) => r.fieldId) ? (
                            <>
                              Esta pergunta será{" "}
                              <strong className={conditionalAction === "show" ? "text-indigo-700 font-bold" : "text-rose-700 font-bold"}>
                                {conditionalAction === "show" ? "EXIBIDA" : "OCULTADA"}
                              </strong>{" "}
                              quando{" "}
                              {conditionalRules
                                .filter((r) => r.fieldId)
                                .map((r, i) => {
                                  const targetF = allFieldsMap.get(r.fieldId);
                                  const labelStr = targetF ? `"${targetF.label}"` : `o campo selecionado`;
                                  let condStr = "";
                                  if (r.operator === "is_not_empty") condStr = "estiver preenchido";
                                  else if (r.operator === "is_empty") condStr = "estiver vazio / sem resposta";
                                  else if (r.operator === "equals") condStr = `for igual a "${r.value || "..."}"`;
                                  else if (r.operator === "not_equals") condStr = `for diferente de "${r.value || "..."}"`;
                                  else if (r.operator === "contains") condStr = `contiver "${r.value || "..."}"`;
                                  return (
                                    <span key={i}>
                                      {i > 0 ? (conditionalMatchType === "any" ? " OU " : " E ") : ""}
                                      <strong>{labelStr}</strong> {condStr}
                                    </span>
                                  );
                                })}
                              .
                            </>
                          ) : (
                            "Selecione um campo na regra acima para definir a dependência."
                          )}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Help Text / Guidance / Indicação Técnica */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              <span>Instrução de Apoio / Indicação Técnica</span>
              <span className="text-[10px] text-slate-400 font-normal normal-case">(aparece como dica no formulário e no PDF)</span>
            </label>
            <input
              type="text"
              value={helpText}
              onChange={(e) => setHelpText(e.target.value)}
              placeholder="Ex: Trata-se de percepção inicial, não de posicionamento final. / Pedir links separados por linha."
              className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-800"
            />
          </div>

          {/* Placeholder */}
          {["text", "textarea", "email", "phone", "number", "file"].includes(type) && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Exemplo no Campo (Placeholder)
              </label>
              <input
                type="text"
                value={placeholder}
                onChange={(e) => setPlaceholder(e.target.value)}
                placeholder="Ex: Digite aqui ou cole a URL..."
                className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-800"
              />
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!label.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{initialField ? "Salvar Alterações" : "Criar Campo Personalizado"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
