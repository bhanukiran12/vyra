/**
 * Enhanced Game Board with 3D + Mini SVG Reference
 * Combines 3D board visualization with responsive mini board in corner
 */

import React from 'react';
import Board3D from './Board3D';
import Board from './Board';
import { cn } from '../../lib/utils';

export default function GameBoardEnhanced({ className = '', interactive = true, boardMeta = null }) {
  return (
    <div className={cn('relative w-full h-full', className)}>
      {/* Main 3D Board */}
      <Board3D interactive={interactive} boardMeta={boardMeta} />

      {/* Mini SVG Board Reference (Bottom Right Corner) */}
      <div
        className="absolute bottom-6 right-6 bg-black/60 backdrop-blur-sm rounded-lg p-3 border border-blue-500/30"
        style={{
          width: '200px',
          height: '200px',
          pointerEvents: 'none', // Don't interfere with main board
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            opacity: 0.7,
            overflow: 'hidden',
          }}
        >
          {/* Mini SVG Board - scaled down */}
          <div style={{ transform: 'scale(0.25)', transformOrigin: 'top left', width: '400px', height: '400px' }}>
            <Board boardMeta={boardMeta} interactive={false} />
          </div>
        </div>

        {/* Label */}
        <div className="absolute top-1 left-1 text-xs font-mono text-blue-300/70">
          Reference
        </div>
      </div>

      {/* Fullscreen Toggle Button */}
      <div className="absolute top-4 right-4 z-10">
        <button
          className="px-3 py-1.5 bg-gray-800/80 hover:bg-gray-700 text-gray-200 text-sm rounded-md border border-gray-600/50 transition-colors"
          onClick={() => {
            const elem = document.querySelector('[data-board-container]');
            if (elem?.requestFullscreen) {
              elem.requestFullscreen();
            }
          }}
          title="Fullscreen"
        >
          ⛶
        </button>
      </div>
    </div>
  );
}
