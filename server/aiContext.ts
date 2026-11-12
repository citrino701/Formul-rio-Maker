/**
 * Contexto fixo que a IA usa SEMPRE que gera ou ajusta um formulário.
 *
 * Edite o texto abaixo do jeito que quiser (tom de voz, tipo de cliente,
 * blocos que todo briefing seu deve ter, perguntas obrigatórias...).
 * Se preferir não mexer no código, crie a variável AI_FORM_CONTEXT na Vercel:
 * ela substitui este texto.
 */
const DEFAULT_CONTEXT = `
- Os formulários podem ser de qualquer tipo (briefing, cadastro, pesquisa, inscrição, feedback...). Siga o que o pedido descrever, sem assumir um tipo fixo.
- Escreva em português do Brasil, com linguagem simples, direta e cordial.
- Se for pedir dados de contato, inclua um campo de e-mail (assim quem responde recebe a cópia das respostas).
- Para arquivos (logo, fotos, documentos), use campo 'file' pedindo um link do Google Drive/Dropbox.
`.trim();

export const AI_FORM_CONTEXT: string = (process.env.AI_FORM_CONTEXT || DEFAULT_CONTEXT).trim();
