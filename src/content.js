const DEFAULT_TIMEOUT = 10000;
const POPUP_CLOSE_SELECTOR = '.popzoneclose_day';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForElement = (selector, timeout = DEFAULT_TIMEOUT) => {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for element: ${selector}`));
    }, timeout);
  });
};

const waitForPageReady = async () => {
  if (document.readyState === 'loading') {
    await new Promise((resolve) => {
      document.addEventListener('DOMContentLoaded', resolve, { once: true });
    });
  }
};

const setInputValue = (input, value) => {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(input, value);
  } else {
    input.value = value;
  }

  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
};

const closeInitialPopupIfExists = async () => {
  await waitForPageReady();
  const closeButton = document.querySelector(POPUP_CLOSE_SELECTOR);
  if (closeButton) {
    closeButton.click();
  }
};

const parseRowData = (row) => {
  if (typeof row === 'object' && row !== null) {
    const id = row.id ?? row.ID ?? row.userId ?? row.username ?? '';
    const password = row.password ?? row.PASSWORD ?? row.pw ?? row.passwd ?? '';
    return { id: String(id).trim(), password: String(password).trim() };
  }

  const [id = '', password = ''] = String(row).split(/,|\t|\|/);
  return { id: id.trim(), password: password.trim() };
};

const invokeNetfunnelLoginMove = () => {
  if (typeof window.NetFunnel_Action === 'function') {
    window.NetFunnel_Action(
      { action_id: 'OLS_ACT_1' },
      () => {
        location.href = '/ols/man/SMAN020M/page.do';
      },
    );
    return;
  }

  throw new Error('NetFunnel_Action 함수를 찾을 수 없습니다.');
};

const ensureLoginPage = async () => {
  const loginButton = document.querySelector('button.btn_login, button[value="로그인"]');
  if (loginButton) {
    return;
  }

  const logoutButton = Array.from(document.querySelectorAll('button, a, [role="button"], [onclick]')).find((el) =>
    (el.textContent || '').includes('로그아웃'),
  );

  if (logoutButton) {
    logoutButton.click();
    await sleep(800);
  }

  invokeNetfunnelLoginMove();
  await sleep(1500);
};

const clickIdLoginTab = async () => {
  const tabLink = document.querySelector('#tab_item_01 a');
  if (!tabLink) {
    throw new Error('아이디 로그인 탭(#tab_item_01 a)을 찾을 수 없습니다.');
  }

  tabLink.click();
  await sleep(300);
};

const fillCredentials = async ({ id, password }) => {
  if (!id || !password) {
    throw new Error('ID 또는 PW 데이터가 비어 있습니다.');
  }

  const idInput = await waitForElement('#mbrId');
  const pwInput = await waitForElement('#pwd');

  idInput.focus();
  setInputValue(idInput, id);

  pwInput.focus();
  setInputValue(pwInput, password);
};

const clickLoginButton = async () => {
  const loginButton = await waitForElement('button.btn_login');
  loginButton.click();
};

const waitForLoginResult = async () => {
  const startUrl = location.href;
  const timeoutMs = 7000;
  const intervalMs = 250;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const loginButton = document.querySelector('button.btn_login, button[value="로그인"]');
    const logoutButton = Array.from(document.querySelectorAll('button, a, [role="button"], [onclick]')).find((el) =>
      (el.textContent || '').includes('로그아웃'),
    );

    const movedToDifferentPage = location.href !== startUrl;

    if (logoutButton || movedToDifferentPage) {
      return { success: true };
    }

    if (!loginButton) {
      return { success: true };
    }

    await sleep(intervalMs);
  }

  return {
    success: false,
    reason: '로그인 성공 상태를 확인하지 못했습니다. 로그인 실패로 판단하여 현재 화면에서 중지합니다.',
  };
};

const runPhase1 = async (credentials) => {
  await closeInitialPopupIfExists();
  await ensureLoginPage();
  await clickIdLoginTab();
  await fillCredentials(credentials);
  await sleep(250);
  await clickLoginButton();
  return waitForLoginResult();
};

const processQueue = async () => {
  const data = await chrome.storage.local.get(['taskQueue', 'currentIndex', 'isProcessing']);
  const { taskQueue = [], currentIndex = 0, isProcessing } = data;

  if (!isProcessing) {
    return;
  }

  if (!Array.isArray(taskQueue) || currentIndex >= taskQueue.length) {
    await chrome.storage.local.set({ isProcessing: false });
    alert('모든 작업이 완료되었습니다.');
    return;
  }

  const credentials = parseRowData(taskQueue[currentIndex]);

  try {
    const loginResult = await runPhase1(credentials);

    if (!loginResult.success) {
      await chrome.storage.local.set({ isProcessing: false });
      alert(loginResult.reason);
      return;
    }

    const nextIndex = currentIndex + 1;
    await chrome.storage.local.set({ currentIndex: nextIndex });

    if (nextIndex >= taskQueue.length) {
      await chrome.storage.local.set({ isProcessing: false });
    }
  } catch (error) {
    console.error('DOM Automator Error:', error);
    await chrome.storage.local.set({ isProcessing: false });
    alert(`오류 발생: ${error.message}`);
  }
};

closeInitialPopupIfExists();

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'START_BATCH') {
    processQueue();
  }
});
