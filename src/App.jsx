import React, { useState, useEffect, useRef } from 'react';
import {
  MousePointer2, ExternalLink, X, Check, FolderPlus, Camera, Pin,
  Paperclip, Edit3, FileText, Linkedin, ShieldAlert, Eye, EyeOff,
  LayoutDashboard, Search, LayoutTemplate, Layers, SearchCheck, Mail, Send,
  MessageCircle, Filter, History, ChevronDown, Clock, Phone, Users, FileCheck,
  Zap, Activity, Target, CheckCircle, MapPin, Globe, Settings, Lock, Hash, PenTool, Server, Save,
  Download, BookOpen,
  MoreHorizontal, Info, Calendar, ListFilter, ChevronLeft, ChevronRight, Bot, Bell, Radio, Trash2,
  Rocket
} from 'lucide-react';
import { buildWhatsappUrl } from './whatsappMessage.mjs';

const ASSINATURA_PATH = 'Assinatura.png';
const ASSINATURA_CID = 'assinatura-caplead';

const SMTP_PRESETS = {
  gmail: {
    label: 'Gmail',
    host: 'smtp.gmail.com',
    port: '465',
    secure: true,
    hint: 'Use a Senha de App do Google com verificação em 2 etapas ativa.'
  },
  outlook: {
    label: 'Outlook / Microsoft 365',
    host: 'smtp.office365.com',
    port: '587',
    secure: false,
    hint: 'Use sua conta Microsoft autorizada para SMTP autenticado.'
  },
  custom: {
    label: 'SMTP personalizado',
    host: '',
    port: '587',
    secure: false,
    hint: 'Informe os dados do provedor do usuário.'
  }
};

const DEFAULT_SMTP_USER = 'kentaurusti@gmail.com';
const CAPTURE_MIN_LIMIT = 1;
const CAPTURE_MAX_LIMIT = 50;
const DEFAULT_CAPTURE_LIMIT = 20;
const EMAIL_SAFE_DAILY_LIMIT = 80;
const EMAIL_SAFE_BATCH_LIMIT = 40;
const EMAIL_SEND_DELAY_MS = 2500;

const getCaptureContactLabel = ({ requireEmail, requireWhatsapp } = {}) => {
  if (requireEmail && requireWhatsapp) return 'com e-mail e WhatsApp';
  if (requireEmail) return 'com e-mail';
  if (requireWhatsapp) return 'com WhatsApp';
  return 'novos';
};

const normalizeSmtpSecure = (port, secureValue) => {
  const numericPort = Number(port);
  if (numericPort === 465) return true;
  if (numericPort === 587 || numericPort === 25) return false;
  return Boolean(secureValue);
};

