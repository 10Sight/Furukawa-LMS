import React from 'react';
import EvaluationTestList from "@/pages/assessments/evaluation-tests/EvaluationTestList.jsx";

export default function EvaluationTestTab(props) {
    return <EvaluationTestList isEmbedded={true} {...props} />;
}
