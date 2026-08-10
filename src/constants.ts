import type { AgentConfig, AgentKey, Project, ToolKey } from './types';

export const DEFAULTS: Record<AgentKey, AgentConfig> = {
  ad: {
    name: 'Jimi',
    desc: 'Art Director & Visual Concept Creator. La Guitarra Líder y la Estética Psicodélica. Guardián de la identidad visual; toma las partituras de Dave y las traduce en composiciones visuales, paletas de colores y encuadres brutales para exprimir el material de la Sony A7III.',
    avatarUrl: '',
  },
  an: {
    name: 'Neil',
    desc: 'Performance & Data Analytics Specialist. El Baterista Cronométrico de la Banda. Cerebro matemático que audita métricas de conversión, mide el impacto real y procesa el consumo de tokens en DynamoDB para garantizar un tempo perfecto y bajo costo.',
    avatarUrl: '',
  },
  seo: {
    name: 'Slash',
    // GEO/AEO retirado del nombre y de la descripción el 2026-08-10: el
    // monitoreo de motores conversacionales era un placeholder de una línea
    // que devolvía PENDIENTE, nunca se implementó. Decisión de Mato:
    // no prometerle al cliente algo que el agente no hace. Se puede volver
    // a agregar el día que exista de verdad.
    desc: 'Search Engine Optimization Expert. El Virtuoso de los Riffs de Destacado. Se asegura de que la banda domine los motores de búsqueda: qué posiciones se mueven, qué keywords aparecen, y qué ajuste concreto hacer esta semana.',
    avatarUrl: '',
  },
  strategist: {
    name: 'Dave',
    desc: 'Content & Social Media Strategist. El Frontman y Compositor de la Banda. Define el ritmo del show; analiza el engagement de los líderes de la industria para componer la parrilla mensual de contenidos, posicionando a la Patagonia Chilena (Coyhaique) como destino de clase mundial.',
    avatarUrl: '',
  },
  fm: {
    name: 'Thelma',
    desc: 'Director de Montaje y Edición Cinematográfica. La Productora de Estudio de la Banda. Toma el guion de Dave y el material del repositorio de video, y arma la receta de montaje con ritmo de corte, transiciones y voz en off — lista para importar en DaVinci Resolve.',
    avatarUrl: '',
  },
  ri: {
    name: 'Cameron',
    desc: 'Market Research & Insight Scout. El Periodista de Gira de la Banda. Se infiltra en Reddit, foros y revistas del mercado objetivo para traer fricciones, deseos y oportunidades reales de usuarios — materia prima cruda para que Dave componga con datos, no con suposiciones.',
    avatarUrl: '',
  },
  cmo: {
    name: 'Rox',
    desc: 'Chief Marketing Officer. El Manager de la Banda. No toca ningún instrumento: define el norte de marca y emite directivas obligatorias de canal/KPI/acción para que Dave, Jimi, Cameron, Thelma y Slash toquen la misma canción.',
    avatarUrl: '',
  },
  crm: {
    name: 'CRM Worker',
    desc: 'Motor Operacional del CRM. No es parte de la banda de contenido: responde consultas reales por WhatsApp (reservas, ocupación, llegadas, leads) y envía notificaciones push de reservas, cancelaciones y leads VIP — siempre con datos reales, nunca inventados.',
    avatarUrl: '',
  },
};

export const AGENT_META: Record<AgentKey, { cls: string; initials: string; role: string; short: string }> = {
  ad: { cls: 'ad', initials: 'JI', role: 'Art Director & Visual Concept Creator', short: 'Art Director' },
  an: { cls: 'an', initials: 'NE', role: 'Performance & Data Analytics Specialist', short: 'Analytics' },
  seo: { cls: 'seo', initials: 'SL', role: 'Search Engine Optimization Expert', short: 'SEO' },
  strategist: { cls: 'strategist', initials: 'DA', role: 'Content & Social Media Strategist', short: 'Content Strategist' },
  fm: { cls: 'fm', initials: 'TH', role: 'Director de Montaje y Edición Cinematográfica', short: 'Filmmaker' },
  ri: { cls: 'ri', initials: 'CA', role: 'Market Research & Insight Scout', short: 'Research' },
  cmo: { cls: 'cmo', initials: 'RX', role: 'Chief Marketing Officer', short: 'CMO' },
  crm: { cls: 'crm_worker', initials: 'CR', role: 'Motor Operacional del CRM', short: 'CRM Worker' },
};

export const AGENT_FUNCTION_KEYS: AgentKey[] = ['ad', 'an', 'seo', 'strategist', 'fm', 'ri', 'cmo', 'crm'];

export const TOOL_META: Record<ToolKey, { label: string; icon: string }> = {
  agentes: { label: 'Agentes', icon: '◈' },
  'email-marketing': { label: 'Email Marketing', icon: '✉' },
  metricas: { label: 'Métricas', icon: '▤' },
};

export const TOOL_KEYS: ToolKey[] = ['agentes', 'email-marketing', 'metricas'];

export const STATUS_META: Record<string, { label: string; cls: string }> = {
  PROCESSING: { label: 'Procesando', cls: 'processing' },
  READY: { label: 'Listo', cls: 'ready' },
  ERROR: { label: 'Error', cls: 'error' },
  NUNCA_EJECUTADO: { label: 'Nunca ejecutado', cls: 'never' },
};

export function statusMeta(status?: string) {
  return STATUS_META[status || ''] || { label: status || 'Desconocido', cls: 'never' };
}

export const DEFAULT_PROJECTS: Project[] = [
  { id: 'chile-fly-fishing', name: 'Chile Fly Fishing', protected: true, agents: AGENT_FUNCTION_KEYS, tools: TOOL_KEYS },
  { id: 'alto-castillo', name: 'Alto Castillo', protected: false, agents: AGENT_FUNCTION_KEYS, tools: TOOL_KEYS },
];

export const DOW_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// Logo del cliente, mostrado en el sidebar bajo "Proyecto activo" cuando
// ese proyecto está activo. Convención por defecto para cada cliente/
// proyecto nuevo: subir su logo a public/ y agregar la entrada acá con
// su project id. Si un proyecto no tiene entrada, simplemente no se
// muestra logo (no se inventa un placeholder).
export const PROJECT_LOGO: Record<string, string> = {
  'chile-fly-fishing': '/Logo-ChileFlyFishing.png',
  'alto-castillo': '/logo-white.png',
};
