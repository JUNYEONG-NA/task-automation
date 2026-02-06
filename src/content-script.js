// IPIN popup semi-automation script.
// Runs only on https://ipin.siren24.com/* via manifest content_scripts.

const PRESET_ID = 'CHANGE_ME_ID';
const PRESET_PW = 'CHANGE_ME_PASSWORD';

const waitForElement = (selector, timeoutMs = 10000) => {
  return new Promise((resolve, reject) => {
    const found = document.querySelector(selector);
    if (found) {
      resolve(found);
      return;
    }

    const observer = new MutationObserver(() => {
      const next = document.querySelector(selector);
      if (next) {
        observer.disconnect();
        resolve(next);
      }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for ${selector}`));
    }, timeoutMs);
  });
};

const setInputValueWithEvents = (inputEl, value) => {
  // Use native setter + input/change dispatch so site-side scripts detect updates.
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
  if (descriptor?.set) {
    descriptor.set.call(inputEl, value);
  } else {
    inputEl.value = value;
  }

  inputEl.dispatchEvent(new Event('input', { bubbles: true }));
  inputEl.dispatchEvent(new Event('change', { bubbles: true }));
};

const wireEnterToSubmit = (captchaInput) => {
  // Keep captcha manual. Only help Enter submit the login flow naturally.
  captchaInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') {
      return;
    }

    const loginButton = document.querySelector('button[type="submit"], input[type="submit"], #btnLogin, .btn_login');
    if (loginButton instanceof HTMLElement) {
      loginButton.click();
      return;
    }

    const form = captchaInput.closest('form');
    if (form && typeof form.requestSubmit === 'function') {
      form.requestSubmit();
    }
  });
};

const bootstrap = async () => {
  try {
    const idInput = await waitForElement('#id');
    const pwInput = await waitForElement('#pw');
    const captchaInput = await waitForElement('#captchaCode');

    setInputValueWithEvents(idInput, PRESET_ID);
    setInputValueWithEvents(pwInput, PRESET_PW);

    // Do NOT automate captcha. Move focus for user manual entry.
    captchaInput.focus();

    wireEnterToSubmit(captchaInput);
    console.log('IPIN helper: ID/PW filled, captcha focus ready.');
  } catch (error) {
    console.warn('IPIN helper: initialization failed.', error);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
