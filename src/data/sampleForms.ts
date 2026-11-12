import { FormStructure } from "../types";

export const SAMPLE_BTG_FORM: FormStructure = {
  id: "form_pre_imersao_btg",
  title: "Pré-imersão BTG",
  subtitle: "Formulário de Contexto Inicial",
  themeColor: "#4f46e5",
  displayMode: "step-by-step",
  logoUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 50' width='160' height='50'%3E%3Crect width='160' height='50' rx='8' fill='%230B1736'/%3E%3Ctext x='20' y='32' fill='%23FFFFFF' font-family='Arial,sans-serif' font-weight='900' font-size='22' letter-spacing='2'%3EBTG%3C/text%3E%3Cpath d='M100 15 L125 15 L125 35 L100 35 Z' fill='none' stroke='%2338BDF8' stroke-width='3'/%3E%3Cpath d='M110 20 L135 20 L135 40 L110 40 Z' fill='%2338BDF8' opacity='0.7'/%3E%3C/svg%3E",
  logoPosition: "center",
  backgroundImage: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1400&auto=format&fit=crop",
  backgroundOverlay: "light",
  estimatedTime: "15 a 25 minutos",
  openingMessage:
    "Este formulário é o ponto de partida da construção do seu BTG. Ele nos ajuda a entender como a empresa se enxerga hoje, quais são seus desafios, objetivos e ambições. Iremos cruzar estas informações com a imersão consultiva, materiais existentes, mercado e percepção de marca. Nosso papel é investigar, questionar, organizar e transformar informações dispersas em direção estratégica. Não existe resposta perfeita. Responda a partir do que vocês sabem hoje. Dúvidas, lacunas e incertezas também são dados valiosos.",
  closingMessage:
    "Obrigado por compartilhar este contexto. Após o envio, nossa equipe fará uma leitura inicial dos materiais e respostas para preparar a call de imersão consultiva. O formulário é apenas o início do processo para transformar seus dados em direção estratégica.",
  internalGuidelines: [
    "Fatos e contexto que apenas a empresa consegue fornecer",
    "Materiais existentes a serem analisados antes da call",
    "Percepções iniciais e hipóteses do cliente",
    "Objetivos, restrições e ambições prioritárias",
    "Quando a empresa estiver em fase de ideia/validação, flexibilizar linguagem de realidade para hipótese",
    "Manter obrigatórias apenas perguntas estruturais de identificação e agendamento"
  ],
  createdAt: "2026-09-21T10:00:00.000Z",
  updatedAt: "2026-09-21T10:00:00.000Z",
  sections: [
    {
      id: "sec_1",
      title: "01. Contexto essencial",
      description: "Estas informações nos ajudam a organizar o processo, conhecer os canais atuais da empresa e alinhar a equipe participante.",
      fields: [
        {
          id: "f_1_1",
          label: "Qual é o nome da empresa ou marca?",
          type: "text",
          required: true,
          placeholder: "Ex: Koyo Creative ou Nome Fantasia"
        },
        {
          id: "f_1_2",
          label: "Qual é a razão social, caso seja diferente da marca?",
          type: "text",
          required: false,
          placeholder: "Razão social registrada (se houver)"
        },
        {
          id: "f_1_has_cnpj",
          label: "A empresa já possui CNPJ formalmente registrado?",
          type: "radio",
          required: true,
          options: ["Sim, empresa constituída", "Não, negócio em fase de ideação/validação"]
        },
        {
          id: "f_1_3",
          label: "Qual é o CNPJ da empresa?",
          type: "text",
          required: true,
          placeholder: "00.000.000/0000-00",
          helpText: "Informe o número do CNPJ com pontuação.",
          conditionalLogic: {
            enabled: true,
            action: "show",
            matchType: "all",
            rules: [
              {
                fieldId: "f_1_has_cnpj",
                operator: "equals",
                value: "Sim, empresa constituída"
              }
            ]
          }
        },
        {
          id: "f_1_4",
          label: "Em que cidade e estado a empresa está sediada?",
          type: "text",
          required: true,
          placeholder: "Ex: São Paulo, SP"
        },
        {
          id: "f_1_5",
          label: "Qual é o site da empresa?",
          type: "text",
          required: false,
          placeholder: "https://suaempresa.com.br",
          helpText: "Informe a URL principal, se já estiver no ar."
        },
        {
          id: "f_1_6",
          label: "Quais são os canais digitais da empresa?",
          type: "textarea",
          required: true,
          placeholder: "Instagram: @...\nLinkedIn: linkedin.com/company/...\nOutros canais...",
          helpText: "Inclua links de redes sociais, LinkedIn, portfólio, marketplace ou outros canais relevantes. Insira os links separados por linha."
        },
        {
          id: "f_1_7",
          label: "Qual é o seu nome completo?",
          type: "text",
          required: true,
          placeholder: "Nome e sobrenome"
        },
        {
          id: "f_1_8",
          label: "Qual é sua função dentro da empresa?",
          type: "text",
          required: true,
          placeholder: "Ex: Fundador, CMO, Diretor de Produto"
        },
        {
          id: "f_1_9",
          label: "Qual é seu e-mail principal?",
          type: "email",
          required: true,
          placeholder: "seuemail@empresa.com.br",
          helpText: "E-mail para envio de confirmações e convocação da call."
        },
        {
          id: "f_1_10",
          label: "Qual é seu WhatsApp ou telefone de contato?",
          type: "phone",
          required: true,
          placeholder: "(11) 90000-0000"
        },
        {
          id: "f_1_11",
          label: "Quem participará da call de imersão?",
          type: "textarea",
          required: true,
          placeholder: "1. Nome Completo - Cargo\n2. Nome Completo - Cargo",
          helpText: "Informe o nome e função das pessoas da sua equipe que estarão presentes."
        },
        {
          id: "f_1_12",
          label: "Em que estágio a empresa está hoje?",
          type: "radio",
          required: true,
          helpText: "Selecione o momento mais próximo da realidade atual.",
          options: [
            "Ideia ou pré-operação",
            "Validação",
            "Operação inicial",
            "Crescimento",
            "Expansão",
            "Reposicionamento",
            "Outro"
          ]
        },
        {
          id: "f_1_13",
          label: "Quais materiais vocês já possuem?",
          type: "checkbox",
          required: true,
          helpText: "Marque todos os materiais que já existem e podem ser consultados.",
          options: [
            "Logo",
            "Identidade visual",
            "Site",
            "Apresentação institucional",
            "Pitch deck",
            "Proposta comercial",
            "Portfólio",
            "Fotos",
            "Vídeos",
            "Depoimentos",
            "Cases",
            "Nenhum material relevante no momento",
            "Outro"
          ]
        },
        {
          id: "f_1_14",
          label: "Envie links ou arquivos dos materiais que considera importantes para entendermos a empresa.",
          type: "file",
          required: false,
          placeholder: "Cole link do Google Drive, Dropbox, Notion ou WeTransfer...",
          helpText: "Aceita links de pastas compartilhadas ou arquivos como PDF, PPT, DOCX, imagens e vídeos."
        }
      ]
    },
    {
      id: "sec_2",
      title: "02. O negócio na visão de vocês",
      description: "Não buscamos uma definição pronta de estratégia. Queremos entender como vocês explicam e entregam a solução hoje.",
      fields: [
        {
          id: "f_2_1",
          label: "Como você explicaria a empresa para alguém que nunca ouviu falar dela?",
          type: "textarea",
          required: true,
          helpText: "Trata-se de percepção inicial, não de posicionamento final.",
          placeholder: "Explique de forma simples, como em uma conversa informal..."
        },
        {
          id: "f_2_2",
          label: "O que a empresa oferece hoje? Liste produtos, serviços ou soluções existentes.",
          type: "textarea",
          required: true,
          helpText: "Para negócios em ideia: usar 'O que a empresa pretende oferecer?'.",
          placeholder: "Liste os principais produtos ou serviços oferecidos..."
        },
        {
          id: "f_2_3",
          label: "Na percepção de vocês, qual problema principal a empresa ajuda a resolver?",
          type: "textarea",
          required: true,
          helpText: "Usar 'na percepção de vocês' para não exigir diagnóstico pronto."
        },
        {
          id: "f_2_4",
          label: "O que vocês acreditam que muda para o cliente depois de contratar ou usar a solução?",
          type: "textarea",
          required: true,
          placeholder: "Qual transformação ou benefício prático é gerado?"
        },
        {
          id: "f_2_5",
          label: "Como a empresa gera receita hoje, ou como pretende gerar?",
          type: "textarea",
          required: true,
          helpText: "Ex.: projeto, assinatura, venda avulsa, comissão, licenciamento ou outro modelo."
        },
        {
          id: "f_2_6",
          label: "Em que formato a empresa entrega valor?",
          type: "checkbox",
          required: true,
          options: [
            "Serviço pontual",
            "Projeto personalizado",
            "Consultoria",
            "Produto físico",
            "Produto digital",
            "Plataforma ou software",
            "Assinatura recorrente",
            "Curso ou treinamento",
            "Comunidade",
            "Outro"
          ]
        },
        {
          id: "f_2_7",
          label: "Há algo que a empresa não entrega, não faz ou não deseja fazer?",
          type: "textarea",
          required: false,
          helpText: "Importante para limites de oferta e delimitação de escopo."
        },
        {
          id: "f_2_8",
          label: "Quais são os principais objetivos da empresa nos próximos 12 meses?",
          type: "textarea",
          required: true,
          helpText: "Liste até três objetivos principais mais importantes."
        },
        {
          id: "f_2_9",
          label: "Existe alguma mudança importante prevista?",
          type: "checkbox",
          required: false,
          options: [
            "Novo produto ou serviço",
            "Novo público",
            "Expansão geográfica",
            "Mudança de marca ou posicionamento",
            "Entrada em novo canal de vendas",
            "Busca de investimento, edital ou captação",
            "Nova parceria estratégica",
            "Nenhuma mudança relevante no momento",
            "Outro"
          ]
        },
        {
          id: "f_2_10",
          label: "Existe alguma limitação, desafio ou restrição que devemos considerar?",
          type: "textarea",
          required: false,
          helpText: "Pode envolver equipe, prazo, orçamento, operação ou mercado."
        }
      ]
    },
    {
      id: "sec_3",
      title: "03. Público, mercado e referências",
      description: "Esta seção reúne a percepção atual de vocês sobre clientes, mercado e alternativas.",
      fields: [
        {
          id: "f_3_1",
          label: "Quem compra, usa ou se beneficia da solução hoje?",
          type: "textarea",
          required: true,
          helpText: "Para negócios em ideia: 'Quem vocês acreditam que usará ou se beneficiará da solução?'."
        },
        {
          id: "f_3_2",
          label: "Quem costuma tomar a decisão de contratação ou compra?",
          type: "textarea",
          required: false,
          placeholder: "Ex: O próprio usuário, Diretor financeiro, Gerente de RH, etc."
        },
        {
          id: "f_3_3",
          label: "Em que situação uma pessoa ou empresa costuma procurar vocês?",
          type: "textarea",
          required: true,
          helpText: "Pergunta de contexto e gatilho de compra."
        },
        {
          id: "f_3_4",
          label: "Quais problemas, dificuldades ou desejos vocês percebem com mais frequência nesse público?",
          type: "textarea",
          required: true
        },
        {
          id: "f_3_5",
          label: "Na percepção de vocês, o que faz alguém escolher a empresa hoje?",
          type: "textarea",
          required: false,
          helpText: "Percepção livre; nossa equipe irá validar e aprofundar na imersão."
        },
        {
          id: "f_3_6",
          label: "Quais dúvidas ou objeções aparecem antes da compra?",
          type: "textarea",
          required: false
        },
        {
          id: "f_3_7",
          label: "Que tipo de cliente, demanda ou relação comercial não combina com a empresa?",
          type: "textarea",
          required: false
        },
        {
          id: "f_3_8",
          label: "Como clientes ou potenciais clientes conhecem a empresa atualmente?",
          type: "checkbox",
          required: true,
          options: [
            "Indicação",
            "Instagram",
            "LinkedIn",
            "Google",
            "Eventos",
            "WhatsApp",
            "Parceiros",
            "Anúncios",
            "Prospecção ativa",
            "Marketplace",
            "Outro"
          ]
        },
        {
          id: "f_3_9",
          label: "Quais empresas, marcas ou soluções vocês enxergam como referência, concorrência ou alternativa para o cliente?",
          type: "textarea",
          required: false,
          helpText: "A lista é ponto de partida; a análise de categoria será feita posteriormente."
        },
        {
          id: "f_3_10",
          label: "Há algum mercado, setor, região ou tipo de cliente que vocês gostariam de alcançar no futuro?",
          type: "textarea",
          required: false
        }
      ]
    },
    {
      id: "sec_4",
      title: "04. Marca e comunicação atual",
      description: "Não é necessário definir posicionamento, tom de voz ou identidade visual de forma técnica. Queremos impressões e aspirações sinceras.",
      fields: [
        {
          id: "f_4_1",
          label: "Como vocês gostariam que a empresa fosse percebida por clientes, parceiros e mercado?",
          type: "textarea",
          required: true,
          helpText: "Percepção desejada, não resposta definitiva."
        },
        {
          id: "f_4_2",
          label: "Quais palavras, características ou sensações vocês acreditam que combinam com a empresa?",
          type: "textarea",
          required: false
        },
        {
          id: "f_4_3",
          label: "Existe algo que vocês não querem que a empresa pareça, comunique ou prometa?",
          type: "textarea",
          required: true
        },
        {
          id: "f_4_4",
          label: "Há alguma percepção atual que vocês gostariam de mudar?",
          type: "textarea",
          required: false
        },
        {
          id: "f_4_5",
          label: "Quais materiais, posts, apresentações ou mensagens representam bem a empresa hoje?",
          type: "textarea",
          required: false,
          helpText: "Inclua links, se possível."
        },
        {
          id: "f_4_6",
          label: "Quais materiais, posts, apresentações ou mensagens não representam bem a empresa?",
          type: "textarea",
          required: false
        },
        {
          id: "f_4_7",
          label: "Quais marcas, empresas, referências visuais ou estilos de comunicação vocês admiram? Por quê?",
          type: "textarea",
          required: false
        },
        {
          id: "f_4_8",
          label: "Existe alguma marca, estilo visual ou forma de comunicação que vocês não gostam ou não querem repetir?",
          type: "textarea",
          required: false
        },
        {
          id: "f_4_9",
          label: "Existe alguma palavra, expressão ou promessa que vocês preferem evitar?",
          type: "textarea",
          required: false
        },
        {
          id: "f_4_10",
          label: "Se a empresa fosse uma pessoa, como ela se comportaria em uma conversa?",
          type: "textarea",
          required: false,
          helpText: "Pergunta de apoio para calibrar personalidade e tom de voz."
        }
      ]
    },
    {
      id: "sec_5",
      title: "05. Objetivos da imersão",
      description: "Este bloco nos ajuda a entender o que precisa ficar mais claro ao final do processo estratégico.",
      fields: [
        {
          id: "f_5_1",
          label: "Qual é a principal dúvida, desafio ou decisão que vocês esperam esclarecer com o BTG?",
          type: "textarea",
          required: true
        },
        {
          id: "f_5_2",
          label: "O que vocês gostariam que estivesse mais claro sobre a empresa ao final deste processo?",
          type: "textarea",
          required: true
        },
        {
          id: "f_5_3",
          label: "Existe alguma apresentação, reunião, lançamento, edital, evento, captação ou marco importante próximo?",
          type: "textarea",
          required: false,
          helpText: "Essa informação pode orientar prioridades de cronograma."
        },
        {
          id: "f_5_4",
          label: "Existe alguma informação estratégica ou confidencial que devemos tratar com cuidado?",
          type: "textarea",
          required: false
        },
        {
          id: "f_5_5",
          label: "Há algo importante sobre a empresa que não foi perguntado até aqui?",
          type: "textarea",
          required: false,
          helpText: "Campo livre final para qualquer contexto adicional."
        }
      ]
    },
    {
      id: "sec_6",
      title: "06. Confidencialidade e próximos passos",
      description: "As informações compartilhadas serão utilizadas exclusivamente para a construção do BTG e tratadas com sigilo.",
      fields: [
        {
          id: "f_6_1",
          label: "Autorizo a equipe estratégica a utilizar as informações e materiais compartilhados neste formulário exclusivamente para o projeto.",
          type: "consent",
          required: true,
          options: ["Li e estou de acordo."]
        },
        {
          id: "f_6_2",
          label: "Autorizo a gravação e a transcrição da call de imersão exclusivamente para garantir o registro e precisão das análises estratégicas.",
          type: "consent",
          required: true,
          options: ["Li e estou de acordo."]
        }
      ]
    }
  ]
};

