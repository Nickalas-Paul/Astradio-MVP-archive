// vnext/scripts/fix-imports.ts
// Script to fix import statements after consolidation

import fs from 'fs';
import path from 'path';

const importMappings = [
  { from: '../ml/student', to: '../ml' },
  { from: '../critics/melodic', to: '../critics' },
  { from: '../critics/harmony', to: '../critics' },
  { from: '../critics/rhythm', to: '../critics' },
  { from: '../ml/model-adapter', to: '../ml' },
  { from: '../ml/retrieval', to: '../ml' },
  { from: '../ml/refiner', to: '../ml' }
];

function fixImports() {
  console.log("🔧 FIXING IMPORT STATEMENTS");
  console.log("============================");
  
  const scriptsDir = path.resolve(process.cwd(), 'vnext', 'scripts');
  const files = fs.readdirSync(scriptsDir).filter(f => f.endsWith('.ts'));
  
  files.forEach(file => {
    const filePath = path.join(scriptsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    importMappings.forEach(mapping => {
      const oldImport = `from "${mapping.from}"`;
      const newImport = `from "${mapping.to}"`;
      
      if (content.includes(oldImport)) {
        content = content.replace(new RegExp(oldImport, 'g'), newImport);
        modified = true;
      }
    });
    
    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Fixed imports in ${file}`);
    }
  });
  
  // Also fix other vnext files
  const vnextDir = path.resolve(process.cwd(), 'vnext');
  const otherFiles = [
    'audition-gate.ts',
    'plan-generator.ts',
    'teacher/label-from-rules.ts'
  ];
  
  otherFiles.forEach(file => {
    const filePath = path.join(vnextDir, file);
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      let modified = false;
      
      importMappings.forEach(mapping => {
        const oldImport = `from "${mapping.from}"`;
        const newImport = `from "${mapping.to}"`;
        
        if (content.includes(oldImport)) {
          content = content.replace(new RegExp(oldImport, 'g'), newImport);
          modified = true;
        }
      });
      
      if (modified) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Fixed imports in ${file}`);
      }
    }
  });
  
  console.log("\n🎯 Import fixes complete!");
}

if (require.main === module) {
  fixImports();
}

export { fixImports };
