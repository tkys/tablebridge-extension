// ===================================================================
// CSV Export for AI Chats - Service Worker / サービスワーカー
// MIT License
// ===================================================================

// --- 1. メインのメッセージリスナー ---
// content_scriptやpopup.jsからのすべてのメッセージをここで受け取る
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'appendToSheet':
            handleAppendToSheet(request.data)
                .then(response => sendResponse({ success: true, ...response }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'downloadExcel':
            handleExcelDownload(request.data, request.filename)
                .then(response => sendResponse({ success: true, ...response }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'getUserStatus':
            checkUserStatus().then(sendResponse);
            return true;

        case 'login':
            getAuthToken() // これが認証画面をトリガーする
                .then(() => sendResponse({ success: true }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'logout':
            handleLogout().then(sendResponse);
            return true;

        case 'openSheet':
            openCurrentSheet().then(() => sendResponse({ success: true }));
            return true;

        case 'resetSheet':
            chrome.storage.local.remove(['spreadsheetId', 'sheetName'], () => {
                sendResponse({ success: true });
            });
            return true;
    }
});


// --- 2. Google認証とAPI関連の関数群 ---

// Googleの認証トークンを取得する (認証画面を出すための最重要関数)
function getAuthToken() {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError || !token) {
                const message = chrome.runtime.lastError ? chrome.runtime.lastError.message : '認証に失敗しました。';
                reject(new Error(message));
            } else {
                resolve(token);
            }
        });
    });
}

// ユーザーのログイン状態とメールアドレスを確認する
async function checkUserStatus() {
    try {
        const token = await new Promise((resolve, reject) => {
             chrome.identity.getAuthToken({ interactive: false }, resolve);
        });
        if (!token) return { isLoggedIn: false };
        
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const userInfo = await response.json();
        return { isLoggedIn: true, email: userInfo.email };
    } catch (e) {
        return { isLoggedIn: false };
    }
}

