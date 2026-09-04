const fs = require('fs');
const path = require('path');

const walkSync = function(dir, filelist) {
  files = fs.readdirSync(dir);
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

  // Main Backgrounds
  content = content.replace(/bg-slate-50 dark:bg-slate-950/g, 'bg-surface dark:bg-surface-dark');
  content = content.replace(/bg-white dark:bg-slate-950/g, 'bg-surface dark:bg-surface-dark');
  content = content.replace(/bg-white dark:bg-slate-900/g, 'bg-surface-variant dark:bg-surface-variant-dark');
  content = content.replace(/bg-slate-100 dark:bg-slate-800/g, 'bg-surface-container dark:bg-surface-container-dark');
  content = content.replace(/bg-slate-50 dark:bg-slate-800/g, 'bg-surface-container dark:bg-surface-container-dark');
  content = content.replace(/bg-white dark:bg-slate-700/g, 'bg-surface-container-high dark:bg-surface-container-high-dark');
  content = content.replace(/bg-slate-200 dark:bg-slate-700/g, 'bg-surface-container-high dark:bg-surface-container-high-dark');
  content = content.replace(/bg-slate-100 dark:bg-slate-900/g, 'bg-surface-variant dark:bg-surface-variant-dark');
  content = content.replace(/bg-white dark:bg-slate-800/g, 'bg-surface-container dark:bg-surface-container-dark');

  // Specific hardcoded fixes in layout files
  content = content.replace(/backgroundColor: isDark \? '#020617' : '#ffffff'/g, "backgroundColor: isDark ? '#141218' : '#FEF7FF'");
  content = content.replace(/borderTopColor: isDark \? '#1e293b' : '#f1f5f9'/g, "borderTopColor: isDark ? '#49454F' : '#F4EFF4'");
  content = content.replace(/backgroundColor: isDark \? '#020617' : '#f8fafc'/g, "backgroundColor: isDark ? '#141218' : '#FEF7FF'");
  content = content.replace(/backgroundColor: colorScheme === 'dark' \? '#020617' : '#f8fafc'/g, "backgroundColor: colorScheme === 'dark' ? '#141218' : '#FEF7FF'");

  fs.writeFileSync(file, content);
});

console.log('Refactored ' + tsxFiles.length + ' files.');
