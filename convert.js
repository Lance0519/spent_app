const fs = require('fs');

const files = [
  'app/(tabs)/index.tsx',
  'app/(tabs)/transactions.tsx',
  'app/(tabs)/budgets.tsx',
  'app/(tabs)/account.tsx',
  'app/(tabs)/_layout.tsx',
  'app/_layout.tsx',
  'app/reminders.tsx',
  'app/categories.tsx',
  'app/analytics.tsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Specific prop replacements for NativeWind
  content = content.replace(/contentContainerStyle=\{tw\`([\s\S]*?)\`\}/g, 'contentContainerClassName={`$1`}');
  content = content.replace(/handleIndicatorStyle=\{tw\`([\s\S]*?)\`\}/g, 'handleIndicatorClassName={`$1`}');
  content = content.replace(/backgroundStyle=\{tw\`([\s\S]*?)\`\}/g, 'backgroundClassName={`$1`}');
  
  // General styles
  content = content.replace(/style=\{tw\`([\s\S]*?)\`\}/g, 'className={`$1`}');
  content = content.replace(/style=\{\[tw\`([\s\S]*?)\`,\s*([\s\S]*?)\]\}/g, 'className={`$1`} style={$2}');
  
  // Imports
  content = content.replace(/import tw, \{ useAppColorScheme \} from 'twrnc';/g, "import { useColorScheme } from 'nativewind';");
  content = content.replace(/import tw from 'twrnc';/g, "");
  content = content.replace(/import tw, \{ useAppColorScheme \} from \"twrnc\";/g, "import { useColorScheme } from 'nativewind';");
  content = content.replace(/import tw from \"twrnc\";/g, "");
  
  // Hooks
  content = content.replace(/const \[colorScheme, toggleColorScheme\] = useAppColorScheme\(tw\);/g, "const { colorScheme, toggleColorScheme } = useColorScheme();");
  content = content.replace(/const \[colorScheme\] = useAppColorScheme\(tw\);/g, "const { colorScheme } = useColorScheme();");

  fs.writeFileSync(file, content);
});
console.log('Conversion to NativeWind complete');
