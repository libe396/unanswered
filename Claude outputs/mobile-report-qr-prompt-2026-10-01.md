# UNANSWERED — 결과 보고서 모바일 전달 (QR)

먼저 `AGENTS.md`를 읽고 그 규칙을 그대로 따라줘. 시작 전에 `git status`를 확인하고, 커밋 안 된 기존 변경은 절대 건드리지 마.
`src/lib/imageAnalysis.js`, `src/lib/lightRenderer.js`는 수정 금지.
`* 2.tsx`, `* 2.css`, `archive 2.zip` 같은 중복 파일은 건드리지 마.

---

## 목표

전시장에서는 영수증 프린터를 쓰지 않아. 흑백 출력으로는 이 전시의 핵심인 **색**이 살지 않기 때문이야.
대신 마지막 화면에 **관객마다 다른 QR**을 띄우고, 관객은 그걸 찍어서 **자기 폰에서 컬러 결과 영수증**을 받아 가.

**제약**
- 서버 없음. GitHub Pages 그대로 써.
- 결과 데이터는 압축해서 URL hash에 담아. 서버에 저장되는 건 아무것도 없어.
- 전시장 PC는 오프라인일 수 있어. QR 생성은 npm 패키지로 번들해서 오프라인에서도 동작해야 해. CDN 금지.
- QR은 전시장 PC 주소(localhost 등)가 아니라 항상 공개 URL을 가리켜야 해.

---

## 1. 패키지 추가
- `qrcode`: QR을 canvas나 SVG로 생성
- `lz-string`: `compressToEncodedURIComponent`로 압축
- 둘 다 `dependencies`에 추가해. 다른 패키지는 추가하지 마.

## 2. 공개 URL 설정
- `VITE_PUBLIC_REPORT_URL` 환경변수를 써. 기본값은 `https://libe396.github.io/unanswered/`
- 결과 URL 형식: `${PUBLIC_URL}#/r/${payload}`
- hash 방식이라 GitHub Pages에서 404가 나지 않아.

## 3. 페이로드 `src/lib/reportShare.ts` (새 파일)

**함수**
```ts
encodeReport(record, behavior, presentation): string   // 압축된 payload 문자열
decodeReport(payload): SharedReport | null              // 실패하면 null
buildReportUrl(payload): string
```

**`SharedReport` v1에 넣을 것**

모바일 영수증을 그리는 데 필요한 최소한만 넣어.

| 키 | 내용 |
|---|---|
| `v` | 1 (스키마 버전) |
| `id` | reportId |
| `t` | 발급 시각 (unix 분 단위) |
| `n` | 조사원 이름. 최대 12자로 잘라 |
| `img`, `var` | LIGHT의 imageId, variation |
| `kw` | 선택한 감정 키워드. 텍스트 말고 `EMOTION_KEYWORDS`의 인덱스로 |
| `snd`, `pos` | soundId, memoryPosition [x, y] (소수 둘째 자리까지) |
| `obj` | 기억 구역에서 선택한 물건 id |
| `sen` | 선택한 문장 fragment id |
| `ev` | `buildActionEvidence` 결과. 텍스트 말고 `{kind, sceneId, 숫자들}` 구조로 넣고 모바일에서 다시 문장을 만들어. 구조화가 어려우면 문장 텍스트를 최대 3줄까지만 넣어 |

**넣지 말 것**
- 문장 구역의 자유 입력(`responseText`)은 개인적인 글이라 제외해.
- 카메라 관련 데이터, 원본 이벤트 로그 전체도 제외해.

**길이 예산**
- 최종 URL 전체가 **600자 이하**여야 해. 초과하면 `ev` → `obj` 순서로 줄여.
- QR 오류정정 레벨은 `M`.

## 4. 빛 그래픽 재현: 분석 결과 캐시

`renderLightGraphic(canvas, rules, variation)`은 seed 기반이라, 같은 `rules`와 `variation`이면 항상 같은 그림이 나와.
그런데 `rules`는 contour까지 들어 있어서 URL에 넣기엔 너무 커.

그래서 이렇게 해:
- `src/assets/archive`의 이미지 전부에 대해 `analyzeImage` 결과를 미리 계산해서 `src/data/lightRulesCache.json`에 저장해. 이미지 id가 key야.
- 이 계산은 dev 전용 스크립트나 dev 전용 페이지로 한 번만 돌리면 돼.
- 모바일 화면은 `cache[img]`와 `var`로 그래픽을 그려.
- **검증:** 같은 이미지에 대해 전시 화면에서 실시간으로 분석한 `rules`와 캐시가 같은지 비교해서 보고해줘. 다르면 차이를 보고하고, 모바일과 전시 화면의 그래픽이 눈으로 봐도 같은지 스크린샷을 나란히 놓고 비교해줘.

