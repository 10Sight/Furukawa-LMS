import React from 'react';
import CalibrationDocumentsTable from '../CalibrationDocumentsTable.jsx';
import { CALIBRATION_DOCUMENTS_BY_TAB } from '../calibrationDocumentsData.js';

export default function HalfYearlyPlanTab(props) {
  const items = props.items || CALIBRATION_DOCUMENTS_BY_TAB['half-yearly-plan'];
  return <CalibrationDocumentsTable items={items} {...props} />;
}
