import React, { memo } from 'react';
import {
  OperationSymbol,
  InspectionSymbol,
  OpInspSymbol,
  TempStorageSymbol,
  StorageSymbol,
  ReworkSymbol,
} from './FlowchartSymbols';

export const TRACK_X = {
  1: 18,
  2: 42,
  3: 64,
  4: 86,
  5: 108,
  6: 130,
  7: 152,
  8: 174,
  9: 196,
  10: 224,
};

/**
 * Interactive Flowchart Cell component
 * Renders continuous vertical trunk/branch lines, horizontal connections, arrows,
 * and JIS Z8206 symbols.
 */
const FlowchartDiagramCell = memo(function FlowchartDiagramCell({
  row,
  onToggleSymbol,
  onToggleTrack,
}) {
  const nodeTrack = row.flowchartTrack || row.node?.track || 1;
  const nodeX = TRACK_X[nodeTrack] ?? 18;
  const nodeType = row.flowchartType || row.node?.type || 'operation';
  const nodeSymbol = row.flowchartSymbol || row.node?.symbol || 'O';

  const vLines = row.vLines || [];
  const hLines = row.hLines || [];
  const arrows = row.arrows || [];

  return (
    <div className="relative w-full h-full min-h-[52px] select-none flex items-center justify-center pfc-flowchart-cell-inner">
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ minWidth: '240px' }}
      >
        <defs>
          <marker
            id="pfc-arrow-down"
            viewBox="0 0 6 6"
            refX="3"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <polygon points="0,0 6,0 3,6" fill="#0f172a" />
          </marker>
          <marker
            id="pfc-arrow-left"
            viewBox="0 0 6 6"
            refX="1"
            refY="3"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <polygon points="6,0 6,6 0,3" fill="#0f172a" />
          </marker>
          <marker
            id="pfc-arrow-right"
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <polygon points="0,0 0,6 6,3" fill="#0f172a" />
          </marker>
        </defs>

        {/* 1. Horizontal connecting lines */}
        {hLines.map((hl, i) => {
          const x1 = TRACK_X[hl.fromTrack] ?? 18;
          const x2 = TRACK_X[hl.toTrack] ?? 224;
          return (
            <line
              key={`h-${i}`}
              x1={Math.min(x1, x2)}
              y1="50%"
              x2={Math.max(x1, x2)}
              y2="50%"
              stroke="#0f172a"
              strokeWidth="1.8"
            />
          );
        })}

        {/* 2. Vertical trunk and branch lines */}
        {vLines.map((vl, i) => {
          const vx = TRACK_X[vl.track] ?? 18;
          const y1 = vl.from === 'center' ? '50%' : '0%';
          const y2 = vl.to === 'center' ? '50%' : '100%';
          return (
            <line
              key={`v-${i}`}
              x1={vx}
              y1={y1}
              x2={vx}
              y2={y2}
              stroke="#0f172a"
              strokeWidth="1.8"
            />
          );
        })}

        {/* 3. Directional Arrows */}
        {arrows.map((arr, i) => {
          const ax = TRACK_X[arr.track] ?? 18;
          if (arr.direction === 'down') {
            return (
              <polygon
                key={`arr-${i}`}
                points={`${ax - 3.5},calc(50% - 6px) ${ax + 3.5},calc(50% - 6px) ${ax},calc(50% - 0.5px)`}
                fill="#0f172a"
              />
            );
          }
          if (arr.direction === 'left') {
            return (
              <polygon
                key={`arr-${i}`}
                points={`${ax + 6},calc(50% - 3.5px) ${ax + 6},calc(50% + 3.5px) ${ax + 0.5},50%`}
                fill="#0f172a"
              />
            );
          }
          if (arr.direction === 'right') {
            return (
              <polygon
                key={`arr-${i}`}
                points={`${ax - 6},calc(50% - 3.5px) ${ax - 6},calc(50% + 3.5px) ${ax - 0.5},50%`}
                fill="#0f172a"
              />
            );
          }
          return null;
        })}
      </svg>

      {/* 4. Interactive Node Symbol */}
      <button
        type="button"
        onClick={() => onToggleSymbol?.(row.id)}
        className="absolute z-10 flex items-center justify-center p-0 bg-transparent border-0 cursor-pointer transition-transform hover:scale-125 focus:outline-none"
        style={{
          left: `${nodeX}px`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        title={`Click to toggle symbol (Current: ${nodeSymbol || nodeType})`}
        aria-label={`Toggle symbol ${nodeSymbol}`}
      >
        {nodeType === 'inspection' || nodeSymbol === '◇' ? (
          <InspectionSymbol size={20} />
        ) : nodeType === 'op-insp' || nodeSymbol === 'op-insp' ? (
          <OpInspSymbol size={21} />
        ) : nodeType === 'storage' && (nodeSymbol === '▽' || row.opNo === '380') ? (
          <StorageSymbol size={20} />
        ) : nodeType === 'storage' || nodeSymbol === 'D' ? (
          <TempStorageSymbol size={20} />
        ) : nodeType === 'rework' || nodeSymbol === '◎' ? (
          <ReworkSymbol size={20} />
        ) : (
          <OperationSymbol size={20} />
        )}
      </button>
    </div>
  );
});

export default FlowchartDiagramCell;

