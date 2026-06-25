/**
 * Configurações de nicho para geração de protótipos.
 * Cada entrada define copy, CTAs, estatísticas de prova social e badges
 * específicos para aquele segmento — eliminando genéricos.
 *
 * Referências visuais: ShadCN UI, MagicUI, ReactBits, 21st.dev, getdesigner.md
 */

const NICHE_CONFIGS = {
  odontologia: {
    label: 'Clínica Odontológica',
    fontPair: { heading: 'Plus+Jakarta+Sans:wght@600;700;800', body: 'Inter:wght@400;500;600' },
    heroCopy: {
      eyebrow: 'Especialistas em saúde bucal',
      ctaPrimary: 'Agendar consulta',
      ctaSecondary: 'Ver tratamentos',
    },
    sectionLabels: {
      services: 'Tratamentos',
      servicesEyebrow: 'O que oferecemos',
      proof: 'Resultados que falam por si',
      proofEyebrow: 'Nossa trajetória',
      about: 'Quem somos',
      process: 'Como funciona',
    },
    proofStats: [
      { suffix: '+', label: 'Pacientes atendidos' },
      { suffix: ' anos', label: 'De experiência' },
      { value: '4.9★', label: 'Avaliação média Google' },
    ],
    processoSteps: [
      { n: '1', title: 'Agendamento', desc: 'Escolha data e horário online ou por telefone em menos de 2 minutos.' },
      { n: '2', title: 'Avaliação', desc: 'O especialista analisa sua situação e apresenta o plano de tratamento ideal.' },
      { n: '3', title: 'Tratamento', desc: 'Procedimento realizado com conforto, tecnologia moderna e total segurança.' },
    ],
    trustBadges: ['Clínica autorizada CFO', 'Atendemos convênios', 'Emergência 24h'],
    ctaFinal: 'Agendar minha consulta',
    ctaFinalSub: 'Primeira avaliação gratuita para novos pacientes.',
    accentStyle: 'health',
  },

  advocacia: {
    label: 'Escritório de Advocacia',
    fontPair: { heading: 'Playfair+Display:wght@600;700', body: 'Inter:wght@400;500;600' },
    heroCopy: {
      eyebrow: 'Proteção jurídica de quem entende o seu caso',
      ctaPrimary: 'Consulta gratuita',
      ctaSecondary: 'Conheça as áreas',
    },
    sectionLabels: {
      services: 'Áreas de Atuação',
      servicesEyebrow: 'Especialidades jurídicas',
      proof: 'Histórico que comprova',
      proofEyebrow: 'Nossa experiência',
      about: 'O escritório',
      process: 'Como te atendemos',
    },
    proofStats: [
      { suffix: '+', label: 'Casos atendidos' },
      { suffix: ' anos', label: 'De atuação no mercado' },
      { value: '94%', label: 'Taxa de êxito nos casos' },
    ],
    processoSteps: [
      { n: '1', title: 'Consulta inicial', desc: 'Análise do seu caso com sigilo absoluto e sem compromisso.' },
      { n: '2', title: 'Estratégia jurídica', desc: 'Desenvolvemos o melhor caminho legal para seu objetivo.' },
      { n: '3', title: 'Acompanhamento', desc: 'Você é atualizado em todas as fases do processo.' },
    ],
    trustBadges: ['OAB Registrado', 'Atendimento em todo Brasil', 'Sigilo garantido'],
    ctaFinal: 'Solicitar consulta gratuita',
    ctaFinalSub: 'Sem compromisso. Análise do seu caso em até 24h.',
    accentStyle: 'authority',
  },

  imoveis: {
    label: 'Imobiliária',
    fontPair: { heading: 'Plus+Jakarta+Sans:wght@600;700;800', body: 'Inter:wght@400;500;600' },
    heroCopy: {
      eyebrow: 'O imóvel certo, no lugar certo',
      ctaPrimary: 'Ver imóveis disponíveis',
      ctaSecondary: 'Falar com corretor',
    },
    sectionLabels: {
      services: 'Nossos Serviços',
      servicesEyebrow: 'Tudo para sua transação',
      proof: 'Números que comprovam',
      proofEyebrow: 'Nossa presença no mercado',
      about: 'Quem somos',
      process: 'Como compramos/vendemos',
    },
    proofStats: [
      { suffix: '+', label: 'Imóveis negociados' },
      { suffix: ' anos', label: 'De mercado imobiliário' },
      { value: '98%', label: 'Clientes satisfeitos' },
    ],
    processoSteps: [
      { n: '1', title: 'Consulta', desc: 'Entendemos seus objetivos e apresentamos as melhores opções.' },
      { n: '2', title: 'Visitas', desc: 'Organizamos visitas aos imóveis selecionados no seu tempo.' },
      { n: '3', title: 'Fechamento', desc: 'Cuidamos de toda a documentação e transferência com segurança.' },
    ],
    trustBadges: ['CRECI Ativo', 'Avaliação gratuita', 'Financiamento facilitado'],
    ctaFinal: 'Quero encontrar meu imóvel',
    ctaFinalSub: 'Fale com um corretor agora. Atendimento rápido e personalizado.',
    accentStyle: 'premium',
  },

  restaurante: {
    label: 'Restaurante',
    fontPair: { heading: 'Fraunces:wght@600;700', body: 'Inter:wght@400;500;600' },
    heroCopy: {
      eyebrow: 'Uma experiência gastronômica única',
      ctaPrimary: 'Ver cardápio',
      ctaSecondary: 'Fazer reserva',
    },
    sectionLabels: {
      services: 'Nosso Cardápio',
      servicesEyebrow: 'Destaques da cozinha',
      proof: 'Tradição em números',
      proofEyebrow: 'Nossa história',
      about: 'Nossa história',
      process: 'Como funciona',
    },
    proofStats: [
      { suffix: '+', label: 'Pratos exclusivos' },
      { suffix: ' anos', label: 'De tradição gastronômica' },
      { value: '4.8★', label: 'Avaliação no Google' },
    ],
    processoSteps: [
      { n: '1', title: 'Reserva online', desc: 'Reserve sua mesa em segundos pelo site ou WhatsApp.' },
      { n: '2', title: 'Chegue e seja recebido', desc: 'Mesa preparada, atendimento especial desde o primeiro momento.' },
      { n: '3', title: 'Aproveite', desc: 'Sabores autênticos, ambiente acolhedor, memórias inesquecíveis.' },
    ],
    trustBadges: ['Aberto todos os dias', 'Delivery disponível', 'Opções veganas'],
    ctaFinal: 'Fazer minha reserva',
    ctaFinalSub: 'Reserve agora e garanta sua mesa para o fim de semana.',
    accentStyle: 'warm',
  },

  beleza: {
    label: 'Estética e Beleza',
    fontPair: { heading: 'Plus+Jakarta+Sans:wght@600;700;800', body: 'Inter:wght@400;500;600' },
    heroCopy: {
      eyebrow: 'Realce a sua beleza natural',
      ctaPrimary: 'Agendar horário',
      ctaSecondary: 'Ver tratamentos',
    },
    sectionLabels: {
      services: 'Tratamentos',
      servicesEyebrow: 'Nossos serviços',
      proof: 'Resultados reais',
      proofEyebrow: 'Nossa trajetória',
      about: 'Sobre nós',
      process: 'Como funciona',
    },
    proofStats: [
      { suffix: '+', label: 'Clientes satisfeitas' },
      { suffix: '+', label: 'Tratamentos realizados' },
      { suffix: ' anos', label: 'De experiência em beleza' },
    ],
    processoSteps: [
      { n: '1', title: 'Agendamento', desc: 'Escolha seu serviço e horário de forma simples e rápida.' },
      { n: '2', title: 'Avaliação', desc: 'Analisamos seu perfil para indicar o tratamento ideal.' },
      { n: '3', title: 'Resultado', desc: 'Saia renovada, confiante e pronta para conquistar o mundo.' },
    ],
    trustBadges: ['Profissional certificada', 'Produtos premium', 'Agenda online'],
    ctaFinal: 'Agendar meu horário',
    ctaFinalSub: 'Vagas limitadas. Reserve o seu horário agora.',
    accentStyle: 'feminine',
  },

  academia: {
    label: 'Academia e Fitness',
    fontPair: { heading: 'Plus+Jakarta+Sans:wght@700;800', body: 'Inter:wght@400;500;600' },
    heroCopy: {
      eyebrow: 'Sua transformação começa aqui',
      ctaPrimary: 'Conhecer planos',
      ctaSecondary: 'Agendar visita',
    },
    sectionLabels: {
      services: 'Modalidades',
      servicesEyebrow: 'O que oferecemos',
      proof: 'Nossa comunidade',
      proofEyebrow: 'Números que motivam',
      about: 'Sobre a academia',
      process: 'Como começar',
    },
    proofStats: [
      { suffix: '+', label: 'Membros ativos' },
      { suffix: '', label: 'Modalidades disponíveis' },
      { suffix: '', label: 'Instrutores especializados' },
    ],
    processoSteps: [
      { n: '1', title: 'Visita gratuita', desc: 'Conheça a estrutura, instrutores e modalidades sem compromisso.' },
      { n: '2', title: 'Avaliação física', desc: 'Avaliação completa para montar seu plano de treino personalizado.' },
      { n: '3', title: 'Comece a treinar', desc: 'Primeiro mês com acompanhamento intenso para garantir sua evolução.' },
    ],
    trustBadges: ['Equipamentos modernos', 'Personal trainers', 'Primeiro mês com desconto'],
    ctaFinal: 'Começar minha transformação',
    ctaFinalSub: 'Primeira visita gratuita. Sem burocracia.',
    accentStyle: 'energetic',
  },

  tecnologia: {
    label: 'Tecnologia e Software',
    fontPair: { heading: 'Space+Grotesk:wght@600;700', body: 'Inter:wght@400;500;600' },
    heroCopy: {
      eyebrow: 'Tecnologia que resolve de verdade',
      ctaPrimary: 'Solicitar demonstração',
      ctaSecondary: 'Ver funcionalidades',
    },
    sectionLabels: {
      services: 'Funcionalidades',
      servicesEyebrow: 'O que a plataforma faz',
      proof: 'Empresas que confiam',
      proofEyebrow: 'Nossa escala',
      about: 'Quem somos',
      process: 'Como funciona',
    },
    proofStats: [
      { suffix: '+', label: 'Empresas ativas' },
      { suffix: '+', label: 'Integrações disponíveis' },
      { value: '99.9%', label: 'Uptime garantido' },
    ],
    processoSteps: [
      { n: '1', title: 'Onboarding', desc: 'Configuração guiada em menos de 30 minutos. Sem necessidade técnica.' },
      { n: '2', title: 'Integração', desc: 'Conectamos com as ferramentas que você já usa. Tudo automatizado.' },
      { n: '3', title: 'Escale', desc: 'Dashboards em tempo real para tomada de decisão baseada em dados.' },
    ],
    trustBadges: ['Suporte 24/7', 'Dados criptografados', 'Conformidade LGPD'],
    ctaFinal: 'Solicitar demonstração gratuita',
    ctaFinalSub: 'Nenhum cartão necessário. Configure em menos de 30 minutos.',
    accentStyle: 'tech',
  },

  contabilidade: {
    label: 'Contabilidade',
    fontPair: { heading: 'Plus+Jakarta+Sans:wght@600;700;800', body: 'Inter:wght@400;500;600' },
    heroCopy: {
      eyebrow: 'Gestão financeira que protege seu negócio',
      ctaPrimary: 'Solicitar análise gratuita',
      ctaSecondary: 'Conhecer serviços',
    },
    sectionLabels: {
      services: 'Serviços Contábeis',
      servicesEyebrow: 'O que fazemos por você',
      proof: 'Nossa expertise',
      proofEyebrow: 'Números que comprovam',
      about: 'O escritório',
      process: 'Como trabalhamos',
    },
    proofStats: [
      { suffix: '+', label: 'Empresas atendidas' },
      { suffix: ' anos', label: 'De experiência contábil' },
      { suffix: '+', label: 'Setores de atuação' },
    ],
    processoSteps: [
      { n: '1', title: 'Diagnóstico', desc: 'Análise gratuita da situação fiscal e oportunidades de economia.' },
      { n: '2', title: 'Planejamento', desc: 'Estratégia tributária e financeira adaptada ao seu negócio.' },
      { n: '3', title: 'Execução', desc: 'Entregáveis mensais pontuais com relatórios claros e assessoria constante.' },
    ],
    trustBadges: ['CRC Registrado', 'Mais de 10 segmentos', 'Relatórios mensais'],
    ctaFinal: 'Solicitar análise gratuita',
    ctaFinalSub: 'Descobrimos quanto sua empresa pode economizar em impostos.',
    accentStyle: 'authority',
  },

  educacao: {
    label: 'Educação e Cursos',
    fontPair: { heading: 'Plus+Jakarta+Sans:wght@600;700;800', body: 'Inter:wght@400;500;600' },
    heroCopy: {
      eyebrow: 'Conhecimento que abre portas',
      ctaPrimary: 'Ver cursos disponíveis',
      ctaSecondary: 'Falar com orientador',
    },
    sectionLabels: {
      services: 'Cursos Disponíveis',
      servicesEyebrow: 'Nossa grade completa',
      proof: 'Impacto real',
      proofEyebrow: 'Resultados dos nossos alunos',
      about: 'Nossa missão',
      process: 'Como funciona',
    },
    proofStats: [
      { suffix: '+', label: 'Alunos formados' },
      { suffix: '', label: 'Cursos disponíveis' },
      { suffix: 'h+', label: 'De conteúdo produzido' },
    ],
    processoSteps: [
      { n: '1', title: 'Escolha seu curso', desc: 'Navegue pela grade e encontre o curso que transforma sua carreira.' },
      { n: '2', title: 'Matrícula online', desc: 'Processo 100% digital, simples e sem filas.' },
      { n: '3', title: 'Aprenda e evolua', desc: 'Conteúdo prático, professores experientes e certificado reconhecido.' },
    ],
    trustBadges: ['Certificado reconhecido', 'Aulas online e presenciais', 'Suporte pedagógico'],
    ctaFinal: 'Garantir minha vaga',
    ctaFinalSub: 'Vagas limitadas por turma. Inscreva-se agora.',
    accentStyle: 'modern',
  },

  saude: {
    label: 'Clínica de Saúde',
    fontPair: { heading: 'Plus+Jakarta+Sans:wght@600;700;800', body: 'Inter:wght@400;500;600' },
    heroCopy: {
      eyebrow: 'Saúde que cuida de verdade',
      ctaPrimary: 'Agendar consulta',
      ctaSecondary: 'Ver especialidades',
    },
    sectionLabels: {
      services: 'Especialidades',
      servicesEyebrow: 'Nossa área de atuação',
      proof: 'Nossa trajetória',
      proofEyebrow: 'Números que inspiram confiança',
      about: 'Nossa equipe',
      process: 'Como funciona',
    },
    proofStats: [
      { suffix: '+', label: 'Consultas realizadas' },
      { suffix: '', label: 'Especialidades médicas' },
      { suffix: '+', label: 'Convênios aceitos' },
    ],
    processoSteps: [
      { n: '1', title: 'Agendamento rápido', desc: 'Marque sua consulta por telefone, WhatsApp ou app em minutos.' },
      { n: '2', title: 'Atendimento humanizado', desc: 'Profissionais dedicados a entender sua necessidade individualmente.' },
      { n: '3', title: 'Acompanhamento', desc: 'Cuidamos da sua saúde antes, durante e depois do tratamento.' },
    ],
    trustBadges: ['Convênios aceitos', 'Equipe especializada', 'Resultados em 24h'],
    ctaFinal: 'Agendar minha consulta',
    ctaFinalSub: 'Atendimento presencial e teleconsulta disponíveis.',
    accentStyle: 'health',
  },

  default: {
    label: 'Negócio Local',
    fontPair: { heading: 'Plus+Jakarta+Sans:wght@600;700;800', body: 'Inter:wght@400;500;600' },
    heroCopy: {
      eyebrow: 'Qualidade e resultado para o seu negócio',
      ctaPrimary: 'Solicitar orçamento',
      ctaSecondary: 'Conhecer serviços',
    },
    sectionLabels: {
      services: 'Serviços',
      servicesEyebrow: 'O que fazemos',
      proof: 'Nossa trajetória',
      proofEyebrow: 'Números que comprovam',
      about: 'Quem somos',
      process: 'Como trabalhamos',
    },
    proofStats: [
      { suffix: '+', label: 'Clientes atendidos' },
      { suffix: ' anos', label: 'De experiência no mercado' },
      { suffix: '+', label: 'Projetos concluídos' },
    ],
    processoSteps: [
      { n: '1', title: 'Primeiro contato', desc: 'Converse com nossa equipe e apresente o que você precisa.' },
      { n: '2', title: 'Proposta personalizada', desc: 'Preparamos uma solução sob medida para o seu caso.' },
      { n: '3', title: 'Execução e entrega', desc: 'Acompanhamento em cada etapa com qualidade garantida.' },
    ],
    trustBadges: ['Atendimento personalizado', 'Garantia de qualidade', 'Suporte dedicado'],
    ctaFinal: 'Solicitar orçamento gratuito',
    ctaFinalSub: 'Resposta em menos de 24 horas.',
    accentStyle: 'modern',
  },
};