export const SAMPLE_ONBOARDING_FORM: FormStructure = {
  id: "form_onboarding_cliente",
  title: "Onboarding de Novo Cliente",
  subtitle: "Ficha de Entrada e Alinhamento Operacional",
  estimatedTime: "10 minutos",
  openingMessage: "Seja muito bem-vindo! Para que nosso time comece a trabalhar no seu projeto com velocidade e assertividade, preencha as informações abaixo.",
  closingMessage: "Muito obrigado pelas informações! Em até 24h úteis entraremos em contato com o cronograma detalhado.",
  internalGuidelines: ["Verificar se o responsável financeiro foi informado", "Validar acessos e links enviados"],
  createdAt: "2026-09-21T10:00:00.000Z",
  updatedAt: "2026-09-21T10:00:00.000Z",
  sections: [
    {
      id: "sec_onb_1",
      title: "1. Dados do Contratante",
      description: "Informações cadastrais para faturamento e comunicação oficial.",
      fields: [
        { id: "onb_1", label: "Razão Social / Nome da Empresa", type: "text", required: true },
        { id: "onb_2", label: "CNPJ", type: "text", required: true, placeholder: "00.000.000/0000-00" },
        { id: "onb_3", label: "Pessoa de Contato Principal", type: "text", required: true },
        { id: "onb_4", label: "E-mail Principal", type: "email", required: true },
        { id: "onb_5", label: "WhatsApp para Alinhamentos Rápidos", type: "phone", required: true }
      ]
    },
    {
      id: "sec_onb_2",
      title: "2. Expectativas e Escopo",
      description: "Alinhamento das metas do projeto.",
      fields: [
        {
          id: "onb_6",
          label: "Qual o principal resultado esperado nos primeiros 90 dias?",
          type: "textarea",
          required: true
        },
        {
          id: "onb_7",
          label: "Nível de prioridade desta entrega para a empresa",
          type: "scale",
          required: true,
          scaleMin: 1,
          scaleMax: 5,
          minLabel: "Normal",
          maxLabel: "Máxima / Urgente"
        },
        {
          id: "onb_8",
          label: "Como prefere receber atualizações de status?",
          type: "radio",
          required: true,
          options: ["Reunião semanal online", "Relatório por e-mail", "Painel no Notion / Trello", "Mensagens no WhatsApp"]
        }
      ]
    }
  ]
};

