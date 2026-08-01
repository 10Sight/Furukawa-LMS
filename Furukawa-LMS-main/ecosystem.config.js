module.exports = {
  apps: [
    {
      name: "lms-backend",
      cwd: "./server",
      script: "index.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      }
    },
    {
      name: "lms-frontend",
      cwd: "./admin",
      script: "./node_modules/vite/bin/vite.js",
      args: "dev --host --port 5174", 
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "development",
        VITE_BASE_URL: "" // Change this to your Server IP for external access
      }
    }
  ]
};