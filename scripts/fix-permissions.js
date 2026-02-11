const fs = require('fs');
const path = require('path');

function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        try {
            const stat = fs.statSync(file);
            if (stat.isDirectory()) {
                // 0o755 = rwxr-xr-x
                fs.chmodSync(file, 0o755);
                walk(file);
            } else {
                // 0o644 = rw-r--r--
                fs.chmodSync(file, 0o644);
            }
        } catch (e) {
            console.error(`Failed to process ${file}:`, e);
        }
    });
}

try {
    console.log('Scrubbing permissions...');

    // Explicitly fix commonly critical files/dirs
    const roots = ['src', 'package.json', 'app.json', 'babel.config.js'];

    roots.forEach(p => {
        if (fs.existsSync(p)) {
            try {
                const stat = fs.statSync(p);
                if (stat.isDirectory()) {
                    fs.chmodSync(p, 0o755);
                    console.log(`Fixed dir: ${p}`);
                    walk(p);
                } else {
                    fs.chmodSync(p, 0o644);
                    console.log(`Fixed file: ${p}`);
                }
            } catch (e) {
                console.error(`Error fixing root ${p}:`, e);
            }
        }
    });

    console.log('Done.');
} catch (e) {
    console.error('Error running script:', e);
}
