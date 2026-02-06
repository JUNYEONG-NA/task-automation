const DEFAULT_TIMEOUT = 10000;
const POPUP_CLOSE_SELECTOR = '.popzoneclose_day';
const TARGET_CARD_TEXT = '중저신용 자급 접수';
const APPLY_BUTTON_TEXT = '신청하기';

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

const normalizeText = (text = '') => text.replace(/\s+/g, ' ').trim();

const setInputValue = (input, value) => {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;

  if (input instanceof HTMLTextAreaElement && nativeTextAreaValueSetter) {
    nativeTextAreaValueSetter.call(input, value);
  } else if (nativeInputValueSetter) {
    nativeInputValueSetter.call(input, value);
  } else {
    input.value = value;
  }

  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
};

const findClickableByText = (keywords = [], root = document) => {
  const searchTargets = Array.from(root.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"], .btn, [onclick]'));
  return searchTargets.find((el) => {
    const text = normalizeText(el.innerText || el.textContent || el.value || '');
    return keywords.some((keyword) => text.includes(keyword));
  });
};

const closeInitialPopupIfExists = async () => {
  await waitForPageReady();
  const closeButton = document.querySelector(POPUP_CLOSE_SELECTOR);
  if (closeButton) {
    closeButton.click();
    console.log('DOM Automator: 초기 알림 팝업을 닫았습니다.');
  }
};

const logoutIfNeeded = async () => {
  const logoutTrigger = findClickableByText(['로그아웃']);
  if (logoutTrigger) {
    logoutTrigger.click();
    console.log('DOM Automator: 기존 로그인 세션 로그아웃을 실행했습니다.');
    await sleep(1000);
    return;
  }

  const moveToLoginTrigger = findClickableByText(['로그인 화면 이동', '로그인']);
  if (moveToLoginTrigger) {
    moveToLoginTrigger.click();
    console.log('DOM Automator: 로그인 화면 이동 버튼을 클릭했습니다.');
    await sleep(1000);
    return;
  }

  throw new Error('로그아웃 또는 로그인 화면 이동 버튼을 찾을 수 없습니다.');
};

const findLoginInputs = async () => {
  const idInputSelectors = [
    'input[name="id"]',
    'input[name="userId"]',
    'input[name="loginId"]',
    'input#id',
    'input#userId',
    'input[type="text"]'
  ];

  const passwordInputSelectors = [
    'input[name="password"]',
    'input[name="passwd"]',
    'input#password',
    'input#pwd',
    'input[type="password"]'
  ];

  let idInput = null;
  let passwordInput = null;

  for (const selector of idInputSelectors) {
    idInput = document.querySelector(selector);
    if (idInput) break;
  }

  for (const selector of passwordInputSelectors) {
    passwordInput = document.querySelector(selector);
    if (passwordInput) break;
  }

  if (!idInput) {
    idInput = await waitForElement('input[type="text"], input:not([type])');
  }

  if (!passwordInput) {
    passwordInput = await waitForElement('input[type="password"]');
  }

  return { idInput, passwordInput };
};

const loginWithCredentials = async ({ id, password }) => {
  if (!id || !password) {
    throw new Error('ID 또는 Password 데이터가 비어 있습니다.');
  }

  const { idInput, passwordInput } = await findLoginInputs();
  setInputValue(idInput, id);
  setInputValue(passwordInput, password);

  const loginTrigger = findClickableByText(['로그인']);
  if (!loginTrigger) {
    throw new Error('로그인 버튼을 찾을 수 없습니다.');
  }

  await sleep(300);
  loginTrigger.click();
  console.log('DOM Automator: 로그인 버튼 클릭 완료');

  await sleep(1500);
};

const clickApplyOnTargetCard = () => {
  const candidates = Array.from(document.querySelectorAll('div, li, article, section'));
  const targetCard = candidates.find((el) => normalizeText(el.innerText || '').includes(TARGET_CARD_TEXT));

  if (!targetCard) {
    throw new Error(`"${TARGET_CARD_TEXT}" 문구가 포함된 카드를 찾을 수 없습니다.`);
  }

  const applyButton = findClickableByText([APPLY_BUTTON_TEXT], targetCard);
  if (!applyButton) {
    throw new Error('대상 카드 안에서 "신청하기" 버튼을 찾을 수 없습니다.');
  }

  applyButton.click();
  console.log('DOM Automator: 대상 카드의 신청하기 버튼을 클릭했습니다.');
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

  const row = taskQueue[currentIndex];
  const credentials = parseRowData(row);

  console.log(`DOM Automator: ${currentIndex + 1}/${taskQueue.length} 처리 중`, credentials.id);

  try {
    await closeInitialPopupIfExists();
    await logoutIfNeeded();
    await loginWithCredentials(credentials);
    clickApplyOnTargetCard();

    await chrome.storage.local.set({ currentIndex: currentIndex + 1 });
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
