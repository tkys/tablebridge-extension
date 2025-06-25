document.addEventListener('DOMContentLoaded', () => {
    const statusDiv = document.getElementById('status');
    const userInfoDiv = document.getElementById('user-info');
    const guestInfoDiv = document.getElementById('guest-info');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const openSheetBtn = document.getElementById('open-sheet-btn');
    const resetSheetBtn = document.getElementById('reset-sheet-btn');

    // UIを更新する関数
    function updateUI(response) {
        statusDiv.classList.remove('loading');
        if (response && response.isLoggedIn && response.email) {
            statusDiv.innerHTML = `ログイン中: <span class="email">${response.email}</span>`;
            userInfoDiv.classList.remove('hidden');
            guestInfoDiv.classList.add('hidden');
        } else {
            statusDiv.textContent = 'ログインしていません。';
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
                if (confirm('現在のスプレッドシートとの連携を解除し、次回から新しいシートを作成しますか？')) {
                    sendMessage({ action: 'resetSheet' }).then(() => {
                        alert('リセットしました。次回データ転送時に新しいスプレッドシートが作成されます。');
                        window.close();
                    });
                }
            });

        } catch (e) {
            statusDiv.textContent = 'エラーが発生しました。詳細はコンソールを確認してください。';
            console.error('Popup Error:', e.message);
        }
    })();
});