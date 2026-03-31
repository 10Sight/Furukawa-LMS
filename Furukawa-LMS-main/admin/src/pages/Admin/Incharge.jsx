import React from "react";
import RoleBasedUserManagement from "./RoleBasedUserManagement";
import { useGetAllInchargesQuery } from "@/Redux/AllApi/InstructorApi";

const Incharge = () => {
  return (
    <RoleBasedUserManagement
      roleName="Incharge"
      roleField="isIncharge"
      useQueryHook={useGetAllInchargesQuery}
    />
  );
};

export default Incharge;
