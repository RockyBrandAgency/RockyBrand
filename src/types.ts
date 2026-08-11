export type AgentKey = 'ad' | 'an' | 'seo' | 'strategist' | 'fm' | 'ri' | 'cmo' | 'crm';
export type ToolKey = 'agentes' | 'email-marketing' | 'metricas';

// Servicios CONTRATADOS por el cliente (rockybrand-client-config.services,
// real desde el backend) - distinto de `agents`/`tools` de arriba, que solo
// controlan qué se ve en el panel, no qué corre de verdad. Este es a nivel
// de servicio completo (Agentes/PMS/CRM/Email Marketing), no por agente
// individual (eso lo sigue resolviendo `agents`).
export type ServiceKey = 'agents' | 'pms' | 'crm' | 'email_marketing' | 'store';
export type ClientServices = Record<ServiceKey, boolean>;

// Sub-opciones DENTRO de un servicio (no on/off del servicio completo) -
// cada una con su propio default del lado del backend (ver
// PMS_FEATURE_DEFAULTS en panel_config_api_lambda.py):
// - pms_monthly_view: vista mensual por semana. Default false - opt-in
//   explícito, nadie la tenía antes de que existiera.
// - pms_room_views: toggle Habitaciones/Viajeros - un cliente sin
//   habitaciones (solo viajeros) apaga esto y el PMS deja de mostrar
//   Calendario/Disponibilidad, quedándose con Itinerario/Huéspedes/
//   Reservas (ya centradas en personas, no en habitaciones). Default
//   true - preserva a los clientes que ya usan habitaciones hoy.
export type PmsFeatureKey = 'pms_monthly_view' | 'pms_room_views';
export type PmsFeatures = Record<PmsFeatureKey, boolean>;

// Catálogo curado de habitaciones (reemplaza el diccionario hardcodeado
// que vivía en pmsRooms.ts) - opcional, si el cliente no lo tiene
// configurado el frontend sigue derivando habitaciones de los RoomID
// vistos en las reservas (mismo fallback de siempre).
export interface RoomCatalogEntry {
  room_id: string;
  label: string;
  category: string;
}

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
  paused?: boolean;
}

export interface AgentPromptState {
  prompt: string;
  is_custom: boolean;
  default_prompt: string;
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
  // El tipo iba atrasado respecto del backend: `pending` lo escribe la
  // importacion con doble opt-in desde 2026-08-03 y `complained` lo escribe
  // el webhook de quejas de SES. Mientras faltaron aca, TypeScript no dejaba
  // ni siquiera comparar contra ellos - por eso el panel mostraba la palabra
  // cruda en ingles en vez de una etiqueta.
  status: 'subscribed' | 'pending' | 'unsubscribed' | 'bounced' | 'complained';
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
  landing_page: string | null;
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
    cambio_neto_7d: number;
    engagement_promedio_pct: number | null;
    publicaciones: MetricsSocialPost[];
  };
  facebook: {
    snapshots: { fecha: string; seguidores: number | null }[];
    seguidores_actuales: number | null;
    nombre_pagina: string | null;
    visualizaciones_actual: number | null;
    visualizaciones_snapshots: { fecha: string; visualizaciones: number | null }[];
  };
  youtube: {
    snapshots: { fecha: string; suscriptores: number | null }[];
    suscriptores_actuales: number | null;
    suscriptores_ganados_periodo: number;
    suscriptores_perdidos_periodo: number;
    suscriptores_netos_7d: number;
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
    impressions_snapshots: { fecha: string; impresiones: number }[];
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
  /** false = el mes no tiene consumo. Distinto de "todavía cargando". */
  has_data: boolean;
  /** Motivo legible cuando has_data es false. */
  no_data_reason: string | null;
  /** Avisa si está corriendo la tarifa introductoria de Sonnet 5. */
  pricing_note: string;
  claude: {
    provider: string;
    cost_usd: number;
    input_tokens: number;
    output_tokens: number;
    thinking_tokens: number;
    cache_write_tokens: number;
    cache_read_tokens: number;
  };
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
  Financials: {
    Currency: string;
    TotalAmount: number | string;
    // Suma de Price de los add-ons no cancelados de esta reserva - campo
    // derivado, recalculado server-side (pms_lambda._recompute_addons_total)
    // cada vez que se agrega un add-on con precio. Optional porque reservas
    // creadas antes del 2026-08-10 no lo tienen todavia.
    AddonsAmount?: number | string;
    PaymentStatus: 'PAID' | 'PENDING' | 'PARTIAL' | 'REFUNDED';
  };
  PartyMembers: number;
  UpdatedAt: string;
}

export interface PmsAddon {
  AddonID: string;
  BookingID: string;
  ServiceName: string;
  Status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  Logistics: { OperationBase: string; GuidingZone: string; Date: string; Time?: string | null; GuideAssigned?: string | null };
  // Opcional - muchos add-ons son solo logistica sin cargo aparte (ya
  // incluidos en el paquete). Cuando SI tiene precio, suma a
  // Booking.Financials.AddonsAmount.
  Price?: number | string;
  UpdatedAt: string;
}

