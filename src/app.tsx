import React, { useState, useMemo, useEffect } from 'react';
import {
  LayoutDashboard,
  Calendar as CalendarIcon,
  Users,
  Layers,
  AlertCircle,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  FileText,
  X,
  Trash2,
  Edit3,
  ArrowUpRight,
  SlidersHorizontal,
  Check,
  Menu,
  Sun,
  Moon,
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Briefcase,
  ArrowLeft,
  LogOut,
  Loader2,
  ShieldCheck
} from 'lucide-react';

// ============================================================================
// TIPOS E INTERFACES DE DOMÍNIO (PREPARADO PARA FUTURA INTEGRAÇÃO API)
// ============================================================================

type AuthScreen = 'login' | 'register' | 'forgot-password' | 'reset-password';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

type ContentFormat = 'Estático' | 'Carrossel' | 'Reels' | 'Stories' | 'Vídeo';

type ContentStatus =
  | 'Planejado'
  | 'Em produção'
  | 'Em revisão'
  | 'Aguardando aprovação'
  | 'Aprovado'
  | 'Agendado'
  | 'Publicado'
  | 'Pendente';

interface Client {
  id: string;
  name: string;
  segment: string;
  accentColor: string;
  monthlyGoal: number;
  manager: string;
}

interface EditorialContent {
  id: string;
  clientId: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  format: ContentFormat;
  status: ContentStatus;
  copy: string;
  artText: string;
  briefing: string;
}

type ActiveModule = 'overview' | 'calendar' | 'clients' | 'production' | 'pending';
type CalendarViewMode = 'daily' | 'weekly' | 'monthly';

// ============================================================================
// CONSTANTES E CONFIGURAÇÕES VISUAIS DE STATUS (IDENTIDADE OP GROWTH DIGITAL)
// ============================================================================

const ALL_STATUSES: ContentStatus[] = [
  'Planejado',
  'Em produção',
  'Em revisão',
  'Aguardando aprovação',
  'Aprovado',
  'Agendado',
  'Publicado',
  'Pendente'
];

const ALL_FORMATS: ContentFormat[] = ['Estático', 'Carrossel', 'Reels', 'Stories', 'Vídeo'];

// Tokens da Identidade Visual OP Growth Digital
const BRAND = {
  navy: '#000055',
  orange: '#C54B00',
  black: '#000000'
};

// Configuração visual funcional para os status (Suporte a Tema Claro e Escuro)
const STATUS_CONFIG: Record<
  ContentStatus,
  {
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    dot: string;
    category: 'planned' | 'production' | 'approval' | 'ready' | 'published' | 'pending';
  }
> = {
  Planejado: {
    badgeBg: 'bg-slate-100 dark:bg-zinc-800/90',
    badgeText: 'text-slate-700 dark:text-slate-200',
    badgeBorder: 'border-slate-200 dark:border-zinc-700',
    dot: 'bg-slate-500 dark:bg-slate-400',
    category: 'planned'
  },
  'Em produção': {
    badgeBg: 'bg-blue-50 dark:bg-blue-950/60',
    badgeText: 'text-blue-700 dark:text-blue-300',
    badgeBorder: 'border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-500',
    category: 'production'
  },
  'Em revisão': {
    badgeBg: 'bg-indigo-50 dark:bg-indigo-950/60',
    badgeText: 'text-indigo-700 dark:text-indigo-300',
    badgeBorder: 'border-indigo-200 dark:border-indigo-800',
    dot: 'bg-indigo-500',
    category: 'production'
  },
  'Aguardando aprovação': {
    badgeBg: 'bg-amber-50 dark:bg-amber-950/60',
    badgeText: 'text-amber-800 dark:text-amber-300',
    badgeBorder: 'border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
    category: 'approval'
  },
  Aprovado: {
    badgeBg: 'bg-teal-50 dark:bg-teal-950/60',
    badgeText: 'text-teal-700 dark:text-teal-300',
    badgeBorder: 'border-teal-200 dark:border-teal-800',
    dot: 'bg-teal-500',
    category: 'ready'
  },
  Agendado: {
    badgeBg: 'bg-violet-50 dark:bg-violet-950/60',
    badgeText: 'text-violet-700 dark:text-violet-300',
    badgeBorder: 'border-violet-200 dark:border-violet-800',
    dot: 'bg-violet-500',
    category: 'ready'
  },
  Publicado: {
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    badgeBorder: 'border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500',
    category: 'published'
  },
  Pendente: {
    badgeBg: 'bg-rose-50 dark:bg-rose-950/60',
    badgeText: 'text-rose-700 dark:text-rose-300',
    badgeBorder: 'border-rose-200 dark:border-rose-800',
    dot: 'bg-rose-500',
    category: 'pending'
  }
};

// ============================================================================
// UTILITÁRIOS DE DATA (SEM DEPENDÊNCIAS EXTERNAS)
// ============================================================================

const toISODate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseISODate = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const addDays = (date: Date, days: number): Date => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

// Retorna a segunda-feira da semana de uma data
const getMondayOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay(); // 0 (Dom) a 6 (Sáb)
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

