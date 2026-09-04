const fs = require('fs');
const path = require('path');

const walkSync = function(dir, filelist) {
  let files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
    if (fs.statSync(path.join(dir, file)).isDirectory()) {
      filelist = walkSync(path.join(dir, file), filelist);
    }
    else {
      if (file.endsWith('.tsx')) {
        filelist.push(path.join(dir, file));
      }
    }
  });
  return filelist;
};

const tsxFiles = walkSync('./app');

tsxFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  // Must replace longer strings first to avoid partial replacements!
  
  content = content.replace(/bg-surface-container-high/g, 'bg-[#ECE6F0]');
  content = content.replace(/dark:bg-surface-container-high-dark/g, 'dark:bg-[#2B2930]');
  
  content = content.replace(/bg-surface-container/g, 'bg-[#F3EDF7]');
  content = content.replace(/dark:bg-surface-container-dark/g, 'dark:bg-[#211F26]');

  content = content.replace(/bg-surface-variant/g, 'bg-[#F4EFF4]');
  content = content.replace(/dark:bg-surface-variant-dark/g, 'dark:bg-[#49454F]');
  
  content = content.replace(/bg-surface/g, 'bg-[#FEF7FF]');
  content = content.replace(/dark:bg-surface-dark/g, 'dark:bg-[#141218]');

  fs.writeFileSync(file, content);
});

console.log('Fixed utility classes in ' + tsxFiles.length + ' files.');