export interface PmsItinerary {
  date: string;
  bookings: PmsBooking[];
  experiences: PmsAddon[];
}

export interface PmsMonthlyWeekArrival {
  BookingID: string;
  CheckIn: string;
  CheckOut: string;
  RoomID: string;
  FullName: string;
}

export interface PmsMonthlyWeekRoom {
  room_id: string;
  noches_ocupadas: number;
  noches_totales: number;
}

export interface PmsMonthlyWeek {
  semana_iso: string;
  dias: string[];
  viajeros: { cantidad_llegadas: number; detalle: PmsMonthlyWeekArrival[] };
  habitaciones: PmsMonthlyWeekRoom[];
}

export interface PmsMonthlyOverview {
  year: number;
  month: number;
  semanas: PmsMonthlyWeek[];
}

// Cada `valor` depende de `metrica` - ver derive_alerts en
// crm_assistant_queries.py: para la mayoría de las métricas es el mismo
// `valor` que trae el semáforo (número o { cantidad, ... }), y para
// `llegadas_con_banderas` es directamente un número.
export interface ClientAlert {
  metrica: string;
  valor: unknown;
}

export interface ClientAlertsResponse {
  client_id: string;
  alertas: ClientAlert[];
  semaforo: Record<string, { valor: unknown; estado: string }>;
}

// ===== Sección COSTOS (solo agencia) =====
// Todo esto lo produce cost-collector y lo lee panel-config-api; el panel
// nunca llama a Cost Explorer ni a Meta. Cada bloque puede venir con
// `error` en vez de cifras: en ese caso se muestra el motivo, nunca un cero.

export interface AwsServiceLine {
  servicio: string;
  uso: number;
  credito: number;
  soporte: number;
  otro: number;
}

export interface AwsMonth {
  periodo: string;
  /** Cost Explorer marca el mes en curso como estimado (~24 h de retraso). */
  estimado: boolean;
  servicios: AwsServiceLine[];
  total_bruto_usd: number;
  total_credito_usd: number;
  total_neto_usd: number;
  es_mes_en_curso: boolean;
  collected_at: string;
}

export interface ClaudeAgentLine {
  agent_key: string;
  agent_name: string;
  modelo: string;
  tokens_entrada: number;
  tokens_salida: number;
  tokens_razonamiento: number;
  tokens_cache_escritura: number;
  tokens_cache_lectura: number;
  costo_usd: number;
}

export interface ClaudeMonth {
  periodo: string;
  por_cliente: Record<string, { costo_usd: number; agentes: ClaudeAgentLine[] }>;
  total_usd: number;
  tarifa_introductoria_vigente: boolean;
  tarifa_introductoria_vence: string | null;
  sin_datos?: boolean;
  motivo?: string;
  collected_at: string;
}

export interface MetaClientCost {
  client_id: string;
  waba_id?: string;
  numero?: string;
  nombre_verificado?: string;
  cuenta_oficial?: boolean;
  /** Verificado contra el metadato real del WABA, no asumido. */
  es_numero_de_prueba?: boolean;
  sin_whatsapp?: boolean;
  por_mes?: Record<string, { conversaciones: number; costo_usd: number }>;
  collected_at: string;
}

export interface FixedCost {
  cost_id: string;
  nombre: string;
  monto: number;
  moneda: 'USD' | 'CLP';
  ciclo: 'mensual' | 'anual';
  dia_cobro: number | null;
  icono: string | null;
  nota: string | null;
  /** null si es CLP y todavía no hay tipo de cambio: no se inventa la conversión. */
  mensual_usd: number | null;
}

export interface ClientMargin {
  client_id: string;
  costo_claude_usd: number;
  costo_whatsapp_usd: number;
  whatsapp_es_numero_de_prueba: boolean;
  whatsapp_sin_configurar: boolean;
  costo_variable_usd: number;
  /** null = todavía no cargaste lo que paga este cliente. */
  paga_usd: number | null;
  margen_usd: number | null;
  margen_pct: number | null;
}

// ===== Tienda (Chile Fly Fishing Co.) =====
// Exclusiva de un solo cliente (STORE_CLIENT_ID en el backend) - ver
// store-admin-api / ARQUITECTURA-TIENDA-CFF.md para el modelo de datos
// real de `chile-fly-fishing-store-products` / `-orders`. Los nombres de
// campo siguen exacto lo que escribe store_orders_lambda.py /
// store_admin_lambda.py, no una convencion inventada en el frontend.

export interface StoreProduct {
  sku: string;
  nombre: string;
  slug?: string;
  familia?: string;
  precio_clp: number;
  stock: number;
  activo: boolean;
}

export type StoreOrderStatus =
  | 'pendiente_pago'
  | 'pago_iniciado'
  | 'pagada'
  | 'pago_rechazado'
  | 'pago_anulado'
  | 'expirada'
  | 'revision_monto';

export interface StoreOrderItem {
  sku: string;
  cantidad: number;
  nombre: string;
  precio_unitario_clp?: number;
  total_linea_clp?: number;
}

