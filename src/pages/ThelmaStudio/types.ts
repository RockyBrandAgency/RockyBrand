// Tipos de Thelma Studio - editor de video experimental, sin cliente
// asociado todavia. El vocabulario de MediaAsset (contexto/tipo_plano/
// energia/duracion/aspect_ratio_nativo) es el mismo que ya usan
// asset_analyzer.py y fcpxml_builder.py en el backend real del agente
// Filmmaker, para quedar compatible si esto se conecta de verdad mas
// adelante - no se inventa un vocabulario nuevo sin motivo.

export type ThelmaFormat = '16:9' | '9:16';

export interface MediaAsset {
  id: string;
  nombre: string;
  url: string;
  thumbnail_url?: string;
  tipo: 'video' | 'imagen';
  duracion_seg: number;
  aspect_ratio_nativo?: string;
  contexto?: string;
  tipo_plano?: 'wide' | 'medium' | 'closeup' | string;
  energia?: 'baja' | 'media' | 'alta' | string;
}

export interface PlacedClip {
  // instancia de un MediaAsset puesto en una pista - un mismo asset puede
  // aparecer varias veces con distintos placedClip.id
  id: string;
  assetId: string;
  startFrame: number;
  durationInFrames: number;
  // transform por formato: separado por 16:9 y 9:16 para no perder el
  // encuadre de un formato al cambiar al otro
  transform: Record<ThelmaFormat, { scale: number; x: number; y: number }>;
}

export interface AudioClip {
  id: string;
  nombre: string;
  url: string;
  startFrame: number;
  durationInFrames: number;
}

export interface ThelmaTracks {
  audio: AudioClip[];
  aRoll: PlacedClip[];
  bRoll: PlacedClip[];
}

export const FPS = 30;

export const DEFAULT_TRANSFORM = { scale: 1, x: 0, y: 0 };
