# UNANSWERED UI·몰입·관람 시간 개선 기준

## 2026-11-03 전시 이미지 경량화 (로딩 시간)

- 사용자 요청: 전시장에서 사진·일러스트가 뜨는 데 시간이 걸림. 원인은 빛 사진 PNG 10장(장당 1.6–2.7MB, 합계 약 20.5MB)과 기억의 방 PNG(1.6MB).
- 수정: Pillow로 표시 전용 WebP를 만들었다(원본 PNG는 그대로 보존).
  - `src/assets/archive/preview/light-trace-01–10.webp`(1024px, q84)·`thumb/`(240px, q80): 합계 20 556K → 1 114K.
  - `src/assets/memory/room-final.webp`(원본 크기 1672×941, q90): 1 620K → 147K.
  - `LightArchiveScene.tsx`: 사진 칸은 thumb, 큰 미리보기는 preview를 쓴다. 분석(`analyzeImage`)·변환(`LightTransformation`)·저장되는 `imagePath`는 계속 원본 PNG — 빛 규칙과 폰 보고서의 `lightRulesCache.json`이 그대로 일치한다.
  - `MobileReportView.tsx`: 폰 보고서의 ‘내가 고른 사진’을 1024px WebP로(표시 전용). `MemoryRoom.tsx`: 방 그림을 WebP로(표시 전용, 픽셀을 읽지 않음).
- 검증(브라우저, 1440×900): 빛 장면 진입 시 네트워크에 WebP 11개만(미리보기 1 + 칸 10, 칸 240px·미리보기 1024px 로드 확인), 다음으로 → 분석 시 고른 사진의 PNG 1장만 요청. 기억의 방이 WebP로 표시되고 선화에 압축 흔적 없음. 새로고침 Landing, npm run build·git diff --check 통과(기존 번들 경고). 실제 부스 네트워크 속도는 측정하지 않았다. 커밋 전.

## 2026-11-03 전시장 모드 2분 무응답 → 처음으로

- 사용자 요청(전시 당일): 2분 이상 아무 행동이 없으면 처음으로. 사용자 선택에 따라 **전시장 모드(`?venue=1`)에서만** 동작한다(온라인 관람 무변경).
- 수정: `src/lib/venueMode.ts` `VENUE_IDLE_PROMPT_MS` 180 000 → 105 000(‘계속 조사하시겠습니까?’ 1분 45초), 확인 대기 15초는 그대로 → 총 2분에 Landing. 최종보고서의 자체 초기화 `VENUE_IDLE_RESET_MS` 90 000 → 120 000(2분 기준 통일). `VenueIdleGuard.tsx` 주석만 갱신. 입력 감지(포인터·키·휠·터치·스크롤), Landing 제외, 카메라 끄기·store reset 경로는 기존 그대로. 인트로 영상(36초)은 2분보다 짧아 영상 중 발동하지 않는다.
- 검증(브라우저 `localhost:5173/unanswered/?venue=1`): 등록 화면에서 입력 없이 대기 → 약 105초에 확인창, 약 120초에 초기화, 123초에 Landing 제목 확인. npm run build·git diff --check 통과. 최종보고서 2분 초기화는 코드 값만 확인. commit/push/deploy 없음.
- 운영: 부스 iMac은 주소 `…/unanswered/?venue=1`로 열어야 이 기능(그리고 인쇄 버튼 숨김·큰 QR)이 켜진다.

## 2026-11-03 부스 iMac 24" 큰 화면 세로 중앙 정렬 예외

- 사용자 요청(전시 당일, iMac 사진 4장 기준): 약 2240×1260에서 질문이 위에 붙고 아래가 비던 문제. `@media (min-width: 1800px) and (min-height: 1000px)` 안에서만 위치·정렬·간격을 바꿨다. 글자 크기·카피·색·선택 로직·기록·장면 순서·카메라·보고서는 그대로.
- 수정(모두 위 미디어쿼리 안, 파일 끝에 추가):
  - `src/styles/tokens.css`: `--stage-head-offset` 0(묶음 전체가 가운데로 오므로 질문만 내리는 값 불필요).
  - `src/components/StageLayout.css`: 프레임 `justify-content: safe center`, 두 열 `flex: none` — 질문·작품·입력·버튼을 한 묶음으로 상단 88/하단 72 사이 가운데(등록, 빛 사진·단어).
  - `src/scenes/MemorySketchScene.css`, `SentenceCluesScene.css`(탐색), `SoundCluesScene.css`(돔·위치): 같은 `safe center` 묶음 정렬. 소리는 auto 여백 대신 16/24/40px.
  - `src/scenes/LightArchiveScene.css`: 질문 → 사진 간격 40 → 64px.
  - `src/components/LightTransformation.css`(빛 분석 단계, 가운데 정렬 유지): 공용 Stage의 빛 묶음(688px) 위치와 같은 줄에 오도록 위 여백을 계산, 질문 → 결과 간격 +20px(`--sp-24`), 제목 간격/행간을 StageHeader와 같게.
- 실측: 2240×1260에서 등록·빛·소리·소리 위치·기억·문장 묶음 중심 626–638(띠 중심 638), 2240×1140에서 566–578(띠 중심 578). 빛 공간 이름/질문 y가 사진 → 단어 → 분석 → 결과에서 294/320(1260), 234/260(1140)으로 고정, 분석 단계는 가로 중앙. 모든 버튼이 HUD 선 위, 넘침 0. 1140에서 등록 → 빛(선택·단어·분석·결과 바로 보기·이 빛으로 남기기) → 소리 → 위치 → 기억 → 문장 진행. 1440×900·1280×720에서 미디어쿼리 미적용(matchMedia false), 1440 질문 (160,128)·분석 위 여백 76px로 기존 값 유지. 새로고침 Landing, npm run build·git diff --check 통과(기존 번들 경고).
- 미검증: 실제 iMac 실기기(브라우저 에뮬레이션만), 2240 화면의 기록 레이어·보고서(이번 범위 밖). commit/push/deploy 없음.

## 2026-11-01 질문 좌측 고정 + 컨텐츠 가운데 (정렬 최종안)

- 사용자 결정: 중앙 정렬을 시도한 뒤 가독성 기준으로 ‘질문 영역(공간 이름·질문·안내)은 좌측 정렬로 같은 위치, 컨텐츠는 남은 높이의 가운데’로 확정했다. 치우쳐 보이던 원인은 질문의 정렬이 아니라 컨텐츠가 프레임 폭을 채우지 못한 것이었으므로 함께 고쳤다. 같은 날 ‘질문 블록 중앙 정렬’ 기록은 이 안으로 대체한다.
- 수정:
  - `src/styles/tokens.css`: `--stage-frame` 1280 → 1120px(양옆 여백 확대).
  - `src/components/StageHeader.css`: 질문 블록 다시 좌측 정렬.
  - `src/components/StageLayout.css`(+주석 `.tsx`): 프레임을 세로 flex로 두고, 질문 아래 두 열이 프레임 폭을 반씩(1fr/1fr, 간격 96) 채우며 남은 높이의 가운데에 온다. 오브젝트는 자기 열 안에서 가운데.
  - `src/scenes/LightArchiveScene.css`: 사진 미리보기 최대 340px → 열 폭(1440에서 512px, 높이 여유 `100dvh - 344px`로 제한), 썸네일·단어·버튼은 오른쪽 열 전체 폭.
  - `src/scenes/SoundCluesScene.css`: 돔 선반/위치 패드를 질문과 하단 버튼 줄 사이 가운데로(auto margin). 돔 화면만 질문 아래 최소 24px. 위치 화면은 1135×774에서 기존부터 8px 넘치던 것이 이번에 0이 됐다.
- 실측: 1440×900에서 등록·빛·소리·기억 질문 시작 (160,88), 컨텐츠 160–1280. 1135×774에서 (48,88)(기억은 패널 스크롤바 때문에 63). 두 크기 모두 가로 넘침 0, 장면 내부 넘침 0, 버튼 화면 안. 빛: 고르기 → 정하기 → 단어 → 다음 → 변환 → 남기기 → 소리 도착, 소리: 선택 → 위치 화면까지 진행. 390×844 등록 세로 배치/스크롤 후 버튼 확인. 새로고침 Landing 확인. npm run build·git diff --check 통과(기존 500kB 경고).
- 남은 것: 문장 탐색 화면은 Codex가 14:15에 앞선 중앙 정렬에 맞춰 질문을 3열 중 가운데 칸(+오른쪽 단서 상자)으로 옮겨 두어, 지금은 질문이 x=540에서 시작한다. Codex 작업 파일이라 수정하지 않았다(질문을 첫 칸으로 되돌리면 맞음). 기록 레이어는 자체 배치 유지. commit/push 없음.

- 같은 날 후속(사용자 요청 ‘질문 영역이 너무 위, 행간 140–150%’): `--stage-head-offset`(`clamp(0px, (100dvh - 800px) × 0.4, 40px)`)을 질문 블록 위에 더했다. 900px 이상 높이에서 40px 내려가고(1440×900에서 y=88 → 128), 800px 이하에서는 0이다 — 1135×774의 소리 위치 화면과 기억의 방은 남는 높이가 없어서다. 안내 문장 행간 1.7 → 1.5(공간 이름·질문은 이미 1.4). 1440×900·1135×774에서 등록·빛·소리·소리 위치·기억·문장 탐색 모두 넘침 0, 버튼 화면 안. 빌드 통과.

- 같은 날 후속(사용자 승인 ‘네, 맞춰 주세요’): 문장 탐색의 질문을 Codex가 둔 3열 머리 줄의 가운데 칸에서 첫 칸(두 칸 차지)으로 옮기고(`SentenceCluesScene.css` `grid-column: 1 / span 2`), 오른쪽 ‘앞서 고른 단서’ 상자 위에 같은 `--stage-head-offset`을 줘 윗선을 맞췄다. 상자 내용·마크업·Codex의 나머지 규칙은 그대로. 1440×900 질문 (160,158)·상자/공간 이름 윗선 y=128, 1135×774 질문 (48,88)·상자 y=88, 둘 다 넘침 0. 1000폭은 기존대로 상자가 질문 아래로 쌓이고 장면 내부 스크롤. 빌드 통과.

## 2026-11-01 질문 블록 중앙 정렬 (레이아웃 통일 후속)

- 사용자 요청: ‘다 좌측 정렬이라 너무 그냥’ — 질문 블록(공간 이름·질문·안내)을 중앙 정렬로 통일. 같은 날 레이아웃 통일의 공통 프레임/y=88은 유지하고 정렬만 바꿨다.
- 수정: `src/components/StageHeader.css`(질문 블록 가운데 정렬, 안내 문장 블록도 가운데), `src/components/StageLayout.css`(두 열 묶음을 960 폭으로 프레임 가운데에 두고, 오브젝트는 열 안에서 가운데), `StageLayout.tsx`·`tokens.css` 주석. 오른쪽 열의 단계 표시·입력·단어·썸네일·주 버튼은 왼쪽 정렬 그대로.
- 실측: 1440×900에서 등록·빛·소리·기억의 공간 이름/질문/안내 중심이 모두 x=720(화면 중앙), y=89/120/165. 1135×774에서 x=567–568, 390×844 등록에서 x=195. 가로 넘침 0, 1440·1135 장면 내부 넘침 0. 새로고침 후 Landing 확인. npm run build·git diff --check 통과(기존 500kB 번들 경고).
- 미적용: 문장 탐색 화면은 Codex가 14:07에 질문 옆 ‘앞서 고른 단서’ 상자를 추가하는 중이라(SentenceCluesScene.tsx/.css) 파일을 건드리지 않았다. 질문이 왼쪽 칸 안에서 가운데(x≈482)로 보인다. 상자를 질문 아래로 옮기면 화면 중앙에 맞출 수 있다 — 사용자 결정 대기. 기록 레이어는 자체 배치 유지. commit/push 없음.

## 2026-11-01 레이아웃 통일 (질문 위치 고정)

- 사용자 요청: 리뷰 2장 ① ‘레이아웃 5종’ 해결. 장면마다 질문 위치가 (728,267)·(80,88)·(32,80)·(120,177)·(869,88)로 달라 화면이 바뀔 때마다 시선을 다시 찾아야 했다. 상호작용 장면은 하나의 프레임에 두고 질문을 프레임의 왼쪽 위에서 시작한다.
- 규칙: 프레임 `--stage-frame` 1280px, 중앙 정렬, 좌우 최소 여백 `--stage-gutter` 48px, 질문 블록의 y = `--stage-top`(88px). 1440폭에서 x=80, 1135폭에서 x=48. 장면의 오브젝트 형태(사진·조사원증·유리돔·방 선화·문장 카드)는 통일하지 않는다(DESIGN_SYSTEM 3장). 인트로/요약/보고서 장면(문장 도입, 기록 레이어, 카메라 선택, 보고서 한 문장 화면)은 의도적으로 기존 구도를 유지한다.
- 수정 파일:
  - `src/styles/tokens.css`: `--stage-frame`, `--stage-gutter` 추가.
  - `src/components/StageLayout.tsx`, `.css`: 질문(StageHeader)을 오른쪽 열 안에서 꺼내 두 열 위 프레임 전체 폭에 둔다. 세로 가운데 정렬 → 위쪽 정렬, 오브젝트는 질문과 같은 왼쪽 선에 맞춘다. 단계 표시/입력/주 버튼은 오른쪽 열에 그대로. 900px 이하 세로 배치에서는 질문이 오브젝트보다 먼저 온다. 사용처: 등록, 빛(사진·감정 단어).
  - `src/scenes/SoundCluesScene.css`: 좌우 여백 32 → gutter, 최대 폭 1280 → 프레임 토큰(1440 결과 동일).
  - `src/scenes/MemorySketchScene.css`: 위 여백 80 → 88, 좌우 32 → gutter, 작업 폭 상한 1600 → 프레임. 방 크기 계산식은 유지(1440에서 1361 → 1280 폭). 스크롤바 자리를 양쪽에 예약해 프레임이 화면 가운데에 오도록 했다.
  - `src/scenes/SentenceCluesScene.css`: 데스크톱(폭 1100+, 높이 701+)에서 문장 탐색 화면을 세로 가운데 → 위쪽 정렬, 폭 1200 → 프레임. 높이 700 이하와 좁은 화면 규칙은 그대로.
- 실측(브라우저, DEV 이동): 1440×900에서 등록·빛·소리·문장 질문 eyebrow가 모두 (80,88), 기억은 (73→80 보정 후 프레임 중앙). 1135×774에서 등록·빛·소리 (48,88), 문장 제목 (48,88)(이 높이에서는 기존 규칙대로 eyebrow 숨김). 두 크기 모두 가로 넘침 0, 장면 내부 넘침 0. 빛: 사진 고르기 → 이 사진으로 정하기 → 단어 선택 → 다음으로 → 변환 → 이 빛으로 남기기 → 소리 도착까지 진행. 390×844에서 등록 세로 배치·스크롤 후 버튼 접근 확인. 새로고침 후 Landing 확인. npm run build·git diff --check 통과(기존 500kB 번들 경고).
- 의도적으로 남긴 것: 기록 레이어는 3D 스택이 고정 560px이라 질문을 위로 올리면 1135×774에서 넘친다(필요 높이 약 770 > 686). 스택을 다시 축소해야 하므로 이번에는 요약 장면으로 분류해 유지했다. 주 버튼 위치는 ‘읽는 순서의 끝’ 규칙으로 정리했다: 전체 폭 장면(소리·문장)은 프레임 오른쪽 아래, 두 열 장면(등록·빛)은 오른쪽 열 끝, 기억은 오른쪽 사이드 끝. 빛 사진(340px)·썸네일 크기는 바꾸지 않았다(리뷰 P2).
- 한계: 이 브라우저 패널은 고정 스크롤바라 1135폭 기억 장면 질문이 x=63(15px 안쪽)으로 보인다. 오버레이 스크롤바인 macOS 기본 환경에서는 차이가 없다. 빛 장면의 좁은 화면 고르기 단계, 기억 그리기 단계, 모바일 실기기는 다시 보지 않았다. commit/push 없음.

## 2026-11-01 카피 다듬기 (AI 같은 말투 정리)

- 사용자 요청: 시니어 디자이너 리뷰 4장의 카피 피드백 반영. ‘A했지만,⏎B했습니다’ 대구, 문장마다 붙는 유보 표현(“~였을지도 모릅니다”), ‘A가 아니라 B’ 재정의, 추상명사 피동문, 주제문 반복을 줄이고 관찰된 사실을 평이하게 쓴다. 합니다체 유지.
- 수정 파일과 내용:
  - `src/lib/personalFindingInterpretation.ts`: 발견 11종의 headline·interpretation·reflection을 다시 썼다(예: `머뭇거리는 문장을 남겼지만,⏎당신의 선택은 되돌려지지 않았습니다.` → `머뭇거리는 문장을 골랐습니다.⏎정작 당신은 한 번도 답을 바꾸지 않았습니다.`). 각 문장은 기존 evidence/pattern 조건이 뒷받침하는 사실만 말한다. 템플릿 변수·조사 처리·선정 조건·금지어 검증은 그대로이며, QR 요약본도 같은 템플릿을 읽는다.
  - 보고서 흐름: 조사 방식 `무엇을 골랐는지와 함께⏎어떻게 골랐는지도 적었습니다.`, 발견 도입 3종, 공개 앞 문장 `모은 단서를 하나로 맞춰 보았습니다.`, 마무리를 3화면 → 2화면(`고른 답만 남은 것이 아닙니다.…` / `답하지 못한 것도⏎당신의 기록입니다.`).
  - 주제문 반복 제거: `누구를 떠올렸든, 선택의 순간에는 당신이 있었습니다.`는 조사 방식 첫 화면에만 남기고, 문서·QR·인쇄 서두(`RECORD_MEANING`)와 과정 안내(`PROCESS_GUIDE`), 마무리 문구(`RECORD_CLOSING`)를 각기 다른 구체 문장으로 바꿨다. 문서 해석 제목 `고르는 동안 남은 것`.
  - 장면: 엘리베이터 상태 문구와 `기록 열기`, 소리 진입 부제, 소리 위치 질문/설명(시점을 ‘그 사람에게’로 명시), 기억 드로잉 제목·재확인·생략 확인, 문장 빈칸 안내와 하단 중복 안내 → `고른 문장`, 레이어 제목 `지금까지 고른 단서`, 빛 저장 버튼 `이 빛으로 남기기`, 카메라 선택 제목 `마지막 장면을 어떻게 볼까요?`, BACK 한글 `이전으로`, 등록 지침 3번.
- 보존: 카메라 고지 문구와 두 버튼, 일곱 소리 이름, 존 이름(‘흔적’), Landing, 공개 문구 `그 사람을 바라보는 동안, 당신의 흔적이 남았습니다.`, 문장 조각 20개와 이야기 생성 문장, 발견 선정 조건·근거 수치, 버튼 이동 라벨, 장면 순서·저장 로직. 쓰이지 않는 ReportStage01–05/BridgeBeat 카피와 `reportFindingCopy.ts`는 건드리지 않았다. Codex가 작업 중인 `ReportStageFinding.tsx`·`ChoiceReplayPlayer.tsx`는 수정하지 않았다.
- 브라우저(1440×900, DEV): 카메라 선택 → 카메라 없는 공개 → 조사 방식 2화면 → 발견 도입 → 발견 → 마무리 2화면 → 최종 문서 서두/해석까지 새 문구와 줄 수(32px에서 의도하지 않은 줄바꿈 없음)를 확인했다. 문장 하단 `고른 문장`, BACK `이전으로`, 레이어 제목/안내, 등록 지침, 소리 위치 질문 한 줄 표시 확인. 새로고침 후 Landing 확인. npm run build·git diff --check 통과(기존 500kB 번들 경고).
- 미검증: 다른 발견 종류의 화면 줄바꿈(해당 기록을 만들지 않음; 제목은 모두 기존 이하 길이), 엘리베이터 상태 문구 화면, 기억 드로잉/생략 확인 화면, 모바일 QR·인쇄 화면. commit/push 없음.

## 2026-11-01 글자 크기 역할 고정 (P0 타입 정리)

- 사용자 요청: 시니어 디자이너 리뷰의 P0 ‘글자 크기 들쑥날쑥’ 해결. 같은 역할이 화면마다 다른 크기(22/25/26/28/30/34/36px)와 굵기(400/500/600)를 쓰던 것을 역할 5개로 고정했다. 크기를 키우는 작업이 아니며 Landing은 제외한다.
- 역할 토큰(`src/styles/tokens.css`에 추가, 기존 `--type-*`는 그대로): `--type-statement` 32px, `--type-question` 22px(=`--type-title-sm`) + `--weight-question` 500, `--type-label` 13px. 본문은 `--type-body` 16px, Bebas 코드는 `--type-meta` 12px 유지.
- 수정 파일과 내용:
  - Question 22/500: `StageHeader.css`(600→500), `SentenceCluesScene.css`(도입 26px·읽기/빈칸 제목 28·26px·맥락 프롬프트 28/600), `RecordLayerSecondVisitScene.css`(28/600), `LightTransformation.css`, `ReportStage06SubjectReveal.css`의 카메라 선택 제목(vw clamp 최대 30px).
  - Statement 32/400(vw clamp 제거): 실제 쓰이는 보고서 4단계만. `ReportStageFindings.css`의 조사 방식·마무리 문장(최대 25px), 발견 제목(중복 override 3개 → 하나), 마무리 마지막 문장(최대 34px); `ReportStage06SubjectReveal.css`의 공개 앞 문장과 공개 제목(36/500). 640px 이하의 기존 모바일 override는 유지했다. 쓰이지 않는 ReportStage01–05·BridgeBeat CSS는 건드리지 않았다.
  - Label 13px(한글 12px → 13px): StageHeader eyebrow, 등록 단계 표시, BACK 한글, HUD `기록 중`/이름, 존 이름, 공용 `.metric__label`, 소리 이름과 선택 체크, 기억 `남겨둔 흔적`, 레이어 `모은 기록`, 보고서 eyebrow 제목.
  - 등록 지침 목록: vw clamp(1440에서 25px, 질문보다 컸음) → `--type-body-lg` 18px.
  - 최종 문서 `FinalReportDetail.css`: 자체 px 스케일(44/23/22/20/15/14/13/12/11)을 역할로 맞췄다. 제목 2.75rem 고정, 소제목·해석 제목 22/500, 본문·소개·근거 문단 15·14 → 16px, 한글 라벨·메타·캡션·근거 수치 11–13 → 13px.
