/**
 * Contexto fixo que a IA usa SEMPRE que gera ou ajusta um formulário.
 *
 * Edite o texto abaixo do jeito que quiser (tom de voz, tipo de cliente,
 * blocos que todo briefing seu deve ter, perguntas obrigatórias...).
 * Se preferir não mexer no código, crie a variável AI_FORM_CONTEXT na Vercel:
 * ela substitui este texto.
 */
const DEFAULT_CONTEXT = `
- Os formulários são briefings que eu envio para MEUS CLIENTES preencherem antes de começarmos um projeto.
- Quem responde é o cliente (dono ou responsável pela empresa), não um especialista: use linguagem simples, direta e cordial, em português do Brasil.
- Sempre comece com um bloco de identificação: nome do responsável, empresa/marca, e-mail e WhatsApp (e-mail obrigatório, para o cliente receber a cópia das respostas).
- Prefira perguntas abertas ('textarea') para entender objetivo, público, diferenciais e referências; use múltipla escolha só quando ajudar o cliente a responder mais rápido.
- Para materiais (logo, fotos, manual de marca), use campo 'file' pedindo um link do Google Drive/Dropbox.
- Feche com uma pergunta aberta do tipo "Algo mais que devemos saber?" e um termo de consentimento ('consent').
`.trim();

export const AI_FORM_CONTEXT: string = (process.env.AI_FORM_CONTEXT || DEFAULT_CONTEXT).trim();
