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
}

export default function OfflineMapManager({
  onDefineArea,
  isDefining,
  selectedLayer,
}: OfflineMapManagerProps) {
  const [offlineAreas, setOfflineAreas] = useState<OfflineArea[]>([]);
  const [cacheSize, setCacheSize] = useState<number>(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [currentAreaId, setCurrentAreaId] = useState<string | null>(null);

  const loadAreas = async () => {
    const areas = await getOfflineAreas();
    setOfflineAreas(areas);
    const size = await getCacheSize();
    setCacheSize(size);
  };

  useEffect(() => {
    loadAreas();
  }, []);

  const handleDelete = async (areaId: string) => {
    if (!confirm('Er du sikker på at du vil slette dette offline-området?')) return;
    
    await deleteOfflineArea(areaId);
    await loadAreas();
  };

  return (
    <div className="space-y-3">
      {/* Current cache size */}
      <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
        <strong>Total cache:</strong> {formatBytes(cacheSize)}
      </div>

      {/* Define new area button */}
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
        {isDefining ? '📍 Tegn område på kartet' : '+ Definer nytt område'}
      </button>

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

      {offlineAreas.length === 0 && !isDefining && (
        <div className="text-xs text-gray-500 italic text-center py-2">
          Ingen offline-områder lagret ennå
        </div>
      )}
    </div>
  );
}