- 실측(브라우저, DEV 이동): 1440×900에서 등록·빛·소리·기억·문장·레이어·카메라 선택 질문이 모두 22/500, 공개 앞 문장·공개·조사 방식 3화면·발견·마무리 3화면이 모두 32/400. 화면 안 한글 12px 이하는 접힌 `앞 이야기` 내부 외에 없음. 최종 문서는 44/22/16/13 + Bebas 코드로 정리됐다. 1440×900·1135×774 모두 가로 넘침 0, 장면 내부 스크롤 넘침 0, 화면 밖으로 잘린 버튼 0(최종 문서는 원래 스크롤). 소리 이름 13px 한 줄 유지. 새로고침 후 Landing 확인.
- 보존: Landing 전체(자체 vw 크기), Bebas 코드 12px, 문장 카드·복원 기록 본문 크기, 레이어 카드 안 문장, 인쇄 보고서·모바일 QR·카탈로그·DEV 메뉴, 카피, 버튼 스타일, 색, 장면 순서·저장 로직·카메라 처리.
- 동시 작업: 같은 시각 Codex가 `ReportStageFinding.tsx`를 수정 중이었다(선택 재생). tsx와 `ChoiceReplayPlayer.css`, 근거 창 규칙은 건드리지 않았다.
- 미검증: 모바일 QR·인쇄·카메라 사용 경로·640px 이하 화면, 빛 변환 결과와 문장 빈칸/복원 화면은 코드 값만 확인(모두 크기 축소 또는 동일 값). npm run build·git diff --check 통과(기존 500kB 번들 경고). commit/push 없음.

## 2026-11-01 Landing 확정 시안 적용 (글라스 기록 카드 + 분석 라벨 + 스캔)

- 범위: `lab/landing-scan.html`(사용자 확정 시안)을 실제 Landing으로 옮겼다. 새로 디자인하지 않고 시안의 수치·스타일·캔버스 로직을 그대로 가져왔다.
- 수정/추가 파일:
  - `src/scenes/LandingScene.tsx`: 상단 로고/`전시 소개`, 좌측 타이핑 제목·안내·시작 안내, 화면 클릭과 Enter 입장(드래그 6px 초과와 `전시 소개` 제외), 터치 기기 안내와 `링크 복사`/`그래도 계속 보기`, 숨은 MemoryField 유지.
  - `src/scenes/LandingScene.css`: Landing 전용 뷰포트 비례 스케일로 재작성. 로고 `clamp(110px, 8.4vw, 190px)`, `전시 소개` 높이 `clamp(34px, 2.5vw, 54px)`, 텍스트 묶음 `left: max(48px, 7vw)` / `top: 51%` / `translateY(-46%)` / 너비 30vw, 제목 weight 450 `clamp(32px, 3.3vw, 76px)` 행간 1.28 자간 -0.035em, 커서 `#AA8EEE` 1.05초 점멸, `CLICK ANYWHERE TO BEGIN`은 Bebas에 28px trace 선과 2.8초 호흡.
  - `src/components/LandingRecordCard.tsx`, `.css`(신규): 유리 카드(`perspective(2200px) rotateX(5deg) rotateY(-13deg) rotateZ(0.6deg)`, 포인터 ±3°/±2°, 보간 0.06), 두께 층 6장(`translateZ(-3…-18px)`), `backdrop-filter: blur(24px)` 앞면과 하이라이트/반사, 사진 캔버스(상단 크롭 -0.07·머리 위 여백은 원본 상단 행을 늘려 채움·가장자리 마스크 좌우 16%/위 20%/아래 18%), 캡션 `UNKNOWN RECORD`/`SCAN 000`, 뒤의 잔상 62vh blur 42px .42·보라 빛 64vh·겹친 기록 2장(+3.8vh/+7.2vh)과 포인터 반대 방향 패럴랙스, 스캔 루프(대기 1.8초·스윕 3.6초·휴지 5.6초, 신호색 `#9FB2F2` 선과 잔광, 3px 조각 사인파 어긋남과 입자 점등), 분석 라벨 4개.
- 분석 라벨: 카드 안 앵커를 매 프레임 `getBoundingClientRect`로 화면에 투영하고 글자 자체는 기울이지 않는다. NAME(0.42, 0.23 일자), FACE(0.60, 0.38 `h:0.16 v:-0.11`), CLUES(0.20, 0.61 `v:-0.24`), STATUS(0.68, 0.73 `h:0.10 v:0.08`). 평상시 투명도 .62/블러 .2px, 호버 시 해당 라벨만 선명해지고 선·조준점이 신호색으로 바뀌며 값이 480ms 동안 제자리를 찾는다. 포인터는 기울어진 캔버스의 `offsetX/offsetY` 로컬 좌표를 쓴다.
- 보존: `handleEnter`→`completeScene('landing')`, 입장 시 `activateFilmSound()`, MemoryField의 숨은 필드와 `startEntryRef`의 1.3초 입장 타이밍(새 대기 시간 없음), `enteredAt`(첫 방문만)/`timeToEnterMs`/`figureDwellMs`(기준 영역을 새 글라스 카드로 이동)/`cursorTravelPx`/`bounced`, venue 모드 `전시 소개` 숨김, 움직임 줄이기 경로, 새로고침 Landing, `unknown-presence-v3.jpg`와 최신 `wordmark.svg`. `LandingPortrait.tsx`는 Landing에서 쓰지 않지만 삭제하지 않았다. 다른 장면·`tokens.css`/`global.css`·공용 Primary·장면 순서·store·카메라·보고서·QR 모바일 요약본은 변경 없음.
- 실제 브라우저 검증(localhost:5199/unanswered/, Claude 브라우저 패널):
  - 크기: 2240×1260 / 1440×900 / 1280×720에서 시안과 나란히 비교했다. 세 크기 모두 가로·세로 넘침 0. 제목 실측 73.92 / 47.52 / 42.24px(= 3.3vw), weight 450, 커서 배경 `rgb(170, 142, 238)`. 2240에서 텍스트 묶음 오른쪽 끝 829px와 좌측 라벨 시작 970px, 1280에서 474px와 530px로 겹침 없음. 1115×719(패널 기본 크기)에서 시안과 실제 Landing의 배치·라벨·카드가 일치함을 스크린샷으로 확인했다.
  - 라벨: 네 고정점에 차례로 포인터를 올려 각각 해당 라벨만 `is-on`이 되고 선/조준점이 신호색으로 바뀌며 값이 섞였다 제자리를 찾는 것을 확인했다(캡처 시점 `UNK7GV/`→`UNKNOWN`). 사진 위에서 벗어나면 네 개 모두 해제된다. 스캔 루프 동안 제목·안내·라벨은 반짝이지 않는다(반짝이는 것은 사진의 스캔 선과 커서 점멸, 시작 안내 호흡뿐). 포인터 기울기 `--rx`/`--ry` 갱신 확인.
  - 입장: 빈 곳 클릭 → 카드가 흐려지며 빛으로 풀림(380ms 중간 프레임 확인) → ZONE 01 Elevator Entry 3F 도착. Enter 키 입장 동일. `pointerdown`과 60px 떨어진 클릭(드래그)으로는 입장하지 않음. `전시 소개` 클릭은 `/unanswered/catalog/` 웹도록으로 이동하고 입장하지 않음.
  - 접근성: Tab 1회 `전시 소개`, 2회 시작 안내 버튼으로 이동하고 시작 안내에 `2px solid rgb(159,178,242)` / offset 6px 초점 링이 보인다.
  - 기타: 새로고침·새 탭 모두 Landing에서 시작. `?venue=1`에서 `전시 소개` 없음, 넘침 0. 375×812 터치 에뮬레이션에서 `(hover: none) and (pointer: coarse)` 일치, 시작 안내 대신 PC 권장 문구·`링크 복사`·`그래도 계속 보기`가 보이고 넘침 0. 카드 탭으로는 입장하지 않고 `그래도 계속 보기`로만 엘리베이터에 도착했다. `링크 복사`는 클립보드 성공 시 `링크를 복사했습니다`로 바뀌고, 클립보드를 강제로 거부시키면 주소가 표시되며 자동 선택된다. `/unanswered/#/r/...` QR 보고서 경로는 Landing이 아닌 기존 모바일 보고서로 유지된다.
- 검증 한계: 움직임 줄이기(`prefers-reduced-motion: reduce`)는 브라우저 패널에서 OS 설정을 에뮬레이션할 수 없어 코드 경로와 CSS 블록 검토로만 확인했다(타이핑 생략·스캔/기울기/점멸/호흡 정지·입장은 0.18s 페이드). 실제 iMac 24" 부스 화면, 실제 터치 기기, 인트로 이후 전체 동선은 이번에 재검증하지 않았다. 좁은 화면(860px 이하)에서는 고정점에서 뻗는 분석 라벨을 숨기고 카드를 중앙으로 옮기는 별도 배치를 쓴다.
- npm run build(tsc 포함)·git diff --check·oxlint 통과. 기존 500kB 초과 번들 경고만 유지(`lab/`의 기존 미사용 변수 경고도 그대로). 기존 미커밋 변경(EXHIBITION_FEEDBACK.md, UI_IMMERSION_REVIEW.md, wordmark.svg)과 미추적 파일(`_loop_work/`, `Claude outputs/`, `docs/DESIGN_SYSTEM.md`, `lab/landing-*.html`, `src/assets/archive.zip`) 보존. commit·push·deploy 없음.

## 2026-10-18 UI 마감 및 단어 호버/선택 구분

- 사용자 요청으로 앞선 검토의 우선 항목 5개와 빛의 단어 선택 상태를 수정했다. 기존 확정 기준과 실행 기록은 보존한다. 선택 수·단서 ID·보고서 생성 조건·원시 수치·장면 순서와 카메라 처리에는 변경이 없다.
- 수정 파일과 내용:
  - src/scenes/LightArchiveScene.css, .tsx: 미선택 호버는 중립색 배경/테두리, 선택은 보라색 면·빛·체크로 구분한다. 호버가 선택 스타일을 덮지 않도록 선택 제외 조건을 지정하고 aria-pressed/단어 이름 및 별도 키보드 초점을 제공한다.
  - src/components/MemoryRoom.css: 기존 호버 채움/물건 이름과 함께 얇은 윤곽을 표시한다. 선택한 사물의 채움/번호는 보존한다.
  - src/scenes/MemorySketchScene.css: 굵기 버튼 여백/간격/줄바꿈과 선 견본 수축을 조정해 ‘가늘게’를 한 줄로 표시한다.
  - src/scenes/report/ReportStage06SubjectReveal.tsx: 실제 이름 공개 전 임시 텍스트를 ‘이름 없음’에서 ‘—’로 바꾼다. 이름 없는 DEV 방문의 공개 후 대체 표시는 ‘당신’이다. 공개 타이밍/카메라 처리는 유지한다.
  - src/scenes/report/FinalReportDetail.tsx, .css: 모든 근거를 열린 상태로 유지하면서 장면명과 관찰/수치를 행으로 정렬하고 반복 세로 여백을 줄인다. 사진·문장·실제 그림·QR 및 인쇄 경로는 보존한다.
  - src/scenes/report/ReportStageFindings.css: 근거 창 머리글/닫기를 내부 스크롤 중에도 고정한다. 기존 초점 제한/Escape 복귀는 유지한다.
  - src/lib/personalFindingInterpretation.ts, src/lib/personalFindings.ts: after-heavy의 ‘한동안/확인’ 해석을 관찰 가능한 시간·조작으로 한정한다. 읽기/조작 시간 포함과 이유를 알 수 없다는 한계를 해설에 표시한다. 선정 조건·임계값·수치에는 변경이 없다.
- 실제 브라우저 검증(1135×774, localhost:5173/unanswered/): Landing 확인→DEV 빛 진입→사진 선택→단어 선택/해제/0개 다음 비활성/Tab·Space 선택/2개 선택→변환 저장→소리 재생·위치→기억 책·사진 선택/사진 해제·재선택/드로잉 한 선 저장→문장 3개·빈칸 남기기→레이어→카메라 없는 공개→조사 방식→발견 근거 열기/스크롤/Escape 초점 복귀→마무리→상세 보고서/하단 QR·버튼 접근→재시작/새로고침 Landing 확인.
- 호버 스타일 실측: 미선택은 rgba(255,255,255,.04)/중립색 테두리, 선택 중 호버는 rgba(170,149,233,.14)/rgb(171,147,255) 테두리와 빛/체크를 유지했다. 키보드 초점과 선택도 동시에 표시된다. 드로잉 라벨 한 줄과 기억 호버 윤곽/물건 이름을 시각 확인했다.
- 보고서: 실제 생성된 근거 5행이 모두 표시되며 목록 높이 약 400px, details 0개, 페이지 가로 넘침 없음. 실제 원문/측정값/단서가 남아 있다. 근거 창 스크롤 하단에서도 닫기 버튼 접근과 Escape 후 원래 버튼 초점 복귀 확인. 공개 시작의 NAME —와 이름 없는 DEV 경로의 NAME 당신 확인.
- 검증 한계: 이번에는 DEV에서 빛으로 진입했으므로 인트로 전체/신규 등록부터의 연속 검증이 아니다. 이번 방문은 no-convergence 해석이 생성되었으며 after-heavy 새 문구는 코드/타입 검사로 확인했다. 카메라 사용·실제 휴대폰 QR 스캔·인쇄·전시 모니터와 터치 기기는 재실측하지 않았다.
- 캡처: /tmp/unanswered-ui-fixes/keywords.jpg, drawing.jpg, evidence-dialog.jpg, report.jpg. 기존 5173 서버를 사용했고 중복 시작된 임시 5175 서버만 종료했다. 기존 미추적 원본 2개 보존, commit/push/deploy 없음.
- 최종 npm run build 및 git diff --check 통과. 기존 500kB 초과 번들 경고만 유지. git diff --stat/status 확인: 제품 10개/문서 2개 수정, 기존 미추적 2개 보존.

2026-10-06. 사용자가 UI 상세 검토, 쉬운 카피, 중간 영상 판단 및 수정, 약 5분(여유 있게 7–8분) 관람을 요청했다. EXHIBITION_FEEDBACK.md의 원래 평가는 보존하고 이번 요청을 별도 기준으로 추가한다. 이후 관련 수정 전에 두 문서를 확인한다.

## 시니어 웹디자이너 관점의 평가

### 1. 랜딩: 입자 인물을 주인공으로, 입장은 하나의 행동으로

현재 검은 공간, 왼쪽 제목, 오른쪽 입자 인물은 전시의 입구로 적절하다. 여백은 빈 공간이 아니라 아직 알 수 없는 사람을 바라보는 시간이다. 카드, 설명 섹션, 큰 배경 영상, 장식적인 스크롤 효과를 추가하면 인물의 집중력이 줄어든다.

데스크톱에서는 왼쪽 약 40%를 제목·짧은 안내·시작 버튼에, 오른쪽 약 60%를 인물에 사용한다. 제목은 두 줄을 유지하고 설명은 한 문장으로 줄인다. 로고는 작품명이고 제목은 사건의 시작이다. 관람 시간은 버튼 아래 작은 보조 정보로 둔다. 전시 소개는 상단의 보조 링크로 유지한다.

인터랙션은 기존 입자의 흩어짐·복원·수직선 압축을 중심으로 한다. 시작 버튼의 hover/focus에서도 인물과 공간이 조용히 반응하도록 연결하면 글과 작품이 같은 입구로 느껴진다. 키보드 사용자도 같은 시각 피드백을 받는다. 모바일은 포인터 탐색을 요구하지 않고 터치 가능한 시작 버튼을 중심으로 제목 위계와 인물의 존재감을 유지한다. 멀미를 유발할 수 있는 전체 화면 이동, 자동 사운드, 커서를 쫓는 큰 텍스트는 추가하지 않는다.

### 2. 화면의 말: 한 질문과 한 행동 안내

긴 질문은 관객에게 해석 과제를 준다. 제목은 관객이 상상할 대상, 설명은 지금 할 행동을 알려야 한다. 사진→소리→물건→문장 순으로 상상 대상은 같고 행동만 바뀐다는 점을 짧게 유지한다. ‘수집·복원·레이어·미응답’ 같은 말이 같은 화면에서 반복되면 작품보다 시스템을 읽게 된다. 화면에는 ‘고르기·그리기·빈칸·모은 기록’처럼 익숙한 말을 우선한다.

문장 장면의 20개 문장은 작품의 재료이므로 일괄 삭제하지 않는다. 대신 앞 이야기와 색/소리/사물 요약을 동시에 길게 펼치지 않는다. 짧은 연결 문장만 우선 보여 주고 앞 이야기는 원할 때 펼쳐 읽도록 한다. 문장 비교 안내도 5개 개념의 나열보다 ‘이어질 이야기 3–5개’라는 한 행동으로 줄인다. 이야기 미리보기는 유지한다.

등록 후 입력 폼을 다시 읽게 하지 않도록 발급 완료 상태에서는 카드와 짧은 지침, 시작 버튼에 집중한다. 카메라의 확정 고지는 정확한 설명이 필요하므로 축약하지 않는다. 보고서의 행동 근거도 상세 보기 안에 유지한다.

### 3. 중간 영상: 관람과 참여의 반복 전환을 제거

인트로는 상황과 역할을 소개하므로 유지한다. 이후 영상은 새로운 선택을 만들지 않고 매 장면 ‘재생→제목→작품’을 반복한다. 이미 참여한 관객이 수동 관람 상태로 되돌아가고, 모바일에서는 재생 실패·음향 전환까지 신경 쓰게 된다. 현재 짧게 자른 영상도 제목 대기와 합치면 약 4초가 여러 번 누적된다. 최종 보고서 전 영상도 공개 장면과 기능이 겹친다.

따라서 중간 진입 영상은 모두 생략한다. 파일은 삭제하지 않고 기존 none 모드를 사용한다. 계단 경유 상태와 장면별 보관/기록 로직은 유지한다. 선택한 사진이 빛으로 변하는 8.4초 연출, 소리 청취, 사물 선택, 그리기, 기록의 펼쳐짐, 최종 공개는 관객 행동의 결과이므로 유지한다.

### 4. 관람 시간: 기다림을 줄이고 읽을 속도를 돌려준다

약 5분은 설계 목표이며 자동 퇴장 시간은 아니다. 7–8분 이후 강제로 넘어가면 그리기나 자기 글을 남기는 관객의 기록이 손상된다. 화면에 카운트다운을 두는 것도 이번 작품의 감상 방식과 충돌한다.

목표 배분(초): 입장·엘리베이터·인트로·등록 65 / 빛 40 / 소리 35 / 기억 40 / 문장 65 / 모은 기록·공개·보고서 55 = 약 300초. 각 구간 10–20초씩 더 탐색하면 약 7분이며 긴 자유 그리기·읽기는 8분을 넘길 수 있다. 실제 첫 관객의 시간은 별도 관찰로 확인해야 한다.

중간 영상 대기를 제거하고, 보고서 글을 읽고 나면 다음으로 갈 수 있게 한다. 시간으로 잠긴 애니메이션은 핵심 공개만 유지하고 텍스트 해설·근거·마무리는 관객의 읽기 속도를 우선한다. 문장 질문을 찾는 과정의 과도한 최소 대기도 줄인다. 기존 선택 규칙과 문장/드로잉 생략 경로는 유지한다.

## 구현 범위와 보존 사항

- Landing의 카피·보조 시간 안내·버튼 반응 및 모바일 배치.
- 장면 진입 영상 설정, 쉬운 질문/행동 안내, 문장 앞 이야기 접기, 발급 후 폼 정리, 보고서 다음 버튼의 불필요한 대기 제거.
- 기존 입자 시뮬레이션, Landing→엘리베이터→인트로→등록 순서, 선택 ID/개수, 일곱 소리, 저장 자료, 카메라 고지와 안전 처리 보존.
- 이번 사용자 요청은 앞 문서의 ‘Landing·영상 유지’ 범위를 명시적으로 변경한다. 인트로와 선택 반응 연출은 보존한다.

## 검증 및 실행 기록

