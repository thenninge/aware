'use client';

import React, { useState, useEffect } from 'react';
import { 
  getOfflineAreas, 
  deleteOfflineArea, 
  getCacheSize,
  getStorageInfo,
  requestPersistentStorage,
  OfflineArea,
  StorageInfo,
} from '@/lib/idb';
import {
  MAX_TILES_PER_DOWNLOAD,
  calculateElevationTileCount,
  calculateTileCount,
  estimateStorageSize,
  formatBytes,
  getOfflinePolicy,
  DownloadProgress,
} from '@/lib/offlineTiles';

interface OfflineMapManagerProps {
  onDefineArea: () => void;
  isDefining: boolean;
  selectedLayer: {
    key: string;
    name: string;
    url: string;
  };
  definedBounds: { north: number; south: number; east: number; west: number } | null;
  onConfirmDownload: (name: string, zoomLevels: number[], includeElevation: boolean, onProgress: (progress: DownloadProgress) => void) => Promise<void>;
  onCancelDefine: () => void;
}

export default function OfflineMapManager({
  onDefineArea,
  isDefining,
  selectedLayer,
  definedBounds,
  onConfirmDownload,
  onCancelDefine,
}: OfflineMapManagerProps) {
  const [offlineAreas, setOfflineAreas] = useState<OfflineArea[]>([]);
  const [cacheSize, setCacheSize] = useState<number>(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  
  // Download configuration
  const [areaName, setAreaName] = useState('');
  const [selectedZooms, setSelectedZooms] = useState<number[]>([14, 15, 16]);
  const [includeElevation, setIncludeElevation] = useState(true);
  const [estimatedTiles, setEstimatedTiles] = useState(0);
  const [estimatedElevationTiles, setEstimatedElevationTiles] = useState(0);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);

  const policy = getOfflinePolicy(selectedLayer.key);
  const canDownload = policy === 'full';
  const totalEstimatedTiles = estimatedTiles + (includeElevation ? estimatedElevationTiles : 0);
  const tooManyTiles = totalEstimatedTiles > MAX_TILES_PER_DOWNLOAD;

  const loadAreas = async () => {
    const areas = await getOfflineAreas();
    setOfflineAreas(areas);
    const size = await getCacheSize();
    setCacheSize(size);
    setStorageInfo(await getStorageInfo());
  };

  useEffect(() => {
    loadAreas();
  }, []);

  useEffect(() => {
    if (definedBounds) {
      setEstimatedTiles(calculateTileCount(definedBounds, selectedZooms));
      setEstimatedElevationTiles(calculateElevationTileCount(definedBounds));
    }
  }, [definedBounds, selectedZooms]);

  const handleRequestPersist = async () => {
    await requestPersistentStorage();
    setStorageInfo(await getStorageInfo());
  };

  const handleDelete = async (areaId: string) => {
    if (!confirm('Er du sikker på at du vil slette dette offline-området?')) return;
    
    await deleteOfflineArea(areaId);
    await loadAreas();
  };

  const handleConfirm = async () => {
    if (!areaName.trim()) {
      alert('Vennligst gi området et navn');
      return;
    }
    if (selectedZooms.length === 0) {
      alert('Vennligst velg minst ett zoom-nivå');
      return;
    }
    
    if (tooManyTiles) {
      alert(`For mange fliser (${totalEstimatedTiles}). Velg et mindre område eller færre zoom-nivåer (maks ${MAX_TILES_PER_DOWNLOAD}).`);
      return;
    }

    setIsDownloading(true);
    setDownloadProgress({ current: 0, total: totalEstimatedTiles, percentage: 0 });
    
    try {
      // Call download with current values and progress callback
      await onConfirmDownload(areaName, selectedZooms, includeElevation, (progress) => {
        setDownloadProgress(progress);
      });
      
      // Reset form after successful download
      setAreaName('');
      setIncludeElevation(true);
      await loadAreas(); // Reload areas to show the new one
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  };

  const toggleZoom = (zoom: number) => {
    setSelectedZooms(prev => 
      prev.includes(zoom) 
        ? prev.filter(z => z !== zoom)
        : [...prev, zoom].sort((a, b) => a - b)
    );
  };

  return (
    <div className="space-y-3">
      {/* Current cache size */}
      <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
        <strong>Total cache:</strong> {formatBytes(cacheSize)}
        {storageInfo?.usage != null && storageInfo.quota != null && (
          <div className="text-[10px] text-gray-500 mt-1">
            Nettleserlagring: {formatBytes(storageInfo.usage)} av {formatBytes(storageInfo.quota)}
          </div>
        )}
        {storageInfo?.persisted === true && (
          <div className="text-[10px] text-green-600 mt-1">✓ Lagringen er beskyttet mot automatisk sletting</div>
        )}
        {storageInfo?.persisted === false && (
          <div className="text-[10px] text-amber-700 mt-1">
            Nettleseren kan slette kartene hvis appen ikke brukes på en stund (iOS: etter ca. 7 dager).
            Legg appen til på hjemskjermen for å unngå dette.{' '}
            <button type="button" onClick={handleRequestPersist} className="underline">
              Be om permanent lagring
            </button>
          </div>
        )}
      </div>

      {!canDownload && (
        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded">
          {policy === 'view'
            ? `«${selectedLayer.name}» kan ikke lastes ned i bulk. Kart du ser på lagres automatisk for offline bruk.`
            : `«${selectedLayer.name}» kan ikke lagres offline (lisensvilkår). Bytt til Topo (Kartverket) for å laste ned områder.`}
        </div>
      )}

      {/* Download configuration (shown when bounds are defined) */}
      {definedBounds && !isDownloading && (
        <div className="bg-blue-50 p-3 rounded border border-blue-200 space-y-2">
          <div className="text-xs font-semibold text-blue-800">Konfigurer nedlasting:</div>
          
          <input
            type="text"
            placeholder="Navn på område (f.eks. 'Hjortejakt 2026')"
            value={areaName}
            onChange={(e) => setAreaName(e.target.value)}
            className="w-full px-2 py-1 text-xs border rounded"
          />
          
          <div>
            <div className="text-xs text-gray-700 mb-1">Zoom-nivåer:</div>
            <div className="flex flex-wrap gap-1">
              {[12, 13, 14, 15, 16, 17].map(zoom => (
                <button
                  key={zoom}
                  type="button"
                  onClick={() => toggleZoom(zoom)}
                  className={`px-2 py-1 text-xs rounded ${
                    selectedZooms.includes(zoom)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {zoom}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-gray-500 mt-1">
              Anbefalt: 14-16 for jakt. Høyere = mer detalj, men flere tiles
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
              <input
                type="checkbox"
                checked={includeElevation}
                onChange={(e) => setIncludeElevation(e.target.checked)}
                className="w-4 h-4"
              />
              <span>Inkluder høydedata (for offline høydeprofiler)</span>
            </label>
            <div className="text-[10px] text-gray-500 mt-1 ml-6">
              {estimatedElevationTiles} høydefliser (ett zoom-nivå), gir offline høydeprofiler
            </div>
          </div>

          <div className="text-xs text-gray-700 bg-white p-2 rounded">
            <strong>Estimat:</strong> {totalEstimatedTiles} tiles (~{formatBytes(estimateStorageSize(estimatedTiles, includeElevation ? estimatedElevationTiles : 0))})
            {includeElevation && (
              <div className="text-[10px] text-gray-600 mt-1">
                {estimatedTiles} kartbilder + {estimatedElevationTiles} høydedata
              </div>
            )}
            {tooManyTiles && (
              <div className="text-[10px] text-red-600 mt-1">
                Over grensen på {MAX_TILES_PER_DOWNLOAD} tiles. Velg mindre område eller færre zoom-nivåer.
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={tooManyTiles || !canDownload}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Last ned
            </button>
            <button
              type="button"
              onClick={onCancelDefine}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-1 px-3 rounded text-xs font-semibold"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}

      {/* Define new area button */}
      {!definedBounds && (
        <button
          type="button"
          onClick={onDefineArea}
          disabled={isDefining || isDownloading || !canDownload}
          className={`w-full py-2 px-4 rounded font-semibold text-sm shadow ${
            isDefining || isDownloading || !canDownload
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isDefining ? '📍 Klikk to punkter på kartet' : '+ Definer nytt område'}
        </button>
      )}

      {/* Download progress */}
      {isDownloading && downloadProgress && (
        <div className="bg-blue-50 p-3 rounded border border-blue-200">
          <div className="text-xs font-semibold text-blue-800 mb-1">
            Laster ned tiles...
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2 mb-1">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${downloadProgress.percentage}%` }}
            />
          </div>
          <div className="text-xs text-blue-700">
            {downloadProgress.current} / {downloadProgress.total} tiles ({downloadProgress.percentage}%)
          </div>
        </div>
      )}

      {/* List of offline areas */}
      {offlineAreas.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-gray-700">Lagrede områder:</div>
          {offlineAreas.map((area) => (
            <div
              key={area.id}
              className="bg-gray-50 p-2 rounded border border-gray-200 text-xs"
            >
              <div className="flex items-start justify-between mb-1">
                <div className="font-semibold text-gray-800">{area.name}</div>
                <button
                  type="button"
                  onClick={() => handleDelete(area.id)}
                  disabled={isDownloading}
                  className="text-red-600 hover:text-red-800 text-lg leading-none disabled:opacity-50"
                  title="Slett"
                >
                  🗑️
                </button>
              </div>
              <div className="text-gray-600 space-y-0.5">
                <div>Lag: {area.layer}</div>
                <div>Zoom: {area.zoomLevels.join(', ')}</div>
                <div>
                  {area.tileCount} kart-tiles
                  {area.includesElevation && ` + ${area.elevationTileCount} høyde-tiles`}
                  {' '}(~{formatBytes(estimateStorageSize(area.tileCount, area.includesElevation ? area.elevationTileCount : 0))})
                </div>
                {!!area.failedTileCount && (
                  <div className="text-[10px] text-amber-700">
                    ⚠ {area.failedTileCount} tiles kunne ikke lastes ned (hull i kartet)
                  </div>
                )}
                {area.includesElevation && (
                  <div className="text-[10px] text-green-600">
                    ✓ Inkluderer høydedata
                  </div>
                )}
                <div className="text-[10px] text-gray-500">
                  {new Date(area.createdAt).toLocaleString('no-NO')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {offlineAreas.length === 0 && !isDefining && !definedBounds && (
        <div className="text-xs text-gray-500 italic text-center py-2">
          Ingen offline-områder lagret ennå
        </div>
      )}
    </div>
  );
}
