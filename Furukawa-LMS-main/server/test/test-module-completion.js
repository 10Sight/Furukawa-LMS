// Simple test script to verify the module completion logic
// Run this with: node test/test-module-completion.js

// Mock data for testing
const mockProgress = {
  completedModules: [
    { moduleId: "module1", completedAt: new Date() }
  ],
  completedLessons: [
    { lessonId: "lesson1", completedAt: new Date() },
    { lessonId: "lesson2", completedAt: new Date() },
    { lessonId: "lesson3", completedAt: new Date() }
  ]
};

const mockModuleLessons = [
  { _id: "lesson1" },
  { _id: "lesson2" },
  { _id: "lesson3" }
];

// Simple version of the isModuleEffectivelyCompleted function for testing
const isModuleEffectivelyCompleted = async (progress, moduleId, moduleLessons = null) => {
    if (!progress || !moduleId) return false;

    const moduleIdString = String(moduleId);

    // Check if module is explicitly completed
    const isExplicitlyCompleted = progress.completedModules.some(
        module => String(module.moduleId || module) === moduleIdString
    );
    
    if (isExplicitlyCompleted) return true;

    // If module has no lessons, it can't be completed through lesson completion
    if (!Array.isArray(moduleLessons) || moduleLessons.length === 0) {
        return false;
    }

    // Check if all lessons are completed
    const completedLessonIds = progress.completedLessons.map(lesson => 
        String(lesson.lessonId || lesson)
    );

    const allLessonsCompleted = moduleLessons.every(lesson => {
        const lessonId = String(lesson._id || lesson.id || lesson);
        return completedLessonIds.includes(lessonId);
    });

    return allLessonsCompleted;
};

async function testModuleCompletion() {
  // Test 1: Module explicitly completed
  const test1Result = await isModuleEffectivelyCompleted(mockProgress, "module1", []);
  
  // Test 2: Module completed through all lessons done
  const test2Result = await isModuleEffectivelyCompleted(mockProgress, "module2", mockModuleLessons);
  
  // Test 3: Module not completed - missing lessons
  const incompleteLessons = [
    { _id: "lesson1" },
    { _id: "lesson2" },
    { _id: "lesson3" },
    { _id: "lesson4" } // This lesson is not completed
  ];
  const test3Result = await isModuleEffectivelyCompleted(mockProgress, "module3", incompleteLessons);
  
  // Test 4: Module not completed - no explicit completion and no lessons
  const test4Result = await isModuleEffectivelyCompleted(mockProgress, "module4", []);
}

// Run the tests
testModuleCompletion().catch(console.error);

export { testModuleCompletion };
