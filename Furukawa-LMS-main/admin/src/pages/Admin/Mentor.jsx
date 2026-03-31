import React from "react";
import RoleBasedUserManagement from "./RoleBasedUserManagement";
import { useGetAllMentorsQuery } from "@/Redux/AllApi/InstructorApi";

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
