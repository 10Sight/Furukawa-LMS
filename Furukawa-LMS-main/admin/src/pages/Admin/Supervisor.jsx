import React from "react";
import RoleBasedUserManagement from "./RoleBasedUserManagement";
import { useGetAllSupervisorsQuery } from "@/Redux/AllApi/InstructorApi";

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
