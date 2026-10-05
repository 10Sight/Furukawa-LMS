import fs from 'fs';
import path from 'path';

const uploadsDir = 'uploads';

// Clean up files older than 1 hour
const cleanupOldFiles = () => {
  if (!fs.existsSync(uploadsDir)) {
    return;
  }

  const files = fs.readdirSync(uploadsDir);
  const now = Date.now();
  const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds

  files.forEach(file => {
    const filePath = path.join(uploadsDir, file);
    const stats = fs.statSync(filePath);
    
    if (now - stats.mtime.getTime() > oneHour) {
      fs.unlinkSync(filePath);
    }
  });
};

// Run cleanup every hour
setInterval(cleanupOldFiles, 60 * 60 * 1000);

export default cleanupOldFiles; 