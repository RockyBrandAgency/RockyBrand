// Composicion Remotion real - renderiza A-Roll, B-Roll y audio segun el
// estado real del timeline. Si no hay clips puestos todavia, muestra un
// estado vacio real dentro del propio player (no una barra de progreso
// fingiendo contenido que no existe).
import { AbsoluteFill, Audio, Img, Sequence, Video } from 'remotion';
import type { MediaAsset, ThelmaFormat, ThelmaTracks } from './types';

export interface ThelmaCompositionProps {
  tracks: ThelmaTracks;
  format: ThelmaFormat;
  assets: MediaAsset[];
}

function findAsset(assets: MediaAsset[], assetId: string): MediaAsset | undefined {
  return assets.find((a) => a.id === assetId);
}

export function ThelmaComposition({ tracks, format, assets }: ThelmaCompositionProps) {
  const isEmpty = tracks.aRoll.length === 0 && tracks.bRoll.length === 0 && tracks.audio.length === 0;

  if (isEmpty) {
    return (
      <AbsoluteFill className="thelma-comp-empty">
        <div className="thelma-comp-empty-inner">
          <span>Sin clips en el timeline</span>
          <span className="thelma-comp-empty-hint">Cargá un assets.json y arrastrá clips a las pistas</span>
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill className="thelma-comp-root">
      {tracks.bRoll.map((clip) => {
        const asset = findAsset(assets, clip.assetId);
        if (!asset) return null;
        const t = clip.transform[format];
        return (
          <Sequence key={clip.id} from={clip.startFrame} durationInFrames={clip.durationInFrames} layout="none">
            <AbsoluteFill style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})` }}>
              {asset.tipo === 'video' ? (
                <Video src={asset.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Img src={asset.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
            </AbsoluteFill>
          </Sequence>
        );
      })}
      {tracks.aRoll.map((clip) => {
        const asset = findAsset(assets, clip.assetId);
        if (!asset) return null;
        const t = clip.transform[format];
        return (
          <Sequence key={clip.id} from={clip.startFrame} durationInFrames={clip.durationInFrames} layout="none">
            <AbsoluteFill style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.scale})` }}>
              {asset.tipo === 'video' ? (
                <Video src={asset.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Img src={asset.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
            </AbsoluteFill>
          </Sequence>
        );
      })}
      {tracks.audio.map((clip) => (
        <Sequence key={clip.id} from={clip.startFrame} durationInFrames={clip.durationInFrames} layout="none">
          <Audio src={clip.url} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
