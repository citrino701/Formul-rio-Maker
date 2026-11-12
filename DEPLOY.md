# Como colocar o Formulário Maker no ar (Vercel + planilha do Google)

Custo: **R$ 0**. Você não precisa de cartão nem do Google Cloud.

- **Vercel (plano Hobby):** roda o app.
- **Planilha do Google + Apps Script:** é o banco de dados. Tudo fica na sua conta.

Tempo: uns 15 minutos.

---

## 1. Criar a planilha e o script (5 min)

1. Crie uma planilha nova no Google Drive. Pode chamar de **Formulário Maker — Banco**.
2. No menu, abra **Extensões → Apps Script**.
3. Apague o que estiver no editor e cole todo o conteúdo de [`apps-script/Code.gs`](apps-script/Code.gs).
4. Na linha `const SEGREDO = "troque-esta-senha";`, troque o texto por uma senha sua (qualquer frase longa serve). **Guarde essa senha**, porque você vai usar de novo no passo 3.
5. Clique em 💾 **Salvar**.
6. Clique em **Implantar → Nova implantação**:
   - Engrenagem ⚙️ → **App da Web**
   - *Executar como:* **Eu** (seu e-mail)
   - *Quem pode acessar:* **Qualquer pessoa**
   - **Implantar**. Na primeira vez o Google pede autorização: clique em **Autorizar acesso**, escolha sua conta e depois **Avançado → Acessar (não seguro)**. O aviso aparece porque o script é seu e não foi verificado pelo Google; é normal.
7. Copie a **URL do app da Web**. Ela termina em `/exec`.

> "Qualquer pessoa" só significa que o link funciona sem login do Google. Sem a senha do passo 4, o script recusa tudo, e quem tem a senha é só a Vercel.

**Se um dia você editar o Code.gs**, publique de novo em *Implantar → Gerenciar implantações → ✏️ → Versão: Nova versão*. Assim a URL continua a mesma.

## 2. Subir na Vercel (5 min)

1. Entre em [vercel.com](https://vercel.com) com sua conta do GitHub.
2. Clique em **Add New → Project** e importe o repositório `citrino701/Formul-rio-Maker`.
3. Se o código ainda não estiver na `main`, escolha o branch `deploy-vercel-planilha`. A Vercel reconhece as configurações sozinha pelo `vercel.json`.
4. Antes de clicar em **Deploy**, abra **Environment Variables** e preencha o passo 3 abaixo.

## 3. Variáveis de ambiente na Vercel

| Nome | Valor |
|---|---|
| `SHEETS_WEBAPP_URL` | a URL `/exec` do passo 1 |
| `SHEETS_SECRET` | a mesma senha do `SEGREDO` |
| `GMAIL_USER` | hugoviajante@gmail.com |
| `GMAIL_APP_PASSWORD` | senha de app do Gmail (veja abaixo) |
| `GEMINI_API_KEY` | chave do AI Studio (opcional, só para o gerador por IA) |

Senhas e chaves ficam **só na Vercel**. Não salve senha pelo painel do app, porque ele grava na aba "Config" da planilha.

**Senha de app do Gmail:** acesse https://myaccount.google.com/apppasswords. A verificação em duas etapas precisa estar ativa. Crie uma senha com o nome "Formulário Maker" e cole os 16 caracteres.

**Gemini sem risco de cobrança:** em https://aistudio.google.com/apikey, gere a chave num projeto **sem faturamento (billing)**. Assim ela fica limitada ao plano grátis.

As saídas de e-mail reserva (Resend, Brevo, SMTP, webhook) continuam funcionando como antes. Basta preencher as variáveis do `.env.example`.

## 4. Testar

1. Abra `https://SEU-APP.vercel.app/api/health`. O resultado precisa conter `"storage":"sheets"`.
2. Abra o app, crie um formulário e abra o link de resposta numa aba anônima.
3. Responda o formulário. Deve aparecer uma aba **Respostas · Nome do formulário** na planilha, e o e-mail deve chegar para você e para o cliente.

## 5. (Opcional) Trazer os formulários e respostas antigos

As respostas que estavam no arquivo `data/forms_db.json` continuam no histórico do Git, mas a pasta saiu do repositório. No seu computador, rode:

```bash
git show 11685e4:data/forms_db.json > antigo.json
SHEETS_WEBAPP_URL="https://script.google.com/.../exec" SHEETS_SECRET="sua-senha" \
  npx tsx scripts/migrar-para-planilha.ts antigo.json
rm antigo.json
```

---

## Como a planilha fica organizada

- **Formulários:** uma linha por formulário. As colunas "Dados" guardam a estrutura do formulário; não edite essas colunas.
- **Respostas · …:** uma linha por cliente e uma coluna por pergunta. A coluna `_dados` fica escondida e não deve ser apagada.
- **Cliques:** quem abriu cada link rastreado e se concluiu o preenchimento.
- **Config:** configuração de e-mail feita pelo painel.

Você pode filtrar, colorir e criar abas novas à vontade. Só não renomeie as abas que o app criou.

## Limites que vale saber

- Cada salvamento na planilha leva de 1 a 2 segundos. Para briefing, isso não faz diferença.
- O gerador por IA aceita documentos de até uns **3 MB**, porque a Vercel limita cada envio a 4,5 MB.
- O Apps Script grátis aguenta milhares de respostas por dia, bem mais do que você vai precisar.
