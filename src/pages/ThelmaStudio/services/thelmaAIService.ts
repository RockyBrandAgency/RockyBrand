// Capa de servicios de IA de Thelma Studio - HOY todas las funciones son
// stubs honestos (connected:false), a proposito (confirmado con Matias:
// "todo stub por ahora"). La firma de cada funcion ya es la que tendria
// la version real conectada a nuestro API Gateway (mismo patron
// callAction/scopedAction que el resto del panel), para que conectar el
// backend real despues sea solo reemplazar el cuerpo, no la interfaz.
//
// NUNCA se devuelve un corte, audio o B-roll inventado - eso violaria la
// regla de cero fabricacion. Cada funcion devuelve connected:false con un
// motivo explicito hasta que exista un endpoint real detras.

import type { PlacedClip, MediaAsset } from '../types';

export interface AIServiceResult {
  connected: false;
  motivo: string;
}

export interface AIServiceOk<T> {
  connected: true;
  data: T;
}

export type AIServiceResponse<T> = AIServiceResult | AIServiceOk<T>;

function notConnected(servicio: string): AIServiceResult {
  return { connected: false, motivo: `${servicio} no está conectado todavía — esto es un stub tipado, no una respuesta real.` };
}

// --- Bedrock & Gemini: orquestacion de cortes ---
// Toma el guion + el inventario de assets y devuelve un array matematico
// de cortes (que asset, en que frame, por cuanto tiempo).
export interface OrchestrateCutsInput {
  script: string;
  assets: MediaAsset[];
  format: '16:9' | '9:16';
}
export interface OrchestrateCutsResult {
  cuts: Pick<PlacedClip, 'assetId' | 'startFrame' | 'durationInFrames'>[];
}
export async function orchestrateCuts(_input: OrchestrateCutsInput): Promise<AIServiceResponse<OrchestrateCutsResult>> {
  return notConnected('Bedrock/Gemini (orquestación de cortes)');
}

// --- ElevenLabs: locucion ---
// Ya existe codigo real y funcionando para esto en el backend
// (04-codigo/elevenlabs_service.py, usado hoy por el agente Filmmaker) -
// queda igual de stub por decision explicita de Matias, no por falta de
// backend. Conectar esto despues es agregar una accion nueva al panel
// que llame ese modulo y suba el audio a S3.
export interface GenerateVoiceoverInput {
  script: string;
  voiceId?: string;
}
export interface GenerateVoiceoverResult {
  audioUrl: string;
  durationSeg: number;
}
export async function generateVoiceover(_input: GenerateVoiceoverInput): Promise<AIServiceResponse<GenerateVoiceoverResult>> {
  return notConnected('ElevenLabs (locución)');
}

// --- Moonshot / Kling / BytePlus: B-roll sintetico ---
export interface GenerateBrollInput {
  prompt: string;
  format: '16:9' | '9:16';
  durationSeg: number;
}
export interface GenerateBrollResult {
  videoUrl: string;
  durationSeg: number;
}
export async function generateSyntheticBroll(_input: GenerateBrollInput): Promise<AIServiceResponse<GenerateBrollResult>> {
  return notConnected('Moonshot/Kling/BytePlus (B-roll sintético)');
}

// --- Moonshot: procesamiento de brand guidelines de contexto largo ---
export interface ProcessBrandGuidelinesInput {
  documentText: string;
}
export interface ProcessBrandGuidelinesResult {
  resumen: string;
  reglas_extraidas: string[];
}
export async function processBrandGuidelines(_input: ProcessBrandGuidelinesInput): Promise<AIServiceResponse<ProcessBrandGuidelinesResult>> {
  return notConnected('Moonshot (brand guidelines de contexto largo)');
}
