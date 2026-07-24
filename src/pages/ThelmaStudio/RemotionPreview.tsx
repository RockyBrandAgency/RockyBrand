// Envuelve <Player> de @remotion/player - preview en vivo, sin pipeline de
// render/export (eso seria un paso aparte, mas adelante).
import { Player } from '@remotion/player';
import { useMemo } from 'react';
import { ThelmaComposition } from './ThelmaComposition';
import { FPS, type MediaAsset, type ThelmaFormat, type ThelmaTracks } from './types';

interface RemotionPreviewProps {
  tracks: ThelmaTracks;
  format: ThelmaFormat;
  assets: MediaAsset[];
}

const DIMENSIONS: Record<ThelmaFormat, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
};

function computeDurationInFrames(tracks: ThelmaTracks): number {
  const ends = [
    ...tracks.aRoll.map((c) => c.startFrame + c.durationInFrames),
    ...tracks.bRoll.map((c) => c.startFrame + c.durationInFrames),
    ...tracks.audio.map((c) => c.startFrame + c.durationInFrames),
  ];
  const max = ends.length > 0 ? Math.max(...ends) : 0;
  // Remotion exige durationInFrames >= 1
  return Math.max(max, FPS * 3);
}

export function RemotionPreview({ tracks, format, assets }: RemotionPreviewProps) {
  const { width, height } = DIMENSIONS[format];
  const durationInFrames = useMemo(() => computeDurationInFrames(tracks), [tracks]);

  return (
    <div className={`thelma-preview thelma-preview--${format === '9:16' ? 'vertical' : 'horizontal'}`}>
      <Player
        component={ThelmaComposition}
        inputProps={{ tracks, format, assets }}
        durationInFrames={durationInFrames}
        compositionWidth={width}
        compositionHeight={height}
        fps={FPS}
        controls
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
