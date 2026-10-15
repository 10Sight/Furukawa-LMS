import React from 'react';
import CascadingLineAreaSelect, { fetchPdcaSections, getCachedDbSections } from './CascadingLineAreaSelect.jsx';
import { DEFAULT_LINE_AREAS } from '../../pages/pdca/data/pdcaConstants.js';

export { DEFAULT_LINE_AREAS, fetchPdcaSections, getCachedDbSections };

/**
 * Searchable Line/Area Select Component
 * Unified with the database-driven cascading Line/Area/Section dropdown.
 * Backwards compatible with legacy props and table cell usage.
 */
export default function SearchableLineAreaSelect({
  value = '',
  onChange,
  placeholder = 'Select Line/Area...',
  className = '',
  disabled = false,
  compact = true,
  sectionId = null,
  lineId = null,
  apiLines = []
}) {
  return (
    <CascadingLineAreaSelect
      value={value}
      sectionId={sectionId}
      lineId={lineId}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      compact={compact}
    />
  );
}
