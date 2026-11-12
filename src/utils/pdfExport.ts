import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FormStructure, FormAnswers, PdfExportConfig, FormField } from "../types";
import { isFieldVisible, createFieldsMap, getFieldConditionSummary } from "./conditionalLogic";

const TYPE_NAMES_PT: Record<string, string> = {
  text: "Resposta curta",
  textarea: "Parágrafo / Texto longo",
  radio: "Múltipla escolha (Única)",
  checkbox: "Caixas de seleção (Múltipla)",
  select: "Lista suspensa",
  email: "E-mail",
  phone: "Telefone / WhatsApp",
  number: "Número",
  date: "Data",
  file: "Upload de arquivo / Link",
  scale: "Escala numérica",
  consent: "Termo de aceite"
};

export function exportFormToPdf(
  form: FormStructure,
  config: PdfExportConfig,
  answers?: FormAnswers
) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: config.paperSize === "letter" ? "letter" : "a4"
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = margin;
  const allFieldsMap = createFieldsMap(form.sections);

  // Helper function to check and handle page overflow
  const ensureSpace = (neededHeight: number) => {
    if (cursorY + neededHeight > pageHeight - margin) {
      doc.addPage();
      cursorY = margin + 5;
      return true;
    }
    return false;
  };

  // Helper to add header on top
  const drawPageHeader = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(24, 30, 42); // slate-900
    doc.text(form.title, margin, cursorY);
    cursorY += 6;

    if (form.subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text(form.subtitle, margin, cursorY);
      cursorY += 5;
    }

    if (form.estimatedTime || config.companyName) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      const meta = [
        config.companyName ? `Organização: ${config.companyName}` : null,
        form.estimatedTime ? `Tempo estimado: ${form.estimatedTime}` : null,
        `Data: ${new Date().toLocaleDateString("pt-BR")}`
      ].filter(Boolean).join("  •  ");

      doc.text(meta, margin, cursorY);
      cursorY += 4;
    }

    // Divider line
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.4);
    doc.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += 6;
  };

  if (config.mode === "spec") {
    // Mode: Specification Table (Similar to the user's uploaded PDF)
    drawPageHeader();

    if (form.openingMessage) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      const splitOpening = doc.splitTextToSize(form.openingMessage, contentWidth);
      ensureSpace(splitOpening.length * 4 + 6);
      doc.text(splitOpening, margin, cursorY);
      cursorY += splitOpening.length * 4 + 6;
    }

    form.sections.forEach((section, sIdx) => {
      ensureSpace(20);

      // Section header row
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(section.title, margin, cursorY);
      cursorY += 4;

      if (section.description) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        const splitDesc = doc.splitTextToSize(section.description, contentWidth);
        doc.text(splitDesc, margin, cursorY);
        cursorY += splitDesc.length * 3.5 + 3;
      }

      const tableBody = section.fields.map((field, fIdx) => {
        let details = "";
        if (field.helpText && config.includeHelpText) {
          details += `Dica: ${field.helpText}\n`;
        }
        if (field.options && field.options.length > 0) {
          details += `Opções: ${field.options.join(", ")}\n`;
        }
        if (field.placeholder) {
          details += `Exemplo: ${field.placeholder}\n`;
        }
        const condSummary = getFieldConditionSummary(field, allFieldsMap);
        if (condSummary) {
          details += `Condicional: ${condSummary}\n`;
        }
        if (!details.trim()) {
          details = "—";
        }

        return [
          `${fIdx + 1}`,
          field.label,
          TYPE_NAMES_PT[field.type] || field.type,
          field.required ? "Sim" : "Não",
          details.trim()
        ];
      });

      autoTable(doc, {
        startY: cursorY,
        margin: { left: margin, right: margin },
        head: [["Nº", "Pergunta", "Tipo de resposta", "Obrigatória", "Indicação / Opções"]],
        body: tableBody,
        theme: "grid",
        headStyles: {
          fillColor: [30, 41, 59], // slate-800
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: "bold",
          cellPadding: 2.5
        },
        styles: {
          fontSize: 8,
          cellPadding: 2.5,
          overflow: "linebreak",
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240]
        },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 65 },
          2: { cellWidth: 32 },
          3: { cellWidth: 20, halign: "center" },
          4: { cellWidth: 47 }
        },
        didDrawPage: (data) => {
          cursorY = data.cursor?.y || cursorY;
        }
      });

      // @ts-ignore
      cursorY = (doc as any).lastAutoTable.finalY + 8;
    });

    if (form.internalGuidelines && form.internalGuidelines.length > 0 && config.includeGuidelines) {
      ensureSpace(30);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text("Orientações de Uso Interno / Análise:", margin, cursorY);
      cursorY += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      form.internalGuidelines.forEach((g) => {
        const lines = doc.splitTextToSize(`•  ${g}`, contentWidth - 4);
        ensureSpace(lines.length * 3.5);
        doc.text(lines, margin + 2, cursorY);
        cursorY += lines.length * 3.5 + 1.5;
      });
    }

  } else {
    // Mode: Blank Printable Form OR Filled-In Answers Form
    drawPageHeader();

    if (form.openingMessage) {
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, cursorY, contentWidth, 0, 2, 2); // calculate dynamic height
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      const splitOpening = doc.splitTextToSize(form.openingMessage, contentWidth - 8);
      const boxHeight = splitOpening.length * 4 + 7;
      ensureSpace(boxHeight + 5);

      doc.roundedRect(margin, cursorY, contentWidth, boxHeight, 1.5, 1.5, "FD");
      doc.text(splitOpening, margin + 4, cursorY + 5);
      cursorY += boxHeight + 8;
    }

    form.sections.forEach((section, sIdx) => {
      ensureSpace(20);

      // Section Header Title Banner
      doc.setFillColor(241, 245, 249); // slate-100
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(margin, cursorY, contentWidth, 8, 1, 1, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(section.title, margin + 4, cursorY + 5.5);
      cursorY += 11;

      if (section.description) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        const splitDesc = doc.splitTextToSize(section.description, contentWidth);
        ensureSpace(splitDesc.length * 3.5 + 2);
        doc.text(splitDesc, margin, cursorY);
        cursorY += splitDesc.length * 3.5 + 4;
      }

      // Fields
      section.fields.forEach((field, fIdx) => {
        // In answers mode, do not render fields that are conditionally hidden and unanswered
        if (
          config.mode === "answers" &&
          answers &&
          !isFieldVisible(field, answers, allFieldsMap) &&
          (answers[field.id] === undefined || answers[field.id] === "")
        ) {
          return;
        }

        const questionNumber = `${fIdx + 1}. `;
        const requiredBadge = field.required ? " *" : "";
        const answer = answers ? answers[field.id] : undefined;

        ensureSpace(18);

        // Question label
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);

        const fullLabel = `${questionNumber}${field.label}${requiredBadge}`;
        const splitLabel = doc.splitTextToSize(fullLabel, contentWidth);
        doc.text(splitLabel, margin, cursorY);
        cursorY += splitLabel.length * 4 + 1;

        // Help text if configured
        if (field.helpText && config.includeHelpText) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(7.5);
          doc.setTextColor(100, 116, 139);
          const splitHelp = doc.splitTextToSize(`Obs: ${field.helpText}`, contentWidth);
          doc.text(splitHelp, margin, cursorY);
          cursorY += splitHelp.length * 3.5 + 2;
        }

        // Render input representation based on field type and whether answers exist
        if (config.mode === "answers" && answer !== undefined && answer !== "") {
          // Render answer block
          doc.setFillColor(243, 244, 246); // gray-100
          doc.setDrawColor(209, 213, 219);

          let displayAnswer = "";
          if (Array.isArray(answer)) {
            displayAnswer = answer.join(", ");
          } else if (typeof answer === "boolean") {
            displayAnswer = answer ? "Sim / De acordo" : "Não";
          } else {
            displayAnswer = String(answer);
          }

          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(17, 24, 39);
          const splitAns = doc.splitTextToSize(displayAnswer, contentWidth - 6);
          const ansHeight = Math.max(7, splitAns.length * 4 + 4);
          ensureSpace(ansHeight + 4);

          doc.roundedRect(margin, cursorY, contentWidth, ansHeight, 1, 1, "FD");
          doc.text(splitAns, margin + 3, cursorY + 4.5);
          cursorY += ansHeight + 5;

        } else {
          // Render blank answer spaces for print
          switch (field.type) {
            case "text":
            case "email":
            case "phone":
            case "number":
            case "date": {
              ensureSpace(10);
              doc.setDrawColor(203, 213, 225);
              doc.setLineWidth(0.3);
              doc.line(margin, cursorY + 5, pageWidth - margin, cursorY + 5);
              cursorY += 8;
              break;
            }

            case "textarea": {
              ensureSpace(20);
              doc.setDrawColor(226, 232, 240);
              doc.setLineWidth(0.3);
              for (let line = 0; line < 3; line++) {
                doc.line(margin, cursorY + 5 + line * 6, pageWidth - margin, cursorY + 5 + line * 6);
              }
              cursorY += 22;
              break;
            }

            case "radio": {
              if (field.options && field.options.length > 0) {
                field.options.forEach((opt) => {
                  ensureSpace(6);
                  doc.setDrawColor(148, 163, 184);
                  doc.circle(margin + 2.5, cursorY + 1.5, 1.8);
                  doc.setFont("helvetica", "normal");
                  doc.setFontSize(8);
                  doc.setTextColor(51, 65, 85);
                  doc.text(opt, margin + 7, cursorY + 2.5);
                  cursorY += 5;
                });
                cursorY += 2;
              } else {
                ensureSpace(8);
                doc.line(margin, cursorY + 5, pageWidth - margin, cursorY + 5);
                cursorY += 8;
              }
              break;
            }

            case "checkbox": {
              if (field.options && field.options.length > 0) {
                field.options.forEach((opt) => {
                  ensureSpace(6);
                  doc.setDrawColor(148, 163, 184);
                  doc.rect(margin + 1, cursorY - 0.5, 3.2, 3.2);
                  doc.setFont("helvetica", "normal");
                  doc.setFontSize(8);
                  doc.setTextColor(51, 65, 85);
                  doc.text(opt, margin + 7, cursorY + 2.2);
                  cursorY += 5;
                });
                cursorY += 2;
              }
              break;
            }

            case "scale": {
              ensureSpace(12);
              const minVal = field.scaleMin ?? 1;
              const maxVal = field.scaleMax ?? 5;
              const totalBoxes = maxVal - minVal + 1;
              const boxW = Math.min(8, (contentWidth - 20) / totalBoxes);

              let bx = margin;
              for (let v = minVal; v <= maxVal; v++) {
                doc.setDrawColor(148, 163, 184);
                doc.rect(bx, cursorY, boxW - 1.5, 6);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(7.5);
                doc.setTextColor(71, 85, 105);
                doc.text(String(v), bx + (boxW - 1.5) / 2, cursorY + 4.2, { align: "center" });
                bx += boxW;
              }

              if (field.minLabel || field.maxLabel) {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(7);
                doc.setTextColor(148, 163, 184);
                cursorY += 8;
                if (field.minLabel) doc.text(field.minLabel, margin, cursorY);
                if (field.maxLabel) doc.text(field.maxLabel, pageWidth - margin, cursorY, { align: "right" });
                cursorY += 2;
              } else {
                cursorY += 9;
              }
              break;
            }

            case "consent": {
              ensureSpace(12);
              doc.setDrawColor(148, 163, 184);
              doc.rect(margin + 1, cursorY, 3.5, 3.5);
              doc.setFont("helvetica", "bold");
              doc.setFontSize(8);
              doc.setTextColor(30, 41, 59);
              const optText = (field.options && field.options[0]) || "Li e estou de acordo.";
              doc.text(optText, margin + 7, cursorY + 2.8);
              cursorY += 8;
              break;
            }

            case "file": {
              ensureSpace(10);
              doc.setFont("helvetica", "italic");
              doc.setFontSize(7.5);
              doc.setTextColor(148, 163, 184);
              doc.text("[ Campo de arquivo ou link compartilhado: _________________________________________ ]", margin, cursorY + 2);
              cursorY += 7;
              break;
            }

            default: {
              ensureSpace(8);
              doc.setDrawColor(203, 213, 225);
              doc.line(margin, cursorY + 4, pageWidth - margin, cursorY + 4);
              cursorY += 7;
            }
          }
        }
      });

      cursorY += 4;
    });

    if (form.closingMessage) {
      ensureSpace(16);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const splitClosing = doc.splitTextToSize(form.closingMessage, contentWidth);
      doc.text(splitClosing, margin, cursorY);
      cursorY += splitClosing.length * 3.5 + 4;
    }
  }

  // Add page numbers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    const footerText = `${form.title}  •  Página ${i} de ${totalPages}`;
    doc.text(footerText, pageWidth / 2, pageHeight - 8, { align: "center" });
  }

  const cleanFileName = form.title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 30);

  doc.save(`${cleanFileName}_${config.mode}.pdf`);
}
