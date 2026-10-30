import React from 'react';

/**
 * Authentic JIS Z8206 Symbols & Special Characteristics Symbols
 * Directly matching reference images:
 * - media_1793353006947_d6ceef74.png (JIS Z8206 Legend Banner)
 * - media_1793353084615_cfb70dde.png (<C> Diamond with C)
 * - media_1793353135655_ed9f257a.png (Circle enclosing square: Operation & Inspection)
 */

export function OperationSymbol({ size = 18, className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`inline-block align-middle ${className}`}
    >
      <circle cx="12" cy="12" r="9" fill="#ffffff" stroke="#000000" strokeWidth="2" />
    </svg>
  );
}

export function InspectionSymbol({ size = 18, className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`inline-block align-middle ${className}`}
    >
      <polygon points="12,2 22,12 12,22 2,12" fill="#ffffff" stroke="#000000" strokeWidth="2" />
    </svg>
  );
}

export function OpInspSymbol({ size = 19, className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`inline-block align-middle ${className}`}
      title="Operation & Inspection"
    >
      <circle cx="12" cy="12" r="10.5" fill="#ffffff" stroke="#000000" strokeWidth="2" />
      <rect x="7" y="7" width="10" height="10" fill="#ffffff" stroke="#000000" strokeWidth="1.8" />
    </svg>
  );
}

export function TempStorageSymbol({ size = 18, className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`inline-block align-middle ${className}`}
    >
      <path
        d="M 5 3 L 5 21 L 12 21 A 9 9 0 0 0 12 3 Z"
        fill="#ffffff"
        stroke="#000000"
        strokeWidth="2"
      />
      <text
        x="9"
        y="15.5"
        textAnchor="middle"
        fontSize="10"
        fontWeight="bold"
        fontFamily="Arial, sans-serif"
        fill="#000000"
      >
        D
      </text>
    </svg>
  );
}

export function StorageSymbol({ size = 18, className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`inline-block align-middle ${className}`}
    >
      <polygon points="2,4 22,4 12,21" fill="#ffffff" stroke="#000000" strokeWidth="2" />
    </svg>
  );
}

export function TransportSymbol({ size = 18, className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`inline-block align-middle ${className}`}
    >
      <path
        d="M 3 9.5 L 14 9.5 L 14 6 L 21 12 L 14 18 L 14 14.5 L 3 14.5 Z"
        fill="#ffffff"
        stroke="#000000"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function ReworkSymbol({ size = 18, className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`inline-block align-middle ${className}`}
    >
      <circle cx="12" cy="12" r="10" fill="#ffffff" stroke="#000000" strokeWidth="2" />
      <circle cx="12" cy="12" r="5" fill="#ffffff" stroke="#000000" strokeWidth="1.8" />
    </svg>
  );
}

/**
 * Authentic Internal Special Characteristic Symbol <C>
 * (Tall diamond enclosing uppercase letter C, matching media_1793353084615_cfb70dde.png)
 */
export function InternalCharSymbol({ width = 14, height = 22, className = '' }) {
  return (
    <svg
      viewBox="0 0 16 26"
      width={width}
      height={height}
      className={`inline-block align-middle ${className}`}
      title="For Internal special characteristics"
    >
      <polygon
        points="8,1 15.2,13 8,25 0.8,13"
        fill="#ffffff"
        stroke="#000000"
        strokeWidth="1.8"
      />
      <text
        x="8"
        y="17"
        textAnchor="middle"
        fontSize="12"
        fontWeight="bold"
        fontFamily="Arial, sans-serif"
        fill="#000000"
      >
        C
      </text>
    </svg>
  );
}

/**
 * Authentic External Special Characteristic Symbol <e>
 * (Tall diamond enclosing lowercase letter e, matching JIS Z8206 legend)
 */
export function ExternalCharSymbol({ width = 14, height = 22, className = '' }) {
  return (
    <svg
      viewBox="0 0 16 26"
      width={width}
      height={height}
      className={`inline-block align-middle ${className}`}
      title="For external special characteristics"
    >
      <polygon
        points="8,1 15.2,13 8,25 0.8,13"
        fill="#ffffff"
        stroke="#000000"
        strokeWidth="1.8"
      />
      <text
        x="8"
        y="16.5"
        textAnchor="middle"
        fontSize="11"
        fontWeight="bold"
        fontFamily="Arial, sans-serif"
        fill="#000000"
      >
        e
      </text>
    </svg>
  );
}

