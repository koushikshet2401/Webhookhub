const fs = require('fs');
const path = require('path');

const packageJson = require('./backend/package.json');
const deps = Object.keys(packageJson.dependencies || {});

function findRequires(dir, results = new Set()) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      findRequires(fullPath, results);
    } else if (fullPath.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const matches = [...content.matchAll(/require\(['"]([^.'"][^'"]*)['"]\)/g)];
      for (const match of matches) {
        // match[1] is the package name. if it has a slash, get the root (unless it's scoped)
        let pkgName = match[1];
        if (pkgName.startsWith('@')) {
          pkgName = pkgName.split('/').slice(0, 2).join('/');
        } else {
          pkgName = pkgName.split('/')[0];
        }
        // ignore node built-ins
        if (!require('module').builtinModules.includes(pkgName) && !pkgName.startsWith('node:')) {
          results.add(pkgName);
        }
      }
    }
  }
  return results;
}

const requiredPackages = findRequires('./backend/src');
const missing = [];
for (const pkg of requiredPackages) {
  if (!deps.includes(pkg)) {
    missing.push(pkg);
  }
}

if (missing.length > 0) {
  console.log('Missing dependencies:', missing);
  process.exit(1);
} else {
  console.log('All required dependencies are in package.json');
}
