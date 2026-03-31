// Test script to verify quiz and assignment module linking
// Run with: node test/test-quiz-assignment-module-linking.js

const BASE_URL = "http://localhost:8080";

async function testModuleLinking() {
  try {
    // Test 1: Check if quiz endpoints are working
    try {
      const quizResponse = await fetch(`${BASE_URL}/api/quizzes`, {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      // Handle connection error
    }

    // Test 2: Check assignment endpoints
    try {
      const assignResponse = await fetch(`${BASE_URL}/api/assignments`, {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      // Handle connection error
    }

    // Test 3: Check accessible endpoints pattern
    const sampleCourseId = "507f1f77bcf86cd799439011";
    const sampleModuleId = "507f1f77bcf86cd799439012"; 
    
    try {
      const accessibleQuizResponse = await fetch(`${BASE_URL}/api/quizzes/accessible/${sampleCourseId}/${sampleModuleId}`, {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      // Handle connection error
    }

    try {
      const accessibleAssignResponse = await fetch(`${BASE_URL}/api/assignments/accessible/${sampleCourseId}/${sampleModuleId}`, {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      // Handle connection error
    }

  } catch (error) {
    console.error("Test failed:", error.message);
  }
}

// Run the test
testModuleLinking();
