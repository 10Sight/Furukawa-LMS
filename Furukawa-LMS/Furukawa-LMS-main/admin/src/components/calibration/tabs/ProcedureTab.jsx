import React from 'react';
import CalibrationDocumentsTable from '../CalibrationDocumentsTable.jsx';
import { CALIBRATION_DOCUMENTS_BY_TAB } from '../calibrationDocumentsData.js';

export default function ProcedureTab(props) {
  const items = CALIBRATION_DOCUMENTS_BY_TAB.procedure;
  return <CalibrationDocumentsTable items={items} {...props} />;
}
