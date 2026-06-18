# PolyView+

**PolyView+** is a powerful Chrome extension that vastly improves your Polymarket experience by revealing all data at a glance and structuring it into a beautiful, highly efficient waterfall grid.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Architecture & Patches](#architecture--patches)
- [Troubleshooting & Self-Debugging](#troubleshooting--self-debugging)
- [Disclaimer](#disclaimer)
- [License](#license)

## Overview

If you frequently analyze odds on **Polymarket**, you likely know the frustration of the default user interface. Complex markets with multiple outcomes (like elections, sports tournaments, or financial milestones) are artificially capped at just two visible options. Lengthy event descriptions are cropped with ellipses. Seeing the complete picture requires endless clicking, expanding, and scrolling.

**PolyView+ solves this entirely.** It removes these arbitrary limits so every market outcome is instantly exposed and every event title is fully visible. To handle the massive vertical lists created by this newly expanded data, PolyView+ intelligently reorganizes the layout into a beautiful, Pinterest-style waterfall grid. 

The result is a dense, highly readable, and frictionless dashboard for market analysis.

> **Note:** This extension was built as a personal utility for analyzing market odds more efficiently. It is provided as-is, with no ongoing support or feature updates.

## Features

* **Expanded Markets:** Overrides the client-side market renderer that trims event options to two items, allowing the extension to display a larger, configured set of visible markets.
* **Uncropped Titles:** Removes line-clamping logic, ensuring long event and market titles are fully readable.
* **Market Price Sorting:** Replaces the default probability-based sorting with a smart algorithm that selects the best sorting strategy. This sorts numerical markets logically by price, resulting in a beautiful bell curve of probabilities. 
* **Stable Masonry Layout:** Replaces standard lists with a dense, waterfall-style CSS Grid. Uses highly efficient `ResizeObserver` math to calculate 1px row-spans, preventing the visual jumping associated with virtualized scrollers.
* **Native Performance:** Patches Virtuoso's viewport bounds so cards above the scroll position stay mounted, stabilizing the grid without sacrificing runtime smoothness.
* **Customizable UI Popup:** A clean extension popup allows you to:
  * Toggle the Masonry layout or Custom Sorting on/off.
  * Customize the maximum number of visible markets.
  * Edit and launch a customized quick-link to your preferred Polymarket page.
  * Apply changes in real-time via `chrome.storage` synchronization.

![PolyView+ interface showing expanded market rows and stable waterfall-style layout](demo/PolyView+.avif)

## Installation

PolyView+ is not currently listed on the Chrome Web Store and must be installed manually.

1. **Clone or Download the Repository:**
   ```bash
   git clone https://github.com/Sebastian7700/PolyView.git
   ```

2. **Load the Extension in Chrome:**
   1. Open Chrome and navigate to `chrome://extensions/`
   2. Enable **Developer mode** (toggle in the top-right corner).
   3. Click on **Load unpacked**.
   4. Select the `PolyView+` folder.
   5. Navigate to [Polymarket](https://www.polymarket.com) and enjoy your improved layout!

## Usage

1. Click the **PolyView+ icon** in your browser's extension toolbar to open the control panel.
2. Adjust your preferred layout settings (for example, set max visible markets to 10 or toggle Masonry mode).
3. Settings are automatically synchronized. Click **Reload Polymarket** (or manually refresh your tab) to apply any new changes.
4. Click the **Edit** button next to the quick-link to set a custom default page (like `https://polymarket.com/finance`). 
5. Click **Open Polymarket** to launch your configured page in a new tab.

## Architecture & Patches

Polymarket's default UI heavily truncates market data. The problem is not that the data is missing, as **network traffic still delivers all markets**. The issue is the client-side rendering code, which intentionally **slices** the option list before it reaches the UI. Furthermore, because Polymarket uses React Virtuoso for virtualization, uncapped cards create variable heights that break the scroller's layout calculations.

**PolyView+** solves this by patching the site in memory as it loads. It relies on a robust **In-Memory Hooking Architecture**. The extension injects a script into the `MAIN` execution world at `document_start`. It uses `Object.defineProperty` to trap the `globalThis.TURBOPACK` and `globalThis.webpackChunk_N_E` arrays. When the site loads a JavaScript chunk, the interceptor pauses execution, reads the function as a string, applies regex-based patches, re-evaluates the function, and passes it back to the framework.

PolyView+ targets specific JavaScript chunks identified by unique combinations of strings (signatures) found within them.

### Target 1: Market Card UI

This chunk is responsible for rendering individual event cards and their market options. It is identified by specific layout class signatures unique to the card builder, primarily `"relative mt-0.5 h-20 w-full"` and `"relative h-20 w-full select-none"`.

<details>
<summary><strong>Patch 1A: Uncap Market Limits</strong></summary>

* **Purpose:** Polymarket hard-limits each event to show only 2 market options by default.
* **Target:** The string `.slice(0, 2)` in the market options list.
* **Patch:** Replaced with `.slice(0, CONFIG.maxItems)`, instantly showing all configured options.
* **Context:** This is currently the only slice operation with this exact signature in this chunk. We strictly check if it is the `.slice(0, 2)` operation, since the chunk also contains a `.slice(0, 3)` operation that belongs to the logic handling the live order notifications (the little floating green/red "+ $500" animations that pop up in the card). If Polymarket changes the number of natively displayed markets, this patch will need adjustment.
</details>

<details>
<summary><strong>Patch 1B: Remove Fixed Card Heights</strong></summary>

* **Purpose:** Replaces rigid Tailwind height constraints, allowing cards to expand vertically to accommodate unhidden markets.
* **Target:** The CSS height class `h-20`.
* **Patch:** Replaces the specific pixel heights with `h-auto`.
* **Context:** The targets can currently be found within these exact strings within the chunk:
  * Mobile card body: `"relative h-20 w-full select-none"`
  * Desktop card body: `"relative mt-0.5 h-20 w-full"`
</details>

<details>
<summary><strong>Patch 1C: Uncrop Event Titles</strong></summary>

* **Purpose:** Long titles are currently truncated to 3 lines and cut off with ellipses.
* **Target:** The CSS class `line-clamp-3` on event titles.
* **Patch:** Removes the class entirely, allowing titles to display in full.
* **Context:** The target can currently be found within this exact string within the chunk: 
`"text-body-base text-text font-[590] w-fit line-clamp-3 text-pretty decoration-2 min-w-0"`.
</details>

<details>
<summary><strong>Patch 1D: Uncrop Market Names</strong></summary>

* **Purpose:** Market outcome names are truncated to a single line and cut off with ellipses.
* **Target:** The CSS class `line-clamp-1`.
* **Patch:** Removes the line restriction from individual market outcome names.
* **Context:** This is the only occurrence of `line-clamp-1` in the chunk, so it can be targeted directly without affecting unrelated UI elements.
</details>

<br>

### Target 2: React Virtuoso Engine

This chunk handles the infinite-scroll viewport calculations. It is identified by internal props like `"virtuoso"`, `"itemContent"`, and `"useWindowScroll"`.

<details>
<summary><strong>Patch 2A: Zero-Viewport Stabilizer</strong></summary>

* **Purpose:** Normally, Virtuoso unloads items scrolled above the viewport to save memory. However, when cards vary in height due to our expanded markets, this unloading process causes the layout to collapse and jump wildly (this happens both in standard lists and the Masonry grid).
* **Target:** The `Math.max(...)` calculation that determines the upper boundary of the visible pixel range. The script looks for a regex pattern matching `[Math.max(... "top" ... 0),`. 
* **Patch:** Forces the top viewport boundary to always be `0` instead of dynamically recalculating it. This ensures Virtuoso never unloads previously scrolled items. Because the bottom limit remains dynamic, initial page loads stay fast while delivering perfectly smooth scrolling without layout jumps.
* **Context:** Internally, `react-virtuoso` tracks what to render by calculating a visible pixel range array: `[topLimit, bottomLimit]`. In the minified code, the `topLimit` calculation looks something like `[Math.max(d-o-ej(i,"top",f)-h,0),`. This represents a logical formula such as `Math.max(containerHeight - distance - getOffset(element, "top", relativeTo) - buffer, 0)`. The patch simply replaces this complex calculation with `0`, transforming the virtual bounds into `[0, bottomLimit]`. This approach should remain stable as long as the underlying library logic doesn't drastically change.
</details>

<br>

### Target 3: Market Card Header

This chunk likely contains UI helper functions. It is also responsible for rendering the top section of each event card and is identified by the fixed header height class `"h-[42px]"`.

<details>
<summary><strong>Patch 3A: Remove fixed header height</strong></summary>

* **Purpose:** The card header currently uses a fixed height, which can truncate the title and image area when markets expand.
* **Target:** The CSS class `h-[42px]` on the header wrapper.
* **Patch:** Replaces `h-[42px]` with `h-auto`, allowing the header section to scale naturally.
* **Context:** The target can currently be found within this exact string within the chunk: 
`"relative flex w-full items-start gap-2 px-3 h-[42px]"`
</details>

<br>

### Target 4: Data Sorting Logic

Technically located in the same chunk as Target 3, but logically separated due to its unique signature. Identified by the function name `"sortMarketsByPriceDesc"`.

<details>
<summary><strong>Patch 4A: Market Price Sorting</strong></summary>

* **Purpose:** By default, Polymarket sorts outcomes strictly by highest probability. For price-target markets, this jumbles the options (e.g., $20, $10, $30).
* **Target:** The `sortMarketsByPriceDesc` array sort logic.
* **Patch:** Rewrites the `.sort()` function to:
  1. Check if markets contain no numbers (e.g., "Apple", "NVIDIA"). If so, it falls back to the original probability sort to keep relevant markets at the top.
  2. Attempt to sort using Polymarket's internal, sequential `groupItemThreshold`.
  3. Fall back to a natural alphanumeric sort (descending) for "Highest to Lowest" order.
  4. If all options begin with an arrow (`↑`/`↓`), it slices the first character before the alphanumeric sort, since arrow Unicode would jumble the order.
* **Context:** For price markets, this results in a logical, numerical ordering that visually forms a bell curve of probabilities. The minified sorting utility function currently has a structure like this: `e.s(["getMarketProbability",0,s,"sortMarketsByPriceDesc",0,e=>[...e].sort((e,t)=>s(t)-s(e))])`
</details>

## Troubleshooting & Self-Debugging

If Polymarket pushes an update that alters their class names or bundle structure, PolyView+ may temporarily stop functioning. You can diagnose and fix this yourself using Chrome DevTools:

1. **Check the Console:** Open DevTools (F12) and look for `[PolyView+] Patched function at key: X`. If these messages are missing, the chunk signatures have changed.
2. **Update Market UI Signatures:** Inspect Polymarket's DOM. Locate the Tailwind classes currently applied to card bodies (e.g. `"relative mt-0.5 h-20 w-full"` or `"relative h-20 w-full select-none"`) and the header section (`"h-[42px]"`) and find them in a `.js` file. Update the `isMarketCardChunk` and `isMarketCardHeaderChunk` constants inside `scripts/main-world-interceptor.js` to match the site's new layout classes. If the specific truncation classes (like `line-clamp-3`, `line-clamp-1`, or `h-20`) also have changed, update the string replacements in the script accordingly.
3. **Update Virtuoso Signatures:** Check if React Virtuoso's viewport calculation variables have changed. The regex in `topLimitRegex` may need adjusting if the `Math.max` structure was refactored.
4. **Update Sorting Signatures:** Open the Network tab in DevTools, search across all downloaded `.js` files for `"sortMarketsByPriceDesc"`, and verify if the arrow-function signature within the `sortRegex` needs updating.
5. **Reload:** Save your local code changes, click the refresh icon on the extension card in `chrome://extensions/`, and reload the Polymarket tab.

> **Note to Contributors:** If you successfully update a broken patch signature, it would be highly appreciated if you submit a Pull Request to help out other users!

## Disclaimer

This Chrome extension relies heavily on in-memory interception of Polymarket's current JavaScript chunk architecture. While I don't expect this extension to cause any issues, it is provided **strictly as-is, without any warranty or guarantee of continued functionality.** If Polymarket updates its frontend architecture, this extension may break. **No official support, bug fixes, or feature updates will be provided.**

Use at your own risk.

## License

This project is provided under the MIT License. See the [LICENSE](LICENSE) file for details.