// ログアウト処理
async function handleLogout() {
    try {
        const token = await new Promise(resolve => chrome.identity.getAuthToken({ interactive: false }, resolve));
        if (token) {
            await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`).catch(e => console.warn("Revoke token failed.", e));
            await new Promise(resolve => chrome.identity.removeCachedAuthToken({ token }, resolve));
        }
        await chrome.storage.local.remove(['spreadsheetId', 'sheetName']);
        return { success: true };
    } catch (e) {
        console.error('Logout failed:', e);
        return { success: false, error: e.message };
    }
}

// --- 3. Excel ダウンロード関連の関数群 ---

// Excel ダウンロード処理のメインハンドラ
async function handleExcelDownload(data, filename = 'tablebridge-data') {
    console.log('[TableBridge Background] Starting Excel download');
    
    try {
        // CSVデータを生成
        const csvContent = convertDataToCSV(data);
        
        // Service Workerでは blob: URL が使えないため、data: URL を使用
        const dataUrl = `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`;
        
        // Chrome Downloads APIを使用してダウンロード
        const downloadId = await chrome.downloads.download({
            url: dataUrl,
            filename: `${filename}.csv`,
            saveAs: true
        });
        
        console.log('[TableBridge Background] Download started with ID:', downloadId);
        
        return { downloadId, filename: `${filename}.csv` };
    } catch (error) {
        console.error('[TableBridge Background] Excel download failed:', error);
        throw error;
    }
}

// データをCSV形式に変換
function convertDataToCSV(data) {
    if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Invalid data format for CSV conversion');
    }
    
    return data.map(row => {
        return row.map(cell => {
            // CSVエスケープ処理
            const cellStr = String(cell || '');
            if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
        }).join(',');
    }).join('\n');
}

// --- 4. スプレッドシート関連の関数群 ---

// データ追記処理のメインハンドラ
async function handleAppendToSheet(data) {
    const token = await getAuthToken();
    const { spreadsheetId, sheetName } = await getOrCreateSheetInfo(token);
    
    if (!spreadsheetId || !sheetName) {
        throw new Error('スプレッドシートの情報が取得できませんでした。');
    }

    await appendDataToSheet(token, spreadsheetId, sheetName, data);
    
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
    showNotification(sheetUrl);
    return { sheetUrl };
}

// 保存されたシート情報を取得、なければ新規作成
async function getOrCreateSheetInfo(token) {
    const result = await chrome.storage.local.get(['spreadsheetId', 'sheetName']);
    if (result.spreadsheetId && result.sheetName) {
        return { spreadsheetId: result.spreadsheetId, sheetName: result.sheetName };
    } else {
        const newSheetInfo = await createNewSheet(token);
        await chrome.storage.local.set(newSheetInfo);
        return newSheetInfo;
    }
}

// 新しいスプレッドシートを作成する
async function createNewSheet(token) {
    const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            properties: { title: 'TableBridge Data' },
            sheets: [{ properties: { title: 'Data' } }]
        })
    });
    if (!response.ok) throw new Error('スプレッドシートの作成に失敗しました。');
    const newSheet = await response.json();
    return {
        spreadsheetId: newSheet.spreadsheetId,
        sheetName: newSheet.sheets[0].properties.title
    };
}

// データをスプレッドシートに追記する
async function appendDataToSheet(token, spreadsheetId, sheetName, data) {
    console.log('[TableBridge Background] Received data for sheet:', data);
    
    // データが2次元配列であることを確認
    if (!Array.isArray(data) || !Array.isArray(data[0])) {
        console.error('[TableBridge Background] Data is not a 2D array:', data);
        throw new Error('データが正しい形式ではありません。');
    }
    
    console.log(`[TableBridge Background] Sending ${data.length} rows with ${data[0].length} columns each`);
    
    const range = sheetName;
    const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;
    
    const requestBody = { values: data };
    console.log('[TableBridge Background] Request body:', JSON.stringify(requestBody));
    
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        console.error('[TableBridge Background] API Error:', errorData);
        throw new Error(errorData.error?.message || 'データ追加中にAPIエラーが発生しました。');
    }
    
    const responseData = await response.json();
    console.log('[TableBridge Background] API Success:', responseData);
}

// 現在のシートを開く
async function openCurrentSheet() {
    const result = await chrome.storage.local.get(['spreadsheetId']);
    if (result.spreadsheetId) {
        chrome.tabs.create({ url: `https://docs.google.com/spreadsheets/d/${result.spreadsheetId}` });
    }
}

// デスクトップ通知を表示
function showNotification(sheetUrl) {
    const id = `tablebridge-notify-${Date.now()}`;
    chrome.notifications.create(id, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'TableBridge',
        message: 'スプレッドシートへのデータ転送が完了しました。',
        buttons: [{ title: 'シートを開く' }]
    });
}
// 通知ボタンのクリックリスナー (毎回登録)
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    // この拡張機能からの通知で、ボタンがクリックされた場合
    if (notificationId.startsWith('tablebridge-notify-') && buttonIndex === 0) {
        // 通知からURLを取得できないので、最新のシートを開く
        openCurrentSheet();
    }
});


// --- 4. 右クリックメニュー関連 ---
// 拡張機能インストール時に右クリックメニューを作成
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'sendSelectionToSheets',
        title: "選択範囲をスプレッドシートに転送",
        contexts: ['selection']
    });
    chrome.contextMenus.create({
        id: 'copySelectionAsTSV',
        title: "選択範囲をTSVでコピー",
        contexts: ['selection']
    });
});

// 右クリックメニューがクリックされたときの処理
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'sendSelectionToSheets' || info.menuItemId === 'copySelectionAsTSV') {
        chrome.tabs.sendMessage(tab.id, {
            action: 'processSelection',
            menuItemId: info.menuItemId,
            selectionText: info.selectionText
        });
    }
});