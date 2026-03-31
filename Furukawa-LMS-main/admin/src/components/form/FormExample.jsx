import React, { useState } from "react";
import { 
  DynamicForm, 
  FormInput, 
  FormSelect, 
  FormTextarea, 
  FormCard,
  FIELD_TYPES 
} from "./index";
import { Button } from "@/components/ui/button";
import { IconUser, IconMail, IconPhone, IconBriefcase } from "@tabler/icons-react";

// Example usage of individual form components
export const IndividualFormExample = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "",
    bio: ""
  });
  
  const [errors, setErrors] = useState({});

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Form submitted:", formData);
  };

  const roleOptions = [
    { value: "admin", label: "Administrator", icon: "👑" },
    { value: "instructor", label: "Instructor", icon: "👨‍🏫" },
    { value: "student", label: "Student", icon: "👨‍🎓" }
  ];

  return (
    <FormCard
      title="User Registration"
      description="Create a new user account"
      icon={<IconUser className="h-5 w-5" />}
      variant="elevated"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Full Name"
            value={formData.name}
            onChange={(e) => handleInputChange("name", e.target.value)}
            placeholder="Enter your full name"
            required
            icon={<IconUser className="h-4 w-4" />}
            variant="filled"
            showSuccessIndicator
            success={formData.name.length > 2 ? "Looks good!" : undefined}
          />
          
          <FormInput
            type="email"
            label="Email Address"
            value={formData.email}
            onChange={(e) => handleInputChange("email", e.target.value)}
            placeholder="Enter your email"
            required
            icon={<IconMail className="h-4 w-4" />}
            variant="filled"
            helperText="We'll never share your email"
          />
          
          <FormInput
            type="tel"
            label="Phone Number"
            value={formData.phone}
            onChange={(e) => handleInputChange("phone", e.target.value)}
            placeholder="Enter your phone number"
            optional
            icon={<IconPhone className="h-4 w-4" />}
            variant="filled"
          />
          
          <FormSelect
            label="Role"
            value={formData.role}
            onValueChange={(value) => handleInputChange("role", value)}
            options={roleOptions}
            placeholder="Select your role"
            required
            icon={<IconBriefcase className="h-4 w-4" />}
            variant="filled"
            allowClear
          />
        </div>
        
        <FormTextarea
          label="Bio"
          value={formData.bio}
          onChange={(e) => handleInputChange("bio", e.target.value)}
          placeholder="Tell us about yourself..."
          helperText="Brief description about yourself (optional)"
          maxLength={500}
          showCharacterCount
          autoResize
          allowFullscreen
          variant="filled"
        />
        
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline">
            Cancel
          </Button>
          <Button type="submit">
            Create Account
          </Button>
        </div>
      </form>
    </FormCard>
  );
};

// Example usage of DynamicForm component
export const DynamicFormExample = () => {
  const [formFields, setFormFields] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleFormSubmit = (formData) => {
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      alert("Form submitted successfully!");
    }, 2000);
  };

  const handleFieldsChange = (newFields) => {
    setFormFields(newFields);
  };

  // Pre-configured form fields example
  const initialFields = [
    {
      id: "name",
      type: "text",
      label: "Full Name",
      placeholder: "Enter your name",
      required: true,
      helperText: "Please enter your complete name"
    },
    {
      id: "email",
      type: "email", 
      label: "Email Address",
      placeholder: "Enter your email",
      required: true
    },
    {
      id: "experience",
      type: "select",
      label: "Experience Level",
      options: [
        { label: "Beginner", value: "beginner" },
        { label: "Intermediate", value: "intermediate" },
        { label: "Advanced", value: "advanced" },
        { label: "Expert", value: "expert" }
      ],
      required: true
    },
    {
      id: "message",
      type: "textarea",
      label: "Additional Information",
      placeholder: "Any additional details...",
      helperText: "Please provide any additional information that might be relevant"
    }
  ];

  return (
    <div className="space-y-8">
      {/* Dynamic Form Builder */}
      <DynamicForm
        initialFields={initialFields}
        onSubmit={handleFormSubmit}
        onFieldsChange={handleFieldsChange}
        submitButtonText="Submit Application"
        isLoading={isLoading}
        allowFieldReordering={true}
        allowFieldDuplication={true}
        allowFieldDeletion={true}
        variant="filled"
      />
      
      {/* Form Configuration Display */}
      {formFields.length > 0 && (
        <FormCard
          title="Form Configuration"
          description="Current form structure (JSON)"
          variant="outlined"
          collapsible
          defaultCollapsed
        >
          <pre className="text-xs bg-muted p-4 rounded overflow-auto max-h-60">
            {JSON.stringify(formFields, null, 2)}
          </pre>
        </FormCard>
      )}
    </div>
  );
};

// Main example component
const FormExample = () => {
  const [activeTab, setActiveTab] = useState("individual");

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Enhanced Form Components</h1>
        <p className="text-muted-foreground">
          Modern, accessible form components with advanced features
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex justify-center">
        <div className="flex bg-muted rounded-lg p-1">
          <Button
            variant={activeTab === "individual" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("individual")}
          >
            Individual Components
          </Button>
          <Button
            variant={activeTab === "dynamic" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("dynamic")}
          >
            Dynamic Form Builder
          </Button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "individual" ? (
        <IndividualFormExample />
      ) : (
        <DynamicFormExample />
      )}

      {/* Features Overview */}
      <FormCard
        title="Features Overview"
        description="What's included in these enhanced form components"
        variant="ghost"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">🎨 Modern Design</h3>
            <p className="text-sm text-muted-foreground">
              Multiple variants (default, filled, minimal) with consistent styling
            </p>
          </div>
          
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">📱 Responsive</h3>
            <p className="text-sm text-muted-foreground">
              Mobile-first design that adapts to all screen sizes
            </p>
          </div>
          
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">♿ Accessible</h3>
            <p className="text-sm text-muted-foreground">
              ARIA labels, keyboard navigation, and screen reader support
            </p>
          </div>
          
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">🔧 Configurable</h3>
            <p className="text-sm text-muted-foreground">
              Extensive customization options and props for different use cases
            </p>
          </div>
          
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">🚀 Dynamic</h3>
            <p className="text-sm text-muted-foreground">
              Build forms dynamically with drag & drop field reordering
            </p>
          </div>
          
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">✅ Validation</h3>
            <p className="text-sm text-muted-foreground">
              Built-in validation with clear error states and messaging
            </p>
          </div>
        </div>
      </FormCard>
    </div>
  );
};

export default FormExample;