export interface StoreOrderCliente {
  nombre: string;
  email: string;
  telefono: string;
  direccion: string;
  comuna: string;
  region: string;
  notas?: string;
}

// Shape completo (detalle_orden) - las listas (listar_ordenes,
// despachos_pendientes, en_revision_monto) devuelven un subset resumido
// via _resumen_orden, por eso casi todos los campos ademas de
// order_id/estado son opcionales aca.
export interface StoreOrder {
  order_id: string;
  estado: StoreOrderStatus;
  email?: string;
  cliente?: StoreOrderCliente;
  items?: StoreOrderItem[];
  subtotal_clp?: number;
  despacho_clp?: number | null;
  despacho_estado?: string;
  total_clp?: number;
  pago?: string;
  webpay_token?: string;
  created_at?: string;
  numero_seguimiento?: string | null;
  despachado_en?: string | null;
}

export interface StoreContactMessage {
  order_id: string;
  tipo: string;
  estado: string;
  email: string;
  cliente: { nombre: string; email: string; asunto: string; mensaje: string };
  created_at?: string;
}

export interface StoreDashboardResumen {
  ventas_semana: { cantidad: number; total_clp: number };
  riesgo_quiebre_stock: StoreProduct[];
  despachos_pendientes: StoreOrder[];
  en_revision_monto: StoreOrder[];
}

export interface CostsOverview {
  mes_actual: string;
  mes_anterior: string;
  tipo_cambio: {
    valor_clp: number;
    /** No es la fecha de hoy: el dólar observado no se publica fines de semana. */
    fecha_dato: string;
    descripcion: string;
    collected_at: string;
  } | null;
  resumen: {
    fijo_mensual_usd: number;
    variable_mes_usd: number;
    variable_atribuible_usd: number;
    /** Costo COMPARTIDO de AWS. No se reparte entre clientes. */
    aws_plataforma_usd: number;
    total_mes_usd: number;
    equivalente_diario_usd: number | null;
    ingreso_recurrente_usd: number;
    margen_usd: number;
    margen_pct: number | null;
    suscripciones_sin_convertir: string[];
  };
  fijos: FixedCost[];
  aws: { mes_actual: AwsMonth | null; mes_anterior: AwsMonth | null; error: string | null; retraso_horas: number };
  claude: { mes_actual: ClaudeMonth | null; error: string | null };
  meta: { por_cliente: MetaClientCost[]; error: string | null };
  margenes: ClientMargin[];
  ultima_corrida: {
    collected_at: string;
    resultados: Record<string, string>;
    invocacion: string;
  } | null;
}

// ===== Aprobaciones: estrategia de Rox y calendario semanal de Dave =====
//
// Los dos son el mismo patrón con distinto contenido: el agente propone, un
// humano aprueba, y hasta que aprueba NADA aguas abajo lo consume. Por eso
// viven en la misma pantalla.

export interface MandatoDeAgente {
  directiva: string;
  hipotesis: string;
  criterio_verificacion: string;
}

export interface BalanceEstrategia {
  que_mandate: string;
  que_hipotesis_plantee?: string;
  que_dice_neil_que_paso: string;
  que_sostengo: string;
  que_corrijo: string;
}

export interface EstrategiaRox {
  client_id?: string;
  updated_at: string;
  balance_estrategia_anterior: BalanceEstrategia;
  estrategia_sin_objetivos_confirmados?: string | boolean;
  brand_os: {
    north_star_statement: string;
    voice_and_vibe: { tone?: string; prohibited_words?: string[]; mandatory_attributes?: string[] };
  };
  // Los mandatos VIEJOS son texto plano. Los nuevos son objeto con hipótesis
  // y criterio. Conviven a propósito: las estrategias ya guardadas traen la
  // forma vieja y el panel tiene que poder mostrarlas igual.
  agent_mandates: Record<string, MandatoDeAgente | string>;
  data_gaps?: string[];
}

export interface StrategyPendienteResponse {
  hay_pendiente: boolean;
  pendiente: EstrategiaRox | null;
  pendiente_generada_at?: string | null;
  vigente: EstrategiaRox | null;
  vigente_generada_at?: string | null;
}

export interface PiezaDeCalendario {
  fecha: string;
  dia_sugerido?: string;
  concepto?: string;
  objetivo?: string;
  pilar?: string;
  pilar_del_mandato?: string;
  cumple_mandato_de_rox?: string;
  insights_usados?: string[];
  insights_descartados_y_por_que?: string;
  dia_y_hora_propuestos?: { dia?: string; hora?: string; base?: string };
  adaptaciones?: Array<{ plataforma?: string; formato?: string; headline?: string; cuerpo?: string; cta?: string }>;
}

export interface CalendarioSemanal {
  semana_desde: string;
  semana_hasta: string;
  pilares_de_la_semana: string[];
  por_que_esta_distribucion: string;
  piezas: PiezaDeCalendario[];
}

export interface CalendarioPendienteResponse {
  hay_pendiente: boolean;
  calendario: CalendarioSemanal | null;
  generado_at?: string | null;
}