- 2026-11-01 랜딩 구도 2안 비교: 사용자의 ‘해봐’ 요청은 앞서 제안한 두 시안 제작으로 해석했다. 실제 LandingScene와 전시 동선은 추가 변경하지 않고 별도 lab/landing-directions.html 및 대화 내 캐러셀로 제작했다. 같은 원본 로고·unknown-presence-v3를 재사용하고, 포스터는 작은 한글 제목+인물 위 큰 하단 로고, 갤러리는 중앙 인물+하단 좌측 제목/우측 입장으로 구성한다. 두 시안의 입장/전시 소개 버튼은 시안 안에서만 안내 화면을 보여 주며 실제 조사 기록·음향·카메라·장면 저장을 실행하지 않는다. 최종 채택/실제 전시 적용은 아직 하지 않았다.
  - 브라우저: 기본 1280×720의 별도 미리보기에서 두 안의 전환, 포스터 버튼과 큰 로고 사이 31px 간격, 입장 안내와 복귀를 확인했다. 작은 화면은 외부 폭 352px/시안 폭 320px에서 두 안의 제목·안내·버튼·하단 접근과 갤러리 documentWidth=320 및 주요 요소의 좌우 경계를 확인했다. 포스터 인물의 장식 영역은 의도적으로 잘라 보이며 주요 콘텐츠는 화면 안에 남는다. 검증 후 임시 화면 크기 복구. 실제 전시장 기기/전체 조사 동선은 시안에서 검증하지 않았다.
  - npm run build 통과(기존 500kB 번들 경고), git diff --check/stat/status 확인. 기존 미커밋 CSS/로고/문서와 미추적 원본 보존. commit/push/deploy 없음. 별도 미리보기는 Vite 개발 전용이며 배포 입력에 추가하지 않았다.

- 2026-11-01 제목 축소 후속: 사용자가 현재 랜딩이 덜 트렌디하며 제목이 너무 크다고 지적했다. LandingScene.css에서 제목을 32–48px/400/행간 1.4/자간 -0.04em으로 바꾸고 텍스트 시작을 35dvh로 조정했다. 모바일 26–36px/낮은 PC 창 30–40px, 안내·버튼 14px, 버튼 최소 폭 176px·높이 52px로 비례를 맞췄다. 카피/최신 로고/인물·입자/장면 흐름/기록/전역 스타일과 이전 미커밋 작업은 유지한다. 디자인 시스템 문서에 후속 사용자 결정으로 추가했다.
  - 브라우저 1280×720: 제목 42.24px/400/두 줄 높이 118.25px(기존 56.32px/500/144.16px), 버튼 176×52px, 장면 scrollWidth=1280/scrollHeight=720으로 넘침 없음 확인. Tab 초점→Enter→엘리베이터 도착 및 새로고침 후 Landing 확인. 작은 화면·터치·현장 기기·인트로 이후 전 동선은 새로 실측하지 않았다. 캡처 /tmp/unanswered-landing-polish/landing-v2.png.
  - npm run build 통과(기존 큰 번들 경고), git diff --check·diff --stat·status 확인. 미리보기 서버 보존, commit/push/deploy 없음.

- 2026-11-01 Landing 소폭 마감: 사용자 요청에 따라 Figma Logo 501:99 디자인 컨텍스트/이미지와 SVG를 확인해 언더바 없는 최신 로고를 반영했다. SVG 바깥 여백만 줄여 글자의 비례를 유지했다. LandingScene.css에서 로고/전시 소개의 상단/바깥 정렬, 제목 행간 1.2→1.28과 시작 33→32dvh, 입장 버튼 최소 폭 208px/위 간격 32px/중립색 밑줄과 trace hover·focus/화살표 반응, 관람 시간 앞의 중립선 및 의미별 텍스트 토큰을 적용했다. 모바일 기존 배치 규칙은 유지한다.
  - 보존: LandingScene.tsx와 LandingPortrait/MemoryField는 수정하지 않았다. 제목 크기·문구·인물 크기/위치·얼굴 탐색·중앙 이동 후 해체·기록/타이밍·엘리베이터/인트로/편지/등록 흐름 및 다른 장면/공용 Primary를 보존한다. 기존 미커밋 문서와 _loop_work/·Claude 작업 시트·archive.zip을 보존한다.
  - 브라우저: 실행 중인 5173 서버가 없어 사용자 승인으로 127.0.0.1:5173 미리보기를 시작했다. 1280×720에서 로고 로딩/언더바 없음·제목/버튼/시간 안내 정렬, 장면 scrollHeight=720으로 세로 넘침 없음, Tab 초점 및 밝기 반응, Enter→ZONE 01 엘리베이터 도착, 새로고침 Landing 확인. 얼굴 부근 클릭은 Landing 유지, 얼굴 바깥 인물 클릭은 입장 전환을 확인했다. 작은 화면/실제 터치·OS 움직임 줄이기·인트로 이후 전체 동선은 재실측하지 않았다.
  - 검증: npm run build 통과(기존 500kB 초과 번들 경고), git diff --check 및 최종 diff/stat/status 확인. 캡처 /tmp/unanswered-landing-polish/landing.png, 빌드 로그 build.log. 로컬 미리보기는 열어 둔다. commit/push/deploy 없음.

- 2026-10-31 디자인 시스템 문서 작성: 사용자의 최종 전시 흐름/UI 수정 준비 요청에 따라 [docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md)를 추가했다. Figma 파일 R8fduIQ6rCypnW6KK5qdCA의 전시디자인(129:275) 구조와 BX의 Visual DNA(153:190), Color(153:161), Typography(146:161), Interaction(173:161) 디자인 컨텍스트/이미지를 확인했다. 전시디자인의 제품 비교 프레임(703:96)은 응답 지연으로 중단하고 BX의 작은 보드 단위로 확인했다. 전체 Figma 검수를 완료한 것은 아니다.
  - 확인: UNKNOWN RECORD → YOUR TRACE, 네 시각 원칙과 IDLE/DWELL/SELECT/DRAW 의미, Screen/Print 색상 역할, Bebas Neue/Pretendard 역할. 현재 웹의 중성 배경·trace #AB93FF·12/16/18/22/28/48px 토큰·유리 Primary 및 2026-10-18 복귀 결정을 대조했다. Figma 본문색의 표기 #F2EEFF/바인딩 #E4DFF6 차이와 웹 팔레트 차이를 결정 대기 항목으로 남겼다.
  - 보존: 제품 코드·기존 docs/DESIGN.md·기준 문서의 확정 평가, Landing/인트로/편지/등록 동선·선택 조건·기록·카메라·일곱 소리·QR·인쇄. 기존 미추적 Claude outputs/_catalog-sheets/, _loop_work/, src/assets/archive.zip은 수정하지 않았다.
  - 검증: npm run build 통과(기존 500kB 초과 번들 경고), git diff --check 통과, git diff --stat/status 확인. 문서 작업이므로 브라우저 상호작용을 새로 실행하지 않았다. 실제 화면·현장 모니터·카메라 실기기·신규 관객 시간은 최종 UI 변경 시 별도 검증한다. commit/push/deploy 없음.

- 2026-10-07 PC 중심 잔여 수정 확정: 사용자가 모바일 전시 체험 최적화는 제외하고 전시용 PC, 보고서 읽기 제어/근거 창 초점, QR 모바일 보고서에 집중하도록 승인했다. 조사 방식과 마무리의 자동 문장 교체를 관객의 버튼 진행으로 변경한다. 근거 창은 열리는 동안 배경 조작을 막고 Tab/Shift+Tab 초점을 창 안에 유지하며 Escape/닫기 후 원래 버튼으로 복귀한다. 기존 공개 연출·기록·보고서 내용/장면 순서를 보존한다. QR 보고서는 작은 화면의 실제 렌더를 확인한다. 5분 관람은 사람 대상 실측 없이 완료로 표시하지 않는다.
- PC 잔여 수정 검증 완료: 조사 방식/마무리의 수동 진행과 문장 유지, 근거 창 Tab/Shift+Tab 제한 및 Escape/닫기 후 복귀, 최종 요약본까지 연결, 새로고침 후 랜딩을 확인했다. 실제 생성 QR을 디코딩한 링크로 390×844 보고서 렌더/하단 접근 확인. DEV 예시의 빛 규칙이 사진 캐시와 다른 검증 한계 및 실제 기기/러닝 타임 실측 미완료는 UX_UI_AUDIT_2026-10-07.md에 기록. 빌드와 diff 검사 통과. 모바일 전시 배치·카메라 공개 연출·일곱 소리·기록 구조는 보존, 추가 commit/push/deploy 없음.

- 2026-10-07 UX/UI 누락 재점검: 배포 커밋 78917ba 기준으로 주요 피드백 구현과 전시 동선을 다시 확인했다. 상세 결과는 [UX_UI_AUDIT_2026-10-07.md](./UX_UI_AUDIT_2026-10-07.md). 핵심 구현은 반영됐지만 관객 러닝 타임/실제 휴대폰/카메라 사용 경로는 검증 완료가 아니며, 설명 문장의 자동 교체·모바일 고정 표시와 콘텐츠 겹침·근거 창 키보드 초점 이탈을 잔여 과제로 기록했다. 이번 작업은 검토/MD 기록만 수행하며 제품 코드는 수정하지 않는다.

- 2026-10-07 릴리스 요청: 사용자가 현재까지의 커밋·푸시·배포를 명시적으로 요청했다. 현재 phase1-foundation 브랜치의 전시 개선, 보고서 및 전시 소개 구현/웹 자산과 피드백 기록을 함께 커밋한다. 실행에서 참조하지 않는 원본 `src/assets/archive.zip`과 `Claude outputs/_catalog-sheets/`는 로컬에 보존한다. GitHub Pages의 기존 gh-pages 배포 설정과 `/unanswered/` 경로를 사용한다. 릴리스 전 npm run build / git diff --check 통과(기존 큰 번들 경고 유지). 배포 완료 여부는 공개 사이트에서 별도로 확인한다.

- 2026-10-07 중앙 이동 후 해체 요청: 사용자가 인물을 화면 가운데로 옮긴 후 흩어지고 입자는 더 작고 많아지기를 요청했다. 입장 전환의 첫 0.45초는 인물의 크기·비례를 유지하며 가로 중앙으로 이동하고, 이후 0.8초 동안 더 촘촘한 미세 입자로 해체한다. 기존 1.3초 입장 완료 타이밍 안에서 순서를 배분해 추가 대기는 만들지 않는다. 얼굴 탐색·카피·기록·엘리베이터 흐름은 보존한다. 움직임 줄이기에서는 중앙 이동과 입자 이동을 생략한다. 수정 범위: LandingPortrait, LandingScene.css 및 이 기록.
- 중앙 이동/미세 입자 구현·검증: 사진과 입자 캔버스를 함께 가로 중앙으로 이동하고 0.45초 후 사진 페이드와 입자 해체를 시작한다. 입자 상한 480→2,400개, 반경 0.7–1.8→0.3–0.75px. 제목 가독성용 어두운 오버레이도 이동 중 서서히 걷어 중앙의 인물을 가리지 않게 했다. 1440×900에서 사진 클릭 후 중앙 이동과 엘리베이터 연결, 시작 버튼 전환 중 촘촘한 입자 화면 확인. 이동 말미 인물 중심 x≈722px, 폭≈760px로 크기 변화 없음. 390×844에서는 머리 클릭 후 랜딩 유지, 시작 버튼 이후 중심 x≈195px와 미세 입자, 엘리베이터 ‘발견된 기록 열기’ 도착 확인. 화면 크기 복구 및 새로고침 후 랜딩 확인. npm run build / git diff --check 통과(기존 큰 번들 경고 유지). 실제 터치 기기 및 OS 움직임 줄이기 설정은 실측하지 않았다. 기존 미커밋 변경 보존, commit/push 없음.

- 2026-10-07 입장 전환 방향 변경: 사용자가 사진의 세로 압축을 어색하게 느끼며 빛 입자로 흩어지는 방향에 동의했다. 사진 크기와 위치를 유지한 채 머리·어깨의 빛이 가까운 거리에서 풀리고, 인물이 안개처럼 옅어진 뒤 엘리베이터로 이어지게 한다. 폭발·빠른 비산·새 대기 시간은 추가하지 않는다. 기존 입장 콜백/기록/엘리베이터 흐름은 보존하고, 움직임 줄이기에서는 짧은 페이드만 사용한다. 수정 범위: LandingPortrait, LandingScene TSX/CSS 및 이 기록.
- 입장 해체 구현·검증: 사진은 1.1초 동안 제자리에서 흐려지며 사라지고, 사진의 밝은 부분에서 샘플링한 최대 480개 빛 입자가 가까운 거리로 천천히 퍼지고 올라가며 1.2초 안에 소멸한다. 랜딩의 GPU 세로 선은 숨기되 기존 시작/완료 콜백과 시간·체류 기록은 보존했다. 움직임 줄이기는 입자 이동 없이 0.18초 페이드(코드 확인, OS 설정 실측 없음). 1440×900 사진 클릭 전환 중 화면에서 폭 압축 없는 인물/입자를 확인하고 엘리베이터 도착을 확인했다. 390×844 시작 버튼도 엘리베이터 ‘발견된 기록 열기’까지 연결. 작은 화면은 마우스 클릭 검증이며 실제 터치 기기는 사용하지 않았다. npm run build / git diff --check 통과, 기존 큰 번들 경고 유지. 기존 미커밋 작업 보존, commit/push 없음.

- 2026-10-07 미지의 사람 방향 확정: 사용자가 사실적인 여성 초상의 특정성을 지적하고 ‘반투명한 재질 너머의 아직 완성되지 않은 흔적’ 제안에 동의했다. 머리/어깨의 자연스러운 비례만 남기고 얼굴·헤어스타일·옷·성별 단서를 읽을 수 없게 한다. 윤곽 일부는 배경에 녹아들고 작은 빛/입자만 남긴다. 건드릴 때는 얼굴을 공개하지 않고 흐릿한 흔적이 잠깐 모였다가 풀린다. 새 이미지 v3와 LandingPortrait/CSS만 수정하고 제목·카피·입장/기록/다른 장면과 기존 이미지들은 보존한다.
- v3 구현: 기존 여성 이미지의 단서를 그대로 가져오지 않도록 built-in image_gen으로 새로운 사진적 확산 이미지를 생성했다. 자산 `src/assets/landing/unknown-presence-v3.jpg`. 부드러운 회보라빛 머리/어깨 흔적과 반투명 재질만 남기고, 이미지 가장자리도 배경에 녹도록 마스크를 조정했다. 탐색 범위와 입자는 머리 흔적 전체에 연결했다. 입자는 포인터 근처로 잠깐 모이며 입력이 멈추면 원래 흐릿한 분포로 돌아온다. 사진 자체는 이미 흐려진 원본만 사용하므로 얼굴이 공개되지 않는다. 원본 v1/v2 보존.
- v3 검증: 1440×900 및 390×844에서 인물 흔적·가장자리의 배경 연결·글 가독성 확인. 데스크톱 머리 영역 클릭/드래그와 작은 화면의 머리 클릭은 Landing 유지, 머리 바깥 클릭 및 작은 화면 시작 버튼은 엘리베이터의 ‘발견된 기록 열기’까지 연결됐다. 새로고침 후 Landing 확인. npm run build / git diff --check 통과(기존 큰 번들 경고 유지). 기존 미커밋 변경 보존, commit/push 없음. 실제 터치 기기 및 관객의 감정 반응은 실측하지 않았다.
- v3 제작 프롬프트(built-in image_gen, imagegen 스킬, CLI 없음):

```text
Create a finished text-free photographic artwork for an interactive art exhibition, portrait orientation 1024x1536. An unknown human presence seen through a thick translucent matte frosted material in a dark charcoal space. Only a naturally proportioned blurred head and broad relaxed shoulders can be sensed. NOT a portrait of a recognisable individual: no discernible eyes, nose, mouth, ears, hair strands, hairstyle, clothing neckline, garment texture, skin details, age, gender or ethnicity. The entire presence is diffused by the material; soft overlapping grey-lavender light traces suggest a head and torso without a complete closed outline. Head centered at x50%, head top around y14%, head lower edge around y40%, shoulders loosely occupy y46%-67%, fade into background below. One fragment of the head edge and one shoulder briefly catch a delicate pale light, the other edges dissolve completely. Gently luminous diffuse human trace, not a dark ominous silhouette. Contemporary fine-art photographic study of memory and absence, real optical diffusion and delicate material grain; contemplative, quiet, inviting curiosity. Restrained grey-lavender, neutral silver, charcoal and near-black #040406 edges. Low-to-medium contrast, ample dark space around the subject, absolutely no saturated neon. Subject is behind the translucent material, never touching it. NO hands, no face pressed on glass, no horror, ghost, hooded figure, threatening shadows, eye sockets, mannequin, faceless 3D statue, geometric icon, smooth plastic, censor bars, horizontal glitch band, text, borders, frame, gallery room, other objects. Image contains only the incomplete diffuse human presence and subtle frosted optical texture.
```

- 2026-10-07 긴장감 완화 요청: 사용자가 큰 가려진 얼굴의 무서운 인상을 낮추는 제안에 동의했다. 기존 초상을 바탕으로 눈 주변만 부드럽게 흐리고 입/턱은 자연스럽게 드러내며, 조명을 회보라로 낮추고 목의 강한 명암을 완화한다. 초상 크기는 약 12% 줄이고 어깨/주변 여백을 더 보여 준다. 임의로 빠르게 튀는 사진 조각은 천천히 밀렸다 복원되는 연속 물결로 조정한다. 앞서 줄인 제목과 원본 자산, 얼굴 탐색/입장 구분, 다음 장면/기록 상태는 유지한다. 수정 범위는 새 초상 이미지, LandingPortrait, LandingScene.css, 이 문서다.
- 긴장감 완화 구현: 기존 v1을 보존하고 imagegen의 built-in image_gen으로 수정한 `src/assets/landing/anonymous-portrait-v2.jpg`를 추가했다. 얼굴/목의 채도·명암을 낮추고 입과 턱은 드러내며 눈 주변의 흐림만 남겼다. 초상 폭은 데스크톱 60vw→52.8vw, 모바일 150vw→132vw로 줄이고 중심 위치는 유지했다. 얼굴 탐색 범위와 입자를 눈 주변으로 좁혔다. 무작위 72px 가로 어긋남/16px 세로 진동을 연속적인 최대 14px 가로 물결/2.5px 세로 물결로 바꾸고 반응과 복원을 천천히 만들었다. 제목·카피·입장 동선·원본 이미지 보존.
- 긴장감 완화 검증: 1440×900, 390×844에서 초상의 여백·색·입/턱과 안내 글 가독성 확인. 데스크톱 눈 주변 클릭/드래그 및 작은 화면의 눈 주변 클릭은 Landing 유지, 얼굴 바깥 클릭 및 모바일 시작 버튼은 엘리베이터 ‘발견된 기록 열기’까지 연결됐다. 새로고침 후 Landing 확인. npm run build / git diff --check 통과(기존 큰 번들 경고 유지). 기존 미커밋 작업 보존, commit/push 없음. 실제 터치 기기/관객의 감정 반응은 실측하지 않았다.
- v2 이미지 편집 프롬프트(built-in, CLI 없음):

```text
Edit target: the supplied portrait. Preserve the same adult woman, pose, dark hair, black crew-neck shirt, photographic texture, 2:3 portrait composition and near-black seamless background. Make this an inviting, contemplative contemporary art exhibition portrait instead of a thriller poster. Replace the broad harsh horizontal glitch covering eyebrows through mouth with one much narrower soft translucent smoky photographic motion blur ONLY across the eyes, roughly y22%-30% of the full image. Keep the nose, closed relaxed mouth, jaw and chin naturally visible and undistorted; expression calm, not smiling broadly. Blur feels like a memory softly passing, not digital censorship or a black bar. Reduce saturated blue-violet lighting to subtle desaturated grey-lavender with a gentle neutral skin undertone. Soften neck shadows and facial contrast using broad diffused fill lighting. Maintain dark edges and torso fading into black so the image integrates into a dark website. No rectangular band edges, no sharp streaks, no neon, no ghost, no horror, no new props, no text, no watermark, no borders. Keep head scale and placement within the image unchanged; the web layout will handle the smaller crop.
```

- 2026-10-07 얼굴 왜곡·제목 축소 요청: 사용자가 얼굴의 ‘치지직’ 영역을 건드릴 때 이미지 자체가 일그러지는 반응과 더 작은 제목을 요청했다. 흐려진 얼굴에 포인터 이동/터치 시 국소적인 가로 어긋남을 주고 멈추면 복원한다. 얼굴을 만지는 동작은 입장으로 이어지지 않게 하며, 얼굴 바깥 초상 클릭과 시작 버튼의 입장은 유지한다. 원본 사진·입자·입장 연출·장면 동선은 보존한다. 제목은 데스크톱 최대 84px→64px, 모바일 약 34px→30px, 낮은 창 최대 60px→48px로 줄인다. 변경 범위는 LandingPortrait, LandingScene.css, 이 문서다.
- 얼굴 왜곡 구현·검증: 사진의 가는 가로 조각을 건드린 위치 주변에서 어긋나게 그리고 작은 세로 물결을 더했다. 가장자리는 부드럽게 섞이고, 움직임이 멈추면 원본으로 돌아온다. 얼굴에서 시작한 드래그는 얼굴 바깥에서 놓아도 입장하지 않도록 구분했다. 포인터와 터치 이벤트를 연결했고 움직임 줄이기 설정에서는 왜곡을 생략한다. 1440×900에서 제목 63.36px 및 얼굴 클릭/드래그 후 Landing 유지, 얼굴 바깥 클릭→엘리베이터 확인. 390×844에서 제목과 안내 가독성, 얼굴 영역 클릭 후 Landing 유지 및 시작 버튼→엘리베이터 확인. 모바일 검증은 작은 브라우저 창과 클릭으로 수행했으며 실제 터치 기기는 사용하지 않았다. npm run build / git diff --check 통과(기존 큰 번들 경고 유지). 기존 미커밋 변경 보존, commit/push 없음.

