
// Helper to wait for element
const waitForElement = (selector, timeout = 5000) => {
    return new Promise((resolve, reject) => {
        const element = document.querySelector(selector);
        if (element) return resolve(element);

        const observer = new MutationObserver(() => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                observer.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Timeout waiting for element: ${selector}`));
        }, timeout);
    });
};

const processQueue = async () => {
    const data = await chrome.storage.local.get([
        'taskQueue',
        'currentIndex',
        'isProcessing',
        'targetSelector',
        'inputSelector'
    ]);

    const { taskQueue, currentIndex, isProcessing, targetSelector, inputSelector } = data;

    if (!isProcessing || !taskQueue || currentIndex === undefined) return;

    if (currentIndex >= taskQueue.length) {
        console.log('DOM Automator: All tasks completed.');
        await chrome.storage.local.set({ isProcessing: false });
        alert('모든 작업이 완료되었습니다.');
        return;
    }

    const currentData = taskQueue[currentIndex];
    console.log(`DOM Automator: Processing item ${currentIndex + 1}/${taskQueue.length}: ${currentData}`);

    try {
        // 1. Fill Input (if selector provided)
        if (inputSelector) {
            const inputEl = await waitForElement(inputSelector);

            // Try to set value in a React-friendly way if possible, basically dispatch input event
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            nativeInputValueSetter.call(inputEl, currentData);

            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // 2. Click Button
        if (targetSelector) {
            const btnEl = await waitForElement(targetSelector);

            // Small delay to ensure input is processed
            await new Promise(r => setTimeout(r, 500));

            btnEl.click();
        }

        // 3. Update Index
        await chrome.storage.local.set({ currentIndex: currentIndex + 1 });

        // Note: If the page reloads, this script runs again and picks up the new index.
        // If it's an SPA and doesn't reload, we might need a loop or trigger.
        // For now, assuming page reload or some navigation. 
        // If NO navigation happens, we should probably check again?
        // Let's add a small polling mechanism or just wait for next load if it's MP.
        // However, if the button click doesn't cause a reload, we just stop? 
        // Let's add a recursive call with delay for SPA support if the URL doesn't change.

        // For safety, let's just listen for reloads mainly, but maybe wait a bit and check if we are still on the same page state?
        // The safest "Batch" automation usually assumes the action leads to a new "Blank" state or reload.
        // Let's leave it as "run on load" for now, which handles the "refresh" case well.

    } catch (error) {
        console.error('DOM Automator Error:', error);
        // Option: Stop on error or skip? 
        // Let's stop for safety.
        await chrome.storage.local.set({ isProcessing: false });
        alert(`오류 발생: ${error.message}`);
    }
};

// Run on load
processQueue();

// Listen for manual trigger from Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'START_BATCH') {
        processQueue();
    }
});
