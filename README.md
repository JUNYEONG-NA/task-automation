# IPIN Semi-Auto Chrome Extension (MV3)

이 프로젝트는 `https://ipin.siren24.com/*` 팝업에서만 동작하는 반자동 로그인 보조 익스텐션입니다.

## 왜 이렇게 구현했나
- 아이핀 팝업은 부모 페이지와 도메인이 달라 Same-Origin Policy 때문에 부모에서 DOM 제어가 불가합니다.
- 그래서 팝업 도메인에 직접 `content_script`를 주입해 필요한 입력만 보조합니다.
- 캡차는 보안/정책상 자동화하지 않고 사용자가 직접 입력하게 둡니다.

## 동작 단계
1. 팝업 로드 후 `#id`, `#pw`를 찾아 미리 정의된 값 입력.
2. `input` + `change` 이벤트를 dispatch 하여 사이트 보안 스크립트가 변경을 감지하도록 처리.
3. `#captchaCode`로 포커스를 이동해 사용자 입력을 유도.
4. 사용자가 캡차 입력 후 Enter를 누르면 로그인 버튼 클릭(또는 폼 submit)으로 자연스럽게 제출.

## 파일 구성
- `public/manifest.json`: Manifest V3, Siren24 도메인 한정 content script 등록.
- `src/content-script.js`: 반자동 입력/포커스/Enter 제출 보조 로직.

## 설정
- `src/content-script.js`의 `PRESET_ID`, `PRESET_PW`를 실제 값으로 변경하세요.

```js
const PRESET_ID = 'CHANGE_ME_ID';
const PRESET_PW = 'CHANGE_ME_PASSWORD';
```

## 보안 관련 주의
- 캡차 자동 인식/OCR/우회 코드는 포함하지 않습니다.
- `eval` 및 외부 라이브러리를 사용하지 않습니다.
