// Internationalization for popup / ポップアップの多言語対応
function getLocale() {
    return navigator.language.startsWith('ja') ? 'ja' : 'en';
}

const i18n = {
    ja: {
        title: 'CSV Export for AI Chats',
        loading: '読み込み中...',
        loggedIn: 'ログイン中',
        notLoggedIn: 'ログインしていません。',
        loginButton: 'Googleアカウントでログイン',
        logoutButton: 'ログアウト',
        openSheetButton: '現在のシートを開く',
        resetSheetButton: '新しいシートに切り替える',
        resetConfirm: '現在のスプレッドシートとの連携を解除し、次回から新しいシートを作成しますか？',
        resetSuccess: 'リセットしました。次回データ転送時に新しいスプレッドシートが作成されます。',
        error: 'エラーが発生しました。詳細はコンソールを確認してください。'
    },
    en: {
        title: 'CSV Export for AI Chats',
        loading: 'Loading...',
        loggedIn: 'Logged in as',
        notLoggedIn: 'Not logged in.',
        loginButton: 'Login with Google Account',
        logoutButton: 'Logout',
        openSheetButton: 'Open Current Sheet',
        resetSheetButton: 'Switch to New Sheet',
        resetConfirm: 'Disconnect from current spreadsheet and create a new one next time?',
        resetSuccess: 'Reset completed. A new spreadsheet will be created on next data transfer.',
        error: 'An error occurred. Please check the console for details.'
    }
};

function t(key) {
    const locale = getLocale();
    return i18n[locale][key] || i18n.en[key] || key;
}

document.addEventListener('DOMContentLoaded', () => {
    const statusDiv = document.getElementById('status');
    const userInfoDiv = document.getElementById('user-info');
    const guestInfoDiv = document.getElementById('guest-info');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const openSheetBtn = document.getElementById('open-sheet-btn');
    const resetSheetBtn = document.getElementById('reset-sheet-btn');
    
    // Update UI text based on language / 言語に基づいてUIテキストを更新
    document.querySelector('h3').textContent = t('title');
    statusDiv.textContent = t('loading');
    loginBtn.textContent = t('loginButton');
    logoutBtn.textContent = t('logoutButton');
    openSheetBtn.textContent = t('openSheetButton');
    resetSheetBtn.textContent = t('resetSheetButton');

    // UIを更新する関数 / Update UI function
    function updateUI(response) {
        statusDiv.classList.remove('loading');
        if (response && response.isLoggedIn && response.email) {
            statusDiv.innerHTML = `${t('loggedIn')}: <span class="email">${response.email}</span>`;
            userInfoDiv.classList.remove('hidden');
            guestInfoDiv.classList.add('hidden');
        } else {
            statusDiv.textContent = t('notLoggedIn');
            userInfoDiv.classList.add('hidden');
            guestInfoDiv.classList.remove('hidden');
        }
    }

    // background.jsへのメッセージ送信をPromiseでラップするヘルパー関数
    const sendMessage = (payload) => new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(payload, (response) => {
            if (chrome.runtime.lastError) {
                // エラーが発生した場合はPromiseをrejectする
                return reject(chrome.runtime.lastError);
            }
            // 正常なレスポンスをresolveする
            resolve(response);
        });
    });

    // ポップアップが開かれたときのメイン処理
    (async () => {
        try {
            // 1. まず現在のユーザー状態を取得してUIを更新
            const response = await sendMessage({ action: 'getUserStatus' });
            updateUI(response);

            // 2. 各ボタンにイベントリスナーを設定
            loginBtn.addEventListener('click', () => {
                // ログイン処理を依頼し、完了を待たずにポップアップを閉じる
                sendMessage({ action: 'login' });
                window.close();
            });

            logoutBtn.addEventListener('click', async () => {
                await sendMessage({ action: 'logout' });
                // ログアウトが完了したらUIを即時更新
                updateUI({ isLoggedIn: false });
            });

            openSheetBtn.addEventListener('click', () => {
                sendMessage({ action: 'openSheet' });
            });

            resetSheetBtn.addEventListener('click', () => {
                if (confirm(t('resetConfirm'))) {
                    sendMessage({ action: 'resetSheet' }).then(() => {
                        alert(t('resetSuccess'));
                        window.close();
                    });
                }
            });

        } catch (e) {
            statusDiv.textContent = t('error');
            console.error('Popup Error:', e.message);
        }
    })();
});