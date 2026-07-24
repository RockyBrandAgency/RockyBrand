// Sidebar de assets - la unica forma de poblar la libreria es cargando un
// assets.json real (control de archivo). No hay ningun ejemplo hardcodeado
// aca: si Matias no carga nada, la lista queda vacia y dice eso.
import { useRef, useState } from 'react';
import type { MediaAsset } from './types';

interface AssetLibraryProps {
  assets: MediaAsset[];
  selectedAssetId: string | null;
  onSelect: (assetId: string) => void;
  onLoadAssets: (assets: MediaAsset[]) => void;
}

function isMediaAsset(value: unknown): value is MediaAsset {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.nombre === 'string' &&
    typeof v.url === 'string' &&
    (v.tipo === 'video' || v.tipo === 'imagen') &&
    typeof v.duracion_seg === 'number'
  );
}

export function AssetLibrary({ assets, selectedAssetId, onSelect, onLoadAssets }: AssetLibraryProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLoadError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed : parsed?.assets;
      if (!Array.isArray(list) || !list.every(isMediaAsset)) {
        setLoadError('El JSON no tiene el formato esperado (array de assets con id/nombre/url/tipo/duracion_seg).');
        return;
      }
      onLoadAssets(list);
    } catch {
      setLoadError('No se pudo leer el archivo — ¿es un JSON válido?');
    }
  }

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, assetId: string) {
    e.dataTransfer.setData('application/x-thelma-asset-id', assetId);
    e.dataTransfer.effectAllowed = 'copy';
  }

  return (
    <div className="thelma-asset-library">
      <div className="thelma-asset-library-header">
        <span>Assets</span>
        <button type="button" className="thelma-btn-secondary" onClick={() => fileInputRef.current?.click()}>
          Cargar assets.json
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleFileChange} />
      </div>
      {loadError && <p className="thelma-asset-library-error">{loadError}</p>}
      {assets.length === 0 && !loadError && (
        <p className="thelma-empty-note">Sin assets cargados — usá "Cargar assets.json" con un inventario real.</p>
      )}
      <div className="thelma-asset-grid">
        {assets.map((asset) => (
          <div
            key={asset.id}
            className={`thelma-asset-card${selectedAssetId === asset.id ? ' selected' : ''}`}
            draggable
            onDragStart={(e) => handleDragStart(e, asset.id)}
            onClick={() => onSelect(asset.id)}
          >
            <div className="thelma-asset-thumb">
              {asset.thumbnail_url ? (
                <img src={asset.thumbnail_url} alt={asset.nombre} />
              ) : (
                <span className="thelma-asset-thumb-placeholder">{asset.tipo === 'video' ? '▶' : '▢'}</span>
              )}
            </div>
            <div className="thelma-asset-meta">
              <span className="thelma-asset-name">{asset.nombre}</span>
              <span className="thelma-asset-sub">{asset.duracion_seg.toFixed(1)}s{asset.tipo_plano ? ` · ${asset.tipo_plano}` : ''}</span>
              {asset.contexto && <span className="thelma-asset-context">{asset.contexto}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