- 2026-10-06 포스터 초상 방향 확정: 사용자가 첨부한 Final_report_1.png의 흐려진 얼굴과 사진 기반 초상을 랜딩에 적용하는 제안에 동의했다. 앞선 절차적 입자 인체를 더 확대하는 대신 자연스러운 사진 기반 초상을 크게 배치한다. 왼쪽 제목/입장 버튼과 오른쪽 초상을 한 포스터처럼 연결하고, 얼굴의 흐림과 작은 입자에만 움직임을 준다. 전시장 공간 및 FINAL REPORT 문구는 랜딩에 넣지 않는다. 기존 입장 압축→엘리베이터, 기록 상태, 다른 장면은 유지한다. 신규 이미지의 제작 정보와 브라우저 검증 결과를 이 문서에 추가한다.
- 포스터 구현: LandingPortrait 컴포넌트와 사진 자산을 추가하고 LandingScene TSX/CSS를 수정했다. 이미지의 흐려진 얼굴 부분만 중첩해 천천히 움직이며, 사진에서 샘플링한 위치의 작은 입자 최대 240개가 포인터 근처에서 흩어지고 돌아온다. 초상 클릭과 기존 입장 버튼은 같은 입장 콜백을 사용한다. 초상이 중앙으로 압축된 뒤 기존 GPU의 빛 선과 엘리베이터로 이어진다. 기존 GPU 코드는 보존하며 랜딩의 절차적 인물 윤곽은 숨겼다. 움직임 줄이기 설정에서는 얼굴/입자 움직임을 멈춘다. 인물 근처의 체류 기록 대상은 새 초상 영역으로 연결했다.
- 포스터 검증 완료: 1440×900, 390×844, 1280×600의 실제 브라우저 화면 확인. 키보드 Tab으로 입장 버튼 포커스와 초상 밝기 반응 확인. 데스크톱 초상 직접 클릭 및 모바일 시작 버튼 모두 엘리베이터의 ‘발견된 기록 열기’에 도착했다. 새로고침 후 Landing 확인. 낮은 창에서는 버튼 하단 약 434px, 관람 시간 상단 약 462px, 장면 높이 600px로 겹침/불필요한 스크롤 없음. npm run build / git diff --check 통과(기존 큰 번들 경고 유지). 기존 미커밋 변경 보존, commit/push 없음. 움직임 줄이기는 코드 경로를 점검했으며 OS 설정을 실제로 전환해 보지는 않았다.

### 랜딩 초상 제작 정보

- 도구: built-in image_gen (imagegen 스킬), CLI 사용 없음.
- 참고 이미지: `/Users/sarah/Downloads/images 2/images/Final_report_1.png`. 벽의 초상 분위기만 참고, 원본은 수정하지 않음.
- 프로젝트 자산: `src/assets/landing/anonymous-portrait-v1.jpg`, 1024×1536, 약 313KB. 생성 PNG 원본을 보존하고 웹용 JPEG 형식으로 저장.
- 생성 프롬프트:

```text
Use case: photorealistic-natural. Asset type: finished photographic portrait artwork for an interactive online exhibition landing page, NOT a screenshot or UI mockup. Reference image: use only the violet obscured-face portrait on the large wall poster for mood, photographic texture and anonymity; discard the entire exhibition room and all typography. Produce a new text-free portrait photograph. One anonymous adult woman with natural dark shoulder-length hair in a simple black crew-neck top, realistic human head, neck and shoulders, facing almost forward with a slight turn toward viewer's left. Head and upper chest cropped close, crown entirely visible with a small dark margin, shoulders cropped at sides, torso fades into black at bottom. The face from eyebrows through mouth is unreadable, obscured by elegant layered horizontal photographic smears and translucent violet motion traces; retain believable chin, hair and neck, no clearly visible eyes. Restrained editorial art photography, photographic grain, deep near-black seamless background #040406, sculptural subdued blue-violet side lighting, no neon, no glow aura. Portrait-oriented composition 1024x1536; subject centered at x50%, face centered about y35%, usable dark edges. High quality contemporary exhibition artwork with organic photographic anatomy. NO text, letters, logos, watermark, borders, gallery, walls, furniture, monitor, 3D mannequin, geometric bust, additional people. The output is ONLY the portrait artwork.
```

### 이전 수정 기록

- 2026-10-06 인물 형태 수정 요청: 사용자가 랜딩 인물이 허술하다고 지적했다. 현재 정면의 타원 머리와 긴 원통 목이 사람보다 도식적인 아이콘으로 보인다. 입자 렌더링은 유지하고 머리·턱·짧은 목·어깨의 비례와 연결을 조정한다. 약간 돌아선 얼굴의 코/광대 부피와 어깨의 작은 비대칭으로 입체감을 만든다. 눈·표정·특정 인물의 정체는 부여하지 않는다. 수정 범위는 랜딩 전용 memoryField의 portraitTrace 표면과 이 기록이며 제목·레이아웃·포인터 반응·입장 압축·다음 장면은 보존한다.
- 인물 형태 구현 완료: 두상부터 몸통까지 부위별 폭을 연속 곡선으로 연결했다. 짧은 목, 턱의 좁아짐, 자연스러운 어깨 경사와 작은 비대칭을 적용했다. 왼쪽으로 돌아선 얼굴에 코·광대·턱·귀의 부피를 더하고 화면 검토 후 과장된 코 돌출을 줄였다. 입자 수·질감·색상·GPU 시뮬레이션·포인터 처리·입장 압축 및 최종 공개의 별도 인물 렌더러는 수정하지 않았다. Landing의 제목·레이아웃도 보존했다.
- 인물 검증: 1440×900 및 390×844에서 윤곽과 글의 겹침 확인. 모바일 시작 버튼→입자 압축→엘리베이터 도착 및 ‘발견된 기록 열기’ 확인. npm run build / git diff --check 통과(기존 번들 크기 경고 유지). 기존 미커밋 변경 보존, commit/push 없음.

- 2026-10-06 제목 크기 조정: 사용자가 제목이 지나치게 크다고 지적했다. 포스터 구성과 인물 크기는 유지하고 데스크톱 제목을 7vw/최대 104px에서 5.6vw/최대 84px로 약 20% 줄인다. 낮은 창의 제목도 최대 68px에서 60px로 줄이고, 기존 모바일 제목은 유지한다.
- 제목 조정 완료: LandingScene.css의 제목 크기 두 규칙만 수정. 1440×900에서 인물과 제목 균형 확인, 시작 버튼→엘리베이터 연결과 새로고침 후 Landing 확인. 빌드/공백 검사 통과, 기존 번들 경고 유지. 기존 변경 보존, commit/push 없음.

- 2026-10-06 랜딩 재구성 요청: 사용자가 ‘텅 빈 느낌’을 지적하고 전시 포스터처럼 다시 구성하는 방향에 동의했다. 앞의 40/60 분리 배치 평가는 보존하되 이번 수정은 큰 인물과 제목을 가까이 겹쳐 하나의 장면으로 만든다. 로고는 상단, 관람 시간은 하단으로 이동한다. 인물의 어깨는 화면 아래/오른쪽에서 잘리고, 중앙 글은 명암으로 읽기 쉽게 한다. 입자 캔버스는 CSS 영역 크기로 확대해 포인터 좌표를 보존하고, 입장 시 기존 화면 크기/중앙선으로 돌아오게 한다. 수정 범위는 Landing TSX/CSS와 이 기록이다.
- 랜딩 재구성 완료: 제목을 최대 104px로 확대하고 인물 가까이 붙였다. 인물 캔버스를 넓고 높게 배치해 하단을 자르고 모바일에서는 오른쪽 어깨도 잘리게 했다. 캔버스 바깥에 잘라내는 영역을 두어 확대 때문에 페이지가 길어지지 않게 했다. 모바일에서는 제목과 인물이 겹치며 글 뒤의 입자는 마스크로 어둡게 한다. 로고는 상단 왼쪽, 관람 시간은 하단 왼쪽으로 옮겼다. 낮은 창에서는 제목 크기를 줄이고 시간 안내를 버튼 다음에 배치한다. 기존 시뮬레이션과 입장 때의 원래 캔버스/중앙선 복원, 포인터 반응, 버튼 focus 반응, 카피·저장·다음 장면을 보존했다.
- 재구성 검증: 1440×900 데스크톱과 390×844 모바일 시각 확인. 1280×600에서는 버튼 하단 약 453px, 관람 시간 상단 약 481px로 겹침이 없고 장면 스크롤 높이가 600px인 것을 확인했다. 모바일 시작 버튼과 데스크톱 인물 직접 클릭을 각각 실행해 엘리베이터의 ‘발견된 기록 열기’까지 도착했다. 화면 설정 복원과 새로고침 후 Landing 확인. npm run build / git diff --check 통과(기존 큰 번들 경고 유지). commit/push 없음.

- 기준 먼저 작성. 구현 후 브라우저와 빌드 결과, 관람 시간 추정의 한계를 아래에 추가한다.
- 구현 완료: Landing 설명을 한 문장으로 줄이고 ‘단서 따라가기’ 버튼 아래에 관람 시간 안내를 추가했다. 버튼 hover/focus를 기존 공간/인물 반응과 연결했다. 모바일 글 간격도 정리했다.
- 빛·소리·기억·문장의 질문과 안내를 짧고 쉬운 말로 수정했다. 발급 완료 후 이름 입력 폼과 중복 설명을 숨겼다. 문장의 앞 이야기와 보고서의 긴 해석은 기본적으로 접고 펼쳐 읽게 했다. ‘미응답’은 ‘빈칸’으로, ‘LIBEO GRAPHIC / 구조점을 번역’은 ‘단서가 남긴 빛’으로 바꿨다. 요약본의 반복 결말 한 단락을 줄이고 ‘책와 사진’ 및 문장 뒤 조사를 고쳤다.
- 중간 진입 영상은 전부 none 모드로 생략했다. 파일은 보존했다. 계단→소리가 같은 플레이어 슬롯을 공유하므로 생략 컴포넌트에 파일별 key를 주어 경유 후 멈추지 않도록 했다. 보고서의 다음 버튼은 읽기 대기 타이머에 묶이지 않게 했다. 공개 연출과 사진→빛 변환은 유지했다.
- 카메라 없는 공개에서 사용하지 않는 video 요소가 ‘미디어를 재생할 수 없습니다’ 안내를 노출하는 것을 확인했다. 카메라 선택 때만 거울 video를 렌더링하도록 수정했다. 카메라 요청·준비 확인·마이크 미사용·스트림 종료 코드는 변경하지 않았다.
- 시간 근거: 로컬 MP4 메타데이터에서 인트로 36.29초, 최종 진입 영상 8초를 확인했다. 기존 5개 cut 영상과 제목 전환, 최종 full 영상 전환은 정상 재생 기준 약 33초였다. 그 대기를 제거했고, 조사 방식 약 13초·발견당 6.6초·마무리 약 9초의 버튼 잠금도 제거했다. 발견 1–3개인 방문에서는 총 약 1분 전후의 강제 대기가 줄어든다. 인트로/빛 변환/최종 공개는 관람 시간에 여전히 포함된다.
- 실제 브라우저: 749×774 기본 창과 390×844 Landing 배치, 키보드 Tab 포커스의 인물 반응 확인. Landing→엘리베이터→인트로 전체 재생(브라우저 duration 36.25초)→등록→빛 선택/변환→소리 재생/위치→기억 사물 선택/그리기 생략→문장 앞 이야기 펼치기/3개 선택/빈칸 생략→모은 기록→카메라 없는 공개→조사 방식→발견 3개/설명 펼치기/근거 열기·닫기→마무리→최종 요약본까지 확인. 소리에서 BACK으로 빛 복귀 후 다시 진행해 경유 생략이 정상 작동함을 확인했다. 새로고침 후 Landing과 화면 크기 설정 복원 확인.
- 검증 한계: 기존 기록이 있는 방문을 사용한 기능 점검이며 신규 관객의 5분 완주를 실측한 것은 아니다. 카메라 허용 경로는 실제 기기로 점검하지 않았다. 자유 그리기/읽기를 강제 종료하지 않으므로 8분 이내를 보장하지 않는다. 위 5분 배분은 설계 목표이며 현장에서 처음 보는 관객 3–5명의 시간을 재어 조정해야 한다.
- npm run build 및 git diff --check 통과. 기존 큰 번들 크기 경고만 유지. 기존 미커밋 작업 보존. commit/push 없음.
### 2026-10-08 중간 영상 전체 제외 재확인

- 사용자 요청: 인트로를 제외한 중간 진입 영상은 모두 제외한다.
- 현재 구현을 확인한 결과 빛·계단·소리·기억·문장·기록의 레이어·최종보고서의 7개 영상은 이미 모두 `mode: 'none'`이다. 생략 경로는 video 요소나 제목 대기 화면 없이 다음 조사 장면을 연다. 추가 코드 변경은 필요하지 않았다.
- 인트로 영상, 사진→빛 변환, 최종 공개 연출 및 동의 후 실시간 카메라 보기는 보존한다. 원본 중간 MP4 파일은 재생하지 않고 보관한다.
- 검증: 전체 영상 참조와 생략 분기 확인. 이번 브라우저 점검은 새 탭에서 Landing 진입을 확인했으며, 전체 조사 경로는 기존 검증 기록을 따른다. npm run build 및 git diff --check 통과(기존 번들 크기 경고 유지). 기존 미커밋 작업 보존, commit/push/배포 없음.

### 2026-10-08 후속 수정 릴리스

- 사용자 요청에 따라 보고서 수동 읽기 진행, 근거 창 키보드 초점/배경 조작 보완, UX/UI 감사 및 중간 영상 제외 확인 기록을 함께 커밋·푸시·배포한다. 기존 phase1-foundation 브랜치와 GitHub Pages 배포 설정을 사용한다.
- 원본 src/assets/archive.zip과 작업용 Claude outputs/_catalog-sheets/는 로컬에 보존하고 릴리스에서 제외한다. 기존 인트로·장면 순서·카메라 동의·일곱 소리·입자 연출은 변경하지 않는다.
- 릴리스 전 npm run build 및 git diff --check 통과. 기존 큰 번들 경고만 유지. 변경된 보고서의 브라우저 동선·수동 읽기·근거 창 초점 검증은 위 PC 잔여 수정 기록 및 UX_UI_AUDIT_2026-10-07.md를 따른다.

### 2026-10-08 발견 화면의 입체 기록물

- 사용자가 결과 화면의 글 부담을 줄이고 입체 그래픽 중심 구성을 시도하도록 승인했다. 발견 화면에 반투명 유리층과 빛의 점으로 된 기록물을 구현하고 기본 화면은 짧은 제목 하나로 줄인다. 해설·질문·기존 제목은 근거 창 안에서 읽는다.
- 그래픽은 실제 finding.evidence의 장면별 기록을 한 층과 한 빛으로 대응시킨다. 배치는 상징적 표현이며 시간/성향의 수치 그래프로 제시하지 않는다. 짧은 제목은 발견 종류 및 기존 context에 맞춘다. 정적인 생성 이미지 대신 SVG로 관객 기록에 대응하고 진입 때 한 번만 부드럽게 나타난다.
- 수정 범위는 발견 화면과 전용 그래픽/스타일이다. 기존 해석 엔진, 기록, 근거 창 초점 처리, 다음 버튼, 공개 연출, QR 결과, Landing 및 장면 순서는 보존한다.
- 구현 완료: FindingRecordGraphic SVG가 근거 항목마다 유리층/빛 하나를 만든다. 발견 11종의 짧은 제목을 표시하고 원래 제목·해설·질문·행동 근거는 ‘내 기록 살펴보기’ 안에 유지한다. 지속 회전/반짝임 없이 한 번 진입하며 움직임 줄이기 설정에서는 진입 모션을 생략한다.
- 검증: 별도 로컬 DEV 서버 5175의 예시 기록으로 1280×720에서 카메라 없는 공개→수동 조사 방식→4개 근거의 입체 기록물→상세 창→마무리→최종 요약본을 확인했다. 상세 내용/측정값 보존, Tab/Shift+Tab 닫기 초점 유지, Escape 후 원래 버튼 복귀 및 새로고침 후 Landing 확인. 실제 관객 전체 기록 조합이나 카메라 경로를 재검증한 것은 아니다. npm run build와 git diff --check 통과(기존 번들 경고 유지). 기존 5174 서버 및 로컬 원본/작업 파일 보존. 이번 요청에서 commit/push/deploy 없음.

### 2026-10-08 입체 그래픽의 설명 화면 확장

- 사용자가 다른 곳에도 같은 시각 방식을 적용하고 문장은 기존 그대로 유지하도록 요청했다. 최종보고서의 텍스트 중심 조사 방식/마무리에 각각 빛의 경로와 빈자리를 품은 유리 기록물 모티프를 더한다. 이미 작품 그래픽이 있는 공개·모은 기록·요약본은 유지한다.
- 발견 화면의 새 축약 제목은 제거하고 기존 finding.headline을 다시 기본 화면에 표시한다. 기존 완결 문장의 온점은 보존하며 명사형 제목/라벨에는 온점을 추가하지 않는다. 기록·해석·수동 진행·카메라·장면 순서는 변경하지 않는다. 추가 그래픽은 서사를 위한 상징이며 개인 측정값으로 표현하지 않는다.
- 구현/검증 완료: ReportNarrativeGraphic을 조사 방식과 마무리에 추가했다. 조사 방식의 3단계와 마무리의 3문장은 원문 그대로 수동 진행되며, 발견 제목도 원문으로 복원했다. DEV 예시 기록으로 공개→조사 방식 전체→발견→마무리 전체→최종 요약본 및 새로고침 후 Landing을 확인했다. 기본 1280×720과 브라우저가 변경한 1456×774에서 그래픽·문장·다음 버튼 배치를 확인했다. 빌드 및 git diff --check 통과(기존 번들 경고). 신규 관객 시간/카메라 경로 실측은 이번 검증 범위가 아니다. 이전 미커밋 그래픽 작업과 로컬 임시 파일 보존, commit/push/deploy 없음.

### 2026-10-08 러닝 타임 1회 측정

- 사용자 요청에 따라 127.0.0.1:5174/unanswered/에서 실제 UI로 랜딩 입장 버튼 클릭부터 최종 요약본 표시 확인까지 연속 진행했다. DEV 장면 점프 없이 인트로 전체 재생, 사진 1개/단어 2개, 소리 2개 전체 청취/1개 선택, 물건 2개, 그리기 생략, 문장 3개/13자 응답, 카메라 없이 공개, 발견 1개/근거 열기 및 마무리 전체 진행.
- 결과: 339초(5분 39초). 구간별 누적 시간은 입장·인트로 63초 / 등록 완료 81초 / 빛 완료 119초 / 소리 완료 163초 / 기억 완료 181초 / 문장 완료 239초 / 공개 완료 274초 / 요약본 도착 339초. 구간 시간은 각각 63 / 18 / 38 / 44 / 18 / 58 / 35 / 65초다. 시작 전에 랜딩을 바라보는 시간과 요약본 도착 후 읽기·QR 저장 시간은 제외했다.
- 측정 한계: 관객이 아니라 도구로 조작한 한 번의 방문이며 도구 호출/판단/화면 확인 시간도 포함된다. 문장 목록 읽기 15초, 상세 읽기 5초를 별도로 기다렸으므로 사람의 읽기 속도 실측이 아니다. 해당 주소에 기존 조사원증/기록이 있어 등록 입력을 생략했고, 그리기·카메라 경로도 생략했다. 최초 시도는 인트로 중 도구 중단으로 폐기하고 새 시작 시각을 저장한 재측정만 집계했다. 이 결과는 5분대 완주가 가능한 경로의 참고값이며 신규 관객 평균이나 7–8분 최대를 보장하지 않는다.
- 제품 코드는 변경하지 않았다. 기존 미커밋 그래픽 작업과 사용자 탭은 보존한다. commit/push/deploy 없음.
- 검증 후 npm run build 및 git diff --check 통과(기존 번들 크기 경고 유지). 측정용 탭만 닫았다.

### 2026-10-08 PC 상세 보고서 → QR 요약본

- 사용자가 마지막 PC 화면을 상세 최종 보고서로, QR 링크는 간결한 모바일 요약본으로 유지하도록 승인했다. 기존 보고서 모델/개인 발견을 사용해 빛 그래픽, 고른 단서, 선택 과정, 문장과 빈자리를 하나의 스크롤 문서로 모은다. 긴 해설과 측정 근거는 기본적으로 접는다.
- 마지막 화면 컴포넌트만 교체하고 QR 데이터·모바일 페이지·인쇄 보고서·발급 시각/ID·카메라·장면 순서·전시장 재시작/유휴 초기화는 보존한다. 기존 문장과 명사형 제목의 문장부호 원칙도 유지한다.
- 구현 완료: FinalReportDetail이 PC 마지막 화면에 빛/원본 사진·팔레트, 선택한 소리/청취 기록, 물건과 실제 그림, 개인 발견/근거, 선택한 전체 문장과 직접 쓴 응답 또는 빈칸 상태를 모은다. 원본 사진·색 수치·개인 해설·행동 근거는 접어 읽는다. 일반 PC 하단 QR은 260px로 표시하고 요약본 링크임을 명시하며 전시장 모드는 기존 별도 QR/현장 안내와 유휴 초기화를 보존한다.
- 브라우저 검증: DEV 예시로 마지막 장면을 열어 상세 보고서의 각 기록/그림/전체 문장과 하단 버튼 접근, 해석 펼치기/접기, 처음으로 돌아가기→Landing을 확인했다. 실제 렌더된 QR을 OpenCV로 디코딩하고 해시를 로컬 모바일 경로에서 열어 동일 RPT-AXUUR의 ‘최종보고서 요약본’을 확인했다. QR 대상은 기존 공개 호스트를 유지한다. 실제 휴대폰 카메라 스캔이나 인쇄 대화상자, 전시장 유휴 타이머를 새로 실측한 것은 아니다. DEV 예시의 수동 빛 규칙/사진 캐시 차이는 기존 감사 문서의 검증 한계를 따른다.
- 기존 미커밋 그래픽 작업, 5174 서버, 원본 ZIP/작업 시트 및 사용자 탭 보존. 이번 작업에서 commit/push/deploy 없음. 상세 보고서 읽기 추가에 따른 관객 러닝 타임은 별도 실측이 필요하다.
- 최종 npm run build 및 git diff --check 통과. 기존 큰 번들 경고 유지. 별도 검증 서버/탭은 종료했다.