/**
 * Resolve a configuração de nicho a partir do texto de nicho e contexto do lead.
 * Retorna sempre um objeto completo — nunca undefined.
 */
function resolveNicheConfig(niche = '', leadContext = {}) {
  const sample = `${niche} ${leadContext?.nicho || ''} ${leadContext?.nome || ''} ${leadContext?.categoria || ''}`.toLowerCase();

  if (/odont|dentist|sorriso|clínica.*buc|buco/.test(sample)) return { key: 'odontologia', ...NICHE_CONFIGS.odontologia };
  if (/advoc|juríd|juridic|direito|escritório.*lei|oab/.test(sample)) return { key: 'advocacia', ...NICHE_CONFIGS.advocacia };
  if (/imobili|imóvel|imovel|corretor|loteament|zap.*imov/.test(sample)) return { key: 'imoveis', ...NICHE_CONFIGS.imoveis };
  if (/restaurante|pizzar|hamburgue|culinár|culinari|cardápio|comida|bar|lanchon/.test(sample)) return { key: 'restaurante', ...NICHE_CONFIGS.restaurante };
  if (/beleza|estética|estetica|salão|salao|barbear|unhas|cabelo|maquiagem|spa/.test(sample)) return { key: 'beleza', ...NICHE_CONFIGS.beleza };
  if (/academia|fitness|musculac|crossfit|personal|pilates|yoga/.test(sample)) return { key: 'academia', ...NICHE_CONFIGS.academia };
  if (/saas|software|tecnolog|sistema|plataforma|startup|dev|programac/.test(sample)) return { key: 'tecnologia', ...NICHE_CONFIGS.tecnologia };
  if (/contábil|contabil|contador|fiscal|tribut|imposto|irpf|cnpj/.test(sample)) return { key: 'contabilidade', ...NICHE_CONFIGS.contabilidade };
  if (/escola|curso|ensino|colégio|colegio|educac|universid|faculdade/.test(sample)) return { key: 'educacao', ...NICHE_CONFIGS.educacao };
  if (/clínica|clinica|médic|medic|saúde|saude|hospital|psicolog|nutric|fisioter|ortoped|dermato|pediatr/.test(sample)) return { key: 'saude', ...NICHE_CONFIGS.saude };

  return { key: 'default', ...NICHE_CONFIGS.default };
}

module.exports = { NICHE_CONFIGS, resolveNicheConfig };
