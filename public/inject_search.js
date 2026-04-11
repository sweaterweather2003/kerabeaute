const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(fullPath));
        } else { 
            if (file.endsWith('.html')) {
                results.push(fullPath);
            }
        }
    });
    return results;
}

const directory = ".";
console.log(`Scanning directory: ${path.resolve(directory)}`);
const files = walk(directory);
console.log(`Found ${files.length} HTML files.`);

let count = 0;
const scriptTag = '\n<script src="/search_redirect.js"></script>\n';

files.forEach((file, index) => {
    try {
        const content = fs.readFileSync(file, 'utf8');
        
        if (content.includes('search_redirect.js')) {
            return;
        }

        if (content.includes('</body>')) {
            const newContent = content.replace('</body>', `${scriptTag}</body>`);
            fs.writeFileSync(file, newContent, 'utf8');
            count++;
        } else {
            fs.appendFileSync(file, scriptTag, 'utf8');
            count++;
        }

        if ((index + 1) % 50 === 0 || index === files.length - 1) {
            console.log(`Processed ${index + 1} / ${files.length} files...`);
        }
    } catch (e) {
        console.error(`Error processing ${file}: ${e}`);
    }
});

console.log(`Successfully injected search script into ${count} files.`);
