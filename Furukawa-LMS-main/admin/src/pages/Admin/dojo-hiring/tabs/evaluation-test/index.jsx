import React from 'react';
import EvaluationTestList from '@/pages/Admin/EvaluationTest/EvaluationTestList';

export default function EvaluationTestTab(props) {
    return <EvaluationTestList isEmbedded={true} {...props} />;
}