### 2026-10-08 상세 보고서 문서 레이아웃

- 사용자 요청으로 상세 보고서를 하나의 정돈된 문서로 디자인한다. 검은 전시 공간 위에 짙은 종이 면, 문서 상단 발행 정보 표, 섹션별 번호/구분선, 그림 캡션과 편집 여백을 적용한다. 본문/기록/해석/QR·인쇄·재시작 흐름은 보존하며 명사형 표제에는 온점을 붙이지 않는다.
- 적용 완료: 문서 테두리/종이 면, 아카이브 머리글과 상단 선, 제목 옆 기록 번호·발행 일시·관객 표, 빛 그림 캡션, 두 열 기록의 세로 구분선, 문장 블록과 덧붙인 기록의 점선 구분을 추가했다. 본문·해석·QR 데이터/260px 크기·인쇄 경로는 변경하지 않았다.
- 실제 브라우저 1280×720 DEV 예시에서 표지/본문, 해석 펼치기·접기, 하단 QR/복사 버튼과 재시작→Landing을 확인했다. 실제 인쇄/휴대폰 스캔은 이번 디자인 변경에서 재실측하지 않았다. 사용자 탭과 기존 미커밋 변경/원본을 보존하며 5175 개발 서버를 열어 둔다. commit/push/deploy 없음.
- npm run build 및 git diff --check 통과(기존 큰 번들 경고 유지).

### 2026-10-08 상세 보고서의 해석 우선 배치

- 사용자가 사실 목록 중심의 보고서를 해석 중심으로 수정하도록 승인했다. 기존 분석 엔진이 근거를 연결해 만든 개인 발견 1–3개를 표지 다음에 먼저 보여준다. 발견 제목·해설·질문은 기본적으로 펼쳐 보이고, 시간/행동 근거만 선택해서 읽는다. 단서별 기록은 해석 아래에 배치한다.
- 새로운 성격/심리 추정이나 데이터 수집을 추가하지 않는다. 분석이 없는 방문은 관계를 해석할 근거가 부족함을 명시하고, 반복 패턴이 없는 발견은 하나로 묶이지 않았다는 한계를 표시한다. 기록·QR 요약본·인쇄·재시작·기존 문장 및 앞선 미커밋 작업을 보존한다.
- 적용/검증 완료: 기존 개인 발견의 제목·3줄 해설·질문을 표지 다음 01 ‘이번 기록의 해석’에 기본 노출하고 장면별 근거/수치만 접었다. 빛/소리/기억/문장 기록을 02–05로 이어 붙였다. 1280×720 DEV 예시로 해설이 기본 상태에서 보임, 근거 펼치기/접기와 실제 값 보존, 하단 복사 버튼 접근/성공 표시 및 재시작→Landing을 확인했다. 분석 없음/반복 없음의 안내는 코드 분기를 확인했으며 모든 관객 기록 조합을 브라우저에서 재생한 것은 아니다.
- npm run build 및 git diff --check 통과(기존 큰 번들 경고 유지). 개인 발견 생성 엔진/해설 문장/QR 데이터는 변경하지 않았다. 5175 개발 서버와 기존 미커밋 작업/사용자 탭 보존. commit/push/deploy 없음.

### 2026-10-08 상세 보고서 주석 반영

- 사용자 주석에 따라 문서 바깥의 중복 최종보고서 표제를 제거하고 기억 영역 제목을 ‘기억 속에서 고른 물건’으로 수정한다. 사진·색 상세는 높이를 미리 확보한 패널 안에서 펼쳐 읽고 내부 스크롤을 사용해 후속 기록 위치를 유지한다. 기존 분석 엔진은 최대 3개를 고르되 중복을 제외하며 조건에 따라 1개/없음이 가능함을 확인했다. 개수나 생성 조건은 변경하지 않는다.
- 적용/검증 완료: 중복 표제 삭제, 기억 제목 수정, 사진 상세 260px 고정 영역/210px 내부 스크롤 적용. 실제 1456×774 브라우저에서 사진 상세 열기·닫기 전후 문서 높이 3183.59375px와 다음 기록 상대 위치 2042.7265625px가 동일함을 확인했다(해석 근거는 열린 상태). 원본 사진·팔레트·빛 값과 키보드로 접근 가능한 상세 영역을 확인했다. npm run build 및 git diff --check 통과, 기존 번들 경고 유지. 분석 생성 조건·QR·장면 흐름 및 기존 미커밋 작업 보존, commit/push/deploy 없음.

### 2026-10-08 QR 요약본의 개인 해석

- 사용자 요청으로 요약본 표지 다음에 이번 기록의 해석을 추가한다. 기존 엔진이 선정한 최대 3개의 해석을 QR 해시에 식별자/템플릿 문맥으로 담아 동일한 문장으로 복원한다. 원시 행동 로그·직접 쓴 응답·카메라 자료는 추가하지 않고 기존 링크도 읽을 수 있게 유지한다.
- 구현 완료: 요약본에 해석 제목·해설·질문을 표지 다음에 표시한다. QR은 선정된 로컬 템플릿 식별자와 필요한 문맥만 담는다. 원격 해석 서비스를 추후 사용하면 QR 템플릿 해설과 다를 수 있다.
- 검증: 실제 QR 디코딩(DEV 예시 547자) 후 로컬 해시 페이지에서 RPT-9OK6W의 동일한 제목·해설·질문 확인. 이전 형식 링크 정상 표시 확인. 추가 문맥 압축 후 npm run build 및 git diff --check 통과(기존 번들 경고). 실제 휴대폰 스캔/모든 3개 해석 조합은 미실측. 기존 기록·장면 흐름·미커밋 작업 및 사용자 탭 보존. commit/push/deploy 없음.

### 2026-10-08 상세 해석의 유리 기록물

- 사용자 승인으로 상세 보고서 해석 오른쪽에 기존 FindingRecordGraphic을 배치한다. 실제 근거 항목별 유리층과 빛을 대응시키되 수치 그래프로 제시하지 않는다. 본문을 위한 폭을 확보하고 보고서 안에서는 애니메이션을 끈다. 좁은 문서 폭은 세로 배치로 읽기 공간을 유지한다. QR 데이터와 해석 문장은 보존한다.
- 적용/검증 완료: FinalReportDetail에 근거별 유리 기록물을 추가하고 전용 CSS로 오른쪽 약 28% 폭을 배정했다. 문서 폭이 좁을 때는 아래로 배치한다. 실제 브라우저에서 4개 근거의 유리층/빛, 본문과 오른쪽 그래픽 배치 및 근거 접기를 확인했다. 각 층의 animationName=none/opacity=1 확인, 새 탭의 Landing 첫 진입 확인. npm run build 및 git diff --check 통과(기존 번들 경고). QR 요약본/해석 문장/장면 흐름과 기존 미커밋 변경 보존. 이번 변경은 PC 상세 보고서에 적용. commit/push/deploy 없음.

### 2026-10-08 소리 선택 유리돔 정돈

- 사용자 요청으로 소리 선택 유리돔의 재질/형태를 개선한다. 두꺼운 세로 반사와 받침을 얇은 비대칭 반사/타원 받침으로 정돈하고, 재생 상태의 내부 빛과 선택/키보드 초점을 명확히 한다. 일곱 음원·SVG 아이콘·재생 및 선택 로직·다음 장면은 보존한다.
- 적용 완료: SoundCluesScene.css만 수정해 곡면 돔, 얇은 테두리/바닥 타원, 비대칭 반사, 작은 손잡이, 재생 중 내부 빛과 선택 받침/키보드 초점 표시를 정돈했다. 음원/아이콘/상태 로직은 수정하지 않았다.
- 검증: 실제 DEV 장면에서 일곱 돔 배치, 빗소리 5초 재생/선택, 다시 듣기/일시정지, 기억 위치 표시→다음 기억 장면 및 새로고침 후 Landing 확인. 모든 음원 청취나 키보드 전체 경로는 새로 실측하지 않았다. npm run build 및 git diff --check 통과(기존 번들 경고). 기존 미커밋 작업/사용자 탭/개발 서버 보존, 검증 탭 종료. commit/push/deploy 없음.

### 2026-10-08 소리의 파동·기억 지도와 보고서 기록물

- 사용자 요청으로 재생 파동을 정돈하고 위치 단계에서 파동을 제거해 좌표 영역과 겹치지 않게 한다. 좌표는 사각 공간을 유지한 빛의 기억 지도로 표현해 기존 가로 선명도/세로 거리와 키보드 조작을 보존한다. 좌표는 관객이 상상한 거리/선명도의 기록이며 성격이나 실제 청력의 추정으로 쓰지 않는다. SOUND를 근거로 쓰는 해석에 이 좌표 설명을 추가하고 보고서의 소리 해설에도 연결한다. 선택한 소리 돔과 실제 문장 카드 그래픽을 보고서에 추가한다.
- 적용 완료: 파동을 짧고 얇은 파형으로 정돈하고 위치 단계에서는 렌더하지 않는다. 재생 제어는 한 줄로 분리, 좌표 영역은 곡면 유리판/정적 원형 선/빛나는 점으로 변경했다. 사각 영역 전체와 좌표·키보드 처리 보존. 공용 soundPositionMeaning이 관객이 놓은 거리/선명도를 설명하며 SOUND를 포함한 기존 해석의 근거에 추가된다. 좌표 자체로 성격이나 선택의 이유를 새로 추정하지 않는다. 소리 본문과 QR 요약본에도 위치 설명을 표시한다.
- 보고서의 선택된 소리 유리돔은 기존 7종 SVG 경로를 공용 SoundSpecimenGlyph로 옮겨 동일 아이콘을 재사용한다. 문장들은 실제 선택 순서대로 번호가 있는 카드로 표시하며 원문/직접 쓴 문장/빈칸 상태를 보존한다.
- 검증: 1280×720 DEV에서 소리 재생→위치 단계→방향키 점 이동→확인→기억 장면 진행 확인. 위치 단계 파동 DOM 0개, 재생 영역 하단 234.79px/지도 상단 260.20px로 겹침 없음 확인. DEV 상세 보고서에서 좌표 설명의 해석 근거 노출, 실제 선택 아이콘 돔과 문장 카드 원문/순서 확인. 새 탭의 시작은 Landing 확인. QR 위치 설명은 기존 pos를 읽는 코드/타입 검사로 확인했으며 이번에 휴대폰 스캔을 재실측하지 않았다. npm run build 및 git diff --check 통과(기존 번들 경고). 기존 미커밋 변경/개발 서버/사용자 탭 보존, commit/push/deploy 없음.

### 2026-10-08 소리 선택 배치 주석 반영

- 사용자 주석으로 돔 뒤의 보라색 잔상과 선반 장식을 제거한다. 돔 선택과 재생을 분명한 두 영역으로 재배치하고 재생 제목 자간을 본문과 맞춘다. 재생 영역 높이를 미리 확보해 첫 청취 시 돔이 움직이지 않게 한다. 좌표 단계·음원·선택 상태는 보존한다.
- 적용 완료: 돔 뒤 잔상/선반 DOM 삭제, 일곱 돔 그리드와 재생 정보/파형/제어의 가로 배치로 구성했다. 제목 자간/들여쓰기 0, 재생 영역 높이 예약과 돔 영역 아래 36px 간격 확보. 실제 1135×774에서 장식 DOM 0개, 자간 normal, 돔 영역 하단 442.96px/재생 영역 시작 478.96px 확인. 재생 전후 돔 상단 225.23px 동일, 소리 재생과 선택 상태 유지 및 좌표 단계 도착 확인. 새 검증 탭의 Landing 확인. npm run build/git diff --check 통과(기존 번들 경고), 사용자 탭/기존 미커밋 변경 보존. commit/push/deploy 없음.

### 2026-10-08 소리 단계 복귀 오류

- 사용자 제보: 소리 장면의 유지된 Activity 상태가 좌표 단계로 복귀하고 전역 BACK이 장면 밖으로 이동해 돔에 돌아갈 수 없음. 소리 장면이 다시 활성화될 때 돔 단계부터 표시하고 좌표 단계 BACK은 로컬 돔 단계로 처리한다. 소리/좌표/청취 기록을 삭제하지 않는다. 다른 장면 BACK은 기존 순서 유지.
- 추가 원인: completeScene은 첫 미완료 장면으로 이동해 이미 완료한 장면을 재방문하면 중간 단계를 건너뛰었다. 완료 장면을 현재 재방문 중일 때만 순서상 바로 다음 장면으로 이동하도록 수정했다. 최초 완료/기록/다른 이동 조건은 유지한다.
- 검증 완료: 브라우저에서 돔→좌표→BACK→돔(선택/청취 유지), 좌표 확인→기억→BACK→돔 및 돔 BACK→빛 확인. 최종 수정 후 빛 결과 저장→유리돔 도착 확인. HMR로 store 변경 시 새로고침되어 Landing부터 다시 검증했다. npm run build 및 git diff --check 통과(기존 번들 경고). 사용자 탭/기존 미커밋 작업 보존, 검증 탭 종료. commit/push/deploy 없음.

### 2026-10-08 소리 두 단계 배치 통일

- 사용자 주석대로 좌표 지도를 위에, 다시 듣기를 아래에 배치한다. 일곱 돔을 조금 더 모으고 소리 이름은 작은 한 줄 표제로 표시한다. 선택 체크·재생·좌표·BACK 동작과 기존 미커밋 변경을 보존한다.
- 적용/검증 완료: 소리 이름 12px/nowrap(실제 7개 높이 모두 18px), 돔 영역 최대 1000px와 간격 8px로 조정. 좌표 DOM을 재생 영역 앞에 배치하고 낮은 화면에서는 지도와 여백을 축소해 다음 버튼 접근을 유지한다. 1280×720 실제 브라우저에서 한 줄 표제와 지도 위/재생 아래 배치·방향키 위치 이동·BACK 돔 복귀 확인. 신규 탭 Landing 확인. npm run build/git diff --check 통과(기존 번들 경고), 기존 미커밋 작업/사용자 탭 보존. commit/push/deploy 없음.

### 2026-10-08 변경 묶음 배포

- 사용자 요청으로 상세/QR 보고서 해석과 기록물, 소리 돔/재생/지도 배치, BACK/재진입 수정 및 피드백 기록을 커밋·푸시·배포한다. npm run build 및 git diff --check 통과(기존 번들 경고). 앞선 실제 브라우저 검증 결과를 유지한다. 로컬 archive.zip과 Claude 작업 시트는 배포 커밋에서 제외한다.
- 완료: 수정 묶음 95d353b 및 공용 아이콘 끝 빈 줄 정리 f9e7c2a를 phase1-foundation에 커밋·origin 푸시했다. npm run deploy Published, GitHub Pages 상태 built 및 공개 HTML의 JS 경로가 이번 dist와 일치함을 확인했다. 기존 큰 번들 경고만 유지. 미추적 archive.zip/Claude 작업 시트는 그대로 보존하고 공개 커밋에서 제외했다.

### 2026-10-08 교수님 피드백 및 후속 합의

- 실행 순서: ① 인트로 소리 끄기/SKIP 제거, 끝까지 재생 후 이동 ② 보고서의 ‘내 기록 살펴보기’ 면을 밝게 하여 집중과 가독성 강화 ③ PC 최종 문서의 모든 기록/근거/사진을 접지 않고 표시 ④ 기존 유리 기록물·빛·선택한 소리 돔·기억의 방·문장 카드를 정돈해 구역별 읽기 리듬 마련. QR 요약본은 이미 펼쳐져 있으므로 유지한다.
- 후속 사용자 합의는 이전 접힘/사진 고정 높이 방침을 이번 PC 최종 문서에 한해 대체한다. 해석/기록 원문과 데이터, 카메라 동의, Landing과 전체 동선은 유지한다.
- 전시 준비: 졸업전시 시안을 다음 주(2026-10-12–18)까지 준비한다. 정확한 제출일/공간 치수/출력 형식은 추후 확인한다. 웹도록은 공간과 관람 동선을 중심으로 구성한다. 이번 웹 수정과 별도의 준비 항목으로 관리한다.

- 1–3번 웹 수정 및 기록물 정돈 완료: 인트로의 SKIP/소리 끄기와 관련 CSS 제거, 음성 재생 유지. 재생 오류는 자동 통과 대신 다시 재생을 제공하고, 재생 준비된 영상의 재진입/HMR 및 예기치 않은 일시정지 시 재생 복구를 처리한다. 마지막 문서는 details를 일반 기록 섹션으로 바꾸고 사진 내부 스크롤/고정 높이를 제거했다. 해석 근거·행동 기록·사진/색은 밝은 별도 면에 모두 표시한다. 기존 기록물 재사용, 돔의 깊이/기억의 방 테두리/문장 카드 층을 정돈했다.
- 실제 브라우저(1135×774, localhost:5175/unanswered/) 검증: DEV로 인트로 진입, 소리 켜진 재생과 버튼 없음 확인, 전체 종료 후 조사 편지→등록 이동 확인. 검증 중 코드 HMR로 영상이 멈춰 준비된 영상 재생 복구를 추가한 후 종료 동선을 확인했다. DEV 예시 최종 문서의 details 0개/기록 면 3개/가로 넘침 없음, 모든 근거·원본 사진/색·소리 돔·기억/그림·문장 카드·하단 QR/버튼 접근 확인. 재시작과 새로고침 후 Landing 확인. 카메라 없는 공개→조사 방식→발견→내 기록 창의 밝은 면과 Escape 초점 복귀 확인.
- npm run build 및 git diff --check 통과(기존 큰 번들 경고 유지). 전체 신규 관객 경로/카메라 사용/휴대폰 QR 스캔/작은 화면/장애 상황 강제 재현은 이번에 실측하지 않았다. QR 데이터·인쇄·해석 생성·카메라 고지·일곱 소리·장면 순서·기존 개발 서버와 미추적 원본을 보존했다. commit/push/deploy 없음. 4–5번 전시 시안/공간 중심 웹도록은 준비 항목으로 기록했으며 완성 산출물은 아직 만들지 않았다.

### 2026-10-10 교수님 피드백 수정 배포

- 사용자 요청으로 인트로 전체 관람과 열린 최종 보고서/밝은 기록 면 수정 7개 파일을 커밋·푸시·GitHub Pages 배포한다. npm run build와 git diff --check 통과(기존 큰 번들 경고). 앞선 브라우저 검증 범위 유지. 로컬 archive.zip/Claude 작업 시트는 제외·보존한다.

- 배포 완료: b21dd1d를 phase1-foundation에 커밋·origin 푸시했다. npm run deploy Published, GitHub Pages built 및 공개 HTML의 JS 경로가 이번 dist와 일치함을 확인했다. 빌드 통과(기존 큰 번들 경고). 로컬 ZIP/작업 시트 제외·보존.

## 2026-11-01 실제 선택 과정의 한 번 자동 요약

- 사용자 후속 지시: 초기 요청의 독립 재생 단계/플레이어 제어를 대체하여, 발견별 ‘내 기록 살펴보기’의 긴 텍스트를 실제 선택 장면과 짧은 요약으로 함께 보여준다. 조사 방식과 전역 Scene은 추가/변경하지 않는다. 한 번 자동 진행하며 일시정지·재생·다시 보기·타임라인 탐색 버튼은 제공하지 않는다. 닫기/Escape는 항상 가능하고 다시 열면 최종 요약을 표시한다.
- 구현: useChoiceReplay 및 lib/replay의 세션 메모리 기록, 스타일을 고정한 읽기 전용 DOM 프레임, 실제 포인터 이벤트(지원 시 coalesced 좌표 포함), 크기·스크롤/호버·선택 변화 기록을 추가했다. root가 조작 가능해진 뒤 시작하고 확정 시 즉시 종료하며 Activity cleanup/탭 숨김/방문 초기화에 연결했다. 재생은 스크립트·미디어·통신이 금지된 iframe에 표시하므로 원본 선택 컴포넌트/분석/저장/소리를 재실행하지 않는다. textarea/input의 내용은 복제하지 않고 표시 크기만 유지한다.
- 화면: ReportStageFinding의 기존 근거 창 안에 ChoiceReplayPlayer를 배치했다. 2240×1260에서 창 1960×980, 상단의 비조작 타임라인과 왼쪽 실제 화면/오른쪽 요약을 사용한다. 같은 공간의 중복 근거는 묶고 공간 순서를 고정한다. 각 실제 선택 근처 최대 6초의 연속 구간을 원래 속도로 보여주며, 짧은 기록은 읽기를 위해 마지막 화면을 유지한다. 해당 행동의 기록이 없으면 명시하고 다른 행동으로 꾸미지 않는다. 전체 상세 보고서의 원문/수치는 유지한다.
- 실제 브라우저(localhost:5173/unanswered/): 사진 변경→단어 선택/해제→빛 저장→소리 청취/선택→위치→BACK 후 다른 소리 선택→기억 물건 선택/해제→문장 선택→빈칸 미응답→레이어→카메라 없는 공개→기존 조사 방식→발견→내 기록 창까지 확인했다. 새 관람으로 기억/그리기 여부/문장/빈칸의 추가 단계도 확인했다. DEV로 빛/기억부터 진입했으며 신규 등록/인트로 전체 연속 관람은 이번 검증이 아니다.
- 확인: 실제 커서/초기 상태·선택 변화·기억 SVG 원본 그림·스크롤을 재생에서 확인했고, 재생 화면 크기를 바꿔도 원본 배치를 비율로 보존했다. 초기 플레이어 단계 검증 후 사용자 후속 방향에 맞춰 제거했다. 최종 창에는 닫기 버튼만 남으며, 자동 단계 진행→요약 정지·닫기 후 재열기 시 재생 반복 없음·Escape 닫기·기존 발견/마무리/상세 보고서 접근·재시작/새로고침 Landing을 확인했다. 기록 없는 방문 안내는 초기 플레이어에서 확인했고, 최종 통합 창의 누락 기록 대응은 코드/단위 확인으로 검증했다. 2240×1260 창 수치와 가로 넘침 0 확인. 1280×720/기본 약 891×774에서도 배치 접근을 확인했다.
- 단위 확인: 같은 시각 이벤트의 순서/정지 구간의 좌표 유지/재방문 분리/StrictMode 사전 cleanup/방문 초기화/한 번 보기 초기화와, 타임라인 공간 순서/중복 제거/그리기·빈칸·소리 위치 근거와 영상 대응/없는 기록 대체 금지/원본 시간 보존/최대 6초 구간·읽기 최소 시간 확인 통과. 변경 대상 oxlint 및 git diff --check 통과. npm run build(tsc 포함) 통과, 기존 500kB 번들 경고 유지.
- 한계: 실제 iMac 하드웨어·다른 디스플레이 배율·카메라 사용·실제 터치/키보드 전용 방문·장시간 메모리 사용·휴대폰 QR 스캔/인쇄는 실측하지 않았다. 드로잉 선 자체 재생은 추가하지 않았고 해당 행동의 재생 기록이 없으면 요약으로 안내한다. 입력란에 작성한 문장은 재생 기록에 수집하지 않는다. 기존 해석 생성과 QR/인쇄 데이터는 수정하지 않았다. 기존 미커밋 Landing/wordmark/문서와 미추적 원본을 보존했다. commit/push/deploy 없음.

