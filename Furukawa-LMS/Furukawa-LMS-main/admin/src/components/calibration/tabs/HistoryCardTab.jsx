import React from 'react';
import CalibrationDocumentsTable from '../CalibrationDocumentsTable.jsx';
import { CALIBRATION_DOCUMENTS_BY_TAB } from '../calibrationDocumentsData.js';

export default function HistoryCardTab(props) {
  const items = props.items || CALIBRATION_DOCUMENTS_BY_TAB['history-card'];
  return <CalibrationDocumentsTable items={items} {...props} />;
}
