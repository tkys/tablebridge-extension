// ===================================================================
// CSV Export for AI Chats - Content Script / コンテンツスクリプト
// MIT License
// ===================================================================

// --- 1. Icon Definitions / アイコン定義 ---
const ICONS = {
    sheets: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6zm2-4h8v-2H8v2zm0-4h8v-2H8v2zm0-4h5V6H8v2z"/></svg>`,
    copy: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-5zm0 16H8V7h11v14z"/></svg>`,
    download: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/><path d="M12,19L8,15H10.5V12H13.5V15H16L12,19Z"/></svg>`
};

// --- 2. Data Extraction and Conversion Functions / データ抽出・変換関数 ---
function parseTable(tableElement) {
    const data = [];
    for (const row of tableElement.rows) {
        const rowData = [];
        for (const cell of row.cells) {
            rowData.push(cell.innerText.trim());
        }
        data.push(rowData);
    }
    return data;
}

function parseCodeBlock(codeElement) {
    const text = codeElement.innerText;
    let lines = text.trim().split('\n');
    let data = lines.map(line => line.split(',').map(cell => cell.trim()));
    const columnCount = data[0]?.length;
    if (data.length > 0 && columnCount > 1 && data.every(row => row.length === columnCount)) {
        return data;
    }
    data = lines.map(line => line.split(/\s{2,}|\t/));
    if(lines[0].includes('|')) {
         data = lines.map(line => 
            line.split('|').slice(1, -1).map(cell => cell.trim())
         );
         data = data.filter(row => !/^-+$/.test(row[0]) && row.length > 0 && row.some(cell => cell !== ""));
    }
    if (data[0]?.length > 1 && data.every(row => row.length === data[0].length)) {
        return data;
    }
    return lines.map(line => [line.trim()]);
}

function parseCsvText(csvText) {
    const lines = csvText.trim().split('\n');
    const data = [];
    
    for (const line of lines) {
        if (line.trim() === '') continue;
        
        const cells = [];
        let currentCell = '';
        let inQuotes = false;
        let i = 0;
        
        while (i < line.length) {
            const char = line[i];
            
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    currentCell += '"';
                    i += 2;
                } else {
                    inQuotes = !inQuotes;
                    i++;
                }
            } else if (char === ',' && !inQuotes) {
                cells.push(currentCell.trim());
                currentCell = '';
                i++;
            } else {
                currentCell += char;
                i++;
            }
        }
        
        cells.push(currentCell.trim());
        
        const cleanedCells = cells.map(cell => {
            let cleaned = cell.trim();
            if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
                cleaned = cleaned.slice(1, -1);
            }
            return cleaned;
        });
        
        data.push(cleanedCells);
    }
    
    return data;
}

function convertToTSV(data) {
    return data.map(row => row.join('\t')).join('\n');
}

// --- 3. Table Detection Functions ---
function detectTableInElement(element) {
    // 1. Direct code element check (most specific)
    if (element.tagName === 'CODE') {
        return analyzeCodeElement(element);
    }
    
    // 2. Look for code blocks within the element
    const codeBlocks = element.querySelectorAll ? element.querySelectorAll('code') : [];
    for (const code of codeBlocks) {
        const result = analyzeCodeElement(code);
        if (result) return result;
    }
    
    return null;
}

function analyzeCodeElement(codeElement) {
    const text = codeElement.innerText.trim();
    if (!text || text.length < 10) return null;
    
    console.log('[TableBridge] Analyzing code element:', {
        class: codeElement.className,
        textSample: text.substring(0, 100)
    });
    
    // CSV detection: explicit language class or comma patterns
    if (codeElement.className.includes('language-csv') || 
        codeElement.className.includes('csv')) {
        console.log('[TableBridge] Detected CSV by class');
        return { type: 'csv', element: codeElement, data: () => parseCsvText(text) };
    }
    
    // TSV detection: explicit language class or tab patterns  
    if (codeElement.className.includes('language-tsv') || 
        codeElement.className.includes('tsv')) {
        console.log('[TableBridge] Detected TSV by class');
        return { type: 'tsv', element: codeElement, data: () => parseTsvText(text) };
    }
    
    // Content-based CSV detection (strict)
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length >= 2) {
        // Check if most lines have consistent comma count (>=2 columns)
        const commaLines = lines.filter(line => line.includes(',')); 
        if (commaLines.length >= Math.min(3, lines.length)) {
            const firstCommaCount = (commaLines[0].match(/,/g) || []).length;
            if (firstCommaCount >= 1) {
                const consistentLines = commaLines.filter(line => 
                    Math.abs((line.match(/,/g) || []).length - firstCommaCount) <= 1
                );
                if (consistentLines.length >= Math.min(3, commaLines.length)) {
                    console.log('[TableBridge] Detected CSV by content pattern');
                    return { type: 'csv', element: codeElement, data: () => parseCsvText(text) };
                }
            }
        }
        
        // Content-based TSV detection (strict)
        const tabLines = lines.filter(line => line.includes('\t'));
        if (tabLines.length >= Math.min(3, lines.length)) {
            console.log('[TableBridge] Detected TSV by content pattern');
            return { type: 'tsv', element: codeElement, data: () => parseTsvText(text) };
        }
    }
    
    return null;
}

function parseTsvText(tsvText) {
    const lines = tsvText.trim().split('\n');
    return lines.map(line => line.split('\t').map(cell => cell.trim()));
}

// --- 4. Internationalization ---
function getLocale() {
    return navigator.language.startsWith('ja') ? 'ja' : 'en';
}

const i18n = {
    ja: {
        sheetsTitle: 'Googleスプレッドシートに転送',
        copyTitle: 'TSV形式でクリップボードにコピー (Excel向け)',
        downloadTitle: 'Excelファイルとしてダウンロード',
        error: 'エラー',
        copySuccess: '選択範囲をクリップボードにコピーしました。',
        copyFailed: 'コピーに失敗しました。',
        downloadError: 'ダウンロードエラー',
        extensionInvalid: 'Extension context is invalid. Please reload the page.',
        noData: 'No data to copy',
        unknownError: 'Unknown error occurred',
        downloadFailed: 'Download failed'
    },
    en: {
        sheetsTitle: 'Export to Google Sheets',
        copyTitle: 'Copy as TSV to clipboard (Excel compatible)',
        downloadTitle: 'Download as Excel file',
        error: 'Error',
        copySuccess: 'Data copied to clipboard successfully.',
        copyFailed: 'Failed to copy data.',
        downloadError: 'Download Error',
        extensionInvalid: 'Extension context is invalid. Please reload the page.',
        noData: 'No data to copy',
        unknownError: 'Unknown error occurred',
        downloadFailed: 'Download failed'
    }
};

function t(key) {
    const locale = getLocale();
    return i18n[locale][key] || i18n.en[key] || key;
}

// --- 5. UI Creation Functions ---
function createActionButton(icon, titleKey, onClick) {
    const button = document.createElement('button');
    button.className = 'tablebridge-action-btn';
    button.title = t(titleKey);
    button.innerHTML = icon;
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        onClick();
    });
    return button;
}

function createFloatingUI(tableInfo, targetElement) {
    const wrapper = document.createElement('div');
    wrapper.className = 'tablebridge-floating-ui';
    
    const sheetsBtn = createActionButton(ICONS.sheets, 'sheetsTitle', async () => {
        sheetsBtn.innerHTML = '...';
        sheetsBtn.disabled = true;
        try {
            const data = tableInfo.data();
            console.log('[TableBridge] Sending data to sheets:', data);
            
            // Extension context validation
            if (!chrome.runtime || !chrome.runtime.sendMessage) {
                throw new Error(t('extensionInvalid'));
            }
            
            const response = await chrome.runtime.sendMessage({ action: 'appendToSheet', data });
            console.log('[TableBridge] Response:', response);
            
            if (!response.success) {
                throw new Error(response.error || t('unknownError'));
            }
            
            sheetsBtn.innerHTML = '✅';
            setTimeout(() => { sheetsBtn.innerHTML = ICONS.sheets; }, 2000);
        } catch (error) {
            console.error('[TableBridge] Sheets error:', error);
            alert(`${t('error')}: ${error.message}`);
        } finally {
            sheetsBtn.innerHTML = ICONS.sheets;
            sheetsBtn.disabled = false;
        }
    });
    
    const copyBtn = createActionButton(ICONS.copy, 'copyTitle', async () => {
        try {
            const data = tableInfo.data();
            console.log('[TableBridge] Copy data:', data);
            
            if (!data || data.length === 0) {
                throw new Error(t('noData'));
            }
            
            const tsvData = convertToTSV(data);
            console.log('[TableBridge] TSV data:', tsvData.substring(0, 200));
            
            await navigator.clipboard.writeText(tsvData);
            copyBtn.innerHTML = '✅';
            setTimeout(() => { copyBtn.innerHTML = ICONS.copy; }, 2000);
        } catch (error) {
            console.error('[TableBridge] Copy error:', error);
            alert(`${t('error')}: ${error.message}`);
        }
    });
    
    const downloadBtn = createActionButton(ICONS.download, 'downloadTitle', async () => {
        downloadBtn.innerHTML = '...';
        downloadBtn.disabled = true;
        try {
            const data = tableInfo.data();
            console.log('[TableBridge] Download data:', data);
            
            // Extension context validation
            if (!chrome.runtime || !chrome.runtime.sendMessage) {
                throw new Error(t('extensionInvalid'));
            }
            
            const response = await chrome.runtime.sendMessage({ 
                action: 'downloadExcel', 
                data, 
                filename: 'tablebridge-data' 
            });
            console.log('[TableBridge] Download response:', response);
            
            if (!response.success) {
                throw new Error(response.error || t('downloadFailed'));
            }
            
            downloadBtn.innerHTML = '✅';
            setTimeout(() => { downloadBtn.innerHTML = ICONS.download; }, 2000);
        } catch (error) {
            console.error('[TableBridge] Download error:', error);
            alert(`${t('downloadError')}: ${error.message}`);
        } finally {
            downloadBtn.innerHTML = ICONS.download;
            downloadBtn.disabled = false;
        }
    });
    
    wrapper.appendChild(sheetsBtn);
    wrapper.appendChild(copyBtn);
    wrapper.appendChild(downloadBtn);
    
    return wrapper;
}

// --- 5. Hover Event Management ---
let currentUI = null;
let hoverTimeout = null;
let hideTimeout = null;
let currentTarget = null;
let scrollListener = null;

function showFloatingUI(tableInfo, targetElement, mouseEvent) {
    // Same target, don't recreate UI
    if (currentTarget === targetElement && currentUI) {
        clearTimeout(hideTimeout);
        return;
    }
    
    hideFloatingUI();
    
    const ui = createFloatingUI(tableInfo, targetElement);
    
    // Get the most specific table/code element for positioning
    let positionElement = tableInfo.element;
    if (!positionElement || positionElement === targetElement) {
        // Fallback to target element
        positionElement = targetElement;
    }
    
    const rect = positionElement.getBoundingClientRect();
    
    // Better positioning: near the actual table/code block
    ui.style.position = 'fixed';
    
    // Position above the actual content, with smart viewport handling
    const topPosition = rect.top - 50;
    const leftPosition = rect.right - 150;
    
    // Ensure UI stays within viewport with extra margins for Gemini AI Studio
    const finalTop = Math.max(15, Math.min(topPosition, window.innerHeight - 70));
    const finalLeft = Math.max(15, Math.min(leftPosition, window.innerWidth - 210));
    
    ui.style.top = `${finalTop}px`;
    ui.style.left = `${finalLeft}px`;
    ui.style.zIndex = '999999';
    
    // Additional isolation for complex layouts (PWA-specific)
    ui.style.isolation = 'isolate';
    ui.style.transform = 'translateZ(0)'; // Force hardware acceleration
    ui.style.contain = 'layout style';
    ui.style.willChange = 'transform';
    
    // PWA-specific positioning fixes
    const userAgent = navigator.userAgent.toLowerCase();
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                  window.navigator.standalone === true ||
                  userAgent.includes('electron');
    
    if (isPWA) {
        console.log('[TableBridge] PWA detected, applying special styling');
        ui.style.webkitTransform = 'translateZ(0)';
        ui.style.backfaceVisibility = 'hidden';
        ui.style.perspective = '1000px';
    }
    
    console.log('[TableBridge] UI positioned at:', { 
        elementType: positionElement.tagName, 
        elementClass: positionElement.className,
        rect: { top: rect.top, right: rect.right, width: rect.width, height: rect.height },
        uiPosition: { top: ui.style.top, left: ui.style.left }
    });
    
    // Add mouseenter/mouseleave to UI itself for stability
    ui.addEventListener('mouseenter', () => {
        clearTimeout(hideTimeout);
    });
    
    ui.addEventListener('mouseleave', () => {
        scheduleHide();
    });
    
    // Add scroll listener to update position or hide UI
    scrollListener = () => {
        if (currentTarget && currentUI) {
            // Check if target element is still visible
            const rect = positionElement.getBoundingClientRect();
            if (rect.top < -50 || rect.bottom > window.innerHeight + 50 ||
                rect.left < -50 || rect.right > window.innerWidth + 50) {
                // Element is out of viewport, hide UI
                hideFloatingUI();
            } else {
                // Update UI position
                updateUIPosition();
            }
        }
    };
    
    window.addEventListener('scroll', scrollListener, { passive: true });
    
    document.body.appendChild(ui);
    currentUI = ui;
    currentTarget = targetElement;
}

function updateUIPosition() {
    if (!currentUI || !currentTarget) return;
    
    // Get the most specific table/code element for positioning
    let positionElement = currentTarget;
    const tableInfo = detectTableInElement(currentTarget);
    if (tableInfo && tableInfo.element) {
        positionElement = tableInfo.element;
    }
    
    const rect = positionElement.getBoundingClientRect();
    
    // Update position with same logic as showFloatingUI
    const topPosition = rect.top - 50;
    const leftPosition = rect.right - 150;
    
    const finalTop = Math.max(15, Math.min(topPosition, window.innerHeight - 70));
    const finalLeft = Math.max(15, Math.min(leftPosition, window.innerWidth - 210));
    
    currentUI.style.top = `${finalTop}px`;
    currentUI.style.left = `${finalLeft}px`;
}

function hideFloatingUI() {
    if (currentUI) {
        currentUI.remove();
        currentUI = null;
        currentTarget = null;
    }
    if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
    }
    if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
    }
    if (scrollListener) {
        window.removeEventListener('scroll', scrollListener);
        scrollListener = null;
    }
}

function scheduleHide() {
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
        hideFloatingUI();
    }, 1500); // 1.5 seconds delay before hiding
}

function handleMouseEnter(event) {
    if (!event.target || typeof event.target.closest !== 'function') return;
    
    // Focus only on code elements and their immediate containers
    const element = event.target.closest('code, pre');
    if (!element) return;
    
    // Clear any existing hide timeout
    clearTimeout(hideTimeout);
    
    // If we're already showing UI for this element, don't restart
    if (currentTarget === element && currentUI) return;
    
    // Clear any existing hover timeout
    if (hoverTimeout) {
        clearTimeout(hoverTimeout);
    }
    
    hoverTimeout = setTimeout(() => {
        const tableInfo = detectTableInElement(element);
        if (tableInfo) {
            showFloatingUI(tableInfo, element, event);
        }
    }, 800); // Increased to 800ms for more stable triggering
}

function handleMouseLeave(event) {
    if (!event.relatedTarget) {
        // Mouse left the viewport
        scheduleHide();
        return;
    }
    
    // Check if we're moving to the UI or staying within the target element
    if (currentUI && (currentUI.contains(event.relatedTarget) || 
        (currentTarget && currentTarget.contains(event.relatedTarget)))) {
        return; // Don't hide
    }
    
    // Schedule hide with delay
    scheduleHide();
}

// --- 6. Event Listeners Setup ---
function initializeEventListeners() {
    document.addEventListener('mouseenter', handleMouseEnter, true);
    document.addEventListener('mouseleave', handleMouseLeave, true);
    
    // Hide UI when clicking outside
    document.addEventListener('click', (e) => {
        if (currentUI && !currentUI.contains(e.target)) {
            hideFloatingUI();
        }
    });
}

// --- 7. Context Menu Support ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'processSelection') {
        const data = parseCodeBlock({ innerText: request.selectionText });
        if (request.menuItemId === 'sendSelectionToSheets') {
            chrome.runtime.sendMessage({ action: 'appendToSheet', data })
              .catch(err => alert(`${t('error')}: ${err.message}`));
        } else if (request.menuItemId === 'copySelectionAsTSV') {
            const tsvData = convertToTSV(data);
            navigator.clipboard.writeText(tsvData)
              .then(() => alert(t('copySuccess')))
              .catch(() => alert(t('copyFailed')));
        }
        sendResponse({status: "ok"});
    }
});

// --- 8. Initialization ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeEventListeners);
} else {
    initializeEventListeners();
}

console.log('[CSV Export for AI Chats] v2.0 initialized');
console.log('[CSV Export] Environment:', {
    url: window.location.href,
    userAgent: navigator.userAgent,
    isPWA: window.matchMedia('(display-mode: standalone)').matches,
    timestamp: new Date().toISOString()
});