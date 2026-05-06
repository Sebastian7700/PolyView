console.log("[PolyView+] Injecting Turbopack/Webpack interceptor...");

let CONFIG = { maxItems: 99, masonryEnabled: true };
try {
    const stored = localStorage.getItem('polyview_config');
    if (stored) CONFIG = Object.assign(CONFIG, JSON.parse(stored));
} catch (e) {}

/**
 * Transforms function strings to apply UI and Logic patches.
 * Returns the modified string if successful, otherwise null.
 */
function patchFunctionString(funcStr) {
    let modified = false;

    // ============================================================
    // Naming Conventions based on json structure:
    // "events": [
    //    {
    //      "title": "2026 FIFA World Cup Winner ",
    //      "markets": [
    //          {
    //              "question": "Will Spain win the 2026 FIFA World Cup?",
    //              "groupItemTitle": "Spain",
    //              "outcomes": [
    //                        "Yes",
    //                        "No"
    //                      ],
    // ============================================================


    // ============================================================
    // PROFILE 1: Market Card UI
    // Signature: CSS and layout classes unique to the card builder
    // Targets the chunk responsible for rendering individual event cards.
    // ============================================================
    const isMarketCardChunk = funcStr.includes("relative h-[71px] w-full mt-0.5 pb-1") || 
                              funcStr.includes("relative h-[70px] w-full select-none");
    
    if (isMarketCardChunk) {
        // Patch 1A: Uncap market limits
        // Targets: .slice(0, 2)
        // Effect: Expands the list of visible markets per event from 2 to the user's config limit.
        if (/\.slice\(\s*0\s*,\s*2\s*\)/.test(funcStr)) {
            funcStr = funcStr.replace(/\.slice\(\s*0\s*,\s*2\s*\)/g, `.slice(0, ${CONFIG.maxItems})`);
            modified = true;
        }

        // Patch 1B: Remove fixed heights to allow vertical expansion
        // Targets: h-[70px] (mobile card body), h-[71px] (desktop card body), h-[42px] (card header)
        // Effect: Allows the card bodies and headers to naturally expand vertically.
        if (/h-\[(70|71|42)px\]/.test(funcStr)) {
            funcStr = funcStr.replace(/h-\[(70|71|42)px\]/g, "h-auto");
            modified = true;
        }

        // Patch 1C: Uncrop Event Titles
        // Targets: line-clamp-3
        // Effect: Prevents event titles from truncating with ellipses after 3 lines.
        if (funcStr.includes("line-clamp-3")) {
            funcStr = funcStr.replace(/line-clamp-3/g, "");
            modified = true;
        }

        // Patch 1D: Uncrop Market Sub-titles
        // Targets: The exact string "line-clamp-1 break-all group-hover:underline"
        // Effect: Prevents individual market outcome names from truncating with ellipses, allowing them to wrap to multiple lines if needed.
        // Since the chunk has another 'line-clamp-1' unrelated to the market rows, we target the entire class string for precision.
        const subTitleTarget = "line-clamp-1 break-all group-hover:underline";
        if (funcStr.includes(subTitleTarget)) {
            funcStr = funcStr.replace(new RegExp(subTitleTarget, 'g'), "break-all group-hover:underline");
            modified = true;
        }
    }
    

    // ============================================================
    // PROFILE 2: React Virtuoso (Scrolling Engine Wrapper)
    // Signature: Internal props used for the infinite scroller
    // Targets chunks configuring the infinite scroll grid.
    // ============================================================
    const isVirtuosoChunk = funcStr.includes("virtuoso") && funcStr.includes("itemContent") && funcStr.includes("useWindowScroll");
    
    if (isVirtuosoChunk) {
        // Patch 2A: Smart Masonry Stabilizer (Zero-Top Viewport)
        // Virtuoso calculates the visible pixel range as `[Math.max(..., 0), bottomLimit]`.
        // By forcing the top limit to ALWAYS be 0 (`[0, bottomLimit]`), Virtuoso never unloads 
        // elements above the current scroll position.
        // Specifically matches: `[Math.max(d-o-ej(i,"top",f)-h,0),` in the current Virtuoso version, which is probably something like:
        // `[Math.max(containerHeight - distance - getOffset(element, "top", relativeTo) - buffer, 0),`
        
        // Complicated regex version (that works but is probably brittle to code changes):
        // const topLimitRegex = /\[Math\.max\([a-zA-Z0-9_$]+\s*-\s*[a-zA-Z0-9_$]+\s*-\s*[a-zA-Z0-9_$]+\([a-zA-Z0-9_$]+,\s*"top"\s*,[a-zA-Z0-9_$]+\)\s*-\s*[a-zA-Z0-9_$]+\s*,\s*0\)\s*,/;

        // Simplified version that is more resilient to code changes:
        const topLimitRegex = /\[Math\.max\(.*?"top".*?,\s*0\)\s*,/g;

        if (topLimitRegex.test(funcStr)) {
            // Replaces the complex Math.max calculation with just `0`
            // The array becomes `[0, bottomLimitCalculation]`
            funcStr = funcStr.replace(topLimitRegex, "[0,");
            modified = true;
        }
    }

    return modified ? funcStr : null;
}

/**
 * Iterates through Webpack/Turbopack chunks to find and patch target functions.
 */
function processChunk(chunk) {
    if (!chunk) return;
    try {
        if (Array.isArray(chunk)) {
            for (let i = 0; i < chunk.length; i++) {
                handleItem(chunk, i);
            }
        }
    } catch (e) {
        console.error("[PolyView+] Fatal error in processChunk:", e);
    }

    // Helper to keep the loop clean and safe
    function handleItem(parent, key) {
        const item = parent[key];
        if (typeof item === 'function') {
            const patched = patchFunctionString(item.toString());
            if (patched) {
                try { parent[key] = (0, eval)('(' + patched + ')'); } catch(e) { console.warn("[PolyView+] Eval failed for item:", key); console.error(e); }
                console.log("[PolyView+] Patched function at key:", key);
            }
        } else if (typeof item === 'object' && item !== null) {
            for (let subKey in item) {
                if (typeof item[subKey] === 'function') {
                    const patched = patchFunctionString(item[subKey].toString());
                    if (patched) {
                        try { item[subKey] = (0, eval)('(' + patched + ')'); } catch(e) { console.warn("[PolyView+] Eval failed for subKey:", subKey); console.error(e); }
                        console.log("[PolyView+] Patched function at subKey:", subKey);
                    }
                }
            }
        }
    }
}

function installHook(globalName) {
    let _arr = globalThis[globalName];
    if (!_arr) { _arr = []; globalThis[globalName] = _arr; }
    
    function overridePush(targetArray) {
        if (!targetArray || targetArray.__polyview_hooked) return;
        let _push = targetArray.push;
        
        Object.defineProperty(targetArray, 'push', {
            get: () => function(...args) {
                try { if (Array.isArray(args)) args.forEach(chunk => processChunk(chunk)); } catch (e) {}
                return _push.apply(this, args);
            },
            set: (newVal) => _push = newVal,
            configurable: true
        });
        
        Object.defineProperty(targetArray, '__polyview_hooked', { value: true, enumerable: false, configurable: true });
        
        if (Array.isArray(targetArray)) targetArray.forEach(chunk => processChunk(chunk));
        else if (typeof targetArray.length === 'number') {
            for(let i = 0; i < targetArray.length; i++) processChunk(targetArray[i]);
        }
    }
    
    overridePush(_arr);
    let originalValue = _arr;
    Object.defineProperty(globalThis, globalName, {
        get: () => originalValue,
        set: (newVal) => { originalValue = newVal; overridePush(originalValue); },
        configurable: true
    });
}

try {
    installHook('TURBOPACK');
    installHook('webpackChunk_N_E');
} catch (err) {}