- 최종 통합 추가 확인: 새 실제 관람에서 그리기 여부 선택과 문장 빈칸 선택을 다시 기록한 뒤, ‘비워 둔 자리’ 발견의 내 기록 창에서 그리기 생략 화면→문장 질문 화면→요약 자동 진행을 확인했다. 재열기는 즉시 마지막 요약을 표시했고 조작 버튼은 닫기 1개였다. 2240×1260/1280×720/891×774에서 창 접근과 가로 넘침 0 확인. 캡처: /tmp/unanswered-choice-replay/imac-summary.jpg, summary-1280.jpg. 2240 미리보기 크기는 검증 후 기본 크기로 복원했다.

## 2026-11-01 재생 팝업 축소와 내부 내용 확대

- 사용자 후속 피드백에 맞춰 ChoiceReplayPlayer.tsx/.css와 기준 문서에만 추가했다. 다른 작업의 전역 타입/장면 CSS 및 기존 미커밋 작업은 수정하지 않았다.
- 2240×1260 실측: 팝업 1540×780(이전 1960×980), 재생 영역 약 1024×538. iframe 안의 실제 제목/선택지/이미지/버튼 경계에 여유 28px를 두고 맞춰 확대한다. 검증한 문장 기록의 원본 배율은 약 .53→.918로 증가했다. 원본 DOM 배치/스크롤과 커서 좌표는 그대로 두고 화면·커서 전체에 같은 확대/이동을 적용한다. 기록 크기마다 확대 범위를 고정하므로 선택 표시가 바뀔 때 줌이 흔들리지 않는다.
- 브라우저 확인: 기존 실제 문장/빈칸 기록의 큰 표시, 빈칸 버튼과 기록 커서 위치, 닫기/Escape 및 재열기 시 재생 반복 없음. 1280×720에서 창 1184×592/가로 넘침 0, 기본 창 복원과 새 탭 Landing 정상 표시 확인. 기존 데이터로 표시를 확인했으며 전 장면의 새 수집/전체 관람/실제 iMac 기기는 이번 크기 수정에서 재실측하지 않았다.
- npm run build(tsc 포함), 변경 파일 oxlint, git diff --check 통과. 기존 500kB 번들 경고 유지. 캡처 /tmp/unanswered-choice-replay/compact-summary.jpg. git diff --stat/status 확인, commit/push 없음.

## 2026-11-01 확대 재생의 내용 잘림 방지

- 변경: ChoiceReplayPlayer.tsx와 기준 문서만 추가 수정. 첫 프레임의 제목/버튼 경계를 고정하던 방식에서, 입력란·패널의 칠/테두리·직접 텍스트까지 포함하고 필요한 경우 표시 범위를 확장하도록 변경했다. 폰트 로딩 완료 후 재측정하고, 원본 영역 여유 32px/재생 면 안쪽 12px를 확보했다. 커서와 클릭 표시가 새 경계 밖으로 나오는 경우에도 같은 변환을 유지하며 범위를 확장한다. 팝업 크기는 1540×780 기준을 유지하며 원본 입력·재생 속도·타임라인·1회 제한은 보존했다.
- 브라우저: 기존 실제 문장/빈칸 기록을 2240×1260에서 확인했다. 원본 iframe의 기록 패널 제목/질문 제목/입력란/‘빈칸으로 남기기’/비활성 제출 버튼의 사각형을 현재 확대·이동 값으로 변환한 결과 5개 모두 재생 면 안에 완전히 포함됨을 수치 확인했다. 전체 입력란과 오른쪽 버튼까지 보이는 스크린샷 /tmp/unanswered-choice-replay/uncut-summary.jpg 저장. 1280×720에서 가로 넘침 0, 팝업 1184×592와 Escape 후 열기 버튼으로 초점 복귀 확인. 기존 기록의 표시를 검증했으며 모든 Scene의 새 관람/실제 iMac 하드웨어/모든 동적 레이아웃 조합은 새로 실측하지 않았다.
- npm run build(tsc 포함), 변경 파일 oxlint, git diff --check 통과. 기존 번들 크기 경고 유지. 기존 미커밋/동시 작업 보존, commit/push 없음.


## 2026-11-01 이야기·문장 단서·재생 중앙 정렬·휴대폰 기록 보강

- 사용자 이미지 1–5 반영: 문장 진입의 앞 이야기를 접기 없이 표시하고, 문장 선택 화면 오른쪽에 이전 빛·소리·물건 단서를 유지했다. 조사 기록 재생의 빈 공간 포인터 때문에 표시 범위가 치우치던 계산을 조정하고, 지연 로딩 CSS의 우선순위로 팝업이 좁아지는 문제를 수정했다. 최종 문서에서 사진과 색 기록을 왼쪽, 빛 그래픽을 오른쪽으로 교환했다. 기존 한 번 자동 재생·수동 재생 조작 없음·타임라인·닫기 및 기존 전시 흐름은 유지했다.
- QR/휴대폰: QR 모듈과 여백을 보존하며 정수 픽셀 배율로 줄였다(검증 자료 194×194, 이전 260×260). 링크 형식 v2는 선택 ID를 압축하되 선택 단서를 버리지 않으며 이전 v1도 읽는다. 휴대폰에는 원본 사진·색·소리 위치·기억의 방·전체 선택 문장·작성 응답·근거 요약을 보강하고 보고서 전체 PDF 저장용 인쇄 표시와 공유하기/복사 대체 동작을 추가했다. 이전 링크에 없는 응답은 미기록 사실을 안내한다.
- 저장소 미연결: 짧은 QR과 실제 화면 기록/그림/PC의 상세 근거 전달용 선택적 API 연결 코드를 준비했다. 환경 변수가 없으면 업로드하지 않는다. 계정 생성·외부 업로드·서버 배포·공개 사이트 배포는 하지 않았다. 실제 휴대폰 재생과 짧은 주소는 저장소 연결 후 검증해야 한다. 이번 사용자의 휴대폰 기록 요청에 따른 전송 확장 범위는 웹 선택 화면/입력이며, 카메라·마이크는 포함하지 않는다. 계약과 남은 설정은 [docs/REPORT_TRANSFER.md](./docs/REPORT_TRANSFER.md)에 기록했다.
- 브라우저: 2240×1260(iMac 24인치 논리 해상도 기준)에서 앞 이야기 자동 표시, 문장 선택/해제/확정과 우측 단서 요약, 카메라 없는 공개→조사 방식→발견→내 기록 재생→최종 문서, 사진/빛 교환과 QR 축소를 확인했다. 새 실제 문장 기록의 재생 창 1540×780/재생 면 약1023×538과 내용 중앙 배치를 확인했다. 휴대폰 390×844에서 상세 보고서·작성 응답·저장/공유 버튼을 확인했다. 캡처: /tmp/unanswered-feedback/sentence-clues.jpg, replay-centered.jpg, report-light.jpg, mobile-report.jpg.
- 자동 확인: v2/이전 v1 왕복·응답 보존·단서 누락 방지·잘못된 링크, 네이티브 공유/복사 대체/취소 통과. 전송 생성/조회·짧은 참조·없는 기록·잘못된 재생 자료는 가상 fetch로만 검증했다(실제 업로드 없음). 생성된 QR PNG의 디코딩은 통과했으나 축소된 브라우저 JPEG 캡처의 디코딩은 실패했으며 실제 휴대폰 카메라 스캔은 미검증이다.
- 한계: 실제 iMac 하드웨어·실제 휴대폰·저장소 왕복·공개 배포 링크는 미검증이다. PDF 버튼의 인쇄 호출 후 네이티브 창을 취소했으며 저장된 PDF 파일의 지면 결과는 검증하지 못했다. DEV의 수제 빛 규칙과 캐시 기반 휴대폰 빛의 완전 일치는 확인하지 않았다(저장소 자료는 원본 규칙 전달). 기존 재생 시간/재방문/새로고침 Landing 검증 범위는 이전 항목을 유지하며, 이번 작업에서 전체 인트로 연속 관람·카메라 사용은 반복하지 않았다.
- npm run build(tsc 포함) 통과, 기존 큰 번들 경고 유지. 대상 TS/TSX oxlint와 git diff --check 통과. 기존 미커밋·동시 작업 및 미추적 원본 보존. git diff --stat/status 확인, commit/push/deploy 없음.


## 2026-11-01 무료 저장소 연결 시작 — 로그인 대기

- 사용자의 연결 요청으로 Supabase 대시보드를 Chrome에서 열었으나 로그인된 계정이 없어 로그인 화면에서 사용자 진행을 요청했다. 약관 동의를 대신 진행하지 않았다.
- 준비: supabase/ 아래 비공개 저장 버킷/메타데이터/용량 예약 SQL과 보고서 생성·개별 조회 Edge Function 초안. 임의 주소·서버 전용 키·허용 origin·크기/분당/일일/총량 제한·동일 본문 중복 방지를 포함한다. UT 동의/설문은 아직 연결하지 않았고, 환경 변수가 없어 기존 외부 전송은 계속 비활성이다.
- 검증: 서버 가상 요청 테스트(CORS/본문 검증/저장·조회/중복/한도/설정 없음), 서버 handler TypeScript 검사, 대상 oxlint, npm run build 통과(기존 번들 경고). 실제 SQL 실행·배포·저장소 왕복은 로그인 전이라 미검증. 소스 화면 변경 없음, 기존 미커밋/미추적 작업·관람 흐름·카메라·일곱 소리 보존. git diff --check 및 diff --stat/status 확인. commit/push/deploy 없음. 설정은 docs/REPORT_TRANSFER.md에 기록했다.


## 2026-11-01 저장소 로그인 후 프로젝트 준비 / 보관 선택 추가

- Supabase 무료 UNANSWERED 조직 생성. 서울 리전·UNANSWERED 프로젝트 이름·테이블 자동 공개 해제·자동 RLS 설정 후, 새 데이터베이스 비밀번호는 사용자 직접 설정/프로젝트 생성을 요청했다. 버킷·서버·실제 연결은 아직 완료되지 않았다.
- FinalReportScene, FinalRecordLayer, FinalReportDetail와 ReportStorageOptIn을 연결해 보고서 진입 시 자동 전송을 관객의 명시적인 보관 버튼 이후 전송으로 변경했다. 안내에는 선택 화면/포인터/문장/그림 저장과 QR 주소 보유자 접근을 설명하고, 카메라/소리 제외·연구 활용과 별개임을 표시한다. 기존 QR/PDF/공유와 카메라 동의 위치/장면 흐름 보존. .env.example과 로컬 비밀 설정 제외 규칙 추가.
- 5174 임시 미리보기로 Landing, DEV 최종 문서의 보관 안내와 버튼, 선택 후 로컬 실패 안내·기존 QR/재시도 유지 확인. 기존 5173 유지. npm run build, 대상 oxlint, 서버 handler TypeScript 검사/가상 요청 테스트, git diff --check 통과. 실제 저장소 왕복·성공 후 QR 갱신·UT 설문은 미검증/미연결이다. 기존 미커밋/미추적 작업 보존. git diff --stat/status 확인. commit/push/사이트 배포 없음.


## 2026-11-01 Supabase 실제 연결 완료 — 로컬 앱

- Supabase 무료 UNANSWERED 프로젝트(서울, xmthtkgpwmvqhwuntfaj)에 비공개 버킷/메타데이터/요청 제한 SQL 적용 및 reports Edge Function을 배포했다. 서버 REPORT_HASH_SALT 설정, 기본 JWT 검증 ON 유지. 공개 anon JWT와 API 주소만 git 제외 .env.local에 연결했다. 서버 비밀 키 복사/노출 없음.
- 첫 가상 관람 전송에서 파생 객체에 의존한 effect가 저장을 반복하는 문제를 발견해 테스트 중단 후 버튼 이벤트로 수정했다. 진행 중/완료 후 중복 요청 방지와 이동 시 취소를 추가했다. 수정 뒤 서버 로그에서 한 번의 POST 200 및 GET 200을 확인했다. ReportQr는 qrcode 라이브러리가 덮어쓰는 CSS 크기를 생성 후 복원해 고해상도 캔버스와 표시 크기를 분리했다. 저장 완료 후 안내도 전체 기록으로 바뀐다.
- 브라우저: 새로고침 Landing, DEV 문장 진입→실제 선택/해제/재선택/응답→기록 레이어→카메라 없는 공개→조사 방식→발견→마무리→최종 문서→명시적 보관→짧은 @ QR 갱신 확인. 원격 기록을 새 로컬 보고서에서 GET하고 PC의 상세 근거/팔레트/문장/응답 복원을 확인했다. 조회 자료의 실제 화면/입력 기록 검증도 통과했다. 휴대폰 크기 390×844 표시 확인, 임시 배율 복원. 원래 IAB 관람 탭의 저장값은 조작하지 않았고 Chrome 시험 탭에서 가상 자료를 사용했다.
- 서버 권한/용량 SQL 검증: 시험 기록 2개, 총2,692,674바이트, 최대2,689,039바이트, 버킷 공개 false 및 anon 테이블 SELECT false. 새 문서 QR에서 표시 약186px/고해상도 canvas372px 확인.
- 미완료/한계: 공개 GitHub Pages 프런트 배포, 실물 QR 스캔, 실기기, 모든 Scene의 원격 재생/PDF 파일 출력은 미검증이다. 새로 수집한 문장 자료와 검증한 빛·소리 발견의 근거 장면이 달라 해당 발견의 실제 재생 화면은 검증하지 않았다. UT 동의/후기 설문 수집은 아직 켜지 않았다. 운영 전 보관 기간/삭제 절차 확정 필요.
- npm run build(tsc 포함), 대상 oxlint, 서버 handler TypeScript 검사, 서버 가상 요청 테스트 및 기존 공유/전송 왕복 테스트, git diff --check 통과. 기존 번들 경고 유지. git diff --stat/status 확인, 기존 미커밋·미추적 작업/카메라/일곱 소리/장면 흐름 보존. commit/push/공개 사이트 배포 없음(저장 API만 배포). 자세한 연결 상태는 docs/REPORT_TRANSFER.md.


## 2026-11-01 지금까지의 앱 수정 전체 공개 배포

- 사용자의 명시적인 전체 배포 요청으로 현재 작업 트리의 앱 소스를 npm run deploy로 빌드해 GitHub Pages에 게시했다. 소스 브랜치 커밋/푸시는 하지 않았으며, 기존 배포 방식의 gh-pages 게시 커밋 6460c71fea27b98b31f3a8de5a6d7227bda34781만 생성/반영됐다. 기존 미커밋·미추적 원본은 보존했다. 소스와 연결되지 않은 문서/실험 시안/ZIP/비밀 설정 파일을 공개 자료로 추가하지 않았다.
- npm run build(tsc 포함) 및 deploy Published 통과(기존 번들 크기 경고). GitHub pages build and deployment 실행 41281571960 success/completed 확인. 공개 HTML의 main-B9GVnDqv.js가 이번 dist/index.html과 일치한다.
- 실제 공개 브라우저에서 새 Landing→Elevator Entry 진입과 새로고침 Landing, DEV 미표시 확인. 공개 @ 보고서 주소로 Supabase 자료 GET에 성공하고 상세 근거/원본 사진/팔레트/고른 전체 문장/시험 작성 응답/PDF·공유 버튼 복원을 확인했다. 휴대폰 390×844 표시 확인 후 배율 복원. 캡처 /tmp/unanswered-public-landing.jpg, /tmp/unanswered-public-report.jpg.
- 보존/한계: 카메라 동의/종료와 일곱 소리/기존 전시 흐름을 변경하지 않았다. 이번 배포 검증에서 전체 영상 연속 관람·실기기/물리 QR 스캔·저장된 PDF 출력·공개 환경의 신규 업로드 전 과정을 반복하지 않았다(로컬 실제 업로드는 이전 항목에서 확인). UT 활용 동의/후기 설문은 아직 미구현/미수집이다. git diff --check 및 diff --stat/status 확인. 공개 주소 https://libe396.github.io/unanswered/.


## 2026-11-01 엘리베이터 안내 읽기 시간 확대

- 사용자 피드백에 따라 IntroScene.tsx에서 ‘기록은 여러 방에 흩어져 있습니다.’의 상태 전환 간격을 일반 모드 1초→3.2초로 늘렸다. 추가 읽기 시간 2.2초는 reduced motion에서도 축소하지 않는다. 도착 문구/기록 열기 버튼도 같은 만큼 뒤로 이동해 기존 순서를 유지한다. 문 열림·사운드·출발·층 표시·다음 영상 흐름과 기존 미커밋 변경은 보존했다.
- 로컬 브라우저에서 해당 문구 표시→도착/기록 열기 버튼→인트로 영상 실제 재생(readyState4, paused=false)을 확인했다. 새로고침 Landing 확인. 3.2초는 타이머 설정값이며 브라우저 프레임 단위 실측은 하지 않았다. 실제 reduced motion 환경/실기기는 미검증이다.
- npm run build 및 대상 oxlint/git diff --check 통과(기존 번들 크기 경고). 기존 배포 요청의 후속 수정으로 npm run deploy Published. 작업 브랜치 소스 커밋/푸시 없이 gh-pages 배포만 진행했다. 공개 반영 결과는 아래 후속 검증에 기록한다.

- 공개 후속 검증: GitHub 배포 실행 41281855165 success/completed, gh-pages b08f692320c5dffa986e505ead158b4f305f9f28. 공개 HTML의 main-BrbSQwkz.js가 이번 빌드와 일치하고 실제 공개 엘리베이터에서 해당 문구 표시를 확인했다. 캡처 /tmp/unanswered-elevator-reading-public.jpg.


## 2026-11-01 이미지 피드백 1–4 디자인 조정

- 1: MemoryRoom.tsx/.css에서 선택 번호의 사각형을 지름38px 반투명 원형으로 바꾸고, 물건 이름을 높이36px/반경8px의 반투명 박스로 조정했다. 얇은 밝은 테두리와 글자 그림자로 가독성을 유지한다. 물건 도형·포인터/키보드 대상·선택/해제 로직은 변경하지 않았다.
- 2: StageHeader.css의 공통 부제목→제목→설명 간격을 12px→8px, 제목/설명 행간을 1.35/1.45로 줄였다. SentenceCluesScene.css에서 헤더 묶음 아래 여백을 추가해 iMac 기준 카드와의 간격32px를 확인했다. 우측 이전 단서·20개 카드·선택 수/확정 조건 유지.
- 3: RecordLayerSecondVisitScene.css의 데스크톱 상단 정렬을 center/safe center로 변경했다. 2240×1260에서 왼쪽 stage/오른쪽 content/전체 layout의 세로 중심이 모두630px로 일치한다. 좁은 화면의 기존 세로 스크롤/상단 시작 규칙과 레이어 선택·회전은 유지한다.
- 4: ReportStage06SubjectReveal.css의 ‘모은 단서를 하나로 맞춰 보았습니다.’와 마지막 ‘그 사람을 바라보는 동안…’을 공통 타입 한 단계인32px→28px로 줄였다. 공개 애니메이션/카메라 동의 문구와 위치/카메라 종료 처리·조사 방식 연결은 보존했다.
- 브라우저: 2240×1260에서 기억 선택·해제·재선택→그리기 생략→문장3개 선택→확정/빈칸 유지→기록 레이어 열기→카메라 없는 공개→조사 방식까지 확인했다. 원형38×38/이름 박스112×36/배경 alpha0.48, 헤더 간격8px·카드 간격32px, 공개 문구28px를 측정했다. 1280×720에서 문장 버튼 아래593px, 기록 확인 버튼 아래571px로 화면/HUD 안전 여유 안에 있고 가로 넘침0이다. 마지막 공개 문구 아래604px 확인. 새로고침 Landing 및 미리보기 크기 복원. 실제 iMac 기기/터치/카메라 사용/공통 헤더를 쓰는 모든 Scene은 이번에 재검증하지 않았다.
- 캡처: /tmp/unanswered-feedback-memory.jpg, /tmp/unanswered-feedback-sentence.jpg, /tmp/unanswered-feedback-record-center.jpg, /tmp/unanswered-feedback-reveal-setup.jpg, /tmp/unanswered-feedback-reveal-final.jpg. npm run build, 대상 oxlint/git diff --check 통과(기존 번들 경고). 기존 미커밋·미추적 원본 보존, git diff --stat/status 확인. 기존 배포 요청의 후속으로 npm run deploy Published; 소스 브랜치 커밋/푸시 없이 gh-pages 게시만 진행했다. 공개 반영 결과는 후속에 기록한다.

