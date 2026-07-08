import React from "react";
import { useParams } from "react-router-dom";
import OJTTrainingRecordSheet from "@/components/admin/OJTTrainingRecordSheet";

const OJTShareView = () => {
    const { token } = useParams();

    return (
        <div className="min-h-screen bg-slate-100 py-6 px-4 sm:px-6 lg:px-8">
            <div className="max-w-[1200px] mx-auto p-6 border rounded bg-white">
                <OJTTrainingRecordSheet
                    shareToken={token}
                    studentName="On Job Training"
                    readOnly={true}
                />
            </div>
        </div>
    );
};

export default OJTShareView;
