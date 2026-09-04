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

  // Fix the mangled strings
  content = content.replace(/dark:bg-\[\#FEF7FF\]-dark/g, 'dark:bg-[#141218]');
  content = content.replace(/dark:bg-\[\#F4EFF4\]-dark/g, 'dark:bg-[#49454F]');
  content = content.replace(/dark:bg-\[\#F3EDF7\]-dark/g, 'dark:bg-[#211F26]');
  content = content.replace(/dark:bg-\[\#ECE6F0\]-dark/g, 'dark:bg-[#2B2930]');

  fs.writeFileSync(file, content);
});

console.log('Fixed mangled dark mode classes in ' + tsxFiles.length + ' files.');