- 공개 후속 확인: 배포 실행41282578152 success/completed, gh-pages3c8dd32cbe471f00e4d143febf71147555248e94. 공개 HTML의 main-Dwfymw65.js가 이번 빌드와 일치하고 새 Landing 표시를 확인했다. 공개 환경에서 네 Scene 전체 관람은 반복하지 않았다.


## 2026-11-02 단서 선택 카드 전면 이동

- 사용자 요청으로 RecordLayerSecondVisitScene.tsx/.css만 기능 수정. 카드의 정체/내용/DOM은 유지하면서 클릭한 단서를 전면 slot4에 배치하고, 나머지 세 카드는 원래 순서로 뒤쪽 slot에 놓는다. 기존0.9초 transform 전환으로 선택 카드는12px 위/앞쪽80px로 올라오며 테두리와 유리면을 조금 더 또렷하게 한다. 기존 hover 미리보기·같은 단서 재클릭 해제·키보드 버튼 조작·카드 내용·확인 흐름은 유지한다. reduced motion의 기존 transition:none도 유지한다.
- 브라우저(로컬, DEV 가상 자료): 2240×1260에서 빛/소리/기억/문장 선택과 각 pinned 카드의 slot4, 빛 카드의 실제 matrix z80 및 다른 카드 z-360/-240/-120을 확인했다. 빠른 연속 변경·동일 단서 해제·Enter 선택·기록 확인 후 기존 카메라 동의 화면 진입 확인.1280×720와800×900에서 최종 카드 배치가 화면 안에 들어옴을 확인했다(800폭 settled left60/right761). 화면 크기 변경 직후의 전환 도중 모든 프레임과 실제 reduced motion/실기기는 실측하지 않았다. 캡처 /tmp/unanswered-card-front-light.jpg, /tmp/unanswered-card-front-memory.jpg, /tmp/unanswered-card-front-narrow.jpg.
- 선택/관람 저장·카메라/소리·장면 순서·기존 중앙 정렬/미커밋 작업은 보존했다. npm run build(tsc 포함), 대상 oxlint/git diff --check 통과(기존 번들 경고). 기존 공개 배포 요청의 후속으로 npm run deploy 진행. 소스 브랜치 커밋/푸시 없이 gh-pages 게시만 수행하며 공개 결과는 후속에 기록한다.

- 후속 검증/공개: 새로고침 Landing 확인 및 배율 복원. npm run deploy Published, 배포 실행41322606721 success/completed, gh-pages fd7a23c6b2a6a86fa4ab6649c15066e1c1f217c1. 공개 HTML의 main-DCdsMUQ5.js가 이번 빌드와 일치함을 확인했다. 공개 환경에서 해당 장면까지 전체 관람은 반복하지 않았다. git diff --stat/status 확인.


## 2026-11-02 카메라 안내 문장별 줄바꿈

- 사용자 브라우저 코멘트에 따라 CameraOptIn.tsx의 확정 안내 두 문장 사이에 br만 추가했다. 문구·두 버튼·동의 위치·카메라 동작은 보존했다. 기존 미커밋 변경 보존.
- 2240×1260 로컬 브라우저에서 문장별2줄(본문 약57.6px/행간28.8px), 두 버튼 표시 확인. 카메라는 실행하지 않았다. 캡처 /tmp/unanswered-camera-sentence-break.jpg. npm run build(tsc 포함), 대상 oxlint/git diff --check 통과(기존 번들 경고). git diff --stat/status 확인. 기존 배포 요청의 후속으로 배포 진행, 소스 브랜치 커밋/푸시 없음.

- 공개 후속: deploy Published, 배포 실행41323303513 success/completed. 공개 main-sudnm25d.js가 이번 빌드와 일치한다. gh-pages be4c6c94513eba3b5df2ce4a6ef39e84602c265f, 소스 브랜치 커밋/푸시 없음.


## 2026-11-02 QR 근거 안의 선택 화면 재생과 선택형 후기

- 사용자 정정 반영: PC 최종 문서의 ‘화면 기록도 함께 가져가기’ 별도 섹션을 제거했다. archive 진입 시 전체 보고서를 한 번 준비하고 QR 안의 각 ‘이 해석의 근거’에 해당 장면·단계의 실제 기록을 읽기 전용으로 삽입한다. 별도 모달/다운로드/재생 버튼 없이 영역이 보일 때 원래 속도 1×로 한 번 재생한다. 기존 선택 순간 요약 구간을 사용하며 멈춤/반복 조작은 추가하지 않았다. 맞는 기록이 없으면 짧게 안내한다. 새 해석·가짜 커서·카메라/마이크 수집 없음.
- PC 및 QR 보고서 끝에 ‘약 1분 · 후기 남기기’를 추가했다. 전시 의미/재생 도움 정도/불편한 순간을 선택 응답한다. 후기 연구 활용 동의와 관람 기록 연구 연결 동의는 분리했고 모두 기본 미체크다. 후기는 선택 참여이며 보고서 열람·저장·공유와 독립적이다.
- 사용자 확정 6개월 보관: 비공개 exhibition_feedback 테이블, service-only 함수 및 POST /reports/feedback 배포. 후기 응답/선택적 report_id 연결은 생성 시각+6 calendar months 만료, 매일 pg_cron 정리(17 3 * * *, UTC)를 설정했다. 기존 QR 열람용 파일은 별도 보관이며 이 작업으로 삭제하지 않는다. 익명/인증 사용자 직접 읽기 권한 없음, RLS 켜짐. 링크를 아는 사람이 볼 수 있는 QR 보고서와 연구용 후기 접근은 분리했다.
- 실제 검증: 390×844 QR 보고서에서 직접 조작해 남긴 기존 문장 선택 기록을 근거 안에 표시했다. 중립적 ‘연결 확인용 시험 기록’ 보고서를 별도 생성했으며 새 움직임이나 해석을 꾸미지 않았다. PC DEV 가상 관람 최종 보고서 자동 QR 준비, 설문 입력 중 QR 주소 유지, 후기만 제출/관람 기록 동의 후 제출 모두 실제 API 성공. 소유자 SQL 조회에서 각각 record_consent/linked=false/false와 true/true, 두 행 모두 six_months=true, anon_can_read=false, RLS=true 확인. 일일 정리 작업 active=true 확인. 새로고침 Landing 확인.
- 검증: npm run build(tsc 포함), 대상 oxlint, git diff --check, 서버 API/클라이언트 전송·동의 분리·기존 v1/v2 링크·공유 테스트 통과. 기존 큰 번들 경고 유지. 실제 6개월 경과 후 정리/물리 QR 스캔/모바일 실기기/모든 장면의 전체 신규 관람은 미검증이다. QR 안 재생 검증은 실제 문장 기록 중심이며 기존 PC 타임라인·개인 해석 계산·전시 순서·일곱 소리·카메라 동의/종료·PDF/공유를 보존했다.
- 수정 범위: ExhibitionFeedback 컴포넌트/CSS·클라이언트, 보고서 전송/PC 최종 문서/QR 모바일 보고서/ChoiceReplayPlayer, Supabase 후기 migration/handler/tests. 기존 미커밋·미추적 작업 보존. 소스 커밋/푸시 없음. 캡처 /tmp/unanswered-qr-inline-evidence.jpg, /tmp/unanswered-feedback-phone-form.jpg. 공개 배포 결과는 후속에 기록한다.

- 공개 후속 검증: npm run deploy Published, GitHub Pages 실행41327431055 success/completed, gh-pages7e067314b9c1cbb576e308062d49b44629a4ef4f. 공개 main-CbFRUR7D.js가 빌드와 일치하며 실제 공개 @ 보고서에서 근거 안의 iframe 재생과 후기 폼/6개월 안내를 확인했다(390×844). 캡처 /tmp/unanswered-qr-evidence-public.jpg, /tmp/unanswered-feedback-public.jpg. 테스트 자료만 사용했으며 별도 연구 데이터 공개 경로는 만들지 않았다. 미리보기 크기 복원/시험용 로컬 탭 정리. 기존 미커밋 상태 보존, 소스 커밋/푸시 없음.


## 2026-11-02 전시 소개 3탭 및 도록 등록

- 사용자 계획에 따라 /catalog/를 Overview / Research / Result로 구성했다. Overview는 표지·마무리를 포함한5개 챕터로, 한 챕터를 위해 여러 화면 길이를 스크롤하던 pinned 연출을 새 소개에서 사용하지 않는다. 기존 Cine/Static/Extras와 원문 데이터 파일은 삭제하지 않았다. Research는6주제/기존11기록 목록→선택한 상세1개→원본 펼침 구조이며 기존 ArchivePart의 블록 렌더러를 재사용한다. 주제 필터·목록 스크롤·상세 스크롤/원문 펼침·도록 종류/페이지는 탭 전환 후 유지한다. 키보드 방향키/Home/End 탭 이동, 기존 해시와 popstate를 지원한다.
- Figma 연구패널924:265의 코드/이미지 컨텍스트를 확인했다. 웹도록873:2514 전체 컨텍스트는 시간 초과되어 구조 메타데이터와 각 원본 노드의 download_assets export로16개 보이는 챕터를 확인/등록했다. 인쇄도록470:213의 내지3개 노드를 각각 등록했다. 원본 이미지의 편집·비율을 보존하며 전체를 긴 이미지1장으로 붙이지 않았다. SVG를 새로 그리거나 원본 파일을 덮어쓰지 않았다. Result의 한 면/펼침면·각 면 확대·원본 크기 스크롤·Escape 닫기 제공. 인쇄 PDF 다운로드는 실제 파일이 없으므로 미연결이다. 신규 파일과 원본 노드 대응은 public/catalog/results/sources.json에 기록했다.
- 브라우저(기존 localhost:5173 유지, Chrome 시험 탭):
  - 1920×936: Overview5챕터, 챕터2의 원본/G2/G3 이미지 로드 확인. 패널 높이860/문서4304px으로 약5화면. 챕터 이동·이미지 fit:contain 확인.
  - 1440×900: 패널824px, 각 챕터 clientHeight824px/하단804px(버튼 잘림0), 가로 넘침0. 실제 휠 스크롤 후 챕터2에 스냅·현재 챕터 표시 갱신 확인. 규칙 비교4개 이미지 로드와 실제 초안 사용 확인. Overview 챕터4→Result→Overview의 스크롤2475px 복귀 확인.
  - Research:6주제 필터(공간과 동선2개), 상세5단계, 첫 기록 원문 펼침/연구 이미지7점 로드, 상세 scrollTop954px에서 다른 탭 왕복 후954px/원문 열린 상태 유지 확인. #archive-04 직접 진입→다음 기록→브라우저 뒤로 가기로 원래 기록 복귀. 모바일 상세 가로 넘침0.
  - Result: 웹도록 기본 선택, 이전/다음·썸네일·16개 마지막 페이지/다음 비활성 확인. 원본 도입면1920×280 로드 확인. 인쇄 내지3면·펼침면2개/마지막1개·한 면 보기 구현. 확대 후 원본 이미지1920px/스크롤 영역1968×1389px 확인, 도구줄 고정·Escape 닫기 확인. 모든19개 도록 원본/썸네일과8개 연구 자산의 파일 크기·원본 픽셀 치수 검증.
  - 1135×774: 가로 넘침0, 챕터 높이698–703px/패널698px. 390×844: 가로 넘침0/모든 챕터 가로 넘침0, 내용에 맞게 챕터 높이 확장·약한 스냅, 2열 규칙 도판/연구 필터·상세/가로 도록 목차 확인. 모바일 문장 사이 줄바꿈과 마지막 펼침면 빈 열을 보정했다.
  - 새 Landing→전시 소개→Overview→전시 입장→Landing→시작→ZONE01 Elevator Entry 도착, 새로고침 Landing을 확인했다. 로컬 소개 미리보기 탭은 남기고 임시 화면 크기를 기본값으로 복원했다.
- 캡처: /tmp/unanswered-catalog-overview.png, /tmp/unanswered-catalog-result.png. 코드/자산 수정 뒤 npm run build(tsc 포함), 대상 oxlint·git diff --check 통과. 기존500kB 번들 경고 유지. 기준 문서의 기존 내용은 보존하고 이 기록만 추가했다. git diff --stat/status 확인, 소스 commit/push 및 공개 배포 없음.
- 한계: 실제 iMac/터치 기기·실제 reduced-motion OS 환경·Safari·인쇄 출력은 새로 검증하지 않았다. 움직임 줄이기 분기는 코드/CSS 확인으로 한정한다. 인트로 이후 전체 전시·카메라·개인 보고서/QR은 이번 소개 작업의 수정 대상이 아니며 재검증하지 않았다. 기존 원문 아카이브의 미제공 선택적 이미지 슬롯은 기존 숨김 동작을 유지한다.


## 2026-11-02 전시 소개 후속 — 정적 밀도 축소와 웹도록 원본 등록

- 사용자 정정: 웹도록은 각색 없이 자체를 업로드하고, 생략한 인터랙션을 살리며 여백·텍스트 밀도를 다듬는다. 앞선 실행 기록의 ‘웹도록16개 챕터 뷰어’는 이 요청으로 대체한다. Overview의 짧은5챕터/스냅과 Research 독립 탭은 유지한다.
- Overview.tsx는 문단과4개 도판의 동시 나열을 줄이고 한 장면의 한 반응을 중심으로 구성했다. 기존 FinalViewer를 그대로 재사용해 슬픔/불안/슬픔+불안 선택과0.6초 결과 크로스페이드를 복원했다. 제작4단계는 버튼으로 전환하며 전체 스크롤 길이는 늘리지 않는다. Framer Motion 글자 등장·단계 전환, 이미지 초점/기울기 반응, 원본/G2/G3 강조/확대, 감각 공간 전환, 기록 카드 선택/전면 배치, 메모리 내 체류 응답을 추가/복원했다. 세 기록은 노출된 선택 버튼으로도 고를 수 있다. 이동하지 않는 동안 본문을 시간에 따라 교체하지 않는다. reduced motion은 정적/즉시 전환 분기를 유지한다.
- editorial.css에서 소개 폭1120→최대960, 안쪽 여백 확대, 제목28px/모바일24px과 짧은 캡션 위주로 조정했다. Research 목록은 제목/기간 위주로 읽게 했으며 상세와11개 원문은 보존했다. 모바일 FinalViewer의 기존 width50%/세로 화살표와 figcaption flex 충돌을 소개 안에서만 보정했다. 다른 장면·전역 타입는 수정하지 않았다.
- Result: Figma873:2514의 전체 export(JPEG1920×31320)를 그대로 다운로드했다. 가공/재압축/분할/재배열 없이 파일1개를 표시한다. 새 임의 목차·제목·이전/다음 UI는 웹도록에서 제거했고 웹/인쇄 전환, 화면 너비/원본 크기, 원본 파일 다운로드만 남겼다. Result 진입 전에는 원본을 요청하지 않는다. 기존 분할 자산은 삭제하지 않았지만 웹 화면에서 사용하지 않는다. 파일 출처·32,924,611bytes·SHA-256은 sources.json에 기록했다. 다운로드 이후 크기/해시 불변과1920×31320 치수를 검증했다.
- 브라우저 Chrome(기존5173 유지):
  - 1440×900에서5챕터 clientHeight824px/패널824px, 1135×774에서 각각698px/패널698px과 모든 하단 버튼 안쪽 배치를 확인했다. 가로 넘침0. 개별 도판/본문을 동시에 나열하던 이전 구성을 실제 렌더와 비교했다.
  - 빛 키보드 초점으로 blur7px→0 및3D 기울기 해제 확인. G3 선택/캡션 갱신→선택 이미지 확대→Escape 닫기 확인. 소리 공간 선택 후 scene-sound.jpg 교체/크로스페이드, 제작 초안/변환 전환, 불안 선택 후 final-anxious.jpg/선택 상태 확인. 조사원증 선택 버튼으로 카드 front/slot0 변경 확인. 마지막 장면에 실제 페이지 체류 결과가 표시됨을 확인했다(시험 수치는 관객 심리가 아니다).
  - 390×844에서5챕터 내부 가로 넘침0·문서 가로 넘침0, 원본 사진 폭100px/설명 가로 읽기·감정 버튼·확대 동작 확인. 원본 웹도록은 한 이미지로naturalWidth1920/naturalHeight31320, 화면 너비 보기와 원본1920px 보기(내부만 가로 스크롤, 바깥390px 유지) 확인. Result의 scrollTop1800px을 다른 탭 왕복 후 유지했다.
  - Result의 웹 원본은 이미지1개/페이지 이동 UI0개이며 실제 연속 스크롤을 확인했다. 인쇄도록2면 펼침→마지막3면/다음 비활성 확인. 새 Landing→전시 소개의 Overview 기본 선택/원본 미요청→전시 입장→Landing→엘리베이터 도착 및 새로고침 Landing 확인. 브라우저 오류 로그0. 임시 화면 크기는 복원했다.
- 캡처: /tmp/unanswered-catalog-revision-process.png, /tmp/unanswered-catalog-revision-original.png. npm run build(tsc 포함), 대상 oxlint·git diff --check 통과(기존500kB 번들 경고 유지). git diff --stat/status 확인. 원문 데이터·기존 미커밋/미추적 작업·본 전시 동선/저장/카메라/일곱 소리/보고서·QR 보존. commit/push/공개 배포 없음.
- 한계: 실제 iMac/터치 기기·Safari·실제 reduced-motion OS·인쇄 출력은 미검증이다. 영상 전체와 본 전시의 이후 관람은 이번 소개 변경에서 반복하지 않았다. 웹도록은 요청대로 원본 파일 자체이므로 원본의 긴 세로 구성과 글자 크기를 유지하며, 읽기 확대는 원본 크기 보기로 제공한다.


## 2026-11-02 전시 후기 공용 QR

- 사용자 요청으로 공개 #/feedback 전용 주소를 추가했다. 기존 ExhibitionFeedback 양식이 처음부터 열린 상태이며 개인 보고서 없이 후기만 남긴다. 공용 QR에는 관람자/보고서 ID가 없고 연구용 관람 기록 연결 동의도 표시하지 않는다. 후기 활용 동의와6개월 보관은 기존 정책을 유지한다.
- 변경: src/App.tsx, ExhibitionFeedback.tsx의 standalone 옵션, 새 FeedbackPage.css 및 outputs/unanswered-feedback-qr.png(1200px)/svg/preview.png(360px). QR 여백4모듈·흑백·오류복원M, OpenCV로 실제 PNG를 해독해 공개 전용 주소와 일치 확인.
- 로컬390×844에서 양식 기본 펼침/가로 넘침0, 시험 응답을 실제 서버에 전송하고 감사 메시지 확인. 공용 후기에는 reportRef를 보내지 않는다. UNANSWERED 링크로 기존 Landing 복귀를 확인하며 미리보기 크기를 복원한다. npm run build 및 대상 oxlint/git diff --check 통과(기존 큰 번들 경고). 물리 휴대폰 스캔은 미검증이다.
- 기존 미커밋/미추적 작업·개인 보고서와 QR·카메라·전시 장면 순서 유지. 소스 commit/push 없음. 공개 배포 결과는 후속에 기록한다.

## 2026-11-02 소개 페이지 최신 원본·오른쪽 설명·유리 표면 점검

- 사용자 확정에 따라 Figma 최신 원본572:174의 이미지로 교체했다. 대표 이미지·4공간·보고서/조사원증/편지·초안과 감정 그래픽을 public/catalog/latest에 별도 보관하며 기존 자산/역사 리서치 자료는 삭제하지 않았다. 변환 원본/슬픔/불안은 작은 프레임과 같은 이미지임을 비교 확인하고 고해상도 원본을 사용했다.
- Overview/Research 제목은600. 데스크톱 제목 왼쪽/설명 오른쪽·왼쪽 정렬, 같은 작업 폭의 유리 패널로 설명·도판·조작을 정리했다. 모바일은 한 열로 읽히게 한다. 본 전시 전역 타이포/장면은 수정하지 않았다. 원본/G2/G3 강조, blur→focus, 공간 크로스페이드,4단계,3감정,기록 카드/체류 응답/확대를 유지한다.
- 최신 웹도록은572:174의 보이는16직계 자식을 원래 좌표와 치수로 합친 무손실 PNG 한 장(1920×32785,49,978,726bytes)이다. 전체 프레임 export의 자동 축소를 피하기 위한 원본 위치 조립이며 디자인/문구/순서/간격은 수정하지 않았다. latest-original-sources.json에 노드별 출처/좌표/크기 및 해시를 기록했다. 이전873:2514 JPG는 보존했다. Result는 단일 이미지 연속 보기와 원본 크기/다운로드를 유지한다. 원본 특성상 길고 약50MB이며 Result 첫 방문 때 로드한다.
- Chrome1440×900 실제 렌더 캡처 /tmp/unanswered-catalog-glass-process.png. 설명 오른쪽·textAlign left·fontWeight600 확인.1135×774에서5섹션698px/하단버튼678px/가로 넘침0.390×844에서 각 섹션과 문서 가로 넘침0. 공간 소리 이미지 전환/감정 불안→슬픔/조사원증 선택→최신 이미지 확대→Escape 닫기 확인. Research 오른쪽 설명 렌더 확인. Result 최신 PNG natural1920×32785 정상 로드, 인쇄 마지막3면/다음 비활성 확인.
- npm run build(tsc 포함), 대상 oxlint·git diff --check 통과(기존 번들 크기 경고 유지). 기존 Landing/입장 흐름과 본 전시 상태·카메라·일곱 소리·보고서·QR 코드 변경 없음. 실제 Safari/터치기기/전체 본 전시 재관람은 이번 범위에서 반복하지 않았다. git diff --stat/status 확인, commit/push/공개 배포 없음.
- 추가 동선 확인: 소개의 전시 입장→Landing→시작→Elevator Entry 도착, 새로고침→Landing, 전시 소개→Overview 기본 탭 확인.

