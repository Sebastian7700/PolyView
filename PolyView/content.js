// content.js
console.log("[PolyView] Injecting Turbopack/Webpack interceptor...");

function patchFunctionString(funcStr) {
    let originalStr = funcStr;
    let modified = false;

    // Check if this function contains the market card limits we want to patch
    if (funcStr.includes(".slice(0, 2)") || funcStr.includes(".slice(0,2)") || funcStr.includes("h-[71px]") || funcStr.includes("h-[70px]")) {
        
        // 1. Uncap the market outcomes limit (ignores slice(0, 3) which is for the live popups)
        if (/\.slice\(\s*0\s*,\s*2\s*\)/.test(funcStr)) {
            funcStr = funcStr.replace(/\.slice\(\s*0\s*,\s*2\s*\)/g, ".slice(0, 99)");
            modified = true;
            console.log("[PolyView] Uncapped .slice(0, 2) limit to .slice(0, 99)");
        }

        // 2. Remove fixed heights (replace h-[70px] and h-[71px] with h-auto)
        if (/h-\[70px\]|h-\[71px\]/.test(funcStr)) {
            funcStr = funcStr.replace(/h-\[70px\]/g, "h-auto");
            funcStr = funcStr.replace(/h-\[71px\]/g, "h-auto");
            modified = true;
            console.log("[PolyView] Removed fixed heights (h-[70px]/h-[71px] -> h-auto)");
        }

        // 3. Remove height from the market card header to prevent cropping of long titles
        if (/h-\[42px\]/.test(funcStr)) {
            funcStr = funcStr.replace(/h-\[42px\]/g, "h-auto");
            modified = true;
            console.log("[PolyView] Removed fixed height from market card header (h-[42px] -> h-auto)");
        }
    }

    return modified ? funcStr : null;
}

// Function to process pushed chunks safely
function processChunk(chunk) {
    if (!chunk) return;
    
    try {
        // Handle Turbopack format
        if (Array.isArray(chunk)) {
            for (let i = 0; i < chunk.length; i++) {
                if (typeof chunk[i] === 'function') {
                    let patched = patchFunctionString(chunk[i].toString());
                    if (patched) chunk[i] = (0, eval)('(' + patched + ')');
                } else if (typeof chunk[i] === 'object' && chunk[i] !== null) {
                    // Handle Webpack format inside array
                    for (let key in chunk[i]) {
                        if (typeof chunk[i][key] === 'function') {
                            let patched = patchFunctionString(chunk[i][key].toString());
                            if (patched) chunk[i][key] = (0, eval)('(' + patched + ')');
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.error("[PolyView] Error processing chunk:", e);
    }
}

// Advanced Hooking Mechanism
function installHook(globalName) {
    // Initialize the array if Next.js hasn't yet
    let _arr = globalThis[globalName];
    if (!_arr) {
        _arr = [];
        globalThis[globalName] = _arr;
    }
    
    // Function to trap the `.push` method of the target array/object
    function overridePush(targetArray) {
        if (!targetArray || targetArray.__polyview_hooked) return; // Prevent double hooking
        
        let _push = targetArray.push;
        
        Object.defineProperty(targetArray, 'push', {
            get: () => function(...args) {
                try {
                    // Intercept and process any chunks being pushed BEFORE framework sees them
                    if (Array.isArray(args)) {
                        args.forEach(chunk => processChunk(chunk));
                    }
                } catch (e) {
                    console.error("[PolyView] Error in push interception:", e);
                }
                return _push.apply(this, args); // Hand off to original/framework push safely
            },
            set: (newVal) => {
                // If Next.js tries to overwrite push entirely, save their function to _push
                // but keep our wrapper active in the `get`!
                _push = newVal;
            },
            configurable: true
        });
        
        Object.defineProperty(targetArray, '__polyview_hooked', {
            value: true,
            enumerable: false,
            configurable: true
        });
        
        // Also process anything that was already in the array before our hook
        if (Array.isArray(targetArray)) {
            targetArray.forEach(chunk => processChunk(chunk));
        } else if (typeof targetArray.length === 'number') {
            for(let i = 0; i < targetArray.length; i++) {
                processChunk(targetArray[i]);
            }
        }
    }
    
    overridePush(_arr);
    
    // Trap the global variable itself in case Next.js tries to recreate the array entirely
    let originalValue = _arr;
    Object.defineProperty(globalThis, globalName, {
        get: () => originalValue,
        set: (newVal) => {
            originalValue = newVal;
            overridePush(originalValue);
        },
        configurable: true
    });
}

// Start intercepting immediately
try {
    installHook('TURBOPACK');
    installHook('webpackChunk_N_E');
    console.log("[PolyView] Interceptors installed successfully.");
} catch (err) {
    console.error("[PolyView] Failed to install interceptors:", err);
}