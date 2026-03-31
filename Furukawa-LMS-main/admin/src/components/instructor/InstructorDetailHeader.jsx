import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  IconMail, 
  IconPhone, 
  IconCalendar, 
  IconEdit, 
  IconSchool,
  IconUsers,
  IconBook,
  IconMapPin,
  IconStar,
  IconCertificate
} from "@tabler/icons-react";

const InstructorDetailHeader = ({ instructor, onEdit }) => {
  const getStatusBadge = (status) => {
    switch (status) {
      case "ACTIVE":
        return <Badge variant="success" className="px-2 py-1 rounded-full">Active</Badge>;
      case "SUSPENDED":
        return <Badge variant="destructive" className="px-2 py-1 rounded-full">Suspended</Badge>;
      case "PENDING":
        return <Badge variant="warning" className="px-2 py-1 rounded-full">Pending</Badge>;
      case "BANNED":
        return <Badge variant="destructive" className="px-2 py-1 rounded-full">Banned</Badge>;
      default:
        return <Badge variant="secondary" className="px-2 py-1 rounded-full">{status}</Badge>;
    }
  };

  // Stats data (would typically come from props)
  const stats = [
    { icon: IconBook, label: "Courses", value: instructor.coursesCount || 12 },
    { icon: IconUsers, label: "Students", value: instructor.studentsCount || 245 },
    { icon: IconStar, label: "Rating", value: instructor.rating || "4.8" },
    { icon: IconCertificate, label: "Certifications", value: instructor.certificationsCount || 3 },
  ];

  return (
    <Card className="overflow-hidden border-0 shadow-lg">
      {/* Gradient header with pattern overlay */}
      <div className="relative h-40 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgdmlld0JveD0iMCAwIDYwIDYwIj48ZyBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2Utb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNIDAgMCBMIDYwIDYwIE0gNjAgMCBMIDAgNjAiLz48L2c+PC9zdmc+')] opacity-20"></div>
        
        {/* Profile action button in header */}
        <div className="absolute top-4 right-4">
          <Button 
            onClick={onEdit} 
            className="gap-2 bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border-white/30"
            size="sm"
          >
            <IconEdit className="h-4 w-4" />
            Edit Profile
          </Button>
        </div>
      </div>
      
      <CardContent className="relative pt-0 px-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between -mt-16">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-4 md:gap-6">
            {/* Enhanced Avatar with status indicator */}
            <div className="relative">
              <Avatar className="h-28 w-28 border-4 border-background shadow-lg">
                <AvatarImage src={instructor.avatar?.url} alt={instructor.fullName} />
                <AvatarFallback className="text-2xl bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800">
                  {(instructor.fullName || "U")
                    .split(" ")
                    .map(n => n[0])
                    .join("")
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {/* Online status indicator */}
              {instructor.status === "ACTIVE" && (
                <div className="absolute bottom-2 right-2 w-5 h-5 bg-green-500 rounded-full border-2 border-background"></div>
              )}
            </div>
            
            <div className="text-center md:text-left mb-4 md:mb-6">
              <div className="flex flex-col md:flex-row items-center gap-3 justify-center md:justify-start">
                <h1 className="text-3xl font-bold tracking-tight">{instructor.fullName}</h1>
                {getStatusBadge(instructor.status)}
              </div>
              
              <p className="text-muted-foreground mt-1">@{instructor.userName}</p>
              
              {instructor.title && (
                <p className="text-blue-600 font-medium mt-1 flex items-center justify-center md:justify-start gap-1">
                  <IconSchool className="h-4 w-4" />
                  {instructor.title}
                </p>
              )}
              
              {instructor.location && (
                <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center md:justify-start gap-1">
                  <IconMapPin className="h-4 w-4" />
                  {instructor.location}
                </p>
              )}
              
              <div className="flex flex-wrap items-center gap-4 mt-3 justify-center md:justify-start">
                <div className="flex items-center gap-1 text-sm bg-muted/40 px-2 py-1 rounded-md">
                  <IconMail className="h-4 w-4" />
                  <span>{instructor.email}</span>
                </div>
                {instructor.phoneNumber && (
                  <div className="flex items-center gap-1 text-sm bg-muted/40 px-2 py-1 rounded-md">
                    <IconPhone className="h-4 w-4" />
                    <span>{instructor.phoneNumber}</span>
                  </div>
                )}
                <div className="flex items-center gap-1 text-sm bg-muted/40 px-2 py-1 rounded-md">
                  <IconCalendar className="h-4 w-4" />
                  <span>Joined {new Date(instructor.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Bio section */}
        {instructor.bio && (
          <div className="mt-6 p-5 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">ABOUT</h3>
            <p className="text-sm">"{instructor.bio}"</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InstructorDetailHeader;