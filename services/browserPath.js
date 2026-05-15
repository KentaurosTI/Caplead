const path = require('path');
const { app } = require('electron');
const os = require('os');
const fs = require('fs');

/**
 * Retorna o caminho para o executável do Chromium.
 * No desenvolvimento, tenta usar o que está em .browsers ou o padrão do puppeteer.
 * Em produção, busca na pasta extraResources/browsers.
 */
function getBrowserPath() {
    const isPackaged = app && app.isPackaged;
    
    if (!isPackaged) {
        // No desenvolvimento, busca na pasta local .browsers
        const localPath = path.join(process.cwd(), '.browsers', 'chrome');
        
        if (fs.existsSync(localPath)) {
            function findChrome(dir) {
                if (!fs.existsSync(dir)) return null;
                try {
                    const files = fs.readdirSync(dir);
                    for (const file of files) {
                        const fullPath = path.join(dir, file);
                        if (fs.statSync(fullPath).isDirectory()) {
                            const found = findChrome(fullPath);
                            if (found) return found;
                        } else if (file === 'chrome.exe') {
                            return fullPath;
                        }
                    }
                } catch(e) { return null; }
                return null;
            }
            
            const chromePath = findChrome(localPath);
            if (chromePath) {
                console.log('[BrowserPath] Usando Chrome local:', chromePath);
                return chromePath;
            }
        }
        
        console.log('[BrowserPath] Chrome local não encontrado, usando padrão do Puppeteer');
        return null; 
    }

    // Em PRODUÇÃO (Windows)
    const resourcesPath = process.resourcesPath;
    const browsersRoot = path.join(resourcesPath, 'browsers');
    
    function findChrome(dir) {
        if (!fs.existsSync(dir)) return null;
        try {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const fullPath = path.join(dir, file);
                if (fs.statSync(fullPath).isDirectory()) {
                    const found = findChrome(fullPath);
                    if (found) return found;
                } else if (file === 'chrome.exe') {
                    return fullPath;
                }
            }
        } catch(e) { return null; }
        return null;
    }

    return findChrome(browsersRoot);
}

module.exports = { getBrowserPath };
