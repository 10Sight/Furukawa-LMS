import React from "react";
import RoleBasedUserManagement from "./RoleBasedUserManagement.jsx";
import { useGetAllSupervisorsQuery } from "@/services/api/InstructorApi.js";

const Supervisor = () => {
  return (
    <RoleBasedUserManagement
      roleName="Supervisor"
      roleField="isSupervisor"
      useQueryHook={useGetAllSupervisorsQuery}
    />
  );
};

export default Supervisor;
