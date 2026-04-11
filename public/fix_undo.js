const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.html')) {
                results.push(file);
            }
        }
    });
    return results;
}

const directory = "c:\\Users\\91879\\Desktop\\kerabeaute\\public";
const files = walk(directory);
let count = 0;

files.forEach(file => {
    try {
        const content = fs.readFileSync(file, 'utf8');
        // Undo the previous mistake
        let newContent = content.replace(/kerabeaute\.netlify\.app/g, 'kerabeaute.com');
        
        if (newContent !== content) {
            fs.writeFileSync(file, newContent, 'utf8');
            count++;
        }
    } catch (e) {
        console.error(`Error processing ${file}: ${e}`);
    }
});

console.log(`Restored domain in ${count} files.`);
