document.addEventListener('DOMContentLoaded', () => {
    const maxItemsInput = document.getElementById('maxItems');
    const masonryToggle = document.getElementById('masonryEnabled');
    const customSortingToggle = document.getElementById('customSorting');
    const sortingRow = customSortingToggle.closest('.toggle-row');
    const viewMode = document.getElementById('viewMode');
    const editMode = document.getElementById('editMode');
    const linkInput = document.getElementById('linkInput');
    const editBtn = document.getElementById('editBtn');
    const saveBtn = document.getElementById('saveBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const openBtn = document.getElementById('openBtn');
    const reloadBtn = document.getElementById('reloadBtn');
    const saveIndicator = document.getElementById('saveIndicator');
    const infoTooltip = document.getElementById('infoTooltip');
    const tooltipText = document.getElementById('tooltipText');

    let saveIndicatorTimer = null;

    // Info tooltips content
    const tooltipContent = {
        maxItems: "Limit the number of markets displayed at once to focus on the most relevant ones. Setting this to a lower number can reduce clutter. Sometimes the API only returns 5 markets, limiting your results even if you set it higher.",
        masonry: "Organizes the layout intelligently into a beautiful, Pinterest-style waterfall grid. Disable if you prefer clean rows.",
        sorting: "Sorts markets by price giving a naturally understandable order. Only works if you enabled 10 or more Visible Markets, since your most relevant markets would be cut off otherwise."
    };

    let currentConfig = {};

    // Update sorting toggle disabled state based on maxItems
    const updateSortingState = (maxItems) => {
        const toggleSwitch = customSortingToggle.parentElement;
        if (maxItems < 10) {
            sortingRow.classList.add('disabled');
            toggleSwitch.classList.add('disabled');
            customSortingToggle.disabled = true; // Actively disable the HTML input
        } else {
            sortingRow.classList.remove('disabled');
            toggleSwitch.classList.remove('disabled');
            customSortingToggle.disabled = false;
        }
    };

    // Prüfen, ob wir auf Polymarket sind & Buttons/Indikatoren steuern
    const checkUrlAndToggleBtn = (isUpdate) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const isPolymarket = tabs[0]?.url?.includes("polymarket.com");
            
            if (isPolymarket && isUpdate) {
                reloadBtn.classList.remove('hidden');
                saveIndicator.classList.add('hidden');
            } else {
                reloadBtn.classList.add('hidden');
                // Wenn wir nicht auf der Seite sind, aber ein Update stattfand, zeige Timer
                if (!isPolymarket && isUpdate) {
                    saveIndicator.classList.remove('hidden');
                    
                    // Reset timer if triggered multiple times
                    clearTimeout(saveIndicatorTimer);
                    saveIndicatorTimer = setTimeout(() => {
                        saveIndicator.classList.add('hidden');
                    }, 1500);
                }
            }
        });
    };

    // Info icon tooltip handlers
    const infoIcons = document.querySelectorAll('.info-icon');
    let activeIcon = null;

    const showTooltip = (infoType) => {
        tooltipText.textContent = tooltipContent[infoType];
        infoTooltip.classList.remove('hidden');
    };

    const scheduleHideTooltip = () => {
        setTimeout(() => {
            if (!activeIcon && !infoTooltip.matches(':hover')) {
                infoTooltip.classList.add('hidden');
            }
        }, 50);
    };

    infoIcons.forEach(icon => {
        const row = icon.closest('.settings-row, .toggle-row');
        const labelText = row?.querySelector('.label-text');

        // Icon hover
        icon.addEventListener('mouseenter', () => {
            activeIcon = icon;
            showTooltip(icon.dataset.info);
        });

        icon.addEventListener('mouseleave', () => {
            activeIcon = null;
            scheduleHideTooltip();
        });

        // Label text hover
        if (labelText) {
            labelText.addEventListener('mouseenter', () => {
                activeIcon = icon;
                showTooltip(icon.dataset.info);
            });

            labelText.addEventListener('mouseleave', () => {
                activeIcon = null;
                scheduleHideTooltip();
            });
        }
    });

    // Keep tooltip visible on hover
    infoTooltip.addEventListener('mouseenter', () => {
        infoTooltip.classList.remove('hidden');
    });

    infoTooltip.addEventListener('mouseleave', () => {
        infoTooltip.classList.add('hidden');
    });

    chrome.storage.sync.get({
        maxItems: 99,
        masonryEnabled: true,
        customSorting: true,
        customLink: 'https://polymarket.com'
    }, (config) => {
        currentConfig = config;
        maxItemsInput.value = config.maxItems;
        masonryToggle.checked = config.masonryEnabled;
        customSortingToggle.checked = config.customSorting;
        updateSortingState(config.maxItems);
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

    maxItemsInput.addEventListener('input', (e) => {
        const newMaxItems = parseInt(e.target.value) || 2;
        updateSortingState(newMaxItems);
        triggerUpdate({ maxItems: newMaxItems });
    });
    masonryToggle.addEventListener('change', (e) => triggerUpdate({ masonryEnabled: e.target.checked }));
    customSortingToggle.addEventListener('change', (e) => {
        // Only save if sorting is enabled (maxItems >= 10)
        if (!customSortingToggle.disabled) {
            triggerUpdate({ customSorting: e.target.checked });
        }
    });

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