- 공개 후속: deploy Published, Pages 실행41330591559 success, gh-pages c3a11a473504f511e06b35bb3d3ecae3ab8ad99e. 공개 #/feedback에서 양식 기본 펼침과 main-D_Eo1XST.js 일치를 확인했다. 공개390×844 캡처 /tmp/unanswered-feedback-qr-public.jpg. git diff --stat/status 확인, 소스 commit/push 없음.


## 2026-11-02 후기 QR 흰색/투명 버전

- 사용자 요청으로 outputs/unanswered-feedback-qr-white.png(1200px), white-preview.png(360px), white.svg를 새로 생성했다. 원래 흑백 버전·후기 주소·페이지·저장 동작은 유지한다. 배경 alpha0/QR 흰색 alpha255 및 반전 검증 영상에서 OpenCV 해독 주소 일치를 확인했다. 실제 기기의 흰색 QR 스캔은 미검증이며 어두운 배경에 배치하는 버전이다. 소스 commit/push·공개 배포 없음. 빌드와 git 확인 결과는 후속 기록한다.

- 후속 검증: npm run build(tsc 포함) 통과(기존 큰 번들 경고), git diff --check/stat/status 확인. 실제 투명 PNG 미리보기 확인. 기존 미커밋 작업 보존, 소스 commit/push 없음.

## 2026-11-02 소개 페이지 반복 카드 제거 점검

- 사용자 후속 요청에 따라 src/catalog/glass.css 범위에서 도판 외곽 카드·그림자·모서리와 하단 박스를 제거했다. 도판은 여백에 직접 놓고 공간 이미지는 최대37dvh로 확대했다. 설명 오른쪽/왼쪽 정렬·600 제목·이미지 최신본은 유지한다. 유리 효과는 설명 옆 얇은 선과 서서히 사라지는 반투명 면으로 한정했다. 감정 버튼은 밑줄 표시로 정리했다. 실제 기록물 겹침/선택 인터랙션은 유지한다.
- Chrome1440×900 공간/변환 렌더와 소리 공간·불안 감정 선택 확인.1135×774에서 panel698px/5섹션698px, 각 가로 넘침0/도판 border0/제목weight600 확인.390×844에서 반응형 확인. 모든 자산·JS 동작·Result 원본·Landing/본 전시 장면 코드는 변경하지 않았다.
- npm run build(tsc 포함), git diff --check 통과(기존 번들 크기 경고). git diff --stat/status 확인. 기존 다른 변경 보존. commit/push/공개 배포 없음.


## 2026-11-02 후기 페이지 로고·스크롤·질문 정정

- 사용자 피드백: 후기 전용 페이지의 일반 텍스트 UNANSWERED를 기존 src/assets/wordmark.svg 실제 로고로 교체했다. 전시 전역 overflow:hidden/clip은 유지하면서 후기 main만 fixed inset0/100dvh/overflow-y:auto로 만들어 독립 스크롤을 보장했다. 안쪽 최대636px/모바일24px 여백, 하단 안전 여백을 유지한다.
- 공유 후기 컴포넌트의 제목은 ‘이 전시가 당신에게 어떻게 다가왔나요?’, 설명은 ‘짧은 후기를 남겨주세요. 다음 전시를 위한 소중한 자료가 됩니다.’로 변경했다. Q1–Q3 번호를 붙이고 ‘해당 장면을 보지 못했습니다.’ 선택지를 제거했다. 기존 저장 자료의0값 호환/서버 스키마·6개월 보관·선택적 연구 연결과 개인 보고서 흐름은 변경하지 않았다.
- 수정: src/App.tsx, src/components/FeedbackPage.css, ExhibitionFeedback.tsx 및 두 기준 문서. 390×844 브라우저에서 실제 SVG 로드/가로 넘침0, content1219px 대 viewport844px, 실제 스크롤 scrollTop375.5와 마지막 버튼 y730–780px로 화면 안에 들어옴 확인. 번호/새 문구/삭제 선택지 확인. 127.0.0.1 로컬 제출은 CORS 연결 실패로 완료되지 않았고 입력/재시도 상태는 유지됨을 확인했다. 실제 공개 저장 검증은 후속에 기록한다.
- npm run build(tsc 포함), 대상 oxlint, git diff --check 통과(기존 큰 번들 경고). 기존 미커밋/미추적 작업 보존. QR 주소/이미지는 동일하게 사용하며 소스 commit/push 없음. 실제 Safari/터치 기기 스크롤은 미검증이다.

- 공개 후속: deploy Published, Pages 실행41385287841 성공/gh-pages a62dccdcfd6cbaa7b17a739f190e626292261d45. 공개 main-Cv-_quRY.js 일치. 공개 시험 응답 실제 제출 후 감사 메시지 확인. 공개390×844에서도 실제 스크롤375.5px/보내기 버튼 하단779.95px/가로 넘침0, SVG 로드 확인. 캡처 /tmp/unanswered-feedback-fixed-mobile.jpg. 임시 배율 복원. git diff --stat/status 확인, 소스 commit/push 없음.

## 2026-11-03 소개 표지 로고 점검

- Overview 01 챕터 제목을 실제 wordmark.svg로 교체했다. 흰색 단색 로고가 어두운 표지 위에서 기존 Semibold 텍스트와 비슷한 광학 폭을 갖도록 clamp(200px,24vw,320px)로 맞췄다. 비율은 원본 321.77×63.77을 유지한다.
- 접근성: h1은 글자가 비었고 img alt="UNANSWERED"가 이름을 제공하므로 aria-labelledby="overview-01-title"가 그대로 동작한다. reduced-motion 분기와 챕터 스냅은 변경 없다.
- 1440×900·903px·390×844 실제 렌더에서 가로 넘침0, 챕터 높이 824px 유지, 콘솔 오류0. 실제 Safari·터치 기기는 미검증이다.

## 2026-11-03 표지 전면 이미지 점검 (아이맥 24인치 기준)

- 01 챕터는 이제 패널이 없는 전면 이미지 표지다. 딤은 가로(좌 .9 → 우 .42)와 하단(.8 → 46%) 두 겹만 쓰고, 모바일에서는 아래쪽이 짙어지도록 방향을 바꾼다. 선은 '전시 입장' 밑줄 하나로 제한했다.
- 배경은 .overview-chapter--01을 기준으로 absolute 배치하므로 1040/1400px 본문 칸과 무관하게 화면 끝까지 찬다. 섹션에 overflow:hidden을 줘 scale(1.03)이 가로 스크롤을 만들지 않는 것을 확인했다(scrollWidth=clientWidth).
- 2240×1260에서 배경 2240×1184·본문 칸 1400px·로고 434px·본문 21px, 02–05 챕터는 1040px 그대로. 1440×900 로고 322px·본문 17.2px. 390×844 로고 200px·본문 15px·리드 오른쪽 끝 366px.
- 접근성: h1은 글자가 없고 img alt="UNANSWERED"가 이름을 제공하므로 aria-labelledby가 유지된다. 배경 img는 alt=""에 aria-hidden이다. reduced-motion에서는 블러 전환이 없다.
- 한계: hero.webp가 960×744라 2240px 화면에서 2.3배(디바이스 픽셀 4.6배) 확대된다. 실제 아이맥·Safari·터치 기기는 미검증이며 에뮬레이션 측정값 기준이다.

## 2026-11-03 소개 전체 정리 점검 (아이맥 24인치)

- 판 구조: .chapter-inner는 [본문 덩어리 flex:1][푸터]로, 섹션 라벨이 제목과 함께 세로 가운데에 온다. 전에는 라벨만 섹션 맨 위에 고정돼 본문과 크게 떨어져 있었다.
- 표지 간격 실측(2240×1260): 로고→문장 72px, 문장→본문 29px, 본문→전시 입장 52px. 회색 본문 17.96px/25.14px = line-height 1.4, 두 문장이 각각 한 줄(25.14px)로 끊긴다.
- 유리 표면은 이제 기록 카드에만 남는다. 글자가 올라가던 패널의 반투명 면과 왼쪽 선은 전부 제거했다.
- 2240×1260에서 01–05 전부 1184px 안에 들어가고 가로 스크롤 없음. 01 챕터의 넘침 1건은 배경 img의 scale(1.03)이며 섹션 overflow:hidden으로 잘린다(scrollWidth=clientWidth).
- 한계: hero.webp 960×744 확대 문제는 그대로다. 실제 아이맥·Safari·터치 기기는 미검증이며 에뮬레이션 측정값 기준이다. 프롬프트 문구는 실제 기록이 아니라 요약한 대략본이므로 실제 사용한 문장이 있으면 교체가 필요하다.

## 2026-11-03 프롬프트 표시 점검 (2240×1260)

- 02 챕터 하단은 [PROMPT 라벨 → 한국어 한 줄 → 영문 원문] 순서다. 영문은 mono 14.5px/1.75, #a09ab4로 본문보다 한 단계 낮춘 밝기이며, 블록 높이는 G2에서 120px·4줄이다.
- 세 상태(ORIGINAL·G2·G3) 어디서도 챕터가 1184px를 넘지 않는다. 가장 긴 G3에서도 수납을 확인했다.
- 기록 카드: radius 8px / border 1.5px rgba(185,168,255,.42) / backdrop blur 8px. 겹침·회전·선택은 그대로다.
- 이후 화면 확인은 사용자 요청에 따라 2240×1260을 기본 기준으로 한다.

## 2026-11-03 커밋·푸시·공개 배포

- 사용자 요청으로 이번 작업 전체를 커밋·푸시·배포했다. 커밋 3618253 "Rebuild the catalogue overview and trim the deployed payload" (34개 파일, +236/−53), 푸시 450e9f0..3618253 phase1-foundation.
- 커밋에는 다른 작업자가 트리에 남겨 둔 MemoryRoom.tsx·LightArchiveScene.tsx·MobileReportView.tsx 변경과 신규 archive/preview·thumb·room-final.webp 자산도 함께 들어갔다. 커밋 메시지에 그 사실을 적었다. _loop_work·outputs·archive.zip은 .gitignore로 제외되어 포함되지 않았다.
- npm run deploy Published, gh-pages 4c76e85ec9ffa43670c015df00e1f69b5c5ca115, Pages 실행 41580788751 성공(배포 ID 125735156705).
- 공개 확인(2240×1260): 공개 번들 catalog-DUD2MmmI.js가 로컬 빌드와 일치. 표지 새 카피, 카드 테두리0, 5개 챕터 모두 한 화면 수납, 02 챕터 G3 영문 원문 표시, Result에 인쇄도록 없음(원본 크기로 보기·원본 내려받기만), 루트는 그대로 Landing에서 시작. 가로 넘침0, 콘솔 오류0.
- 미해결: 커밋 450e9f0에 이미 들어간 Claude outputs/·lab/은 여전히 추적 상태다. git rm --cached 여부는 사용자 답변 대기 중.

## 2026-11-03 구역 판독 화면·작가의 말 점검 (1440×900, 390×760)

- 실제 경로 확인: 빛의 흔적을 사진 선택(두 번 바꿈)→단어 두 개→빛으로 남기기까지 직접 진행한 뒤 수집된 기록 화면에 도착했다. CLUE 01 / 04, 생성된 빛(원형), 빛의 흔적 #90906c · 고요함, 흔적판 LIGHT만 기록됨, 수치 3건(고르기까지 10.6초 · 바꾼 선택 3회 · 다시 돌아본 횟수 1회)이 실제 조작과 일치했다. '다음 단서로'를 누르면 계단을 지나 소리의 흔적이 정상으로 열렸고, 일곱 소리와 아이콘은 그대로다.
- 선택 기록이 없는 경우(개발 점프)에는 "이 구역에서는 선택 기록만 남았습니다."로 떨어지고 화면이 깨지지 않는다.
- 최종 보고서: 카메라 없이 계속 → 공개 → 조사 방식 → 발견 → CLOSING → 조사를 만든 이유(3장 + 서명) → 최종 기록까지 06단계가 끊김 없이 이어졌다. 단계 번호 표기(01/06…)도 함께 늘었다.
- 390×760에서 판독 화면이 한 열로 쌓이고 자체 스크롤로 '마지막 단서로' 버튼까지 닿는다. 최소 화면 크기를 요구하지 않는다.
- 흔적판 라벨이 'SENTEN / CE'로 깨지던 것을 칸 100px·nowrap·라벨 크기로 고쳤다.
- 검증: npm run build(tsc 포함) 통과, oxlint 신규 파일 경고 없음(supabase 테스트의 fetch 경고는 기존 reports 테스트와 같은 패턴), interpret 핸들러 단위 테스트 통과, 콘솔 오류 0. 최종 기록 화면에서 나는 supabase/reports CORS 오류는 기존 사항으로, 함수의 허용 출처가 5173인데 개발 서버가 5199(.claude/launch.json)인 탓이다. commit/push/배포 없음.

## 2026-11-03 아이맥 24인치(2240×1260) 기준 재점검 — 판독 화면·작가의 말

사용자 지시로 화면 검토 기준을 아이맥 24인치로 고정하고 신규 화면 두 개를 이 크기에서 다시 봤다.

- 판독 화면: 960px 본문과 320px 빛으로는 2240px 화면 가운데 3분의 1에 떠 있었다. 1800×1000 이상 분기를 추가해 본문 1240px, 빛 420px, 단서 값 제목 크기, 수치·안내문 18px로 올렸다. 한 화면에 수납되고 세로 스크롤·가로 넘침 0.
- 작가의 말: 본문이 18px에 폭 287px로 각주처럼 읽혔다. 같은 분기에서 26px·행간 1.9·폭 900px, 마지막 장 제목 36px로 올렸다. 서명 포함 한 화면에 들어가고 넘침 0.
- 두 분기 모두 min-width 1800 · min-height 1000 조건이라 1440×900·390×760의 기존 배치는 건드리지 않는다.
- 검증: npm run build(tsc 포함) 통과, 신규 파일 oxlint 경고 없음. 2240×1260에서 판독 화면과 작가의 말 전 단계를 눌러 확인. commit/push/배포 없음.

## 2026-11-03 발견 문구 변주 점검 (2240×1260)

- 11종 × 2변주를 실제 context 값으로 전부 렌더해 확인했다. 빈 치환(undefined·[object Object]) 없음, 모든 reflection이 물음표로 끝남.
- 아이맥 24인치에서 최종 보고서 발견 단계(REPORT 03)와 "내 기록 살펴보기" 패널을 열어 확인했다. 줄바꿈 깨짐·넘침 없음, 콘솔 오류 없음(남아 있는 supabase/reports CORS는 개발 서버 포트 5199 때문인 기존 사항).
- 검증: npm run build(tsc 포함) 통과, oxlint 신규 경고 없음. commit/push/배포 없음.

## 2026-11-03 소리 장면 버튼 위계 점검 (2240×1260)

- 저장된 기록을 비우고 소리의 흔적에 들어가 두 상태를 모두 확인했다. 고르기 전: '이 소리 선택' = cta--primary, '소리를 하나 고르면 이어집니다' = cta--secondary(비활성). 고른 뒤: '선택한 소리 ✓' = cta--secondary + --marked(비활성), '다음으로' = cta--primary.
- '다음으로'를 눌러 위치 표시 단계가 정상으로 열리고 고른 소리(지하철)가 그대로 유지되는 것을 확인했다.
- 검증: npm run build(tsc 포함) 통과, 해당 파일 oxlint 경고 없음. 남아 있는 supabase/reports CORS 오류는 앞선 보고서 방문에서 난 기존 사항이다. commit/push/배포 없음.

## 2026-11-03 유리 돔 선택 점검 (2240×1260)

- 기록을 비우고 확인했다. 지하철 돔을 한 번 누르자 재생되면서 바로 '최종 선택됨'이 되고 '다음으로'가 활성화됐다. 플레이어에는 '일시정지' 하나만 남는다.
- 빗소리 돔을 누르자 선택이 옮겨 가고, 같은 돔을 다시 눌러 소리를 멈춰도 선택은 유지되며 돔 아래에 '선택한 소리'가 표시된다.
- '다음으로' 뒤 위치 표시 단계가 정상으로 열리고 고른 소리(빗소리)가 유지된다. 기록은 playStart ×2 · select ×1 · commit ×1로, 들어 본 것이 선택 변경으로 남지 않는다.
- 검증: npm run build(tsc 포함) 통과, 해당 파일 oxlint 경고 없음. commit/push/배포 없음.

## 2026-11-03 후기 질문 점검 (2240×1260, 390×760)

- 두 크기 모두 가로 넘침 0. 2240에서는 선택지가 두 줄('보지 않았다' / 1–5), 390에서도 같은 두 줄로 유지된다.
- '보지 않았다'를 고르면 값 0이 들어가고, 동의 체크 뒤 '후기 보내기'가 활성화된다. 즉 그 화면을 못 본 관람객도 답을 남기고 보낼 수 있다.
- 배포 순서: reports 함수를 먼저 올려 새 질문지 버전을 받게 한 뒤 사이트를 배포했다. 반대로 했으면 새 후기가 전부 거부된다. 공개 번들 main-CpdaYOez.js에 새 Q1·'보지 않았다'·ut-2026-11-03-v2가 있고 옛 Q1은 없다. 공개 후기 페이지 콘솔 오류 0.
- 미검증: 실제 전송 성공(200)은 공개 보관소에 시험 응답을 쓰게 되어 하지 않았다. 버전 수용 로직은 배포된 핸들러를 그대로 돌리는 단위 테스트로 확인했고, 엔드포인트는 preflight 204로 살아 있음을 확인했다. 첫 실제 후기가 최종 확인이 된다.

## 2026-11-04 부스 전시 소개 점검 (2240×1260)

- `?venue=1` Landing 오른쪽 위에 `전시 소개 ↗`가 보이고 주소는 `/unanswered/catalog/?venue=1`이다. 최종 보고서(수령증)에서도 `처음으로 돌아가기` 아래에 `전시 소개`가 같은 주소로 들어왔고, 두 줄 배치에 넘침 0.
- venue 카탈로그의 돌아가는 링크 세 개(워드마크, 상단 `전시 입장`, 표지 `전시 입장`)가 모두 `/unanswered/?venue=1`이다. `?venue=1` 없이 연 카탈로그는 전과 같이 `/unanswered/`를 가리킨다.
- venue 카탈로그를 열어 두고 입력 없이 2분을 기다리자 `/unanswered/?venue=1` Landing으로 돌아갔다(`window.location.replace`, 뒤로 가기에 남지 않음).
- 보존: 최종 보고서의 QR(관람객 보고서)·카드 안내, VenueIdleGuard의 105초 프롬프트+15초 확인, Landing 진입 타이밍과 기록 수집, 웹 카탈로그 레이아웃과 문구.
- 검증: npm run build 통과. 콘솔 오류는 localhost에서 보고서 업로드가 막히는 기존 CORS 두 건뿐이고 이번 변경과 무관하다. commit/push/배포 없음.
- 공개 확인(2026-11-04): 공개 main-Bfy2Tn8o.js가 로컬 빌드와 일치하고, 카탈로그가 함께 받는 wordmark-BpmvdBLj.js는 로컬 파일과 바이트 단위로 동일하며 `venue=1`·105e3·15e3·12e4를 모두 담고 있다. 공개 `?venue=1` Landing의 `전시 소개`는 `/unanswered/catalog/?venue=1`, venue 카탈로그의 복귀 링크 세 개는 모두 `/unanswered/?venue=1`이다. 공개 venue 카탈로그에서 입력 없이 2분을 기다리자 `/unanswered/?venue=1`로 돌아갔다. `?venue=1` 없는 공개 주소는 `/unanswered/catalog/` 그대로이고 콘솔 오류 0.

## 2026-11-04 헤드폰 안내 점검 (2240×1260, 390×760)

- 2240에서 읽는 순서가 제목 → `남겨진 단서로 그 사람을 떠올려 보세요.` → `소리가 있는 전시입니다. 헤드폰을 착용해 주세요.` → `CLICK ANYWHERE TO BEGIN`이 된다. 설명문과 같은 크기·같은 보조색이라 시작 문구와 경쟁하지 않는다.
- 390에서는 안내가 나오지 않고(`.landing-scene__sound-note` 없음) 기존 터치 문구가 그대로다. 가로 넘침 0.
- 보존: 입장 타이밍(`startEntryRef` 1.3초)과 기록 수집, `전시 소개` 링크, venue 2분 복귀, 움직임 줄이기 경로(안내도 전환 없음).
- 검증: npm run build 통과.
