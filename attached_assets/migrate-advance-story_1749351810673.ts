
import fs from 'fs';
import path from 'path';

const projectRoot = path.resolve(__dirname);
const fileExtensions = ['.ts', '.tsx'];
const ignoreDirs = ['node_modules', '.git', 'dist', 'build'];

function walkDir(dir: string, callback: (filePath: string) => void) {
  if (ignoreDirs.some(d => dir.includes(d))) return;

  fs.readdirSync(dir).forEach((f) => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else if (fileExtensions.includes(path.extname(f))) {
      callback(path.join(dir, f));
    }
  });
}

function patchFile(filePath: string) {
  let code = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Skip if no mutation calls
  if (!code.includes('advanceStoryMutation.mutate')) return;

  // Remove useMutation import
  if (code.includes('@tanstack/react-query')) {
    code = code.replace(/import\s*{\s*([^}]*useMutation[^}]*)\s*}\s*from\s*['"]@tanstack\/react-query['"];?/g, (match, imports) => {
      const newImports = imports.split(',')
        .filter(i => !i.includes('useMutation'))
        .join(',');
      return newImports ? `import { ${newImports} } from '@tanstack/react-query';` : '';
    });
    modified = true;
  }

  // Remove mutation declaration
  const mutationPattern = /const\s+advanceStoryMutation\s*=\s*useMutation[^;]+;/g;
  if (code.match(mutationPattern)) {
    code = code.replace(mutationPattern, '');
    modified = true;
  }

  // Replace mutation calls
  const pattern = /advanceStoryMutation\.mutate\(\s*({[^}]+}|\w+)\s*(?:,\s*{[^}]+})?\s*\);/g;
  code = code.replace(pattern, (match, arg) => {
    modified = true;
    return `
    setLastChoice({ action: ${arg}.action, skillCheckResult: ${arg}.skillCheckResult });
    await handleCustomActionStreaming();`;
  });

  if (modified) {
    try {
      fs.writeFileSync(filePath, code, 'utf8');
      console.log(`✅ Updated: ${path.relative(projectRoot, filePath)}`);
    } catch (error) {
      console.error(`❌ Failed to write: ${path.relative(projectRoot, filePath)}`, error);
    }
  }
}

console.log('🔁 Starting migration: advanceStoryMutation.mutate → handleCustomActionStreaming');

try {
  walkDir(projectRoot, patchFile);
  console.log('🏁 Migration complete!');
  console.log('\nRemember to:');
  console.log('1. Remove any unused imports');
  console.log('2. Verify handleCustomActionStreaming is properly imported');
  console.log('3. Test the changes in each component');
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}
