import React from "react";
import RoleBasedUserManagement from "./RoleBasedUserManagement.jsx";
import { useGetAllInchargesQuery } from "@/services/api/InstructorApi.js";

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
