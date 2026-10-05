import React from "react";
import RoleBasedUserManagement from "./RoleBasedUserManagement.jsx";
import { useGetAllMentorsQuery } from "@/services/api/InstructorApi.js";

const Mentor = () => {
  return (
    <RoleBasedUserManagement
      roleName="Mentor"
      roleField="isMentor"
      useQueryHook={useGetAllMentorsQuery}
    />
  );
};

export default Mentor;
