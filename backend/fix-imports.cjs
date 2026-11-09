const fs = require('fs');
const path = require('path');

const directory = path.join(__dirname, 'src');

function fixImports(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      fixImports(fullPath);
    } else if (fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const regex = /from\s+['"](\.[^'"]+)['"]/g;
      let changed = false;
      
      const newContent = content.replace(regex, (match, p1) => {
        if (p1.endsWith('.js') || p1.endsWith('.json') || p1.endsWith('.css')) {
          return match;
        }
        changed = true;
        return `from '${p1}.js'`;
      });

      if (changed) {
        fs.writeFileSync(fullPath, newContent, 'utf8');
        console.log(`✅ Fixed: ${fullPath}`);
      }
    }
  }
}
console.log('⏳ Scanning and fixing imports...');
fixImports(directory);
console.log('🎉 Done! All files checked.');