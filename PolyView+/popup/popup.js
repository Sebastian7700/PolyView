document.addEventListener('DOMContentLoaded', () => {
    const maxItemsInput = document.getElementById('maxItems');
    const masonryToggle = document.getElementById('masonryEnabled');
    const viewMode = document.getElementById('viewMode');
    const editMode = document.getElementById('editMode');
    const linkInput = document.getElementById('linkInput');
    const editBtn = document.getElementById('editBtn');
    const saveBtn = document.getElementById('saveBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const openBtn = document.getElementById('openBtn');
    const reloadBtn = document.getElementById('reloadBtn');

    let currentConfig = {};

    // Hilfsfunktion: Prüfen, ob wir auf Polymarket sind
    const checkUrlAndToggleBtn = (showButton) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const isPolymarket = tabs[0]?.url?.includes("polymarket.com");
            if (isPolymarket && showButton) {
                reloadBtn.classList.remove('hidden');
            } else {
                reloadBtn.classList.add('hidden');
            }
        });
    };

    chrome.storage.sync.get({
        maxItems: 99,
        masonryEnabled: true,
        customLink: 'https://polymarket.com'
    }, (config) => {
        currentConfig = config;
        maxItemsInput.value = config.maxItems;
        masonryToggle.checked = config.masonryEnabled;
        // Beim Laden initial prüfen (Button bleibt hidden, bis etwas geändert wird)
        checkUrlAndToggleBtn(false);
    });

    const triggerUpdate = (updates) => {
        currentConfig = { ...currentConfig, ...updates };
        
        chrome.storage.sync.set(currentConfig, () => {
            // Nur anzeigen, wenn wir wirklich auf Polymarket sind
            checkUrlAndToggleBtn(true);
        });
    };

    maxItemsInput.addEventListener('input', (e) => triggerUpdate({ maxItems: parseInt(e.target.value) || 2 }));
    masonryToggle.addEventListener('change', (e) => triggerUpdate({ masonryEnabled: e.target.checked }));

    editBtn.addEventListener('click', () => {
        linkInput.value = currentConfig.customLink;
        viewMode.classList.add('hidden');
        editMode.classList.remove('hidden');
        linkInput.focus();
    });

    const closeEditor = () => {
        viewMode.classList.remove('hidden');
        editMode.classList.add('hidden');
    };

    saveBtn.addEventListener('click', () => {
        let newLink = linkInput.value.trim();
        if (!newLink.startsWith('http')) newLink = 'https://' + newLink;
        triggerUpdate({ customLink: newLink });
        closeEditor();
    });

    cancelBtn.addEventListener('click', closeEditor);

    openBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: currentConfig.customLink });
    });

    reloadBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].url.includes("polymarket.com")) {
                chrome.tabs.reload(tabs[0].id, {}, () => {
                    // Schließt das Popup-Fenster nach dem Reload
                    window.close();
                });
            }
        });
    });
});