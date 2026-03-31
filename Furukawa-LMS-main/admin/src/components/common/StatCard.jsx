import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const StatCard = ({
  title,
  value,
  description,
  icon: Icon,
  iconBgColor = "bg-blue-100",
  iconColor = "text-blue-600",
  gradientFrom = "from-blue-50",
  gradientTo = "to-blue-100",
  borderColor = "border-blue-200",
  textColor = "text-blue-800",
  valueColor = "text-blue-900",
}) => {
  return (
    <Card className={`bg-gradient-to-br ${gradientFrom} ${gradientTo} ${borderColor}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className={`text-sm font-medium ${textColor}`}>
          {title}
        </CardTitle>
        <div className={`p-2 rounded-full ${iconBgColor}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-3xl font-bold ${valueColor}`}>{value}</div>
        {description && (
          <p className={`text-xs ${textColor} mt-1`}>{description}</p>
        )}
      </CardContent>
    </Card>
  );
};

export default StatCard;