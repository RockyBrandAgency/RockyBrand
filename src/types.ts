export type AgentKey = 'ad' | 'an' | 'seo' | 'strategist' | 'fm' | 'ri';
export type ToolKey = 'agentes' | 'email-marketing' | 'metricas';

export interface AgentConfig {
  name: string;
  desc: string;
  avatarUrl: string;
}

export interface TimelineEntry {
  status: string;
  action: string;
  at: string;
  result?: string;
}

export interface AgentStatus {
  status: 'PROCESSING' | 'READY' | 'ERROR' | 'NUNCA_EJECUTADO' | string;
  last_action: string;
  execution_count: number;
  execution_count_month?: number;
  updated_at: string;
  timeline: TimelineEntry[];
  tokens_month?: string;
  tokens_input_total?: number;
  tokens_output_total?: number;
  tokens_thinking_total?: number;
}

export interface ContentPiece {
  fecha: string;
  dia_sugerido?: string;
  canal: string;
  formato: string;
  pilar?: string;
  headline: string;
  copy: string;
  hashtags: string[];
  objetivo_estrategico: string;
  nota_visual_para_art_director: string;
  notas_produccion: string;
  contraste_competitivo_implicito?: boolean;
}

export interface ContentGrid {
  mes: string;
  pilares_narrativos: string[];
  calendario_semanal: { piezas: ContentPiece[] }[];
}

export interface Project {
  id: string;
  name: string;
  protected: boolean;
  agents?: AgentKey[];
  tools?: ToolKey[];
}

export interface PanelState {
  agentConfigs?: Record<AgentKey, AgentConfig>;
  agentStatus?: Record<AgentKey, AgentStatus>;
  contentGrid?: ContentGrid | null;
  projects?: Project[];
  [key: string]: unknown;
}

export interface EmailContact {
  client_id: string;
  email: string;
  name: string;
  status: 'subscribed' | 'unsubscribed' | 'bounced';
  tags: string[];
  created_at?: string;
  unsub_reason?: string;
}

export interface EmailTemplate {
  client_id: string;
  template_id: string;
  name: string;
  subject: string;
  html_body: string;
  updated_at: string;
}

export interface CampaignStats {
  enviados: number;
  aperturas: number;
  clics: number;
  rebotes: number;
  quejas: number;
}

export interface EmailCampaign {
  client_id: string;
  campaign_id: string;
  name: string;
  subject: string;
  html_body: string;
  template_id: string;
  segment: { type: string; value?: string };
  status: 'draft' | 'scheduled' | 'sending' | 'sent';
  created_at: string;
  scheduled_at?: string;
  sent_at: string;
  stats: CampaignStats;
}

export interface CampaignRecipient {
  contact_email: string;
  sent_at?: string;
  opened: boolean;
  opened_at?: string;
  clicked: boolean;
  clicked_at?: string;
  clicked_links?: string[];
  bounced: boolean;
}

export interface EmailJourney {
  track_id: string;
  trigger_event: string;
  paused: boolean;
  contact_count: number;
}

export interface HealthBadge {
  tone: 'ok' | 'warn' | 'error' | 'off';
  label: string;
}

export interface SparklinePoint {
  fecha: string;
  valor: number;
}

export interface SocialDomainSummary {
  followers: number | null;
  delta_7d_pct: number | null;
  sparkline_30d: SparklinePoint[];
  health: HealthBadge;
}

export interface HomeSummary {
  email: {
    enviados_mes: number;
    aperturas_mes: number;
    rebotes_mes: number;
    tasa_apertura_pct: number | null;
    tasa_rebote_pct: number | null;
    ctr_pct: number | null;
    ctr_note: 'no_tracking_infra' | null;
    complaint_rate_pct: number | null;
    complaint_note: 'no_tracking_infra' | null;
  };
  unsubscribed_mes: number;
  ses_sandbox: { production_access: boolean; max_24h_send: number | null; sent_last_24h: number | null } | null;
  seo: { keyword: string; posicion: number } | null;
  seo_keywords: { top3_count: number; top10_count: number; total_trackeadas: number; ranking_promedio: number } | null;
  seo_keywords_delta: { top3_delta: number; top10_delta: number; ranking_delta: number } | null;
  seo_trafico: {
    clics_organicos: number | null;
    impresiones: number | null;
    ctr_promedio_pct: number | null;
    posicion_promedio: number | null;
    snapshot_fecha: string;
  } | null;
  seo_trafico_delta_pct: number | null;
  content_count: number;
  system_health: {
    dave: HealthBadge & { detail: string };
    jimi: HealthBadge & { detail: string };
    gsc_sync: HealthBadge & { detail: string };
    meta_api: HealthBadge & { detail: string };
  };
  social: {
    instagram: SocialDomainSummary;
    facebook: SocialDomainSummary;
    youtube: SocialDomainSummary;
    tiktok: null;
  };
}

export interface MetricsEmailCampaign {
  name: string;
  sent_at: string;
  enviados: number;
  aperturas: number;
}

export interface MetricsSocialPost {
  media_id: string;
  fecha: string;
  tipo: string;
  formato: string;
  permalink: string;
  caption: string;
  likes: number;
  comentarios: number;
  alcance: number;
  impresiones: number | null;
  reproducciones: number | null;
  engagement_rate_sobre_alcance_pct: number | null;
}

