import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MousePointer2, ExternalLink, X, Check, FolderPlus, Camera, Pin,
  Paperclip, Edit3, FileText, Linkedin, ShieldAlert, Eye, EyeOff,
  LayoutDashboard, Search, LayoutTemplate, Layers, SearchCheck, Mail, Send,
  MessageCircle, Filter, History, ChevronDown, Clock, Phone, Users, FileCheck,
  Zap, Activity, Target, CheckCircle, MapPin, Globe, Settings, Lock, Hash, PenTool, Server, Save,
  Download, BookOpen, Upload, Database,
  MoreHorizontal, Info, Calendar, ListFilter, ChevronLeft, ChevronRight, Bot, Bell, Radio, Trash2,
  Rocket, ChevronUp, ChevronsUpDown, AlertTriangle, Smartphone, Loader2, TrendingDown, RefreshCw,
  Play, Pause, SkipForward, StopCircle, ListChecks, CircleCheck
} from 'lucide-react';
import { buildWhatsappUrl, buildWhatsappMessage, normalizeWhatsappPhone } from './whatsappMessage.mjs';

const ASSINATURA_PATH = 'Assinatura.png';
const ASSINATURA_CID = 'assinatura-caplead';
const DEFAULT_GRID_FILTERS = {
  source: 'todos',
  date: 'todos',
  nameQuery: '',
  hasEmail: false,
  hasWpp: false,
  wppSent: false,
  highOpportunity: false,
  followupDue: false
};

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
const EMAIL_SEND_DELAY_MIN = 1000;
const EMAIL_SEND_DELAY_MAX = 30000;

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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
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
  const dbUpdateDebounceRef = useRef(null);

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
    {
      group: "Capitais — Sudeste",
      items: ["São Paulo, SP", "Rio de Janeiro, RJ", "Belo Horizonte, MG", "Vitória, ES"]
    },
    {
      group: "Capitais — Sul",
      items: ["Curitiba, PR", "Porto Alegre, RS", "Florianópolis, SC"]
    },
    {
      group: "Capitais — Nordeste",
      items: ["Salvador, BA", "Fortaleza, CE", "Recife, PE", "Natal, RN", "João Pessoa, PB", "Maceió, AL", "Aracaju, SE", "São Luís, MA", "Teresina, PI"]
    },
    {
      group: "Capitais — Centro-Oeste",
      items: ["Brasília, DF", "Goiânia, GO", "Cuiabá, MT", "Campo Grande, MS"]
    },
    {
      group: "Capitais — Norte",
      items: ["Manaus, AM", "Belém, PA", "Porto Velho, RO", "Boa Vista, RR", "Macapá, AP", "Rio Branco, AC", "Palmas, TO"]
    },
    {
      group: "São Paulo — Interior",
      items: ["Campinas, SP", "Guarulhos, SP", "Osasco, SP", "Santo André, SP", "São Bernardo do Campo, SP", "Santos, SP", "Ribeirão Preto, SP", "Sorocaba, SP", "São José dos Campos, SP", "Mauá, SP", "São Vicente, SP", "Guarujá, SP", "Taubaté, SP", "Americana, SP", "Limeira, SP", "Franca, SP", "Suzano, SP", "São Carlos, SP", "São José do Rio Preto, SP", "Presidente Prudente, SP", "Jundiaí, SP", "Piracicaba, SP", "Bauru, SP", "Praia Grande, SP", "Carapicuíba, SP", "Mogi das Cruzes, SP", "Diadema, SP", "São Caetano do Sul, SP", "Indaiatuba, SP", "Araraquara, SP"]
    },
    {
      group: "Rio de Janeiro — Interior",
      items: ["Niterói, RJ", "Duque de Caxias, RJ", "Nova Iguaçu, RJ", "São Gonçalo, RJ", "Belford Roxo, RJ", "Campos dos Goytacazes, RJ", "São João de Meriti, RJ", "Petrópolis, RJ", "Volta Redonda, RJ", "Macaé, RJ", "Cabo Frio, RJ", "Angra dos Reis, RJ", "Itaboraí, RJ", "Nilópolis, RJ", "Queimados, RJ"]
    },
    {
      group: "Minas Gerais — Interior",
      items: ["Contagem, MG", "Uberlândia, MG", "Juiz de Fora, MG", "Betim, MG", "Montes Claros, MG", "Uberaba, MG", "Ipatinga, MG", "Ribeirão das Neves, MG", "Governador Valadares, MG", "Divinópolis, MG", "Sete Lagoas, MG", "Varginha, MG", "Poços de Caldas, MG", "Patos de Minas, MG", "Barbacena, MG", "Itaúna, MG", "Coronel Fabriciano, MG"]
    },
    {
      group: "Espírito Santo — Interior",
      items: ["Vila Velha, ES", "Serra, ES", "Cariacica, ES", "Cachoeiro de Itapemirim, ES", "Linhares, ES", "Colatina, ES", "Guarapari, ES"]
    },
    {
      group: "Paraná — Interior",
      items: ["Londrina, PR", "Maringá, PR", "Foz do Iguaçu, PR", "Cascavel, PR", "Ponta Grossa, PR", "São José dos Pinhais, PR", "Colombo, PR", "Guarapuava, PR", "Paranaguá, PR", "Araucária, PR", "Toledo, PR", "Apucarana, PR", "Pinhais, PR", "Campo Largo, PR"]
    },
    {
      group: "Rio Grande do Sul — Interior",
      items: ["Caxias do Sul, RS", "Canoas, RS", "Pelotas, RS", "Novo Hamburgo, RS", "Santa Maria, RS", "Gravataí, RS", "São Leopoldo, RS", "Alvorada, RS", "Viamão, RS", "Rio Grande, RS", "Passo Fundo, RS", "Sapucaia do Sul, RS", "Cachoeirinha, RS", "Bagé, RS", "Uruguaiana, RS"]
    },
    {
      group: "Santa Catarina — Interior",
      items: ["Joinville, SC", "Blumenau, SC", "Itajaí, SC", "São José, SC", "Criciúma, SC", "Chapecó, SC", "Lages, SC", "Palhoça, SC", "Balneário Camboriú, SC", "Jaraguá do Sul, SC", "Brusque, SC", "Araranguá, SC", "Tubarão, SC"]
    },
    {
      group: "Bahia — Interior",
      items: ["Feira de Santana, BA", "Vitória da Conquista, BA", "Camaçari, BA", "Itabuna, BA", "Juazeiro, BA", "Ilhéus, BA", "Lauro de Freitas, BA", "Barreiras, BA", "Jequié, BA", "Teixeira de Freitas, BA", "Alagoinhas, BA", "Porto Seguro, BA"]
    },
    {
      group: "Ceará — Interior",
      items: ["Caucaia, CE", "Juazeiro do Norte, CE", "Maracanaú, CE", "Sobral, CE", "Crato, CE", "Itapipoca, CE", "Maranguape, CE", "Iguatu, CE"]
    },
    {
      group: "Pernambuco — Interior",
      items: ["Caruaru, PE", "Olinda, PE", "Jaboatão dos Guararapes, PE", "Petrolina, PE", "Paulista, PE", "Cabo de Santo Agostinho, PE", "Caruaru, PE", "Camaragibe, PE", "Garanhuns, PE", "Vitória de Santo Antão, PE"]
    },
    {
      group: "Nordeste — Demais Estados",
      items: ["Campina Grande, PB", "Patos, PB", "Mossoró, RN", "Caicó, RN", "Arapiraca, AL", "Imperatriz, MA", "Caxias, MA", "Parnaíba, PI", "Lagarto, SE", "Estância, SE", "Ananindeua, PA", "Marabá, PA", "Santarém, PA"]
    },
    {
      group: "Goiás e Centro-Oeste — Interior",
      items: ["Aparecida de Goiânia, GO", "Anápolis, GO", "Rio Verde, GO", "Luziânia, GO", "Itumbiara, GO", "Catalão, GO", "Formosa, GO", "Dourados, MS", "Três Lagoas, MS", "Corumbá, MS", "Várzea Grande, MT", "Sinop, MT", "Rondonópolis, MT", "Tangará da Serra, MT"]
    },
    {
      group: "Norte — Interior",
      items: ["Santarém, PA", "Marabá, PA", "Parauapebas, PA", "Araguaína, TO", "Ji-Paraná, RO", "Castanhal, PA", "Altamira, PA", "Cruzeiro do Sul, AC", "Santana, AP", "Parintins, AM", "Boa Vista, RR"]
    },
    {
      group: "Nacional",
      items: ["Brasil"]
    }
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
  const [gridFilters, setGridFilters] = useState(DEFAULT_GRID_FILTERS);
  const [gridSort, setGridSort] = useState({ col: null, dir: null });

  const cycleSort = (col) => {
    setGridSort(current => {
      if (current.col !== col) return { col, dir: 'asc' };
      if (current.dir === 'asc') return { col, dir: 'desc' };
      return { col: null, dir: null };
    });
  };

  // Meta Diária
  const [dailyGoal, setDailyGoal] = useState(0);
  const [weeklyGoal, setWeeklyGoal] = useState(0);
  const [monthlyGoal, setMonthlyGoal] = useState(0);
  const [emailSendDelay, setEmailSendDelay] = useState(EMAIL_SEND_DELAY_MS);
  const [sentTodayCount, setSentTodayCount] = useState(0);
  const [dailyGoalModal, setDailyGoalModal] = useState(false);
  const [dailyGoalInput, setDailyGoalInput] = useState('');
  const [goalReachedModal, setGoalReachedModal] = useState(false);

  const _goalTodayKey = () => new Date().toLocaleDateString('pt-BR');
  const getGoalHitAt = () => {
    if (localStorage.getItem('goal_hit_date') !== _goalTodayKey()) return null;
    const ts = localStorage.getItem('goal_hit_at');
    return ts ? Number(ts) : null;
  };
  const markGoalHit = () => {
    localStorage.setItem('goal_hit_at', String(Date.now()));
    localStorage.setItem('goal_hit_date', _goalTodayKey());
  };
  const clearGoalHit = () => {
    localStorage.removeItem('goal_hit_at');
    localStorage.removeItem('goal_hit_date');
  };
  const getGoalCooldownRemaining = () => {
    const hitAt = getGoalHitAt();
    if (!hitAt) return 0;
    return Math.max(0, 3600000 - (Date.now() - hitAt));
  };

  // Details Modal State
  const [leadDetailsModal, setLeadDetailsModal] = useState(null);
  const [problemsModal, setProblemsModal] = useState(null); // { lead, problems, loading, score, breakdown }
  const [wppAutoDispatch, setWppAutoDispatch] = useState(false);
  const [postCaptureWppModal, setPostCaptureWppModal] = useState(null);
  const [wppPilot, setWppPilot] = useState({
    active: false,
    status: 'idle', // 'idle'|'initializing'|'qr-wait'|'running'|'paused'|'done'
    queue: [],
    currentIdx: 0,
    results: [], // [{ lead, status: 'sent'|'skipped'|'error'|'invalid-phone'|'timeout' }]
  });
  const wppPilotRef = useRef(null);
  const wppPilotRunning = useRef(false);
  const wppPilotPaused = useRef(false); // { phase: 'confirm'|'dispatching'|'done', leads, currentIdx, dispatched, skipped }
  const [leadContacts, setLeadContacts] = useState([]);
  const [manualEmailInput, setManualEmailInput] = useState('');
  const [manualEmailSaving, setManualEmailSaving] = useState(false);
  const [showFixedPhone, setShowFixedPhone] = useState(false);
  const [appDialog, setAppDialog] = useState(null);
  const [layoutGeneratingLeadId, setLayoutGeneratingLeadId] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(null);

  // Task 2 — Cancelamento de captura
  const [isCancelling, setIsCancelling] = useState(false);

  // Task 3 — Dashboard stats
  const [dashboardStats, setDashboardStats] = useState(null);

  // Task 4 — Kanban CRM
  const [kanbanFilter, setKanbanFilter] = useState('sites');

  // Task 6 — Follow-ups badge
  const [followupsDueBadge, setFollowupsDueBadge] = useState(0);

  // Task 7 — PDF diagnóstico
  const [pdfGenerating, setPdfGenerating] = useState(false);

  // Task 9 — Templates de mensagem
  const [messageTemplates, setMessageTemplates] = useState([]);
  const messageTemplatesRef = useRef([]);
  const [templatesModal, setTemplatesModal] = useState(false);
  const [templateForm, setTemplateForm] = useState({ id: null, nicho: '', canal: 'whatsapp', has_site: null, nome: '', corpo: '' });

  // T01 — Filtros dashboard
  const [dashFilters, setDashFilters] = useState({ search: '', source: 'todos', status: 'todos', period: 'todos', opp: 'todos' });

  // T20/T21 — Atalhos e Command Palette
  const [cmdPalette, setCmdPalette] = useState({ open: false, query: '', results: [] });

  // T23 — Modo compacto
  const [isCompact, setIsCompact] = useState(false);

  // T24 — Toast
  const [toast, setToast] = useState(null);

  // T07 — Histórico de e-mails por lead
  const [emailHistory, setEmailHistory] = useState([]);

  // T13 — Score override
  const [scoreOverrides, setScoreOverrides] = useState({});

  // T14 — Ticket value
  const [ticketValues, setTicketValues] = useState({});

  // T18 — PageSpeed
  const [pageSpeedData, setPageSpeedData] = useState({});

  // T27/T30 — Atividade e saúde do app
  const [activityLog, setActivityLog] = useState([]);
  const [appHealth, setAppHealth] = useState(null);
  const [kanbanNotes, setKanbanNotes] = useState({});
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedLeadKeys, setSelectedLeadKeys] = useState([]);
  const siteLeadsGrid = useMemo(
    () => sites.filter(lead => !lead.email_enviado && !lead.wpp_enviado),
    [sites]
  );
  const validatedLeadsGrid = useMemo(
    () => [
      ...sites.filter(lead => lead.is_validated || lead.email_enviado || lead.wpp_enviado).map(lead => ({ ...lead, _typeCode: 'sites' })),
      ...sistemas.filter(lead => lead.is_validated || lead.email_enviado || lead.wpp_enviado).map(lead => ({ ...lead, _typeCode: 'sistema' })),
      ...linkedin.filter(lead => lead.is_validated || lead.email_enviado || lead.wpp_enviado).map(lead => ({ ...lead, _typeCode: 'linkedin' }))
    ],
    [sites, sistemas, linkedin]
  );
  const whatsappCommercialLeads = useMemo(
    () => validatedLeadsGrid.filter(lead => lead.telefone),
    [validatedLeadsGrid]
  );
  const whatsappUnreadCount = 0;
  const whatsappScheduledCount = 0;

  // Sync wppPilot state into ref para uso em loops assíncronos
  useEffect(() => { wppPilotRef.current = wppPilot; }, [wppPilot]);
  useEffect(() => { messageTemplatesRef.current = messageTemplates; }, [messageTemplates]);

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

  // T24 — Toast helper
  const showToast = (msg, type = 'success', duration = 3000) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), duration);
  };

  // T20 — Atalhos de teclado globais
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCmdPalette(p => ({ ...p, open: !p.open, query: '', results: [] }));
        return;
      }
      if (e.key === 'Escape') {
        setCmdPalette(p => ({ ...p, open: false }));
        return;
      }
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey) { setActiveMenu('nova-captura'); return; }
      if (e.key === 'd' && !e.ctrlKey && !e.metaKey) { setActiveMenu('geral'); return; }
      if (e.key === 'l' && !e.ctrlKey && !e.metaKey) { setActiveMenu('sites'); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, []);

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

  const handleAnalyzeProblems = async (lead, detailTypeCode) => {
    const leadUrl = getLeadUrl(lead);
    if (!leadUrl) {
      showAppAlert({ title: 'Site não encontrado', message: 'Este lead não possui URL para análise.', variant: 'warning' });
      return;
    }
    const table = detailTypeCode === 'sistema' ? 'leads_sistemas' : detailTypeCode === 'linkedin' ? 'leads_linkedin' : 'leads_sites';

    if (lead.problemas && lead.score_design != null && lead.score_design >= 0) {
      let rawList = [];
      try { rawList = JSON.parse(lead.problemas); } catch (e) { rawList = String(lead.problemas).split(/\r?\n/).filter(Boolean); }
      setProblemsModal({ lead, problems: rawList, loading: false, score: lead.score_design });
      return;
    }

    setProblemsModal({ lead, problems: [], loading: true, score: null });
    try {
      const formattedUrl = leadUrl.startsWith('http') ? leadUrl : `https://${leadUrl}`;
      const result = await window.electronAPI.analyzeLeadDesign({ id: lead.id, url: formattedUrl, table });
      const rawList = result.issues || [];
      const updatedLead = { ...lead, score_design: result.score, problemas: JSON.stringify(rawList) };

      if (detailTypeCode === 'sites') setSites(c => c.map(s => s.id === lead.id ? { ...s, score_design: result.score, problemas: JSON.stringify(rawList) } : s));
      else if (detailTypeCode === 'sistema') setSistemas(c => c.map(s => s.id === lead.id ? { ...s, score_design: result.score, problemas: JSON.stringify(rawList) } : s));
      setLeadDetailsModal(c => c?.id === lead.id ? { ...c, score_design: result.score, problemas: JSON.stringify(rawList) } : c);

      setProblemsModal({ lead: updatedLead, problems: rawList, loading: false, score: result.score });
    } catch (err) {
      showAppAlert({ title: 'Erro na análise', message: err.message || 'Não foi possível analisar o site.', variant: 'danger' });
      setProblemsModal(null);
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

  const isMapsUrl = (url = '') => /google\.com\/(maps|search)/i.test(String(url));
  const getLeadUrl = (lead) => lead?.site_oficial || lead?.developer_site || lead?.app_store_url || (!isMapsUrl(lead?.url) ? lead?.url : '') || '';

  const normalizeSearchText = (value = '') =>
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const getLeadInsertedAt = (lead) => {
    const rawDate = lead?.data_coleta || lead?.created_at || lead?.data_ultima_atualizacao || lead?.updated_at || '';
    const timestamp = rawDate ? new Date(rawDate).getTime() : Number.NaN;
    return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
  };

  const sortByInsertedAtAsc = (a, b) => {
    const dateDiff = getLeadInsertedAt(a) - getLeadInsertedAt(b);
    if (dateDiff !== 0) return dateDiff;
    return Number(a?.id || 0) - Number(b?.id || 0);
  };

  const matchesLeadNameQuery = (lead, query) => {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return true;
    return normalizeSearchText([
      lead?.nome,
      lead?.titulo,
      lead?.empresa,
      lead?.developer_name,
      lead?.url,
      lead?.site_oficial
    ].filter(Boolean).join(' ')).includes(normalizedQuery);
  };

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

  const transformProblemForSales = (rawProblem) => {
    const text = String(rawProblem || '').toLowerCase();
    const mappings = [
      {
        match: ['fcp', 'carregamento inicial'],
        icon: 'perf', impact: 'Site demora para carregar — visitantes vão embora antes de ver a empresa',
        detail: 'Mais de 53% dos usuários abandonam páginas que demoram mais de 3 segundos. Cada segundo a mais significa clientes perdidos para a concorrência.'
      },
      {
        match: ['lcp', 'maior elemento visual'],
        icon: 'perf', impact: 'Conteúdo principal demora a aparecer na tela',
        detail: 'O Google penaliza sites com visual lento, reduzindo o posicionamento nas pesquisas e afastando quem chega pela busca.'
      },
      {
        match: ['cls', 'instabilidade no layout'],
        icon: 'perf', impact: 'Site "pula" enquanto carrega — causa cliques errados e frustração',
        detail: 'Elementos que se movem durante o carregamento transmitem descuido e fazem o visitante sentir que o site não é confiável.'
      },
      {
        match: ['javascript', 'execução pesada', 'tbt'],
        icon: 'perf', impact: 'Site trava ou demora a responder no celular',
        detail: 'Scripts pesados tornam a navegação lenta especialmente em celulares mais simples, que representam a maioria dos acessos no Brasil.'
      },
      {
        match: ['muitos elementos', 'dom'],
        icon: 'perf', impact: 'Página sobrecarregada prejudica a experiência do visitante',
        detail: 'Excesso de elementos aumenta o tempo de carregamento em redes móveis e piora a experiência em dispositivos com menos memória.'
      },
      {
        match: ['título da página', 'title'],
        icon: 'seo', impact: 'Empresa invisível no Google — sem título configurado',
        detail: 'O título é o primeiro elemento que o Google e o visitante leem. Sem ele, a página não aparece corretamente nas buscas do nicho.'
      },
      {
        match: ['meta description', 'resumo google'],
        icon: 'seo', impact: 'Google não sabe descrever o negócio — cliques na busca despencam',
        detail: 'Sem descrição configurada, o Google exibe texto aleatório da página, reduzindo drasticamente o número de pessoas que clicam no resultado.'
      },
      {
        match: ['h1', 'múltiplas tags h1', 'tag h1'],
        icon: 'seo', impact: 'Estrutura de conteúdo confunde o Google e reduz relevância nas buscas',
        detail: 'O H1 diz ao Google sobre o que é a página. Sem ele, ou com múltiplos, o site perde relevância para palavras-chave do nicho.'
      },
      {
        match: ['lang', 'atributo'],
        icon: 'seo', impact: 'Idioma não definido prejudica indexação e acessibilidade',
        detail: 'O atributo de idioma é verificado pelo Google e por tecnologias assistivas. A ausência impacta tanto o SEO quanto a inclusão.'
      },
      {
        match: ['imagens sem', 'alt text', 'sem descrição'],
        icon: 'seo', impact: 'Imagens ignoradas pelo Google — conteúdo visual desperdiçado',
        detail: 'Imagens sem descrição não são indexadas pelo Google e prejudicam a acessibilidade, excluindo usuários com deficiência visual.'
      },
      {
        match: ['https', 'ssl', 'robots', 'indexação'],
        icon: 'seo', impact: 'Site sem segurança — navegadores alertam visitantes para saírem',
        detail: 'Chrome e outros navegadores exibem avisos de "site não seguro" quando falta HTTPS, fazendo visitantes abandonarem a página imediatamente.'
      },
      {
        match: ['layout', 'antiquado', 'tabelas', 'floats'],
        icon: 'design', impact: 'Visual ultrapassado reduz a credibilidade da empresa instantaneamente',
        detail: 'Pesquisas mostram que 94% das primeiras impressões de um site são baseadas em design. Um visual antigo sinaliza descuido e afasta clientes.'
      },
      {
        match: ['fontes padrão', 'fontes do sistema', 'web font'],
        icon: 'design', impact: 'Sem identidade visual — empresa parece genérica e pouco profissional',
        detail: 'Sites sem tipografia própria não transmitem a personalidade da marca. O visitante inconscientemente compara com concorrentes mais modernos.'
      },
      {
        match: ['cta', 'botão de ação', 'nenhum botão'],
        icon: 'ux', impact: 'Visitantes interessados não sabem como entrar em contato — oportunidades perdidas',
        detail: 'Sem chamadas claras para ação, o visitante que já tem interesse vai embora sem deixar contato. A conversão simplesmente não acontece.'
      },
      {
        match: ['favicon'],
        icon: 'ux', impact: 'Sem ícone de marca — site parece inacabado',
        detail: 'O favicon é percebido como um detalhe de capricho. Sua ausência transmite que o site foi feito sem atenção, o que abala a confiança do visitante.'
      },
      {
        match: ['viewport', 'celular', 'configurado para celular'],
        icon: 'mobile', impact: 'Site inutilizável em celulares — 70% do tráfego desperdiçado',
        detail: 'No Brasil, mais de 70% dos acessos à internet vêm de smartphones. Um site sem configuração mobile afasta a maioria do público antes de qualquer interação.'
      },
      {
        match: ['fontes muito pequenas', 'pequenas para telas'],
        icon: 'mobile', impact: 'Textos ilegíveis no celular — visitante desiste de ler',
        detail: 'Fontes pequenas em mobile forçam o usuário a dar zoom constantemente. A experiência frustrante leva ao abandono da página em segundos.'
      },
      {
        match: ['clicáveis', 'tap target', 'pequenos ou próximos'],
        icon: 'mobile', impact: 'Botões difíceis de tocar no celular — erros de clique constantes',
        detail: 'Alvos de toque pequenos fazem o usuário pressionar o elemento errado repetidamente, gerando frustração e levando ao abandono do site.'
      },
      {
        match: ['lazy', 'sem carregamento lento', 'imagens sem lazy'],
        icon: 'perf', impact: 'Imagens carregam todas de uma vez — peso desnecessário para o visitante',
        detail: 'Sem carregamento diferido, o site baixa todas as imagens mesmo as fora da tela. No celular em 4G isso pode triplicar o tempo até a página ser usável.'
      },
      {
        match: ['dimensões', 'sem dimensões', 'width', 'height faltando'],
        icon: 'perf', impact: 'Layout instável enquanto as imagens carregam — visitante vê conteúdo "pulando"',
        detail: 'Imagens sem tamanho definido causam refluxo visual (CLS), um dos fatores de penalidade mais pesados do Google para ranqueamento mobile.'
      },
      {
        match: ['formato legado', 'jpg', 'png sem webp', 'formato de imagem'],
        icon: 'perf', impact: 'Imagens em formato antigo — até 3× mais pesadas que o necessário',
        detail: 'JPEG e PNG são formatos de 1990. WebP e AVIF entregam a mesma qualidade com até 70% menos tamanho, acelerando drasticamente o carregamento.'
      },
      {
        match: ['css bloqueante', 'folhas de estilo bloqueantes', 'blocking css'],
        icon: 'perf', impact: 'Página travada enquanto o CSS carrega — visitante fica com tela em branco',
        detail: 'CSS bloqueante impede o browser de renderizar qualquer conteúdo. O visitante vê uma tela branca por segundos, o que gera abandono imediato.'
      },
      {
        match: ['google fonts', 'fonte bloqueante', 'font-display'],
        icon: 'perf', impact: 'Fonte do Google travando o carregamento — textos invisíveis até o fim do download',
        detail: 'Fontes do Google sem font-display:swap deixam todo o texto invisível durante o download. Adicionar esta configuração elimina o travamento visual.'
      },
    ];

    for (const { match, icon, impact, detail } of mappings) {
      if (match.some(keyword => text.includes(keyword))) {
        return { icon, impact, detail, raw: rawProblem };
      }
    }
    return {
      icon: 'ux',
      impact: String(rawProblem).replace(/^[\p{L} ]+:\s*/u, '').trim(),
      detail: 'Este problema pode estar impactando a experiência do visitante e reduzindo as conversões.',
      raw: rawProblem
    };
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
      // Writes independentes em paralelo — evita 4 round-trips IPC sequenciais
      const dbOps = [
        window.electronAPI.updateLeadWppStatus(table, lead.id, true),
        window.electronAPI.setLeadValidation(table, lead.id, 1),
        window.electronAPI.addInteracao(lead.id, leadTypeCode, 'whatsapp', 'Mensagem inicial enviada via WhatsApp pelo CapLead.'),
      ];
      if (leadTypeCode !== 'linkedin') {
        dbOps.push(window.electronAPI.updateLeadFunil(table, lead.id, 'contatado', patch.proximo_passo, addDaysIso(2)));
      }
      await Promise.all(dbOps);

      updateWhatsappState(lead.id, leadTypeCode, patch);
      await fetchDashboardData();

      if (showSuccess) {
        showAppAlert({
          title: 'WhatsApp registrado',
          message: 'Envio confirmado no CapLead.',
          variant: 'success'
        });
      }

      // Sync Kentauros em background — não bloqueia a UI aguardando rede externa
      syncWhatsappLeadToKentauros({ ...lead, ...patch }, leadTypeCode, sentAt)
        .then(syncResult => {
          const updated = Number(syncResult.updated || 0);
          showToast(updated > 0 ? 'Atualizado na Kentauros.' : 'Enviado para a Kentauros.', 'success');
        })
        .catch(error => {
          if (!error.message?.includes('Kentauros não configurada')) {
            showToast(`Kentauros: ${error.message}`, 'warning', 6000);
          }
        });

    } catch (error) {
      await fetchDashboardData();
      showAppAlert({
        title: 'WhatsApp registrado com aviso',
        message: `O status foi salvo no CapLead, mas houve um erro: ${error.message}`,
        variant: 'warning'
      });
    }
  };

  // ─── WhatsApp AutoPilot ───────────────────────────────────────────────────
  const wppSleep = (ms) => new Promise(r => setTimeout(r, ms));

  const pickWppTemplate = (lead) => {
    const templates = messageTemplatesRef.current.filter(t => t.canal === 'whatsapp');
    if (!templates.length) return null;
    const leadHasSite = !!(lead.site_oficial || lead.developer_site || (lead.url && !/google\.com\/(maps|search)/i.test(String(lead.url))));
    const leadNicho = (lead.nicho || lead.categoria || lead.tipo_negocio || '').toLowerCase();
    const score = (t) => {
      let s = 0;
      if (t.has_site === null || t.has_site === undefined) s += 1;
      else if (!!t.has_site === leadHasSite) s += 3;
      else s -= 1; // penaliza mas não elimina — qualquer template bate o fallback padrão
      if (t.nicho && leadNicho && leadNicho.includes(t.nicho.toLowerCase())) s += 2;
      else if (!t.nicho) s += 0;
      else s -= 1; // penaliza nicho errado mas mantém como candidato
      return s;
    };
    const ranked = templates.map(t => ({ t, s: score(t) })).sort((a, b) => b.s - a.s);
    return ranked[0]?.t || null; // sempre retorna o melhor template, mesmo penalizado
  };

  const applyWppTemplate = (template, lead) => {
    if (!template) return buildWhatsappMessage(lead);
    const nome = lead.nome || lead.titulo || lead.empresa || 'sua empresa';
    const nicho = lead.nicho || lead.categoria || lead.tipo_negocio || 'seu segmento';
    const problema1 = lead.problema1 || lead.analysis_summary || 'presença digital limitada';
    const url = lead.site_oficial || lead.developer_site || (!(/google\.com\/(maps|search)/i.test(String(lead.url || ''))) ? lead.url : '') || '';
    const cidade = lead.localizacao || lead.cidade || lead.location || '';
    const telefone = lead.telefone || lead.phone || '';
    return template.corpo
      // variáveis principais
      .replace(/\{nome\}/gi, nome)
      .replace(/\{empresa\}/gi, nome)
      .replace(/\{nicho\}/gi, nicho)
      .replace(/\{segmento\}/gi, nicho)
      .replace(/\{problema1\}/gi, problema1)
      .replace(/\{problema\}/gi, problema1)
      .replace(/\{url\}/gi, url)
      .replace(/\{url_site\}/gi, url)
      .replace(/\{site\}/gi, url)
      .replace(/\{cidade\}/gi, cidade)
      .replace(/\{localizacao\}/gi, cidade)
      .replace(/\{telefone\}/gi, telefone);
  };

  const processNextWppLead = async () => {
    if (!wppPilotRunning.current) return;

    // Aguarda enquanto pausado
    while (wppPilotPaused.current && wppPilotRunning.current) {
      await wppSleep(300);
    }
    if (!wppPilotRunning.current) return;

    const pilot = wppPilotRef.current;
    if (!pilot) return;

    const { queue, currentIdx } = pilot;
    if (currentIdx >= queue.length) {
      setWppPilot(p => ({ ...p, status: 'done' }));
      wppPilotRunning.current = false;
      return;
    }

    const lead = queue[currentIdx];
    const phone = normalizeWhatsappPhone(lead.telefone || '');
    const template = pickWppTemplate(lead);
    const message = applyWppTemplate(template, lead);

    if (!phone) {
      setWppPilot(p => ({
        ...p,
        results: [...p.results, { lead, status: 'skipped', error: 'Sem telefone válido' }],
        currentIdx: p.currentIdx + 1,
      }));
      setTimeout(processNextWppLead, 500);
      return;
    }

    const result = await window.electronAPI.wppPilotSend(phone, message);
    if (!wppPilotRunning.current) return;

    if (result.status === 'qr-needed') {
      setWppPilot(p => ({ ...p, status: 'qr-wait' }));
      wppPilotRunning.current = false;
      return;
    }

    const sent = result.status === 'sent';
    setWppPilot(p => ({
      ...p,
      results: [...p.results, { lead, status: sent ? 'sent' : (result.status || 'error') }],
      currentIdx: p.currentIdx + 1,
    }));

    if (sent) {
      confirmWhatsappSent(lead, lead._typeCode || 'sites', { showSuccess: false }).catch(() => {});
    }

    if (wppPilotRunning.current) {
      setTimeout(processNextWppLead, 4500); // 4.5s entre envios
    }
  };

  const _launchWppPilot = async (queue) => {
    setWppPilot({ active: true, status: 'initializing', queue, currentIdx: 0, results: [] });
    wppPilotRunning.current = true;
    wppPilotPaused.current = false;

    const init = await window.electronAPI.wppPilotInit();
    if (!init.success) {
      setWppPilot({ active: false, status: 'idle', queue: [], currentIdx: 0, results: [] });
      showAppAlert({ title: 'Erro ao abrir WhatsApp Web', message: init.error || 'Não foi possível iniciar a janela.', variant: 'danger' });
      return;
    }

    await wppSleep(4000);

    const check = await window.electronAPI.wppPilotCheck();
    if (!check.success || check.needsQR || !check.loggedIn) {
      setWppPilot(p => ({ ...p, status: 'qr-wait' }));
      return;
    }

    setWppPilot(p => ({ ...p, status: 'running' }));
    processNextWppLead();
  };

  const startWppAutoPilot = async () => {
    const pendingLeads = whatsappCommercialLeads.filter(l => !l.wpp_enviado && l.telefone);
    if (!pendingLeads.length) {
      showAppAlert({ title: 'Fila vazia', message: 'Todos os leads com WhatsApp já foram contatados ou não há leads elegíveis.', variant: 'info' });
      return;
    }
    await _launchWppPilot(pendingLeads);
  };

  const startWppAutoPilotWithLeads = async (leads) => {
    const queue = leads.filter(l => !l.wpp_enviado && l.telefone).map(l => ({ ...l, _typeCode: l._typeCode || 'sites' }));
    if (!queue.length) {
      showAppAlert({ title: 'Sem leads elegíveis', message: 'Nenhum dos leads selecionados tem WhatsApp disponível ou já foram contatados.', variant: 'info' });
      return;
    }
    setActiveMenu('whatsapp-comercial');
    setSelectedLeadKeys([]);
    await _launchWppPilot(queue);
  };

  const resumeWppAfterQr = async () => {
    const check = await window.electronAPI.wppPilotCheck();
    if (!check.success || check.needsQR || !check.loggedIn) {
      showToast('WhatsApp ainda não logado. Escaneie o QR Code na janela aberta.', 'warning', 4000);
      return;
    }
    wppPilotRunning.current = true;
    wppPilotPaused.current = false;
    setWppPilot(p => ({ ...p, status: 'running' }));
    processNextWppLead();
  };

  const pauseWppPilot = () => {
    wppPilotPaused.current = true;
    setWppPilot(p => ({ ...p, status: 'paused' }));
  };

  const resumeWppPilot = () => {
    wppPilotPaused.current = false;
    setWppPilot(p => ({ ...p, status: 'running' }));
  };

  const skipWppLead = () => {
    setWppPilot(p => {
      const skipped = p.queue[p.currentIdx];
      if (!skipped) return p;
      return {
        ...p,
        results: [...p.results, { lead: skipped, status: 'skipped' }],
        currentIdx: p.currentIdx + 1,
      };
    });
  };

  const stopWppPilot = async () => {
    wppPilotRunning.current = false;
    wppPilotPaused.current = false;
    setWppPilot({ active: false, status: 'idle', queue: [], currentIdx: 0, results: [] });
    await window.electronAPI.wppPilotStop().catch(() => {});
  };
  // ─────────────────────────────────────────────────────────────────────────

  const startWhatsappMessageFlow = async (lead, typeCode) => {
    const leadTypeCode = lead._typeCode || typeCode || 'sites';
    const phone = getBestPhoneForLead(lead);
    if (phone.type === 'none') {
      showAppAlert({ title: 'WhatsApp não encontrado', message: 'Este lead não possui número de telefone para abrir o WhatsApp.', variant: 'warning' });
      return;
    }

    const rawPhone = normalizeWhatsappPhone(phone.digits || lead.telefone || lead.phone || '');
    if (!rawPhone) {
      showAppAlert({ title: 'WhatsApp não encontrado', message: 'Não foi possível preparar o link de WhatsApp deste lead.', variant: 'warning' });
      return;
    }

    const matchedTemplate = pickWppTemplate(lead);
    const messageText = matchedTemplate
      ? applyWppTemplate(matchedTemplate, lead)
      : buildWhatsappMessage(lead, smtpConfig.signatureName || smtpConfig.user?.split('@')[0] || 'Matheus');

    const whatsappUrl = `https://wa.me/${rawPhone}?text=${encodeURIComponent(messageText)}`;
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
    if (!window.electronAPI) return;

    try {
      const [dash, latest, resSites, resSistemas, resLinkedin] = await Promise.all([
        window.electronAPI.getDashboardMetrics(),
        window.electronAPI.getLatestAnalyses(),
        window.electronAPI.getLeadSites(),
        window.electronAPI.getLeadSistemas(),
        window.electronAPI.getLeadLinkedin(),
      ]);
      if (dash.success) setMetrics(dash.data);
      if (latest.success) setLatestAnalyses(latest.data);
      if (resSites.success) setSites(resSites.data);
      if (resSistemas.success) setSistemas(resSistemas.data);
      if (resLinkedin.success) setLinkedin(resLinkedin.data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadConfig = async () => {
    if (!window.electronAPI) {
      setShowOnboarding(false);
      return;
    }

    try {
      const safe = (p) => Promise.resolve(p).catch(() => null);

      // Todas as leituras de config são independentes — executa em paralelo
      const [
        preset, host, port, secure, user, legacyUser, pass, sign, onboardingDone,
        goalVal, weeklyGoalVal, monthlyGoalVal, delayVal, autoWpp,
        statsData, kRes, statsRes, fRes, tRes
      ] = await Promise.all([
        window.electronAPI.getConfig('smtp_preset'),
        window.electronAPI.getConfig('smtp_host'),
        window.electronAPI.getConfig('smtp_port'),
        window.electronAPI.getConfig('smtp_secure'),
        window.electronAPI.getConfig('smtp_user'),
        window.electronAPI.getConfig('gmail_user'),
        window.electronAPI.getConfig('gmail_pass'),
        window.electronAPI.getConfig('smtp_signature'),
        window.electronAPI.getConfig('onboarding_done'),
        window.electronAPI.getConfig('daily_goal'),
        window.electronAPI.getConfig('weekly_goal'),
        window.electronAPI.getConfig('monthly_goal'),
        window.electronAPI.getConfig('email_send_delay'),
        window.electronAPI.getConfig('wpp_auto_dispatch'),
        safe(window.electronAPI.getEmailSendStatsToday()),
        safe(window.electronAPI.getKentaurosConfig?.()),
        safe(window.electronAPI.getDashboardStats?.()),
        safe(window.electronAPI.getFollowupsDue?.()),
        safe(window.electronAPI.getMessageTemplates?.()),
      ]);

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

      setDailyGoal(Number(goalVal?.valor || 0));
      setWeeklyGoal(Number(weeklyGoalVal?.valor || 0));
      setMonthlyGoal(Number(monthlyGoalVal?.valor || 0));
      if (delayVal?.valor) setEmailSendDelay(Number(delayVal.valor));
      setWppAutoDispatch(autoWpp?.valor === '1');

      setSentTodayCount(statsData?.success ? Number(statsData.data?.sentToday || 0) : 0);

      if (kRes?.success && kRes.config) {
        setKentaurosConfig(prev => ({
          ...prev,
          url: kRes.config.url || prev.url,
          enabled: kRes.config.enabled ?? prev.enabled,
          tenantId: kRes.config.tenantId || prev.tenantId,
          userId: kRes.config.userId || prev.userId,
        }));
      }

      if (statsRes?.success) setDashboardStats(statsRes.data);
      if (fRes?.success) setFollowupsDueBadge((fRes.data || []).length);
      if (tRes?.success) setMessageTemplates(tRes.data || []);

    } catch (e) {
      console.error(e);
    }
  };

  const handlePostCaptureWppAction = async (action) => {
    if (!postCaptureWppModal || postCaptureWppModal.phase !== 'dispatching') return;
    const { leads, currentIdx, dispatched, skipped } = postCaptureWppModal;
    const lead = leads[currentIdx];

    if (action === 'send') {
      try {
        await Promise.all([
          window.electronAPI.updateLeadWppStatus('leads_sites', lead.id, true),
          window.electronAPI.setLeadValidation('leads_sites', lead.id, 1),
          window.electronAPI.addInteracao(lead.id, 'sites', 'whatsapp', 'Mensagem enviada via disparo automático do CapLead.'),
          window.electronAPI.updateLeadFunil('leads_sites', lead.id, 'contatado', 'Acompanhar retorno no WhatsApp', addDaysIso(2)),
        ]);
        setSites(c => c.map(s => s.id === lead.id ? { ...s, wpp_enviado: 1, is_validated: 1 } : s));
        syncWhatsappLeadToKentauros(lead, 'sites', new Date().toISOString()).catch(() => {});
      } catch (err) {
        console.warn('[AutoWpp] Erro ao marcar lead:', err.message);
      }
    }

    const nextDispatched = action === 'send' ? dispatched + 1 : dispatched;
    const nextSkipped = action === 'skip' ? skipped + 1 : skipped;
    const nextIdx = currentIdx + 1;

    if (nextIdx >= leads.length) {
      setPostCaptureWppModal(prev => ({ ...prev, phase: 'done', dispatched: nextDispatched, skipped: nextSkipped }));
    } else {
      setPostCaptureWppModal(prev => ({ ...prev, currentIdx: nextIdx, dispatched: nextDispatched, skipped: nextSkipped }));
    }
  };

  const toggleWppAutoDispatch = async (val) => {
    setWppAutoDispatch(val);
    await window.electronAPI.setConfig('wpp_auto_dispatch', val ? '1' : '0');
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
        if (dbUpdateDebounceRef.current) clearTimeout(dbUpdateDebounceRef.current);
        dbUpdateDebounceRef.current = setTimeout(() => fetchDashboardData(), 300);
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

  const handleCancelCapture = async () => {
    setIsCancelling(true);
    try { await window.electronAPI.cancelSearch?.(); } catch (_) {}
  };

  const handleCaptureSubmit = async (e) => {
    e.preventDefault();
    if (!captureForm.nicho) return;
    setIsCancelling(false);
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
            ...DEFAULT_GRID_FILTERS,
            hasEmail: Boolean(normalizedCaptureForm.requireEmail),
            hasWpp: Boolean(normalizedCaptureForm.requireWhatsapp)
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

        if (wppAutoDispatch && normalizedCaptureForm.tipo === 'sites') {
          const withPhone = (res.data || []).filter(l => l.telefone && !l.wpp_enviado);
          if (withPhone.length > 0) {
            setPostCaptureWppModal({ phase: 'confirm', leads: withPhone, currentIdx: 0, dispatched: 0, skipped: 0 });
          }
        }
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
      await window.electronAPI.setConfig('smtp_user', (smtpConfig.user || '').toLowerCase());
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

  const handleBulkDeleteSelected = (leads, typeCode) => {
    const items = Array.isArray(leads) ? leads : [];
    if (!items.length) return;

    showAppConfirm({
      title: 'Excluir leads selecionados?',
      message: `Serão removidos ${items.length} lead(s) selecionado(s) desta tela. Esta ação oculta os leads do grid e mantém a base organizada.`,
      variant: 'danger',
      confirmLabel: `Excluir ${items.length}`,
      cancelLabel: 'Cancelar',
      onConfirm: async () => {
        setBulkProgress({ total: items.length, current: 0, text: 'Excluindo leads selecionados...' });
        let success = 0;
        let error = 0;

        for (let index = 0; index < items.length; index++) {
          const lead = items[index];
          const rowTypeCode = lead._typeCode || typeCode;
          const table = rowTypeCode === 'sistema' ? 'leads_sistemas' : rowTypeCode === 'linkedin' ? 'leads_linkedin' : 'leads_sites';
          setBulkProgress({ total: items.length, current: index + 1, text: `Excluindo: ${getLeadName(lead)}` });
          try {
            const res = await window.electronAPI.blockLead(table, lead.id, true);
            if (res?.success === false) error++;
            else success++;
          } catch (err) {
            console.error('Erro ao excluir lead em lote:', err);
            error++;
          }
        }

        setBulkProgress(null);
        setSelectedLeadKeys([]);
        await fetchDashboardData();
        showAppAlert({
          title: 'Exclusão em lote concluída',
          message: `${success} lead(s) excluído(s)${error ? `, ${error} falha(s)` : ''}.`,
          variant: error ? 'warning' : 'success'
        });
      }
    });
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

    setSentTodayCount(sentToday);

    // Verificar meta diária
    if (dailyGoal > 0 && sentToday >= dailyGoal) {
      if (!getGoalHitAt()) markGoalHit();
      const cooldown = getGoalCooldownRemaining();
      if (cooldown > 0) {
        const mins = Math.ceil(cooldown / 60000);
        showAppAlert({
          title: '🎯 Meta diária atingida',
          message: `Você já enviou ${sentToday} e-mail(s) hoje — meta de ${dailyGoal} atingida! Para exceder a meta, aguarde mais ${mins} minuto(s).`,
          variant: 'warning'
        });
        return;
      }
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
    const { leads, typeCode, template, skippedWithoutEmail = 0, emailOverride } = emailPreviewModal;
    
    setEmailPreviewModal(null);
    bulkCancelRef.current = false;
    setBulkProgress({ total: leads.length, current: 0, text: 'Iniciando disparos de e-mail...' });
    setBulkSummary(null);
    
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < leads.length; i++) {
      if (bulkCancelRef.current) break; // Cancelamento solicitado
      const lead = leads[i];
      const isSingleLead = leads.length === 1;
      const emailTo = isSingleLead ? (emailOverride?.trim() || lead.email) : lead.email;
      setBulkProgress({ total: leads.length, current: i + 1, text: `Enviando e-mail para: ${emailTo}` });
      try {
        const assunto = isSingleLead ? resolveEmailText(template.assunto, lead) : buildEmailSubject(lead);
        const corpo = isSingleLead ? resolveEmailText(template.corpo, lead) : buildEmailBody(lead);

        const res = await window.electronAPI.sendEmail(emailTo, assunto, buildEmailHtml(corpo, lead), emailAttachments);
        if (res.success) {
          const leadTypeCode = lead._typeCode || typeCode;
          const table = leadTypeCode === 'sistema' ? 'leads_sistemas' : leadTypeCode === 'linkedin' ? 'leads_linkedin' : 'leads_sites';
          const emailOps = [
            window.electronAPI.updateLeadEmailStatus(table, lead.id, 1),
            window.electronAPI.setLeadValidation(table, lead.id, 1),
            window.electronAPI.addInteracao(lead.id, leadTypeCode, 'email', 'E-mail consultivo enviado pelo CapLead.'),
            window.electronAPI.addEmailHistory?.(lead.id, leadTypeCode === 'sites' ? 'sites' : 'sistema', emailTo, assunto, corpo.slice(0, 200)),
            window.electronAPI.logActivity?.('email', `E-mail enviado para ${emailTo}`, { leadId: lead.id, leadType: leadTypeCode }),
          ];
          if (leadTypeCode !== 'linkedin') {
            emailOps.push(window.electronAPI.updateLeadFunil(table, lead.id, 'contatado', 'Acompanhar retorno do e-mail enviado', addDaysIso(3)));
          }
          await Promise.all(emailOps);
          setEmailHistory(prev => [{ lead_id: lead.id, lead_tipo: leadTypeCode, to_email: emailTo, subject: assunto, sent_at: new Date().toISOString() }, ...prev]);
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
      await new Promise(r => setTimeout(r, Math.max(EMAIL_SEND_DELAY_MIN, Math.min(EMAIL_SEND_DELAY_MAX, emailSendDelay))));
    }
    setBulkProgress(null);
    const wasCancelled = bulkCancelRef.current;
    bulkCancelRef.current = false;
    setBulkSummary({ type: 'email', success: successCount, error: errorCount, total: leads.length, skipped: skippedWithoutEmail, cancelled: wasCancelled });
    fetchDashboardData();
    setTimeout(() => setBulkSummary(null), 8000);

    // Atualizar contador de enviados hoje e verificar meta
    if (successCount > 0) {
      try {
        const stats = await window.electronAPI.getEmailSendStatsToday();
        const newSentToday = stats?.success ? Number(stats.data?.sentToday || 0) : 0;
        setSentTodayCount(newSentToday);
        if (dailyGoal > 0 && newSentToday >= dailyGoal && !getGoalHitAt()) {
          markGoalHit();
          setGoalReachedModal(true);
        }
      } catch (_) {}
    }
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
      setGridFilters({ ...DEFAULT_GRID_FILTERS, highOpportunity: true });
      setWppFilter(false);
      setActiveMenu('sites');
      return;
    }
    if (queue === 'email') {
      setGridFilters({ ...DEFAULT_GRID_FILTERS, hasEmail: true });
      setWppFilter(false);
      setActiveMenu('sites');
      return;
    }
    if (queue === 'validated') {
      setGridFilters(DEFAULT_GRID_FILTERS);
      setWppFilter(false);
      setActiveMenu('validados');
      return;
    }
    if (queue === 'followups') {
      setGridFilters({ ...DEFAULT_GRID_FILTERS, followupDue: true });
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
        title: "Central de comando",
        items: [
          { id: 'geral', name: 'Dashboard', icon: <LayoutDashboard size={18} /> },
        ]
      },
      {
        title: "Área Lead Hunter",
        items: [
          { id: 'nova-captura', name: 'Nova Captura', icon: <Search size={18} /> },
          { id: 'sites', name: 'Banco de Sites', icon: <Layers size={18} /> },
          { id: 'sistemas', name: 'Sistemas & Apps', icon: <LayoutTemplate size={18} /> },
          { id: 'linkedin', name: 'LinkedIn', icon: <Linkedin size={18} /> },
        ]
      },
      {
        title: "Comercial",
        items: [
          { id: 'validados', name: 'Leads Validados', icon: <CheckCircle size={18} /> },
          { id: 'crm', name: 'CRM', icon: <History size={18} />, badge: followupsDueBadge || undefined },
          { id: 'kanban', name: 'Pipeline Kanban', icon: <Layers size={18} /> },
          { id: 'propostas', name: 'Propostas', icon: <FileCheck size={18} /> },
          {
            id: 'whatsapp-comercial',
            name: 'WhatsApp',
            icon: <MessageCircle size={18} />,
            badge: whatsappUnreadCount
          },
        ]
      },
      {
        title: "Sistema",
        items: [
          { id: 'envios', name: 'Configurações', icon: <Settings size={18} /> }
        ]
      }
    ];

    return (
      <>
      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/70 lg:hidden"
        />
      )}
      <aside className={`premium-sidebar ${mobileSidebarOpen ? 'open' : ''}`}>
        <div className="flex items-center gap-3 px-2 pb-4">
          <div className="brand-mark">
            <Target className="relative z-10 text-blue-100" size={23} />
          </div>
          <div>
            <h1 className="font-display text-base font-extrabold text-white leading-tight">
              CapLead AI
            </h1>
            <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-[0.16em]">Prospector</p>
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto custom-scrollbar px-4 space-y-8">
          {menuSections.map((section, idx) => (
            <div key={idx}>
              <h3 className="text-[11px] font-extrabold text-slate-500 uppercase tracking-[0.12em] mb-2 px-3">
                {section.title}
              </h3>
              <div className="space-y-1">
                {section.items.map((m) => (
                  <button 
                    key={m.id}
                    onClick={() => {
                      setActiveMenu(m.id);
                      setMobileSidebarOpen(false);
                    }}
                    className={`premium-nav-item flex items-center gap-3 w-full px-3 py-2.5 text-sm font-semibold ${
                      activeMenu === m.id 
                        ? 'active' 
                        : ''
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
          <div className="premium-panel p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className={`w-3 h-3 rounded-full ${smtpStatus?.type === 'success' || smtpConfig.user ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-white">Status SMTP</p>
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
      </>
    );
  };

  const renderDashboard = () => {
    const totalValidated = validatedLeadsGrid.length;
    const emailsFound = sites.filter(lead => lead.has_email_count > 0 || lead.email).length
      + sistemas.filter(lead => lead.email || lead.developer_email).length;
    const followupsDue = validatedLeadsGrid.filter(isFollowupDue).length;
    const enriched = sites.filter(lead => lead.has_email_count > 0 || lead.has_phone_count > 0 || lead.telefone).length;
    const approached = validatedLeadsGrid.filter(lead => lead.email_enviado || lead.wpp_enviado).length;
    const responded = validatedLeadsGrid.filter(lead => lead.respondeu_email || lead.retorno_wpp).length;
    const converted = validatedLeadsGrid.filter(lead => lead.funil_status === 'fechado').length;
    const highOpportunity = [...siteLeadsGrid, ...sistemas].filter(lead => getCommercialScore(lead, lead._typeCode || 'sites') >= 78).length;
    const conversionRate = metrics.totalLeads ? Math.round((converted / Math.max(metrics.totalLeads, 1)) * 1000) / 10 : 0;

    return (
      <div className="animate-fade-in space-y-5">
        <header className="flex flex-col xl:flex-row xl:items-start justify-between gap-5">
          <div>
            <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-[0.13em] mb-2">Control center &mdash; {new Date().toLocaleDateString('pt-BR')}</p>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">Painel de Operações</h1>
            <p className="text-slate-400 text-sm mt-2 max-w-3xl">Resumo da prospecção, oportunidades e automações em andamento.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setShowOnboarding(true)} className="premium-btn">
              <Info size={16} /> Guia rápido
            </button>
            <button onClick={() => setActiveMenu('nova-captura')} className="premium-btn primary">
              <Search size={16} /> Nova captura
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-4">
          {[
            { label: 'Total de Leads', value: metrics.totalLeads, note: 'Base capturada', badge: '+12%', icon: <Users size={18} />, badgeClass: 'success' },
            { label: 'Leads Validados', value: totalValidated, note: 'Prontos para abordagem', badge: `${metrics.totalLeads ? Math.round((totalValidated / metrics.totalLeads) * 100) : 0}%`, icon: <CheckCircle size={18} />, badgeClass: 'success' },
            { label: 'E-mails Encontrados', value: emailsFound, note: 'Disparos preparados', badge: 'Fila', icon: <Mail size={18} />, badgeClass: 'primary' },
            { label: 'Follow-ups Pendentes', value: followupsDue, note: 'Aguardam retorno', badge: followupsDue > 0 ? 'Hoje' : 'Em dia', icon: <Clock size={18} />, badgeClass: followupsDue > 0 ? 'danger' : 'success' }
          ].map(card => (
            <article key={card.label} className="premium-card p-5 min-h-[154px] grid content-start gap-4">
              <div className="flex items-start justify-between gap-4">
                <span className="text-xs font-extrabold text-slate-400 uppercase tracking-[0.06em]">{card.label}</span>
                <span className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/30 text-blue-300 grid place-items-center">{card.icon}</span>
              </div>
              <div className="text-4xl font-extrabold text-white leading-none">{card.value}</div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-slate-400 text-xs">{card.note}</p>
                <span className={`premium-badge ${card.badgeClass}`}>{card.badge}</span>
              </div>
            </article>
          ))}
        </section>

        <section className="premium-panel p-6 border-primary/25 bg-[linear-gradient(135deg,rgba(59,130,246,0.12),transparent_46%),rgba(17,24,39,0.92)]">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
            <div>
              <span className="premium-badge primary">Rotina recomendada para hoje</span>
              <h2 className="text-xl font-extrabold mt-3 mb-2">Analise leads pendentes, valide contatos e prepare abordagens antes do envio.</h2>
              <p className="text-slate-400 text-sm max-w-3xl">A fila sugere começar por oportunidades acima de 78 pontos, revisar contatos sem WhatsApp e separar follow-ups vencidos.</p>
              {automationSummary && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="premium-badge">Analisados: {automationSummary.analyzed}</span>
                  <span className="premium-badge success">E-mails capturados: {automationSummary.capturedEmails}</span>
                  <span className="premium-badge primary">Prontos: {automationSummary.ready}</span>
                  {automationSummary.failed > 0 && <span className="premium-badge danger">Falhas: {automationSummary.failed}</span>}
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <button onClick={handleDailyAssistedAutomation} disabled={bulkProgress !== null} className="premium-btn primary disabled:opacity-50">
                <Zap size={18} /> Iniciar rotina
              </button>
              <button onClick={() => openOperationalQueue('followups')} className="premium-btn">
                <Clock size={18} /> Ver follow-ups
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <article className="premium-panel p-6 xl:col-span-2">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-extrabold">Funil de Prospecção</h2>
                <p className="text-slate-400 text-sm mt-1">Da captura ao fechamento, com leitura operacional rápida.</p>
              </div>
              <span className="premium-badge success">Conversão {conversionRate}%</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-3">
              {[
                ['Capturados', metrics.totalLeads],
                ['Validados', totalValidated],
                ['Enriquecidos', enriched],
                ['Abordados', approached],
                ['Responderam', responded],
                ['Convertidos', converted]
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-border bg-surface-hover/70 p-4 min-h-[104px]">
                  <strong className="block text-white text-2xl font-extrabold leading-none">{value}</strong>
                  <span className="block text-slate-400 text-xs mt-2">{label}</span>
                </div>
              ))}
            </div>
          </article>
          <article className="premium-panel p-6 flex flex-col gap-4">
            {(() => {
              const goalSet = dailyGoal > 0;
              const pct = goalSet ? Math.min(100, Math.round((sentTodayCount / dailyGoal) * 100)) : 0;
              const reached = goalSet && sentTodayCount >= dailyGoal;
              const cooldown = reached ? getGoalCooldownRemaining() : 0;
              const cooldownMins = Math.ceil(cooldown / 60000);
              const exceeding = reached && cooldown === 0 && sentTodayCount > dailyGoal;
              return (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-extrabold">Meta Diária</h2>
                      <p className="text-slate-400 text-xs mt-1">Controle de ritmo de prospecção</p>
                    </div>
                    {!reached && <span className="premium-badge primary">{goalSet ? `${sentTodayCount}/${dailyGoal}` : 'Sem meta'}</span>}
                    {reached && cooldown > 0 && <span className="premium-badge warning">⏱ {cooldownMins}min</span>}
                    {reached && cooldown === 0 && <span className="premium-badge success">Excedendo</span>}
                  </div>

                  {goalSet ? (
                    <>
                      <div>
                        <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                          <span>{sentTodayCount} enviados</span>
                          <span>meta: {dailyGoal}</span>
                        </div>
                        <div className="h-3 rounded-full bg-slate-700/50 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${reached ? 'bg-gradient-to-r from-emerald-400 to-emerald-300' : 'bg-gradient-to-r from-primary to-blue-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                          {reached && cooldown > 0 && `⏳ Aguarde ${cooldownMins}min para exceder a meta.`}
                          {reached && cooldown === 0 && exceeding && `✅ Meta superada. Bom trabalho!`}
                          {reached && cooldown === 0 && !exceeding && `🎯 Meta atingida! Pode continuar enviando.`}
                          {!reached && `${Math.max(0, dailyGoal - sentTodayCount)} envio(s) restantes para a meta.`}
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="text-slate-400 text-sm leading-relaxed flex-1">Defina uma meta de envios para acompanhar seu ritmo e proteger a reputação do e-mail.</p>
                  )}

                  {(weeklyGoal > 0 || monthlyGoal > 0) && (() => {
                    const last7 = dashboardStats?.dailyLeads?.slice(-7) || [];
                    const last30 = dashboardStats?.dailyLeads?.slice(-30) || [];
                    const weekCount = last7.reduce((a, d) => a + d.count, 0);
                    const monthCount = last30.reduce((a, d) => a + d.count, 0);
                    return (
                      <div className="space-y-2">
                        {weeklyGoal > 0 && (
                          <div>
                            <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                              <span>Semanal: {weekCount}</span><span>meta: {weeklyGoal}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-violet-300 transition-all" style={{ width: `${Math.min(100, Math.round(weekCount / weeklyGoal * 100))}%` }} />
                            </div>
                          </div>
                        )}
                        {monthlyGoal > 0 && (
                          <div>
                            <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                              <span>Mensal: {monthCount}</span><span>meta: {monthlyGoal}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-300 transition-all" style={{ width: `${Math.min(100, Math.round(monthCount / monthlyGoal * 100))}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <button
                    onClick={() => { setDailyGoalInput(String(dailyGoal || '')); setDailyGoalModal(true); }}
                    className="mt-auto w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 text-xs font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <Edit3 size={13} /> {goalSet ? 'Editar metas' : 'Definir metas'}
                  </button>
                </>
              );
            })()}
          </article>
        </section>

        {dashboardStats?.dailyLeads?.length > 0 && (
          <section className="premium-panel p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-xl font-extrabold">Capturas dos últimos 14 dias</h2>
                <p className="text-slate-400 text-sm mt-1">Evolução diária de leads novos no banco de dados.</p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-3xl font-black text-white">{dashboardStats.dailyLeads.reduce((a, d) => a + d.count, 0)}</span>
                <p className="text-slate-500 text-xs mt-0.5">total 14 dias</p>
              </div>
            </div>
            {(() => {
              const data = dashboardStats.dailyLeads;
              const maxVal = Math.max(...data.map(d => d.count), 1);
              const barW = Math.floor(100 / data.length);
              return (
                <div className="flex items-end gap-1 h-28">
                  {data.map((d, i) => {
                    const pct = Math.round((d.count / maxVal) * 100);
                    const date = new Date(d.date + 'T00:00:00');
                    const isToday = d.date === new Date().toISOString().slice(0, 10);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 group" title={`${d.date}: ${d.count} leads`}>
                        <span className="text-[9px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">{d.count}</span>
                        <div
                          className={`w-full rounded-t-sm transition-all ${isToday ? 'bg-primary' : 'bg-white/15 group-hover:bg-white/25'}`}
                          style={{ height: `${Math.max(pct, 4)}%` }}
                        />
                        {i % 3 === 0 && (
                          <span className="text-[9px] text-slate-600 whitespace-nowrap">
                            {date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            {dashboardStats.followupsDue > 0 && (
              <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm font-semibold">
                <Clock size={15} /> {dashboardStats.followupsDue} follow-up{dashboardStats.followupsDue > 1 ? 's' : ''} pendente{dashboardStats.followupsDue > 1 ? 's' : ''} — verifique o CRM
              </div>
            )}
          </section>
        )}

        <section className="premium-panel p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-extrabold">Atalhos do dia</h2>
              <p className="text-slate-400 text-sm mt-1">Ações rápidas com cor apenas como acento funcional.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            {[
              { label: 'Alta oportunidade', count: highOpportunity, desc: 'Priorizar melhores leads', color: 'success', action: () => openOperationalQueue('high') },
              { label: 'Fila de e-mails', count: emailsFound, desc: 'Preparar disparos úteis', color: 'primary', action: handleSmartEmailQueue },
              { label: 'Validados', count: totalValidated, desc: 'Acompanhar abordagens', color: 'warning', action: () => openOperationalQueue('validated') },
              { label: 'Follow-ups', count: followupsDue, desc: 'Vencidos ou para hoje', color: 'danger', action: () => openOperationalQueue('followups') },
              { label: 'Nova captura', count: 'Ação', desc: 'Adicionar oportunidades', color: 'accent', action: () => openOperationalQueue('capture') }
            ].map(item => (
              <button key={item.label} onClick={item.action} className="premium-card p-4 text-left hover:border-primary/40 hover:-translate-y-0.5 transition-all">
                <span className={`premium-badge ${item.color}`}>{item.count}</span>
                <h3 className="text-sm font-extrabold text-white mt-4">{item.label}</h3>
                <p className="text-xs text-slate-400 mt-1">{item.desc}</p>
                <div className={`mt-5 h-1 w-9 rounded-full ${item.color === 'success' ? 'bg-emerald-400' : item.color === 'warning' ? 'bg-amber-400' : item.color === 'danger' ? 'bg-red-400' : item.color === 'accent' ? 'bg-violet-400' : 'bg-primary'}`} />
              </button>
            ))}
          </div>
        </section>

        <section className="premium-panel p-6">
          <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="text-xl font-extrabold">Histórico de Varredura Recente</h2>
              <p className="text-slate-400 text-sm mt-1">Filtros e tabela com leitura rápida para operação comercial.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-5 gap-2 w-full xl:w-auto">
              <input className="premium-input" placeholder="Buscar lead" value={dashFilters.search} onChange={e => setDashFilters(p => ({ ...p, search: e.target.value }))} />
              <select className="premium-input" value={dashFilters.source} onChange={e => setDashFilters(p => ({ ...p, source: e.target.value }))}>
                <option value="todos">Origem</option><option value="sites">Site</option><option value="sistema">Sistema</option><option value="linkedin">LinkedIn</option>
              </select>
              <select className="premium-input" value={dashFilters.status} onChange={e => setDashFilters(p => ({ ...p, status: e.target.value }))}>
                <option value="todos">Status</option><option value="validado">Validado</option><option value="pendente">Pendente</option>
              </select>
              <select className="premium-input" value={dashFilters.period} onChange={e => setDashFilters(p => ({ ...p, period: e.target.value }))}>
                <option value="todos">Período</option><option value="hoje">Hoje</option><option value="semana">Semana</option>
              </select>
              <select className="premium-input" value={dashFilters.opp} onChange={e => setDashFilters(p => ({ ...p, opp: e.target.value }))}>
                <option value="todos">Oportunidade</option><option value="alta">Alta (&gt;=78)</option><option value="media">Média</option>
              </select>
            </div>
          </div>
          {(() => {
            const today = new Date().toISOString().slice(0, 10);
            const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
            return latestAnalyses
              .filter(item => {
                if (dashFilters.search && !`${item.nome}${item.titulo}${item.url}`.toLowerCase().includes(dashFilters.search.toLowerCase())) return false;
                if (dashFilters.source !== 'todos' && (item.type || item._typeCode || 'sites') !== dashFilters.source) return false;
                if (dashFilters.status !== 'todos') {
                  if (dashFilters.status === 'validado' && !item.is_validated) return false;
                  if (dashFilters.status === 'pendente' && item.is_validated) return false;
                }
                if (dashFilters.period !== 'todos') {
                  const d = (item.data_coleta || '').slice(0, 10);
                  if (dashFilters.period === 'hoje' && d !== today) return false;
                  if (dashFilters.period === 'semana' && d < weekAgo) return false;
                }
                if (dashFilters.opp !== 'todos') {
                  const s = getCommercialScore(item, item._typeCode || item.type || 'sites');
                  if (dashFilters.opp === 'alta' && s < 78) return false;
                  if (dashFilters.opp === 'media' && (s < 50 || s >= 78)) return false;
                }
                return true;
              });
          })().length === 0 && latestAnalyses.length > 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-600/50 bg-surface-hover/40 py-10 px-6 text-center text-slate-400 text-sm">
              Nenhum lead corresponde aos filtros selecionados.
              <button onClick={() => setDashFilters({ search: '', source: 'todos', status: 'todos', period: 'todos', opp: 'todos' })} className="ml-3 text-primary underline text-xs">limpar filtros</button>
            </div>
          ) : latestAnalyses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-600/50 bg-surface-hover/40 py-14 px-6 text-center">
              <h4 className="text-white font-bold text-lg mb-1">Nenhuma varredura executada hoje.</h4>
              <p className="text-slate-400 text-sm max-w-sm mx-auto">Inicie uma nova captura para encontrar oportunidades.</p>
              <button onClick={() => setActiveMenu('nova-captura')} className="premium-btn primary mt-6">Iniciar nova captura</button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[900px] text-left text-sm text-slate-300">
                <thead className="bg-surface-hover/80 uppercase font-extrabold text-[11px] tracking-[0.08em] text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Lead identificado</th>
                    <th className="px-5 py-4">Origem/Categoria</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Score/Oportunidade</th>
                    <th className="px-5 py-4">Momento</th>
                    <th className="px-5 py-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {latestAnalyses.filter(item => {
                    const today2 = new Date().toISOString().slice(0, 10);
                    const weekAgo2 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
                    if (dashFilters.search && !`${item.nome}${item.titulo}${item.url}`.toLowerCase().includes(dashFilters.search.toLowerCase())) return false;
                    if (dashFilters.source !== 'todos' && (item.type || item._typeCode || 'sites') !== dashFilters.source) return false;
                    if (dashFilters.status === 'validado' && !item.is_validated) return false;
                    if (dashFilters.status === 'pendente' && item.is_validated) return false;
                    if (dashFilters.period === 'hoje' && (item.data_coleta || '').slice(0, 10) !== today2) return false;
                    if (dashFilters.period === 'semana' && (item.data_coleta || '').slice(0, 10) < weekAgo2) return false;
                    const sc = getCommercialScore(item, item._typeCode || item.type || 'sites');
                    if (dashFilters.opp === 'alta' && sc < 78) return false;
                    if (dashFilters.opp === 'media' && (sc < 50 || sc >= 78)) return false;
                    return true;
                  }).map((item, idx) => {
                    const score = getCommercialScore(item, item._typeCode || item.type || 'sites');
                    return (
                      <tr key={idx} className="hover:bg-surface-hover/50 transition-colors">
                        <td className="px-5 py-4 font-semibold text-white">{item.nome || item.titulo || item.url}</td>
                        <td className="px-5 py-4"><span className="premium-badge capitalize">{item.type || item.categoria || 'site'}</span></td>
                        <td className="px-5 py-4"><span className={`premium-badge ${item.is_validated ? 'success' : 'primary'}`}>{item.is_validated ? 'Validado' : 'Novo'}</span></td>
                        <td className="px-5 py-4 font-mono text-white">{score || 0}/100 {score >= 78 ? 'Alto potencial' : 'Boa oportunidade'}</td>
                        <td className="px-5 py-4 text-slate-400 text-xs">{new Date(item.data_coleta).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="px-5 py-4 text-right"><button onClick={() => handleOpenDetails(item)} className="premium-btn">Ver lead</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    );
  };

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
                  <div className="absolute z-20 w-full mt-2 bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl max-h-72 overflow-y-auto custom-scrollbar">
                    {(() => {
                      const query = (captureForm.regiao || '').toLowerCase();
                      const filtered = REGIAO_OPTIONS
                        .map(g => ({ ...g, items: g.items.filter(opt => opt.toLowerCase().includes(query)) }))
                        .filter(g => g.items.length > 0);
                      if (filtered.length === 0) return (
                        <div className="px-5 py-4 text-sm text-slate-500 italic">Nenhuma localização encontrada</div>
                      );
                      return filtered.map(group => (
                        <div key={group.group}>
                          <div className="px-4 pt-3 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-[#0d1525] sticky top-0">
                            {group.group}
                          </div>
                          {group.items.map(opt => (
                            <div
                              key={opt}
                              onMouseDown={() => {
                                setCaptureForm({...captureForm, regiao: opt});
                                setShowRegiaoDropdown(false);
                              }}
                              className="px-5 py-2.5 text-sm text-slate-300 hover:bg-primary/20 hover:text-white cursor-pointer transition-colors"
                            >
                              {opt}
                            </div>
                          ))}
                        </div>
                      ));
                    })()}
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

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={captureStatus?.status === 'loading'}
                className="flex-1 bg-gradient-to-r from-primary to-blue-600 hover:from-primary-hover hover:to-blue-700 text-white font-bold py-5 rounded-2xl flex items-center justify-center gap-3 transition-all transform hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-primary/20 disabled:opacity-50"
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
              {captureStatus?.status === 'loading' && (
                <button
                  type="button"
                  onClick={handleCancelCapture}
                  disabled={isCancelling}
                  className="px-5 py-5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 font-bold text-sm transition-all disabled:opacity-50 flex items-center gap-2"
                  title="Cancelar captura"
                >
                  <X size={18} /> {isCancelling ? 'Cancelando...' : 'Cancelar'}
                </button>
              )}
            </div>

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


  const renderKanban = () => {
    const FUNIL_COLUMNS = [
      { key: 'novo', label: 'Novos', color: 'text-slate-300', bar: 'bg-slate-500', dot: 'bg-slate-400' },
      { key: 'em_contato', label: 'Em Contato', color: 'text-blue-300', bar: 'bg-blue-500', dot: 'bg-blue-400' },
      { key: 'proposta', label: 'Proposta Enviada', color: 'text-amber-300', bar: 'bg-amber-500', dot: 'bg-amber-400' },
      { key: 'negociacao', label: 'Negociação', color: 'text-violet-300', bar: 'bg-violet-500', dot: 'bg-violet-400' },
      { key: 'fechado', label: 'Fechado', color: 'text-emerald-300', bar: 'bg-emerald-500', dot: 'bg-emerald-400' },
      { key: 'perdido', label: 'Perdido', color: 'text-red-300', bar: 'bg-red-500', dot: 'bg-red-400' },
    ];

    const allLeads = [
      ...sites.map(l => ({ ...l, _typeCode: 'sites' })),
      ...sistemas.map(l => ({ ...l, _typeCode: 'sistema' })),
    ];

    const byColumn = {};
    FUNIL_COLUMNS.forEach(col => {
      byColumn[col.key] = allLeads.filter(l => (l.funil_status || 'novo') === col.key);
    });

    const totalValue = allLeads.reduce((sum, l) => {
      const tv = ticketValues[`${l._typeCode}-${l.id}`] ?? l.ticket_value ?? 0;
      return sum + (l.funil_status !== 'perdido' ? Number(tv) : 0);
    }, 0);

    const handleDragStart = (e, lead) => {
      e.dataTransfer.setData('lead-id', String(lead.id));
      e.dataTransfer.setData('lead-type', lead._typeCode);
    };

    const handleDrop = async (e, targetStatus) => {
      e.preventDefault();
      const id = Number(e.dataTransfer.getData('lead-id'));
      const tipo = e.dataTransfer.getData('lead-type');
      const table = tipo === 'sistema' ? 'leads_sistemas' : 'leads_sites';
      await window.electronAPI.updateLeadFunil?.(table, id, targetStatus, null, null);
      const setter = tipo === 'sistema' ? setSistemas : setSites;
      setter(prev => prev.map(l => l.id === id ? { ...l, funil_status: targetStatus } : l));
    };

    return (
      <div className="p-6 animate-fade-in h-full overflow-y-auto custom-scrollbar bg-surface">
        <header className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-white">Pipeline Kanban</h1>
            <p className="text-slate-400 text-sm mt-1">Arraste cards entre colunas para mover o lead no funil.</p>
          </div>
          {totalValue > 0 && (
            <div className="shrink-0 text-right">
              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Pipeline potencial</p>
              <p className="text-2xl font-black text-emerald-400 mt-0.5">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(totalValue)}
              </p>
            </div>
          )}
        </header>

        <div className="flex gap-4 overflow-x-auto pb-4 min-h-[60vh]">
          {FUNIL_COLUMNS.map(col => {
            const leads = byColumn[col.key] || [];
            const colValue = leads.reduce((s, l) => s + (Number(ticketValues[`${l._typeCode}-${l.id}`] ?? l.ticket_value ?? 0)), 0);
            return (
              <div
                key={col.key}
                className="flex-shrink-0 w-64 flex flex-col"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, col.key)}
              >
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <span className={`text-xs font-extrabold uppercase tracking-wider ${col.color}`}>{col.label}</span>
                  <span className="ml-auto text-xs font-black text-slate-500">{leads.length}</span>
                </div>
                {colValue > 0 && (
                  <p className="text-[10px] text-slate-600 font-bold px-1 mb-2">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(colValue)}
                  </p>
                )}
                <div className="flex-1 space-y-2 min-h-[80px] rounded-2xl transition-colors">
                  {leads.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-700/60 p-4 text-center text-slate-600 text-xs h-20 flex items-center justify-center">
                      Arraste aqui
                    </div>
                  ) : leads.slice(0, 20).map(lead => {
                    const cardKey = `${lead._typeCode}-${lead.id}`;
                    const score = scoreOverrides[cardKey] ?? getCommercialScore(lead, lead._typeCode);
                    const tv = ticketValues[cardKey] ?? lead.ticket_value;
                    const noteVal = kanbanNotes[cardKey] ?? '';
                    return (
                      <div
                        key={cardKey}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead)}
                        onClick={() => handleOpenDetails(lead)}
                        className="bg-surface-hover border border-border rounded-2xl p-3 cursor-grab active:cursor-grabbing hover:border-primary/40 hover:-translate-y-0.5 transition-all select-none"
                      >
                        <p className="text-white font-semibold text-sm truncate">{lead.nome || lead.titulo}</p>
                        {lead.nicho && <p className="text-slate-500 text-xs mt-0.5 truncate">{lead.nicho}</p>}
                        {tv > 0 && <p className="text-emerald-400 text-[10px] font-bold mt-0.5">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(tv)}</p>}
                        <div className="flex items-center justify-between mt-2">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${score >= 78 ? 'bg-emerald-500/10 text-emerald-400' : score >= 55 ? 'bg-amber-500/10 text-amber-400' : 'bg-white/5 text-slate-500'}`}>
                            {score}/100
                          </span>
                          {lead.followup_date && isFollowupDue(lead) && (
                            <span className="text-[10px] text-red-400 font-bold flex items-center gap-1">
                              <Clock size={10} /> Vencido
                            </span>
                          )}
                        </div>
                        <div onClick={e => e.stopPropagation()} className="mt-2">
                          <input
                            type="text"
                            value={noteVal}
                            onChange={e => setKanbanNotes(p => ({ ...p, [cardKey]: e.target.value }))}
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter' && noteVal.trim()) {
                                await window.electronAPI.addInteracao?.(lead.id, lead._typeCode === 'sites' ? 'sites' : 'sistema', 'nota', noteVal.trim());
                                setKanbanNotes(p => ({ ...p, [cardKey]: '' }));
                                showToast('Nota salva!', 'success', 2000);
                              }
                            }}
                            placeholder="Nota rápida (Enter p/ salvar)"
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-primary/40 select-text cursor-text"
                          />
                        </div>
                      </div>
                    );
                  })}
                  {leads.length > 20 && (
                    <p className="text-center text-xs text-slate-600 py-2">+{leads.length - 20} mais</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

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

          {/* WhatsApp Auto Dispatch */}
          <div className="mt-10 pt-8 border-t border-white/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-400 flex items-center justify-center shrink-0">
                <MessageCircle size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Disparo Automático de WhatsApp</h3>
                <p className="text-slate-400 text-sm">Pergunta se deseja disparar mensagens logo após cada captura de leads</p>
              </div>
            </div>

            <div className="glass p-5 rounded-2xl border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-slate-300 font-medium">Ativar disparo automático</label>
                  <p className="text-slate-500 text-xs mt-0.5">Ao finalizar uma captura de sites, um popup perguntará se deseja enviar WhatsApp para os leads com telefone.</p>
                </div>
                <button
                  onClick={() => toggleWppAutoDispatch(!wppAutoDispatch)}
                  className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ml-4 ${wppAutoDispatch ? 'bg-green-500' : 'bg-white/10'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${wppAutoDispatch ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
              {wppAutoDispatch && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-xs text-green-200 leading-relaxed">
                  <strong className="text-green-300">Ativo.</strong> Após cada captura de sites com telefone, um popup aparecerá perguntando se deseja iniciar o disparo de WhatsApp. Você abrirá cada conversa manualmente e confirmará o envio lead a lead.
                </div>
              )}
            </div>
          </div>

          {/* T08 — Delay entre envios */}
          <div className="mt-10 pt-8 border-t border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Clock size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Intervalo entre envios</h3>
                <p className="text-slate-400 text-xs">Tempo de espera entre cada e-mail no disparo em lote</p>
              </div>
            </div>
            <div className="glass p-4 rounded-2xl border border-white/10 flex items-center gap-4">
              <input
                type="range"
                min={EMAIL_SEND_DELAY_MIN}
                max={EMAIL_SEND_DELAY_MAX}
                step={500}
                value={emailSendDelay}
                onChange={e => setEmailSendDelay(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-white font-bold text-sm w-16 text-right">{(emailSendDelay / 1000).toFixed(1)}s</span>
              <button
                onClick={() => window.electronAPI.setConfig('email_send_delay', String(emailSendDelay))}
                className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 hover:bg-amber-500/20 font-bold text-xs transition-all"
              >
                Salvar
              </button>
            </div>
            <p className="text-slate-600 text-xs mt-2">Recomendado: 2–5 segundos para Gmail. Valores menores aumentam risco de bloqueio SMTP.</p>
          </div>

          {/* Templates de Mensagem */}
          <div className="mt-10 pt-8 border-t border-white/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center shrink-0">
                <FileText size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Templates de Mensagem</h3>
                <p className="text-slate-400 text-sm">Mensagens personalizadas por nicho e canal de contato</p>
              </div>
            </div>

            <div className="glass p-5 rounded-2xl border border-white/10 space-y-4">
              {messageTemplates.length === 0 ? (
                <p className="text-slate-500 text-sm">Nenhum template cadastrado.</p>
              ) : (
                <div className="space-y-3">
                  {messageTemplates.map(t => (
                    <div key={t.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${templateForm.id === t.id ? 'bg-violet-500/10 border-violet-500/30' : 'bg-white/5 border-white/10'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-semibold text-sm">{t.nome}</span>
                          {t.nicho && <span className="px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 text-[10px] font-bold">{t.nicho}</span>}
                          <span className="px-2 py-0.5 rounded-full bg-white/10 text-slate-400 text-[10px] font-bold">{t.canal === 'whatsapp' ? 'WhatsApp' : 'E-mail'}</span>
                          {t.has_site !== null && <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${t.has_site ? 'bg-blue-500/10 text-blue-300' : 'bg-amber-500/10 text-amber-300'}`}>{t.has_site ? 'Com site' : 'Sem site'}</span>}
                        </div>
                        <p className="text-slate-400 text-xs mt-1 line-clamp-2">{t.corpo}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          title="Editar template"
                          onClick={() => setTemplateForm({ id: t.id, nome: t.nome, canal: t.canal || 'whatsapp', nicho: t.nicho || '', has_site: t.has_site ?? null, corpo: t.corpo })}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 transition-all"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          title="Excluir template"
                          onClick={async () => {
                            if (confirm(`Excluir template "${t.nome}"?`)) {
                              await window.electronAPI.deleteMessageTemplate?.(t.id);
                              if (templateForm.id === t.id) setTemplateForm({ id: null, nicho: '', canal: 'whatsapp', has_site: null, nome: '', corpo: '' });
                              const res = await window.electronAPI.getMessageTemplates?.();
                              if (res?.success) setMessageTemplates(res.data || []);
                            }
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Form novo/editar template */}
              <div className="pt-4 border-t border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {templateForm.id ? 'Editar template' : 'Novo template'}
                  </p>
                  {templateForm.id && (
                    <button
                      onClick={() => setTemplateForm({ id: null, nicho: '', canal: 'whatsapp', has_site: null, nome: '', corpo: '' })}
                      className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
                    >
                      <X size={12} /> Cancelar edição
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                    placeholder="Nome do template"
                    value={templateForm.nome}
                    onChange={e => setTemplateForm(p => ({ ...p, nome: e.target.value }))}
                  />
                  <input
                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                    placeholder="Nicho (ex: saúde, juridico)"
                    value={templateForm.nicho}
                    onChange={e => setTemplateForm(p => ({ ...p, nicho: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                    value={templateForm.canal}
                    onChange={e => setTemplateForm(p => ({ ...p, canal: e.target.value }))}
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">E-mail</option>
                  </select>
                  <select
                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                    value={templateForm.has_site === null ? '' : templateForm.has_site ? '1' : '0'}
                    onChange={e => setTemplateForm(p => ({ ...p, has_site: e.target.value === '' ? null : e.target.value === '1' }))}
                  >
                    <option value="">Qualquer (com ou sem site)</option>
                    <option value="1">Apenas leads com site</option>
                    <option value="0">Apenas leads sem site</option>
                  </select>
                </div>
                <textarea
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 resize-none"
                  placeholder={`Corpo da mensagem.\nVariáveis: {nome}, {nicho}, {problema1}, {url}`}
                  value={templateForm.corpo}
                  onChange={e => setTemplateForm(p => ({ ...p, corpo: e.target.value }))}
                />
                {templateForm.corpo && templateForm.canal === 'whatsapp' && (
                  <div className="mt-3">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Preview WhatsApp</p>
                    <div className="bg-[#0b141a] rounded-2xl p-5 min-h-[180px]">
                      <div className="flex justify-end">
                        <div className="max-w-[92%] w-full bg-[#005c4b] text-[#e9edef] rounded-2xl rounded-tr-sm px-5 py-4 text-sm leading-relaxed shadow-md">
                          {templateForm.corpo
                            .replace(/\{nome\}/g, 'João Silva')
                            .replace(/\{nicho\}/g, templateForm.nicho || 'saúde')
                            .replace(/\{problema1\}/g, 'site lento no mobile')
                            .replace(/\{url\}/g, 'empresa.com.br')
                            .split('\n')
                            .map((line, i, arr) => {
                              const formatted = line.replace(/\*([^*]+)\*/g, '<strong>$1</strong>').replace(/_([^_]+)_/g, '<em>$1</em>');
                              return <span key={i} dangerouslySetInnerHTML={{ __html: formatted + (i < arr.length - 1 ? '<br/>' : '') }} />;
                            })}
                          <div className="text-right text-[10px] text-[#8696a0] mt-2">10:42 ✓✓</div>
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1">*negrito* _itálico_ | variáveis preenchidas com exemplo</p>
                  </div>
                )}
                <button
                  disabled={!templateForm.nome || !templateForm.corpo}
                  onClick={async () => {
                    await window.electronAPI.saveMessageTemplate?.({
                      id: templateForm.id || undefined,
                      nome: templateForm.nome,
                      canal: templateForm.canal,
                      nicho: templateForm.nicho || null,
                      has_site: templateForm.has_site,
                      corpo: templateForm.corpo
                    });
                    setTemplateForm({ id: null, nicho: '', canal: 'whatsapp', has_site: null, nome: '', corpo: '' });
                    const res = await window.electronAPI.getMessageTemplates?.();
                    if (res?.success) setMessageTemplates(res.data || []);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-violet-500 text-white font-bold text-sm hover:bg-violet-600 transition-all disabled:opacity-40"
                >
                  {templateForm.id ? 'Atualizar Template' : 'Salvar Template'}
                </button>
              </div>
            </div>
          </div>

          {/* Backup & Restauração */}
          <div className="mt-10 pt-8 border-t border-white/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
                <Database size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Backup & Restauração</h3>
                <p className="text-slate-400 text-sm">Proteja seus leads e restaure em caso de problemas</p>
              </div>
            </div>

            <div className="glass p-5 rounded-2xl border border-white/10">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={async () => {
                    const res = await window.electronAPI.backupDbManual?.();
                    if (res?.success) setAppDialog({ title: 'Backup criado', message: `Arquivo salvo em: ${res.path}`, type: 'success' });
                    else if (res?.error !== 'cancelled') setAppDialog({ title: 'Erro no backup', message: res?.error || 'Falha ao criar backup.', type: 'error' });
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-teal-500/10 border border-teal-500/25 text-teal-300 hover:bg-teal-500/20 font-bold text-sm transition-all"
                >
                  <Download size={16} /> Exportar backup (.db)
                </button>
                <button
                  onClick={async () => {
                    const res = await window.electronAPI.restoreDb?.();
                    if (res?.success) setAppDialog({ title: 'Banco restaurado', message: 'O banco de dados foi restaurado com sucesso. Recarregue o app para ver os dados.', type: 'success' });
                    else if (res?.error !== 'cancelled') setAppDialog({ title: 'Erro ao restaurar', message: res?.error || 'Falha ao restaurar.', type: 'error' });
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 hover:bg-amber-500/20 font-bold text-sm transition-all"
                >
                  <Upload size={16} /> Restaurar backup (.db)
                </button>
                <button
                  onClick={async () => {
                    const res = await window.electronAPI.exportLeadsJson?.();
                    if (res?.success) setAppDialog({ title: 'Exportado', message: `JSON salvo em: ${res.path}`, type: 'success' });
                    else if (res?.error !== 'cancelled') setAppDialog({ title: 'Erro', message: res?.error || 'Falha ao exportar.', type: 'error' });
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/25 text-blue-300 hover:bg-blue-500/20 font-bold text-sm transition-all"
                >
                  <FileText size={16} /> Exportar leads (.json)
                </button>
                <button
                  onClick={async () => {
                    const res = await window.electronAPI.importLeadsJson?.();
                    if (res?.success) setAppDialog({ title: 'Importado', message: `${res.imported || 0} leads importados com sucesso.`, type: 'success' });
                    else if (res?.error !== 'cancelled') setAppDialog({ title: 'Erro', message: res?.error || 'Falha ao importar.', type: 'error' });
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/20 font-bold text-sm transition-all"
                >
                  <Upload size={16} /> Importar leads (.json)
                </button>
              </div>
              <p className="text-slate-600 text-xs mt-4">O backup do banco é salvo automaticamente toda vez que o app é fechado. Use esta seção para copias manuais ou migrações.</p>
            </div>
          </div>

          {/* T30 — Saúde do app */}
          <div className="mt-10 pt-8 border-t border-white/10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Activity size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Saúde do App</h3>
                  <p className="text-slate-400 text-sm">Informações do sistema e uso de recursos</p>
                </div>
              </div>
              <button
                onClick={async () => {
                  const res = await window.electronAPI.getAppHealth?.();
                  if (res?.success) setAppHealth(res.data);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/20 font-bold text-sm transition-all"
              >
                <RefreshCw size={14} /> Verificar
              </button>
            </div>
            {appHealth ? (
              <div className="glass p-5 rounded-2xl border border-white/10 grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Versão', value: appHealth.version },
                  { label: 'Plataforma', value: appHealth.platform },
                  { label: 'Banco de dados', value: `${appHealth.dbSizeKb} KB` },
                  { label: 'Memória heap', value: `${appHealth.heapUsedMb} MB` },
                  { label: 'Uptime', value: `${Math.floor(appHealth.uptime / 60)}m ${appHealth.uptime % 60}s` },
                  { label: 'Último backup auto', value: appHealth.lastBackup || 'Nenhum' },
                ].map(item => (
                  <div key={item.label} className="bg-white/5 rounded-xl p-3">
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">{item.label}</div>
                    <div className="text-white font-semibold text-sm truncate">{item.value}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass p-5 rounded-2xl border border-white/10 text-center text-slate-500 text-sm">
                Clique em "Verificar" para carregar informações do sistema.
              </div>
            )}
          </div>

          {/* T27 — Log de atividades */}
          <div className="mt-10 pt-8 border-t border-white/10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center shrink-0">
                  <History size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Log de Atividades</h3>
                  <p className="text-slate-400 text-sm">Histórico recente de ações no sistema</p>
                </div>
              </div>
              <button
                onClick={async () => {
                  const res = await window.electronAPI.getActivityLog?.(50);
                  if (res?.success) setActivityLog(res.data || []);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/10 border border-violet-500/25 text-violet-300 hover:bg-violet-500/20 font-bold text-sm transition-all"
              >
                <RefreshCw size={14} /> Carregar
              </button>
            </div>
            <div className="glass rounded-2xl border border-white/10 overflow-hidden">
              {activityLog.length === 0 ? (
                <div className="p-5 text-center text-slate-500 text-sm">
                  Clique em "Carregar" para ver as atividades recentes.
                </div>
              ) : (
                <div className="divide-y divide-white/5 max-h-80 overflow-y-auto custom-scrollbar">
                  {activityLog.map(entry => (
                    <div key={entry.id} className="flex items-start gap-3 px-5 py-3 hover:bg-white/5 transition-colors">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded-md uppercase">{entry.tipo}</span>
                          <span className="text-[10px] text-slate-500">{new Date(entry.criado_em).toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="text-sm text-slate-300 mt-1 truncate">{entry.detalhe}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );

  const renderWhatsappComercial = () => {
    const pendingLeads = whatsappCommercialLeads.filter(l => !l.wpp_enviado);
    const sentLeads   = whatsappCommercialLeads.filter(l =>  l.wpp_enviado);
    const filteredWhatsappLeads = whatsappCommercialLeads
      .filter(lead => matchesLeadNameQuery(lead, gridFilters.nameQuery))
      .sort(sortByInsertedAtAsc);
    const queueLeads = filteredWhatsappLeads.slice(0, 8);

    const { active, status, queue, currentIdx, results } = wppPilot;
    const sentCount  = results.filter(r => r.status === 'sent').length;
    const errorCount = results.filter(r => r.status !== 'sent' && r.status !== 'skipped').length;
    const skipCount  = results.filter(r => r.status === 'skipped').length;
    const progress   = queue.length > 0 ? Math.round((results.length / queue.length) * 100) : 0;
    const currentLead = queue[currentIdx] || null;

    const statusMeta = {
      initializing: { label: 'Inicializando…',  color: 'text-amber-300',  bg: 'bg-amber-500/10 border-amber-500/20' },
      'qr-wait':    { label: 'Aguardando login', color: 'text-orange-300', bg: 'bg-orange-500/10 border-orange-500/20' },
      running:      { label: 'Enviando…',        color: 'text-emerald-300',bg: 'bg-emerald-500/10 border-emerald-500/20' },
      paused:       { label: 'Pausado',           color: 'text-slate-300',  bg: 'bg-white/5 border-white/10' },
      done:         { label: 'Concluído',         color: 'text-primary',    bg: 'bg-primary/10 border-primary/20' },
      idle:         { label: 'Aguardando',        color: 'text-slate-400',  bg: 'bg-white/5 border-white/10' },
    };
    const sm = statusMeta[status] || statusMeta.idle;

    const resultIcon = (s) => {
      if (s === 'sent')    return <CircleCheck size={13} className="text-emerald-400 shrink-0" />;
      if (s === 'skipped') return <SkipForward size={13} className="text-slate-500 shrink-0" />;
      return <AlertTriangle size={13} className="text-red-400 shrink-0" />;
    };

    return (
      <div className="p-8 animate-fade-in h-full overflow-y-auto custom-scrollbar bg-surface">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-3 text-emerald-300 text-xs font-black uppercase tracking-widest mb-3">
              <MessageCircle size={16} /> Área Comercial
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">WhatsApp AutoPilot</h1>
            <p className="text-slate-400 mt-2 max-w-3xl">
              Envie mensagens personalizadas para todos os leads validados automaticamente. O sistema abre o WhatsApp Web, preenche e envia um a um enquanto você acompanha.
            </p>
          </div>
          {!active && (
            <button
              type="button"
              onClick={startWppAutoPilot}
              className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-6 py-3 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              <Play size={18} />
              Iniciar Envio Automático
              {pendingLeads.length > 0 && (
                <span className="bg-white/20 text-white text-xs font-black px-2 py-0.5 rounded-full ml-1">
                  {pendingLeads.length}
                </span>
              )}
            </button>
          )}
          {active && (
            <button
              type="button"
              onClick={stopWppPilot}
              className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-bold px-5 py-3 rounded-2xl transition-all flex items-center justify-center gap-2"
            >
              <StopCircle size={18} />
              Encerrar AutoPilot
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="glass rounded-3xl border border-white/10 p-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Pendentes</p>
            <span className="text-3xl font-black text-white">{pendingLeads.length}</span>
          </div>
          <div className="glass rounded-3xl border border-white/10 p-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Enviados</p>
            <span className="text-3xl font-black text-emerald-400">{sentLeads.length}</span>
          </div>
          <div className="glass rounded-3xl border border-white/10 p-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nesta sessão</p>
            <span className="text-3xl font-black text-primary">{sentCount}</span>
          </div>
          <div className="glass rounded-3xl border border-white/10 p-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Total elegíveis</p>
            <span className="text-3xl font-black text-white">{whatsappCommercialLeads.length}</span>
          </div>
        </div>

        {/* AutoPilot Panel */}
        {active ? (
          <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
            {/* Left — status + current lead */}
            <div className="glass rounded-3xl border border-white/10 overflow-hidden">
              {/* Status bar */}
              <div className={`px-6 py-4 border-b border-white/10 flex items-center justify-between gap-4`}>
                <div className="flex items-center gap-3">
                  {(status === 'running' || status === 'initializing') && (
                    <Loader2 size={16} className="animate-spin text-emerald-400" />
                  )}
                  <span className={`text-sm font-bold ${sm.color}`}>{sm.label}</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${sm.bg} ${sm.color}`}>
                    {results.length}/{queue.length} processados
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {status === 'running' && (
                    <button onClick={pauseWppPilot} className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-xl transition-all">
                      <Pause size={13} /> Pausar
                    </button>
                  )}
                  {status === 'paused' && (
                    <button onClick={resumeWppPilot} className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 hover:text-emerald-200 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-3 py-1.5 rounded-xl transition-all">
                      <Play size={13} /> Retomar
                    </button>
                  )}
                  {(status === 'running' || status === 'paused') && (
                    <button onClick={skipWppLead} className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-xl transition-all">
                      <SkipForward size={13} /> Pular
                    </button>
                  )}
                  {status === 'qr-wait' && (
                    <button onClick={resumeWppAfterQr} className="flex items-center gap-1.5 text-xs font-bold text-amber-300 hover:text-amber-200 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl transition-all">
                      <RefreshCw size={13} /> Verificar login
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="px-6 pt-5 pb-2">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span>{progress}% concluído</span>
                  <span className="flex items-center gap-3">
                    <span className="text-emerald-400">{sentCount} enviados</span>
                    {errorCount > 0 && <span className="text-red-400">{errorCount} erros</span>}
                    {skipCount  > 0 && <span className="text-slate-500">{skipCount} pulados</span>}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-primary transition-all duration-700"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Current lead */}
              {status === 'qr-wait' ? (
                <div className="p-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-300 flex items-center justify-center mx-auto mb-4">
                    <Smartphone size={26} />
                  </div>
                  <p className="text-white font-bold text-lg">Login necessário</p>
                  <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
                    Escaneie o QR Code na janela do WhatsApp Web que foi aberta. Após logar, clique em <strong className="text-amber-300">Verificar login</strong> para continuar o envio automático.
                  </p>
                </div>
              ) : status === 'done' ? (
                <div className="p-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto mb-4">
                    <ListChecks size={26} />
                  </div>
                  <p className="text-white font-bold text-lg">Envio concluído!</p>
                  <p className="text-slate-400 text-sm mt-2">
                    <span className="text-emerald-400 font-bold">{sentCount}</span> mensagens enviadas,{' '}
                    {skipCount > 0 && <><span className="text-slate-400 font-bold">{skipCount}</span> puladas, </>}
                    {errorCount > 0 && <><span className="text-red-400 font-bold">{errorCount}</span> com erro</>}
                  </p>
                  <button onClick={stopWppPilot} className="mt-5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold px-5 py-2.5 rounded-xl transition-all text-sm">
                    Fechar AutoPilot
                  </button>
                </div>
              ) : currentLead ? (
                <div className="p-6">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Enviando agora</p>
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-300 flex items-center justify-center text-lg font-black shrink-0">
                        {(getLeadName(currentLead) || '?')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-bold truncate">{getLeadName(currentLead)}</p>
                        <p className="text-slate-400 text-xs mt-0.5 font-mono">{currentLead.telefone}</p>
                        {currentLead.url && (
                          <p className="text-slate-500 text-xs mt-1 truncate">{currentLead.url}</p>
                        )}
                      </div>
                      {(status === 'running' || status === 'initializing') && (
                        <Loader2 size={18} className="animate-spin text-emerald-400 shrink-0 mt-1" />
                      )}
                    </div>
                    <div className="mt-4 bg-black/20 rounded-xl p-3">
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1.5">Mensagem</p>
                      <p className="text-slate-300 text-xs leading-relaxed line-clamp-4">
                        {applyWppTemplate(pickWppTemplate(currentLead), currentLead)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-slate-500">
                  <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                  <p className="text-sm">Preparando…</p>
                </div>
              )}
            </div>

            {/* Right — queue + results */}
            <div className="glass rounded-3xl border border-white/10 overflow-hidden flex flex-col">
              <div className="p-5 border-b border-white/10">
                <h3 className="text-base font-bold text-white">Fila de envio</h3>
                <p className="text-xs text-slate-500 mt-0.5">{queue.length} leads nesta sessão</p>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-white/5 max-h-[520px]">
                {queue.map((lead, idx) => {
                  const res = results.find(r => r.lead.id === lead.id && r.lead._typeCode === lead._typeCode);
                  const isCurrent = idx === currentIdx && !res;
                  return (
                    <div
                      key={`${lead._typeCode}-${lead.id}`}
                      className={`px-5 py-3 flex items-center gap-3 transition-colors ${isCurrent ? 'bg-emerald-500/5 border-l-2 border-emerald-400' : 'border-l-2 border-transparent'}`}
                    >
                      <div className="shrink-0">
                        {res ? resultIcon(res.status) : isCurrent ? (
                          <Loader2 size={13} className="animate-spin text-emerald-400" />
                        ) : (
                          <div className="w-3 h-3 rounded-full bg-white/10" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold truncate ${isCurrent ? 'text-white' : res ? 'text-slate-400' : 'text-slate-300'}`}>
                          {getLeadName(lead)}
                        </p>
                        <p className="text-slate-600 text-[11px] font-mono truncate">{lead.telefone}</p>
                      </div>
                      {res && (
                        <span className={`text-[10px] font-bold uppercase tracking-wide shrink-0 ${
                          res.status === 'sent'    ? 'text-emerald-400' :
                          res.status === 'skipped' ? 'text-slate-500' : 'text-red-400'
                        }`}>
                          {res.status === 'sent' ? 'enviado' : res.status === 'skipped' ? 'pulado' : res.status}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* ── Visão padrão (sem pilot ativo) ── */
          <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-6">
            <div className="glass rounded-3xl border border-white/10 overflow-hidden">
              <div className="p-6 border-b border-white/10 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Fila comercial</h2>
                  <p className="text-sm text-slate-400 mt-1">Leads validados com WhatsApp ordenados por inserção.</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {renderNameFilterInput('Filtrar por nome')}
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold">
                    {pendingLeads.length} pendentes
                  </span>
                </div>
              </div>
              <div className="divide-y divide-white/5">
                {queueLeads.length > 0 ? queueLeads.map(lead => (
                  <div key={`${lead._typeCode}-${lead.id}`} className="p-5 flex items-center justify-between gap-4 hover:bg-white/[0.03] transition-colors">
                    <div className="min-w-0">
                      <p className="text-white font-bold truncate">{getLeadName(lead)}</p>
                      <p className="text-slate-400 text-xs mt-1 font-mono">{lead.telefone}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {lead.wpp_enviado ? (
                        <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[11px] font-bold">
                          Enviado
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
                    <p className="text-white font-bold">Nenhum lead validado com WhatsApp</p>
                    <p className="text-slate-400 text-sm mt-2">Valide leads com telefone no Lead Hunter para alimentar esta central.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="glass rounded-3xl border border-white/10 p-6 flex flex-col">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Bot size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Como funciona</h2>
                  <p className="text-sm text-slate-400 mt-1">O AutoPilot envia mensagens personalizadas para cada lead em sequência.</p>
                </div>
              </div>
              <ol className="space-y-4 flex-1">
                {[
                  { n: '1', title: 'Clique em Iniciar', desc: 'O WhatsApp Web abre em uma janela separada. Se necessário, escaneie o QR Code uma única vez.' },
                  { n: '2', title: 'Envio automático', desc: 'Para cada lead com WhatsApp, o sistema navega para a conversa, preenche a mensagem personalizada e clica em Enviar.' },
                  { n: '3', title: 'Acompanhe ao vivo', desc: 'Veja o status em tempo real — enviado, pulado ou erro. Pode pausar, pular ou parar a qualquer momento.' },
                ].map(step => (
                  <li key={step.n} className="flex gap-4">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                      {step.n}
                    </div>
                    <div>
                      <p className="text-white text-sm font-bold">{step.title}</p>
                      <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">{step.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                onClick={startWppAutoPilot}
                disabled={pendingLeads.length === 0}
                className="mt-6 w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/5 disabled:border disabled:border-white/10 disabled:text-slate-600 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                <Play size={18} />
                {pendingLeads.length === 0 ? 'Sem leads pendentes' : `Iniciar AutoPilot — ${pendingLeads.length} leads`}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const filterLead = (lead) => {
    if (!matchesLeadNameQuery(lead, gridFilters.nameQuery)) return false;
    
    if (gridFilters.source !== 'todos') {
      const isPlayStoreOnly = lead.tipo_origem === 'play_store' && !lead.developer_site;
      const hasSite = !!(lead.site_oficial || lead.developer_site || (!isMapsUrl(lead.url) && lead.url)) && !isPlayStoreOnly;
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

  const renderNameFilterInput = (placeholder = 'Filtrar por nome') => (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-dark/40 border border-white/5 min-w-[220px]">
      <Search size={14} className="text-slate-500 shrink-0" />
      <input
        type="search"
        value={gridFilters.nameQuery}
        onChange={(e) => setGridFilters({ ...gridFilters, nameQuery: e.target.value })}
        placeholder={placeholder}
        className="bg-transparent text-xs font-semibold text-slate-300 placeholder:text-slate-600 focus:outline-none w-full"
      />
      {gridFilters.nameQuery && (
        <button
          type="button"
          onClick={() => setGridFilters({ ...gridFilters, nameQuery: '' })}
          className="text-slate-500 hover:text-white transition-colors"
          title="Limpar filtro por nome"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );

  const renderSystemAppsGrid = (list) => {
    let filteredList = list
      .filter(filterLead)
      .sort(sortByInsertedAtAsc);
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
          {renderNameFilterInput('Filtrar sistema ou app')}
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
          {(gridFilters.nameQuery || gridFilters.source !== 'todos' || gridFilters.hasEmail || gridSort.col) && (
            <button
              onClick={() => { setGridFilters(DEFAULT_GRID_FILTERS); setGridSort({ col: null, dir: null }); }}
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

  const renderCrmDashboard = () => {
    const queue = validatedLeadsGrid
      .map(lead => ({ ...lead, _typeCode: lead._typeCode || 'sites' }))
      .filter(lead => matchesLeadNameQuery(lead, gridFilters.nameQuery))
      .sort(sortByInsertedAtAsc);
    const due = queue.filter(isFollowupDue).length;
    const contacted = queue.filter(lead => lead.email_enviado || lead.wpp_enviado).length;
    const responded = queue.filter(lead => lead.respondeu_email || lead.retorno_wpp).length;

    return (
      <div className="animate-fade-in space-y-5">
        <header className="flex flex-col xl:flex-row xl:items-start justify-between gap-5">
          <div>
            <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-[0.13em] mb-2">Comercial</p>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">CRM Operacional</h1>
            <p className="text-slate-400 text-sm mt-2 max-w-3xl">Acompanhe leads validados, follow-ups, status do funil e próximas ações em uma fila única.</p>
          </div>
          <button onClick={() => openOperationalQueue('followups')} className="premium-btn primary">
            <Clock size={16} /> Ver follow-ups
          </button>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            ['Leads no CRM', queue.length, <Users size={18} />, 'primary'],
            ['Follow-ups', due, <Clock size={18} />, due > 0 ? 'danger' : 'success'],
            ['Abordados', contacted, <Send size={18} />, 'warning'],
            ['Responderam', responded, <MessageCircle size={18} />, 'success']
          ].map(([label, value, icon, color]) => (
            <article key={label} className="premium-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-400 uppercase">{label}</span>
                <span className={`premium-badge ${color}`}>{icon}</span>
              </div>
              <strong className="block text-4xl text-white mt-4 leading-none">{value}</strong>
            </article>
          ))}
        </section>

        <section className="premium-panel p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-xl font-extrabold">Fila Comercial</h2>
              <p className="text-slate-400 text-sm mt-1">Ordenada por data e hora de inserção, do mais antigo ao mais recente.</p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {renderNameFilterInput('Filtrar lead no CRM')}
              <span className="premium-badge success">Score alto</span>
              <span className="premium-badge primary">Contato pronto</span>
              <span className="premium-badge danger">Follow-up vencido</span>
            </div>
          </div>

          {queue.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-600/50 bg-surface-hover/40 py-14 px-6 text-center">
              <h4 className="text-white font-bold text-lg mb-1">Nenhum lead validado no CRM.</h4>
              <p className="text-slate-400 text-sm max-w-sm mx-auto">Valide leads capturados para montar sua rotina comercial.</p>
              <button onClick={() => setActiveMenu('sites')} className="premium-btn primary mt-6">Abrir banco de sites</button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="bg-surface-hover/80 text-[11px] uppercase tracking-[0.08em] text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Lead</th>
                    <th className="px-5 py-4">Score</th>
                    <th className="px-5 py-4">Funil</th>
                    <th className="px-5 py-4">Follow-up</th>
                    <th className="px-5 py-4">Contato</th>
                    <th className="px-5 py-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {queue.slice(0, 30).map(lead => {
                    const typeCode = lead._typeCode || 'sites';
                    const followup = getFollowupStatus(lead);
                    const score = getCommercialScore(lead, typeCode);
                    return (
                      <tr key={`${typeCode}-${lead.id}`} className="hover:bg-surface-hover/50 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-bold text-white">{getLeadName(lead)}</p>
                          <p className="text-xs text-slate-500 mt-1">{getLeadCategory(lead, typeCode)}</p>
                        </td>
                        <td className="px-5 py-4"><span className={`premium-badge ${score >= 78 ? 'success' : 'primary'}`}>{score}/100</span></td>
                        <td className="px-5 py-4"><span className="premium-badge accent">{FUNIL_STAGES.find(stage => stage.value === lead.funil_status)?.label || 'Novo'}</span></td>
                        <td className="px-5 py-4"><span className={`premium-badge ${followup.state === 'overdue' || followup.state === 'today' ? 'danger' : 'primary'}`}>{followup.label}</span></td>
                        <td className="px-5 py-4 text-slate-400 text-xs">{lead.email || lead.telefone || 'Contato pendente'}</td>
                        <td className="px-5 py-4 text-right">
                          <button onClick={() => openCrmModal(lead, typeCode)} className="premium-btn">Abrir CRM</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    );
  };

  const renderPropostasDashboard = () => {
    const proposals = validatedLeadsGrid
      .map(lead => ({ ...lead, _typeCode: lead._typeCode || 'sites' }))
      .filter(lead => lead.is_validated || hasGeneratedLayout(lead) || getCommercialScore(lead, lead._typeCode) >= 70)
      .filter(lead => matchesLeadNameQuery(lead, gridFilters.nameQuery))
      .sort(sortByInsertedAtAsc);
    const ready = proposals.filter(hasGeneratedLayout).length;
    const pending = Math.max(proposals.length - ready, 0);

    return (
      <div className="animate-fade-in space-y-5">
        <header className="flex flex-col xl:flex-row xl:items-start justify-between gap-5">
          <div>
            <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-[0.13em] mb-2">Propostas</p>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">Propostas Visuais</h1>
            <p className="text-slate-400 text-sm mt-2 max-w-3xl">Gere, abra e use layouts/protótipos como apoio para abordagens comerciais.</p>
          </div>
          <button onClick={() => setActiveMenu('validados')} className="premium-btn">
            <CheckCircle size={16} /> Leads validados
          </button>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <article className="premium-card p-5">
            <span className="text-xs font-extrabold text-slate-400 uppercase">Elegíveis</span>
            <strong className="block text-4xl text-white mt-4 leading-none">{proposals.length}</strong>
          </article>
          <article className="premium-card p-5">
            <span className="text-xs font-extrabold text-slate-400 uppercase">Prontas</span>
            <strong className="block text-4xl text-white mt-4 leading-none">{ready}</strong>
          </article>
          <article className="premium-card p-5">
            <span className="text-xs font-extrabold text-slate-400 uppercase">Pendentes</span>
            <strong className="block text-4xl text-white mt-4 leading-none">{pending}</strong>
          </article>
        </section>

        <section className="premium-panel p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-xl font-extrabold">Pipeline de propostas</h2>
              <p className="text-slate-400 text-sm mt-1">Filtre por nome e acompanhe os leads em ordem crescente de inserção.</p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {renderNameFilterInput('Filtrar proposta por nome')}
              <span className="premium-badge warning"><Rocket size={14} /> Pronto para demonstração</span>
            </div>
          </div>

          {proposals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-600/50 bg-surface-hover/40 py-14 px-6 text-center">
              <h4 className="text-white font-bold text-lg mb-1">Nenhuma proposta elegível ainda.</h4>
              <p className="text-slate-400 text-sm max-w-sm mx-auto">Valide leads ou gere layouts para alimentar esta fila.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {proposals.slice(0, 24).map(lead => {
                const typeCode = lead._typeCode || 'sites';
                const readyLayout = hasGeneratedLayout(lead);
                return (
                  <article key={`${typeCode}-${lead.id}`} className="premium-card p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="text-white font-extrabold truncate">{getLeadName(lead)}</h3>
                        <p className="text-xs text-slate-500 mt-1 truncate">{lead.url || lead.website || lead.email || 'Lead validado'}</p>
                      </div>
                      <span className={`premium-badge ${readyLayout ? 'success' : 'warning'}`}>{readyLayout ? 'Pronta' : 'Pendente'}</span>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <span className="premium-badge primary">Score {getCommercialScore(lead, typeCode)}/100</span>
                      <span className="premium-badge">{getLeadCategory(lead, typeCode)}</span>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-3">
                      {readyLayout ? (
                        <>
                          <button onClick={() => openLeadLayoutAsset(lead, 'preview')} className="premium-btn primary">Abrir preview</button>
                          <button onClick={() => openLeadLayoutAsset(lead, 'folder')} className="premium-btn">Abrir pasta</button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleGenerateLayout(lead, typeCode)}
                          disabled={layoutGeneratingLeadId === lead.id}
                          className="premium-btn primary disabled:opacity-60"
                        >
                          <LayoutTemplate size={16} /> {layoutGeneratingLeadId === lead.id ? 'Gerando...' : 'Gerar proposta'}
                        </button>
                      )}
                      <button onClick={() => openCrmModal(lead, typeCode)} className="premium-btn">CRM</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    );
  };

  const renderLeadsGrid = (list, typeTitle, typeCode) => {
    if (typeCode === 'sistema') return renderSystemAppsGrid(list);
    // Aplicar filtros avançados
    let filteredList = list.filter(filterLead);

    if (gridSort.col === 'nome') {
      filteredList = [...filteredList].sort((a, b) => {
        const na = (a.nome || a.titulo || a.url || '').toLowerCase();
        const nb = (b.nome || b.titulo || b.url || '').toLowerCase();
        return gridSort.dir === 'asc' ? na.localeCompare(nb, 'pt-BR') : nb.localeCompare(na, 'pt-BR');
      });
    } else if (gridSort.col === 'oportunidade') {
      filteredList = [...filteredList].sort((a, b) => {
        const sa = getCommercialScore(a, a._typeCode || typeCode) || 0;
        const sb = getCommercialScore(b, b._typeCode || typeCode) || 0;
        return gridSort.dir === 'asc' ? sa - sb : sb - sa;
      });
    } else {
      filteredList = filteredList.sort(sortByInsertedAtAsc);
    }

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
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold text-white">{typeTitle}</h2>
            <button
              onClick={() => setIsCompact(p => !p)}
              title={isCompact ? 'Modo confortável' : 'Modo compacto'}
              className={`p-2 rounded-xl border transition-all text-xs font-bold ${isCompact ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-white/5 border-white/10 text-slate-500 hover:bg-white/10'}`}
            >
              {isCompact ? '≡' : '⊟'}
            </button>
          </div>
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
            <button
              onClick={async () => {
                const list = selectedCount > 0 ? selectedInGrid : filteredList;
                const tc = typeCode || (list[0]?._typeCode);
                const rows = list.map(l => {
                  const base = {
                    nome: l.nome || l.titulo || '',
                    url: l.url || l.site_oficial || '',
                    email: l.email || l.developer_email || '',
                    telefone: l.telefone || '',
                    localizacao: l.localizacao || '',
                    nicho: l.nicho || l.categoria || l.app_category || '',
                    funil_status: l.funil_status || 'novo',
                    proximo_passo: l.proximo_passo || '',
                    followup_date: l.followup_date || '',
                    email_enviado: l.email_enviado ? 'Sim' : 'Não',
                    wpp_enviado: l.wpp_enviado ? 'Sim' : 'Não',
                    respondeu_email: l.respondeu_email ? 'Sim' : 'Não',
                    validado: l.is_validated ? 'Sim' : 'Não',
                    data_coleta: l.data_coleta || '',
                  };
                  if (tc === 'sites') {
                    return { ...base, descricao: l.descricao || '', maps_url: l.maps_url || '', score_design: l.score_design ?? '', site_status: l.site_status || '' };
                  }
                  if (tc === 'sistema') {
                    return { ...base, descricao: l.descricao || '', developer_name: l.developer_name || '', developer_site: l.developer_site || '', app_category: l.app_category || '', rating: l.rating || '', reviews_count: l.reviews_count || '', installs: l.installs || '', tipo_origem: l.tipo_origem || '', score_ux: l.score_ux ?? '' };
                  }
                  if (tc === 'linkedin') {
                    return { nome: l.nome || '', url: l.url || '', cargo: l.cargo || '', empresa: l.empresa || '', localizacao: l.localizacao || '', nicho: l.nicho || '', email: l.email || '', email_enviado: l.email_enviado ? 'Sim' : 'Não', wpp_enviado: l.wpp_enviado ? 'Sim' : 'Não', respondeu_email: l.respondeu_email ? 'Sim' : 'Não', validado: l.is_validated ? 'Sim' : 'Não', data_coleta: l.data_coleta || '' };
                  }
                  return base;
                });
                const res = await window.electronAPI.exportLeadsCsv?.(rows, `leads_${typeCode}_${new Date().toISOString().slice(0,10)}.csv`);
                if (res?.success) showToast('CSV exportado com sucesso');
                else if (res?.error !== 'cancelled') showToast('Erro ao exportar CSV', 'error');
              }}
              disabled={filteredList.length === 0}
              className="bg-teal-500/20 text-teal-300 border border-teal-500/45 hover:bg-teal-500 hover:text-white px-5 py-2.5 rounded-xl transition-all font-semibold text-sm flex items-center gap-2 disabled:opacity-50"
              title="Exportar para CSV"
            >
              <FileText size={16} /> CSV
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
                onClick={() => startWppAutoPilotWithLeads(selectedInGrid)}
                disabled={wppPilot.active || bulkProgress !== null}
                className="px-4 py-2 rounded-xl bg-[#25d366]/15 border border-[#25d366]/40 text-[#25d366] hover:bg-[#25d366] hover:text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
                title="Iniciar envio automático via WhatsApp para os selecionados"
              >
                <MessageCircle size={14} /> Disparar WhatsApp
              </button>
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
                onClick={() => handleBulkDeleteSelected(selectedInGrid, typeCode)}
                disabled={bulkProgress !== null}
                className="px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/35 text-red-300 hover:bg-red-500 hover:text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
                title="Excluir os leads selecionados deste grid"
              >
                <Trash2 size={14} /> Excluir selecionados
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
          {renderNameFilterInput('Filtrar por nome')}
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

          {(gridFilters.nameQuery || gridFilters.source !== 'todos' || gridFilters.date !== 'todos' || gridFilters.hasEmail || gridFilters.hasWpp || gridFilters.wppSent || gridFilters.followupDue || wppFilter || gridSort.col) && (
            <button
              onClick={() => {
                setGridFilters(DEFAULT_GRID_FILTERS);
                setWppFilter(false);
                setGridSort({ col: null, dir: null });
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
                <th
                  className="px-6 py-5 sticky top-0 z-30 bg-[#141c2f] shadow-[0_1px_0_rgba(255,255,255,0.08),0_10px_24px_rgba(2,6,23,0.28)] cursor-pointer select-none hover:text-white transition-colors"
                  onClick={() => cycleSort('nome')}
                  title="Ordenar por nome"
                >
                  <span className="flex items-center gap-1.5">
                    Nome / URL
                    {gridSort.col === 'nome' && gridSort.dir === 'asc' && <ChevronUp size={12} className="text-primary" />}
                    {gridSort.col === 'nome' && gridSort.dir === 'desc' && <ChevronDown size={12} className="text-primary" />}
                    {gridSort.col !== 'nome' && <ChevronsUpDown size={12} className="opacity-30" />}
                  </span>
                </th>
                <th className="px-6 py-5 sticky top-0 z-30 bg-[#141c2f] shadow-[0_1px_0_rgba(255,255,255,0.08),0_10px_24px_rgba(2,6,23,0.28)]">Contato</th>
                <th
                  className="px-6 py-5 sticky top-0 z-30 bg-[#141c2f] shadow-[0_1px_0_rgba(255,255,255,0.08),0_10px_24px_rgba(2,6,23,0.28)] cursor-pointer select-none hover:text-white transition-colors"
                  onClick={() => cycleSort('oportunidade')}
                  title="Ordenar por score de oportunidade"
                >
                  <span className="flex items-center gap-1.5">
                    Oportunidade
                    {gridSort.col === 'oportunidade' && gridSort.dir === 'asc' && <ChevronUp size={12} className="text-primary" />}
                    {gridSort.col === 'oportunidade' && gridSort.dir === 'desc' && <ChevronDown size={12} className="text-primary" />}
                    {gridSort.col !== 'oportunidade' && <ChevronsUpDown size={12} className="opacity-30" />}
                  </span>
                </th>
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
                            setGridFilters(DEFAULT_GRID_FILTERS);
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
                    <td className={`px-6 ${isCompact ? 'py-2' : 'py-4'}`}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleLeadSelection(lead, rowTypeCode)}
                        className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-600 bg-surface"
                        title="Selecionar lead"
                      />
                    </td>
                    <td className={`px-6 ${isCompact ? 'py-2' : 'py-4'}`}>
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
                      {(lead.site_oficial || (!isMapsUrl(lead.url) && lead.url)) && (
                        <a href={(() => { const u = lead.site_oficial || lead.url; return u.startsWith('http') ? u : `https://${u}`; })()} target="_blank" rel="noreferrer" className="text-primary hover:underline text-[10px] flex items-center gap-1 mt-1 ml-9 opacity-70"><ExternalLink size={10}/> {lead.tipo_origem === 'play_store' && !lead.developer_site ? 'Abrir Play Store' : 'Abrir Site'}</a>
                      )}
                      {!lead.site_oficial && isMapsUrl(lead.url) && lead.url && (
                        <a href={lead.url} target="_blank" rel="noreferrer" className="text-slate-500 hover:underline text-[10px] flex items-center gap-1 mt-1 ml-9 opacity-60"><ExternalLink size={10}/> Abrir no Maps</a>
                      )}
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
                    <td className={`px-6 ${isCompact ? 'py-2' : 'py-4'}`}>
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
                    <td className={`px-6 ${isCompact ? 'py-2' : 'py-4'}`}>
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
                    <td className={`px-6 ${isCompact ? 'py-2' : 'py-4'}`}>
                      <div className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${nextAction.color}`}>
                        {nextAction.icon}
                        {nextAction.label}
                      </div>
                    </td>
                    <td className={`px-6 ${isCompact ? 'py-2' : 'py-4'}`}>
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
                    <td className={`px-6 ${isCompact ? 'py-2' : 'py-4'} text-right`}>
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
    const leadKey = `${detailTypeCode}-${lead.id}`;
    const rawScore = getCommercialScore(lead, detailTypeCode);
    const commercialScore = scoreOverrides[leadKey] ?? rawScore;
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
                  {!lead.nicho && lead.app_category && (() => {
                    const NICHO_MAP = {
                      dental: 'saúde', odonto: 'saúde', health: 'saúde', saude: 'saúde', clinica: 'saúde', medico: 'saúde',
                      advocacia: 'juridico', advogado: 'juridico', juridico: 'juridico', law: 'juridico',
                      academia: 'fitness', fitness: 'fitness', gym: 'fitness',
                      restaurant: 'restaurante', comida: 'restaurante', food: 'restaurante',
                      beleza: 'beleza', hair: 'beleza', nail: 'beleza', estetica: 'beleza',
                      contabil: 'contabilidade', contador: 'contabilidade', accounting: 'contabilidade',
                    };
                    const cat = (lead.app_category || '').toLowerCase();
                    const inferred = Object.entries(NICHO_MAP).find(([k]) => cat.includes(k))?.[1];
                    if (!inferred) return null;
                    return (
                      <button
                        onClick={async () => {
                          const table = detailTypeCode === 'sites' ? 'leads_sites' : 'leads_sistemas';
                          await window.electronAPI.updateLeadSite?.(lead.id, { nicho: inferred });
                          showToast(`Nicho "${inferred}" aplicado`, 'success', 2000);
                        }}
                        className="text-[10px] text-amber-300 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg hover:bg-amber-500/20 transition-all"
                      >
                        Detectado: {inferred} — aplicar
                      </button>
                    );
                  })()}
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

              {/* T13 — Score override + T14 — Ticket value */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Score ajustado</span>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number" min="0" max="100"
                      placeholder={String(rawScore)}
                      value={scoreOverrides[leadKey] ?? ''}
                      onChange={e => {
                        const v = e.target.value === '' ? undefined : Number(e.target.value);
                        setScoreOverrides(p => ({ ...p, [leadKey]: v }));
                      }}
                      className="flex-1 bg-dark/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 w-full"
                    />
                    <button
                      onClick={async () => {
                        const v = scoreOverrides[leadKey];
                        const table = detailTypeCode === 'sistema' ? 'leads_sistemas' : 'leads_sites';
                        await window.electronAPI.saveScoreOverride?.(table, lead.id, v ?? null);
                        showToast(v != null ? `Score ajustado para ${v}` : 'Score restaurado');
                      }}
                      className="px-3 py-2 rounded-xl bg-primary/20 text-primary hover:bg-primary hover:text-white text-xs font-bold transition-all"
                    >Salvar</button>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Valor estimado do contrato</span>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number" min="0" step="100"
                      placeholder="R$ 0"
                      value={ticketValues[leadKey] ?? (lead.ticket_value || '')}
                      onChange={e => setTicketValues(p => ({ ...p, [leadKey]: e.target.value === '' ? undefined : Number(e.target.value) }))}
                      className="flex-1 bg-dark/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 w-full"
                    />
                    <button
                      onClick={async () => {
                        const v = ticketValues[leadKey];
                        const table = detailTypeCode === 'sistema' ? 'leads_sistemas' : 'leads_sites';
                        await window.electronAPI.saveTicketValue?.(table, lead.id, v ?? null);
                        showToast('Valor salvo');
                      }}
                      className="px-3 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-white text-xs font-bold transition-all"
                    >Salvar</button>
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

              {getLeadUrl(lead) && (
                <div className="pt-2">
                  <button
                    onClick={() => handleAnalyzeProblems(lead, detailTypeCode)}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-red-500/10 border border-red-500/25 text-red-300 hover:bg-red-500/20 hover:border-red-500/40 font-bold text-sm transition-all"
                  >
                    <AlertTriangle size={16} />
                    Diagnóstico de Problemas do Site
                  </button>
                </div>
              )}
              <div className="pt-1">
                <button
                  onClick={async () => {
                    const res = await window.electronAPI.searchLinkedinForLead?.(lead, detailTypeCode);
                    if (res?.success && res.results?.length > 0) {
                      setAppDialog({
                        title: 'Decisores encontrados no LinkedIn',
                        message: res.results.map(r => `• ${r.nome || r.name} — ${r.cargo || r.headline || ''}`).join('\n'),
                        type: 'info'
                      });
                    } else {
                      setAppDialog({ title: 'Busca LinkedIn', message: res?.error || 'Nenhum decisor encontrado para este lead.', type: 'info' });
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/25 text-blue-300 hover:bg-blue-500/20 hover:border-blue-500/40 font-bold text-sm transition-all"
                >
                  <Linkedin size={16} />
                  Buscar Decisor no LinkedIn
                </button>
              </div>

              {/* T18 — PageSpeed inline */}
              {getLeadUrl(lead) && (
                <div className="pt-1">
                  {pageSpeedData[getLeadUrl(lead)] ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">PageSpeed API (mobile)</span>
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        {[
                          { label: 'Performance', val: pageSpeedData[getLeadUrl(lead)].performance },
                          { label: 'SEO', val: pageSpeedData[getLeadUrl(lead)].seo },
                          { label: 'Acessibilidade', val: pageSpeedData[getLeadUrl(lead)].accessibility },
                          { label: 'Boas práticas', val: pageSpeedData[getLeadUrl(lead)].bestPractices },
                        ].map(m => (
                          <div key={m.label}>
                            <p className="text-xs text-slate-500">{m.label}</p>
                            <p className={`text-lg font-black ${m.val >= 70 ? 'text-emerald-400' : m.val >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{m.val}</p>
                          </div>
                        ))}
                      </div>
                      {pageSpeedData[getLeadUrl(lead)].lcp && <p className="text-xs text-slate-600 mt-2">LCP: {pageSpeedData[getLeadUrl(lead)].lcp} · CLS: {pageSpeedData[getLeadUrl(lead)].cls}</p>}
                    </div>
                  ) : (
                    <button
                      onClick={async () => {
                        const url = getLeadUrl(lead);
                        const res = await window.electronAPI.pagespeedCheck?.(url);
                        if (res?.success) setPageSpeedData(p => ({ ...p, [url]: res }));
                        else showToast(res?.error || 'Falha ao consultar PageSpeed', 'error');
                      }}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 hover:bg-indigo-500/20 font-bold text-sm transition-all"
                    >
                      <Activity size={16} /> Consultar PageSpeed Google (mobile)
                    </button>
                  )}
                </div>
              )}

              {/* T07 — Histórico de e-mails */}
              {(() => {
                const hist = emailHistory.filter(h => h.lead_id === lead.id && h.lead_tipo === (detailTypeCode === 'sites' ? 'sites' : 'sistema'));
                if (hist.length === 0) return null;
                return (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Histórico de e-mails ({hist.length})</span>
                    <div className="mt-3 space-y-2">
                      {hist.slice(0, 5).map(h => (
                        <div key={h.id} className="flex items-start gap-2 text-xs text-slate-400">
                          <Mail size={12} className="shrink-0 mt-0.5 text-slate-500" />
                          <div className="min-w-0">
                            <p className="text-white font-semibold truncate">{h.subject || 'Sem assunto'}</p>
                            <p className="truncate">{h.to_email} · {new Date(h.sent_at).toLocaleString('pt-BR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderProblemsModal = () => {
    if (!problemsModal) return null;
    const { lead, problems, loading, score } = problemsModal;
    const companyName = lead.nome || lead.titulo || lead.empresa || 'este lead';
    const transformed = (problems || []).map(transformProblemForSales);

    const iconFor = (type) => {
      if (type === 'perf') return <Activity size={16} />;
      if (type === 'seo') return <Globe size={16} />;
      if (type === 'mobile') return <Smartphone size={16} />;
      return <Target size={16} />;
    };
    const colorFor = (type) => {
      if (type === 'perf') return { bg: 'bg-orange-500/10', border: 'border-orange-500/20', icon: 'bg-orange-500/15 text-orange-300', label: 'text-orange-200' };
      if (type === 'seo') return { bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: 'bg-blue-500/15 text-blue-300', label: 'text-blue-200' };
      if (type === 'mobile') return { bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: 'bg-purple-500/15 text-purple-300', label: 'text-purple-200' };
      return { bg: 'bg-red-500/10', border: 'border-red-500/20', icon: 'bg-red-500/15 text-red-300', label: 'text-red-200' };
    };

    const scoreColor = score == null ? '' : score <= 40 ? 'text-red-400' : score <= 65 ? 'text-amber-400' : 'text-emerald-400';
    const scoreLabel = score == null ? '' : score <= 40 ? 'Crítico' : score <= 65 ? 'Precisa de atenção' : 'Razoável';

    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-dark/80 backdrop-blur-sm animate-fade-in" onClick={() => setProblemsModal(null)}>
        <div
          className="bg-[#0f172a] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col scale-in"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-7 py-6 border-b border-white/10 shrink-0">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 rounded-xl bg-red-500/10 text-red-400">
                  <AlertTriangle size={20} />
                </div>
                <h3 className="text-white font-bold text-lg">Diagnóstico do Site</h3>
              </div>
              <p className="text-slate-500 text-xs mt-1">
                Problemas identificados em <span className="text-slate-300 font-semibold">{companyName}</span> com impacto direto na geração de contatos.
              </p>
            </div>
            <button onClick={() => setProblemsModal(null)} className="p-2 rounded-xl hover:bg-white/10 text-slate-400 transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-7 py-6 flex flex-col gap-5 custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-4 py-16 text-slate-400">
                <Loader2 size={32} className="animate-spin text-primary" />
                <p className="text-sm font-medium">Analisando o site com Puppeteer...</p>
                <p className="text-xs text-slate-600">Isso pode levar até 30 segundos</p>
              </div>
            ) : (
              <>
                {score != null && (
                  <div className="flex items-center gap-4 bg-white/[0.04] border border-white/10 rounded-2xl p-4">
                    <div className="text-center min-w-[64px]">
                      <p className={`text-4xl font-black ${scoreColor}`}>{score}</p>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 ${scoreColor}`}>{scoreLabel}</p>
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">Score técnico do site</p>
                      <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                        Pontuação calculada com base em Performance, SEO, UX e Mobile. Quanto menor, maior a oportunidade de venda.
                      </p>
                    </div>
                    <TrendingDown size={28} className={`ml-auto shrink-0 ${scoreColor}`} />
                  </div>
                )}

                {transformed.length === 0 && (
                  <div className="text-center py-10 text-slate-500">
                    <CheckCircle size={32} className="mx-auto mb-3 text-emerald-500" />
                    <p className="font-semibold text-white">Nenhum problema crítico encontrado</p>
                    <p className="text-xs mt-1">O site passou nos principais critérios técnicos.</p>
                  </div>
                )}

                {transformed.map((p, i) => {
                  const c = colorFor(p.icon);
                  return (
                    <div key={i} className={`rounded-2xl border ${c.bg} ${c.border} p-5`}>
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-xl shrink-0 ${c.icon}`}>
                          {iconFor(p.icon)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-bold text-sm leading-snug ${c.label}`}>{p.impact}</p>
                          <p className="text-slate-400 text-xs mt-2 leading-relaxed">{p.detail}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {transformed.length > 0 && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 mt-2">
                    <p className="text-emerald-300 font-bold text-sm mb-1">
                      {transformed.length} problema{transformed.length > 1 ? 's' : ''} identificado{transformed.length > 1 ? 's' : ''}
                    </p>
                    <p className="text-slate-400 text-xs leading-relaxed">
                      Cada problema listado representa uma oportunidade perdida de converter visitantes em clientes. Use este diagnóstico como base para a abordagem comercial.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          {!loading && transformed.length > 0 && (
            <div className="px-7 py-5 border-t border-white/10 shrink-0 flex flex-col sm:flex-row gap-3 justify-end">
              <button
                onClick={() => setProblemsModal(null)}
                className="px-5 py-2.5 rounded-xl bg-surface text-slate-300 border border-border-light hover:bg-white/5 font-semibold transition-all text-sm"
              >
                Fechar
              </button>
              <button
                disabled={pdfGenerating}
                onClick={async () => {
                  setPdfGenerating(true);
                  try {
                    const breakdown = problemsModal.breakdown ? JSON.parse(problemsModal.breakdown) : null;
                    await window.electronAPI.generateDiagnosticPdf?.({ lead, problems: problems || [], score: score || 0, breakdown });
                  } catch (_) {}
                  setPdfGenerating(false);
                }}
                className="px-5 py-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500 hover:text-white font-bold transition-all text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {pdfGenerating ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} Gerar PDF
              </button>
              <button
                onClick={() => {
                  setProblemsModal(null);
                  handleSingleEmail(lead, lead._typeCode || 'sites');
                }}
                className="px-5 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500 hover:text-white font-bold transition-all text-sm flex items-center gap-2"
              >
                <Mail size={15} /> Usar no e-mail
              </button>
              <button
                onClick={() => {
                  setProblemsModal(null);
                  startWhatsappMessageFlow(lead, lead._typeCode || 'sites');
                }}
                className="px-5 py-2.5 rounded-xl bg-green-500/20 text-green-300 border border-green-500/40 hover:bg-green-500 hover:text-white font-bold transition-all text-sm flex items-center gap-2"
              >
                <MessageCircle size={15} /> Abordar pelo WhatsApp
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPostCaptureWppModal = () => {
    if (!postCaptureWppModal) return null;
    const { phase, leads, currentIdx, dispatched, skipped } = postCaptureWppModal;
    const total = leads.length;
    const currentLead = leads[currentIdx] || null;
    const companyName = currentLead ? (currentLead.nome || currentLead.titulo || 'Lead') : '';
    const wppUrl = (() => {
      if (!currentLead) return '';
      const phone = normalizeWhatsappPhone(currentLead.telefone || currentLead.phone || '');
      if (!phone) return '';
      const tpl = pickWppTemplate(currentLead);
      const msg = tpl
        ? applyWppTemplate(tpl, currentLead)
        : buildWhatsappMessage(currentLead, smtpConfig.signatureName || smtpConfig.user?.split('@')[0] || 'Matheus');
      return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    })();

    const openAndAdvance = async () => {
      if (wppUrl) await window.electronAPI.openExternalUrl(wppUrl);
      setPostCaptureWppModal(prev => ({ ...prev, phase: 'dispatching' }));
    };

    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-dark/80 backdrop-blur-sm animate-fade-in">
        <div className="bg-[#0f172a] border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden scale-in">

          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
            <div className="p-2 rounded-xl bg-green-500/10 text-green-400 shrink-0">
              <MessageCircle size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-bold text-base">Disparo via WhatsApp</h3>
              <p className="text-slate-500 text-xs mt-0.5">
                {phase === 'confirm' && `${total} lead${total > 1 ? 's' : ''} com telefone encontrado${total > 1 ? 's' : ''}`}
                {phase === 'dispatching' && `${currentIdx + 1} de ${total} leads`}
                {phase === 'done' && 'Disparo concluído'}
              </p>
            </div>
            {phase !== 'dispatching' && (
              <button onClick={() => setPostCaptureWppModal(null)} className="p-2 rounded-xl hover:bg-white/10 text-slate-400 transition-colors">
                <X size={18} />
              </button>
            )}
          </div>

          {/* Body */}
          <div className="px-6 py-6 flex flex-col gap-4">

            {/* CONFIRM PHASE */}
            {phase === 'confirm' && (
              <>
                <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 text-sm text-slate-300 leading-relaxed">
                  A captura finalizou com <span className="text-white font-bold">{total} lead{total > 1 ? 's' : ''}</span> com telefone disponível.
                  <br className="mt-1" />
                  Deseja iniciar o disparo de mensagens via WhatsApp agora?
                </div>
                <div className="max-h-40 overflow-y-auto custom-scrollbar flex flex-col gap-2">
                  {leads.map((lead, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-slate-300">
                      <MessageCircle size={13} className="text-green-400 shrink-0" />
                      <span className="flex-1 truncate font-medium">{lead.nome || lead.titulo || 'Lead'}</span>
                      <span className="text-slate-500 truncate max-w-[120px]">{lead.telefone}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => setPostCaptureWppModal(null)}
                    className="flex-1 py-3 rounded-xl bg-surface border border-border-light text-slate-300 hover:bg-white/5 font-semibold text-sm transition-all"
                  >
                    Depois
                  </button>
                  <button
                    onClick={openAndAdvance}
                    className="flex-1 py-3 rounded-xl bg-green-500 text-white font-bold text-sm hover:bg-green-600 transition-all flex items-center justify-center gap-2"
                  >
                    <MessageCircle size={15} /> Iniciar disparo
                  </button>
                </div>
              </>
            )}

            {/* DISPATCHING PHASE */}
            {phase === 'dispatching' && currentLead && (
              <>
                {/* Progress bar */}
                <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-green-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${((currentIdx) / total) * 100}%` }}
                  />
                </div>

                {/* Lead card */}
                <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-green-500/10 text-green-400 shrink-0">
                      <MessageCircle size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm truncate">{companyName}</p>
                      {currentLead.localizacao && <p className="text-slate-500 text-xs">{currentLead.localizacao}</p>}
                      <p className="text-green-300 font-mono text-xs mt-1">{currentLead.telefone}</p>
                    </div>
                  </div>
                  <div className="bg-green-500/5 border border-green-500/15 rounded-xl p-3 text-xs text-slate-400 italic leading-relaxed">
                    "{(() => {
                      const tpl = pickWppTemplate(currentLead);
                      const msg = tpl
                        ? applyWppTemplate(tpl, currentLead)
                        : buildWhatsappMessage(currentLead, smtpConfig.signatureName || smtpConfig.user?.split('@')[0] || 'Matheus');
                      return msg.slice(0, 120) + (msg.length > 120 ? '…' : '');
                    })()}"
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      if (wppUrl) await window.electronAPI.openExternalUrl(wppUrl);
                    }}
                    className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 text-xs font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    <MessageCircle size={13} /> Abrir WhatsApp
                  </button>
                  <button
                    onClick={() => handlePostCaptureWppAction('skip')}
                    className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 text-xs font-semibold transition-all"
                  >
                    Pular
                  </button>
                  <button
                    onClick={() => handlePostCaptureWppAction('send')}
                    className="flex-1 py-3 rounded-xl bg-green-500/20 border border-green-500/40 text-green-300 hover:bg-green-500 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <Check size={13} /> Confirmei o envio
                  </button>
                </div>

                <button
                  onClick={() => setPostCaptureWppModal(prev => ({ ...prev, phase: 'done' }))}
                  className="text-slate-600 hover:text-slate-400 text-xs text-center transition-colors mt-1"
                >
                  Encerrar disparo
                </button>
              </>
            )}

            {/* DONE PHASE */}
            {phase === 'done' && (
              <>
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <div className="p-4 rounded-2xl bg-green-500/10 text-green-400">
                    <CheckCircle size={32} />
                  </div>
                  <p className="text-white font-bold text-lg">Disparo concluído!</p>
                  <p className="text-slate-400 text-sm">
                    <span className="text-green-400 font-bold">{dispatched}</span> mensagem{dispatched !== 1 ? 's' : ''} confirmada{dispatched !== 1 ? 's' : ''}
                    {skipped > 0 && <> · <span className="text-slate-500">{skipped} pulado{skipped !== 1 ? 's' : ''}</span></>}
                  </p>
                </div>
                <button
                  onClick={() => setPostCaptureWppModal(null)}
                  className="w-full py-3 rounded-xl bg-green-500/20 border border-green-500/40 text-green-300 hover:bg-green-500 hover:text-white font-bold text-sm transition-all"
                >
                  Fechar
                </button>
              </>
            )}
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

  const renderDailyGoalModal = () => {
    if (!dailyGoalModal) return null;
    const val = Number(dailyGoalInput);
    const isValid = val > 0 && val <= EMAIL_SAFE_DAILY_LIMIT;
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-[#0f172a] border border-white/10 rounded-3xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-extrabold text-lg flex items-center gap-2">
              <Target size={18} className="text-primary" /> Metas de Prospecção
            </h3>
            <button onClick={() => setDailyGoalModal(false)} className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 transition-colors"><X size={18} /></button>
          </div>
          <p className="text-slate-400 text-sm">Defina metas de envios diária, semanal e mensal para acompanhar seu ritmo de prospecção.</p>
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Diária (máx: {EMAIL_SAFE_DAILY_LIMIT})</label>
            <input
              type="number"
              min="1"
              max={EMAIL_SAFE_DAILY_LIMIT}
              value={dailyGoalInput}
              onChange={e => setDailyGoalInput(e.target.value)}
              placeholder={`Ex: 20`}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              autoFocus
            />
            {dailyGoalInput && !isValid && (
              <p className="text-red-400 text-xs mt-1.5">Valor deve ser entre 1 e {EMAIL_SAFE_DAILY_LIMIT}.</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Semanal</label>
              <input
                type="number"
                min="0"
                value={weeklyGoal || ''}
                onChange={e => setWeeklyGoal(Number(e.target.value) || 0)}
                placeholder="Ex: 100"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Mensal</label>
              <input
                type="number"
                min="0"
                value={monthlyGoal || ''}
                onChange={e => setMonthlyGoal(Number(e.target.value) || 0)}
                placeholder="Ex: 400"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-3">
            {dailyGoal > 0 && (
              <button
                onClick={async () => {
                  setDailyGoal(0);
                  clearGoalHit();
                  await window.electronAPI.setConfig('daily_goal', '0');
                  setDailyGoalModal(false);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-bold transition-all"
              >
                Remover meta
              </button>
            )}
            <button
              onClick={async () => {
                if (!isValid) return;
                setDailyGoal(val);
                clearGoalHit();
                await window.electronAPI.setConfig('daily_goal', String(val));
                await window.electronAPI.setConfig('weekly_goal', String(weeklyGoal));
                await window.electronAPI.setConfig('monthly_goal', String(monthlyGoal));
                setDailyGoalModal(false);
              }}
              disabled={!isValid}
              className="flex-1 px-4 py-2.5 rounded-xl bg-primary/20 border border-primary/40 text-primary hover:bg-primary hover:text-white text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Salvar metas
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderGoalReachedModal = () => {
    if (!goalReachedModal) return null;
    const cooldownMins = Math.ceil(getGoalCooldownRemaining() / 60000);
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-[#0f172a] border border-emerald-500/30 rounded-3xl shadow-2xl w-full max-w-md p-7 flex flex-col gap-5 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 grid place-items-center mx-auto text-3xl">🎯</div>
          <div>
            <h3 className="text-white font-extrabold text-xl">Meta diária atingida!</h3>
            <p className="text-slate-400 text-sm mt-2">
              Você enviou <strong className="text-white">{sentTodayCount}</strong> e-mails hoje, atingindo sua meta de <strong className="text-white">{dailyGoal}</strong>.
            </p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 text-left">
            <p className="text-amber-300 text-xs font-bold mb-1">⏱ Cooldown de 1 hora ativo</p>
            <p className="text-slate-400 text-xs">Para proteger a reputação do e-mail e manter o ritmo saudável, novos envios ficam bloqueados por <strong className="text-white">{cooldownMins} minuto(s)</strong>. Após esse período, você poderá continuar enviando normalmente.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setGoalReachedModal(false)}
              className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 text-sm font-bold transition-all"
            >
              Encerrar por hoje
            </button>
            <button
              onClick={() => setGoalReachedModal(false)}
              className="flex-1 px-4 py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500 hover:text-white text-sm font-bold transition-all"
            >
              Entendido, aguardarei
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
    <div className="premium-shell bg-dark">
      {renderSidebar()}

      {/* T24 — Toast global */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-[250] bg-amber-500 text-slate-900 text-xs font-bold flex items-center justify-center gap-2 py-2 animate-fade-in">
          <AlertTriangle size={14} /> Sem conexão com a internet — funções de IA, e-mail e scraping indisponíveis.
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[200] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-semibold text-sm animate-fade-in ${
          toast.type === 'success' ? 'bg-emerald-500 text-white' :
          toast.type === 'error' ? 'bg-red-500 text-white' :
          'bg-slate-800 text-white border border-white/10'
        }`}>
          {toast.type === 'success' ? <Check size={16} /> : toast.type === 'error' ? <X size={16} /> : <Info size={16} />}
          {toast.msg}
        </div>
      )}

      {/* T21 — Command Palette */}
      {cmdPalette.open && (
        <div className="fixed inset-0 z-[150] flex items-start justify-center pt-24 bg-dark/70 backdrop-blur-sm animate-fade-in" onClick={() => setCmdPalette(p => ({ ...p, open: false }))}>
          <div className="w-full max-w-xl bg-surface border border-white/15 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
              <Search size={18} className="text-slate-400" />
              <input
                autoFocus
                className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none text-sm"
                placeholder="Buscar leads, nichos, e-mails..."
                value={cmdPalette.query}
                onChange={async (e) => {
                  const q = e.target.value;
                  setCmdPalette(p => ({ ...p, query: q }));
                  if (q.length >= 2) {
                    const res = await window.electronAPI.searchAllLeads?.(q);
                    setCmdPalette(p => ({ ...p, results: res?.results || [] }));
                  } else {
                    setCmdPalette(p => ({ ...p, results: [] }));
                  }
                }}
              />
              <span className="text-[10px] text-slate-600 bg-white/5 px-2 py-1 rounded">Esc</span>
            </div>
            <div className="max-h-80 overflow-y-auto custom-scrollbar">
              {cmdPalette.results.length === 0 && cmdPalette.query.length >= 2 && (
                <p className="px-4 py-6 text-center text-slate-500 text-sm">Nenhum resultado para "{cmdPalette.query}"</p>
              )}
              {cmdPalette.results.length === 0 && cmdPalette.query.length < 2 && (
                <div className="px-4 py-4 space-y-1">
                  {[
                    { key: 'N', label: 'Nova Captura', menu: 'nova-captura' },
                    { key: 'D', label: 'Dashboard', menu: 'geral' },
                    { key: 'L', label: 'Banco de Sites', menu: 'sites' },
                  ].map(a => (
                    <button key={a.key} onClick={() => { setActiveMenu(a.menu); setCmdPalette(p => ({ ...p, open: false })); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-slate-300 text-sm transition-all text-left">
                      <span className="text-[10px] font-black bg-white/10 px-1.5 py-0.5 rounded text-slate-500">{a.key}</span>
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
              {cmdPalette.results.map((lead, i) => (
                <button key={i} onClick={() => { handleOpenDetails(lead); setCmdPalette(p => ({ ...p, open: false })); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-all text-left border-b border-white/5 last:border-0">
                  <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-[10px] font-black ${lead._typeCode === 'sites' ? 'bg-primary/15 text-primary' : lead._typeCode === 'sistema' ? 'bg-violet-500/15 text-violet-300' : 'bg-blue-500/15 text-blue-300'}`}>
                    {lead._typeCode === 'sites' ? 'S' : lead._typeCode === 'sistema' ? 'A' : 'L'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{lead.nome || lead.titulo}</p>
                    <p className="text-slate-500 text-xs truncate">{lead.url || lead.site_oficial || lead.email || lead.localizacao}</p>
                  </div>
                  <span className="ml-auto text-slate-600 text-xs shrink-0">↵</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="premium-main custom-scrollbar relative">
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="premium-btn mb-5 lg:hidden"
        >
          <ListFilter size={16} /> Menu
        </button>
        {activeMenu === 'geral' && renderDashboard()}
        {activeMenu === 'nova-captura' && renderNovaCaptura()}
        {activeMenu === 'envios' && renderConfiguracoes()}
        {activeMenu === 'whatsapp-comercial' && renderWhatsappComercial()}
        {activeMenu === 'crm' && renderCrmDashboard()}
        {activeMenu === 'kanban' && renderKanban()}
        {activeMenu === 'propostas' && renderPropostasDashboard()}
        
        {/* Grids mapping */}
        {activeMenu === 'sites' && renderLeadsGrid(siteLeadsGrid, 'Banco de Sites', 'sites')}
        {activeMenu === 'sistemas' && renderLeadsGrid(sistemas, 'Sistemas & Apps Capturados', 'sistema')}
        {activeMenu === 'linkedin' && renderLeadsGrid(linkedin, 'Banco LinkedIn', 'linkedin')}
        {activeMenu === 'validados' && renderLeadsGrid(validatedLeadsGrid, 'Leads Validados', 'misto')}

        {renderLeadDetailsModal()}
        {renderProblemsModal()}
        {renderPostCaptureWppModal()}
        {renderAppDialog()}
        {renderOnboardingModal()}
        {renderDailyGoalModal()}
        {renderGoalReachedModal()}
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

              {/* T15 — Timeline de interações */}
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">
                  Timeline &mdash; {crmModal.interacoes.length} evento{crmModal.interacoes.length !== 1 ? 's' : ''}
                </p>
                {crmModal.interacoes.length === 0 ? (
                  <p className="text-slate-600 text-sm text-center py-6">Nenhuma interação registrada ainda.</p>
                ) : (
                  <div className="relative">
                    <div className="absolute left-[17px] top-2 bottom-2 w-px bg-gradient-to-b from-primary/40 via-white/10 to-transparent" />
                    <div className="flex flex-col gap-0">
                      {crmModal.interacoes.map((item, idx) => {
                        const canalColors = {
                          email: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
                          whatsapp: 'text-green-400 bg-green-500/10 border-green-500/20',
                          ligacao: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                          reuniao: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
                          nota: 'text-slate-400 bg-white/5 border-white/10',
                          observacao: 'text-slate-400 bg-white/5 border-white/10',
                        };
                        const colorClass = canalColors[item.canal] || 'text-primary bg-primary/10 border-primary/20';
                        return (
                          <div key={item.id} className="relative flex items-start gap-4 pb-5 group">
                            <div className={`relative z-10 shrink-0 w-9 h-9 rounded-full border flex items-center justify-center ${colorClass}`}>
                              {CANAL_ICONS[item.canal] || <FileText size={15} />}
                            </div>
                            <div className="flex-1 min-w-0 pt-1.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <p className="text-white text-sm leading-snug">{item.descricao}</p>
                                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md capitalize border ${colorClass}`}>{item.canal}</span>
                                    <span className="text-[10px] text-slate-500">
                                      {new Date(item.data_hora).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleDeleteInteracao(item.id)}
                                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 hover:text-red-400 text-slate-600 transition-all shrink-0"
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
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
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      {emailPreviewModal.leads.length === 1 ? 'E-mail destinatário' : 'E-mail vinculado'}
                    </label>
                    <input
                      type="email"
                      readOnly={emailPreviewModal.leads.length !== 1}
                      value={
                        emailPreviewModal.leads.length === 1
                          ? (emailPreviewModal.emailOverride ?? emailPreviewModal.leads[0].email ?? '')
                          : `${emailPreviewModal.leads.length} destinatários selecionados`
                      }
                      onChange={emailPreviewModal.leads.length === 1
                        ? e => setEmailPreviewModal({ ...emailPreviewModal, emailOverride: e.target.value })
                        : undefined}
                      className={`w-full bg-dark/60 border rounded-xl px-4 py-3 focus:outline-none transition-colors ${
                        emailPreviewModal.leads.length === 1
                          ? 'border-border-light text-white focus:border-primary'
                          : 'border-border-light text-white/50 cursor-default'
                      }`}
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
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-slate-400">Body do e-mail</label>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {['{nome}', '{nicho}', '{url}', '{problema1}', '{cidade}'].map(v => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => {
                              const el = document.getElementById('email-body-textarea');
                              if (!el) return;
                              const start = el.selectionStart ?? el.value.length;
                              const current = emailPreviewModal.template.corpo;
                              const newVal = current.slice(0, start) + v + current.slice(start);
                              setEmailPreviewModal({ ...emailPreviewModal, template: { ...emailPreviewModal.template, corpo: newVal } });
                              setTimeout(() => { el.focus(); el.setSelectionRange(start + v.length, start + v.length); }, 0);
                            }}
                            className="text-[10px] font-mono font-bold px-2 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all"
                          >{v}</button>
                        ))}
                      </div>
                    </div>
                    <textarea
                      id="email-body-textarea"
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