export const SAMPLE_SATISFACTION_FORM: FormStructure = {
  id: "form_pesquisa_satisfacao",
  title: "Pesquisa de Satisfação & Feedback",
  subtitle: "Sua opinião é fundamental para evoluirmos nossos serviços",
  estimatedTime: "3 a 5 minutos",
  openingMessage: "Gostaríamos de saber como foi sua experiência recente conosco. Este formulário é confidencial e leva menos de 5 minutos.",
  closingMessage: "Agradecemos imensamente pela sua sinceridade e apoio contínuo!",
  createdAt: "2026-09-21T10:00:00.000Z",
  updatedAt: "2026-09-21T10:00:00.000Z",
  sections: [
    {
      id: "sec_sat_1",
      title: "1. Avaliação Geral",
      fields: [
        {
          id: "sat_1",
          label: "Em uma escala de 0 a 10, qual a probabilidade de você nos recomendar a um colega ou parceiro? (NPS)",
          type: "scale",
          required: true,
          scaleMin: 0,
          scaleMax: 10,
          minLabel: "0 - Pouco provável",
          maxLabel: "10 - Muito provável"
        },
        {
          id: "sat_2",
          label: "Qual foi o principal fator para a sua pontuação?",
          type: "textarea",
          required: true,
          placeholder: "Conte-nos o que mais pesou na sua avaliação..."
        },
        {
          id: "sat_3",
          label: "Quais aspectos mais se destacaram positivamente?",
          type: "checkbox",
          required: false,
          options: [
            "Atendimento da equipe",
            "Prazo e pontualidade",
            "Qualidade técnica da entrega",
            "Clareza na comunicação",
            "Relação custo-benefício"
          ]
        },
        {
          id: "sat_4",
          label: "O que podemos fazer para melhorar ainda mais sua experiência?",
          type: "textarea",
          required: false
        }
      ]
    }
  ]
};
