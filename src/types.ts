export type FieldType =
  | "text"
  | "textarea"
  | "radio"
  | "checkbox"
  | "select"
  | "email"
  | "phone"
  | "number"
  | "date"
  | "file"
  | "scale"
  | "consent";

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "is_empty"
  | "is_not_empty";

export interface FieldCondition {
  fieldId: string;
  operator: ConditionOperator;
  value?: any;
}

export interface ConditionalLogic {
  enabled: boolean;
  action: "show" | "hide";
  rules: FieldCondition[];
  matchType?: "all" | "any";
}

export interface FormField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  scaleMin?: number;
  scaleMax?: number;
  minLabel?: string;
  maxLabel?: string;
  conditionalNote?: string;
  conditionalLogic?: ConditionalLogic;
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
}

export interface AutoReplyConfig {
  enabled: boolean;
  subject?: string;
  senderName?: string;
  customMessage?: string;
  includeAnswersSummary?: boolean;
}

export interface AutoReplyLog {
  sentAt: string;
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  status: "sent" | "simulated";
  messageId?: string;
}

export interface RedirectConfig {
  enabled: boolean;
  url: string;
  delaySeconds?: number; // 0 = imediato, 3, 5, etc.
  buttonText?: string;
  openInNewTab?: boolean;
}

export interface TaggedLink {
  id: string; // e.g. "tag_1", "tag_2"
  name: string; // e.g. "Link tagueado 1", "Link tagueado 2"
  urlSlug?: string;
  createdAt: string;
  clicksCount?: number;
  completedCount?: number;
}

export interface LinkClickLog {
  id: string;
  formId: string;
  tagId: string;
  tagName: string;
  dia: string; // DD/MM/AAAA
  horario: string; // HH:mm:ss
  navegador: string; // e.g. "Chrome 128 (Windows 11)"
  userAgent?: string;
  ip?: string;
  completed: boolean; // se a pessoa finalizou o formulário
  submissionId?: string;
  timestamp: string; // ISO
}

export interface FormStructure {
  id: string;
  title: string;
  subtitle?: string;
  estimatedTime?: string;
  openingMessage?: string;
  closingMessage?: string;
  internalGuidelines?: string[];
  sections: FormSection[];
  autoReply?: AutoReplyConfig;
  redirectConfig?: RedirectConfig;
  taggedLinks?: TaggedLink[];
  themeColor?: string;
  backgroundImage?: string;
  backgroundOverlay?: "light" | "dark" | "none";
  logoUrl?: string;
  logoPosition?: "left" | "center" | "right";
  displayMode?: "step-by-step" | "all-at-once";
  createdAt?: string;
  updatedAt?: string;
}

export type FormAnswers = Record<string, any>;

export interface FormSubmission {
  id: string;
  formId: string;
  formTitle?: string;
  submittedAt: string;
  answers: FormAnswers;
  respondentName?: string;
  respondentEmail?: string;
  autoReply?: AutoReplyLog;
  tagId?: string;
  tagName?: string;
}

export interface FormSummary {
  id: string;
  title: string;
  subtitle?: string;
  createdAt?: string;
  updatedAt?: string;
  sectionsCount: number;
  totalQuestions: number;
  responseCount: number;
  lastResponseAt?: string;
}

export interface PdfExportConfig {
  mode: "blank" | "answers" | "spec";
  companyName: string;
  includeGuidelines: boolean;
  includeHelpText: boolean;
  includeNotes: boolean;
  paperSize: "a4" | "letter";
}

export interface ServerEmailSettings {
  mode: "gmail_app_password" | "resend" | "brevo" | "smtp" | "webhook";
  gmailUser: string;
  gmailAppPassword?: string;
  hasGmailAppPassword?: boolean;
  resendApiKey?: string;
  hasResendApiKey?: boolean;
  resendFrom?: string;
  brevoApiKey?: string;
  hasBrevoApiKey?: boolean;
  brevoSender?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  hasSmtpPass?: boolean;
  smtpSecure?: boolean;
  smtpFrom?: string;
  webhookUrl?: string;
  adminEmail: string;
  senderName: string;
  autoSendRespondent: boolean;
  autoSendAdmin: boolean;
  isServerAutonomous?: boolean;
  activeProviderName?: string;
  lastTestedAt?: string;
  lastTestStatus?: "success" | "error";
  lastTestMessage?: string;
}