export interface KeywordMatrixRow {
  keyword: string;
  posicion_actual: number | null;
  posicion_anterior: number | null;
  delta: number | null;
  impresiones: number | null;
  periodo: string | null;
}

export interface MetricsSeoSnapshot {
  fecha: string;
  keyword: string | null;
  posicion: number | null;
}

export interface MetricsContentPiece {
  fecha: string;
  canal: string;
  headline: string;
}

export interface MetricsYoutubeTrafficSource {
  insightTrafficSourceType: string;
  views: number;
}

export interface MetricsYoutubeVideo {
  video: string;
  views: number;
  estimatedMinutesWatched: number;
  averageViewDuration: number;
  likes: number;
}

export interface MetricsReport {
  range: { from: string; to: string; days: number };
  email: { enviados: number; aperturas: number; clics: number; rebotes: number; campaigns: MetricsEmailCampaign[] };
  social: {
    snapshots: { fecha: string; seguidores: number | null }[];
    seguidores_actuales: number | null;
    cambio_neto_periodo: number;
    engagement_promedio_pct: number | null;
    publicaciones: MetricsSocialPost[];
  };
  facebook: {
    snapshots: { fecha: string; seguidores: number | null }[];
    seguidores_actuales: number | null;
    nombre_pagina: string | null;
  };
  youtube: {
    snapshots: { fecha: string; suscriptores: number | null }[];
    suscriptores_actuales: number | null;
    suscriptores_ganados_periodo: number;
    suscriptores_perdidos_periodo: number;
    vistas_periodo: number;
    minutos_vistos_periodo: number | null;
    duracion_promedio_vista_seg: number | null;
    fuentes_de_trafico: MetricsYoutubeTrafficSource[];
    top_videos: MetricsYoutubeVideo[];
  };
  seo: {
    snapshots: MetricsSeoSnapshot[];
    posicion_actual: number | null;
    keyword: string | null;
    keyword_matrix: KeywordMatrixRow[];
    clicks_snapshots: { fecha: string; clics: number }[];
    clics_organicos_actual: number | null;
  };
  content: { count: number; piezas: MetricsContentPiece[] };
}

export interface AgencyOverviewError {
  project_id: string;
  agent_key: string;
  last_action: string;
  updated_at: string;
}

export interface AgencyOverview {
  billing: { available: boolean; month_to_date_usd: number | null; budget_usd: number | null; checked_at: string };
  agents: { ready: number; processing: number; error: number; never_run: number; total: number };
  errors: AgencyOverviewError[];
}

export type RadarDirection = 'growing' | 'flat' | 'declining' | 'sin_datos';

export interface RadarMetric {
  value: number | null;
  delta_pct?: number | null;
  direction: RadarDirection;
}

export interface AgencyGrowthRadarClient {
  client_id: string;
  social: { instagram: RadarMetric; facebook: RadarMetric; youtube: RadarMetric };
  seo: RadarMetric;
  email: { value: number | null; direction: RadarDirection };
}

export interface AgencyGrowthRadar {
  clients: AgencyGrowthRadarClient[];
}

// ===== Gastos AI =====

export interface AiSpendAgentLine {
  agent_key: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  thinking_tokens: number;
  cost_usd: number;
}

export interface AiSpendClientLine {
  project_id: string;
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  thinking_tokens: number;
  agents: AiSpendAgentLine[];
}

export interface AiSpendOtherProvider {
  provider: string;
  cost_usd: number | null;
  note: string;
}

export interface AiSpendOverview {
  period_month: string;
  claude: { provider: string; cost_usd: number; input_tokens: number; output_tokens: number; thinking_tokens: number };
  other_providers: AiSpendOtherProvider[];
  by_client: AiSpendClientLine[];
  top_client: string | null;
}

// ===== PMS (Property Management System) =====

export interface PmsGuest {
  GuestID: string;
  FullName: string;
  Contact: { Email?: string; WhatsApp?: string };
  OriginCountry?: string | null;
  VIP_Tags: string[];
  Preferences: Record<string, unknown>;
  TotalLTV: number | string;
  UpdatedAt: string;
}

export interface PmsBooking {
  BookingID: string;
  GuestID: string;
  GuestName?: string;
  RoomID: string;
  CheckIn: string;
  CheckOut: string;
  Status: 'CONFIRMED' | 'PENDING' | 'CANCELLED';
  Source: 'Direct' | 'OTA_Headless';
  Financials: { Currency: string; TotalAmount: number | string; PaymentStatus: 'PAID' | 'PENDING' | 'PARTIAL' | 'REFUNDED' };
  PartyMembers: number;
  UpdatedAt: string;
}

export interface PmsAddon {
  AddonID: string;
  BookingID: string;
  ServiceName: string;
  Status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  Logistics: { OperationBase: string; GuidingZone: string; Date: string; Time?: string | null; GuideAssigned?: string | null };
  UpdatedAt: string;
}

export interface PmsItinerary {
  date: string;
  bookings: PmsBooking[];
  experiences: PmsAddon[];
}
