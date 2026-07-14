'use client';

import React from 'react';

interface OfflineAreaControlsProps {
  isDefining: boolean;
  hasDefinedArea: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export default function OfflineAreaControls({
  isDefining,
  hasDefinedArea,
  onSave,
  onCancel,
}: OfflineAreaControlsProps) {
  if (!isDefining) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[2003] bg-white/95 backdrop-blur-sm px-6 py-3 rounded-lg shadow-xl border-2 border-blue-500">
      <div className="text-center mb-3">
        <div className="text-sm font-semibold text-gray-800 mb-1">
          📍 Definer offline-område
        </div>
        <div className="text-xs text-gray-600">
          Klikk to punkter på kartet for å lage et rektangel
        </div>
      </div>
      
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded text-sm"
        >
          Avbryt
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!hasDefinedArea}
          className={`flex-1 font-semibold py-2 px-4 rounded text-sm ${
            hasDefinedArea
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Lagre
        </button>
      </div>
      
      <div className="text-[10px] text-gray-500 text-center mt-2">
        Trykk ESC for å avbryte
      </div>
    </div>
  );
}
