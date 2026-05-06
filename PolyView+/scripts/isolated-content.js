/**
 * ISOLATED WORLD SCRIPT
 * Handles DOM manipulation, CSS Grid Masonry rendering, and Extension Storage synchronization.
 * Operates independently of the React framework.
 */

// 1. Initial sync on load
chrome.storage.sync.get({ maxItems: 99, masonryEnabled: true }, (config) => {
    localStorage.setItem('polyview_config', JSON.stringify(config));
    applyFooterFix();
    if (config.masonryEnabled) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initGridMasonry);
        } else {
            initGridMasonry();
        }
    }
});

// 2. LIVE SYNC: Instantly updates localStorage when you click something in the popup.
chrome.storage.onChanged.addListener(() => {
    chrome.storage.sync.get({ maxItems: 99, masonryEnabled: true }, (config) => {
        localStorage.setItem('polyview_config', JSON.stringify(config));
    });
});

function applyFooterFix() {
    // 3. Fix the Footer/FAQ overlap by overriding Virtuoso's fixed height calculations
    if (!document.getElementById('polyview-footer-css')) {
        const style = document.createElement('style');
        style.id = 'polyview-footer-css';
        style.textContent = `
            /* Force the scroller wrappers to grow with the grid instead of using fixed heights */
            [data-virtuoso-scroller="true"] { height: auto !important; overflow: visible !important; }
            [data-virtuoso-scroller="true"] > div { position: relative !important; height: auto !important; }
            [data-testid="virtuoso-item-list"] { padding-bottom: 2rem !important; }
        `;
        document.documentElement.appendChild(style);
    }
}

function initGridMasonry() {
    // Measure exact heights for 1px CSS Grid rows
    const cardResizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            const wrapper = entry.target; 
            
            // We locate the actual card content. For Virtuoso it's the first child.
            // For static grids (logged out), there's an extra nested div, so we safely query for the card class or fallback to first child.
            const cardContent = wrapper.querySelector('.group\\/card') || wrapper.firstElementChild;
            if (!cardContent) continue;
            
            const rect = cardContent.getBoundingClientRect();
            const spanRows = Math.ceil(rect.height + 12); // +12px for visual gap
            
            if (wrapper.style.gridRowEnd !== `span ${spanRows}`) {
                wrapper.style.gridRowEnd = `span ${spanRows}`;
            }
        }
    });

    const setupGrid = () => {
        // TARGET 1: Logged-in infinite scrolling grid (Virtuoso)
        // TARGET 2: Logged-out static grid (Fallback Tailwind grid)
        const grid = document.querySelector('[data-testid="virtuoso-item-list"]') || 
                     document.querySelector('.grid[class*="grid-cols-1"][class*="md:grid-cols-2"]');
        
        if (grid && !grid.dataset.polyviewMasonry) {
            grid.dataset.polyviewMasonry = "true";
            
            // Force true Dense Waterfall Masonry using CSS Grid
            grid.classList.remove('gap-3');
            grid.style.columnGap = '12px';
            grid.style.rowGap = '0px';
            grid.style.gridAutoRows = '1px';
            grid.style.alignItems = 'start';
            grid.style.gridAutoFlow = 'row dense';

            const virtObserver = new MutationObserver(mutations => {
                mutations.forEach(m => {
                    m.addedNodes.forEach(node => {
                        // Only observe element nodes. We removed the strict 'data-index' 
                        // requirement (node.nodeType === 1 && node.hasAttribute('data-index') so it seamlessly handles the static logged-out grid.
                        if (node.nodeType === 1) {
                            cardResizeObserver.observe(node);
                        }
                    });
                    m.removedNodes.forEach(node => {
                        if (node.nodeType === 1) cardResizeObserver.unobserve(node);
                    });
                });
            });
            
            virtObserver.observe(grid, { childList: true });
            
            // Catch elements already in the DOM on initial load
            Array.from(grid.children).forEach(child => {
                if (child.nodeType === 1) {
                    cardResizeObserver.observe(child);
                }
            });
        }
    };

    const bodyObserver = new MutationObserver(setupGrid);
    bodyObserver.observe(document.body, { childList: true, subtree: true });
    setupGrid();
}