const formatShortDateBR = (iso: string): string => {
  const d = parseISODate(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

const formatFullDateBR = (iso: string): string => {
  const d = parseISODate(iso);
  return d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
};

// ============================================================================
// DADOS FICTÍCIOS INICIAIS (5 CLIENTES + CONTEÚDOS DISTRIBUÍDOS NA SEMANA ATUAL)
// ============================================================================

const createInitialClients = (): Client[] => [
  {
    id: 'cli-1',
    name: 'Vértice Arquitetura',
    segment: 'Arquitetura & Design',
    accentColor: 'rgb(37, 99, 235)', // Azul Primário
    monthlyGoal: 16,
    manager: 'Camila Rocha'
  },
  {
    id: 'cli-2',
    name: 'NaturaVita Saúde',
    segment: 'Clínica & Bem-estar',
    accentColor: 'rgb(16, 185, 129)', // Verde Esmeralda Secundário
    monthlyGoal: 20,
    manager: 'Lucas Mendes'
  },
  {
    id: 'cli-3',
    name: 'Apex Tech Solutions',
    segment: 'SaaS B2B',
    accentColor: 'rgb(124, 58, 237)', // Violeta Terciário
    monthlyGoal: 12,
    manager: 'Mariana Silva'
  },
  {
    id: 'cli-4',
    name: 'Café Torra Nobre',
    segment: 'Gastronomia & E-commerce',
    accentColor: 'rgb(217, 119, 6)', // Âmbar Terciário
    monthlyGoal: 24,
    manager: 'Rafael Costa'
  },
  {
    id: 'cli-5',
    name: 'Aura Dermocosméticos',
    segment: 'Beleza & Skincare',
    accentColor: 'rgb(219, 39, 119)', // Magenta Terciário
    monthlyGoal: 18,
    manager: 'Camila Rocha'
  }
];

const createInitialContents = (): EditorialContent[] => {
  const today = new Date();
  const monday = getMondayOfWeek(today);
  const d = (offsetFromMonday: number) => toISODate(addDays(monday, offsetFromMonday));

  return [
    {
      id: 'cnt-101',
      clientId: 'cli-1',
      title: 'Tendências de Iluminação Natural em Projetos Residenciais',
      date: d(0),
      time: '11:00',
      format: 'Carrossel',
      status: 'Publicado',
      copy: 'A luz natural transforma não apenas a estética, mas o bem-estar dentro de casa. Deslize e veja 4 soluções arquitetônicas que aplicamos nos nossos últimos projetos.',
      artText: 'Capa: Como a luz natural valoriza cada m² do seu projeto.\nSlide 2: Claraboias minimalistas\nSlide 3: Integração sala + varanda',
      briefing: 'Usar fotos reais do projeto Casa Jardins com tipografia editorial limpa.'
    },
    {
      id: 'cnt-102',
      clientId: 'cli-2',
      title: '5 Hábitos Matinais para Regular o Ciclo Circadiano',
      date: d(0),
      time: '18:00',
      format: 'Reels',
      status: 'Publicado',
      copy: 'Acordar cansado não é normal. Ajustar os primeiros 30 minutos do seu dia muda completamente sua disposição e qualidade do sono.',
      artText: 'Gancho na tela: 3 erros que acabam com sua energia logo cedo.',
      briefing: 'Gravação com Dra. Helena em consultório, cortes dinâmicos a cada 3 segundos.'
    },
    {
      id: 'cnt-103',
      clientId: 'cli-3',
      title: 'Como Reduzir o CAC em Operações B2B com Automação de Funil',
      date: d(1),
      time: '09:30',
      format: 'Carrossel',
      status: 'Agendado',
      copy: 'Escalar vendas B2B sem inflar o time comercial exige processos previsíveis. Veja a estrutura de nutrição que aplicamos em 40+ empresas.',
      artText: 'Capa: O blueprint para reduzir seu CAC em até 32% neste trimestre.',
      briefing: 'Layout corporativo escuro com gráficos simplificados e dados reais anonimizados.'
    },
    {
      id: 'cnt-104',
      clientId: 'cli-5',
      title: 'Rotina Minimalista: Vitamina C + Protetor Solar',
      date: d(1),
      time: '19:00',
      format: 'Estático',
      status: 'Aprovado',
      copy: 'Menos passos, mais resultado. A combinação antioxidante que protege contra radicais livres e uniformiza o tom da pele desde a primeira semana.',
      artText: 'Dupla essencial da manhã: Proteção + Luminosidade.',
      briefing: 'Foto macro da textura do sérum com iluminação quente.'
    },
    {
      id: 'cnt-105',
      clientId: 'cli-4',
      title: 'Bastidores da Torra Média: Notas Sensoriais de Caramelo',
      date: d(2),
      time: '10:00',
      format: 'Reels',
      status: 'Aguardando aprovação',
      copy: 'Do grão verde à xícara perfeita: acompanhe o ponto exato onde desenvolvemos a doçura natural do nosso microlote Mantiqueira.',
      artText: 'Legenda dinâmica: O segredo da torra artesanal.',
      briefing: 'Vídeo vertical 15s com som ambiente da torrefação e trilha lo-fi sutil.'
    },
    {
      id: 'cnt-106',
      clientId: 'cli-1',
      title: 'Antes e Depois: Reforma de Apartamento 140m²',
      date: d(2),
      time: '17:30',
      format: 'Carrossel',
      status: 'Em revisão',
      copy: 'Integração total entre cozinha gourmet e living. Veja como eliminamos paredes estruturais visuais para criar amplitude.',
      artText: 'Capa: Transformação completa em 90 dias de obra.',
      briefing: 'Comparativo lado a lado com planta baixa humanizada no último slide.'
    },
    {
      id: 'cnt-107',
      clientId: 'cli-3',
      title: 'Case de Sucesso: +140% em Pipeline Qualificado',
      date: d(-2),
      time: '14:00',
      format: 'Estático',
      status: 'Pendente',
      copy: 'Como a reestruturação do onboarding transformou leads frios em contratos recorrentes em 60 dias.',
      artText: '+140% em Pipeline Qualificado: Estudo de Caso Completo.',
      briefing: 'Aguardando validação final dos números com o diretor comercial do cliente.'
    },
    {
      id: 'cnt-108',
      clientId: 'cli-2',
      title: 'Suplementação Inteligente: O que Realmente Tem Evidência',
      date: d(3),
      time: '12:00',
      format: 'Carrossel',
      status: 'Em produção',
      copy: 'Antes de investir em dezenas de cápsulas, entenda o que seus exames realmente indicam.',
      artText: 'Capa: Suplementação baseada em ciência, não em modismo.',
      briefing: 'Design limpo em verde-sálvia e off-white com ícones minimalistas.'
    },
    {
      id: 'cnt-109',
      clientId: 'cli-5',
      title: 'Guia de Ativos: Ácido Hialurônico vs. Niacinamida',
      date: d(3),
      time: '18:30',
      format: 'Carrossel',
      status: 'Aguardando aprovação',
      copy: 'Hidratação profunda ou controle de oleosidade? Descubra qual ativo priorizar — ou como combinar os dois na mesma rotina.',
      artText: 'Capa: Batalha dos Ativos — Qual a sua pele precisa hoje?',
      briefing: 'Tabela comparativa visual no slide 4.'
    },
    {
      id: 'cnt-110',
      clientId: 'cli-4',
      title: 'Combo Fim de Semana: 2 Pacotes + Frete Grátis Sul/Sudeste',
      date: d(4),
      time: '11:30',
      format: 'Stories',
      status: 'Planejado',
      copy: 'Garanta seu café fresco para o fim de semana com condição especial válida por 24 horas.',
      artText: 'Sequência de 3 stories com contagem regressiva e link direto.',
      briefing: 'Usar sticker de contagem regressiva e foto do kit.'
    },
    {
      id: 'cnt-111',
      clientId: 'cli-3',
      title: 'Checklist de Segurança de Dados para Times Remotos',
      date: d(4),
      time: '16:00',
      format: 'Vídeo',
      status: 'Em produção',
      copy: '5 pontos críticos de compliance e proteção que todo gestor de TI deve revisar trimestralmente.',
      artText: 'Thumbnail: Sua operação remota está realmente protegida?',
      briefing: 'Roteiro técnico objetivo de 45 segundos com letterings.'
    },
    {
      id: 'cnt-112',
      clientId: 'cli-1',
      title: 'Curadoria de Mobiliário Assinado Brasileiro',
      date: d(5),
      time: '10:30',
      format: 'Estático',
      status: 'Planejado',
      copy: 'Peças atemporais que carregam identidade, conforto ergonômico e valorização estética.',
      artText: 'Design Nacional: Peças-chave para salas de estar.',
      briefing: 'Composição fotográfica com foco em madeira natural e linho.'
    },
    {
      id: 'cnt-113',
      clientId: 'cli-5',
      title: 'Depoimentos Reais: 30 Dias de Protocolo Anti-manchas',
      date: d(-1),
      time: '19:00',
      format: 'Reels',
      status: 'Pendente',
      copy: 'Resultados reais de quem seguiu o protocolo diário recomendado pelos nossos especialistas.',
      artText: '30 dias de evolução real na pele.',
      briefing: 'Falta receber o termo de autorização de imagem da paciente.'
    }
  ];
};

// ============================================================================
// COMPONENTE PRINCIPAL: DASHBOARD EDITORIAL OP GROWTH DIGITAL
// ============================================================================

export function App() {
  const todayISO = useMemo(() => toISODate(new Date()), []);

  // Tema Claro / Escuro (Default: Claro)
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // Estado de Autenticação Simulada (Preparado para futura integração com Auth API)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');
  const [resetEmailTarget, setResetEmailTarget] = useState<string>('');

  // Estado principal da aplicação (Local State - preparado para API)
  const [clients, setClients] = useState<Client[]>(createInitialClients);
  const [contents, setContents] = useState<EditorialContent[]>(createInitialContents);

  // Navegação e Visualização
  const [activeModule, setActiveModule] = useState<ActiveModule>('calendar');
  const [calendarView, setCalendarView] = useState<CalendarViewMode>('weekly');
  const [referenceDate, setReferenceDate] = useState<Date>(new Date());
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // Filtros Globais
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]); // vazio = todos
  const [statusFilter, setStatusFilter] = useState<ContentStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modais e Painéis Laterais (Drawers)
  const [editingContentId, setEditingContentId] = useState<string | null>(null);
  const [isNewContentModalOpen, setIsNewContentModalOpen] = useState<boolean>(false);
  const [newContentDefaultDate, setNewContentDefaultDate] = useState<string>(todayISO);
  const [clientModalState, setClientModalState] = useState<{
    open: boolean;
    client: Client | null;
  }>({ open: false, client: null });

  // Toast feedback discreto
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Carregamento da família tipográfica Sora (Google Fonts)
  useEffect(() => {
    const linkId = 'op-growth-sora-font';
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href =
        'https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3200);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Mapa rápido de clientes por ID
  const clientMap = useMemo(() => {
    const map: Record<string, Client> = {};
    clients.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [clients]);

  // Filtragem unificada de conteúdos
  const filteredContents = useMemo(() => {
    return contents
      .filter((item) => {
        if (selectedClientIds.length > 0 && !selectedClientIds.includes(item.clientId)) {
          return false;
        }
        if (statusFilter !== 'ALL' && item.status !== statusFilter) {
          return false;
        }
        if (searchQuery.trim() !== '') {
          const q = searchQuery.toLowerCase();
          const clientName = clientMap[item.clientId]?.name.toLowerCase() || '';
          const matchTitle = item.title.toLowerCase().includes(q);
          const matchCopy = item.copy.toLowerCase().includes(q);
          const matchClient = clientName.includes(q);
          const matchFormat = item.format.toLowerCase().includes(q);
          if (!matchTitle && !matchCopy && !matchClient && !matchFormat) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.time.localeCompare(b.time);
      });
  }, [contents, selectedClientIds, statusFilter, searchQuery, clientMap]);

  // Datas da semana atual exibida (Segunda a Domingo)
  const currentWeekDays = useMemo(() => {
    const monday = getMondayOfWeek(referenceDate);
    return Array.from({ length: 7 }, (_, idx) => addDays(monday, idx));
  }, [referenceDate]);

  // KPIs dinâmicos baseados nos filtros ativos
  const metrics = useMemo(() => {
    const weekStartISO = toISODate(currentWeekDays[0]);
    const weekEndISO = toISODate(currentWeekDays[6]);

    const totalPlanned = filteredContents.length;
    const published = filteredContents.filter((c) => c.status === 'Publicado').length;
    const inProduction = filteredContents.filter(
      (c) => c.status === 'Em produção' || c.status === 'Em revisão'
    ).length;
    const awaitingApproval = filteredContents.filter(
      (c) => c.status === 'Aguardando aprovação'
    ).length;
    const pendingOrOverdue = filteredContents.filter(
      (c) =>
        c.status === 'Pendente' ||
        (c.date < todayISO && c.status !== 'Publicado' && c.status !== 'Agendado')
    ).length;
    const thisWeekCount = filteredContents.filter(
      (c) => c.date >= weekStartISO && c.date <= weekEndISO
    ).length;

    return {
      totalPlanned,
      published,
      inProduction,
      awaitingApproval,
      pendingOrOverdue,
      thisWeekCount
    };
  }, [filteredContents, currentWeekDays, todayISO]);

  // Conteúdo selecionado no Drawer
  const editingContent = useMemo(
    () => contents.find((c) => c.id === editingContentId) || null,
    [contents, editingContentId]
  );

  // ==========================================================================
  // HANDLERS DE MUTAÇÃO (CRUD EM MEMÓRIA)
  // ==========================================================================

  const handleUpdateContent = (id: string, patch: Partial<EditorialContent>) => {
    setContents((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleDeleteContent = (id: string) => {
    setContents((prev) => prev.filter((item) => item.id !== id));
    if (editingContentId === id) setEditingContentId(null);
    triggerToast('Publicação removida do calendário.');
  };

  const handleCreateContent = (newItem: Omit<EditorialContent, 'id'>) => {
    const created: EditorialContent = {
      ...newItem,
      id: `cnt-${Date.now()}`
    };
    setContents((prev) => [...prev, created]);
    setIsNewContentModalOpen(false);
    triggerToast('Nova publicação adicionada ao planejamento.');
  };

  const handleSaveClient = (clientData: Omit<Client, 'id'>, existingId?: string) => {
    if (existingId) {
      setClients((prev) =>
        prev.map((c) => (c.id === existingId ? { ...c, ...clientData } : c))
      );
      triggerToast('Dados do cliente atualizados.');
    } else {
      const created: Client = {
        ...clientData,
        id: `cli-${Date.now()}`
      };
      setClients((prev) => [...prev, created]);
      triggerToast('Novo cliente cadastrado na carteira.');
    }
    setClientModalState({ open: false, client: null });
  };

  const toggleClientFilter = (clientId: string) => {
    setSelectedClientIds((prev) =>
      prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId]
    );
  };

  // Navegação Temporal do Calendário
  const navigateCalendar = (direction: -1 | 1) => {
    setReferenceDate((prev) => {
      const copy = new Date(prev);
      if (calendarView === 'daily') {
        copy.setDate(copy.getDate() + direction);
      } else if (calendarView === 'weekly') {
        copy.setDate(copy.getDate() + direction * 7);
      } else {
        copy.setMonth(copy.getMonth() + direction);
      }
      return copy;
    });
  };

  const calendarPeriodLabel = useMemo(() => {
    if (calendarView === 'daily') {
      return referenceDate.toLocaleDateString('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    }
    if (calendarView === 'weekly') {
      const start = currentWeekDays[0];
      const end = currentWeekDays[6];
      const startStr = start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      const endStr = end.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      return `${startStr} – ${endStr}`;
    }
    return referenceDate.toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric'
    });
  }, [calendarView, referenceDate, currentWeekDays]);

  const openNewContentForDate = (isoDate?: string) => {
    setNewContentDefaultDate(isoDate || toISODate(referenceDate));
    setIsNewContentModalOpen(true);
  };

  // ==========================================================================
  // SUBCOMPONENTES DE INTERFACE
  // ==========================================================================

  const StatusBadge = ({ status }: { status: ContentStatus }) => {
    const cfg = STATUS_CONFIG[status];
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${cfg.badgeBg} ${cfg.badgeText} ${cfg.badgeBorder} whitespace-nowrap`}
      >
        {status}
      </span>
    );
  };

  // Card compacto e limpo para o Calendário Semanal e listas
  const ContentCard = ({
    item,
    compact = false
  }: {
    item: EditorialContent;
    compact?: boolean;
  }) => {
    const client = clientMap[item.clientId];
    const isOverdue =
      item.date < todayISO && item.status !== 'Publicado' && item.status !== 'Agendado';

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => setEditingContentId(item.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setEditingContentId(item.id);
          }
        }}
        className={`group relative bg-white dark:bg-zinc-900 rounded-xl border transition-all duration-150 cursor-pointer text-left select-none hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#000055] dark:focus:ring-[#C54B00] ${
          isOverdue
            ? 'border-rose-300 dark:border-rose-900/80 bg-rose-50/30 dark:bg-rose-950/20'
            : 'border-slate-200/90 dark:border-zinc-800 hover:border-[#000055]/40 dark:hover:border-[#C54B00]/60'
        } ${compact ? 'p-2.5' : 'p-3'}`}
      >
        {/* Faixa de cor lateral do cliente */}
        <div
          className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full"
          style={{ backgroundColor: client?.accentColor || BRAND.navy }}
        />

        <div className="pl-2">
          {/* Linha 1: Cliente + Horário */}
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
              {client?.name || 'Cliente'}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 dark:text-slate-500 shrink-0 tabular-nums">
              <Clock className="w-3 h-3" />
              {item.time}
            </span>
          </div>

          {/* Linha 2: Título ou Tema */}
          <h4 className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2 mb-2 group-hover:text-[#000055] dark:group-hover:text-[#ff7a29]">
            {item.title}
          </h4>

          {/* Linha 3: Formato + Status */}
          <div className="flex items-center justify-between gap-1.5 flex-wrap pt-1 border-t border-slate-100 dark:border-zinc-800/80">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
              {item.format}
            </span>
            <StatusBadge status={item.status} />
          </div>
        </div>
      </div>
    );
  };

  // ==========================================================================
  // RENDERIZAÇÃO DAS VISUALIZAÇÕES DO CALENDÁRIO EDITORIAL
  // ==========================================================================

  const renderCalendarModule = () => {
    return (
      <div className="space-y-4">
        {/* Barra de Controle do Calendário */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
          {/* Seletor de Modo: Diária | Semanal | Mensal */}
          <div className="inline-flex p-1 bg-slate-100 dark:bg-zinc-950 rounded-xl border border-slate-200/70 dark:border-zinc-800 self-start">
            {(
              [
                { id: 'daily', label: 'Diária' },
                { id: 'weekly', label: 'Semanal' },
                { id: 'monthly', label: 'Mensal' }
              ] as { id: CalendarViewMode; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCalendarView(tab.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  calendarView === tab.id
                    ? 'bg-[#000055] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Navegação Temporal */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setReferenceDate(new Date())}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-700 transition"
            >
              Hoje
            </button>
            <div className="inline-flex items-center bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl">
              <button
                type="button"
                onClick={() => navigateCalendar(-1)}
                aria-label="Período anterior"
                className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-700 rounded-l-xl transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 capitalize min-w-[175px] text-center">
                {calendarPeriodLabel}
              </span>
              <button
                type="button"
                onClick={() => navigateCalendar(1)}
                aria-label="Próximo período"
                className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-700 rounded-r-xl transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => openNewContentForDate()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#C54B00] hover:bg-[#a63f00] px-3.5 py-2 text-xs font-semibold text-white transition shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Publicação</span>
            </button>
          </div>
        </div>

        {/* VISUALIZAÇÃO SEMANAL (7 COLUNAS: SEGUNDA A DOMINGO) */}
        {calendarView === 'weekly' && (
          <div className="overflow-x-auto pb-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 min-w-0 lg:min-w-[1080px]">
              {currentWeekDays.map((dayDate) => {
                const iso = toISODate(dayDate);
                const isToday = iso === todayISO;
                const dayItems = filteredContents.filter((c) => c.date === iso);
                const dayName = dayDate.toLocaleDateString('pt-BR', { weekday: 'short' });
                const dayNumber = dayDate.getDate();

                return (
                  <div
                    key={iso}
                    className={`flex flex-col rounded-2xl border min-h-[420px] transition-colors ${
                      isToday
                        ? 'bg-[#000055]/[0.03] dark:bg-[#000055]/25 border-[#000055]/40 dark:border-[#C54B00]/60 ring-1 ring-[#000055]/10'
                        : 'bg-slate-50/50 dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-800'
                    }`}
                  >
                    {/* Cabeçalho da Coluna do Dia */}
                    <div
                      className={`flex items-center justify-between px-3 py-2.5 border-b ${
                        isToday
                          ? 'border-[#000055]/20 dark:border-[#000055] bg-white dark:bg-zinc-900 rounded-t-2xl'
                          : 'border-slate-200/80 dark:border-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {dayName.replace('.', '')}
                        </span>
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold tabular-nums ${
                            isToday
                              ? 'bg-[#C54B00] text-white'
                              : 'text-slate-800 dark:text-slate-200 bg-slate-200/60 dark:bg-zinc-800'
                          }`}
                        >
                          {dayNumber}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {dayItems.length > 0 && (
                          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mr-1">
                            {dayItems.length}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => openNewContentForDate(iso)}
                          title={`Adicionar publicação em ${formatShortDateBR(iso)}`}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-zinc-800 transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Lista de Cards do Dia */}
                    <div className="p-2.5 flex-1 space-y-2.5">
                      {dayItems.length === 0 ? (
                        <div className="h-28 flex flex-col items-center justify-center text-center border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl p-3">
                          <span className="text-[11px] text-slate-400 dark:text-slate-500">
                            Sem pautas
                          </span>
                          <button
                            type="button"
                            onClick={() => openNewContentForDate(iso)}
                            className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-[#C54B00] underline"
                          >
                            + Agendar
                          </button>
                        </div>
                      ) : (
                        dayItems.map((item) => <ContentCard key={item.id} item={item} compact />)
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VISUALIZAÇÃO DIÁRIA */}
        {calendarView === 'daily' && (() => {
          const dayISO = toISODate(referenceDate);
          const items = filteredContents.filter((c) => c.date === dayISO);

          return (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-zinc-800">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white capitalize">
                    {formatFullDateBR(dayISO)}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {items.length}{' '}
                    {items.length === 1 ? 'conteúdo programado' : 'conteúdos programados'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openNewContentForDate(dayISO)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 px-3 py-2 rounded-xl transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar neste dia
                </button>
              </div>

              {items.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    Nenhuma publicação programada para esta data.
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 mb-4">
                    Clique abaixo para planejar um novo conteúdo para este dia.
                  </p>
                  <button
                    type="button"
                    onClick={() => openNewContentForDate(dayISO)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#C54B00] hover:bg-[#a63f00] px-4 py-2 text-xs font-semibold text-white"
                  >
                    <Plus className="w-4 h-4" />
                    Criar Publicação
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => {
                    const client = clientMap[item.clientId];
                    return (
                      <div
                        key={item.id}
                        onClick={() => setEditingContentId(item.id)}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 hover:border-[#000055]/40 dark:hover:border-[#C54B00]/60 hover:bg-slate-50/70 dark:hover:bg-zinc-800/50 cursor-pointer transition"
                      >
                        <div className="flex items-start sm:items-center gap-3.5">
                          <div className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-slate-800 dark:text-slate-200 tabular-nums shrink-0">
                            {item.time}
                          </div>
                          <div
                            className="w-1.5 h-10 rounded-full shrink-0 hidden sm:block"
                            style={{ backgroundColor: client?.accentColor || BRAND.navy }}
                          />
                          <div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-0.5">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {client?.name}
                              </span>
                              <span>•</span>
                              <span className="font-medium text-slate-600 dark:text-slate-400">
                                {item.format}
                              </span>
                            </div>
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                              {item.title}
                            </h4>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center">
                          <StatusBadge status={item.status} />
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* VISUALIZAÇÃO MENSAL (SUPORTA DINAMICAMENTE MESES DE 5 OU 6 SEMANAS) */}
        {calendarView === 'monthly' && (() => {
          const year = referenceDate.getFullYear();
          const month = referenceDate.getMonth();
          const firstDayOfMonth = new Date(year, month, 1);
          const lastDayOfMonth = new Date(year, month + 1, 0);
          const startGrid = getMondayOfWeek(firstDayOfMonth);
          const endGrid = addDays(getMondayOfWeek(lastDayOfMonth), 6);
          const totalDays =
            Math.round((endGrid.getTime() - startGrid.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          const totalCells = totalDays > 35 ? 42 : 35;
          const cells = Array.from({ length: totalCells }, (_, idx) => addDays(startGrid, idx));
          const weekLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

          return (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <div className="min-w-[820px]">
                  <div className="grid grid-cols-7 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/70">
                    {weekLabels.map((w) => (
                      <div
                        key={w}
                        className="py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                      >
                        {w}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 divide-x divide-y divide-slate-200/80 dark:divide-zinc-800">
                    {cells.map((cellDate) => {
                      const iso = toISODate(cellDate);
                      const isCurrentMonth = cellDate.getMonth() === month;
                      const isToday = iso === todayISO;
                      const cellItems = filteredContents.filter((c) => c.date === iso);

                      return (
                        <div
                          key={iso}
                          className={`min-h-[122px] p-2 flex flex-col justify-between transition-colors ${
                            isCurrentMonth
                              ? 'bg-white dark:bg-zinc-900'
                              : 'bg-slate-50/70 dark:bg-zinc-950/50'
                          } ${isToday ? 'ring-2 ring-inset ring-[#C54B00]' : ''}`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span
                              className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full tabular-nums ${
                                isToday
                                  ? 'bg-[#C54B00] text-white'
                                  : isCurrentMonth
                                  ? 'text-slate-800 dark:text-slate-200'
                                  : 'text-slate-400 dark:text-slate-600'
                              }`}
                            >
                              {cellDate.getDate()}
                            </span>
                            <button
                              type="button"
                              onClick={() => openNewContentForDate(iso)}
                              className="opacity-60 hover:opacity-100 p-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 dark:text-slate-400"
                              title="Adicionar publicação"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="space-y-1 flex-1">
                            {cellItems.slice(0, 3).map((item) => {
                              const client = clientMap[item.clientId];
                              const st = STATUS_CONFIG[item.status];
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => setEditingContentId(item.id)}
                                  className="w-full text-left px-1.5 py-1 rounded-lg bg-slate-50 dark:bg-zinc-800/80 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200/70 dark:border-zinc-700/80 flex items-center gap-1.5 transition"
                                >
                                  <span
                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                    style={{ backgroundColor: client?.accentColor || BRAND.navy }}
                                  />
                                  <span className="text-[11px] font-medium text-slate-800 dark:text-slate-200 truncate flex-1">
                                    {item.title}
                                  </span>
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${st.dot}`} />
                                </button>
                              );
                            })}
                            {cellItems.length > 3 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setReferenceDate(cellDate);
                                  setCalendarView('daily');
                                }}
                                className="w-full text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white pl-1 text-left"
                              >
                                + {cellItems.length - 3} mais...
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  // ==========================================================================
  // RENDERIZAÇÃO: VISÃO GERAL (RESUMO EXECUTIVO + BARRAS DE PROGRESSO)
  // ==========================================================================

  const renderOverviewModule = () => {
    const priorities = filteredContents.filter(
      (c) =>
        c.status === 'Pendente' ||
        c.status === 'Aguardando aprovação' ||
        (c.date < todayISO && c.status !== 'Publicado' && c.status !== 'Agendado')
    );

    const upcoming = filteredContents
      .filter((c) => c.date >= todayISO && c.status !== 'Publicado')
      .slice(0, 6);

    // Métricas gerais consolidadas da carteira
    const totalMonthlyGoal = clients.reduce((acc, c) => acc + c.monthlyGoal, 0);
    const totalPublishedAll = contents.filter((c) => c.status === 'Publicado').length;
    const totalReadyAll = contents.filter(
      (c) => c.status === 'Aprovado' || c.status === 'Agendado'
    ).length;
    const totalInProdAll = contents.filter(
      (c) =>
        c.status === 'Em produção' ||
        c.status === 'Em revisão' ||
        c.status === 'Aguardando aprovação'
    ).length;

    const pctPublishedOverall = totalMonthlyGoal
      ? Math.min(100, Math.round((totalPublishedAll / totalMonthlyGoal) * 100))
      : 0;
    const pctReadyOverall = totalMonthlyGoal
      ? Math.min(100 - pctPublishedOverall, Math.round((totalReadyAll / totalMonthlyGoal) * 100))
      : 0;
    const pctProdOverall = totalMonthlyGoal
      ? Math.min(
          100 - pctPublishedOverall - pctReadyOverall,
          Math.round((totalInProdAll / totalMonthlyGoal) * 100)
        )
      : 0;
    const pctTotalFulfilled = Math.min(
      100,
      Math.round(((totalPublishedAll + totalReadyAll) / (totalMonthlyGoal || 1)) * 100)
    );

    return (
      <div className="space-y-6">
        {/* BLOCO DE BARRAS VISUAIS DE PROGRESSO: GERAL + POR CLIENTE */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-2xs space-y-5">
          {/* Progresso Geral Consolidado */}
          <div className="pb-5 border-b border-slate-100 dark:border-zinc-800">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-2.5">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#C54B00]">
                  Performance Consolidada
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  Progresso Editorial Geral da Operação
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {totalPublishedAll} publicados e {totalReadyAll} aprovados/agendados de{' '}
                  {totalMonthlyGoal} publicações previstas no mês
                </p>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-2xl font-extrabold text-[#000055] dark:text-white tabular-nums">
                  {pctTotalFulfilled}%
                </span>
                <span className="block text-[11px] text-slate-400 dark:text-slate-500">
                  concluído / pronto para ir ao ar
                </span>
              </div>
            </div>

            {/* Barra Segmentada Geral */}
            <div className="h-3.5 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden flex p-0.5 gap-0.5">
              <div
                style={{ width: `${pctPublishedOverall}%` }}
                title={`Publicados: ${totalPublishedAll}`}
                className="h-full bg-emerald-500 rounded-l-full transition-all duration-500"
              />
              <div
                style={{ width: `${pctReadyOverall}%` }}
                title={`Aprovados / Agendados: ${totalReadyAll}`}
                className="h-full bg-[#000055] dark:bg-indigo-500 transition-all duration-500"
              />
              <div
                style={{ width: `${pctProdOverall}%` }}
                title={`Em Produção / Revisão: ${totalInProdAll}`}
                className="h-full bg-[#C54B00] rounded-r-full transition-all duration-500"
              />
            </div>

            {/* Legenda da Barra Geral */}
            <div className="flex flex-wrap items-center gap-4 mt-2.5 text-[11px] text-slate-600 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Publicados ({totalPublishedAll})
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#000055] dark:bg-indigo-500" />
                Aprovados & Agendados ({totalReadyAll})
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#C54B00]" />
                Em Produção & Revisão ({totalInProdAll})
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-200 dark:bg-zinc-700" />
                Meta Total ({totalMonthlyGoal} posts)
              </span>
            </div>
          </div>

          {/* Barras Visuais Individuais por Cliente */}
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Progresso Individual por Cliente
              </h4>
              <button
                type="button"
                onClick={() => setActiveModule('clients')}
                className="text-xs font-semibold text-[#C54B00] hover:text-[#a63f00]"
              >
                Ver carteiras →
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {clients.map((client) => {
                const clientItems = contents.filter((c) => c.clientId === client.id);
                const pubCount = clientItems.filter((c) => c.status === 'Publicado').length;
                const readyCount = clientItems.filter(
                  (c) => c.status === 'Aprovado' || c.status === 'Agendado'
                ).length;
                const prodCount = clientItems.filter(
                  (c) =>
                    c.status === 'Em produção' ||
                    c.status === 'Em revisão' ||
                    c.status === 'Aguardando aprovação'
                ).length;

                const pubPct = Math.min(100, Math.round((pubCount / client.monthlyGoal) * 100));
                const readyPct = Math.min(
                  100 - pubPct,
                  Math.round((readyCount / client.monthlyGoal) * 100)
                );
                const prodPct = Math.min(
                  100 - pubPct - readyPct,
                  Math.round((prodCount / client.monthlyGoal) * 100)
                );
                const totalClientPct = Math.min(
                  100,
                  Math.round(((pubCount + readyCount) / client.monthlyGoal) * 100)
                );

                return (
                  <div
                    key={client.id}
                    onClick={() => {
                      setSelectedClientIds([client.id]);
                      setActiveModule('calendar');
                    }}
                    className="p-3.5 rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/50 hover:border-[#000055]/40 dark:hover:border-[#C54B00]/60 cursor-pointer transition"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: client.accentColor }}
                        />
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {client.name}
                        </span>
                      </div>
                      <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 tabular-nums shrink-0">
                        {totalClientPct}%
                      </span>
                    </div>

                    {/* Barra Individual do Cliente */}
                    <div className="h-2.5 w-full bg-slate-200/80 dark:bg-zinc-800 rounded-full overflow-hidden flex mb-2">
                      <div
                        style={{
                          width: `${pubPct}%`,
                          backgroundColor: client.accentColor
                        }}
                        className="h-full transition-all duration-500"
                      />
                      <div
                        style={{
                          width: `${readyPct}%`,
                          backgroundColor: client.accentColor,
                          opacity: 0.55
                        }}
                        className="h-full transition-all duration-500"
                      />
                      <div
                        style={{
                          width: `${prodPct}%`,
                          backgroundColor: client.accentColor,
                          opacity: 0.25
                        }}
                        className="h-full transition-all duration-500"
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      <span>
                        {pubCount} pub. • {readyCount} prontos • {prodCount} prod.
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Meta: {client.monthlyGoal}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Coluna Esquerda: Atenção Imediata / Prioridades */}
          <div className="lg:col-span-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Prioridades & Gargalos
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pendências, atrasos e itens aguardando aprovação do cliente
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-semibold border border-amber-200 dark:border-amber-800">
                {priorities.length} itens
              </span>
            </div>

            {priorities.length === 0 ? (
              <div className="py-10 text-center border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl">
                <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Operação em dia!
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Nenhuma pendência crítica ou aprovação travada no momento.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {priorities.slice(0, 6).map((item) => {
                  const client = clientMap[item.clientId];
                  return (
                    <div
                      key={item.id}
                      onClick={() => setEditingContentId(item.id)}
                      className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 hover:border-[#000055]/40 dark:hover:border-[#C54B00]/60 hover:bg-slate-50/70 dark:hover:bg-zinc-800/50 cursor-pointer flex items-center justify-between gap-3 transition"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: client?.accentColor || BRAND.navy }}
                          />
                          <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                            {client?.name}
                          </span>
                          <span>•</span>
                          <span className="tabular-nums">{formatShortDateBR(item.date)}</span>
                        </div>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {item.title}
                        </p>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Coluna Direita: Próximas Publicações */}
          <div className="lg:col-span-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Próximos Conteúdos Programados
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cronograma imediato de entregas e postagens
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModule('calendar')}
                className="text-xs font-semibold text-[#C54B00] hover:text-[#a63f00] inline-flex items-center gap-1"
              >
                Abrir calendário <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {upcoming.length === 0 ? (
              <div className="py-10 text-center border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Nenhuma publicação futura encontrada com os filtros atuais.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {upcoming.map((item) => {
                  const client = clientMap[item.clientId];
                  return (
                    <div
                      key={item.id}
                      onClick={() => setEditingContentId(item.id)}
                      className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 hover:border-[#000055]/40 dark:hover:border-[#C54B00]/60 hover:bg-slate-50/70 dark:hover:bg-zinc-800/50 cursor-pointer flex items-center justify-between gap-3 transition"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">
                          <span className="font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                            {formatShortDateBR(item.date)} às {item.time}
                          </span>
                          <span>•</span>
                          <span className="font-medium truncate">{client?.name}</span>
                          <span>•</span>
                          <span>{item.format}</span>
                        </div>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {item.title}
                        </p>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ==========================================================================
  // RENDERIZAÇÃO: GESTÃO DE CLIENTES
  // ==========================================================================

  const renderClientsModule = () => {
    return (
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Carteira de Clientes ({clients.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Selecione um cliente para isolar seu calendário editorial ou edite metas mensais
            </p>
          </div>
          <button
            type="button"
            onClick={() => setClientModalState({ open: true, client: null })}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#C54B00] hover:bg-[#a63f00] px-3.5 py-2 text-xs font-semibold text-white transition self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Novo Cliente
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.map((client) => {
            const clientItems = contents.filter((c) => c.clientId === client.id);
            const publishedCount = clientItems.filter((c) => c.status === 'Publicado').length;
            const pendingCount = clientItems.filter((c) => c.status === 'Pendente').length;
            const readyOrPub = clientItems.filter((c) =>
              ['Aprovado', 'Agendado', 'Publicado'].includes(c.status)
            ).length;
            const progress = Math.min(100, Math.round((readyOrPub / client.monthlyGoal) * 100));

            return (
              <div
                key={client.id}
                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-300 dark:hover:border-zinc-700 transition shadow-2xs"
              >
                <div>
                  {/* Topo do Card: Apenas Nome e Segmento do Cliente */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: client.accentColor }}
                        />
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {client.name}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 pl-4">
                        {client.segment}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setClientModalState({ open: true, client })}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
                      title="Editar cliente"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Responsável e Meta */}
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-zinc-800/60 rounded-xl px-3 py-2 mb-4">
                    <span>
                      Gestor:{' '}
                      <strong className="text-slate-700 dark:text-slate-200">
                        {client.manager}
                      </strong>
                    </span>
                    <span>
                      Meta:{' '}
                      <strong className="text-slate-700 dark:text-slate-200">
                        {client.monthlyGoal} posts
                      </strong>
                    </span>
                  </div>

                  {/* Métricas do Cliente */}
                  <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
                      <div className="text-base font-bold text-slate-900 dark:text-white tabular-nums">
                        {clientItems.length}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Planejados
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                      <div className="text-base font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {publishedCount}
                      </div>
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                        Publicados
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50">
                      <div className="text-base font-bold text-rose-700 dark:text-rose-400 tabular-nums">
                        {pendingCount}
                      </div>
                      <div className="text-[11px] text-rose-700 dark:text-rose-400">Pendências</div>
                    </div>
                  </div>

                  {/* Barra de Progresso Editorial */}
                  <div className="mb-5">
                    <div className="flex justify-between text-[11px] font-semibold mb-1">
                      <span className="text-slate-500 dark:text-slate-400">Progresso de Produção</span>
                      <span className="text-slate-800 dark:text-slate-200 tabular-nums">{progress}%</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${progress}%`,
                          backgroundColor: client.accentColor
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClientIds([client.id]);
                      setActiveModule('calendar');
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#000055] hover:bg-[#000077] px-3 py-2 text-xs font-semibold text-white transition"
                  >
                    <CalendarIcon className="w-3.5 h-3.5" />
                    Abrir Calendário
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClientIds([client.id]);
                      setActiveModule('production');
                    }}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
                  >
                    Esteira
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ==========================================================================
  // RENDERIZAÇÃO: ESTEIRA DE PRODUÇÃO (VISÃO POR ETAPAS)
  // ==========================================================================

  const renderProductionModule = () => {
    const columns: { title: string; statuses: ContentStatus[] }[] = [
      { title: 'Planejado', statuses: ['Planejado'] },
      { title: 'Em Produção & Revisão', statuses: ['Em produção', 'Em revisão'] },
      { title: 'Aguardando Aprovação', statuses: ['Aguardando aprovação'] },
      { title: 'Pronto / Agendado', statuses: ['Aprovado', 'Agendado'] },
      { title: 'Publicado', statuses: ['Publicado'] }
    ];

    return (
      <div className="overflow-x-auto pb-3">
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 min-w-0 xl:min-w-[1120px]">
          {columns.map((col) => {
            const colItems = filteredContents.filter((c) => col.statuses.includes(c.status));
            return (
              <div
                key={col.title}
                className="bg-slate-50/80 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-2xl flex flex-col min-h-[480px]"
              >
                <div className="px-3.5 py-3 border-b border-slate-200/80 dark:border-zinc-800 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    {col.title}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                    {colItems.length}
                  </span>
                </div>
                <div className="p-2.5 space-y-2.5 flex-1">
                  {colItems.length === 0 ? (
                    <div className="h-24 flex items-center justify-center text-[11px] text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl">
                      Nenhum item nesta etapa
                    </div>
                  ) : (
                    colItems.map((item) => <ContentCard key={item.id} item={item} compact />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ==========================================================================
  // RENDERIZAÇÃO: PENDÊNCIAS E ATRASOS
  // ==========================================================================

  const renderPendingModule = () => {
    const pendingList = filteredContents.filter(
      (c) =>
        c.status === 'Pendente' ||
        (c.date < todayISO && c.status !== 'Publicado' && c.status !== 'Agendado')
    );

    return (
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100 dark:border-zinc-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Central de Pendências e Atrasos ({pendingList.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Conteúdos marcados como pendentes ou com data vencida sem publicação/agendamento
            </p>
          </div>
          <button
            type="button"
            onClick={() => openNewContentForDate()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#C54B00] hover:bg-[#a63f00] px-3.5 py-2 text-xs font-semibold text-white transition self-start"
          >
            <Plus className="w-4 h-4" />
            Nova Demanda
          </button>
        </div>

        {pendingList.length === 0 ? (
          <div className="py-14 text-center">
            <CheckCircle2 className="w-9 h-9 text-emerald-500 mx-auto mb-2.5" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Nenhuma pendência encontrada
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Todos os conteúdos filtrados estão dentro do cronograma esperado.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingList.map((item) => {
              const client = clientMap[item.clientId];
              const isDateLate = item.date < todayISO;

              return (
                <div
                  key={item.id}
                  onClick={() => setEditingContentId(item.id)}
                  className="p-4 rounded-2xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/20 hover:bg-rose-50/50 dark:hover:bg-rose-950/35 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        {client?.name}
                      </span>
                      <span className="text-slate-400">•</span>
                      <span className="font-medium text-slate-600 dark:text-slate-300">
                        {item.format}
                      </span>
                      <span className="text-slate-400">•</span>
                      <span
                        className={`font-semibold tabular-nums ${
                          isDateLate
                            ? 'text-rose-700 dark:text-rose-400'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Previsto: {formatShortDateBR(item.date)} às {item.time}
                        {isDateLate ? ' (Atrasado)' : ''}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {item.title}
                    </h4>
                  </div>

                  <div className="flex items-center gap-3 self-end md:self-center shrink-0">
                    <StatusBadge status={item.status} />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateContent(item.id, { status: 'Em produção' });
                        triggerToast('Status movido para Em produção.');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-zinc-700 transition"
                    >
                      Retomar Produção
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ==========================================================================
  // LAYOUT PRINCIPAL (SIDEBAR + HEADER + KPI BAR + WORKSPACE + DRAWER)
  // ==========================================================================

  const navItems: {
    id: ActiveModule;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    {
      id: 'overview',
      label: 'Visão Geral',
      icon: <LayoutDashboard className="w-4 h-4" />
    },
    {
      id: 'calendar',
      label: 'Calendário Editorial',
      icon: <CalendarIcon className="w-4 h-4" />
    },
    {
      id: 'clients',
      label: 'Clientes',
      icon: <Users className="w-4 h-4" />,
      badge: clients.length
    },
    {
      id: 'production',
      label: 'Produção',
      icon: <Layers className="w-4 h-4" />,
      badge: metrics.inProduction
    },
    {
      id: 'pending',
      label: 'Pendências',
      icon: <AlertCircle className="w-4 h-4" />,
      badge: metrics.pendingOrOverdue
    }
  ];

  // ==========================================================================
  // PORTAL DE AUTENTICAÇÃO (EXIBIDO QUANDO NÃO HÁ SESSÃO ATIVA)
  // ==========================================================================
  if (!currentUser) {
    return (
      <div className={darkMode ? 'dark' : ''}>
        <AuthPortal
          screen={authScreen}
          onNavigateScreen={(next) => setAuthScreen(next)}
          resetEmailTarget={resetEmailTarget}
          onSetResetEmailTarget={setResetEmailTarget}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((prev) => !prev)}
          onAuthenticated={(user) => {
            setCurrentUser(user);
            triggerToast(`Bem-vindo(a), ${user.name}!`);
          }}
        />
      </div>
    );
  }

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div
        style={{ fontFamily: "'Sora', sans-serif" }}
        className="min-h-screen bg-[#F6F7FB] dark:bg-[#000000] text-[#000000] dark:text-slate-100 flex antialiased transition-colors duration-200"
      >
        {/* Backdrop Mobile Sidebar */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 dark:bg-black/75 z-30 lg:hidden backdrop-blur-2xs"
          />
        )}

        {/* ==================================================================== */}
        {/* SIDEBAR DE NAVEGAÇÃO LATERAL                                         */}
        {/* ==================================================================== */}
        <aside
          className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-white dark:bg-[#08080C] border-r border-slate-200 dark:border-zinc-800/90 flex flex-col justify-between transition-transform duration-200 ease-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div>
            {/* Identidade da Marca OP Growth Digital */}
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/90 bg-[#000055] text-white">
              <div className="flex items-center gap-3 min-w-0">
                {/* Logo OP GROWTH (versão branca + barra degradê) */}
                <svg
                  viewBox="0 0 220 145"
                  className="h-9 w-auto shrink-0"
                  role="img"
                  aria-label="Logo OP Growth"
                >
                  <defs>
                    <linearGradient id="opGrowthBarGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#000055" />
                      <stop offset="100%" stopColor="#C54B00" />
                    </linearGradient>
                  </defs>
                  {/* Letras O P */}
                  <text
                    x="110"
                    y="82"
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontFamily="'Sora', sans-serif"
                    fontWeight="800"
                    fontSize="84"
                    letterSpacing="-3"
                  >
                    OP
                  </text>
                  {/* Barra degradê com GROWTH */}
                  <rect
                    x="6"
                    y="98"
                    width="208"
                    height="42"
                    rx="11"
                    fill="url(#opGrowthBarGrad)"
                    stroke="#FFFFFF"
                    strokeOpacity="0.16"
                    strokeWidth="1.5"
                  />
                  <text
                    x="110"
                    y="128"
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontFamily="'Sora', sans-serif"
                    fontWeight="800"
                    fontSize="27"
                    letterSpacing="2.5"
                  >
                    GROWTH
                  </text>
                </svg>

                <div className="min-w-0">
                  <div className="text-xs font-bold tracking-tight text-white leading-tight truncate">
                    Editorial Control Hub
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-1.5 rounded-xl text-white/70 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Menu Principal */}
            <nav aria-label="Navegação Principal" className="p-3 space-y-1">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Operação Editorial
              </div>
              {navItems.map((nav) => {
                const isActive = activeModule === nav.id;
                return (
                  <button
                    key={nav.id}
                    type="button"
                    onClick={() => {
                      setActiveModule(nav.id);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-[#000055] text-white shadow-2xs ring-1 ring-[#C54B00]/40'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-900 hover:text-[#000055] dark:hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className={isActive ? 'text-[#C54B00]' : ''}>{nav.icon}</span>
                      {nav.label}
                    </span>
                    {typeof nav.badge === 'number' && nav.badge > 0 && (
                      <span
                        className={`text-[11px] px-1.5 py-0.5 rounded-lg tabular-nums ${
                          isActive
                            ? 'bg-[#C54B00] text-white font-bold'
                            : nav.id === 'pending'
                            ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                            : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {nav.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Filtro Rápido por Carteira de Clientes na Sidebar */}
            <div className="px-3 pt-2">
              <div className="px-3 py-1.5 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Clientes Ativos
                </span>
                {selectedClientIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedClientIds([])}
                    className="text-[11px] font-medium text-[#C54B00] hover:text-[#a63f00] underline"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                {clients.map((client) => {
                  const isSelected = selectedClientIds.includes(client.id);
                  return (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => toggleClientFilter(client.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition ${
                        isSelected
                          ? 'bg-[#000055]/10 dark:bg-[#000055]/40 text-[#000055] dark:text-white font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-900'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: client.accentColor }}
                        />
                        <span className="truncate">{client.name}</span>
                      </span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-[#C54B00] shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Rodapé da Sidebar: Usuário Autenticado + Logout */}
          <div className="p-4 border-t border-slate-100 dark:border-zinc-800/90 space-y-2.5">
            <div className="rounded-2xl bg-slate-50 dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800 p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {currentUser.name}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {currentUser.role}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCurrentUser(null);
                  setAuthScreen('login');
                }}
                title="Encerrar sessão"
                aria-label="Encerrar sessão"
                className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* ==================================================================== */}
        {/* ÁREA PRINCIPAL DE CONTEÚDO                                           */}
        {/* ==================================================================== */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header Superior Global */}
          <header className="sticky top-0 z-20 h-16 bg-white/95 dark:bg-[#08080C]/95 backdrop-blur-xs border-b border-slate-200 dark:border-zinc-800 px-4 sm:px-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                aria-label="Abrir menu"
                className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-base font-bold text-[#000055] dark:text-white leading-tight">
                  {navItems.find((n) => n.id === activeModule)?.label}
                </h1>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                  {selectedClientIds.length === 0
                    ? 'Visão consolidada de todos os clientes'
                    : `Filtrado por ${selectedClientIds.length} ${
                        selectedClientIds.length === 1 ? 'cliente' : 'clientes'
                      }`}
                </p>
              </div>
            </div>

            {/* Barra de Busca + Filtro de Status + Alternador Tema Claro/Escuro */}
            <div className="flex items-center gap-2 sm:gap-2.5 flex-1 max-w-xl justify-end">
              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar tema, copy, formato ou cliente..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:bg-white dark:focus:bg-zinc-950 focus:border-[#000055] dark:focus:border-[#C54B00] transition"
                />
              </div>

              <select
                aria-label="Filtrar por status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ContentStatus | 'ALL')}
                className="hidden sm:block text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-2.5 py-1.5 text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:border-[#000055] dark:focus:border-[#C54B00]"
              >
                <option value="ALL">Todos status</option>
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              {(selectedClientIds.length > 0 || statusFilter !== 'ALL' || searchQuery !== '') && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClientIds([]);
                    setStatusFilter('ALL');
                    setSearchQuery('');
                  }}
                  className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 px-2 py-1.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/50 transition whitespace-nowrap"
                >
                  Resetar
                </button>
              )}

              {/* Alternador Tema Claro / Tema Escuro */}
              <button
                type="button"
                onClick={() => setDarkMode((prev) => !prev)}
                aria-label={darkMode ? 'Ativar tema claro' : 'Ativar tema escuro'}
                title={darkMode ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-zinc-800 transition shrink-0"
              >
                {darkMode ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-[#C54B00]" />
                    <span className="hidden md:inline">Claro</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-[#000055]" />
                    <span className="hidden md:inline">Escuro</span>
                  </>
                )}
              </button>
            </div>
          </header>

          {/* Faixa de Indicadores Operacionais (KPIs Dinâmicos) */}
          <section
            aria-label="Indicadores Editoriais"
            className="px-4 sm:px-6 pt-5 pb-1"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-3.5">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Total Planejado
                </div>
                <div className="text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                  {metrics.totalPlanned}
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-3.5">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Previstos na Semana
                </div>
                <div className="text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                  {metrics.thisWeekCount}
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-3.5">
                <div className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                  Em Produção
                </div>
                <div className="text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                  {metrics.inProduction}
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-3.5">
                <div className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                  Aguard. Aprovação
                </div>
                <div className="text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                  {metrics.awaitingApproval}
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-3.5">
                <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                  Publicados
                </div>
                <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1 tabular-nums">
                  {metrics.published}
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-3.5">
                <div className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                  Pendências / Atrasos
                </div>
                <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1 tabular-nums">
                  {metrics.pendingOrOverdue}
                </div>
              </div>
            </div>

            {/* Chips de Filtro Rápido por Cliente */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-3 no-scrollbar">
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mr-1 shrink-0">
                Clientes:
              </span>
              <button
                type="button"
                onClick={() => setSelectedClientIds([])}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition shrink-0 ${
                  selectedClientIds.length === 0
                    ? 'bg-[#000055] text-white'
                    : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800'
                }`}
              >
                Todos ({clients.length})
              </button>
              {clients.map((c) => {
                const active = selectedClientIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleClientFilter(c.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition shrink-0 ${
                      active
                        ? 'bg-[#000055] text-white border-[#000055]'
                        : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: c.accentColor
                      }}
                    />
                    {c.name}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Workspace Dinâmico conforme Módulo Selecionado */}
          <main className="flex-1 px-4 sm:px-6 pb-10">
            {activeModule === 'calendar' && renderCalendarModule()}
            {activeModule === 'overview' && renderOverviewModule()}
            {activeModule === 'clients' && renderClientsModule()}
            {activeModule === 'production' && renderProductionModule()}
            {activeModule === 'pending' && renderPendingModule()}
          </main>
        </div>

        {/* ==================================================================== */}
        {/* PAINEL DE DETALHES DA PUBLICAÇÃO (SLIDE-OVER DRAWER)                 */}
        {/* ==================================================================== */}
        {editingContent && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div
              onClick={() => setEditingContentId(null)}
              className="fixed inset-0 bg-black/50 dark:bg-black/75 backdrop-blur-2xs transition-opacity"
            />
            <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-zinc-900 h-full shadow-2xl border-l border-slate-200 dark:border-zinc-800 flex flex-col">
              {/* Cabeçalho do Drawer */}
              <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{
                      backgroundColor: clientMap[editingContent.clientId]?.accentColor || BRAND.navy
                    }}
                  />
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate">
                    {clientMap[editingContent.clientId]?.name}
                  </span>
                  <span className="text-slate-300 dark:text-zinc-700">/</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">Ficha Editorial</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDeleteContent(editingContent.id)}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition"
                    title="Excluir publicação"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingContentId(null)}
                    className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
                    title="Fechar painel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Corpo Rolável do Drawer */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Título da Publicação */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                    Título ou Tema da Publicação
                  </label>
                  <input
                    type="text"
                    value={editingContent.title}
                    onChange={(e) =>
                      handleUpdateContent(editingContent.id, { title: e.target.value })
                    }
                    className="w-full text-sm font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 focus:bg-white dark:focus:bg-zinc-900 focus:border-[#000055] dark:focus:border-[#C54B00] focus:outline-none"
                  />
                </div>

                {/* Metadados Principais: Cliente, Status, Data, Hora, Formato */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Cliente
                    </label>
                    <select
                      value={editingContent.clientId}
                      onChange={(e) =>
                        handleUpdateContent(editingContent.id, { clientId: e.target.value })
                      }
                      className="w-full text-xs font-medium bg-white dark:bg-zinc-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-zinc-800 rounded-xl px-2.5 py-2 focus:outline-none focus:border-[#000055] dark:focus:border-[#C54B00]"
                    >
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Status Atual
                    </label>
                    <select
                      value={editingContent.status}
                      onChange={(e) =>
                        handleUpdateContent(editingContent.id, {
                          status: e.target.value as ContentStatus
                        })
                      }
                      className="w-full text-xs font-semibold bg-white dark:bg-zinc-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-zinc-800 rounded-xl px-2.5 py-2 focus:outline-none focus:border-[#000055] dark:focus:border-[#C54B00]"
                    >
                      {ALL_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Data Programada
                    </label>
                    <input
                      type="date"
                      value={editingContent.date}
                      onChange={(e) =>
                        handleUpdateContent(editingContent.id, { date: e.target.value })
                      }
                      className="w-full text-xs font-medium bg-white dark:bg-zinc-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-zinc-800 rounded-xl px-2.5 py-2 focus:outline-none focus:border-[#000055] dark:focus:border-[#C54B00]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Horário
                      </label>
                      <input
                        type="time"
                        value={editingContent.time}
                        onChange={(e) =>
                          handleUpdateContent(editingContent.id, { time: e.target.value })
                        }
                        className="w-full text-xs font-medium bg-white dark:bg-zinc-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-zinc-800 rounded-xl px-2 py-2 focus:outline-none focus:border-[#000055] dark:focus:border-[#C54B00]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Formato
                      </label>
                      <select
                        value={editingContent.format}
                        onChange={(e) =>
                          handleUpdateContent(editingContent.id, {
                            format: e.target.value as ContentFormat
                          })
                        }
                        className="w-full text-xs font-medium bg-white dark:bg-zinc-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-zinc-800 rounded-xl px-2 py-2 focus:outline-none focus:border-[#000055] dark:focus:border-[#C54B00]"
                      >
                        {ALL_FORMATS.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Campos de Conteúdo Editorial: Briefing, Texto da Arte e Copy */}
                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                      Briefing de Criação
                    </label>
                    <textarea
                      rows={3}
                      value={editingContent.briefing}
                      onChange={(e) =>
                        handleUpdateContent(editingContent.id, { briefing: e.target.value })
                      }
                      placeholder="Direcionamento criativo, objetivo da peça, referências de estilo..."
                      className="w-full text-xs bg-white dark:bg-zinc-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-[#000055] dark:focus:border-[#C54B00] leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      Texto da Arte / Roteiro de Slides
                    </label>
                    <textarea
                      rows={4}
                      value={editingContent.artText}
                      onChange={(e) =>
                        handleUpdateContent(editingContent.id, { artText: e.target.value })
                      }
                      placeholder="Headline, subtítulo ou divisão de slides do carrossel..."
                      className="w-full text-xs bg-white dark:bg-zinc-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-[#000055] dark:focus:border-[#C54B00] leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      Copy / Legenda
                    </label>
                    <textarea
                      rows={4}
                      value={editingContent.copy}
                      onChange={(e) =>
                        handleUpdateContent(editingContent.id, { copy: e.target.value })
                      }
                      placeholder="Escreva a legenda completa da publicação..."
                      className="w-full text-xs bg-white dark:bg-zinc-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 focus:outline-none focus:border-[#000055] dark:focus:border-[#C54B00] leading-relaxed"
                    />
                  </div>
                </div>
              </div>

              {/* Rodapé Fixo do Drawer */}
              <div className="px-5 py-3.5 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/70 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Alterações salvas automaticamente na sessão
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingContentId(null);
                    triggerToast('Alterações aplicadas ao calendário.');
                  }}
                  className="px-4 py-2 rounded-xl bg-[#C54B00] hover:bg-[#a63f00] text-white text-xs font-semibold transition"
                >
                  Concluir Edição
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODAL: NOVA PUBLICAÇÃO                                               */}
        {/* ==================================================================== */}
        {isNewContentModalOpen && (
          <NewContentModal
            clients={clients}
            defaultDate={newContentDefaultDate}
            defaultClientId={selectedClientIds[0] || clients[0]?.id || ''}
            onClose={() => setIsNewContentModalOpen(false)}
            onCreate={handleCreateContent}
          />
        )}

        {/* ==================================================================== */}
        {/* MODAL: CADASTRO / EDIÇÃO DE CLIENTE                                  */}
        {/* ==================================================================== */}
        {clientModalState.open && (
          <ClientFormModal
            initialClient={clientModalState.client}
            onClose={() => setClientModalState({ open: false, client: null })}
            onSave={handleSaveClient}
          />
        )}

        {/* ==================================================================== */}
        {/* TOAST FEEDBACK                                                       */}
        {/* ==================================================================== */}
        {toastMessage && (
          <div className="fixed bottom-5 right-5 z-50 bg-[#000055] text-white border border-[#C54B00]/60 text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#C54B00]" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SUBCOMPONENTE: MODAL DE CRIAÇÃO DE NOVA PUBLICAÇÃO
// ============================================================================

function NewContentModal({
  clients,
  defaultDate,
  defaultClientId,
  onClose,
  onCreate
}: {
  clients: Client[];
  defaultDate: string;
  defaultClientId: string;
  onClose: () => void;
  onCreate: (item: Omit<EditorialContent, 'id'>) => void;
}) {
  const [clientId, setClientId] = useState(defaultClientId);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('12:00');
  const [format, setFormat] = useState<ContentFormat>('Carrossel');
  const [status, setStatus] = useState<ContentStatus>('Planejado');
  const [briefing, setBriefing] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !clientId) return;

    onCreate({
      clientId,
      title: title.trim(),
      date,
      time,
      format,
      status,
      briefing,
      artText: '',
      copy: ''
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/50 dark:bg-black/75 backdrop-blur-2xs"
      />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Nova Publicação no Calendário
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Cliente *
            </label>
            <select
              required
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full text-xs bg-white dark:bg-zinc-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2 focus:outline-none focus:border-[#000055] dark:focus:border-[#C54B00]"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Título ou Tema *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: 5 Erros Comuns na Gestão de Tráfego Pago"
              className="w-full text-xs bg-white dark:bg-zinc-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2 focus:outline-none focus:border-[#000055] dark:focus:border-[#C54B00]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Data
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs bg-white dark:bg-zinc-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2 focus:outline-none focus:border-[#000055] dark:focus:border-[#C54B00]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Horário
              </label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full text-xs bg-white dark:bg-zinc-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2 focus:outline-none focus:border-[#000055] dark:focus:border-[#C54B00]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Formato
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as ContentFormat)}
                className="w-full text-xs bg-white dark:bg-zinc-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-zinc-800 rounded-lg px-2.5 py-2 focus:outline-none focus:border-[#000055] dark:focus:border-[#C54B00]"
              >
                {ALL_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Status Inicial
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ContentStatus)}
                className="w-full text-xs bg-white dark:bg-zinc-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-zinc-800 rounded-lg px-2.5 py-2 focus:outline-none focus:border-[#000055] dark:focus:border-[#C54B00]"
              >
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Briefing Inicial (Opcional)
            </label>
            <textarea
              rows={2}
              value={briefing}
              onChange={(e) => setBriefing(e.target.value)}
              placeholder="Notas rápidas para redação e design..."
              className="w-full text-xs bg-white dark:bg-zinc-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 focus:outline-none focus:border-[#000055] dark:focus:border-[#C54B00]"
            />
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/70 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-[#C54B00] hover:bg-[#a63f00] text-white text-xs font-semibold transition"
          >
            Criar Publicação
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// MÓDULO DE AUTENTICAÇÃO E CADASTRO (PREPARADO PARA FUTURA INTEGRAÇÃO API)
// ============================================================================

function OpGrowthBrandLogo({ className = 'h-11 w-auto' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 145"
      className={className}
      role="img"
      aria-label="Logo OP Growth"
    >
      <defs>
        <linearGradient id="opGrowthAuthBarGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#000055" />
          <stop offset="100%" stopColor="#C54B00" />
        </linearGradient>
      </defs>
      <text
        x="110"
        y="82"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="'Sora', sans-serif"
        fontWeight="800"
        fontSize="84"
        letterSpacing="-3"
      >
        OP
      </text>
      <rect
        x="6"
        y="98"
        width="208"
        height="42"
        rx="11"
        fill="url(#opGrowthAuthBarGrad)"
        stroke="#FFFFFF"
        strokeOpacity="0.18"
        strokeWidth="1.5"
      />
      <text
        x="110"
        y="128"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="'Sora', sans-serif"
        fontWeight="800"
        fontSize="27"
        letterSpacing="2.5"
      >
        GROWTH
      </text>
    </svg>
  );
}

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

function AuthPortal({
  screen,
  onNavigateScreen,
  resetEmailTarget,
  onSetResetEmailTarget,
  darkMode,
  onToggleDarkMode,
  onAuthenticated
}: {
  screen: AuthScreen;
  onNavigateScreen: (screen: AuthScreen) => void;
  resetEmailTarget: string;
  onSetResetEmailTarget: (email: string) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onAuthenticated: (user: AuthUser) => void;
}) {
  // Base simulada de contas na sessão atual
  const [mockUsers, setMockUsers] = useState<
    (AuthUser & { password: string })[]
  >([
    {
      id: 'usr-1',
      name: 'Camila Rocha',
      email: 'camila@opgrowth.com.br',
      role: 'Head de Conteúdo',
      password: 'OpGrowth@2026'
    },
    {
      id: 'usr-2',
      name: 'Lucas Mendes',
      email: 'lucas@opgrowth.com.br',
      role: 'Gestor de Contas',
      password: 'OpGrowth@2026'
    }
  ]);

  // Estados compartilhados de formulário e feedback
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Campos de Login
  const [loginEmail, setLoginEmail] = useState('camila@opgrowth.com.br');
  const [loginPassword, setLoginPassword] = useState('OpGrowth@2026');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Campos de Cadastro
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState('Social Media & Conteúdo');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);

  // Campos de Recuperação & Redefinição de Senha
  const [forgotEmail, setForgotEmail] = useState('');
  const [recoverySent, setRecoverySent] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  // Refs para iluminação interativa sem re-renderizações durante o movimento do mouse
  const leftPanelRef = React.useRef<HTMLDivElement | null>(null);
  const glowLayerRef = React.useRef<HTMLDivElement | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const pointerPosRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Controle explícito de montagem para garantir execução confiável do Fade In na prévia
  const [hasEntered, setHasEntered] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    if (mediaQuery.matches) {
      setHasEntered(true);
      return;
    }

    // Garante que o browser pinte o estado inicial (opacity: 0, translateX: ±30px)
    // antes de disparar a transição de 700ms ease-out
    let innerRaf = 0;
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(() => {
        setHasEntered(true);
      });
    });

    return () => {
      cancelAnimationFrame(outerRaf);
      if (innerRaf) cancelAnimationFrame(innerRaf);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // Helper determinístico para animação escalonada de entrada (700ms ease-out, step ~100ms)
  const getEntranceStyle = (
    direction: 'left' | 'right',
    stepIndex: number
  ): React.CSSProperties => {
    if (prefersReducedMotion) {
      return { opacity: 1, transform: 'translateX(0px)' };
    }
    const offset = direction === 'left' ? -30 : 30;
    return {
      opacity: hasEntered ? 1 : 0,
      transform: hasEntered ? 'translateX(0px)' : `translateX(${offset}px)`,
      transitionProperty: 'opacity, transform',
      transitionDuration: '700ms',
      transitionTimingFunction: 'ease-out',
      transitionDelay: `${120 + stepIndex * 100}ms`,
      willChange: hasEntered ? 'auto' : 'opacity, transform'
    };
  };

  const handleLeftPanelMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!leftPanelRef.current || !glowLayerRef.current) return;
    const rect = leftPanelRef.current.getBoundingClientRect();
    pointerPosRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        if (glowLayerRef.current) {
          glowLayerRef.current.style.setProperty('--glow-x', `${pointerPosRef.current.x}px`);
          glowLayerRef.current.style.setProperty('--glow-y', `${pointerPosRef.current.y}px`);
        }
        rafRef.current = null;
      });
    }
  };

  const handleLeftPanelMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!leftPanelRef.current || !glowLayerRef.current) return;
    const rect = leftPanelRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    glowLayerRef.current.style.setProperty('--glow-x', `${x}px`);
    glowLayerRef.current.style.setProperty('--glow-y', `${y}px`);
    glowLayerRef.current.style.opacity = '1';
  };

  const handleLeftPanelMouseLeave = () => {
    if (!glowLayerRef.current) return;
    glowLayerRef.current.style.opacity = '0';
  };

  const switchScreen = (next: AuthScreen) => {
    setFormError(null);
    setFormSuccess(null);
    setFieldErrors({});
    setRecoverySent(false);
    onNavigateScreen(next);
  };

  // Cálculo visual de força de senha
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: '', color: 'bg-slate-200 dark:bg-zinc-800' };
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 1) return { score: 1, label: 'Fraca', color: 'bg-rose-500' };
    if (score === 2) return { score: 2, label: 'Média', color: 'bg-amber-500' };
    if (score === 3) return { score: 3, label: 'Boa', color: 'bg-[#000055] dark:bg-indigo-400' };
    return { score: 4, label: 'Forte', color: 'bg-emerald-500' };
  };

  // 1. SUBMIT LOGIN
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const errors: Record<string, string> = {};
    if (!loginEmail.trim()) {
      errors.loginEmail = 'Informe seu e-mail corporativo.';
    } else if (!isValidEmail(loginEmail)) {
      errors.loginEmail = 'Formato de e-mail inválido.';
    }

    if (!loginPassword) {
      errors.loginPassword = 'Informe sua senha de acesso.';
    } else if (loginPassword.length < 6) {
      errors.loginPassword = 'A senha deve conter pelo menos 6 caracteres.';
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    setTimeout(() => {
      const matched = mockUsers.find(
        (u) => u.email.toLowerCase() === loginEmail.trim().toLowerCase()
      );

      if (!matched || matched.password !== loginPassword) {
        setLoading(false);
        setFormError(
          'E-mail ou senha incorretos. Verifique seus dados ou use o acesso de demonstração.'
        );
        return;
      }

      setLoading(false);
      onAuthenticated({
        id: matched.id,
        name: matched.name,
        email: matched.email,
        role: matched.role
      });
    }, 650);
  };

  // 2. SUBMIT CADASTRO
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const errors: Record<string, string> = {};
    if (regName.trim().length < 3) {
      errors.regName = 'Digite seu nome completo (mínimo 3 caracteres).';
    }
    if (!regEmail.trim()) {
      errors.regEmail = 'O e-mail é obrigatório.';
    } else if (!isValidEmail(regEmail)) {
      errors.regEmail = 'Insira um endereço de e-mail válido.';
    } else if (
      mockUsers.some((u) => u.email.toLowerCase() === regEmail.trim().toLowerCase())
    ) {
      errors.regEmail = 'Este e-mail já está cadastrado na plataforma.';
    }

    if (regPassword.length < 8) {
      errors.regPassword = 'Crie uma senha com no mínimo 8 caracteres.';
    }
    if (regConfirmPassword !== regPassword) {
      errors.regConfirmPassword = 'As senhas digitadas não coincidem.';
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    setTimeout(() => {
      const createdUser: AuthUser & { password: string } = {
        id: `usr-${Date.now()}`,
        name: regName.trim(),
        email: regEmail.trim().toLowerCase(),
        role: regRole.trim() || 'Especialista Editorial',
        password: regPassword
      };

      setMockUsers((prev) => [...prev, createdUser]);
      setLoading(false);
      setFormSuccess('Conta criada com sucesso! Redirecionando para o dashboard...');

      setTimeout(() => {
        onAuthenticated({
          id: createdUser.id,
          name: createdUser.name,
          email: createdUser.email,
          role: createdUser.role
        });
      }, 750);
    }, 750);
  };

  // 3. SUBMIT RECUPERAÇÃO DE SENHA
  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const errors: Record<string, string> = {};
    if (!forgotEmail.trim()) {
      errors.forgotEmail = 'Informe o e-mail vinculado à sua conta.';
    } else if (!isValidEmail(forgotEmail)) {
      errors.forgotEmail = 'Formato de e-mail inválido.';
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setRecoverySent(true);
      onSetResetEmailTarget(forgotEmail.trim().toLowerCase());
      setFormSuccess(
        `Instruções de recuperação enviadas para ${forgotEmail.trim().toLowerCase()}.`
      );
    }, 700);
  };

  // 4. SUBMIT REDEFINIÇÃO DE SENHA
  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const errors: Record<string, string> = {};
    if (newPassword.length < 8) {
      errors.newPassword = 'A nova senha precisa ter no mínimo 8 caracteres.';
    }
    if (confirmNewPassword !== newPassword) {
      errors.confirmNewPassword = 'A confirmação não corresponde à nova senha.';
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    setTimeout(() => {
      if (resetEmailTarget) {
        setMockUsers((prev) =>
          prev.map((u) =>
            u.email.toLowerCase() === resetEmailTarget.toLowerCase()
              ? { ...u, password: newPassword }
              : u
          )
        );
        setLoginEmail(resetEmailTarget);
      }
      setLoginPassword(newPassword);
      setNewPassword('');
      setConfirmNewPassword('');
      setLoading(false);
      setFormSuccess('Senha redefinida com sucesso! Você já pode entrar com sua nova senha.');

      setTimeout(() => {
        switchScreen('login');
        setFormSuccess('Senha atualizada! Faça login com suas novas credenciais.');
      }, 950);
    }, 750);
  };

  const regStrength = getPasswordStrength(regPassword);
  const resetStrength = getPasswordStrength(newPassword);

  return (
    <div
      style={{ fontFamily: "'Sora', sans-serif" }}
      className="min-h-screen bg-[#F6F7FB] dark:bg-[#000000] text-[#000000] dark:text-slate-100 flex flex-col lg:flex-row antialiased transition-colors duration-200 overflow-x-hidden"
    >
      {/* Regras para iluminação radial ambiente no painel esquerdo */}
      <style>{`
        .op-interactive-glow {
          opacity: 0;
          transition: opacity 420ms ease-out;
          background: radial-gradient(
            380px circle at var(--glow-x, 50%) var(--glow-y, 50%),
            rgba(197, 75, 0, 0.16) 0%,
            rgba(197, 75, 0, 0.06) 42%,
            rgba(197, 75, 0, 0) 75%
          );
          will-change: opacity;
        }

        @media (hover: none), (pointer: coarse) {
          .op-interactive-glow {
            display: none !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .op-interactive-glow {
            display: none !important;
          }
        }
      `}</style>

      {/* ==================================================================== */}
      {/* COLUNA ESQUERDA: PAINEL INSTITUCIONAL OP GROWTH DIGITAL               */}
      {/* ==================================================================== */}
      <div
        ref={leftPanelRef}
        onMouseMove={handleLeftPanelMouseMove}
        onMouseEnter={handleLeftPanelMouseEnter}
        onMouseLeave={handleLeftPanelMouseLeave}
        style={{
          background: 'linear-gradient(155deg, #020214 0%, #01010B 52%, #000005 100%)'
        }}
        className="lg:w-[46%] xl:w-[44%] text-white p-7 sm:p-10 lg:p-12 flex flex-col justify-between relative overflow-hidden border-b lg:border-b-0 lg:border-r border-white/[0.06]"
      >
        {/* Iluminação radial ambiente que acompanha suavemente o cursor */}
        <div
          ref={glowLayerRef}
          aria-hidden="true"
          className="op-interactive-glow pointer-events-none absolute inset-0 z-[1]"
        />

        {/* Detalhe geométrico sutil para profundidade visual */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-28 -left-24 w-80 h-80 rounded-full opacity-20 blur-3xl"
          style={{ backgroundColor: '#000055' }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 -right-24 w-80 h-80 rounded-full opacity-[0.12] blur-3xl"
          style={{ backgroundColor: '#C54B00' }}
        />

        {/* Topo: Logo OP Growth + Editorial Control Hub */}
        <div
          style={getEntranceStyle('left', 0)}
          className="relative z-10 flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5">
            <OpGrowthBrandLogo className="h-11 w-auto shrink-0" />
            <div className="text-sm font-bold tracking-tight text-white leading-tight">
              Editorial Control Hub
            </div>
          </div>

          {/* Alternador de tema no mobile */}
          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label={darkMode ? 'Ativar tema claro' : 'Ativar tema escuro'}
            className="lg:hidden p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
          >
            {darkMode ? <Sun className="w-4 h-4 text-[#C54B00]" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Centro: Proposta de Valor da Plataforma */}
        <div className="relative z-10 my-10 lg:my-0 space-y-5 max-w-md">
          <h2
            style={getEntranceStyle('left', 1)}
            className="text-2xl sm:text-3xl font-extrabold leading-tight tracking-tight"
          >
            Planejamento, produção e aprovação de conteúdo em um só lugar.
          </h2>
          <p
            style={getEntranceStyle('left', 2)}
            className="text-xs sm:text-sm text-white/75 leading-relaxed"
          >
            Acompanhe o calendário semanal de cada cliente, controle gargalos de aprovação e
            garanta entregas pontuais para toda a carteira da OP Growth Digital.
          </p>

          <div
            style={getEntranceStyle('left', 3)}
            className="grid grid-cols-3 gap-3 pt-2"
          >
            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-3">
              <div className="text-lg font-extrabold text-white">360°</div>
              <div className="text-[11px] text-white/65 mt-0.5">Visão por cliente</div>
            </div>
            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-3">
              <div className="text-lg font-extrabold text-[#ff8b42]">100%</div>
              <div className="text-[11px] text-white/65 mt-0.5">Controle de status</div>
            </div>
            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-3">
              <div className="text-lg font-extrabold text-white">Ágil</div>
              <div className="text-[11px] text-white/65 mt-0.5">Fluxo de revisão</div>
            </div>
          </div>
        </div>

        {/* Rodapé institucional */}
        <div
          style={getEntranceStyle('left', 4)}
          className="relative z-10 flex items-center justify-between text-[11px] text-white/55 border-t border-white/[0.08] pt-4"
        >
          <span>© {new Date().getFullYear()} Editorial Control Hub</span>
          <span>Ambiente de Prototipação Frontend</span>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* COLUNA DIREITA: FORMULÁRIOS DE AUTENTICAÇÃO                          */}
      {/* ==================================================================== */}
      <div className="flex-1 flex flex-col justify-between p-5 sm:p-8 lg:p-12">
        {/* Barra superior direita com alternador Claro / Escuro */}
        <div
          style={getEntranceStyle('right', 0)}
          className="flex items-center justify-end"
        >
          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label={darkMode ? 'Ativar tema claro' : 'Ativar tema escuro'}
            className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
          >
            {darkMode ? (
              <>
                <Sun className="w-3.5 h-3.5 text-[#C54B00]" />
                <span>Tema Claro</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-[#000055]" />
                <span>Tema Escuro</span>
              </>
            )}
          </button>
        </div>

        {/* Container Central do Card de Autenticação */}
        <div className="w-full max-w-md mx-auto my-auto py-4">
          <div
            style={getEntranceStyle('right', 1)}
            className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-sm"
          >
            {/* Banner de Erro Global */}
            {formError && (
              <div
                role="alert"
                className="mb-5 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{formError}</span>
              </div>
            )}

            {/* Banner de Sucesso Global */}
            {formSuccess && (
              <div
                role="status"
                className="mb-5 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs flex items-start gap-2.5"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{formSuccess}</span>
              </div>
            )}

            {/* ============================================================== */}
            {/* TELA 1: LOGIN COM E-MAIL E SENHA                               */}
            {/* ============================================================== */}
            {screen === 'login' && (
              <form onSubmit={handleLoginSubmit} noValidate className="space-y-4">
                <div style={getEntranceStyle('right', 2)} className="mb-6">
                  <h1 className="text-xl font-extrabold text-[#000055] dark:text-white">
                    Acessar Plataforma
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Entre com suas credenciais da equipe OP Growth Digital
                  </p>
                </div>

                {/* Campo E-mail */}
                <div style={getEntranceStyle('right', 3)}>
                  <label
                    htmlFor="login-email"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    E-mail corporativo
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="nome@opgrowth.com.br"
                      className={`w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border rounded-xl focus:outline-none focus:bg-white dark:focus:bg-zinc-900 transition ${
                        fieldErrors.loginEmail
                          ? 'border-rose-400 focus:border-rose-500'
                          : 'border-slate-200 dark:border-zinc-800 focus:border-[#000055] dark:focus:border-[#C54B00]'
                      }`}
                    />
                  </div>
                  {fieldErrors.loginEmail && (
                    <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400 mt-1">
                      {fieldErrors.loginEmail}
                    </p>
                  )}
                </div>

                {/* Campo Senha com Visualizar / Ocultar */}
                <div style={getEntranceStyle('right', 4)}>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Senha
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotEmail(loginEmail);
                        switchScreen('forgot-password');
                      }}
                      className="text-[11px] font-semibold text-[#C54B00] hover:text-[#a63f00] transition"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="login-password"
                      type={showLoginPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full pl-10 pr-10 py-2.5 text-xs bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border rounded-xl focus:outline-none focus:bg-white dark:focus:bg-zinc-900 transition ${
                        fieldErrors.loginPassword
                          ? 'border-rose-400 focus:border-rose-500'
                          : 'border-slate-200 dark:border-zinc-800 focus:border-[#000055] dark:focus:border-[#C54B00]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword((prev) => !prev)}
                      aria-label={showLoginPassword ? 'Ocultar senha' : 'Visualizar senha'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1"
                    >
                      {showLoginPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {fieldErrors.loginPassword && (
                    <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400 mt-1">
                      {fieldErrors.loginPassword}
                    </p>
                  )}
                </div>

                {/* Lembrar sessão */}
                <div
                  style={getEntranceStyle('right', 5)}
                  className="flex items-center justify-between pt-0.5"
                >
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-3.5 h-3.5 rounded accent-[#000055]"
                    />
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      Manter sessão conectada
                    </span>
                  </label>
                </div>

                {/* Botão Entrar */}
                <div style={getEntranceStyle('right', 6)}>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#C54B00] hover:bg-[#a63f00] disabled:opacity-60 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Autenticando...</span>
                      </>
                    ) : (
                      <span>Entrar no Dashboard</span>
                    )}
                  </button>
                </div>

                {/* Link para Cadastro */}
                <div
                  style={getEntranceStyle('right', 7)}
                  className="pt-4 border-t border-slate-100 dark:border-zinc-800 text-center"
                >
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Ainda não possui acesso?{' '}
                    <button
                      type="button"
                      onClick={() => switchScreen('register')}
                      className="font-bold text-[#000055] dark:text-[#ff7a29] hover:underline"
                    >
                      Criar conta na equipe
                    </button>
                  </p>
                </div>
              </form>
            )}

            {/* ============================================================== */}
            {/* TELA 2: CADASTRO DE NOVOS USUÁRIOS                             */}
            {/* ============================================================== */}
            {screen === 'register' && (
              <form onSubmit={handleRegisterSubmit} noValidate className="space-y-3.5">
                <div className="mb-5">
                  <h1 className="text-xl font-extrabold text-[#000055] dark:text-white">
                    Criar Conta
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Cadastre seu perfil para gerenciar calendários e aprovações
                  </p>
                </div>

                {/* Nome Completo */}
                <div>
                  <label
                    htmlFor="reg-name"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Nome completo
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="reg-name"
                      type="text"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Ex: Mariana Silva"
                      className={`w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border rounded-xl focus:outline-none focus:bg-white dark:focus:bg-zinc-900 transition ${
                        fieldErrors.regName
                          ? 'border-rose-400'
                          : 'border-slate-200 dark:border-zinc-800 focus:border-[#000055] dark:focus:border-[#C54B00]'
                      }`}
                    />
                  </div>
                  {fieldErrors.regName && (
                    <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400 mt-1">
                      {fieldErrors.regName}
                    </p>
                  )}
                </div>

                {/* E-mail */}
                <div>
                  <label
                    htmlFor="reg-email"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    E-mail corporativo
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="reg-email"
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="voce@opgrowth.com.br"
                      className={`w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border rounded-xl focus:outline-none focus:bg-white dark:focus:bg-zinc-900 transition ${
                        fieldErrors.regEmail
                          ? 'border-rose-400'
                          : 'border-slate-200 dark:border-zinc-800 focus:border-[#000055] dark:focus:border-[#C54B00]'
                      }`}
                    />
                  </div>
                  {fieldErrors.regEmail && (
                    <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400 mt-1">
                      {fieldErrors.regEmail}
                    </p>
                  )}
                </div>

                {/* Cargo / Função */}
                <div>
                  <label
                    htmlFor="reg-role"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Cargo / Função na agência
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <select
                      id="reg-role"
                      value={regRole}
                      onChange={(e) => setRegRole(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-[#000055] dark:focus:border-[#C54B00]"
                    >
                      <option value="Social Media & Conteúdo">Social Media & Conteúdo</option>
                      <option value="Redator / Copywriter">Redator / Copywriter</option>
                      <option value="Designer / Diretor de Arte">
                        Designer / Diretor de Arte
                      </option>
                      <option value="Gestor de Contas">Gestor de Contas</option>
                      <option value="Head de Operações">Head de Operações</option>
                    </select>
                  </div>
                </div>

                {/* Senha */}
                <div>
                  <label
                    htmlFor="reg-password"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Criar senha
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="reg-password"
                      type={showRegPassword ? 'text' : 'password'}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      className={`w-full pl-10 pr-10 py-2.5 text-xs bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border rounded-xl focus:outline-none focus:bg-white dark:focus:bg-zinc-900 transition ${
                        fieldErrors.regPassword
                          ? 'border-rose-400'
                          : 'border-slate-200 dark:border-zinc-800 focus:border-[#000055] dark:focus:border-[#C54B00]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword((prev) => !prev)}
                      aria-label={showRegPassword ? 'Ocultar senha' : 'Visualizar senha'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1"
                    >
                      {showRegPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Barra de Força de Senha */}
                  {regPassword && (
                    <div className="mt-1.5">
                      <div className="flex gap-1 h-1.5">
                        {[1, 2, 3, 4].map((step) => (
                          <div
                            key={step}
                            className={`flex-1 rounded-full transition-colors ${
                              step <= regStrength.score
                                ? regStrength.color
                                : 'bg-slate-200 dark:bg-zinc-800'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 inline-block">
                        Força da senha: {regStrength.label}
                      </span>
                    </div>
                  )}

                  {fieldErrors.regPassword && (
                    <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400 mt-1">
                      {fieldErrors.regPassword}
                    </p>
                  )}
                </div>

                {/* Confirmar Senha */}
                <div>
                  <label
                    htmlFor="reg-confirm"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Confirmar senha
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="reg-confirm"
                      type={showRegConfirm ? 'text' : 'password'}
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="Repita a senha criada"
                      className={`w-full pl-10 pr-10 py-2.5 text-xs bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border rounded-xl focus:outline-none focus:bg-white dark:focus:bg-zinc-900 transition ${
                        fieldErrors.regConfirmPassword
                          ? 'border-rose-400'
                          : 'border-slate-200 dark:border-zinc-800 focus:border-[#000055] dark:focus:border-[#C54B00]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegConfirm((prev) => !prev)}
                      aria-label={
                        showRegConfirm ? 'Ocultar confirmação' : 'Visualizar confirmação'
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1"
                    >
                      {showRegConfirm ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {fieldErrors.regConfirmPassword && (
                    <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400 mt-1">
                      {fieldErrors.regConfirmPassword}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#C54B00] hover:bg-[#a63f00] disabled:opacity-60 text-white text-xs font-bold transition flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Criando conta...</span>
                    </>
                  ) : (
                    <span>Concluir Cadastro</span>
                  )}
                </button>

                <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Já possui uma conta?{' '}
                    <button
                      type="button"
                      onClick={() => switchScreen('login')}
                      className="font-bold text-[#000055] dark:text-[#ff7a29] hover:underline"
                    >
                      Fazer login
                    </button>
                  </p>
                </div>
              </form>
            )}

            {/* ============================================================== */}
            {/* TELA 3: RECUPERAÇÃO DE SENHA                                   */}
            {/* ============================================================== */}
            {screen === 'forgot-password' && (
              <form onSubmit={handleForgotSubmit} noValidate className="space-y-4">
                <button
                  type="button"
                  onClick={() => switchScreen('login')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Voltar para o login
                </button>

                <div className="mb-4">
                  <h1 className="text-xl font-extrabold text-[#000055] dark:text-white">
                    Recuperar Senha
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Informe o e-mail cadastrado para receber o link de redefinição de senha.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="forgot-email"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    E-mail cadastrado
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="forgot-email"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="nome@opgrowth.com.br"
                      className={`w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border rounded-xl focus:outline-none focus:bg-white dark:focus:bg-zinc-900 transition ${
                        fieldErrors.forgotEmail
                          ? 'border-rose-400'
                          : 'border-slate-200 dark:border-zinc-800 focus:border-[#000055] dark:focus:border-[#C54B00]'
                      }`}
                    />
                  </div>
                  {fieldErrors.forgotEmail && (
                    <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400 mt-1">
                      {fieldErrors.forgotEmail}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#C54B00] hover:bg-[#a63f00] disabled:opacity-60 text-white text-xs font-bold transition flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enviando instruções...</span>
                    </>
                  ) : (
                    <span>Enviar Link de Recuperação</span>
                  )}
                </button>

                {/* Atalho de simulação para avançar diretamente à tela de redefinição */}
                {recoverySent && (
                  <div className="pt-3 border-t border-slate-100 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => switchScreen('reset-password')}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#000055] hover:bg-[#000077] text-white text-xs font-semibold transition flex items-center justify-center gap-2"
                    >
                      <ShieldCheck className="w-4 h-4 text-[#C54B00]" />
                      <span>Simular Abertura do Link (Redefinir Senha)</span>
                    </button>
                  </div>
                )}
              </form>
            )}

            {/* ============================================================== */}
            {/* TELA 4: REDEFINIÇÃO DE SENHA                                   */}
            {/* ============================================================== */}
            {screen === 'reset-password' && (
              <form onSubmit={handleResetSubmit} noValidate className="space-y-4">
                <button
                  type="button"
                  onClick={() => switchScreen('login')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Cancelar e voltar ao login
                </button>

                <div className="mb-4">
                  <h1 className="text-xl font-extrabold text-[#000055] dark:text-white">
                    Redefinir Senha
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {resetEmailTarget
                      ? `Defina uma nova senha segura para ${resetEmailTarget}`
                      : 'Crie uma nova senha forte para acessar sua conta'}
                  </p>
                </div>

                {/* Nova Senha */}
                <div>
                  <label
                    htmlFor="reset-new-password"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Nova senha
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="reset-new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      className={`w-full pl-10 pr-10 py-2.5 text-xs bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border rounded-xl focus:outline-none focus:bg-white dark:focus:bg-zinc-900 transition ${
                        fieldErrors.newPassword
                          ? 'border-rose-400'
                          : 'border-slate-200 dark:border-zinc-800 focus:border-[#000055] dark:focus:border-[#C54B00]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      aria-label={showNewPassword ? 'Ocultar senha' : 'Visualizar senha'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1"
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {newPassword && (
                    <div className="mt-1.5">
                      <div className="flex gap-1 h-1.5">
                        {[1, 2, 3, 4].map((step) => (
                          <div
                            key={step}
                            className={`flex-1 rounded-full transition-colors ${
                              step <= resetStrength.score
                                ? resetStrength.color
                                : 'bg-slate-200 dark:bg-zinc-800'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 inline-block">
                        Força da senha: {resetStrength.label}
                      </span>
                    </div>
                  )}

                  {fieldErrors.newPassword && (
                    <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400 mt-1">
                      {fieldErrors.newPassword}
                    </p>
                  )}
                </div>

                {/* Confirmar Nova Senha */}
                <div>
                  <label
                    htmlFor="reset-confirm-password"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Confirmar nova senha
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="reset-confirm-password"
                      type={showConfirmNewPassword ? 'text' : 'password'}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Repita a nova senha"
                      className={`w-full pl-10 pr-10 py-2.5 text-xs bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white border rounded-xl focus:outline-none focus:bg-white dark:focus:bg-zinc-900 transition ${
                        fieldErrors.confirmNewPassword
                          ? 'border-rose-400'
                          : 'border-slate-200 dark:border-zinc-800 focus:border-[#000055] dark:focus:border-[#C54B00]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmNewPassword((prev) => !prev)}
                      aria-label={
                        showConfirmNewPassword ? 'Ocultar confirmação' : 'Visualizar confirmação'
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1"
                    >
                      {showConfirmNewPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {fieldErrors.confirmNewPassword && (
                    <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400 mt-1">
                      {fieldErrors.confirmNewPassword}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#C54B00] hover:bg-[#a63f00] disabled:opacity-60 text-white text-xs font-bold transition flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvando nova senha...</span>
                    </>
                  ) : (
                    <span>Salvar Nova Senha</span>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Nota de ambiente simulado */}
        <p
          style={getEntranceStyle('right', 8)}
          className="text-center text-[11px] text-slate-400 dark:text-slate-500"
        >
          Credenciais de demonstração pré-preenchidas • Dados simulados em memória local
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// SUBCOMPONENTE: MODAL DE CRIAÇÃO / EDIÇÃO DE CLIENTE
// ============================================================================

const CLIENT_COLOR_PALETTE: { label: string; value: string }[] = [
  { label: 'Azul Primário', value: 'rgb(37, 99, 235)' },
  { label: 'Vermelho Primário', value: 'rgb(220, 38, 38)' },
  { label: 'Amarelo Primário', value: 'rgb(234, 179, 8)' },
  { label: 'Verde Esmeralda', value: 'rgb(16, 185, 129)' },
  { label: 'Laranja OP Growth', value: 'rgb(197, 75, 0)' },
  { label: 'Violeta Terciário', value: 'rgb(124, 58, 237)' },
  { label: 'Ciano Terciário', value: 'rgb(6, 182, 212)' },
  { label: 'Verde Lima', value: 'rgb(101, 163, 13)' },
  { label: 'Âmbar Terciário', value: 'rgb(217, 119, 6)' },
  { label: 'Magenta Terciário', value: 'rgb(219, 39, 119)' },
  { label: 'Índigo Profundo', value: 'rgb(79, 70, 229)' },
  { label: 'Coral Terciário', value: 'rgb(249, 115, 22)' }
];

const rgbStringToHex = (color: string): string => {
  if (color.startsWith('#')) return color;
  const match = color.match(/\d+/g);
  if (!match || match.length < 3) return '#2563eb';
  const [r, g, b] = match.map(Number);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

function ClientFormModal({
  initialClient,
  onClose,
  onSave
}: {
  initialClient: Client | null;
  onClose: () => void;
  onSave: (data: Omit<Client, 'id'>, existingId?: string) => void;
}) {
  const [name, setName] = useState(initialClient?.name || '');
  const [segment, setSegment] = useState(initialClient?.segment || '');
  const [manager, setManager] = useState(initialClient?.manager || 'Camila Rocha');
  const [monthlyGoal, setMonthlyGoal] = useState<number>(initialClient?.monthlyGoal || 16);
  const [accentColor, setAccentColor] = useState<string>(
    initialClient?.accentColor || CLIENT_COLOR_PALETTE[0].value
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(
      {
        name: name.trim(),
        segment: segment.trim() || 'Marketing Digital',
        manager: manager.trim() || 'Camila Rocha',
        monthlyGoal: Math.max(1, Number(monthlyGoal) || 12),
        accentColor
      },
      initialClient?.id
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/50 dark:bg-black/75 backdrop-blur-2xs"
      />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {initialClient ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nome da Conta / Cliente *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Horizonte Imóveis"
              className="w-full text-xs bg-white dark:bg-zinc-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 focus:outline-none focus:border-[#000055] dark:focus:border-[#C54B00]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Segmento de Atuação
            </label>
            <input
              type="text"
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
              placeholder="Ex: Mercado Imobiliário"
              className="w-full text-xs bg-white dark:bg-zinc-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 focus:outline-none focus:border-[#000055] dark:focus:border-[#C54B00]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Gestor Responsável
              </label>
              <input
                type="text"
                value={manager}
                onChange={(e) => setManager(e.target.value)}
                className="w-full text-xs bg-white dark:bg-zinc-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 focus:outline-none focus:border-[#000055] dark:focus:border-[#C54B00]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Meta Mensal (Posts)
              </label>
              <input
                type="number"
                min={1}
                max={200}
                value={monthlyGoal}
                onChange={(e) => setMonthlyGoal(Number(e.target.value))}
                className="w-full text-xs bg-white dark:bg-zinc-950 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 focus:outline-none focus:border-[#000055] dark:focus:border-[#C54B00]"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Cor de Identificação
              </label>
              <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                {accentColor}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {CLIENT_COLOR_PALETTE.map((swatch) => {
                const isSelected = accentColor === swatch.value;
                return (
                  <button
                    key={swatch.value}
                    type="button"
                    title={swatch.label}
                    aria-label={swatch.label}
                    onClick={() => setAccentColor(swatch.value)}
                    style={{ backgroundColor: swatch.value }}
                    className={`w-7 h-7 rounded-full transition-transform ${
                      isSelected
                        ? 'scale-110 ring-2 ring-offset-2 ring-[#000055] dark:ring-[#C54B00] dark:ring-offset-zinc-900'
                        : 'hover:scale-105 opacity-85 hover:opacity-100'
                    }`}
                  />
                );
              })}

              {/* Seletor RGB Livre */}
              <label
                title="Escolher cor personalizada"
                className="relative w-7 h-7 rounded-full border border-dashed border-slate-400 dark:border-zinc-600 flex items-center justify-center cursor-pointer hover:border-[#C54B00] transition overflow-hidden"
              >
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">+</span>
                <input
                  type="color"
                  aria-label="Seletor de cor personalizada"
                  value={rgbStringToHex(accentColor)}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/70 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-[#C54B00] hover:bg-[#a63f00] text-white text-xs font-semibold transition"
          >
            {initialClient ? 'Salvar Alterações' : 'Cadastrar Cliente'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default App;