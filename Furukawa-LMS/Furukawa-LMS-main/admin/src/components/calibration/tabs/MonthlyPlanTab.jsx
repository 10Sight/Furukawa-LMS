import React from 'react';
import CalibrationDocumentsTable from '../CalibrationDocumentsTable.jsx';
import { CALIBRATION_DOCUMENTS_BY_TAB } from '../calibrationDocumentsData.js';

export default function MonthlyPlanTab(props) {
  const items = CALIBRATION_DOCUMENTS_BY_TAB['monthly-plan'];
  return <CalibrationDocumentsTable items={items} {...props} />;
}
