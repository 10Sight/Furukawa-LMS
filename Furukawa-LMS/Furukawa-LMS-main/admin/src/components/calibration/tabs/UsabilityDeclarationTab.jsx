import React from 'react';
import CalibrationDocumentsTable from '../CalibrationDocumentsTable.jsx';
import { CALIBRATION_DOCUMENTS_BY_TAB } from '../calibrationDocumentsData.js';

export default function UsabilityDeclarationTab(props) {
  const items = props.items || CALIBRATION_DOCUMENTS_BY_TAB['usability-declaration'];
  return <CalibrationDocumentsTable items={items} {...props} />;
}
