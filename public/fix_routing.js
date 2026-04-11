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
        let newContent = content;
        
        // 1. Standard HTML paths
        // Exclude wp-content, wp-includes, wp-json, wp-admin so assets and APIs still work from the live server.
        newContent = newContent.replace(/https?:\/\/kerabeaute\.com\/(?!wp-content|wp-includes|wp-json|wp-admin)/g, '/');
        
        // 2. JSON escaped paths
        newContent = newContent.replace(/https?:\\\/\\\/kerabeaute\.com\\\/(?!wp-content|wp-includes|wp-json|wp-admin)/g, '\\/');
        
        // 3. Exact URL matches that don't have a trailing slash, like https://kerabeaute.com"
        newContent = newContent.replace(/https?:\/\/kerabeaute\.com(?=["'])/g, '/');
        newContent = newContent.replace(/https?:\\\/\\\/kerabeaute\.com(?=["'])/g, '\\/');
        
        // 4. URL Encoded
        newContent = newContent.replace(/https?%3A%2F%2Fkerabeaute\.com%2F(?!wp-content|wp-includes|wp-json|wp-admin)/g, '%2F');
        
        if (newContent !== content) {
            fs.writeFileSync(file, newContent, 'utf8');
            count++;
        }
    } catch (e) {
        console.error(`Error processing ${file}: ${e}`);
    }
});

console.log(`Smart routing applied to ${count} files.`);
