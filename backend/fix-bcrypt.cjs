const fs = require('fs');
const path = require('path');

const directory = path.join(__dirname, 'src');

function fixBcrypt(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      fixBcrypt(fullPath);
    } else if (fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes("from 'bcrypt'") || content.includes('from "bcrypt"')) {
        content = content.replace(/from\s+['"]bcrypt['"]/g, "from 'bcryptjs'");
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`✅ Fixed bcrypt import in: ${fullPath}`);
      }
    }
  }
}
console.log('⏳ Scanning for bcrypt...');
fixBcrypt(directory);
console.log('🎉 Done replacing bcrypt with bcryptjs!');