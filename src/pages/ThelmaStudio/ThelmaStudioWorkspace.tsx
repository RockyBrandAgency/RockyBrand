// Layout padre de Thelma Studio - herramienta experimental, sin cliente
// asociado. Estado central en useReducer: format, tracks, script, assets,
// selecciones. Cambiar de formato no recalcula nada extra: cada clip ya
// guarda su transform por formato (16:9 y 9:16 por separado), así que la
// selección y el encuadre por formato nunca se pierden al alternar.
import { useReducer } from 'react';
import { AIOrchestratorPanel } from './AIOrchestratorPanel';
import { AssetLibrary } from './AssetLibrary';
import { FormatControls } from './FormatControls';
import { RemotionPreview } from './RemotionPreview';
import { newPlacedClip, TimelineEditor, type TimelineTrackKey } from './TimelineEditor';
import { FPS, type MediaAsset, type ThelmaFormat, type ThelmaTracks } from './types';

interface ThelmaState {
  format: ThelmaFormat;
  tracks: ThelmaTracks;
  script: string;
  assets: MediaAsset[];
  selectedAssetId: string | null;
  selectedClipId: string | null;
}

type ThelmaAction =
  | { type: 'SET_FORMAT'; format: ThelmaFormat }
  | { type: 'LOAD_ASSETS'; assets: MediaAsset[] }
  | { type: 'SELECT_ASSET'; assetId: string }
  | { type: 'SELECT_CLIP'; clipId: string | null }
  | { type: 'SET_SCRIPT'; script: string }
  | { type: 'ADD_CLIP'; track: TimelineTrackKey; assetId: string; startFrame: number };

const initialState: ThelmaState = {
  format: '16:9',
  tracks: { audio: [], aRoll: [], bRoll: [] },
  script: '',
  assets: [],
  selectedAssetId: null,
  selectedClipId: null,
};

function reducer(state: ThelmaState, action: ThelmaAction): ThelmaState {
  switch (action.type) {
    case 'SET_FORMAT':
      return { ...state, format: action.format };
    case 'LOAD_ASSETS':
      return { ...state, assets: action.assets, selectedAssetId: action.assets[0]?.id ?? null };
    case 'SELECT_ASSET':
      return { ...state, selectedAssetId: action.assetId };
    case 'SELECT_CLIP':
      return { ...state, selectedClipId: action.clipId };
    case 'SET_SCRIPT':
      return { ...state, script: action.script };
    case 'ADD_CLIP': {
      if (action.track === 'audio') return state;
      const asset = state.assets.find((a) => a.id === action.assetId);
      if (!asset) return state;
      const durationInFrames = Math.max(Math.round(asset.duracion_seg * FPS), 1);
      const clip = newPlacedClip(action.assetId, action.startFrame, durationInFrames);
      return {
        ...state,
        tracks: { ...state.tracks, [action.track]: [...state.tracks[action.track], clip] },
        selectedClipId: clip.id,
      };
    }
    default:
      return state;
  }
}

export function ThelmaStudioWorkspace() {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <div className="thelma-studio">
      <div className="thelma-studio-header">
        <div>
          <h1>Thelma Studio</h1>
          <p className="thelma-studio-subtitle">Editor de video experimental — sin cliente asociado todavía</p>
        </div>
        <FormatControls format={state.format} onChange={(format) => dispatch({ type: 'SET_FORMAT', format })} />
      </div>

      <div className="thelma-studio-body">
        <AssetLibrary
          assets={state.assets}
          selectedAssetId={state.selectedAssetId}
          onSelect={(assetId) => dispatch({ type: 'SELECT_ASSET', assetId })}
          onLoadAssets={(assets) => dispatch({ type: 'LOAD_ASSETS', assets })}
        />

        <div className="thelma-studio-main">
          <RemotionPreview tracks={state.tracks} format={state.format} assets={state.assets} />
          <TimelineEditor
            tracks={state.tracks}
            assets={state.assets}
            selectedClipId={state.selectedClipId}
            onSelectClip={(clipId) => dispatch({ type: 'SELECT_CLIP', clipId })}
            onDropAsset={(track, assetId, startFrame) => dispatch({ type: 'ADD_CLIP', track, assetId, startFrame })}
          />
        </div>

        <AIOrchestratorPanel
          script={state.script}
          onScriptChange={(script) => dispatch({ type: 'SET_SCRIPT', script })}
          assets={state.assets}
          format={state.format}
        />
      </div>
    </div>
  );
}
