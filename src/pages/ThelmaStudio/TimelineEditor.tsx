// 3 pistas horizontales sobre una grilla de tiempo. Bloques con ancho
// proporcional a la duracion real de cada clip. Drag & drop nativo HTML5
// desde AssetLibrary agrega un clip en la posicion soltada.
import { useRef } from 'react';
import { DEFAULT_TRANSFORM, FPS, type AudioClip, type MediaAsset, type PlacedClip, type ThelmaTracks } from './types';

export type TimelineTrackKey = keyof ThelmaTracks;

interface TimelineEditorProps {
  tracks: ThelmaTracks;
  assets: MediaAsset[];
  selectedClipId: string | null;
  onSelectClip: (clipId: string | null) => void;
  onDropAsset: (track: TimelineTrackKey, assetId: string, startFrame: number) => void;
}

const PIXELS_PER_SECOND = 60;
const PIXELS_PER_FRAME = PIXELS_PER_SECOND / FPS;

const TRACK_LABELS: { key: TimelineTrackKey; label: string }[] = [
  { key: 'audio', label: 'Audio' },
  { key: 'aRoll', label: 'A-Roll' },
  { key: 'bRoll', label: 'B-Roll' },
];

function trackClips(tracks: ThelmaTracks, key: TimelineTrackKey): (PlacedClip | AudioClip)[] {
  return tracks[key];
}

function timelineDurationSeg(tracks: ThelmaTracks): number {
  const ends = [...tracks.audio, ...tracks.aRoll, ...tracks.bRoll].map((c) => (c.startFrame + c.durationInFrames) / FPS);
  const max = ends.length > 0 ? Math.max(...ends) : 0;
  return Math.max(max + 5, 30);
}

export function TimelineEditor({ tracks, assets, selectedClipId, onSelectClip, onDropAsset }: TimelineEditorProps) {
  const trackRefs = useRef<Partial<Record<TimelineTrackKey, HTMLDivElement | null>>>({});
  const durationSeg = timelineDurationSeg(tracks);
  const widthPx = durationSeg * PIXELS_PER_SECOND;
  const ticks = Array.from({ length: Math.ceil(durationSeg / 5) + 1 }, (_, i) => i * 5);

  function handleDrop(e: React.DragEvent<HTMLDivElement>, trackKey: TimelineTrackKey) {
    e.preventDefault();
    // La pista de Audio no acepta assets de video/imagen — se llena vía
    // "Generar Locución" en el AIOrchestratorPanel, no por drag & drop.
    if (trackKey === 'audio') return;
    const assetId = e.dataTransfer.getData('application/x-thelma-asset-id');
    if (!assetId) return;
    const container = trackRefs.current[trackKey];
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const offsetX = Math.max(0, e.clientX - rect.left);
    const startFrame = Math.round(offsetX / PIXELS_PER_FRAME);
    onDropAsset(trackKey, assetId, startFrame);
  }

  return (
    <div className="thelma-timeline">
      <div className="thelma-timeline-ruler" style={{ width: widthPx }}>
        {ticks.map((sec) => (
          <span key={sec} className="thelma-timeline-tick" style={{ left: sec * PIXELS_PER_SECOND }}>
            {sec}s
          </span>
        ))}
      </div>
      {TRACK_LABELS.map(({ key, label }) => (
        <div key={key} className="thelma-timeline-row">
          <div className="thelma-timeline-row-label">{label}</div>
          <div
            className="thelma-timeline-track"
            style={{ width: widthPx }}
            ref={(el) => {
              trackRefs.current[key] = el;
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, key)}
          >
            {trackClips(tracks, key).map((clip) => {
              const asset = key !== 'audio' ? assets.find((a) => a.id === (clip as PlacedClip).assetId) : undefined;
              const name = key === 'audio' ? (clip as AudioClip).nombre : asset?.nombre ?? '?';
              return (
                <div
                  key={clip.id}
                  className={`thelma-timeline-clip thelma-timeline-clip--${key}${selectedClipId === clip.id ? ' selected' : ''}`}
                  style={{
                    left: clip.startFrame * PIXELS_PER_FRAME,
                    width: Math.max(clip.durationInFrames * PIXELS_PER_FRAME, 4),
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectClip(clip.id);
                  }}
                  title={name}
                >
                  <span>{name}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function newPlacedClip(assetId: string, startFrame: number, durationInFrames: number): PlacedClip {
  return {
    id: `${assetId}-${startFrame}-${Date.now()}`,
    assetId,
    startFrame,
    durationInFrames,
    transform: { '16:9': { ...DEFAULT_TRANSFORM }, '9:16': { ...DEFAULT_TRANSFORM } },
  };
}
