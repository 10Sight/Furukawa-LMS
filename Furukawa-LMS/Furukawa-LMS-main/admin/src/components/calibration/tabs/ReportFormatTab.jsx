import React from 'react';
import CalibrationDocumentsTable from '../CalibrationDocumentsTable.jsx';
import { CALIBRATION_DOCUMENTS_BY_TAB } from '../calibrationDocumentsData.js';

export default function ReportFormatTab({ subFilter = 'format-checksheet', ...props }) {
  const allItems = CALIBRATION_DOCUMENTS_BY_TAB['report-format'] || [];
  const items = allItems.filter((item) => !item.subType || item.subType === subFilter);
  return <CalibrationDocumentsTable items={items} {...props} />;
}