## 5. 라우팅
- `App.tsx`에서 `location.hash`가 `#/r/`로 시작하면 `SceneController` 대신 `MobileReportView`를 렌더해. 그 외 흐름은 그대로 둬.
- `MobileReportView`는 experience store에 **아무것도 쓰지 마.** 같은 기기에 진행 중이던 기록이 있어도 덮어쓰면 안 돼.
- 디코딩에 실패하면 이렇게 보여줘: `기록을 읽을 수 없습니다. QR을 다시 찍어주세요.`

## 6. `MobileReportView` (`src/scenes/mobile/`)

기존 `FinalReportSummaryReceipt`의 구성과 톤을 그대로 따라가는 **모바일 컬러 영수증**이야.

**레이아웃**
- 390px 기준, 좌우 여백 16px, 가로 스크롤 금지.

**영수증 순서**
1. UNANSWERED ARCHIVE / REPORT ID / 발급 시각
2. 빛 그래픽 canvas(정사각형) + 팔레트 칩 + 대표 hex
3. 단서 목록: 소리, 문장, 기억
4. 선택의 과정: `ev` 문장
5. 흔적을 남긴 관객: `n` (이름이 없으면 `이름 없음`)
6. 하단 안내: `이 기록은 이 링크에만 담겨 있습니다. 서버에 저장되지 않습니다.`

**버튼**
- `빛 그래픽 저장`: canvas를 PNG로 다운로드 (파일명 `UNANSWERED_${id}.png`)
- `링크 복사`

**디자인**
- 기존 tokens.css를 써. 거의 무채색 + #8A6BFF 포인트 하나.
- 데스크톱 전용 커서 효과(TrailCursor, 손전등 등)는 모바일 뷰에서 끄기.

## 7. 마지막 화면에 QR 띄우기 (`FinalReportScene`의 `archive` 단계)

`FinalReportSummaryReceipt`를 이렇게 바꿔:
- `SCAN FOR FULL A4 REPORT` 문구 자리에 실제 QR(약 200px)을 넣고, 문구는 `폰으로 보고서 받기 / SCAN TO KEEP`로 바꿔.
- QR 아래에 `링크 복사` 버튼을 둬. 집에서 온라인으로 보는 관객용이야.
- `전체 조사 기록 발급하기`(`window.print`) 버튼은 온라인 모드에서는 유지해.
- `LIBERO GRAPHIC` 라벨이 `LIBEO`의 오타인지 확인해줘. 고치지 말고 보고만 해.

**전시장 모드**
URL에 `?venue=1`이 붙어 있으면 전시장 모드로 동작해.
- 인쇄 버튼을 숨겨.
- QR을 화면 중앙에 크게(약 320px) 띄워.
- QR 아래에 이 안내 문구를 넣어:
  ```
  QR을 찍어 보고서를 받아 가세요.

  입구에서 받은 조사원증 카드에
  이름과, 아직 대답하지 못한 것 하나를 적어
  벽에 꽂아주세요.
  비워두어도 괜찮습니다.
  ```
- 전시장 모드에서만 90초 동안 입력이 없으면 Landing으로 돌아가는 리셋을 넣어. 다음 관객을 위한 거야. 리셋할 때 experience store를 초기화하는 기존 함수가 있으면 그걸 쓰고, 없으면 보고해줘.

## 8. 검증
1. `npx tsc --noEmit`, `npm run build` 통과
2. `mockExperienceData`의 여러 케이스로 encode → decode 왕복 테스트를 해서, 디코딩한 값이 원본과 같은지 확인해. 각 케이스의 URL 길이도 보고해줘.
3. 데이터가 가장 많은 케이스로 URL과 QR PNG를 만들어서 `Claude outputs/qr-test/`에 저장해줘. 실제 폰으로 찍는 건 내가 할게.
4. Chrome DevTools에서 iPhone 크기로 `MobileReportView`를 열고 스크린샷을 같은 폴더에 저장해줘.
5. `#/r/` 경로가 아닐 때 기존 Landing → Final Report 흐름이 그대로인지 확인해줘.
6. 바꾼 파일과 새로 만든 파일 목록을 보고해줘.

배포(`npm run deploy`)랑 커밋은 하지 마. 내가 확인하고 직접 할게.
