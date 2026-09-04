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

  // Replace bottom sheet hardcoded background hexes
  content = content.replace(/backgroundColor: isDark \? '#0f172a' : '#ffffff'/g, "backgroundColor: isDark ? '#141218' : '#FEF7FF'");

  // Replace linear gradient dark start to surface dark
  content = content.replace(/colors=\{isDark \? \['#0f172a', '#1e293b'\]/g, "colors={isDark ? ['#141218', '#2B2930']");

  fs.writeFileSync(file, content);
});

console.log('Hex replaced in ' + tsxFiles.length + ' files.');
