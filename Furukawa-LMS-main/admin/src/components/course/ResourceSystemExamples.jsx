import React from "react";
import { UniversalResourceList } from "./UniversalResourceList";

// Example usage of the Universal Resource System

// 1. Course-level Resources Example
export const CourseResourcesExample = ({ courseId, courseName }) => (
  <UniversalResourceList
    scope="course"
    courseId={courseId}
    entityName={courseName}
    showAddButton={true}
  />
);

// 2. Module-level Resources Example  
export const ModuleResourcesExample = ({ moduleId, moduleName }) => (
  <UniversalResourceList
    scope="module"
    moduleId={moduleId}
    entityName={moduleName}
    showAddButton={true}
  />
);

// 3. Lesson-level Resources Example
export const LessonResourcesExample = ({ lessonId, lessonName }) => (
  <UniversalResourceList
    scope="lesson"
    lessonId={lessonId}
    entityName={lessonName}
    showAddButton={true}
  />
);

// Example integration in CourseDetailPage
export const CourseDetailWithResources = ({ courseId }) => {
  return (
    <div className="space-y-6">
      {/* Existing course content */}
      
      {/* Add Course-level Resources */}
      <CourseResourcesExample 
        courseId={courseId} 
        courseName="React Development Course" 
      />
    </div>
  );
};

// Example integration in ModuleItem component
export const ModuleItemWithResources = ({ moduleId }) => {
  return (
    <div className="space-y-4">
      {/* Existing module content */}
      
      {/* Add Module-level Resources */}
      <ModuleResourcesExample 
        moduleId={moduleId} 
        moduleName="Introduction to Components" 
      />
    </div>
  );
};

// Example integration in LessonView component
export const LessonViewWithResources = ({ lessonId }) => {
  return (
    <div className="space-y-4">
      {/* Existing lesson content */}
      
      {/* Add Lesson-level Resources */}
      <LessonResourcesExample 
        lessonId={lessonId} 
        lessonName="State Management Basics" 
      />
    </div>
  );
};

/*
HOW TO USE:

1. Import the UniversalResourceList component:
   import { UniversalResourceList } from "@/components/course/UniversalResourceList";

2. Use it in your component:
   <UniversalResourceList
     scope="course" // or "module" or "lesson"
     courseId={courseId} // Required for course scope
     moduleId={moduleId} // Required for module scope  
     lessonId={lessonId} // Required for lesson scope
     entityName="Your Course/Module/Lesson Name" // Optional, for display
     showAddButton={true} // Optional, defaults to true
   />

3. The component will automatically:
   - Fetch and display appropriate resources
   - Show add resource modal when clicking "Add Resource"
   - Handle file uploads to Cloudinary
   - Support external URL resources
   - Provide delete functionality
   - Show loading and error states

4. Supported resource types:
   - PDF documents (uploaded to Cloudinary)
   - Videos (uploaded to Cloudinary)
   - Images (uploaded to Cloudinary) 
   - Text documents (uploaded to Cloudinary)
   - External links (URL only)

5. API endpoints being used:
   - POST /api/resources - Create resource with file upload
   - GET /api/resources/course/:courseId - Get course resources
   - GET /api/resources/module/:moduleId - Get module resources
   - GET /api/resources/lesson/:lessonId - Get lesson resources
   - DELETE /api/resources/:resourceId - Delete resource
*/