export default function App() {
  const [activeMenu, setActiveMenu] = useState('geral');
  const [metrics, setMetrics] = useState({ totalLeads: 0, analyzedToday: 0 });
  const [latestAnalyses, setLatestAnalyses] = useState([]);
  
  const [sites, setSites] = useState([]);
  const [sistemas, setSistemas] = useState([]);
  const [linkedin, setLinkedin] = useState([]);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [captureStatus, setCaptureStatus] = useState(null);
  const [bulkProgress, setBulkProgress] = useState(null);
  const [bulkSummary, setBulkSummary] = useState(null);
  const [automationSummary, setAutomationSummary] = useState(null);
  const [wppFilter, setWppFilter] = useState(false); // false = todos, true = apenas não contatados por Wpp
  const bulkCancelRef = useRef(false); // sinal de cancelamento para loops em lote

  // CRM Modal state
  const [crmModal, setCrmModal] = useState(null); // { lead, typeCode, interacoes, funil }
  const [crmForm, setCrmForm] = useState({ canal: 'email', descricao: '' });
  const [crmFunil, setCrmFunil] = useState({ status: 'novo', proximoPasso: '', followupDate: '' });
  const [crmLoading, setCrmLoading] = useState(false);

  // Email Preview Modal state
  const [emailPreviewModal, setEmailPreviewModal] = useState(null); // { leads: [], typeCode: '', template: { assunto: '', corpo: '' } }

  // Capture Form State
  const [captureForm, setCaptureForm] = useState({
    nicho: '',
    regiao: '',
    tipo: 'sites', // sites, sistemas, linkedin
    onlyWithoutSite: false,
    requireEmail: false,
    requireWhatsapp: false,
    systemCaptureMode: 'all',
    limit: DEFAULT_CAPTURE_LIMIT
  });

  const [showNichoDropdown, setShowNichoDropdown] = useState(false);
  const [showRegiaoDropdown, setShowRegiaoDropdown] = useState(false);

  const NICHO_OPTIONS = [
    "Clínicas Odontológicas", "Clínicas Médicas", "Psicologia", "Fisioterapia",
    "Nutrição", "Dermatologia", "Veterinária", "E-commerce", "Restaurantes",
    "Pizzarias", "Hamburguerias", "Padarias", "Imobiliárias", "Construtoras",
    "Arquitetura", "Engenharia", "Advocacia", "Contabilidade", "Consultoria Financeira",
    "Estética e Beleza", "Salões de Beleza", "Barbearias", "Academias", "Escolas",
    "Cursos Profissionalizantes", "Tecnologia e Software", "Marketing Digital",
    "Agências de Publicidade", "Indústria", "Varejo", "Lojas de Roupas",
    "Oficinas Mecânicas", "Concessionárias", "Logística", "Transportadoras",
    "Buffets e Eventos", "Hotéis e Pousadas", "Turismo", "Pet Shops"
  ];

  const REGIAO_OPTIONS = [
    "São Paulo, SP", "Rio de Janeiro, RJ", "Belo Horizonte, MG", "Curitiba, PR",
    "Porto Alegre, RS", "Brasília, DF", "Salvador, BA", "Fortaleza, CE",
    "Recife, PE", "Goiânia, GO", "Manaus, AM", "Campinas, SP", "Guarulhos, SP",
    "Osasco, SP", "Santo André, SP", "São Bernardo do Campo, SP", "Santos, SP",
    "Ribeirão Preto, SP", "Sorocaba, SP", "São José dos Campos, SP",
    "Contagem, MG", "Uberlândia, MG", "Juiz de Fora, MG", "Betim, MG",
    "Niterói, RJ", "Duque de Caxias, RJ", "Nova Iguaçu, RJ",
    "Florianópolis, SC", "Joinville, SC", "Blumenau, SC",
    "Londrina, PR", "Maringá, PR", "Foz do Iguaçu, PR",
    "Caxias do Sul, RS", "Canoas, RS", "Pelotas, RS",
    "Vitória, ES", "Vila Velha, ES", "Serra, ES",
    "Natal, RN", "João Pessoa, PB", "Maceió, AL", "Aracaju, SE",
    "São Luís, MA", "Teresina, PI", "Belém, PA", "Ananindeua, PA",
    "Cuiabá, MT", "Campo Grande, MS", "Palmas, TO", "Porto Velho, RO",
    "Boa Vista, RR", "Macapá, AP", "Rio Branco, AC", "Brasil"
  ];

  // SMTP Settings
  const [smtpConfig, setSmtpConfig] = useState({
    preset: 'gmail',
    host: '',
    port: '',
    secure: true,
    user: '',
    pass: '',
    signatureName: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [smtpStatus, setSmtpStatus] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Kentauros Integration State
  const [kentaurosConfig, setKentaurosConfig] = useState({
    url: 'https://kentauros-os-app.vercel.app',
    enabled: true,
    tenantId: 'tenant-a',
    userId: 1,
  });
  const [kentaurosExportStatus, setKentaurosExportStatus] = useState(null); // { exporting, success, message }
  const [excelExportStatus, setExcelExportStatus] = useState(null); // { exporting, message }

  // Filters State
  const [gridFilters, setGridFilters] = useState({
    source: 'todos',
    date: 'todos',
    hasEmail: false,
    hasWpp: false,
    wppSent: false,
    highOpportunity: false,
    followupDue: false
  });

  // Details Modal State
  const [leadDetailsModal, setLeadDetailsModal] = useState(null);
  const [leadContacts, setLeadContacts] = useState([]);
  const [manualEmailInput, setManualEmailInput] = useState('');
  const [manualEmailSaving, setManualEmailSaving] = useState(false);
  const [showFixedPhone, setShowFixedPhone] = useState(false);
  const [appDialog, setAppDialog] = useState(null);
  const [layoutGeneratingLeadId, setLayoutGeneratingLeadId] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(null); // ID of lead with open dropdown
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedLeadKeys, setSelectedLeadKeys] = useState([]);
  const siteLeadsGrid = sites.filter(lead => !lead.email_enviado && !lead.wpp_enviado);
  const validatedLeadsGrid = [
    ...sites.filter(lead => lead.is_validated || lead.email_enviado || lead.wpp_enviado).map(lead => ({ ...lead, _typeCode: 'sites' })),
    ...sistemas.filter(lead => lead.is_validated || lead.email_enviado || lead.wpp_enviado).map(lead => ({ ...lead, _typeCode: 'sistema' })),
    ...linkedin.filter(lead => lead.is_validated || lead.email_enviado || lead.wpp_enviado).map(lead => ({ ...lead, _typeCode: 'linkedin' }))
  ];
  const whatsappCommercialLeads = validatedLeadsGrid.filter(lead => lead.telefone);
  const whatsappUnreadCount = 0;
  const whatsappScheduledCount = 0;

  // Reset pagination when changing menu or filters
  useEffect(() => {
    setCurrentPage(1);
    setSelectedLeadKeys([]);
  }, [activeMenu, gridFilters, wppFilter]);

  useEffect(() => {
    const activeListSize =
      activeMenu === 'sites' ? siteLeadsGrid.length :
      activeMenu === 'sistemas' ? sistemas.length :
      activeMenu === 'linkedin' ? linkedin.length :
      activeMenu === 'validados' ? validatedLeadsGrid.length :
      0;
    const maxPage = Math.max(1, Math.ceil(activeListSize / itemsPerPage));
    if (currentPage > maxPage) setCurrentPage(maxPage);
  }, [activeMenu, siteLeadsGrid.length, sistemas.length, linkedin.length, validatedLeadsGrid.length, itemsPerPage, currentPage]);

  const handleOpenDetails = async (lead) => {
    setLeadDetailsModal(lead);
    setManualEmailInput('');
    setShowFixedPhone(false);
    try {
      const res = await window.electronAPI.getContatos(lead.id);
      if (res.success) {
        setLeadContacts(res.data);
      } else {
        setLeadContacts([]);
      }
    } catch (err) {
      console.error('Erro ao buscar contatos:', err);
      setLeadContacts([]);
    }
  };

  const handleCloseDetails = () => {
    setLeadDetailsModal(null);
    setLeadContacts([]);
    setManualEmailInput('');
    setShowFixedPhone(false);
  };

  const handleAddManualEmail = async (lead) => {
    const email = manualEmailInput.trim();
    if (!emailRegex.test(email)) {
      showAppAlert({
        title: 'E-mail inválido',
        message: 'Informe um e-mail válido para vincular manualmente ao lead.'
      });
      return;
    }

    setManualEmailSaving(true);
    try {
      const res = await window.electronAPI.createContato({
        lead_id: lead.id,
        email,
        telefone: null,
        fonte: 'Manual'
      });

      if (!res?.success) {
        showAppAlert({
          title: 'Não foi possível salvar',
          message: res?.error || 'Tente novamente em alguns instantes.'
        });
        return;
      }

      const refreshed = await window.electronAPI.getContatos(lead.id);
      setLeadContacts(refreshed?.success ? refreshed.data : []);
      setManualEmailInput('');
      showAppAlert({
        title: 'E-mail vinculado',
        message: 'O contato manual foi salvo e já pode ser usado no envio.'
      });
    } catch (err) {
      showAppAlert({
        title: 'Erro ao salvar e-mail',
        message: err.message || 'Não foi possível vincular este e-mail ao lead.'
      });
    } finally {
      setManualEmailSaving(false);
    }
  };

  const getLeadName = (lead) => lead?.nome || lead?.titulo || lead?.empresa || 'Responsável';

  const getLeadUrl = (lead) => lead?.url || lead?.site_oficial || lead?.developer_site || lead?.app_store_url || '';

  const getLeadCategory = (lead) => {
    const rawCategory = String(lead?.categoria || lead?.nicho || lead?.app_category || '').trim();
    const invalidCategory = !rawCategory || rawCategory.toLowerCase() === 'geral' || /^[\W_]+$/u.test(rawCategory);
    if (!invalidCategory) return rawCategory;

    const signal = [
      lead?.nome,
      lead?.titulo,
      lead?.empresa,
      lead?.descricao,
      lead?.url,
      lead?.site_oficial
    ].filter(Boolean).join(' ').toLowerCase();

    const categoryRules = [
      { label: 'Imobiliária / Imóveis', terms: ['imobili', 'imóvel', 'imoveis', 'imóveis', 'corretor', 'apartamento', 'condomínio'] },
      { label: 'Advocacia / Jurídico', terms: ['advoc', 'jurídic', 'juridic', 'direito', 'advogado'] },
      { label: 'Estética e Beleza', terms: ['beleza', 'salon', 'salao', 'salão', 'cabelo', 'barbearia', 'estética', 'estetica'] },
      { label: 'Saúde / Clínica', terms: ['clínica', 'clinica', 'médic', 'medic', 'odont', 'dent', 'fisioterapia', 'psicolog'] },
      { label: 'Restaurante / Alimentação', terms: ['restaurante', 'pizzaria', 'bar ', 'lanchonete', 'burger', 'food'] },
      { label: 'Educação / Ensino', terms: ['escola', 'curso', 'faculdade', 'ensino', 'colégio', 'colegio'] },
      { label: 'Tecnologia / Software', terms: ['software', 'tecnologia', 'sistema', 'app ', 'digital', 'ti '] },
      { label: 'Contabilidade / Financeiro', terms: ['contab', 'financeir', 'contador'] }
    ];

    return categoryRules.find(rule => rule.terms.some(term => signal.includes(term)))?.label || 'Categoria não identificada';
  };

  const getLeadAiScore = (lead, typeCode = 'sites') => Number(typeCode === 'sistema' ? lead?.score_ux : lead?.score_design) || 0;

  const getCommercialScore = (lead, typeCode = 'sites') => {
    const aiScore = getLeadAiScore(lead, typeCode);
    let score = 30;
    if (lead?.has_email_count > 0 || lead?.email) score += 22;
    if (lead?.telefone) score += 12;
    if (getLeadUrl(lead)) score += 12;
    if (aiScore > 0 && aiScore <= 45) score += 16;
    if (aiScore > 45 && aiScore <= 70) score += 10;
    if (lead?.problemas) score += 8;
    if (lead?.layout_status === 'success' || lead?.layout_status === 'gerado') score += 10;
    if (lead?.email_enviado || lead?.wpp_enviado) score -= 16;
    return Math.max(0, Math.min(100, score));
  };

  const getOpportunityLevel = (score) => {
    if (score >= 78) return { label: 'Alta', color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' };
    if (score >= 58) return { label: 'Média', color: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/30' };
    return { label: 'Baixa', color: 'text-slate-400', bg: 'bg-slate-500/15', border: 'border-slate-500/20' };
  };

  const getNextBestAction = (lead, typeCode = 'sites') => {
    if (isFollowupDue(lead)) {
      return { label: 'Fazer follow-up', icon: <Clock size={12} />, color: 'text-red-300' };
    }
    if (lead?.email_enviado && !lead?.respondeu_email) {
      return { label: 'Acompanhar retorno', icon: <History size={12} />, color: 'text-amber-300' };
    }
    if (lead?.layout_status === 'success' || lead?.layout_status === 'gerado') {
      return { label: 'Enviar proposta visual', icon: <Send size={12} />, color: 'text-emerald-400' };
    }
    if (lead?.has_email_count > 0 || lead?.email) {
      return { label: 'Enviar e-mail consultivo', icon: <Mail size={12} />, color: 'text-primary' };
    }
    if (getLeadUrl(lead) && typeCode === 'sites') {
      return { label: 'Capturar contato', icon: <SearchCheck size={12} />, color: 'text-cyan-300' };
    }
    if (lead?.telefone) {
      return { label: 'Abordar via WhatsApp', icon: <MessageCircle size={12} />, color: 'text-green-400' };
    }
    return { label: 'Revisar lead', icon: <Info size={12} />, color: 'text-slate-400' };
  };

  const getFollowupStatus = (lead) => {
    if (!lead?.followup_date) return { label: 'Sem follow-up', state: 'none', color: 'text-slate-500', bg: 'bg-slate-500/10', border: 'border-slate-500/20' };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const followup = new Date(`${lead.followup_date}T00:00:00`);
    const diffDays = Math.round((followup - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: `Atrasado ${Math.abs(diffDays)}d`, state: 'overdue', color: 'text-red-300', bg: 'bg-red-500/15', border: 'border-red-500/30' };
    if (diffDays === 0) return { label: 'Hoje', state: 'today', color: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/30' };
    if (diffDays <= 3) return { label: `${diffDays}d`, state: 'soon', color: 'text-cyan-300', bg: 'bg-cyan-500/15', border: 'border-cyan-500/30' };
    return { label: new Date(`${lead.followup_date}T00:00:00`).toLocaleDateString('pt-BR'), state: 'scheduled', color: 'text-slate-300', bg: 'bg-white/5', border: 'border-white/10' };
  };

  const isFollowupDue = (lead) => ['overdue', 'today'].includes(getFollowupStatus(lead).state);

  const addDaysIso = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isMissingContactValue = (value) => {
    const text = String(value || '').trim();
    return !text || /^(nao encontrado|não encontrado|n\/a|null|undefined)$/i.test(text);
  };

  const getUniqueContactEmails = (contacts = []) => {
    const seen = new Set();
    return contacts
      .map(contact => ({
        email: String(contact?.email || '').trim(),
        fonte: contact?.fonte || 'Capturado'
      }))
      .filter(contact => !isMissingContactValue(contact.email) && emailRegex.test(contact.email))
      .filter(contact => {
        const key = contact.email.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };

  const getValidEmailFromContacts = (contacts = []) => getUniqueContactEmails(contacts)[0]?.email || '';

  const normalizeBrazilPhoneDigits = (value = '') => {
    let digits = String(value || '').replace(/\D/g, '');
    if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
      digits = digits.slice(2);
    }
    return digits;
  };

  const formatBrazilPhone = (digits = '') => {
    if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return digits || 'Não encontrado';
  };

  const classifyBrazilPhone = (value = '') => {
    const digits = normalizeBrazilPhoneDigits(value);
    if (/^\d{2}9\d{8}$/.test(digits)) {
      return { type: 'mobile', digits, label: formatBrazilPhone(digits) };
    }
    if (/^\d{2}\d{8}$/.test(digits)) {
      return { type: 'fixed', digits, label: formatBrazilPhone(digits) };
    }
    if (digits) return { type: 'unknown', digits, label: formatBrazilPhone(digits) };
    return { type: 'none', digits: '', label: '' };
  };

  const getBestPhoneForLead = (lead, contacts = []) => {
    const values = [lead?.telefone, ...contacts.map(contact => contact?.telefone)]
      .filter(value => !isMissingContactValue(value));
    const classified = values.map(value => classifyBrazilPhone(value)).filter(item => item.type !== 'none');
    return classified.find(item => item.type === 'mobile') || classified.find(item => item.type === 'fixed') || classified[0] || classifyBrazilPhone('');
  };

  const getLeadEmail = async (lead) => {
    if (lead?.email && lead.email.trim()) return lead.email.trim();
    if (lead?.developer_email && lead.developer_email.trim()) return lead.developer_email.trim();
    const cachedEmail = leadDetailsModal?.id === lead?.id ? getValidEmailFromContacts(leadContacts) : '';
    if (cachedEmail) return cachedEmail;

    try {
      const res = await window.electronAPI.getContatos(lead.id);
      if (res.success) return getValidEmailFromContacts(res.data);
    } catch (err) {
      console.error('Erro ao resolver e-mail do lead:', err);
    }
    return '';
  };

  const resolveLeadEmailForSending = async (lead) => {
    const currentEmail = await getLeadEmail(lead);
    if (currentEmail) return currentEmail;

    const leadUrl = getLeadUrl(lead);
    if (!leadUrl || !window.electronAPI.extractContact) return '';

    try {
      const res = await window.electronAPI.extractContact({
        id: lead.id,
        url: leadUrl.startsWith('http') ? leadUrl : `https://${leadUrl}`
      });
      if (res?.success) {
        const refreshed = await window.electronAPI.getContatos(lead.id);
        if (refreshed.success) return getValidEmailFromContacts(refreshed.data);
      }
    } catch (err) {
      console.warn('Falha ao tentar capturar e-mail antes do disparo:', err);
    }

    return '';
  };

  const getLeadProblemsList = (lead) => {
    if (!lead?.problemas) {
      return [
        'Visitantes podem sair antes de entender o principal valor da empresa.'
      ];
    }

    try {
      const parsed = JSON.parse(lead.problemas);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.map(problem => String(problem).replace(/^[\p{L} ]+:\s*/u, '').trim()).filter(Boolean);
      }
    } catch (err) {
      // Mantem compatibilidade com registros antigos em texto livre.
    }

    const problems = String(lead.problemas)
      .split(/\r?\n/)
      .map(item => item.trim())
      .filter(Boolean);

    return problems.length ? problems : [
      'Visitantes podem sair antes de entender o principal valor da empresa.'
    ];
  };

  const summarizeLeadConcern = (problem) => {
    const text = String(problem || '').toLowerCase();
    if (text.includes('mobile') || text.includes('celular') || text.includes('viewport') || text.includes('clicáveis')) {
      return 'A experiência no celular pode estar afastando contatos prontos para chamar.';
    }
    if (text.includes('performance') || text.includes('carreg') || text.includes('lento') || text.includes('javascript') || text.includes('lcp') || text.includes('fcp')) {
      return 'A lentidão pode estar fazendo possíveis clientes desistirem antes de ver a oferta.';
    }
    if (text.includes('seo') || text.includes('google') || text.includes('título') || text.includes('description') || text.includes('h1') || text.includes('indexação')) {
      return 'O site pode estar perdendo visibilidade em buscas de clientes locais.';
    }
    if (text.includes('cta') || text.includes('ação') || text.includes('botão')) {
      return 'O caminho para pedir contato não parece claro o suficiente.';
    }
    if (text.includes('design') || text.includes('layout') || text.includes('fonte') || text.includes('visual')) {
      return 'A primeira impressão pode estar reduzindo confiança e intenção de compra.';
    }
    return 'Alguns pontos da navegação podem estar reduzindo a conversão de visitantes.';
  };

  const getLeadProblems = (lead) => {
    const problems = [...new Set(getLeadProblemsList(lead).map(summarizeLeadConcern))].slice(0, 3);
    return [
      'Pontos identificados:',
      ...problems.map(problem => `- ${problem}`)
    ].join('\n');
  };

  const buildEmailSubject = (lead) => `${getLeadName(lead)}: pontos do site que podem reduzir contatos`;

  const buildEmailBody = (lead) => `Olá, equipe da ${getLeadName(lead)},

Analisei o site de vocês e identifiquei alguns pontos que podem estar dificultando o caminho entre o visitante interessado e o contato comercial.

São ajustes de apresentação, clareza e navegação que normalmente passam despercebidos no dia a dia, mas que influenciam diretamente confiança, permanência no site e intenção de chamar.

Preparei uma leitura direcionada ao cenário da ${getLeadName(lead)}, pensando em tornar a experiência mais clara, profissional e orientada à geração de contatos.

${getLeadProblems(lead)}

Posso te enviar uma proposta visual com melhorias aplicadas, mantendo a identidade da marca e destacando melhor os serviços, diferenciais e formas de contato.

Estamos à disposição,
${smtpConfig.signatureName || 'CapLead'} & Kentaurus TI`;

  const buildEmailBodyTemplate = (lead) => buildEmailBody(lead || {});

  const applyEmailTemplate = (template, lead) => template
    .replace(/{{nome}}/g, getLeadName(lead))
    .replace(/{{url}}/g, getLeadUrl(lead))
    .replace(/{{problemas}}/g, getLeadProblems(lead))
    .replace(/{{assinaturaNome}}/g, smtpConfig.signatureName || 'CapLead');

  const resolveEmailText = (text = '', lead) => applyEmailTemplate(text, lead);

  const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const parseEmailBody = (body = '') => {
    const lines = String(body).split(/\r?\n/).map(line => line.trim());
    const nonEmpty = lines.filter(Boolean);
    const greeting = nonEmpty[0] || 'Olá,';
    const pointsIndex = nonEmpty.findIndex(line => line.toLowerCase().includes('pontos identificados'));
    const signoffIndex = nonEmpty.findIndex(line => line.toLowerCase().startsWith('estamos à disposição'));
    const ctaIndex = nonEmpty.findIndex(line => line.toLowerCase().startsWith('posso te mostrar'));

    const introEnd = pointsIndex > -1 ? pointsIndex : (ctaIndex > -1 ? ctaIndex : signoffIndex);
    const intro = nonEmpty.slice(1, introEnd > -1 ? introEnd : nonEmpty.length).filter(line => !line.startsWith('-'));
    const pointsEnd = [ctaIndex, signoffIndex].filter(index => index > pointsIndex).sort((a, b) => a - b)[0] || nonEmpty.length;
    const points = pointsIndex > -1
      ? nonEmpty.slice(pointsIndex + 1, pointsEnd).filter(line => line.startsWith('-')).map(line => line.replace(/^-\s*/, ''))
      : [];
    const cta = ctaIndex > -1 ? nonEmpty[ctaIndex] : '';
    const signature = signoffIndex > -1 ? nonEmpty.slice(signoffIndex) : [];

    return { greeting, intro, points, cta, signature };
  };

  const renderEmailParagraphs = (paragraphs) => paragraphs
    .map(paragraph => `<p style="margin:0 0 16px; color:#243044; font-size:15px; line-height:1.65;">${escapeHtml(paragraph)}</p>`)
    .join('');

  const renderEmailPoints = (points) => {
    const finalPoints = points.length ? points : ['Alguns pontos da navegação podem estar reduzindo a conversão de visitantes.'];
    return finalPoints.map(point => `
      <tr>
        <td style="padding:0 0 12px; vertical-align:top; width:22px;">
          <span style="display:inline-block; width:8px; height:8px; border-radius:999px; background:#d89b22; margin-top:8px;"></span>
        </td>
        <td style="padding:0 0 12px; color:#263246; font-size:14px; line-height:1.55;">
          ${escapeHtml(point)}
        </td>
      </tr>
    `).join('');
  };

  const buildEmailHtml = (body, lead = {}) => {
    const { greeting, intro, points, cta, signature } = parseEmailBody(body);
    const leadName = getLeadName(lead);
    const siteUrl = getLeadUrl(lead);

    return `
      <div style="margin:0; padding:0; background:#f4f7fb; font-family:Arial, Helvetica, sans-serif;">
        <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
          Diagnóstico rápido de conversão para ${escapeHtml(leadName)}.
        </div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; background:#f4f7fb; margin:0; padding:0;">
          <tr>
            <td align="center" style="padding:28px 14px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px; border-collapse:collapse; background:#ffffff; border:1px solid #e4eaf2; border-radius:18px; overflow:hidden; box-shadow:0 12px 32px rgba(15,23,42,0.08);">
                <tr>
                  <td style="padding:0; background:#061827;">
                    <img src="cid:${ASSINATURA_CID}" alt="Kentaurus TI" style="display:block; width:100%; max-width:680px; height:auto; border:0;" />
                  </td>
                </tr>
                <tr>
                  <td style="padding:30px 34px 18px;">
                    <div style="display:inline-block; padding:7px 11px; border-radius:999px; background:#eef7ff; color:#075985; font-size:12px; font-weight:700; letter-spacing:.02em; margin-bottom:16px;">
                      Diagnóstico rápido de conversão
                    </div>
                    <h1 style="margin:0 0 18px; color:#0f172a; font-size:23px; line-height:1.25; letter-spacing:-.01em;">
                      Alguns pontos podem estar reduzindo a conversão do site
                    </h1>
                    <p style="margin:0 0 18px; color:#243044; font-size:15px; line-height:1.65;">
                      ${escapeHtml(greeting)}
                    </p>
                    ${renderEmailParagraphs(intro)}
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 34px 22px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; background:#fff8eb; border:1px solid #f4d9a4; border-radius:14px;">
                      <tr>
                        <td style="padding:20px 20px 8px;">
                          <div style="font-size:13px; color:#9a6700; font-weight:800; text-transform:uppercase; letter-spacing:.04em; margin-bottom:12px;">
                            Pontos que merecem atenção
                          </div>
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                            ${renderEmailPoints(points)}
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ${siteUrl ? `
                <tr>
                  <td style="padding:0 34px 20px;">
                    <div style="padding:13px 16px; border-radius:12px; background:#f8fafc; border:1px solid #e5eaf1; color:#64748b; font-size:13px;">
                      Site analisado: <span style="color:#0f172a; font-weight:700;">${escapeHtml(siteUrl)}</span>
                    </div>
                  </td>
                </tr>` : ''}
                <tr>
                  <td style="padding:0 34px 26px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; background:#0f172a; border-radius:16px;">
                      <tr>
                        <td style="padding:22px 22px;">
                          <p style="margin:0 0 16px; color:#e2e8f0; font-size:15px; line-height:1.6;">
                            ${escapeHtml(cta || 'Posso te enviar uma proposta visual com melhorias aplicadas, mantendo a identidade da marca e destacando melhor os serviços, diferenciais e formas de contato.')}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 34px 32px;">
                    <div style="height:1px; background:#e7edf5; margin-bottom:18px;"></div>
                    <p style="margin:0; color:#334155; font-size:14px; line-height:1.6;">
                      ${signature.map(line => escapeHtml(line)).join('<br/>')}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `;
  };

  const emailAttachments = [{ name: 'Assinatura.png', filename: 'Assinatura.png', path: ASSINATURA_PATH, cid: ASSINATURA_CID }];

  const showAppAlert = ({ title = 'Aviso', message, variant = 'info' }) => {
    setAppDialog({ type: 'alert', title, message, variant });
  };

  const showAppConfirm = ({ title = 'Confirmar ação', message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', variant = 'warning', onConfirm }) => {
    setAppDialog({ type: 'confirm', title, message, confirmLabel, cancelLabel, variant, onConfirm });
  };

  const closeAppDialog = () => setAppDialog(null);

  const confirmAppDialog = async () => {
    const action = appDialog?.onConfirm;
    setAppDialog(null);
    if (action) await action();
  };

  // Função para exportar leads para a Kentauros
  const exportToKentauros = async (leads) => {
    if (!kentaurosConfig.url || !kentaurosConfig.enabled) {
      showAppAlert({
        title: 'Kentauros não configurada',
        message: 'Configure a URL da Kentauros nas configurações primeiro.',
        variant: 'warning'
      });
      return;
    }

    setKentaurosExportStatus({ exporting: true, message: `Enviando ${leads.length} leads para Kentauros...` });

    try {
      await persistKentaurosConfig(kentaurosConfig);

      const leadIds = leads.map((lead) => lead.id).filter(Boolean);
      const res = await window.electronAPI.exportToKentauros({
        kentaurosUrl: kentaurosConfig.url,
        leadIds: leadIds.length ? leadIds : undefined,
        leads: leadIds.length ? undefined : leads,
        source: 'sites',
        userId: kentaurosConfig.userId || 1,
        tenantId: kentaurosConfig.tenantId || 'tenant-a',
        userEmail: smtpConfig.user || '',
        userName: smtpConfig.signatureName || smtpConfig.user?.split('@')[0] || 'CapLead',
        capturedBySource: smtpConfig.signatureName || '',
      });

      if (res.success) {
        setKentaurosExportStatus({
          exporting: false,
          success: true,
          message: `${res.imported} leads importados${res.duplicates > 0 ? `, ${res.duplicates} duplicados ignorados` : ''}`
        });
        showAppAlert({
          title: 'Exportação concluída',
          message: `${res.imported} leads importados para Kentauros${res.duplicates > 0 ? ` (${res.duplicates} duplicados)` : ''}.`,
          variant: 'success'
        });
      } else {
        setKentaurosExportStatus({
          exporting: false,
          success: false,
          message: res.error
        });
        showAppAlert({
          title: 'Erro na exportação',
          message: res.error || 'Não foi possível conectar à Kentauros. Verifique a URL (sem /leads no final) e sua internet.',
          variant: 'danger'
        });
      }
    } catch (error) {
      setKentaurosExportStatus({
        exporting: false,
        success: false,
        message: error.message
      });
      showAppAlert({
        title: 'Erro na exportação',
        message: error.message,
        variant: 'danger'
      });
    }

    // Limpar status após 5 segundos
    setTimeout(() => setKentaurosExportStatus(null), 5000);
  };

  const getLeadTableName = (typeCode = 'sites') => (
    typeCode === 'sistema' ? 'leads_sistemas' : typeCode === 'linkedin' ? 'leads_linkedin' : 'leads_sites'
  );

  const getKentaurosLeadSource = (typeCode = 'sites') => (
    typeCode === 'sistema' ? 'sistemas' : typeCode === 'linkedin' ? 'linkedin' : 'sites'
  );

  const updateWhatsappState = (leadId, typeCode, patch) => {
    const updateLead = item => item.id === leadId ? { ...item, ...patch } : item;
    if (typeCode === 'sites') setSites(current => current.map(updateLead));
    if (typeCode === 'sistema') setSistemas(current => current.map(updateLead));
    if (typeCode === 'linkedin') setLinkedin(current => current.map(updateLead));
  };

  const syncWhatsappLeadToKentauros = async (lead, typeCode, sentAt) => {
    if (!kentaurosConfig.url || !kentaurosConfig.enabled) {
      throw new Error('Kentauros não configurada para sincronização automática.');
    }

    await persistKentaurosConfig(kentaurosConfig);

    const res = await window.electronAPI.exportToKentauros({
      kentaurosUrl: kentaurosConfig.url,
      leads: [{
        ...lead,
        _typeCode: typeCode,
        wpp_enviado: 1,
        wpp_enviado_at: sentAt,
        whatsappSentAt: sentAt,
        whatsappMessageStatus: 'sent',
        funil_status: 'contatado',
        proximo_passo: 'Acompanhar retorno no WhatsApp',
      }],
      source: getKentaurosLeadSource(typeCode),
      userId: kentaurosConfig.userId || 1,
      tenantId: kentaurosConfig.tenantId || 'tenant-a',
      userEmail: smtpConfig.user || '',
      userName: smtpConfig.signatureName || smtpConfig.user?.split('@')[0] || 'CapLead',
      capturedBySource: smtpConfig.signatureName || '',
    });

    if (!res.success) {
      throw new Error(res.error || 'Não foi possível sincronizar com a Kentauros.');
    }

    return res;
  };

  const confirmWhatsappSent = async (lead, typeCode, { showSuccess = true } = {}) => {
    const leadTypeCode = lead._typeCode || typeCode || 'sites';
    const table = getLeadTableName(leadTypeCode);
    const sentAt = new Date().toISOString();
    const patch = {
      wpp_enviado: 1,
      wpp_enviado_at: sentAt,
      funil_status: 'contatado',
      proximo_passo: 'Acompanhar retorno no WhatsApp',
    };

    try {
      await window.electronAPI.updateLeadWppStatus(table, lead.id, true);
      await window.electronAPI.setLeadValidation(table, lead.id, 1);
      await window.electronAPI.addInteracao(lead.id, leadTypeCode, 'whatsapp', 'Mensagem inicial enviada via WhatsApp pelo CapLead.');

      if (leadTypeCode !== 'linkedin') {
        await window.electronAPI.updateLeadFunil(table, lead.id, 'contatado', patch.proximo_passo, addDaysIso(2));
      }

      updateWhatsappState(lead.id, leadTypeCode, patch);
      const syncResult = await syncWhatsappLeadToKentauros({ ...lead, ...patch }, leadTypeCode, sentAt);
      await fetchDashboardData();

      if (showSuccess) {
        const updated = Number(syncResult.updated || 0);
        showAppAlert({
          title: 'WhatsApp registrado',
          message: updated > 0
            ? 'Envio confirmado no CapLead e atualizado na Kentauros.'
            : 'Envio confirmado no CapLead e enviado para a Kentauros.',
          variant: 'success'
        });
      }
    } catch (error) {
      await fetchDashboardData();
      showAppAlert({
        title: 'WhatsApp registrado com aviso',
        message: `O status foi salvo no CapLead, mas a sincronização automática precisa de atenção: ${error.message}`,
        variant: 'warning'
      });
    }
  };

  const startWhatsappMessageFlow = async (lead, typeCode) => {
    const leadTypeCode = lead._typeCode || typeCode || 'sites';
    const phone = getBestPhoneForLead(lead);
    if (phone.type === 'none') {
      showAppAlert({ title: 'WhatsApp não encontrado', message: 'Este lead não possui número de telefone para abrir o WhatsApp.', variant: 'warning' });
      return;
    }

    const whatsappUrl = buildWhatsappUrl(lead, smtpConfig.signatureName || smtpConfig.user?.split('@')[0] || 'Matheus');
    if (!whatsappUrl) {
      showAppAlert({ title: 'WhatsApp não encontrado', message: 'Não foi possível preparar o link de WhatsApp deste lead.', variant: 'warning' });
      return;
    }

    const opened = await window.electronAPI.openExternalUrl(whatsappUrl);
    if (!opened.success) {
      showAppAlert({ title: 'Erro ao abrir WhatsApp', message: opened.error || 'Não foi possível abrir o WhatsApp nesta máquina.', variant: 'danger' });
      return;
    }

    showAppConfirm({
      title: 'Confirmar envio pelo WhatsApp',
      message: `O WhatsApp foi aberto com a mensagem pronta para ${getLeadName(lead)}. Depois de enviar a mensagem, confirme para marcar como enviado e sincronizar com a Kentauros.`,
      confirmLabel: 'Confirmar envio',
      cancelLabel: 'Ainda não enviei',
      variant: 'success',
      onConfirm: () => confirmWhatsappSent(lead, leadTypeCode)
    });
  };

  const buildExcelLeadPayload = async (lead) => {
    let contacts = [];
    if (lead?.id && (lead._typeCode || 'sites') === 'sites') {
      try {
        const res = await window.electronAPI.getContatos(lead.id);
        if (res.success && Array.isArray(res.data)) contacts = res.data;
      } catch (err) {
        console.error('Erro ao carregar contatos para exportação Excel:', err);
      }
    }

    const email = await getLeadEmail(lead);
    const phone = getBestPhoneForLead(lead, contacts);

    return {
      ...lead,
      email,
      telefone: phone.label || lead.telefone || '',
      url: getLeadUrl(lead),
    };
  };

  const exportLeadsToExcel = async (leads, typeCode = 'sites') => {
    if (!leads.length) {
      showAppAlert({
        title: 'Nenhum lead para exportar',
        message: 'Selecione leads ou ajuste os filtros antes de exportar para Excel.',
        variant: 'info'
      });
      return;
    }

    setExcelExportStatus({ exporting: true, message: `Preparando ${leads.length} leads para Excel...` });

    try {
      const preparedLeads = await Promise.all(leads.map(lead => buildExcelLeadPayload({ ...lead, _typeCode: lead._typeCode || typeCode })));
      const res = await window.electronAPI.exportLeadsExcel({ leads: preparedLeads });

      if (res.success) {
        setExcelExportStatus({ exporting: false, message: `${res.rows} leads exportados para Excel.` });
        showAppAlert({
          title: 'Excel exportado',
          message: `${res.rows} leads foram exportados com as colunas Nome da empresa, E-mail, Número de WhatsApp para contato e Site.`,
          variant: 'success'
        });
      } else if (!res.canceled) {
        setExcelExportStatus({ exporting: false, message: res.error });
        showAppAlert({
          title: 'Erro ao exportar Excel',
          message: res.error || 'Não foi possível gerar a planilha.',
          variant: 'danger'
        });
      } else {
        setExcelExportStatus(null);
      }
    } catch (error) {
      setExcelExportStatus({ exporting: false, message: error.message });
      showAppAlert({
        title: 'Erro ao exportar Excel',
        message: error.message,
        variant: 'danger'
      });
    }

    setTimeout(() => setExcelExportStatus(null), 5000);
  };

  const fetchDashboardData = async () => {
    try {
      const dash = await window.electronAPI.getDashboardMetrics();
      if (dash.success) setMetrics(dash.data);
      
      const latest = await window.electronAPI.getLatestAnalyses();
      if (latest.success) setLatestAnalyses(latest.data);

      const resSites = await window.electronAPI.getLeadSites();
      if (resSites.success) setSites(resSites.data);

      const resSistemas = await window.electronAPI.getLeadSistemas();
      if (resSistemas.success) setSistemas(resSistemas.data);

      const resLinkedin = await window.electronAPI.getLeadLinkedin();
      if (resLinkedin.success) setLinkedin(resLinkedin.data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadConfig = async () => {
    try {
      const preset = await window.electronAPI.getConfig('smtp_preset');
      const host = await window.electronAPI.getConfig('smtp_host');
      const port = await window.electronAPI.getConfig('smtp_port');
      const secure = await window.electronAPI.getConfig('smtp_secure');
      const user = await window.electronAPI.getConfig('smtp_user');
      const legacyUser = await window.electronAPI.getConfig('gmail_user');
      const pass = await window.electronAPI.getConfig('gmail_pass'); // Using gmail_pass key based on crud.js
      const sign = await window.electronAPI.getConfig('smtp_signature');
      const onboardingDone = await window.electronAPI.getConfig('onboarding_done');
      const selectedPreset = preset?.valor || 'gmail';
      const presetConfig = SMTP_PRESETS[selectedPreset] || SMTP_PRESETS.gmail;

      setSmtpConfig({
        preset: selectedPreset,
        host: host?.valor || presetConfig.host,
        port: port?.valor || presetConfig.port,
        secure: normalizeSmtpSecure(port?.valor || presetConfig.port, secure?.valor ? secure.valor === 'true' : presetConfig.secure),
        user: user?.valor || legacyUser?.valor || DEFAULT_SMTP_USER,
        pass: pass?.valor || '',
        signatureName: sign?.valor || ''
      });
      setShowOnboarding(onboardingDone?.valor !== '1' && !pass?.valor);

      if (window.electronAPI?.getKentaurosConfig) {
        const kRes = await window.electronAPI.getKentaurosConfig();
        if (kRes?.success && kRes.config) {
          setKentaurosConfig(prev => ({
            ...prev,
            url: kRes.config.url || prev.url,
            enabled: kRes.config.enabled ?? prev.enabled,
            tenantId: kRes.config.tenantId || prev.tenantId,
            userId: kRes.config.userId || prev.userId,
          }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const persistKentaurosConfig = async (nextConfig) => {
    if (!window.electronAPI?.saveKentaurosConfig) return;
    await window.electronAPI.saveKentaurosConfig({
      url: nextConfig.url,
      enabled: nextConfig.enabled,
      tenantId: nextConfig.tenantId,
      userId: nextConfig.userId,
    });
  };

  useEffect(() => {
    fetchDashboardData();
    loadConfig();

    if (window.electronAPI && window.electronAPI.onDbUpdate) {
      window.electronAPI.onDbUpdate(() => {
        fetchDashboardData();
      });
    }

    if (window.electronAPI && window.electronAPI.onCaptureProgress) {
      window.electronAPI.onCaptureProgress((progress) => {
        setCaptureStatus({
          status: 'loading',
          message: progress.message || 'Captura em andamento...',
          percent: progress.percent || 0,
          currentLead: progress.currentLead || ''
        });
      });
    }
  }, []);

  const handleCaptureSubmit = async (e) => {
    e.preventDefault();
    if (!captureForm.nicho) return;
    const requestedLimit = Math.min(CAPTURE_MAX_LIMIT, Math.max(CAPTURE_MIN_LIMIT, Number(captureForm.limit) || DEFAULT_CAPTURE_LIMIT));
    const normalizedCaptureForm = { ...captureForm, limit: requestedLimit };
    const contactLabel = getCaptureContactLabel(normalizedCaptureForm);

    setCaptureStatus({
      status: 'loading',
      message: `Iniciando varredura para ${normalizedCaptureForm.tipo}. Meta: ${requestedLimit} lead(s) ${contactLabel}.`,
      percent: 3,
      currentLead: ''
    });
    
    try {
      let res;
      if (normalizedCaptureForm.tipo === 'linkedin') {
        res = await window.electronAPI.searchLinkedin(normalizedCaptureForm);
      } else if (normalizedCaptureForm.tipo === 'sistemas') {
        res = await window.electronAPI.searchSistemas(normalizedCaptureForm);
      } else {
        res = await window.electronAPI.searchLeads(normalizedCaptureForm);
      }

      if (res.success) {
        const savedCount = Number(res.count ?? (Array.isArray(res.data) ? res.data.length : 0));
        const targetCount = Number(res.target || requestedLimit);
        if (normalizedCaptureForm.tipo === 'sites') {
          setGridFilters({
            source: 'todos',
            date: 'todos',
            hasEmail: Boolean(normalizedCaptureForm.requireEmail),
            hasWpp: Boolean(normalizedCaptureForm.requireWhatsapp),
            wppSent: false,
            highOpportunity: false,
            followupDue: false
          });
          setActiveMenu('sites');
        }
        const kSync = res.kentaurosSync;
        let syncNote = '';
        if (kSync?.skipped && kentaurosConfig.enabled) {
          syncNote = '';
        } else if (kSync?.success && !kSync.skipped) {
          syncNote = ` | Kentauros: ${kSync.imported} enviado(s)${kSync.duplicates ? `, ${kSync.duplicates} duplicado(s)` : ''}`;
        } else if (kSync && !kSync.success && kentaurosConfig.enabled) {
          syncNote = ` | Kentauros: falha (${kSync.error})`;
        }

        setCaptureStatus({
          status: 'success',
          message: (res.message || `Captura finalizada. ${savedCount}/${targetCount} leads ${contactLabel} salvos.`) + syncNote,
          percent: 100,
          currentLead: ''
        });
        await fetchDashboardData();
      } else {
        setCaptureStatus({ status: 'error', message: res.error || 'Erro na captura.' });
      }
    } catch (e) {
      setCaptureStatus({ status: 'error', message: 'Falha na comunicação.' });
    }
    
    setTimeout(() => setCaptureStatus(null), 5000);
  };

  const saveSmtpConfig = async () => {
    try {
      await window.electronAPI.setConfig('smtp_preset', smtpConfig.preset);
      await window.electronAPI.setConfig('smtp_host', smtpConfig.host);
      await window.electronAPI.setConfig('smtp_port', smtpConfig.port);
      await window.electronAPI.setConfig('smtp_secure', String(normalizeSmtpSecure(smtpConfig.port, smtpConfig.secure)));
      await window.electronAPI.setConfig('smtp_user', smtpConfig.user);
      await window.electronAPI.setConfig('gmail_pass', smtpConfig.pass);
      await window.electronAPI.setConfig('smtp_signature', smtpConfig.signatureName);
      
      setSmtpStatus({ type: 'success', msg: 'Configurações salvas com sucesso!' });
      setTimeout(() => setSmtpStatus(null), 3000);
    } catch (e) {
      setSmtpStatus({ type: 'error', msg: 'Erro ao salvar.' });
    }
  };

  const applySmtpPreset = (presetKey) => {
    const preset = SMTP_PRESETS[presetKey] || SMTP_PRESETS.custom;
    setSmtpConfig(current => ({
      ...current,
      preset: presetKey,
      host: presetKey === 'custom' ? current.host : preset.host,
      port: presetKey === 'custom' ? (current.port || preset.port) : preset.port,
      secure: normalizeSmtpSecure(presetKey === 'custom' ? (current.port || preset.port) : preset.port, preset.secure),
      user: current.user || DEFAULT_SMTP_USER
    }));
  };

  const finishOnboarding = async (nextMenu = null) => {
    await window.electronAPI.setConfig('onboarding_done', '1');
    setShowOnboarding(false);
    if (nextMenu) setActiveMenu(nextMenu);
  };

  const testSmtpConnection = async () => {
    setSmtpStatus({ type: 'loading', msg: 'Testando...' });
    try {
      await saveSmtpConfig();
      setSmtpStatus({ type: 'loading', msg: 'Testando conexão SMTP...' });
      const res = await window.electronAPI.verifySMTP();
      if (res.success) {
        setSmtpStatus({ type: 'success', msg: 'Conexão SMTP estabelecida com sucesso!' });
      } else {
        setSmtpStatus({ type: 'error', msg: `Falha: ${res.error}` });
      }
    } catch (e) {
      setSmtpStatus({ type: 'error', msg: 'Falha ao testar.' });
    }
  };

  const openUserManual = async () => {
    setSmtpStatus({ type: 'loading', msg: 'Abrindo manual do usuário...' });
    try {
      const res = await window.electronAPI.openUserManual();
      if (res.success) {
        setSmtpStatus({ type: 'success', msg: 'Manual do usuário aberto em PDF.' });
      } else {
        setSmtpStatus({ type: 'error', msg: res.error || 'Manual não encontrado.' });
      }
    } catch {
      setSmtpStatus({ type: 'error', msg: 'Falha ao abrir manual.' });
    }
    setTimeout(() => setSmtpStatus(null), 3500);
  };

  const handleTotalReset = async () => {
    showAppConfirm({
      title: 'Reset System Data',
      message: 'Serão removidos leads sem ação operacional. Serão mantidos leads com validação manual, e-mail enviado, WhatsApp, favorito, CRM, documentação ou follow-up.',
      confirmLabel: 'Executar reset',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const res = await window.electronAPI.totalReset();
          if (!res.success) {
            showAppAlert({ title: 'Reset não concluído', message: res.error || 'Não foi possível resetar os dados.', variant: 'danger' });
            return;
          }

          const deleted = res.data?.deleted || {};
          showAppAlert({
            title: 'Reset concluído',
            message: `Removidos: ${deleted.sites || 0} sites, ${deleted.sistemas || 0} sistemas e ${deleted.linkedin || 0} LinkedIn.`,
            variant: 'success'
          });
          fetchDashboardData();
        } catch (err) {
          console.error("Erro no reset system data:", err);
          showAppAlert({ title: 'Erro no reset', message: 'Erro ao resetar os dados do sistema.', variant: 'danger' });
        }
      }
    });
  };

  const handleCleanCapturedSiteLeads = async () => {
    showAppConfirm({
      title: 'Limpar leads capturados',
      message: 'Serão removidos do Banco de Sites os leads sem e-mail real, sem WhatsApp capturado e sem layout gerado. Leads com e-mail, WhatsApp ou proposta visual pronta serão mantidos.',
      confirmLabel: 'Limpar leads frios',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const res = await window.electronAPI.cleanCapturedSiteLeads();
          if (!res.success) {
            showAppAlert({ title: 'Limpeza não concluída', message: res.error || 'Não foi possível limpar os leads capturados.', variant: 'danger' });
            return;
          }

          const deleted = res.data?.deleted || {};
          showAppAlert({
            title: 'Limpeza concluída',
            message: `${deleted.sites || 0} lead(s) frio(s) foram removidos. Foram mantidos os leads com e-mail, WhatsApp capturado ou layout gerado.`,
            variant: 'success'
          });
          fetchDashboardData();
        } catch (err) {
          console.error('Erro na limpeza de leads capturados:', err);
          showAppAlert({ title: 'Erro na limpeza', message: 'Erro ao limpar leads capturados.', variant: 'danger' });
        }
      }
    });
  };

  const handleTogglePin = async (lead, type) => {
    const table = type === 'sistema' ? 'leads_sistemas' : type === 'linkedin' ? 'leads_linkedin' : 'leads_sites';
    const newStatus = lead.is_pinned ? 0 : 1;
    await window.electronAPI.togglePinLead(table, lead.id, newStatus);
  };

  const handleValidation = async (lead, type, isValid) => {
    const table = type === 'sistema' ? 'leads_sistemas' : type === 'linkedin' ? 'leads_linkedin' : 'leads_sites';
    await window.electronAPI.setLeadValidation(table, lead.id, isValid, true);
  };

  const handleDelete = async (lead, type) => {
    const table = type === 'sistema' ? 'leads_sistemas' : type === 'linkedin' ? 'leads_linkedin' : 'leads_sites';
    await window.electronAPI.blockLead(table, lead.id, true);
    fetchDashboardData();
  };

  // === CRM MODAL CONSTANTS & HANDLERS ===
  const FUNIL_STAGES = [
    { value: 'novo',      label: 'Novo',             color: 'text-slate-400',  bg: 'bg-slate-500/20'  },
    { value: 'contatado', label: 'Contatado',         color: 'text-blue-400',   bg: 'bg-blue-500/20'   },
    { value: 'respondeu', label: 'Respondeu',         color: 'text-cyan-400',   bg: 'bg-cyan-500/20'   },
    { value: 'reuniao',   label: 'Reunião',           color: 'text-violet-400', bg: 'bg-violet-500/20' },
    { value: 'proposta',  label: 'Proposta Enviada',  color: 'text-amber-400',  bg: 'bg-amber-500/20'  },
    { value: 'fechado',   label: 'Fechado',           color: 'text-emerald-400',bg: 'bg-emerald-500/20'},
    { value: 'perdido',   label: 'Perdido',           color: 'text-red-400',    bg: 'bg-red-500/20'    },
  ];

  const CANAL_ICONS = {
    email:      <Mail size={14} />,
    whatsapp:   <MessageCircle size={14} />,
    ligacao:    <Phone size={14} />,
    reuniao:    <Users size={14} />,
    observacao: <FileText size={14} />,
  };

  const openCrmModal = async (lead, typeCode) => {
    setCrmLoading(true);
    const res = await window.electronAPI.getInteracoes(lead.id, typeCode);
    const table = typeCode === 'sistema' ? 'leads_sistemas' : typeCode === 'linkedin' ? 'leads_linkedin' : 'leads_sites';
    setCrmModal({ lead, typeCode, table, interacoes: res.success ? res.data : [] });
    setCrmFunil({
      status:       lead.funil_status  || 'novo',
      proximoPasso: lead.proximo_passo || '',
      followupDate: lead.followup_date || '',
    });
    setCrmForm({ canal: 'email', descricao: '' });
    setCrmLoading(false);
  };

  const closeCrmModal = () => setCrmModal(null);

  const handleAddInteracao = async () => {
    if (!crmForm.descricao.trim() || !crmModal) return;
    await window.electronAPI.addInteracao(crmModal.lead.id, crmModal.typeCode, crmForm.canal, crmForm.descricao);
    const res = await window.electronAPI.getInteracoes(crmModal.lead.id, crmModal.typeCode);
    setCrmModal(m => ({ ...m, interacoes: res.success ? res.data : [] }));
    setCrmForm(f => ({ ...f, descricao: '' }));
    fetchDashboardData();
  };

  const handleDeleteInteracao = async (id) => {
    await window.electronAPI.deleteInteracao(id);
    const res = await window.electronAPI.getInteracoes(crmModal.lead.id, crmModal.typeCode);
    setCrmModal(m => ({ ...m, interacoes: res.success ? res.data : [] }));
  };

  const handleSaveFunil = async () => {
    if (!crmModal || crmModal.typeCode === 'linkedin') return;
    await window.electronAPI.updateLeadFunil(
      crmModal.table, crmModal.lead.id,
      crmFunil.status, crmFunil.proximoPasso, crmFunil.followupDate
    );
    setCrmModal(m => m ? ({
      ...m,
      lead: {
        ...m.lead,
        funil_status: crmFunil.status,
        proximo_passo: crmFunil.proximoPasso,
        followup_date: crmFunil.followupDate
      }
    }) : m);
    fetchDashboardData();
  };

  const handleQuickFollowup = async (lead, typeCode, days = 3, nextStep = 'Retornar contato') => {
    const leadTypeCode = lead._typeCode || typeCode;
    if (leadTypeCode === 'linkedin') {
      showAppAlert({ title: 'Follow-up indisponível', message: 'O funil de follow-up ainda está disponível apenas para leads de sites e sistemas.', variant: 'info' });
      return;
    }
    const table = leadTypeCode === 'sistema' ? 'leads_sistemas' : 'leads_sites';
    const status = lead.funil_status && lead.funil_status !== 'novo' ? lead.funil_status : 'contatado';
    await window.electronAPI.updateLeadFunil(table, lead.id, status, lead.proximo_passo || nextStep, addDaysIso(days));
    await fetchDashboardData();
    showAppAlert({ title: 'Follow-up agendado', message: `${getLeadName(lead)} foi agendado para ${days === 1 ? 'amanhã' : `daqui a ${days} dias`}.`, variant: 'success' });
  };

  const fillCrmTemplate = (template) => {
    setCrmForm(current => ({
      ...current,
      descricao: template
    }));
  };

  const handleWppChange = async (lead, typeCode, e) => {
    const checked = e.target.checked;
    if (checked) {
      await confirmWhatsappSent(lead, typeCode, { showSuccess: true });
      return;
    }

    const table = getLeadTableName(typeCode);
    await window.electronAPI.updateLeadWppStatus(table, lead.id, checked);
    updateWhatsappState(lead.id, typeCode, { wpp_enviado: 0, wpp_enviado_at: null });
    fetchDashboardData();
  };

  const handleBulkAnalysis = async (list, typeCode) => {
    const pendentes = list.filter(l => !l.is_validated);
    if (pendentes.length === 0) {
      showAppAlert({ title: 'Nada para analisar', message: 'Nenhum lead pendente de análise foi encontrado.', variant: 'info' });
      return;
    }
    bulkCancelRef.current = false;
    setBulkProgress({ total: pendentes.length, current: 0, text: 'Iniciando análise em massa...' });
    setBulkSummary(null);
    
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < pendentes.length; i++) {
      if (bulkCancelRef.current) break; // Cancelamento solicitado
      const lead = pendentes[i];
      setBulkProgress({ total: pendentes.length, current: i + 1, text: `Analisando: ${lead.nome || lead.titulo || lead.url}` });
      try {
        const urlToAnalyze = lead.url ? (lead.url.startsWith('http') ? lead.url : `https://${lead.url}`) : null;
        const table = typeCode === 'sistema' ? 'leads_sistemas' : typeCode === 'linkedin' ? 'leads_linkedin' : 'leads_sites';
        if (urlToAnalyze) {
          await window.electronAPI.analyzeLeadDesign({ id: lead.id, url: urlToAnalyze, table });
        }
        successCount++;
      } catch (e) {
        console.error("Erro na análise", e);
        errorCount++;
      }
    }
    setBulkProgress(null);
    const wasCancelled = bulkCancelRef.current;
    bulkCancelRef.current = false;
    setBulkSummary({ type: 'analysis', success: successCount, error: errorCount, total: pendentes.length, cancelled: wasCancelled });
    fetchDashboardData();
    setTimeout(() => setBulkSummary(null), 8000);
  };

  const handleBulkEmail = async (list, typeCode) => {
    const candidates = list.filter(l => !l.email_enviado);
    const paraEnviar = [];
    const semEmail = [];

    if (candidates.length === 0) {
      showAppAlert({ title: 'Nenhum lead pendente', message: 'Todos os leads visíveis já tiveram e-mail enviado.', variant: 'info' });
      return;
    }

    setBulkSummary(null);
    setBulkProgress({ total: candidates.length, current: 0, text: 'Verificando e-mails vinculados aos leads...' });

    for (const lead of candidates) {
      setBulkProgress({
        total: candidates.length,
        current: paraEnviar.length + semEmail.length + 1,
        text: `Verificando e-mail de: ${getLeadName(lead)}`
      });

      const email = await resolveLeadEmailForSending(lead);
      if (email) {
        paraEnviar.push({ ...lead, email });
      } else {
        semEmail.push(lead);
      }
    }

    setBulkProgress(null);

    if (paraEnviar.length === 0) {
      showAppAlert({ title: 'Nenhum e-mail disponível', message: 'Nenhum lead visível possui e-mail disponível para envio. Os leads permaneceram no grid para nova captura ou revisão.', variant: 'info' });
      return;
    }

    let sentToday = 0;
    try {
      const stats = await window.electronAPI.getEmailSendStatsToday();
      sentToday = stats?.success ? Number(stats.data?.sentToday || 0) : 0;
    } catch (_) {
      sentToday = 0;
    }

    const dailyRemaining = Math.max(0, EMAIL_SAFE_DAILY_LIMIT - sentToday);
    const allowedNow = Math.min(dailyRemaining, EMAIL_SAFE_BATCH_LIMIT);
    if (allowedNow <= 0) {
      showAppAlert({
        title: 'Limite seguro diário atingido',
        message: `O CapLead já registrou ${sentToday} envio(s) hoje. Para proteger a conta Gmail, novos disparos ficam bloqueados até amanhã.`,
        variant: 'warning'
      });
      return;
    }

    const limitedLeads = paraEnviar.slice(0, allowedNow);
    const skippedBySendLimit = Math.max(0, paraEnviar.length - limitedLeads.length);
    
    const defaultAssunto = buildEmailSubject(limitedLeads[0]);
    const defaultCorpo = buildEmailBody(limitedLeads[0]);

    setEmailPreviewModal({
      leads: limitedLeads,
      typeCode,
      mode: limitedLeads.length === 1 ? 'single' : 'bulk',
      skippedWithoutEmail: semEmail.length,
      skippedBySendLimit,
      sentToday,
      dailyRemaining,
      safeDailyLimit: EMAIL_SAFE_DAILY_LIMIT,
      safeBatchLimit: EMAIL_SAFE_BATCH_LIMIT,
      template: { assunto: defaultAssunto, corpo: defaultCorpo }
    });
  };

  const confirmBulkEmail = async () => {
    if (!emailPreviewModal) return;
    const { leads, typeCode, template, skippedWithoutEmail = 0 } = emailPreviewModal;
    
    setEmailPreviewModal(null);
    bulkCancelRef.current = false;
    setBulkProgress({ total: leads.length, current: 0, text: 'Iniciando disparos de e-mail...' });
    setBulkSummary(null);
    
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < leads.length; i++) {
      if (bulkCancelRef.current) break; // Cancelamento solicitado
      const lead = leads[i];
      setBulkProgress({ total: leads.length, current: i + 1, text: `Enviando e-mail para: ${lead.email}` });
      try {
        const isSingleLead = leads.length === 1;
        const assunto = isSingleLead ? resolveEmailText(template.assunto, lead) : buildEmailSubject(lead);
        const corpo = isSingleLead ? resolveEmailText(template.corpo, lead) : buildEmailBody(lead);
        
        const res = await window.electronAPI.sendEmail(lead.email, assunto, buildEmailHtml(corpo, lead), emailAttachments);
        if (res.success) {
          const leadTypeCode = lead._typeCode || typeCode;
          const table = leadTypeCode === 'sistema' ? 'leads_sistemas' : leadTypeCode === 'linkedin' ? 'leads_linkedin' : 'leads_sites';
          await window.electronAPI.updateLeadEmailStatus(table, lead.id, 1);
          await window.electronAPI.setLeadValidation(table, lead.id, 1);
          await window.electronAPI.addInteracao(lead.id, leadTypeCode, 'email', 'E-mail consultivo enviado pelo CapLead.');
          if (leadTypeCode !== 'linkedin') {
            await window.electronAPI.updateLeadFunil(table, lead.id, 'contatado', 'Acompanhar retorno do e-mail enviado', addDaysIso(3));
          }
          if (leadTypeCode === 'sites') {
            setSites(current => current.map(item => item.id === lead.id ? { ...item, email_enviado: 1, is_validated: 1, funil_status: 'contatado', proximo_passo: 'Acompanhar retorno do e-mail enviado', followup_date: addDaysIso(3) } : item));
          } else if (leadTypeCode === 'sistema') {
            setSistemas(current => current.map(item => item.id === lead.id ? { ...item, email_enviado: 1, is_validated: 1, funil_status: 'contatado', proximo_passo: 'Acompanhar retorno do e-mail enviado', followup_date: addDaysIso(3) } : item));
          } else if (leadTypeCode === 'linkedin') {
            setLinkedin(current => current.map(item => item.id === lead.id ? { ...item, email_enviado: 1, is_validated: 1 } : item));
          }
          successCount++;
        } else {
          errorCount++;
        }
      } catch (e) {
        console.error("Erro no envio", e);
        errorCount++;
      }
      // Delay conservador entre envios para reduzir risco de throttling no Gmail/SMTP.
      await new Promise(r => setTimeout(r, EMAIL_SEND_DELAY_MS));
    }
    setBulkProgress(null);
    const wasCancelled = bulkCancelRef.current;
    bulkCancelRef.current = false;
    setBulkSummary({ type: 'email', success: successCount, error: errorCount, total: leads.length, skipped: skippedWithoutEmail, cancelled: wasCancelled });
    fetchDashboardData();
    setTimeout(() => setBulkSummary(null), 8000);
  };

  const handleSmartEmailQueue = async () => {
    const eligible = siteLeadsGrid
      .filter(lead => !lead.email_enviado)
      .sort((a, b) => getCommercialScore(b, 'sites') - getCommercialScore(a, 'sites'))
      .slice(0, 25);

    if (eligible.length === 0) {
      showAppAlert({ title: 'Fila vazia', message: 'Nenhum lead de site pendente foi encontrado para disparo.', variant: 'info' });
      return;
    }

    await handleBulkEmail(eligible, 'sites');
  };

  const handleDailyAssistedAutomation = async () => {
    const baseQueue = siteLeadsGrid
      .filter(lead => !lead.email_enviado)
      .sort((a, b) => getCommercialScore(b, 'sites') - getCommercialScore(a, 'sites'));

    if (baseQueue.length === 0) {
      showAppAlert({
        title: 'Rotina sem pendências',
        message: 'Não há leads de sites pendentes para preparar agora.',
        variant: 'info'
      });
      return;
    }

    bulkCancelRef.current = false;
    setAutomationSummary(null);

    const toAnalyze = baseQueue
      .filter(lead => getLeadUrl(lead) && (!lead.score_design || !lead.problemas))
      .slice(0, 8);
    const toResolveEmail = baseQueue
      .filter(lead => getLeadUrl(lead) && !(lead.has_email_count > 0 || lead.email))
      .slice(0, 12);

    let analyzed = 0;
    let capturedEmails = 0;
    let failed = 0;
    const readyToSend = [];
    const totalSteps = Math.max(1, toAnalyze.length + toResolveEmail.length + baseQueue.length);
    let currentStep = 0;

    try {
      for (const lead of toAnalyze) {
        if (bulkCancelRef.current) break;
        currentStep += 1;
        setBulkProgress({ total: totalSteps, current: currentStep, text: `Analisando oportunidade: ${getLeadName(lead)}` });
        try {
          const url = getLeadUrl(lead);
          await window.electronAPI.analyzeLeadDesign({
            id: lead.id,
            url: url.startsWith('http') ? url : `https://${url}`,
            table: 'leads_sites'
          });
          analyzed += 1;
        } catch (error) {
          console.warn('Falha na análise assistida:', error);
          failed += 1;
        }
      }

      for (const lead of toResolveEmail) {
        if (bulkCancelRef.current) break;
        currentStep += 1;
        setBulkProgress({ total: totalSteps, current: currentStep, text: `Tentando capturar e-mail: ${getLeadName(lead)}` });
        const email = await resolveLeadEmailForSending(lead);
        if (email) {
          capturedEmails += 1;
          readyToSend.push({ ...lead, email, has_email_count: 1 });
        }
      }

      for (const lead of baseQueue) {
        if (bulkCancelRef.current) break;
        currentStep += 1;
        setBulkProgress({ total: totalSteps, current: currentStep, text: `Priorizando: ${getLeadName(lead)}` });
        const email = lead.email || ((lead.has_email_count > 0) ? await getLeadEmail(lead) : '');
        if (email && !readyToSend.some(item => item.id === lead.id)) {
          readyToSend.push({ ...lead, email });
        }
        if (readyToSend.length >= 20) break;
      }
    } finally {
      setBulkProgress(null);
    }

    const finalReady = readyToSend
      .sort((a, b) => getCommercialScore(b, 'sites') - getCommercialScore(a, 'sites'))
      .slice(0, 20);

    const summary = {
      analyzed,
      capturedEmails,
      ready: finalReady.length,
      failed,
      cancelled: bulkCancelRef.current
    };
    setAutomationSummary(summary);
    bulkCancelRef.current = false;
    fetchDashboardData();

    if (finalReady.length > 0) {
      setEmailPreviewModal({
        leads: finalReady,
        typeCode: 'sites',
        mode: finalReady.length === 1 ? 'single' : 'bulk',
        skippedWithoutEmail: Math.max(0, baseQueue.length - finalReady.length),
        template: {
          assunto: buildEmailSubject(finalReady[0]),
          corpo: buildEmailBody(finalReady[0])
        }
      });
      return;
    }

    showAppAlert({
      title: 'Rotina concluída',
      message: 'A rotina preparou os leads possíveis, mas nenhum e-mail ficou pronto para envio neste momento.',
      variant: 'info'
    });
  };

  const handleSingleAnalysis = async (lead, typeCode) => {
    try {
      const urlToAnalyze = lead.url ? (lead.url.startsWith('http') ? lead.url : `https://${lead.url}`) : null;
      if (!urlToAnalyze) {
        showAppAlert({ title: 'URL inválida', message: 'Este lead não possui uma URL válida para análise.', variant: 'warning' });
        return;
      }
      
      const table = typeCode === 'sistema' ? 'leads_sistemas' : typeCode === 'linkedin' ? 'leads_linkedin' : 'leads_sites';
      
      // Pass the table so the backend knows which score to update
      await window.electronAPI.analyzeLeadDesign({ id: lead.id, url: urlToAnalyze, table });
      
      fetchDashboardData();
    } catch (e) {
      console.error("Erro na análise individual", e);
      showAppAlert({ title: 'Erro na análise', message: 'Não foi possível concluir a análise deste lead.', variant: 'danger' });
    }
  };

  const handleSingleEmail = async (lead, typeCode) => {
    const email = await getLeadEmail(lead);
    if (!email) {
      showAppAlert({ title: 'E-mail não encontrado', message: 'Este lead não possui e-mail cadastrado ou capturado nos contatos.', variant: 'warning' });
      return;
    }

    const leadWithEmail = { ...lead, email };
    setEmailPreviewModal({
      leads: [leadWithEmail],
      typeCode,
      mode: 'single',
      template: { 
        assunto: buildEmailSubject(leadWithEmail),
        corpo: buildEmailBody(leadWithEmail)
      }
    });
  };

  const handleRecommendedAction = async (lead, typeCode) => {
    const leadTypeCode = lead._typeCode || typeCode;
    const hasEmail = lead?.email || lead?.has_email_count > 0;

    if (lead?.email_enviado && !lead?.respondeu_email) {
      openCrmModal(lead, leadTypeCode);
      return;
    }

    if (hasGeneratedLayout(lead)) {
      await openLeadLayoutAsset(lead, 'preview');
      return;
    }

    if (hasEmail) {
      await handleSingleEmail(lead, leadTypeCode);
      return;
    }

    const leadUrl = getLeadUrl(lead);
    if (leadUrl && leadTypeCode === 'sites') {
      setBulkProgress({ total: 1, current: 1, text: `Capturando contato de ${getLeadName(lead)}...` });
      const email = await resolveLeadEmailForSending(lead);
      setBulkProgress(null);
      await fetchDashboardData();

      if (email) {
        await handleSingleEmail({ ...lead, email, has_email_count: 1 }, leadTypeCode);
      } else {
        showAppAlert({
          title: 'Contato não encontrado',
          message: 'Não foi possível localizar e-mail neste site. O lead permanece no grid para revisão ou contato por outro canal.',
          variant: 'warning'
        });
      }
      return;
    }

    if (lead?.telefone) {
      await startWhatsappMessageFlow(lead, leadTypeCode);
      return;
    }

    handleOpenDetails(lead);
  };

  const openOperationalQueue = (queue) => {
    if (queue === 'high') {
      setGridFilters({ source: 'todos', date: 'todos', hasEmail: false, hasWpp: false, wppSent: false, highOpportunity: true, followupDue: false });
      setWppFilter(false);
      setActiveMenu('sites');
      return;
    }
    if (queue === 'email') {
      setGridFilters({ source: 'todos', date: 'todos', hasEmail: true, hasWpp: false, wppSent: false, highOpportunity: false, followupDue: false });
      setWppFilter(false);
      setActiveMenu('sites');
      return;
    }
    if (queue === 'validated') {
      setGridFilters({ source: 'todos', date: 'todos', hasEmail: false, hasWpp: false, wppSent: false, highOpportunity: false, followupDue: false });
      setWppFilter(false);
      setActiveMenu('validados');
      return;
    }
    if (queue === 'followups') {
      setGridFilters({ source: 'todos', date: 'todos', hasEmail: false, hasWpp: false, wppSent: false, highOpportunity: false, followupDue: true });
      setWppFilter(false);
      setActiveMenu('validados');
      return;
    }
    setActiveMenu('nova-captura');
  };

  const getLeadSelectionKey = (lead, typeCode) => `${lead._typeCode || typeCode}-${lead.id}`;

  const toggleLeadSelection = (lead, typeCode) => {
    const key = getLeadSelectionKey(lead, typeCode);
    setSelectedLeadKeys(current =>
      current.includes(key) ? current.filter(item => item !== key) : [...current, key]
    );
  };

  const togglePageSelection = (items, typeCode) => {
    const pageKeys = items.map(lead => getLeadSelectionKey(lead, lead._typeCode || typeCode));
    const allSelected = pageKeys.length > 0 && pageKeys.every(key => selectedLeadKeys.includes(key));
    setSelectedLeadKeys(current => {
      if (allSelected) return current.filter(key => !pageKeys.includes(key));
      return [...new Set([...current, ...pageKeys])];
    });
  };

  const hasGeneratedLayout = (lead) => Boolean(
    lead?.layout_gerado_path && (lead?.layout_status === 'success' || lead?.layout_status === 'gerado')
  );

  const getClientFolderFromLead = (lead) => {
    const sourcePath = lead?.layout_gerado_path || lead?.layout_preview_path || lead?.layout_prompt_path || '';
    if (!sourcePath) return '';
    const normalized = sourcePath.replace(/\\/g, '/');
    const marker = '/layout-gerado/';
    if (normalized.includes(marker)) return normalized.split(marker)[0];
    const promptMarker = '/prompt/';
    if (normalized.includes(promptMarker)) return normalized.split(promptMarker)[0];
    return normalized;
  };

  const openLeadLayoutAsset = async (lead, asset = 'html') => {
    const target =
      asset === 'preview' ? lead?.layout_preview_path :
      asset === 'prompt' ? lead?.layout_prompt_path :
      asset === 'folder' ? getClientFolderFromLead(lead) :
      lead?.layout_gerado_path;

    if (!target) {
      showAppAlert({
        title: 'Arquivo não encontrado',
        message: 'Este lead ainda não possui este material de layout gerado.',
        variant: 'warning'
      });
      return;
    }

    await window.electronAPI.openPath(target);
  };

  const handleGenerateLayout = async (lead, typeCode = 'sites') => {
    const existingLayout = lead.layout_gerado_path;
    if (existingLayout && lead.layout_status === 'success') {
      await openLeadLayoutAsset(lead, 'preview');
      return;
    }

    const urlToAnalyze = lead.url || lead.site_oficial;
    if (!urlToAnalyze) {
      showAppAlert({ title: 'URL inválida', message: 'Este lead não possui URL válida para gerar o layout.', variant: 'warning' });
      return;
    }

    setLayoutGeneratingLeadId(lead.id);
    try {
      const payload = { ...lead, _typeCode: typeCode };
      const res = await window.electronAPI.generateClientLayout(payload);
      if (!res.success) {
        showAppAlert({
          title: 'Layout não gerado',
          message: res.message || 'Não foi possível gerar o layout deste lead. Verifique se o site está acessível e tente novamente.',
          variant: 'danger'
        });
        return;
      }

      setLeadDetailsModal(current => current?.id === lead.id ? {
        ...current,
        layout_status: 'success',
        layout_gerado_path: res.layoutPath,
        layout_preview_path: res.previewPath,
        layout_prompt_path: res.promptPath
      } : current);

      showAppConfirm({
        title: `Proposta visual pronta para ${res.clientName}`,
        message: `Preview comercial, HTML, prompt, análise e dados extraídos foram salvos. Use o preview como material de apresentação e o HTML como protótipo navegável. Pasta: ${res.folderPath}`,
        confirmLabel: 'Abrir pasta',
        cancelLabel: 'OK',
        variant: 'success',
        onConfirm: async () => {
          await window.electronAPI.openPath(res.folderPath);
        }
      });
      fetchDashboardData();
    } catch (err) {
      console.error('Erro ao gerar layout:', err);
      showAppAlert({
        title: 'Layout não gerado',
        message: 'Não foi possível gerar o layout deste lead. Verifique se o site está acessível e tente novamente.',
        variant: 'danger'
      });
    } finally {
      setLayoutGeneratingLeadId(null);
    }
  };


  // Views
  const renderSidebar = () => {
    const menuSections = [
      {
        title: "CENTRAL DE COMANDO",
        items: [
          { id: 'geral', name: 'Dashboard', icon: <LayoutDashboard size={18} /> },
        ]
      },
      {
        title: "ÁREA LEAD HUNTER",
        items: [
          { id: 'nova-captura', name: 'Nova Captura', icon: <Search size={18} /> },
          { id: 'sites', name: 'Leads de Sites', icon: <Layers size={18} /> },
          { id: 'sistemas', name: 'Sistemas & Apps', icon: <LayoutTemplate size={18} /> },
          { id: 'linkedin', name: 'Leads do LinkedIn', icon: <Linkedin size={18} /> },
        ]
      },
      {
        title: "COMERCIAL",
        items: [
          {
            id: 'whatsapp-comercial',
            name: 'WhatsApp Business',
            icon: <MessageCircle size={18} />,
            badge: whatsappUnreadCount
          },
        ]
      },
      {
        title: "CRM & OPERACIONAL",
        items: [
          { id: 'validados', name: 'Leads Validados', icon: <CheckCircle size={18} /> },
          { id: 'envios', name: 'Configurações', icon: <Settings size={18} /> }
        ]
      }
    ];

    return (
      <aside className="w-72 bg-dark border-r border-white/5 h-full flex flex-col relative z-20">
        <div className="p-8 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center shadow-lg shadow-primary/20">
            <Target className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              CapLead <span className="text-primary">AI</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Prospector</p>
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto custom-scrollbar px-4 space-y-8">
          {menuSections.map((section, idx) => (
            <div key={idx}>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 px-3">
                {section.title}
              </h3>
              <div className="space-y-1">
                {section.items.map((m) => (
                  <button 
                    key={m.id}
                    onClick={() => setActiveMenu(m.id)}
                    className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      activeMenu === m.id 
                        ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm' 
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                    }`}
                  >
                    {m.icon}
                    <span className="flex-1 text-left">{m.name}</span>
                    {typeof m.badge === 'number' && (
                      <span className={`min-w-5 h-5 rounded-full px-1.5 flex items-center justify-center text-[10px] font-black ${
                        m.badge > 0 ? 'bg-emerald-400 text-dark' : 'bg-white/10 text-slate-500'
                      }`}>
                        {m.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* SMTP Status Widget */}
        <div className="p-4 mt-auto">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className={`w-3 h-3 rounded-full ${smtpStatus?.type === 'success' || smtpConfig.user ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
                <div className={`absolute inset-0 rounded-full animate-ping opacity-50 ${smtpStatus?.type === 'success' || smtpConfig.user ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-white">STATUS SMTP</p>
                <p className="text-[10px] text-slate-400 truncate max-w-[120px]">
                  {smtpConfig.user || 'Não configurado'}
                </p>
              </div>
            </div>
            <button 
              onClick={() => setActiveMenu('envios')}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 transition-colors shrink-0"
            >
              <Zap size={14} />
            </button>
          </div>
        </div>
      </aside>
    );
  };

  const renderDashboard = () => (
    <div className="p-8 animate-fade-in h-full overflow-y-auto custom-scrollbar bg-surface">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">CONTROL CENTER &mdash; {new Date().toLocaleDateString('pt-BR')}</h2>
          <h1 className="text-3xl font-bold text-white tracking-tight">Painel de Operações</h1>
          <p className="text-slate-400 text-sm mt-2">Acompanhe as métricas de prospecção e os fluxos de automação em tempo real.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowOnboarding(true)}
            className="bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 border border-primary/20"
          >
            <Info size={16} /> Guia rápido
          </button>
          <button 
            onClick={handleTotalReset}
            className="bg-white/5 hover:bg-white/10 text-slate-300 px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 border border-white/5"
          >
            <Activity size={16} /> Reset System Data
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-[#0b1120] p-6 rounded-3xl border border-white/5 relative overflow-hidden group hover:border-white/10 transition-colors">
          <div className="absolute -right-6 -top-6 text-white/5 group-hover:text-blue-500/5 transition-colors">
            <Users size={120} />
          </div>
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-4">
              <Users size={20} />
            </div>
            <span className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-1 block">Total de Leads</span>
            <div className="flex items-end gap-3">
              <span className="text-5xl font-black text-white tracking-tight">{metrics.totalLeads}</span>
              <span className="text-emerald-400 text-sm font-bold bg-emerald-500/10 px-2 py-1 rounded-lg mb-1">+12%</span>
            </div>
          </div>
        </div>
        
        <div className="bg-[#0b1120] p-6 rounded-3xl border border-white/5 relative overflow-hidden group hover:border-white/10 transition-colors">
          <div className="absolute -right-6 -top-6 text-white/5 group-hover:text-emerald-400/5 transition-colors">
            <Search size={120} />
          </div>
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
              <Search size={20} />
            </div>
            <span className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-1 block">Varreduras IA (Hoje)</span>
            <div className="flex items-end gap-3">
              <span className="text-5xl font-black text-white tracking-tight">{metrics.analyzedToday}</span>
              <span className="text-emerald-400 text-sm font-bold bg-emerald-500/10 px-2 py-1 rounded-lg mb-1">Ativo</span>
            </div>
          </div>
        </div>

        <div className="bg-[#0b1120] p-6 rounded-3xl border border-white/5 relative overflow-hidden group hover:border-white/10 transition-colors">
          <div className="absolute -right-6 -top-6 text-white/5 group-hover:text-amber-400/5 transition-colors">
            <Mail size={120} />
          </div>
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
              <Mail size={20} />
            </div>
            <span className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-1 block">Propostas Enviadas</span>
            <div className="flex items-end gap-3">
              <span className="text-5xl font-black text-white tracking-tight">0</span>
              <span className="text-slate-500 text-sm font-bold mb-1">Esta semana</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-10 rounded-3xl border border-primary/20 bg-primary/10 p-6">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity size={18} className="text-primary" /> Fluxo assistido
            </h3>
            <p className="text-slate-300 text-sm mt-1 max-w-3xl">
              Executa uma rotina segura para o dia: analisa leads pendentes, tenta capturar e-mails, prioriza oportunidades e abre a fila pronta para revisão antes do envio.
            </p>
            {automationSummary && (
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold">
                <span className="px-3 py-1.5 rounded-xl bg-white/10 text-slate-200">Analisados: {automationSummary.analyzed}</span>
                <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-300">E-mails capturados: {automationSummary.capturedEmails}</span>
                <span className="px-3 py-1.5 rounded-xl bg-primary/20 text-primary">Prontos para envio: {automationSummary.ready}</span>
                {automationSummary.failed > 0 && <span className="px-3 py-1.5 rounded-xl bg-red-500/15 text-red-300">Falhas: {automationSummary.failed}</span>}
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <button
              onClick={handleDailyAssistedAutomation}
              disabled={bulkProgress !== null}
              className="px-5 py-3 rounded-2xl bg-primary text-white hover:bg-primary-hover font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap size={18} /> Preparar rotina do dia
            </button>
            <button
              onClick={() => openOperationalQueue('followups')}
              className="px-5 py-3 rounded-2xl bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 font-bold transition-all flex items-center justify-center gap-2"
            >
              <Clock size={18} /> Ver follow-ups
            </button>
          </div>
        </div>
      </div>

      <div className="mb-10 bg-[#0b1120] rounded-3xl border border-white/5 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Zap size={18} className="text-primary" /> Atalhos do dia
            </h3>
            <p className="text-slate-400 text-sm mt-1">Acesse as filas mais úteis sem precisar navegar por filtros e menus.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 w-full lg:w-auto">
            <button
              onClick={() => openOperationalQueue('high')}
              className="px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20 transition-all text-left"
            >
              <span className="block text-xs font-black uppercase tracking-wider">Alta oportunidade</span>
              <span className="text-[11px] text-slate-400">Priorizar melhores leads</span>
            </button>
            <button
              onClick={handleSmartEmailQueue}
              className="px-4 py-3 rounded-2xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all text-left"
            >
              <span className="block text-xs font-black uppercase tracking-wider">Fila de e-mails</span>
              <span className="text-[11px] text-slate-400">Preparar disparos úteis</span>
            </button>
            <button
              onClick={() => openOperationalQueue('validated')}
              className="px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 hover:bg-amber-500/20 transition-all text-left"
            >
              <span className="block text-xs font-black uppercase tracking-wider">Validados</span>
              <span className="text-[11px] text-slate-400">Acompanhar abordagens</span>
            </button>
            <button
              onClick={() => openOperationalQueue('followups')}
              className="px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 hover:bg-red-500/20 transition-all text-left"
            >
              <span className="block text-xs font-black uppercase tracking-wider">Follow-ups</span>
              <span className="text-[11px] text-slate-400">Vencidos ou para hoje</span>
            </button>
            <button
              onClick={() => openOperationalQueue('capture')}
              className="px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/10 text-slate-200 hover:bg-white/[0.08] transition-all text-left"
            >
              <span className="block text-xs font-black uppercase tracking-wider">Nova captura</span>
              <span className="text-[11px] text-slate-400">Adicionar oportunidades</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-[#0b1120] rounded-3xl border border-white/5 p-6 relative overflow-hidden">
        <h3 className="text-lg font-bold mb-6 text-white flex items-center gap-2">
          <History size={18} className="text-primary" /> Histórico de Varredura Recente
        </h3>
        
        {latestAnalyses.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-slate-500 mb-4">
              <Search size={24} />
            </div>
            <h4 className="text-white font-bold text-lg mb-1">Nenhum dado capturado ainda</h4>
            <p className="text-slate-400 text-sm max-w-sm">Inicie uma nova captura inteligente para começar a alimentar seu funil de prospecção.</p>
            <button 
              onClick={() => setActiveMenu('nova-captura')}
              className="mt-6 bg-primary hover:bg-primary-hover text-white font-bold py-3 px-6 rounded-xl transition-all"
            >
              Iniciar Nova Captura
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-white/5 uppercase font-bold text-[10px] tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-4 rounded-l-xl">Lead Identificado</th>
                  <th className="px-6 py-4">Origem / Categoria</th>
                  <th className="px-6 py-4 rounded-r-xl">Momento da Captura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {latestAnalyses.map((item, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-semibold text-white">{item.nome || item.titulo || item.url}</td>
                    <td className="px-6 py-4">
                      <span className="bg-white/5 text-slate-300 px-2 py-1 rounded-lg text-xs font-medium capitalize">
                        {item.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs">
                      {new Date(item.data_coleta).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const renderNovaCaptura = () => (
    <div className="p-8 animate-fade-in h-full flex items-center justify-center overflow-y-auto custom-scrollbar bg-surface">
      <div className="w-full max-w-5xl py-10">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">O que vamos <span className="text-primary">prospectar</span> hoje?</h2>
          <p className="text-slate-400 text-lg">Selecione o tipo de tecnologia que deseja analisar</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {/* Sites Option */}
          <div 
            onClick={() => setCaptureForm({...captureForm, tipo: 'sites'})}
            className={`glass p-8 rounded-[2.5rem] border transition-all cursor-pointer group ${
              captureForm.tipo === 'sites' ? 'border-primary bg-primary/10 shadow-[0_0_40px_rgba(37,99,235,0.2)]' : 'border-white/5 hover:border-white/20'
            }`}
          >
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-colors ${
              captureForm.tipo === 'sites' ? 'bg-primary text-white' : 'bg-white/5 text-slate-400 group-hover:text-white'
            }`}>
              <Globe size={32} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Sites Institucionais</h3>
            <p className="text-slate-400 text-sm leading-relaxed">Focado em Design, Performance e SEO. Ideal para Landing Pages e sites corporativos.</p>
          </div>

          {/* Sistemas Option */}
          <div 
            onClick={() => setCaptureForm({...captureForm, tipo: 'sistemas'})}
            className={`glass p-8 rounded-[2.5rem] border transition-all cursor-pointer group ${
              captureForm.tipo === 'sistemas' ? 'border-primary bg-primary/10 shadow-[0_0_40px_rgba(37,99,235,0.2)]' : 'border-white/5 hover:border-white/20'
            }`}
          >
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-colors ${
              captureForm.tipo === 'sistemas' ? 'bg-primary text-white' : 'bg-white/5 text-slate-400 group-hover:text-white'
            }`}>
              <LayoutDashboard size={32} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Sistemas & Apps</h3>
            <p className="text-slate-400 text-sm leading-relaxed">Captura sistemas web, SaaS e apps da Play Store, mesmo quando o lead não possui site próprio.</p>
          </div>

          {/* LinkedIn Option */}
          <div 
            onClick={() => setCaptureForm({...captureForm, tipo: 'linkedin'})}
            className={`glass p-8 rounded-[2.5rem] border transition-all cursor-pointer group ${
              captureForm.tipo === 'linkedin' ? 'border-primary bg-primary/10 shadow-[0_0_40px_rgba(37,99,235,0.2)]' : 'border-white/5 hover:border-white/20'
            }`}
          >
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-colors ${
              captureForm.tipo === 'linkedin' ? 'border-primary text-white' : 'bg-white/5 text-slate-400 group-hover:text-white'
            }`}>
              <Users size={32} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">LinkedIn Pro</h3>
            <p className="text-slate-400 text-sm leading-relaxed">Focado em perfis e empresas. Ideal para ABM e prospecção B2B direta.</p>
          </div>
        </div>

        <div className="glass p-10 rounded-[3rem] border border-white/5 max-w-3xl mx-auto">
          <form onSubmit={handleCaptureSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="relative">
                <label className="block text-sm font-semibold text-slate-400 mb-3 ml-1">O que você busca?</label>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Ex: Clínicas odontológicas..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all pr-12"
                    value={captureForm.nicho}
                    onChange={e => setCaptureForm({...captureForm, nicho: e.target.value})}
                    onFocus={() => setShowNichoDropdown(true)}
                    onBlur={() => setTimeout(() => setShowNichoDropdown(false), 200)}
                    required
                  />
                  <ChevronDown size={20} className={`absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition-transform ${showNichoDropdown ? 'rotate-180' : ''}`} />
                </div>
                
                {showNichoDropdown && (
                  <div className="absolute z-20 w-full mt-2 bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar">
                    {NICHO_OPTIONS.filter(opt => opt.toLowerCase().includes((captureForm.nicho || '').toLowerCase())).map(opt => (
                      <div 
                        key={opt}
                        onMouseDown={() => {
                          setCaptureForm({...captureForm, nicho: opt});
                          setShowNichoDropdown(false);
                        }}
                        className="px-5 py-4 text-sm text-slate-300 hover:bg-primary/20 hover:text-white cursor-pointer transition-colors"
                      >
                        {opt}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <label className="block text-sm font-semibold text-slate-400 mb-3 ml-1">Onde? (Localização)</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                    <MapPin size={20} />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Ex: São Paulo, Brasil..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-12 py-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    value={captureForm.regiao}
                    onChange={e => setCaptureForm({...captureForm, regiao: e.target.value})}
                    onFocus={() => setShowRegiaoDropdown(true)}
                    onBlur={() => setTimeout(() => setShowRegiaoDropdown(false), 200)}
                  />
                </div>

                {showRegiaoDropdown && (
                  <div className="absolute z-20 w-full mt-2 bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar">
                    {REGIAO_OPTIONS.filter(opt => opt.toLowerCase().includes((captureForm.regiao || '').toLowerCase())).map(opt => (
                      <div 
                        key={opt}
                        onMouseDown={() => {
                          setCaptureForm({...captureForm, regiao: opt});
                          setShowRegiaoDropdown(false);
                        }}
                        className="px-5 py-4 text-sm text-slate-300 hover:bg-primary/20 hover:text-white cursor-pointer transition-colors"
                      >
                        {opt}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {captureForm.tipo === 'sites' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className={`flex items-start gap-3 rounded-2xl border p-4 cursor-pointer transition-all ${
                  captureForm.requireEmail ? 'bg-primary/10 border-primary/40 text-white' : 'bg-white/[0.03] border-white/10 text-slate-300 hover:border-white/20'
                }`}>
                  <input
                    type="checkbox"
                    checked={captureForm.requireEmail}
                    onChange={(e) => setCaptureForm({ ...captureForm, requireEmail: e.target.checked })}
                    className="mt-1 w-4 h-4 rounded text-primary focus:ring-primary border-slate-600 bg-surface"
                  />
                  <span>
                    <span className="block text-sm font-bold">Capturar com e-mail</span>
                    <span className="block text-xs text-slate-400 mt-1">Quando marcado sozinho, salva apenas leads com e-mail encontrado.</span>
                  </span>
                </label>
                <label className={`flex items-start gap-3 rounded-2xl border p-4 cursor-pointer transition-all ${
                  captureForm.requireWhatsapp ? 'bg-emerald-500/10 border-emerald-500/40 text-white' : 'bg-white/[0.03] border-white/10 text-slate-300 hover:border-white/20'
                }`}>
                  <input
                    type="checkbox"
                    checked={captureForm.requireWhatsapp}
                    onChange={(e) => setCaptureForm({ ...captureForm, requireWhatsapp: e.target.checked })}
                    className="mt-1 w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 border-slate-600 bg-surface"
                  />
                  <span>
                    <span className="block text-sm font-bold">Capturar com WhatsApp</span>
                    <span className="block text-xs text-slate-400 mt-1">Quando marcado sozinho, salva apenas leads com WhatsApp/celular identificado.</span>
                  </span>
                </label>
              </div>
            )}

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-white">Quantidade de leads</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Defina a meta desta captura. Quando filtros de e-mail/WhatsApp estiverem marcados, o sistema busca mais candidatos para tentar completar a quantidade.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {[10, 20, 30, 50].map(value => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCaptureForm({ ...captureForm, limit: value })}
                      className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                        Number(captureForm.limit) === value
                          ? 'bg-primary/20 border-primary/50 text-primary'
                          : 'bg-dark/40 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                  <input
                    type="number"
                    min={CAPTURE_MIN_LIMIT}
                    max={CAPTURE_MAX_LIMIT}
                    value={captureForm.limit}
                    onChange={(e) => setCaptureForm({ ...captureForm, limit: Math.min(CAPTURE_MAX_LIMIT, Math.max(CAPTURE_MIN_LIMIT, Number(e.target.value) || DEFAULT_CAPTURE_LIMIT)) })}
                    className="w-24 bg-dark/60 border border-white/10 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>
            </div>

            {captureForm.tipo === 'sistemas' && (
              <div className="rounded-3xl border border-primary/20 bg-primary/5 p-5 space-y-5">
                <div>
                  <p className="text-sm font-bold text-white flex items-center gap-2">
                    <LayoutTemplate size={16} className="text-primary" />
                    Fluxo Sistemas & Apps
                  </p>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Busca sistemas web e apps da Play Store, extrai dados do produto, desenvolvedor, contatos, screenshots, descrição, categoria e oportunidade comercial.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { value: 'all', label: 'Web + Play Store', hint: 'Mais abrangente' },
                    { value: 'web', label: 'Somente Web', hint: 'Sites e SaaS' },
                    { value: 'play_store', label: 'Somente Play Store', hint: 'Apps Android' }
                  ].map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setCaptureForm({ ...captureForm, systemCaptureMode: option.value })}
                      className={`rounded-2xl border p-4 text-left transition-all ${
                        captureForm.systemCaptureMode === option.value
                          ? 'bg-primary/20 border-primary/50 text-white'
                          : 'bg-dark/40 border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-200'
                      }`}
                    >
                      <span className="block text-sm font-bold">{option.label}</span>
                      <span className="block text-[11px] text-slate-500 mt-1">{option.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button 
              type="submit" 
              disabled={captureStatus?.status === 'loading'}
              className="w-full bg-gradient-to-r from-primary to-blue-600 hover:from-primary-hover hover:to-blue-700 text-white font-bold py-5 rounded-2xl flex items-center justify-center gap-3 transition-all transform hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              {captureStatus?.status === 'loading' ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Processando IAs...
                </>
              ) : (
                <>
                  <Search size={22} />
                  Iniciar Prospecção IA
                </>
              )}
            </button>

            {captureStatus && (
              <div className={`p-5 rounded-2xl text-sm font-semibold animate-bounce-subtle ${
                captureStatus.status === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                captureStatus.status === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                'bg-primary/10 text-primary border border-primary/20'
              }`}>
                <div className="flex items-center justify-between gap-4">
                  <span>{captureStatus.message}</span>
                  {typeof captureStatus.percent === 'number' && (
                    <span className="text-white font-black">{Math.min(100, Math.max(0, captureStatus.percent))}%</span>
                  )}
                </div>
                {captureStatus.currentLead && (
                  <p className="mt-2 text-xs text-slate-300 font-medium text-left">
                    Lead atual: <span className="text-white">{captureStatus.currentLead}</span>
                  </p>
                )}
                {typeof captureStatus.percent === 'number' && (
                  <div className="mt-4 h-2 rounded-full bg-dark/50 overflow-hidden border border-white/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-blue-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, captureStatus.percent))}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );


  const renderConfiguracoes = () => (
    <div className="relative h-full w-full overflow-y-auto custom-scrollbar flex items-center justify-center p-6 md:p-12 bg-surface">
      {/* Background Decorative Element */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-2xl relative z-10 animate-fade-in">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-6 text-primary shadow-lg shadow-primary/5">
            <Settings size={32} />
          </div>
          <h2 className="text-4xl font-bold text-white tracking-tight mb-3">
            Configurações <span className="text-primary">& SMTP</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-md mx-auto">
            Configure seu servidor de e-mail para automatizar o envio de propostas e follow-ups.
          </p>
        </div>

        <div className="glass p-6 rounded-3xl border border-white/10 shadow-xl mb-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/20 text-amber-300 flex items-center justify-center shrink-0">
              <BookOpen size={22} />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Manual do Usuário</h3>
              <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                Consulte o guia completo com a finalidade de cada menu, fluxo de captura, envio, WhatsApp, layout, CRM e boas práticas de conversão.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openUserManual}
            className="bg-amber-400/10 border border-amber-400/30 hover:bg-amber-400/20 text-amber-300 font-bold px-5 py-3 rounded-2xl transition-all flex items-center justify-center gap-2 shrink-0"
          >
            <Download size={18} />
            Baixar Manual PDF
          </button>
        </div>
        
        <div className="glass p-8 md:p-10 rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden">
          {/* Subtle Inner Glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
          
          <h3 className="text-xl font-bold mb-8 text-white flex items-center gap-3">
            <Server size={20} className="text-primary" />
            Servidor de Saída
          </h3>

          <div className="mb-8">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1 block mb-3">Provedor SMTP</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Object.entries(SMTP_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applySmtpPreset(key)}
                  className={`text-left rounded-2xl border p-4 transition-all ${
                    smtpConfig.preset === key
                      ? 'bg-primary/15 border-primary/50 text-white shadow-lg shadow-primary/10'
                      : 'bg-dark/40 border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`}
                >
                  <span className="block text-sm font-bold">{preset.label}</span>
                  <span className="block text-[11px] mt-1 leading-snug text-slate-500">{preset.host || 'Configuração manual'}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-3">
              {SMTP_PRESETS[smtpConfig.preset]?.hint || SMTP_PRESETS.custom.hint}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Host SMTP</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">
                  <Globe size={18} />
                </div>
                <input 
                  type="text" 
                  placeholder="smtp.gmail.com"
                  className="w-full bg-dark/40 border border-white/10 rounded-2xl px-12 py-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all placeholder:text-slate-600"
                  value={smtpConfig.host}
                  onChange={e => setSmtpConfig({...smtpConfig, host: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Porta</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">
                  <Hash size={18} />
                </div>
                <input 
                  type="text" 
                  placeholder="465 ou 587"
                  className="w-full bg-dark/40 border border-white/10 rounded-2xl px-12 py-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all placeholder:text-slate-600"
                  value={smtpConfig.port}
                  onChange={e => setSmtpConfig({...smtpConfig, port: e.target.value, secure: normalizeSmtpSecure(e.target.value, smtpConfig.secure)})}
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center justify-between gap-4 rounded-2xl bg-dark/40 border border-white/10 px-5 py-4 cursor-pointer hover:border-primary/30 transition-colors">
                <span>
                  <span className="block text-sm font-bold text-white">Conexão segura direta SSL/TLS</span>
                  <span className="block text-xs text-slate-500 mt-1">Ative para porta 465. Para porta 587, normalmente fica desativado e usa STARTTLS.</span>
                </span>
                <input
                  type="checkbox"
                  checked={normalizeSmtpSecure(smtpConfig.port, smtpConfig.secure)}
                  onChange={e => setSmtpConfig({...smtpConfig, secure: normalizeSmtpSecure(smtpConfig.port, e.target.checked)})}
                  disabled={Number(smtpConfig.port) === 465 || Number(smtpConfig.port) === 587 || Number(smtpConfig.port) === 25}
                  className="w-5 h-5 rounded text-primary focus:ring-primary border-slate-600 bg-surface shrink-0"
                />
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Usuário / E-mail</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">
                  <Mail size={18} />
                </div>
                <input 
                  type="text" 
                  placeholder="exemplo@dominio.com"
                  className="w-full bg-dark/40 border border-white/10 rounded-2xl px-12 py-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all placeholder:text-slate-600"
                  value={smtpConfig.user}
                  onChange={e => setSmtpConfig({...smtpConfig, user: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Senha / App Password</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">
                  <Lock size={18} />
                </div>
                <input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="⬢⬢⬢⬢⬢⬢⬢⬢⬢⬢⬢⬢"
                  className="w-full bg-dark/40 border border-white/10 rounded-2xl px-12 py-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all pr-12 placeholder:text-slate-600"
                  value={smtpConfig.pass}
                  onChange={e => setSmtpConfig({...smtpConfig, pass: e.target.value})}
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="col-span-1 md:col-span-2 space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Nome na Assinatura</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">
                  <PenTool size={18} />
                </div>
                <input 
                  type="text" 
                  placeholder="Ex: João Silva"
                  className="w-full bg-dark/40 border border-white/10 rounded-2xl px-12 py-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all placeholder:text-slate-600"
                  value={smtpConfig.signatureName}
                  onChange={e => setSmtpConfig({...smtpConfig, signatureName: e.target.value})}
                />
              </div>
            </div>
          </div>

          {smtpStatus && (
            <div className={`p-4 rounded-2xl mb-8 flex items-center gap-3 animate-fade-in ${
              smtpStatus.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
              smtpStatus.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
              'bg-primary/10 text-primary border border-primary/20'
            }`}>
              {smtpStatus.type === 'success' ? <CheckCircle size={18} /> : smtpStatus.type === 'error' ? <ShieldAlert size={18} /> : <Activity size={18} />}
              <span className="text-sm font-medium">{smtpStatus.msg}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={saveSmtpConfig}
              className="flex-1 bg-gradient-to-r from-primary to-primary-hover text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 transition-all flex justify-center items-center gap-2 group"
            >
              <Save size={20} className="group-hover:scale-110 transition-transform" />
              Salvar Alterações
            </button>
            <button
              onClick={testSmtpConnection}
              className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold py-4 rounded-2xl transition-all flex justify-center items-center gap-2 group"
            >
              <Send size={20} className="text-primary group-hover:rotate-12 transition-transform" />
              Testar Conexão
            </button>
          </div>

          {/* Kentauros Integration */}
          <div className="mt-10 pt-8 border-t border-white/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-k-gold-500/10 border border-k-gold-500/20 text-k-gold-400 flex items-center justify-center shrink-0">
                <Rocket size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Integração Kentauros OS</h3>
                <p className="text-slate-400 text-sm">Envio automático em tempo real após cada captura</p>
              </div>
            </div>

            <div className="glass p-5 rounded-2xl border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-slate-300 font-medium">Ativar integração</label>
                <button
                  onClick={() => {
                    const next = { ...kentaurosConfig, enabled: !kentaurosConfig.enabled };
                    setKentaurosConfig(next);
                    persistKentaurosConfig(next);
                  }}
                  className={`relative w-12 h-6 rounded-full transition-colors ${kentaurosConfig.enabled ? 'bg-k-gold-500' : 'bg-white/10'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${kentaurosConfig.enabled ? 'right-1' : 'left-1'}`} />
                </button>
              </div>

              <div>
                <label className="block text-slate-400 text-sm mb-2">URL da Kentauros</label>
                <input
                  type="url"
                  placeholder="https://kentauros-os-app.vercel.app"
                  value={kentaurosConfig.url}
                  onChange={(e) => setKentaurosConfig(prev => ({ ...prev, url: e.target.value }))}
                  onBlur={() => persistKentaurosConfig(kentaurosConfig)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-k-gold-500/50"
                />
                <p className="text-slate-500 text-xs mt-2">
                  Leads capturados são enviados automaticamente para esta URL quando a integração está ativa.
                </p>
              </div>

              {kentaurosExportStatus && (
                <div className={`p-3 rounded-xl text-sm ${
                  kentaurosExportStatus.exporting ? 'bg-primary/10 text-primary' :
                  kentaurosExportStatus.success ? 'bg-emerald-500/10 text-emerald-400' :
                  'bg-red-500/10 text-red-400'
                }`}>
                  {kentaurosExportStatus.message}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderWhatsappComercial = () => {
    const sampleLeads = whatsappCommercialLeads.slice(0, 6);

    return (
      <div className="p-8 animate-fade-in h-full overflow-y-auto custom-scrollbar bg-surface">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-3 text-emerald-300 text-xs font-black uppercase tracking-widest mb-3">
              <MessageCircle size={16} /> Área Comercial
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">WhatsApp Business</h1>
            <p className="text-slate-400 mt-2 max-w-3xl">
              Central inicial para gerenciar conversas e automações futuras com leads validados que possuem telefone ou WhatsApp capturado.
            </p>
          </div>
          <button
            type="button"
            onClick={() => showAppAlert({
              title: 'Integração em preparação',
              message: 'A associação com WhatsApp Business será conectada em uma próxima etapa. Por enquanto, esta tela organiza a visão comercial e a base elegível para automações.',
              variant: 'info'
            })}
            className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300 font-bold px-5 py-3 rounded-2xl transition-all flex items-center justify-center gap-2"
          >
            <Radio size={18} />
            Associar WhatsApp Business
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <div className="glass rounded-3xl border border-white/10 p-6">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-300 flex items-center justify-center mb-5">
              <Users size={22} />
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Leads elegíveis</p>
            <div className="flex items-end gap-3 mt-2">
              <span className="text-4xl font-black text-white">{whatsappCommercialLeads.length}</span>
              <span className="text-xs text-slate-400 mb-2">validados com WhatsApp</span>
            </div>
          </div>

          <div className="glass rounded-3xl border border-white/10 p-6">
            <div className="w-11 h-11 rounded-2xl bg-amber-400/10 text-amber-300 flex items-center justify-center mb-5">
              <Bell size={22} />
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Não visualizadas</p>
            <div className="flex items-end gap-3 mt-2">
              <span className="text-4xl font-black text-white">{whatsappUnreadCount}</span>
              <span className="text-xs text-slate-400 mb-2">mensagens</span>
            </div>
          </div>

          <div className="glass rounded-3xl border border-white/10 p-6">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-5">
              <Bot size={22} />
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Automações programadas</p>
            <div className="flex items-end gap-3 mt-2">
              <span className="text-4xl font-black text-white">{whatsappScheduledCount}</span>
              <span className="text-xs text-slate-400 mb-2">ativas</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-6">
          <div className="glass rounded-3xl border border-white/10 overflow-hidden">
            <div className="p-6 border-b border-white/10 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Fila comercial WhatsApp</h2>
                <p className="text-sm text-slate-400 mt-1">Somente leads validados capturados no Lead Hunter com número disponível.</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold">
                Base Lead Hunter
              </span>
            </div>
            <div className="divide-y divide-white/5">
              {sampleLeads.length > 0 ? sampleLeads.map(lead => (
                <div key={`${lead._typeCode}-${lead.id}`} className="p-5 flex items-center justify-between gap-4 hover:bg-white/[0.03] transition-colors">
                  <div className="min-w-0">
                    <p className="text-white font-bold truncate">{getLeadName(lead)}</p>
                    <p className="text-slate-400 text-xs mt-1 font-mono">{lead.telefone}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {lead.wpp_enviado ? (
                      <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[11px] font-bold">
                        WhatsApp enviado
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[11px] font-bold">
                        Pendente
                      </span>
                    )}
                  </div>
                </div>
              )) : (
                <div className="p-10 text-center">
                  <MessageCircle size={30} className="mx-auto text-slate-600 mb-3" />
                  <p className="text-white font-bold">Nenhum lead validado com WhatsApp ainda</p>
                  <p className="text-slate-400 text-sm mt-2">Valide leads com telefone no Lead Hunter para alimentar esta central.</p>
                </div>
              )}
            </div>
          </div>

          <div className="glass rounded-3xl border border-white/10 p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                <Calendar size={22} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Automação programada</h2>
                <p className="text-sm text-slate-400 mt-1">Planeje comunicados para leads validados. O envio automático será habilitado quando o WhatsApp Business estiver associado.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Público</label>
                <div className="bg-dark/50 border border-white/10 rounded-2xl px-4 py-3 text-slate-300">
                  Leads validados com WhatsApp ({whatsappCommercialLeads.length})
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Data e horário</label>
                <input
                  type="datetime-local"
                  disabled
                  className="w-full bg-dark/50 border border-white/10 rounded-2xl px-4 py-3 text-slate-500 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Comunicado</label>
                <textarea
                  disabled
                  rows={5}
                  placeholder="Ex: Olá, tudo bem? Preparei algumas observações rápidas sobre o site de vocês..."
                  className="w-full bg-dark/50 border border-white/10 rounded-2xl px-4 py-3 text-slate-500 resize-none cursor-not-allowed placeholder:text-slate-600"
                />
              </div>
              <button
                type="button"
                disabled
                className="w-full bg-white/5 border border-white/10 text-slate-500 font-bold py-4 rounded-2xl cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Bot size={18} />
                Agendamento disponível em breve
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const filterLead = (lead) => {
    // Search filter (already handled by list passed to renderLeadsGrid if applicable, but we check here too)
    
    if (gridFilters.source !== 'todos') {
      const isPlayStoreOnly = lead.tipo_origem === 'play_store' && !lead.developer_site;
      const hasSite = !!(lead.url || lead.site_oficial || lead.developer_site) && !isPlayStoreOnly;
      if (gridFilters.source === 'com_site' && !hasSite) return false;
      if (gridFilters.source === 'sem_site' && hasSite) return false;
    }

    // Date filter
    if (gridFilters.date !== 'todos') {
      const leadDate = new Date(lead.data_coleta);
      const now = new Date();
      if (gridFilters.date === 'hoje') {
        if (leadDate.toDateString() !== now.toDateString()) return false;
      } else if (gridFilters.date === 'semana') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (leadDate < weekAgo) return false;
      } else if (gridFilters.date === 'mes') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (leadDate < monthAgo) return false;
      }
    }

    // Contacts Captured
    if (gridFilters.hasEmail && !(lead.has_email_count > 0)) return false;
    if (gridFilters.hasWpp && !(lead.has_phone_count > 0 || classifyBrazilPhone(lead.telefone).type === 'mobile')) return false;
    if (gridFilters.wppSent && !lead.wpp_enviado) return false;
    if (gridFilters.highOpportunity && getCommercialScore(lead, lead._typeCode || activeMenu) < 78) return false;
    if (gridFilters.followupDue && !isFollowupDue(lead)) return false;

    return true;
  };

  const parseJsonArray = (value) => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  };

  const renderSystemAppsGrid = (list) => {
    let filteredList = list
      .filter(filterLead)
      .sort((a, b) => getCommercialScore(b, 'sistema') - getCommercialScore(a, 'sistema'));
    if (wppFilter) filteredList = filteredList.filter(l => !l.wpp_enviado);

    const totalItems = filteredList.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const paginatedList = filteredList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const gridStats = {
      web: filteredList.filter(lead => lead.tipo_origem !== 'play_store').length,
      apps: filteredList.filter(lead => lead.tipo_origem === 'play_store').length,
      noSite: filteredList.filter(lead => lead.tipo_origem === 'play_store' && !lead.developer_site).length,
      withContact: filteredList.filter(lead => lead.email || lead.developer_email || classifyBrazilPhone(lead.telefone).type !== 'none').length
    };

    return (
      <div className="p-8 animate-fade-in h-full flex flex-col bg-surface">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold text-white">Sistemas & Apps Capturados</h2>
            <p className="text-slate-400 text-sm mt-1">Leads de software web, SaaS e apps Android com dados do produto e desenvolvedor.</p>
          </div>
          <div className="flex gap-3 flex-wrap items-center">
            <button
              onClick={() => handleBulkAnalysis(filteredList, 'sistema')}
              disabled={bulkProgress !== null}
              className="bg-primary/20 text-primary border border-primary/50 hover:bg-primary hover:text-white px-5 py-2.5 rounded-xl transition-all font-semibold text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <Check size={16} /> Analisar Todos
            </button>
            <button
              onClick={() => handleBulkEmail(filteredList, 'sistema')}
              disabled={bulkProgress !== null}
              className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500 hover:text-white px-5 py-2.5 rounded-xl transition-all font-semibold text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <Send size={16} /> Disparar E-mails
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
          <div className="rounded-2xl bg-white/[0.03] border border-white/5 px-4 py-3">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Filtrados</span>
            <p className="text-white text-xl font-black mt-1">{totalItems}</p>
          </div>
          <div className="rounded-2xl bg-primary/10 border border-primary/20 px-4 py-3">
            <span className="text-[10px] uppercase tracking-wider text-primary font-bold">Web/SaaS</span>
            <p className="text-primary text-xl font-black mt-1">{gridStats.web}</p>
          </div>
          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
            <span className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold">Play Store</span>
            <p className="text-emerald-300 text-xl font-black mt-1">{gridStats.apps}</p>
          </div>
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 px-4 py-3">
            <span className="text-[10px] uppercase tracking-wider text-amber-300 font-bold">Com contato</span>
            <p className="text-amber-300 text-xl font-black mt-1">{gridStats.withContact}</p>
          </div>
        </div>

        <div className="mb-6 p-4 rounded-3xl bg-white/[0.03] border border-white/5 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-dark/40 border border-white/5 min-w-[150px]">
            <Globe size={14} className="text-slate-500" />
            <select
              value={gridFilters.source}
              onChange={(e) => setGridFilters({ ...gridFilters, source: e.target.value })}
              className="bg-transparent text-xs font-semibold text-slate-300 focus:outline-none w-full cursor-pointer"
            >
              <option value="todos" className="bg-surface text-white">Origem: Todas</option>
              <option value="com_site" className="bg-surface text-white">Com site</option>
              <option value="sem_site" className="bg-surface text-white">Sem site</option>
            </select>
          </div>
          <button
            onClick={() => setGridFilters({ ...gridFilters, hasEmail: !gridFilters.hasEmail })}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all ${
              gridFilters.hasEmail ? 'bg-primary/20 text-primary border-primary/40' : 'bg-dark/40 text-slate-500 border-white/5 hover:text-slate-300'
            }`}
          >
            <Mail size={14} /> E-mail Capturado
          </button>
          <button
            onClick={() => setGridFilters({ ...gridFilters, highOpportunity: !gridFilters.highOpportunity })}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all ${
              gridFilters.highOpportunity ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-dark/40 text-slate-500 border-white/5 hover:text-slate-300'
            }`}
          >
            <Target size={14} /> Alta Oportunidade
          </button>
          {(gridFilters.source !== 'todos' || gridFilters.hasEmail || gridFilters.highOpportunity) && (
            <button
              onClick={() => setGridFilters({ source: 'todos', date: 'todos', hasEmail: false, hasWpp: false, wppSent: false, highOpportunity: false, followupDue: false })}
              className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors ml-auto"
            >
              <X size={14} /> Limpar Filtros
            </button>
          )}
        </div>

        {bulkProgress && (
          <div className="mb-6 bg-surface border border-border-light rounded-2xl p-5 flex flex-col gap-3 shadow-xl">
            <div className="flex justify-between items-center text-sm font-medium text-slate-300">
              <span className="truncate max-w-sm">{bulkProgress.text}</span>
              <span className="text-primary font-bold">{bulkProgress.current} / {bulkProgress.total}</span>
            </div>
            <div className="w-full bg-dark/50 rounded-full h-3 overflow-hidden border border-white/5">
              <div className="bg-gradient-to-r from-primary to-emerald-400 h-full rounded-full transition-all duration-300" style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }} />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto rounded-3xl border border-white/5 glass relative">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="uppercase font-semibold text-xs text-slate-400">
              <tr>
                <th className="px-6 py-5 sticky top-0 z-30 bg-[#141c2f]">Produto / Origem</th>
                <th className="px-6 py-5 sticky top-0 z-30 bg-[#141c2f]">Desenvolvedor</th>
                <th className="px-6 py-5 sticky top-0 z-30 bg-[#141c2f]">Contato</th>
                <th className="px-6 py-5 sticky top-0 z-30 bg-[#141c2f]">Dados do App</th>
                <th className="px-6 py-5 sticky top-0 z-30 bg-[#141c2f]">Oportunidade</th>
                <th className="px-6 py-5 text-right sticky top-0 z-30 bg-[#141c2f]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {paginatedList.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-16 text-center">
                    <LayoutTemplate size={28} className="mx-auto text-slate-600 mb-3" />
                    <p className="text-white font-bold">Nenhum sistema ou app neste recorte</p>
                    <p className="text-slate-400 text-sm mt-1">Faça uma nova captura ou limpe os filtros aplicados.</p>
                  </td>
                </tr>
              ) : paginatedList.map(lead => {
                const commercialScore = getCommercialScore(lead, 'sistema');
                const opportunity = getOpportunityLevel(commercialScore);
                const features = parseJsonArray(lead.features_json);
                const appUrl = lead.app_store_url || lead.url;
                const siteUrl = lead.developer_site || (lead.tipo_origem !== 'play_store' ? lead.url : '');
                return (
                  <tr key={`sistema-${lead.id}`} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-5 min-w-[280px]">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${lead.tipo_origem === 'play_store' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-primary/10 text-primary'}`}>
                          {lead.tipo_origem === 'play_store' ? <Bot size={18} /> : <LayoutTemplate size={18} />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate max-w-[260px]">{getLeadName(lead)}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${lead.tipo_origem === 'play_store' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-primary/10 text-primary border-primary/20'}`}>
                              {lead.tipo_origem === 'play_store' ? 'Play Store' : 'Sistema Web'}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/5 text-slate-300 border border-white/10 truncate max-w-[190px]">
                              {lead.app_category || getLeadCategory(lead)}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-3">
                            {siteUrl && <a href={siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`} target="_blank" rel="noreferrer" className="text-primary hover:underline text-[10px] flex items-center gap-1"><ExternalLink size={10} /> Site</a>}
                            {lead.app_store_url && <a href={appUrl} target="_blank" rel="noreferrer" className="text-emerald-300 hover:underline text-[10px] flex items-center gap-1"><ExternalLink size={10} /> App</a>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-white font-semibold max-w-[180px] truncate">{lead.developer_name || 'Não identificado'}</p>
                      {lead.package_id && <p className="text-[10px] text-slate-500 font-mono mt-1 max-w-[180px] truncate">{lead.package_id}</p>}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1.5">
                        {lead.email || lead.developer_email ? (
                          <span className="inline-flex items-center gap-1 bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded-md font-medium w-max">
                            <Mail size={10} /> E-mail capturado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-slate-500/20 text-slate-400 text-[10px] px-2 py-0.5 rounded-md font-medium w-max">Sem e-mail</span>
                        )}
                        {classifyBrazilPhone(lead.telefone).type !== 'none' && (
                          <span className="inline-flex items-center gap-1 bg-green-500/15 text-green-300 text-[10px] px-2 py-0.5 rounded-md font-medium w-max">
                            <Phone size={10} /> Telefone
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="text-xs text-slate-300 space-y-1">
                        {lead.rating && <p><span className="text-slate-500">Nota:</span> {lead.rating}</p>}
                        {lead.installs && <p><span className="text-slate-500">Instalações:</span> {lead.installs}</p>}
                        {lead.last_update && <p><span className="text-slate-500">Atualização:</span> {lead.last_update}</p>}
                        {!lead.rating && !lead.installs && <p className="text-slate-500">{features[0] || 'Dados comerciais salvos'}</p>}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <div className={`w-11 h-9 rounded-xl flex items-center justify-center font-black text-xs border ${opportunity.bg} ${opportunity.color} ${opportunity.border}`}>{commercialScore}</div>
                        <div>
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${opportunity.color}`}>{opportunity.label}</span>
                          <span className="block text-[10px] text-slate-500">UX {lead.score_ux || '-'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleOpenDetails({ ...lead, _typeCode: 'sistema' })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all text-xs font-bold">
                          <Info size={14} /> Detalhes
                        </button>
                        <button onClick={() => handleRecommendedAction(lead, 'sistema')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500 hover:text-white transition-all text-xs font-bold">
                          <Zap size={14} /> Fazer agora
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 bg-white/[0.03] border border-white/5 p-4 rounded-3xl">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            {totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} - {Math.min(currentPage * itemsPerPage, totalItems)} de {totalItems} leads
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-xl bg-dark/40 border border-white/10 text-slate-400 hover:text-white disabled:opacity-30"><ChevronLeft size={16} /></button>
            <span className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold">{currentPage}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages || 1, p + 1))} disabled={currentPage >= (totalPages || 1)} className="p-2 rounded-xl bg-dark/40 border border-white/10 text-slate-400 hover:text-white disabled:opacity-30"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>
    );
  };

  const renderLeadsGrid = (list, typeTitle, typeCode) => {
    if (typeCode === 'sistema') return renderSystemAppsGrid(list);
    // Aplicar filtros avançados
    let filteredList = list
      .filter(filterLead)
      .sort((a, b) => getCommercialScore(b, b._typeCode || typeCode) - getCommercialScore(a, a._typeCode || typeCode));
    
    // Filtro WPP Legado
    if (wppFilter) filteredList = filteredList.filter(l => !l.wpp_enviado);

    // Lógica de Paginação
    const totalItems = filteredList.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const paginatedList = filteredList.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
    const visibleKeys = paginatedList.map(lead => getLeadSelectionKey(lead, lead._typeCode || typeCode));
    const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every(key => selectedLeadKeys.includes(key));
    const selectedInGrid = filteredList.filter(lead => selectedLeadKeys.includes(getLeadSelectionKey(lead, lead._typeCode || typeCode)));
    const selectedCount = selectedInGrid.length;
    const gridStats = {
      high: filteredList.filter(lead => getCommercialScore(lead, lead._typeCode || typeCode) >= 78).length,
      email: filteredList.filter(lead => lead.has_email_count > 0 || lead.email).length,
      pendingEmail: filteredList.filter(lead => !lead.email_enviado).length,
      due: filteredList.filter(isFollowupDue).length,
      apps: filteredList.filter(lead => lead.tipo_origem === 'play_store').length,
      web: filteredList.filter(lead => lead.tipo_origem !== 'play_store').length,
      noSite: filteredList.filter(lead => lead.tipo_origem === 'play_store' && !lead.developer_site).length
    };

    return (
      <div className="p-8 animate-fade-in h-full flex flex-col bg-surface">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-white">{typeTitle}</h2>
          <div className="flex gap-3 flex-wrap items-center">
            <button 
              onClick={() => handleBulkAnalysis(filteredList, typeCode)}
              disabled={bulkProgress !== null}
              className="bg-primary/20 text-primary border border-primary/50 hover:bg-primary hover:text-white px-5 py-2.5 rounded-xl transition-all font-semibold text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check size={16} /> Analisar Todos
            </button>
            <button
              onClick={() => handleBulkEmail(filteredList, typeCode)}
              disabled={bulkProgress !== null}
              className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500 hover:text-white px-5 py-2.5 rounded-xl transition-all font-semibold text-sm flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={16} /> Disparar E-mails
            </button>

            {/* Botão Exportar para Kentauros */}
            {kentaurosConfig.enabled && kentaurosConfig.url && (
              <button
                onClick={() => exportToKentauros(filteredList)}
                disabled={kentaurosExportStatus?.exporting || filteredList.length === 0}
                className="bg-k-gold-500/20 text-k-gold-400 border border-k-gold-500/50 hover:bg-k-gold-500 hover:text-white px-5 py-2.5 rounded-xl transition-all font-semibold text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Rocket size={16} /> Exportar ({filteredList.length})
              </button>
            )}

            <button
              onClick={() => exportLeadsToExcel(selectedCount > 0 ? selectedInGrid : filteredList, typeCode)}
              disabled={excelExportStatus?.exporting || filteredList.length === 0}
              className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/45 hover:bg-cyan-500 hover:text-white px-5 py-2.5 rounded-xl transition-all font-semibold text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              title={selectedCount > 0 ? 'Exportar leads selecionados para Excel' : 'Exportar leads filtrados para Excel'}
            >
              <Download size={16} /> Excel ({selectedCount > 0 ? selectedCount : filteredList.length})
            </button>

            {typeCode === 'sites' && (
              <>
                <button
                  onClick={handleSmartEmailQueue}
                  disabled={bulkProgress !== null}
                  className="bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500 hover:text-white px-5 py-2.5 rounded-xl transition-all font-semibold text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Zap size={16} /> Fila Inteligente
                </button>
                <button
                  onClick={handleCleanCapturedSiteLeads}
                  disabled={bulkProgress !== null}
                  className="bg-red-500/15 text-red-300 border border-red-500/35 hover:bg-red-500 hover:text-white px-5 py-2.5 rounded-xl transition-all font-semibold text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Remove leads sem e-mail, sem WhatsApp capturado e sem layout gerado"
                >
                  <Trash2 size={16} /> Limpar Frios
                </button>
              </>
            )}
          </div>
        </div>

        {typeCode === 'sistema' && (
          <div className="mb-5 rounded-3xl border border-primary/20 bg-primary/5 p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div>
              <p className="text-white font-bold flex items-center gap-2">
                <LayoutTemplate size={18} className="text-primary" />
                Grid especializado para Sistemas & Apps
              </p>
              <p className="text-slate-400 text-sm mt-1">
                Centraliza sistemas web, SaaS e apps da Play Store com dados do produto, desenvolvedor, contato e oportunidade comercial.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] font-bold">
              <span className="px-3 py-1.5 rounded-xl bg-primary/15 text-primary border border-primary/20">{gridStats.web} Web/SaaS</span>
              <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">{gridStats.apps} Play Store</span>
              <span className="px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/20">{gridStats.noSite} sem site</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 mb-5">
          <div className="rounded-2xl bg-white/[0.03] border border-white/5 px-4 py-3">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Filtrados</span>
            <p className="text-white text-xl font-black mt-1">{totalItems}</p>
          </div>
          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
            <span className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold">Alta oportunidade</span>
            <p className="text-emerald-300 text-xl font-black mt-1">{gridStats.high}</p>
          </div>
          <div className="rounded-2xl bg-primary/10 border border-primary/20 px-4 py-3">
            <span className="text-[10px] uppercase tracking-wider text-primary font-bold">Com e-mail</span>
            <p className="text-primary text-xl font-black mt-1">{gridStats.email}</p>
          </div>
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 px-4 py-3">
            <span className="text-[10px] uppercase tracking-wider text-amber-300 font-bold">Pendentes envio</span>
            <p className="text-amber-300 text-xl font-black mt-1">{gridStats.pendingEmail}</p>
          </div>
          <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-4 py-3">
            <span className="text-[10px] uppercase tracking-wider text-red-300 font-bold">Follow-up hoje</span>
            <p className="text-red-300 text-xl font-black mt-1">{gridStats.due}</p>
          </div>
        </div>

        {selectedCount > 0 && (
          <div className="mb-5 rounded-2xl border border-primary/30 bg-primary/10 px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 animate-fade-in">
            <div>
              <p className="text-white font-bold">{selectedCount} lead{selectedCount > 1 ? 's' : ''} selecionado{selectedCount > 1 ? 's' : ''}</p>
              <p className="text-xs text-slate-400 mt-0.5">Aplique ações somente nos itens marcados nesta lista.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleBulkEmail(selectedInGrid, typeCode)}
                disabled={bulkProgress !== null}
                className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500 hover:text-white text-xs font-bold transition-all disabled:opacity-50"
              >
                Enviar selecionados
              </button>
              <button
                onClick={() => handleBulkAnalysis(selectedInGrid, typeCode)}
                disabled={bulkProgress !== null}
                className="px-4 py-2 rounded-xl bg-primary/20 border border-primary/40 text-primary hover:bg-primary hover:text-white text-xs font-bold transition-all disabled:opacity-50"
              >
                Analisar selecionados
              </button>
              <button
                onClick={() => setSelectedLeadKeys([])}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 text-xs font-bold transition-all"
              >
                Limpar seleção
              </button>
            </div>
          </div>
        )}

        {/* Barra de Filtros Avançados */}
        <div className="mb-6 p-4 rounded-3xl bg-white/[0.03] border border-white/5 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-dark/40 border border-white/5 min-w-[150px]">
            <Globe size={14} className="text-slate-500" />
            <select 
              value={gridFilters.source}
              onChange={(e) => setGridFilters({...gridFilters, source: e.target.value})}
              className="bg-transparent text-xs font-semibold text-slate-300 focus:outline-none w-full cursor-pointer"
            >
              <option value="todos" className="bg-surface text-white">Filtro: Todos</option>
              <option value="com_site" className="bg-surface text-white">Com site</option>
              <option value="sem_site" className="bg-surface text-white">Sem site</option>
            </select>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-dark/40 border border-white/5 min-w-[150px]">
            <Calendar size={14} className="text-slate-500" />
            <select 
              value={gridFilters.date}
              onChange={(e) => setGridFilters({...gridFilters, date: e.target.value})}
              className="bg-transparent text-xs font-semibold text-slate-300 focus:outline-none w-full cursor-pointer"
            >
              <option value="todos" className="bg-surface text-white">Data: Todas</option>
              <option value="hoje" className="bg-surface text-white">Capturados Hoje</option>
              <option value="semana" className="bg-surface text-white">Últimos 7 dias</option>
              <option value="mes" className="bg-surface text-white">Último mês</option>
            </select>
          </div>

          <button
            onClick={() => setGridFilters({...gridFilters, hasEmail: !gridFilters.hasEmail})}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all ${
              gridFilters.hasEmail 
                ? 'bg-primary/20 text-primary border-primary/40' 
                : 'bg-dark/40 text-slate-500 border-white/5 hover:text-slate-300'
            }`}
          >
            <Mail size={14} /> E-mail Capturado
          </button>

          <button
            onClick={() => setGridFilters({...gridFilters, hasWpp: !gridFilters.hasWpp})}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all ${
              gridFilters.hasWpp 
                ? 'bg-green-500/20 text-green-400 border-green-500/40' 
                : 'bg-dark/40 text-slate-500 border-white/5 hover:text-slate-300'
            }`}
          >
            <MessageCircle size={14} /> WhatsApp Capturado
          </button>

          <button
            onClick={() => setGridFilters({...gridFilters, wppSent: !gridFilters.wppSent})}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all ${
              gridFilters.wppSent 
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                : 'bg-dark/40 text-slate-500 border-white/5 hover:text-slate-300'
            }`}
          >
            <Check size={14} /> WhatsApp Enviado
          </button>

          <button
            onClick={() => setGridFilters({...gridFilters, highOpportunity: !gridFilters.highOpportunity})}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all ${
              gridFilters.highOpportunity
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-dark/40 text-slate-500 border-white/5 hover:text-slate-300'
            }`}
          >
            <Target size={14} /> Alta Oportunidade
          </button>

          <button
            onClick={() => setGridFilters({...gridFilters, followupDue: !gridFilters.followupDue})}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all ${
              gridFilters.followupDue
                ? 'bg-red-500/20 text-red-300 border-red-500/40'
                : 'bg-dark/40 text-slate-500 border-white/5 hover:text-slate-300'
            }`}
          >
            <Clock size={14} /> Follow-up Hoje
          </button>

          <div className="h-6 w-px bg-white/5 mx-2"></div>

          <button
            onClick={() => setWppFilter(!wppFilter)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all ${
              wppFilter 
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' 
                : 'bg-dark/40 text-slate-500 border-white/5 hover:text-slate-300'
            }`}
            title="Mostrar apenas leads que ainda não foram marcados como contatados via WPP"
          >
            <ListFilter size={14} /> Pendentes WPP
          </button>

          {(gridFilters.source !== 'todos' || gridFilters.date !== 'todos' || gridFilters.hasEmail || gridFilters.hasWpp || gridFilters.wppSent || gridFilters.highOpportunity || gridFilters.followupDue || wppFilter) && (
            <button
              onClick={() => {
                setGridFilters({source: 'todos', date: 'todos', hasEmail: false, hasWpp: false, wppSent: false, highOpportunity: false, followupDue: false});
                setWppFilter(false);
              }}
              className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors ml-auto"
            >
              <X size={14} /> Limpar Filtros
            </button>
          )}
        </div>

        {bulkProgress && (
          <div className="mb-6 bg-surface border border-border-light rounded-2xl p-5 flex flex-col gap-3 shadow-xl">
             <div className="flex justify-between items-center text-sm font-medium text-slate-300">
               <span className="truncate max-w-sm">{bulkProgress.text}</span>
               <div className="flex items-center gap-3 shrink-0">
                 <span className="text-primary font-bold">{bulkProgress.current} / {bulkProgress.total}</span>
                 <button
                   onClick={() => { bulkCancelRef.current = true; }}
                   className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/40 text-xs font-bold transition-all"
                   title="Cancelar operação em lote"
                 >
                   <X size={13} /> Cancelar
                 </button>
               </div>
             </div>
             <div className="w-full bg-dark/50 rounded-full h-3 overflow-hidden border border-white/5">
               <div 
                 className="bg-gradient-to-r from-primary to-emerald-400 h-full rounded-full transition-all duration-300 relative" 
                 style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
               >
                 <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
               </div>
             </div>
          </div>
        )}

        {bulkSummary && (
          <div className={`mb-6 rounded-2xl p-5 flex flex-col gap-2 shadow-xl animate-fade-in border ${
            bulkSummary.cancelled
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-emerald-500/10 border-emerald-500/30'
          }`}>
             <div className={`flex items-center gap-2 font-bold text-lg ${bulkSummary.cancelled ? 'text-amber-400' : 'text-emerald-400'}`}>
               <Check size={20} />
               {bulkSummary.cancelled
                 ? 'Operação Cancelada'
                 : bulkSummary.type === 'analysis' ? 'Análise em Lote Concluída' : 'Disparo em Lote Concluído'
               }
             </div>
             <p className="text-slate-300 text-sm font-medium">
               Sucessos: <span className="text-emerald-400 font-bold">{bulkSummary.success}</span>{' | '}
               Falhas: <span className="text-red-400 font-bold">{bulkSummary.error}</span>{' | '}
               Processados: {bulkSummary.success + bulkSummary.error} de {bulkSummary.total}
             </p>
             {bulkSummary.type === 'email' && bulkSummary.skipped > 0 && (
               <p className="text-amber-300 text-xs font-semibold">
                 {bulkSummary.skipped} lead{bulkSummary.skipped > 1 ? 's' : ''} sem e-mail permaneceram no grid para revisão.
               </p>
             )}
          </div>
        )}
        
        <div className="flex-1 overflow-auto rounded-3xl border border-white/5 glass relative">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="uppercase font-semibold text-xs text-slate-400">
              <tr>
                <th className="px-6 py-5 w-12 sticky top-0 z-30 bg-[#141c2f] shadow-[0_1px_0_rgba(255,255,255,0.08),0_10px_24px_rgba(2,6,23,0.28)]">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={() => togglePageSelection(paginatedList, typeCode)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-600 bg-surface"
                    title="Selecionar página atual"
                  />
                </th>
                <th className="px-6 py-5 sticky top-0 z-30 bg-[#141c2f] shadow-[0_1px_0_rgba(255,255,255,0.08),0_10px_24px_rgba(2,6,23,0.28)]">Nome / URL</th>
                <th className="px-6 py-5 sticky top-0 z-30 bg-[#141c2f] shadow-[0_1px_0_rgba(255,255,255,0.08),0_10px_24px_rgba(2,6,23,0.28)]">Contato</th>
                <th className="px-6 py-5 sticky top-0 z-30 bg-[#141c2f] shadow-[0_1px_0_rgba(255,255,255,0.08),0_10px_24px_rgba(2,6,23,0.28)]">Oportunidade</th>
                <th className="px-6 py-5 sticky top-0 z-30 bg-[#141c2f] shadow-[0_1px_0_rgba(255,255,255,0.08),0_10px_24px_rgba(2,6,23,0.28)]">Próxima ação</th>
                <th className="px-6 py-5 sticky top-0 z-30 bg-[#141c2f] shadow-[0_1px_0_rgba(255,255,255,0.08),0_10px_24px_rgba(2,6,23,0.28)]">Status</th>
                <th className="px-6 py-5 text-right sticky top-0 z-30 bg-[#141c2f] shadow-[0_1px_0_rgba(255,255,255,0.08),0_10px_24px_rgba(2,6,23,0.28)]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {paginatedList.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-16 text-center">
                    <div className="mx-auto max-w-md flex flex-col items-center">
                      <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 mb-4">
                        <Search size={22} />
                      </div>
                      <h4 className="text-white font-bold text-lg">Nenhum lead neste recorte</h4>
                      <p className="text-slate-400 text-sm mt-2">
                        Ajuste os filtros ou inicie uma nova captura para alimentar esta fila.
                      </p>
                      <div className="flex flex-wrap justify-center gap-2 mt-5">
                        <button
                          onClick={() => {
                            setGridFilters({source: 'todos', date: 'todos', hasEmail: false, hasWpp: false, wppSent: false, highOpportunity: false, followupDue: false});
                            setWppFilter(false);
                          }}
                          className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 text-xs font-bold"
                        >
                          Limpar filtros
                        </button>
                        <button
                          onClick={() => setActiveMenu('nova-captura')}
                          className="px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary-hover text-xs font-bold"
                        >
                          Nova captura
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedList.map(lead => {
                  const rowTypeCode = lead._typeCode || typeCode;
                  const commercialScore = getCommercialScore(lead, rowTypeCode);
                  const opportunity = getOpportunityLevel(commercialScore);
                  const nextAction = getNextBestAction(lead, rowTypeCode);
                  const followup = getFollowupStatus(lead);
                  const rowPhone = classifyBrazilPhone(lead.telefone);
                  const selectionKey = getLeadSelectionKey(lead, rowTypeCode);
                  const isSelected = selectedLeadKeys.includes(selectionKey);
                  return (
                  <tr key={`${rowTypeCode}-${lead.id}`} className={`hover:bg-white/5 transition-colors ${isSelected ? 'bg-primary/10' : lead.is_pinned ? 'bg-primary/5' : ''}`}>
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleLeadSelection(lead, rowTypeCode)}
                        className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-600 bg-surface"
                        title="Selecionar lead"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {lead.tipo_origem === 'play_store' ? (
                          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400" title="Play Store">
                            <Bot size={14} />
                          </div>
                        ) : lead.maps_url ? (
                          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500" title="Google Maps">
                            <MapPin size={14} />
                          </div>
                        ) : (
                          <div className="p-1.5 rounded-lg bg-primary/10 text-primary" title="Website Direct">
                            <Globe size={14} />
                          </div>
                        )}
                        <div className="font-semibold text-white truncate max-w-[220px]">{lead.nome || lead.titulo || lead.url}</div>
                      </div>
                      <div className="ml-9 mt-1 flex flex-wrap items-center gap-2">
                        {lead.tipo_origem && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                            lead.tipo_origem === 'play_store'
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                              : 'bg-primary/10 text-primary border-primary/20'
                          }`}>
                            {lead.tipo_origem === 'play_store' ? 'Play Store' : 'Sistema Web'}
                          </span>
                        )}
                        {lead.app_category && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/5 text-slate-300 border border-white/10 truncate max-w-[180px]">
                            {lead.app_category}
                          </span>
                        )}
                      </div>
                      {lead.url && <a href={lead.url.startsWith('http') ? lead.url : `https://${lead.url}`} target="_blank" rel="noreferrer" className="text-primary hover:underline text-[10px] flex items-center gap-1 mt-1 ml-9 opacity-70"><ExternalLink size={10}/> {lead.tipo_origem === 'play_store' && !lead.developer_site ? 'Abrir Play Store' : 'Abrir Site'}</a>}
                      {lead.app_store_url && lead.developer_site && (
                        <a href={lead.app_store_url} target="_blank" rel="noreferrer" className="text-emerald-300 hover:underline text-[10px] flex items-center gap-1 mt-1 ml-9 opacity-80">
                          <ExternalLink size={10}/> Abrir App
                        </a>
                      )}
                      {hasGeneratedLayout(lead) && (
                        <button
                          onClick={() => openLeadLayoutAsset(lead, 'preview')}
                          className="text-amber-300 hover:text-amber-200 text-[10px] flex items-center gap-1 mt-1 ml-9 font-bold"
                          title="Abrir preview comercial do layout"
                        >
                          <Eye size={10}/> Preview comercial pronto
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2">
                        {lead.email_enviado ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded-md font-medium w-max">
                              <Check size={10} /> E-mail Enviado
                            </span>
                          </div>
                        ) : lead.has_email_count > 0 ? (
                          <span className="inline-flex items-center gap-1 bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded-md font-medium w-max">
                            <Mail size={10} /> E-mail Capturado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-slate-500/20 text-slate-400 text-[10px] px-2 py-0.5 rounded-md font-medium w-max">
                            Pendente
                          </span>
                        )}
                        {rowPhone.type === 'mobile' && !lead.wpp_enviado ? (
                          <button
                            type="button"
                            onClick={() => startWhatsappMessageFlow(lead, rowTypeCode)}
                            className="inline-flex items-center gap-1 bg-green-500/15 text-green-300 hover:bg-green-500 hover:text-white text-[10px] px-2 py-0.5 rounded-md font-medium w-max transition-colors"
                            title="Abrir WhatsApp com mensagem pronta"
                          >
                            <MessageCircle size={10} /> Enviar WhatsApp
                          </button>
                        ) : rowPhone.type === 'fixed' ? (
                          <span className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-300 text-[10px] px-2 py-0.5 rounded-md font-medium w-max">
                            <Phone size={10} /> Fixo encontrado
                          </span>
                        ) : null}
                        {lead.wpp_enviado ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded-md font-medium w-max">
                            <MessageCircle size={10} /> WhatsApp Enviado
                          </span>
                        ) : null}
                        <label className="flex items-center gap-2 cursor-pointer mt-0.5">
                          <input 
                            type="checkbox" 
                            checked={lead.wpp_enviado === 1}
                            onChange={(e) => handleWppChange(lead, rowTypeCode, e)}
                            className="w-3 h-3 rounded text-primary focus:ring-primary border-slate-600 bg-surface"
                          />
                          <span className={`text-[10px] font-medium select-none ${lead.wpp_enviado ? 'text-green-400' : 'text-slate-400'}`}>
                            {lead.wpp_enviado ? 'WhatsApp Enviado' : 'WPP Pendente'}
                          </span>
                        </label>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-11 h-9 rounded-xl flex items-center justify-center font-black text-xs border ${opportunity.bg} ${opportunity.color} ${opportunity.border}`}>
                          {commercialScore}
                        </div>
                        <div>
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${opportunity.color}`}>{opportunity.label}</span>
                          <span className="block text-[10px] text-slate-500">IA {getLeadAiScore(lead, rowTypeCode) || '-'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${nextAction.color}`}>
                        {nextAction.icon}
                        {nextAction.label}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {lead.is_validated ? (
                          <span className="inline-flex items-center gap-1 bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded-md font-medium w-max">Validado</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-400 text-[10px] px-2 py-0.5 rounded-md font-medium w-max">Pendente</span>
                        )}
                        {lead.funil_status && lead.funil_status !== 'novo' && (
                          <span className="inline-flex items-center gap-1 bg-violet-500/15 text-violet-300 text-[10px] px-2 py-0.5 rounded-md font-medium w-max capitalize">
                            {lead.funil_status}
                          </span>
                        )}
                        {followup.state !== 'none' && (
                          <span className={`inline-flex items-center gap-1 ${followup.bg} ${followup.color} text-[10px] px-2 py-0.5 rounded-md font-medium border ${followup.border} w-max`}>
                            <Clock size={10} /> {followup.label}
                          </span>
                        )}
                      {hasGeneratedLayout(lead) && (
                        <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-md font-medium w-max">
                          <LayoutTemplate size={10} /> Layout pronto
                        </span>
                      )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleOpenDetails(lead)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all text-xs font-bold"
                          title="Ver detalhes completos"
                        >
                          <Info size={14} /> Detalhes
                        </button>
                        <button
                          onClick={() => handleRecommendedAction(lead, rowTypeCode)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500 hover:text-white transition-all text-xs font-bold"
                          title={`Executar: ${nextAction.label}`}
                        >
                          <Zap size={14} /> Fazer agora
                        </button>
                        
                        <div className="relative">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsDropdownOpen(isDropdownOpen === lead.id ? null : lead.id);
                            }}
                            className={`p-2 rounded-lg transition-colors ${isDropdownOpen === lead.id ? 'bg-white/10 text-white' : 'bg-surface hover:bg-white/5 text-slate-400'}`}
                          >
                            <MoreHorizontal size={16} />
                          </button>

                          {isDropdownOpen === lead.id && (
                            <>
                              <div className="fixed inset-0 z-20" onClick={() => setIsDropdownOpen(null)}></div>
                              <div className="absolute right-0 mt-2 w-48 bg-surface border border-white/10 rounded-2xl shadow-2xl z-30 py-2 animate-fade-in overflow-hidden">
                                <button 
                              onClick={() => { handleSingleAnalysis(lead, rowTypeCode); setIsDropdownOpen(null); }}
                                  className="w-full flex items-center gap-3 px-4 py-2 text-xs text-slate-300 hover:bg-primary/10 hover:text-primary transition-colors"
                                >
                                  <Eye size={14} /> Analisar via IA
                                </button>
                                <button 
                                  onClick={() => { handleSingleEmail(lead, rowTypeCode); setIsDropdownOpen(null); }}
                                  className="w-full flex items-center gap-3 px-4 py-2 text-xs text-slate-300 hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors"
                                >
                                  <Mail size={14} /> Enviar E-mail
                                </button>
                                {hasGeneratedLayout(lead) ? (
                                  <>
                                    <button
                                      onClick={() => { openLeadLayoutAsset(lead, 'preview'); setIsDropdownOpen(null); }}
                                      className="w-full flex items-center gap-3 px-4 py-2 text-xs text-slate-300 hover:bg-amber-500/10 hover:text-amber-300 transition-colors"
                                    >
                                      <Eye size={14} /> Abrir Preview
                                    </button>
                                    <button
                                      onClick={() => { openLeadLayoutAsset(lead, 'prompt'); setIsDropdownOpen(null); }}
                                      className="w-full flex items-center gap-3 px-4 py-2 text-xs text-slate-300 hover:bg-blue-500/10 hover:text-blue-300 transition-colors"
                                    >
                                      <FileText size={14} /> Abrir Prompt
                                    </button>
                                  </>
                                ) : rowTypeCode === 'sites' && (
                                  <button
                                    onClick={() => { handleGenerateLayout(lead, rowTypeCode); setIsDropdownOpen(null); }}
                                    className="w-full flex items-center gap-3 px-4 py-2 text-xs text-slate-300 hover:bg-amber-500/10 hover:text-amber-300 transition-colors"
                                  >
                                    <PenTool size={14} /> Gerar Layout
                                  </button>
                                )}
                                <button 
                                  onClick={() => { openCrmModal(lead, rowTypeCode); setIsDropdownOpen(null); }}
                                  className="w-full flex items-center gap-3 px-4 py-2 text-xs text-slate-300 hover:bg-violet-500/10 hover:text-violet-400 transition-colors"
                                >
                                  <History size={14} /> Histórico CRM
                                </button>
                                {rowTypeCode !== 'linkedin' && (
                                  <button
                                    onClick={() => { handleQuickFollowup(lead, rowTypeCode, 3); setIsDropdownOpen(null); }}
                                    className="w-full flex items-center gap-3 px-4 py-2 text-xs text-slate-300 hover:bg-amber-500/10 hover:text-amber-300 transition-colors"
                                  >
                                    <Clock size={14} /> Follow-up +3d
                                  </button>
                                )}
                                <div className="h-px bg-white/5 my-1"></div>
                                <button 
                                  onClick={() => { handleTogglePin(lead, rowTypeCode); setIsDropdownOpen(null); }}
                                  className={`w-full flex items-center gap-3 px-4 py-2 text-xs transition-colors ${lead.is_pinned ? 'text-primary font-bold bg-primary/5' : 'text-slate-300 hover:bg-white/5'}`}
                                >
                                  <Pin size={14} /> {lead.is_pinned ? 'Desafixar' : 'Fixar / Favoritar'}
                                </button>
                                <button 
                                  onClick={() => { handleValidation(lead, rowTypeCode, !lead.is_validated); setIsDropdownOpen(null); }}
                                  className={`w-full flex items-center gap-3 px-4 py-2 text-xs transition-colors ${lead.is_validated ? 'text-emerald-400 font-bold bg-emerald-500/5' : 'text-slate-300 hover:bg-white/5'}`}
                                >
                                  <Check size={14} /> {lead.is_validated ? 'Remover Validação' : 'Marcar Validado'}
                                </button>
                                <div className="h-px bg-white/5 my-1"></div>
                                <button 
                                  onClick={() => { handleDelete(lead, rowTypeCode); setIsDropdownOpen(null); }}
                                  className="w-full flex items-center gap-3 px-4 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                                >
                                  <X size={14} /> Excluir Lead
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 bg-white/[0.03] border border-white/5 p-4 rounded-3xl">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Exibir:</span>
              <select 
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-dark/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} - {Math.min(currentPage * itemsPerPage, totalItems)} de {totalItems} leads
            </span>
            {selectedCount > 0 && (
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                {selectedCount} selecionado{selectedCount > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2.5 rounded-xl bg-dark/40 border border-white/10 text-slate-400 hover:text-white hover:bg-primary disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            
            <div className="flex items-center gap-1.5">
              {[...Array(totalPages)].map((_, i) => {
                const pageNum = i + 1;
                // Show only 5 pages around current page
                if (totalPages > 7) {
                  if (pageNum !== 1 && pageNum !== totalPages && (pageNum < currentPage - 1 || pageNum > currentPage + 1)) {
                    if (pageNum === currentPage - 2 || pageNum === currentPage + 2) return <span key={pageNum} className="text-slate-600 px-1">...</span>;
                    return null;
                  }
                }
                return (
                  <button 
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`min-w-[36px] h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${currentPage === pageNum ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-110' : 'bg-dark/40 border border-white/5 text-slate-500 hover:text-white hover:bg-white/5'}`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-2.5 rounded-xl bg-dark/40 border border-white/10 text-slate-400 hover:text-white hover:bg-primary disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderLeadDetailsModal = () => {
    if (!leadDetailsModal) return null;
    const lead = leadDetailsModal;
    const detailTypeCode = lead._typeCode || 'sites';
    const commercialScore = getCommercialScore(lead, detailTypeCode);
    const opportunity = getOpportunityLevel(commercialScore);
    const nextAction = getNextBestAction(lead, detailTypeCode);
    const contactEmails = getUniqueContactEmails([{ email: lead.email, fonte: 'Lead' }, ...leadContacts]);
    const primaryPhone = getBestPhoneForLead(lead, leadContacts);

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-dark/80 backdrop-blur-sm animate-fade-in" onClick={handleCloseDetails}>
        <div 
          className="bg-surface border border-white/10 rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col scale-in"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-8 border-b border-white/5 flex justify-between items-start bg-gradient-to-br from-white/[0.02] to-transparent">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
                  <Info size={24} />
                </div>
                <h3 className="text-2xl font-bold text-white">Detalhes do Lead</h3>
              </div>
              <p className="text-slate-400 text-sm">Informações completas e ações rápidas</p>
            </div>
            <button 
              onClick={handleCloseDetails}
              className="p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-all"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
            <div className="space-y-8">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nome / Título</span>
                  <p className="text-white font-semibold text-lg">{lead.nome || lead.titulo || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nicho / Categoria</span>
                  <p className="text-primary font-semibold">{getLeadCategory(lead)}</p>
                </div>
              </div>

              <div className={`rounded-3xl border ${opportunity.border} ${opportunity.bg} p-5`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Prioridade comercial</span>
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`text-4xl font-black ${opportunity.color}`}>{commercialScore}</span>
                      <div>
                        <p className={`font-bold ${opportunity.color}`}>Oportunidade {opportunity.label}</p>
                        <p className="text-xs text-slate-400">Contato, site, problemas e histórico de ação combinados.</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-dark/40 border border-white/10 p-4 min-w-[220px]">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Próxima melhor ação</span>
                    <p className={`mt-2 text-sm font-bold flex items-center gap-2 ${nextAction.color}`}>
                      {nextAction.icon}
                      {nextAction.label}
                    </p>
                    <button
                      onClick={() => handleRecommendedAction(lead, detailTypeCode)}
                      className="mt-4 w-full rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500 hover:text-white px-4 py-2 text-xs font-bold transition-all flex items-center justify-center gap-2"
                    >
                      <Zap size={14} /> Fazer agora
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {lead.tipo_origem === 'play_store' && !lead.developer_site ? 'Página do App' : 'Site Oficial'}
                </span>
                <div className="flex items-center gap-2">
                  <p className="text-white break-all">{getLeadUrl(lead) || 'N/A'}</p>
                  {lead.url && (
                    <a 
                      href={lead.url.startsWith('http') ? lead.url : `https://${lead.url}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="p-1.5 rounded-lg bg-white/5 text-primary hover:bg-primary/10 transition-colors"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </div>

              {detailTypeCode === 'sistema' && (
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dados do Sistema / App</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold">Origem</p>
                      <p className="text-white font-semibold">{lead.tipo_origem === 'play_store' ? 'Play Store' : 'Sistema Web / SaaS'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold">Desenvolvedor</p>
                      <p className="text-white font-semibold">{lead.developer_name || 'Não identificado'}</p>
                    </div>
                    {lead.package_id && (
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Package ID</p>
                        <p className="text-white font-mono text-sm break-all">{lead.package_id}</p>
                      </div>
                    )}
                    {lead.installs && (
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Instalações</p>
                        <p className="text-white font-semibold">{lead.installs}</p>
                      </div>
                    )}
                    {lead.rating && (
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Avaliação</p>
                        <p className="text-white font-semibold">{lead.rating}</p>
                      </div>
                    )}
                    {lead.last_update && (
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Última atualização</p>
                        <p className="text-white font-semibold">{lead.last_update}</p>
                      </div>
                    )}
                  </div>
                  {lead.app_store_url && (
                    <a href={lead.app_store_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-emerald-300 hover:text-emerald-200 text-xs font-bold">
                      <ExternalLink size={13} /> Abrir página na Play Store
                    </a>
                  )}
                </div>
              )}

              {/* Contacts */}
              <div className="space-y-4">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contatos Encontrados</span>
                <div className="grid grid-cols-1 gap-3">
                  {primaryPhone.type !== 'none' && (
                    <div className={`flex items-start gap-3 p-4 rounded-2xl border transition-all ${
                      primaryPhone.type === 'mobile'
                        ? 'bg-green-500/10 border-green-500/20 hover:border-green-500/40'
                        : 'bg-amber-500/10 border-amber-500/25 hover:border-amber-500/40'
                    }`}>
                      <div className={`p-2 rounded-lg ${primaryPhone.type === 'mobile' ? 'bg-green-500/15 text-green-300' : 'bg-amber-500/15 text-amber-300'}`}>
                        <MessageCircle size={18} />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-slate-500 font-medium">
                          {primaryPhone.type === 'mobile' ? 'WhatsApp validado pelo padrão BR' : 'WhatsApp não confirmado'}
                        </p>
                        {primaryPhone.type === 'mobile' ? (
                          <p className="text-white font-mono">{primaryPhone.label}</p>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-amber-100 text-sm leading-relaxed">
                              Foi encontrado apenas número fixo. Verifique manualmente a melhor forma de contato com este lead.
                            </p>
                            {showFixedPhone ? (
                              <p className="text-white font-mono">{primaryPhone.label}</p>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setShowFixedPhone(true)}
                                className="px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 hover:bg-amber-500 hover:text-white text-xs font-bold transition-all"
                              >
                                Exibir número fixo
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {contactEmails.length > 0 ? (
                    contactEmails.map((c, i) => (
                      <div key={i} className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5 group hover:border-primary/30 transition-all">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                          <Mail size={18} />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-slate-500 font-medium">E-mail ({c.fonte || 'Capturado'})</p>
                          <p className="text-white font-mono">{c.email}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 rounded-2xl bg-white/5 border border-dashed border-white/10">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                          <Mail size={18} />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-slate-500 font-medium">E-mail</p>
                          <p className="text-white font-semibold">Não encontrado</p>
                          <p className="text-slate-400 text-xs mt-1">
                            Caso encontre o contato manualmente, vincule o e-mail abaixo para liberar o envio.
                          </p>
                          <div className="mt-3 flex flex-col sm:flex-row gap-2">
                            <input
                              value={manualEmailInput}
                              onChange={(e) => setManualEmailInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddManualEmail(lead);
                              }}
                              placeholder="contato@empresa.com.br"
                              className="flex-1 bg-dark/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-primary/50"
                            />
                            <button
                              type="button"
                              disabled={manualEmailSaving}
                              onClick={() => handleAddManualEmail(lead)}
                              className="px-4 py-2.5 rounded-xl bg-primary/15 border border-primary/30 text-primary hover:bg-primary hover:text-white text-xs font-bold transition-all disabled:opacity-60"
                            >
                              {manualEmailSaving ? 'Salvando...' : 'Salvar e-mail'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className={`rounded-3xl border p-5 ${hasGeneratedLayout(lead) ? 'bg-amber-500/10 border-amber-500/25' : 'bg-white/[0.03] border-white/10'}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Material de venda</span>
                    <h4 className="text-white font-bold mt-1">
                      {hasGeneratedLayout(lead) ? 'Proposta visual pronta' : 'Layout ainda não gerado'}
                    </h4>
                    <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                      {hasGeneratedLayout(lead)
                        ? 'Use o preview para apresentar o antes/depois e o HTML como protótipo navegável para o lead.'
                        : 'Gere uma versão modernizada do site para apoiar a abordagem comercial.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {hasGeneratedLayout(lead) ? (
                      <>
                        <button onClick={() => openLeadLayoutAsset(lead, 'preview')} className="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500 hover:text-white text-xs font-bold transition-all">
                          Preview
                        </button>
                        <button onClick={() => openLeadLayoutAsset(lead, 'html')} className="px-4 py-2 rounded-xl bg-primary/20 border border-primary/40 text-primary hover:bg-primary hover:text-white text-xs font-bold transition-all">
                          HTML
                        </button>
                        <button onClick={() => openLeadLayoutAsset(lead, 'folder')} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 text-xs font-bold transition-all">
                          Pasta
                        </button>
                      </>
                    ) : (
                      <button
                        disabled={layoutGeneratingLeadId === lead.id}
                        onClick={() => handleGenerateLayout(lead, detailTypeCode)}
                        className="px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary-hover text-xs font-bold transition-all disabled:opacity-60"
                      >
                        {layoutGeneratingLeadId === lead.id ? 'Gerando...' : 'Gerar proposta visual'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/5">
                <button
                  onClick={() => {
                    handleSingleEmail(lead, 'sites');
                    handleCloseDetails();
                  }}
                  className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all hover:-translate-y-0.5"
                >
                  <Mail size={18} />
                  Enviar E-mail
                </button>
                <button
                  disabled={layoutGeneratingLeadId === lead.id}
                  onClick={() => {
                    handleGenerateLayout(lead, detailTypeCode);
                  }}
                  className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary text-white font-bold hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-wait"
                >
                  <PenTool size={18} />
                  {layoutGeneratingLeadId === lead.id ? 'Gerando...' : hasGeneratedLayout(lead) ? 'Abrir Preview' : 'Gerar Layout'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAppDialog = () => {
    if (!appDialog) return null;
    const isDanger = appDialog.variant === 'danger';
    const isSuccess = appDialog.variant === 'success';
    const isWarning = appDialog.variant === 'warning';
    const accent = isDanger ? 'text-red-400 bg-red-500/10 border-red-500/30'
      : isSuccess ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
      : isWarning ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
      : 'text-primary bg-primary/10 border-primary/30';
    const Icon = isSuccess ? CheckCircle : isDanger ? ShieldAlert : isWarning ? Info : Activity;

    return (
      <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-dark/80 backdrop-blur-sm animate-fade-in">
        <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0f172a] shadow-2xl scale-in">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-2xl border ${accent}`}>
                <Icon size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{appDialog.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">CapLead AI</p>
              </div>
            </div>
            <button onClick={closeAppDialog} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
              <X size={18} />
            </button>
          </div>
          <div className="px-6 py-5">
            <p className="text-sm leading-relaxed text-slate-300">{appDialog.message}</p>
          </div>
          <div className="flex justify-end gap-3 border-t border-white/10 px-6 py-5">
            {appDialog.type === 'confirm' && (
              <button
                onClick={closeAppDialog}
                className="px-5 py-2.5 rounded-xl bg-surface text-slate-300 border border-border-light hover:bg-white/5 hover:text-white font-semibold transition-all"
              >
                {appDialog.cancelLabel || 'Cancelar'}
              </button>
            )}
            <button
              onClick={appDialog.type === 'confirm' ? confirmAppDialog : closeAppDialog}
              className={`px-5 py-2.5 rounded-xl border font-bold transition-all flex items-center gap-2 ${
                isDanger
                  ? 'bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500 hover:text-white'
                  : isSuccess
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500 hover:text-white'
                    : 'bg-primary/20 text-primary border-primary/40 hover:bg-primary hover:text-white'
              }`}
            >
              {appDialog.type === 'confirm' ? appDialog.confirmLabel : 'OK'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderOnboardingModal = () => {
    if (!showOnboarding) return null;

    const steps = [
      {
        title: 'Configure o envio de e-mails',
        description: smtpConfig.user ? `SMTP conectado para ${smtpConfig.user}` : 'Escolha um provedor, informe usuário, senha e salve a configuração.',
        done: Boolean(smtpConfig.user)
      },
      {
        title: 'Capture os primeiros leads',
        description: 'Use nicho e região para montar uma lista inicial de oportunidades.',
        done: metrics.totalLeads > 0
      },
      {
        title: 'Priorize contatos com e-mail',
        description: 'Filtre leads com e-mail capturado para reduzir cliques no envio.',
        done: sites.some(lead => lead.has_email_count > 0 || lead.email_enviado)
      },
      {
        title: 'Gere proposta visual quando fizer sentido',
        description: 'Use o layout modernizado como apoio comercial para leads com site.',
        done: sites.some(lead => lead.layout_status === 'gerado')
      }
    ];

    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-dark/80 backdrop-blur-sm p-4 animate-fade-in">
        <div className="w-full max-w-3xl bg-surface border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden">
          <div className="p-7 border-b border-white/10 flex items-start justify-between gap-6 bg-gradient-to-br from-primary/10 to-transparent">
            <div>
              <div className="inline-flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-widest mb-3">
                <Target size={16} /> Guia rápido
              </div>
              <h3 className="text-2xl font-black text-white tracking-tight">Prepare o CapLead para uso diário</h3>
              <p className="text-slate-400 text-sm mt-2 max-w-2xl">
                Complete os itens essenciais uma vez e deixe o usuário pronto para capturar, validar e abordar leads sem precisar entender toda a aplicação.
              </p>
            </div>
            <button onClick={() => finishOnboarding()} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="p-7 grid grid-cols-1 md:grid-cols-2 gap-4">
            {steps.map((step, index) => (
              <div key={step.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    step.done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-primary/10 text-primary'
                  }`}>
                    {step.done ? <Check size={18} /> : <span className="text-sm font-black">{index + 1}</span>}
                  </div>
                  <div>
                    <h4 className="text-white font-bold">{step.title}</h4>
                    <p className="text-slate-400 text-xs leading-relaxed mt-1">{step.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="px-7 py-5 border-t border-white/10 flex flex-col sm:flex-row justify-end gap-3">
            <button
              onClick={() => finishOnboarding('envios')}
              className="px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 font-bold transition-all flex items-center justify-center gap-2"
            >
              <Settings size={16} /> Configurar SMTP
            </button>
            <button
              onClick={() => finishOnboarding('nova-captura')}
              className="px-5 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold transition-all flex items-center justify-center gap-2"
            >
              <Search size={16} /> Iniciar captura
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-surface">
      {renderSidebar()}
      
      <main className="flex-1 overflow-hidden relative">
        {activeMenu === 'geral' && renderDashboard()}
        {activeMenu === 'nova-captura' && renderNovaCaptura()}
        {activeMenu === 'envios' && renderConfiguracoes()}
        {activeMenu === 'whatsapp-comercial' && renderWhatsappComercial()}
        
        {/* Grids mapping */}
        {activeMenu === 'sites' && renderLeadsGrid(siteLeadsGrid, 'Banco de Sites', 'sites')}
        {activeMenu === 'sistemas' && renderLeadsGrid(sistemas, 'Sistemas & Apps Capturados', 'sistema')}
        {activeMenu === 'linkedin' && renderLeadsGrid(linkedin, 'Banco LinkedIn', 'linkedin')}
        {activeMenu === 'validados' && renderLeadsGrid(validatedLeadsGrid, 'Leads Validados', 'misto')}

        {renderLeadDetailsModal()}
        {renderAppDialog()}
        {renderOnboardingModal()}
      </main>

      {/* === CRM INTERACTIONS MODAL === */}
      {crmModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={closeCrmModal}>
          <div
            className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-[#0f172a] border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-7 py-5 border-b border-white/10 shrink-0">
              <div>
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  <History size={18} className="text-violet-400" />
                  CRM &mdash; {crmModal.lead.nome || crmModal.lead.titulo || crmModal.lead.url}
                </h3>
                <p className="text-slate-500 text-xs mt-0.5">{crmModal.lead.email || 'Sem e-mail registrado'}</p>
              </div>
              <button onClick={closeCrmModal} className="p-2 rounded-xl hover:bg-white/10 text-slate-400 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-7 py-5 flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Status atual</span>
                  <p className="text-white font-bold capitalize mt-1">{crmFunil.status || 'novo'}</p>
                </div>
                <div className={`rounded-2xl border p-4 ${getFollowupStatus({ followup_date: crmFunil.followupDate }).bg} ${getFollowupStatus({ followup_date: crmFunil.followupDate }).border}`}>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Follow-up</span>
                  <p className={`font-bold mt-1 ${getFollowupStatus({ followup_date: crmFunil.followupDate }).color}`}>
                    {getFollowupStatus({ followup_date: crmFunil.followupDate }).label}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Histórico</span>
                  <p className="text-white font-bold mt-1">{crmModal.interacoes.length} interação{crmModal.interacoes.length !== 1 ? 'es' : ''}</p>
                </div>
              </div>

              {/* Funil de Vendas (apenas sites e sistemas) */}
              {crmModal.typeCode !== 'linkedin' && (
                <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Estágio do Funil</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {FUNIL_STAGES.map(s => (
                      <button
                        key={s.value}
                        onClick={() => setCrmFunil(f => ({ ...f, status: s.value }))}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                          crmFunil.status === s.value
                            ? `${s.bg} ${s.color} border-current shadow-md scale-105`
                            : 'bg-surface text-slate-500 border-border-light hover:text-white'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      placeholder="Próximo passo..."
                      value={crmFunil.proximoPasso}
                      onChange={e => setCrmFunil(f => ({ ...f, proximoPasso: e.target.value }))}
                      className="flex-1 bg-dark/60 border border-border-light rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary"
                    />
                    <input
                      type="date"
                      value={crmFunil.followupDate}
                      onChange={e => setCrmFunil(f => ({ ...f, followupDate: e.target.value }))}
                      className="bg-dark/60 border border-border-light rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                    />
                    <button
                      onClick={handleSaveFunil}
                      className="px-4 py-2 rounded-xl bg-primary/20 text-primary border border-primary/40 hover:bg-primary hover:text-white text-sm font-bold transition-all"
                    >
                      Salvar
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button onClick={() => setCrmFunil(f => ({ ...f, followupDate: addDaysIso(1), proximoPasso: f.proximoPasso || 'Retornar contato' }))} className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20 text-xs font-bold">
                      Amanhã
                    </button>
                    <button onClick={() => setCrmFunil(f => ({ ...f, followupDate: addDaysIso(3), proximoPasso: f.proximoPasso || 'Enviar reforço da proposta' }))} className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20 text-xs font-bold">
                      +3 dias
                    </button>
                    <button onClick={() => setCrmFunil(f => ({ ...f, followupDate: addDaysIso(7), proximoPasso: f.proximoPasso || 'Acompanhar decisão' }))} className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20 text-xs font-bold">
                      +7 dias
                    </button>
                    <button onClick={() => setCrmFunil(f => ({ ...f, status: 'proposta', proximoPasso: 'Acompanhar proposta visual', followupDate: addDaysIso(2) }))} className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 text-xs font-bold">
                      Proposta enviada
                    </button>
                  </div>
                </div>
              )}

              {/* Log nova interação */}
              <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Registrar Interação</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  <button onClick={() => fillCrmTemplate('E-mail enviado com diagnóstico e proposta visual. Aguardar retorno do lead.')} className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white text-xs font-bold">
                    E-mail enviado
                  </button>
                  <button onClick={() => fillCrmTemplate('Contato via WhatsApp realizado. Reforçado o ponto de melhoria e abertura para apresentação da proposta.')} className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white text-xs font-bold">
                    WhatsApp
                  </button>
                  <button onClick={() => fillCrmTemplate('Lead respondeu com interesse. Próximo passo: apresentar proposta visual e alinhar escopo.')} className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white text-xs font-bold">
                    Respondeu
                  </button>
                  <button onClick={() => fillCrmTemplate('Sem resposta até o momento. Programar follow-up curto com abordagem objetiva.')} className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white text-xs font-bold">
                    Sem resposta
                  </button>
                </div>
                <div className="flex gap-2 mb-2">
                  {['email', 'whatsapp', 'ligacao', 'reuniao', 'observacao'].map(c => (
                    <button
                      key={c}
                      onClick={() => setCrmForm(f => ({ ...f, canal: c }))}
                      title={c.charAt(0).toUpperCase() + c.slice(1)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                        crmForm.canal === c
                          ? 'bg-primary text-white border-primary shadow-md'
                          : 'bg-surface text-slate-400 border-border-light hover:text-white'
                      }`}
                    >
                      {CANAL_ICONS[c]}
                      <span className="hidden sm:inline">{c.charAt(0).toUpperCase() + c.slice(1)}</span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <textarea
                    rows={2}
                    placeholder="Descreva a interação..."
                    value={crmForm.descricao}
                    onChange={e => setCrmForm(f => ({ ...f, descricao: e.target.value }))}
                    className="flex-1 bg-dark/60 border border-border-light rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary resize-none"
                  />
                  <button
                    onClick={handleAddInteracao}
                    disabled={!crmForm.descricao.trim()}
                    className="px-4 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500 hover:text-white font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Check size={18} />
                  </button>
                </div>
              </div>

              {/* Timeline de interações */}
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">
                  Histórico &mdash; {crmModal.interacoes.length} registro{crmModal.interacoes.length !== 1 ? 's' : ''}
                </p>
                {crmModal.interacoes.length === 0 ? (
                  <p className="text-slate-600 text-sm text-center py-6">Nenhuma interação registrada ainda.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {crmModal.interacoes.map(item => (
                      <div key={item.id} className="flex items-start gap-3 bg-white/5 rounded-xl p-3 border border-white/5 group">
                        <div className="mt-0.5 shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          {CANAL_ICONS[item.canal] || <FileText size={14} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm leading-snug">{item.descricao}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-500 capitalize">{item.canal}</span>
                            <span className="text-slate-700">·</span>
                            <span className="text-xs text-slate-500">
                              {new Date(item.data_hora).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteInteracao(item.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 hover:text-red-400 text-slate-600 transition-all"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* === EMAIL PREVIEW MODAL === */}
      {emailPreviewModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setEmailPreviewModal(null)}>
          <div
            className="relative w-full max-w-4xl bg-[#0f172a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-7 py-5 border-b border-white/10 shrink-0">
              <div>
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  <Mail size={18} className="text-amber-400" />
                  Compor E-mail
                </h3>
                <p className="text-slate-500 text-xs mt-0.5">
                  {emailPreviewModal.leads.length === 1
                    ? 'Revise o e-mail vinculado ao lead antes de enviar.'
                    : <>Serão enviados para <span className="font-bold text-white">{emailPreviewModal.leads.length}</span> leads selecionados.</>}
                </p>
                {emailPreviewModal.skippedWithoutEmail > 0 && (
                  <p className="text-amber-300 text-xs mt-1 font-semibold">
                    {emailPreviewModal.skippedWithoutEmail} lead{emailPreviewModal.skippedWithoutEmail > 1 ? 's' : ''} sem e-mail foram ignorados e permanecerão no grid.
                  </p>
                )}
                {emailPreviewModal.skippedBySendLimit > 0 && (
                  <p className="text-amber-300 text-xs mt-1 font-semibold">
                    {emailPreviewModal.skippedBySendLimit} lead{emailPreviewModal.skippedBySendLimit > 1 ? 's' : ''} ficaram para outro lote por limite seguro de envio.
                  </p>
                )}
              </div>
              <button onClick={() => setEmailPreviewModal(null)} className="p-2 rounded-xl hover:bg-white/10 text-slate-400 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-7 py-5 flex flex-col gap-6 custom-scrollbar">
              <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Dados do E-mail</p>
                <div className="mb-4 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-100/90">
                  <p className="font-bold text-amber-300 mb-2">Dados aplicados neste rascunho</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <p><span className="text-slate-400">Lead:</span> {getLeadName(emailPreviewModal.leads[0])}</p>
                    <p><span className="text-slate-400">Site:</span> {getLeadUrl(emailPreviewModal.leads[0]) || 'Não informado'}</p>
                    <p><span className="text-slate-400">Assinatura:</span> {smtpConfig.signatureName || 'CapLead'} & Kentaurus TI</p>
                    <p><span className="text-slate-400">Problemas listados:</span> {getLeadProblemsList(emailPreviewModal.leads[0]).length}</p>
                    <p><span className="text-slate-400">Prioridade:</span> {getOpportunityLevel(getCommercialScore(emailPreviewModal.leads[0], emailPreviewModal.typeCode)).label} ({getCommercialScore(emailPreviewModal.leads[0], emailPreviewModal.typeCode)}/100)</p>
                    <p><span className="text-slate-400">Próxima ação:</span> {getNextBestAction(emailPreviewModal.leads[0], emailPreviewModal.typeCode).label}</p>
                  </div>
                </div>
                <div className="mb-4 bg-primary/10 border border-primary/20 rounded-xl p-4 text-xs text-slate-200">
                  <p className="font-bold text-primary mb-2">Proteção de envio Gmail</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <p><span className="text-slate-400">Enviados hoje:</span> {emailPreviewModal.sentToday ?? 0}/{emailPreviewModal.safeDailyLimit || EMAIL_SAFE_DAILY_LIMIT}</p>
                    <p><span className="text-slate-400">Limite por lote:</span> {emailPreviewModal.safeBatchLimit || EMAIL_SAFE_BATCH_LIMIT} e-mails individuais</p>
                    <p className="md:col-span-2 text-slate-400">
                      Os envios são feitos um a um, com pausa entre mensagens. O CapLead não envia um único e-mail com múltiplos destinatários.
                    </p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">E-mail vinculado</label>
                    <input
                      type="text"
                      readOnly
                      value={emailPreviewModal.leads.length === 1 ? emailPreviewModal.leads[0].email : `${emailPreviewModal.leads.length} destinatários selecionados`}
                      className="w-full bg-dark/60 border border-border-light rounded-xl px-4 py-3 text-white/90 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Título do e-mail</label>
                    <input 
                      type="text" 
                      value={resolveEmailText(emailPreviewModal.template.assunto, emailPreviewModal.leads[0])}
                      onChange={e => setEmailPreviewModal({ ...emailPreviewModal, template: { ...emailPreviewModal.template, assunto: e.target.value } })}
                      className="w-full bg-dark/60 border border-border-light rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Body do e-mail</label>
                    <textarea 
                      rows={12}
                      value={resolveEmailText(emailPreviewModal.template.corpo, emailPreviewModal.leads[0])}
                      onChange={e => setEmailPreviewModal({ ...emailPreviewModal, template: { ...emailPreviewModal.template, corpo: e.target.value } })}
                      className="w-full bg-dark/60 border border-border-light rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors resize-none custom-scrollbar"
                    />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-white/10 overflow-hidden">
                <div
                  className="max-h-[520px] overflow-y-auto custom-scrollbar"
                  dangerouslySetInnerHTML={{
                    __html: buildEmailHtml(resolveEmailText(emailPreviewModal.template.corpo, emailPreviewModal.leads[0]), emailPreviewModal.leads[0])
                  }}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-7 py-5 border-t border-white/10 shrink-0 flex justify-end gap-3">
              <button 
                onClick={() => setEmailPreviewModal(null)}
                className="px-5 py-2.5 rounded-xl bg-surface text-slate-300 border border-border-light hover:bg-white/5 hover:text-white font-semibold transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmBulkEmail}
                className="px-5 py-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500 hover:text-white font-bold transition-all flex items-center gap-2"
              >
                <Send size={16} /> {emailPreviewModal.leads.length === 1 ? 'Enviar E-mail' : `Enviar para ${emailPreviewModal.leads.length} Leads`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
