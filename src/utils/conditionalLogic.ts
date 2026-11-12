import { FormField, FormSection, FormAnswers, FieldCondition, ConditionalLogic, ConditionOperator } from "../types";

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: "É igual a",
  not_equals: "É diferente de",
  contains: "Contém",
  is_not_empty: "Está preenchido / respondido",
  is_empty: "Está vazio / não respondido"
};

/**
 * Extracts a flat list of all fields across all sections in the form.
 */
export function getAllFormFields(sections: FormSection[]): FormField[] {
  const fields: FormField[] = [];
  sections.forEach((sec) => {
    sec.fields.forEach((f) => {
      fields.push(f);
    });
  });
  return fields;
}

/**
 * Creates a lookup map of field id -> FormField.
 */
export function createFieldsMap(fieldsOrSections: FormField[] | FormSection[]): Map<string, FormField> {
  const map = new Map<string, FormField>();
  if (fieldsOrSections.length === 0) return map;

  if ("fields" in fieldsOrSections[0]) {
    // Array of FormSection
    (fieldsOrSections as FormSection[]).forEach((sec) => {
      sec.fields.forEach((f) => map.set(f.id, f));
    });
  } else {
    // Array of FormField
    (fieldsOrSections as FormField[]).forEach((f) => map.set(f.id, f));
  }
  return map;
}

/**
 * Checks if a specific condition is met based on the respondent's answers.
 */
export function evaluateCondition(condition: FieldCondition, answers: FormAnswers): boolean {
  if (!condition || !condition.fieldId) return true;

  const rawValue = answers[condition.fieldId];
  const targetValue = condition.value;

  // Check empty / not empty
  const isEmpty =
    rawValue === undefined ||
    rawValue === null ||
    rawValue === "" ||
    (Array.isArray(rawValue) && rawValue.length === 0) ||
    (typeof rawValue === "object" && !Array.isArray(rawValue) && Object.keys(rawValue).length === 0);

  if (condition.operator === "is_empty") {
    return isEmpty;
  }

  if (condition.operator === "is_not_empty") {
    return !isEmpty;
  }

  // If the answer is empty and we are looking for equality or contains, it does not match
  if (isEmpty) {
    return condition.operator === "not_equals";
  }

  const normTarget = String(targetValue ?? "").trim().toLowerCase();

  switch (condition.operator) {
    case "equals": {
      // Checkbox array comparison
      if (Array.isArray(rawValue)) {
        return rawValue.some((item) => String(item).trim().toLowerCase() === normTarget);
      }
      // Boolean consent comparison
      if (typeof rawValue === "boolean") {
        const boolTarget = targetValue === true || targetValue === "true" || normTarget === "sim" || normTarget === "de acordo";
        return rawValue === boolTarget;
      }
      // String or numeric comparison
      return String(rawValue).trim().toLowerCase() === normTarget;
    }

    case "not_equals": {
      if (Array.isArray(rawValue)) {
        return !rawValue.some((item) => String(item).trim().toLowerCase() === normTarget);
      }
      if (typeof rawValue === "boolean") {
        const boolTarget = targetValue === true || targetValue === "true" || normTarget === "sim" || normTarget === "de acordo";
        return rawValue !== boolTarget;
      }
      return String(rawValue).trim().toLowerCase() !== normTarget;
    }

    case "contains": {
      if (Array.isArray(rawValue)) {
        return rawValue.some((item) => String(item).toLowerCase().includes(normTarget));
      }
      return String(rawValue).toLowerCase().includes(normTarget);
    }

    default:
      return true;
  }
}

/**
 * Determines whether a field should be visible based on its conditional logic and the current answers.
 */
export function isFieldVisible(
  field: FormField,
  answers: FormAnswers,
  allFieldsMap?: Map<string, FormField> | FormField[]
): boolean {
  const logic = field.conditionalLogic;
  if (!logic || !logic.enabled || !logic.rules || logic.rules.length === 0) {
    return true;
  }

  // Filter valid rules (rules with a fieldId specified)
  const activeRules = logic.rules.filter((r) => r.fieldId && r.fieldId.trim() !== "");
  if (activeRules.length === 0) {
    return true;
  }

  const matchType = logic.matchType || "all";
  let conditionResult: boolean;

  if (matchType === "any") {
    conditionResult = activeRules.some((rule) => evaluateCondition(rule, answers));
  } else {
    // "all"
    conditionResult = activeRules.every((rule) => evaluateCondition(rule, answers));
  }

  if (logic.action === "hide") {
    // Hide if condition is met -> Visible if condition is NOT met
    return !conditionResult;
  }

  // "show" (default) -> Visible if condition IS met
  return conditionResult;
}

/**
 * Generates a human-friendly Portuguese summary of the field's conditional rules.
 */
export function getFieldConditionSummary(
  field: FormField,
  allFields: Map<string, FormField> | FormField[] | FormSection[]
): string | null {
  const logic = field.conditionalLogic;
  if (!logic || !logic.enabled || !logic.rules || logic.rules.length === 0) {
    return null;
  }

  const activeRules = logic.rules.filter((r) => r.fieldId && r.fieldId.trim() !== "");
  if (activeRules.length === 0) {
    return null;
  }

  const fieldsMap =
    allFields instanceof Map
      ? allFields
      : Array.isArray(allFields)
      ? createFieldsMap(allFields as any)
      : new Map<string, FormField>();

  const ruleDescriptions = activeRules.map((rule) => {
    const targetField = fieldsMap.get(rule.fieldId);
    const targetLabel = targetField ? `"${targetField.label}"` : `campo #${rule.fieldId}`;

    switch (rule.operator) {
      case "is_not_empty":
        return `${targetLabel} estiver respondido`;
      case "is_empty":
        return `${targetLabel} não estiver respondido`;
      case "equals":
        return `${targetLabel} for igual a "${rule.value || ""}"`;
      case "not_equals":
        return `${targetLabel} for diferente de "${rule.value || ""}"`;
      case "contains":
        return `${targetLabel} contiver "${rule.value || ""}"`;
      default:
        return `${targetLabel} satisfizer a condição`;
    }
  });

  const connector = logic.matchType === "any" ? " OU " : " E ";
  const conditionsText = ruleDescriptions.join(connector);

  if (logic.action === "hide") {
    return `Ocultado se: ${conditionsText}`;
  }
  return `Exibido se: ${conditionsText}`;
}
