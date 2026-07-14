'use client';

import React, { useState, useEffect } from 'react';
import { 
  getOfflineAreas, 
  deleteOfflineArea, 
  getCacheSize,
  OfflineArea 
} from '@/lib/idb';
import {
  calculateTileCount,
  downloadOfflineArea,
  estimateStorageSize,
  formatBytes,
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
  onConfirmDownload: (name: string, zoomLevels: number[]) => void;
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
  const [estimatedTiles, setEstimatedTiles] = useState(0);

  const loadAreas = async () => {
    const areas = await getOfflineAreas();
    setOfflineAreas(areas);
    const size = await getCacheSize();
    setCacheSize(size);
  };

  useEffect(() => {
    loadAreas();
  }, []);

  useEffect(() => {
    if (definedBounds) {
      const count = calculateTileCount(definedBounds, selectedZooms);
      setEstimatedTiles(count);
    }
  }, [definedBounds, selectedZooms]);

  const handleDelete = async (areaId: string) => {
    if (!confirm('Er du sikker på at du vil slette dette offline-området?')) return;
    
    await deleteOfflineArea(areaId);
    await loadAreas();
  };

  const handleConfirm = () => {
    if (!areaName.trim()) {
      alert('Vennligst gi området et navn');
      return;
    }
    if (selectedZooms.length === 0) {
      alert('Vennligst velg minst ett zoom-nivå');
      return;
    }
    onConfirmDownload(areaName, selectedZooms);
    setAreaName('');
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
      </div>

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

          <div className="text-xs text-gray-700 bg-white p-2 rounded">
            <strong>Estimat:</strong> {estimatedTiles} tiles (~{formatBytes(estimateStorageSize(estimatedTiles))})
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded text-xs font-semibold"
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
          disabled={isDefining || isDownloading}
          className={`w-full py-2 px-4 rounded font-semibold text-sm shadow ${
            isDefining || isDownloading
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
                <div>{area.tileCount} tiles (~{formatBytes(estimateStorageSize(area.tileCount))})</div>
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
