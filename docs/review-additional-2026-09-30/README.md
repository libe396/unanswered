# 추가 수정 검증 기록

## 현재 상태 — 추가 동시 변경으로 카메라 적용 위치 확인 대기

확정 문구를 반영한 뒤 다른 작업이 Landing의 체크박스를 제거하고 `CameraOptIn`을 마지막 장면의 버튼형 동의 UI로 교체했다(11:53경). 새 구조를 덮어쓰지 않았다. 사용자에게 ‘Landing 체크박스’와 ‘마지막 장면 동의’ 중 적용 기준을 다시 확인 요청한 상태다. 따라서 아래 문구 반영 기록은 덮어쓰기 전 이 작업의 변경이며, 현재 실행 화면에서 적용 완료라고 간주하지 않는다. 확정 문구와 7개 소리 정책은 `AGENTS.md`에 공유돼 있다.

지하철·자동차 SVG는 적용 완료. `sound-seven-svg-final.png`는 변경 후 실제 화면이며, `light-steps-overview.png`는 앞선 실제 빛 단계별 캡처 모음이다. 소리와 ID 7개 유지, 추가 소리 없음.

## 최종 합의 문구 / 7개 SVG

사용자가 확정한 문구를 `CameraOptIn.tsx`에 반영했다. 새 Landing 레이아웃은 유지한다.
- 체크박스: **카메라 사용 허용 (선택)**
- 바로 아래, 체크 전부터 표시: **마지막 장면에서 내 얼굴을 실시간으로 보여줍니다. 영상은 저장·전송하지 않으며 마이크는 사용하지 않습니다.**
- 안내는 체크박스의 `aria-describedby`에도 연결했다.

작업자 공유: 저장소 `AGENTS.md`에 이 문구와 소리 7개 유지 결정을 기록했다. Orca 상태 조회 결과 runtime이 실행 중이지 않아 다른 작업자에게 실시간 메시지는 전달하지 못했다. 문구 조율은 사용자의 이번 결정으로 완료했다.

지하철과 자동차도 36×38 viewBox, strokeWidth 1.25, round cap/join의 SVG로 추가했다. 소리 7개와 기존 ID/파일은 유지한다. 컵·발자국·바람 및 여덟 번째 항목은 추가하지 않는다.

이번 마무리는 빌드 1회와 변경 화면 캡처로 확인했다. 빛 분석/카메라 전체 회귀 테스트는 반복하지 않았다. 빛 단계 모음은 앞선 실제 브라우저 캡처를 재사용했다.

## 구현

- 빛 변환: 기존 픽셀 분석에 색 출처 좌표와 검출 영역의 실제 픽셀 경계만 추가. 밝은 영역 → 색 조각 → 구조점·방향과 실제 결과 곡선 → 기존 렌더러의 네 누적 단계로 공개. 기존 색 계산, 난수 시드, 렌더 순서와 최종 결과는 보존.
- 소리: 원본 파일 SHA-1 일치로 아래 대응을 확인. ID/오디오 파일 변경 없음. 참고 5개 SVG와 같은 스타일로 지하철·자동차 SVG를 추가하여 7개 모두 통일.
- 유리관: 투명 돔, 손잡이, 가장자리 반사, 타원형 검은 받침과 청보라 링. 기본 아이콘 대비 유지. 재생 파형과 선택 밑줄/문구 분리. 모바일 4+3 배열.
- 좌표: 실제 입력 위치에 3개 동심원(1.35초 + 0/160/320ms 지연). 한 묶음만 유지. Enter/Space·방향키 지원. 모션 감소 시 0.2초 강조. 파동 상태는 기록 데이터와 분리.
- 문장: 복원 완료에서 기존 저장/확정을 실행하고 Zone 07로 이동. 체류·행동 기록 유지. 측정값이 2.5초 이상이고 전체 측정 문장 중 유일한 최장 체류이며 선택한 문장인 경우만 해당 문장 옆에 초 단위 주석 표시. 동률·0·누락·더 오래 본 미선택 문장에는 주석 없음.
- Zone 05 ‘기억의 흔적’, Zone 07 ‘기록의 레이어’, Zone 08 ‘최종보고서’. 진입 타이틀·헤더·보고서 명칭 반영. 내부 Scene ID/저장 키 유지.
- 카메라: Landing의 기본 해제 체크박스로 동의. **위 최종 합의 문구를 적용했다.** 마지막 장면 직전에만 video 권한 요청(audio:false). 연결 완료 후 ‘당신이 찾던 사람은’ → 거울 영상/실제 관람 단서 → ‘당신입니다.’ → 마무리 문장. 권한 미결정 동안 공개를 시작하지 않음. 카메라 없이 계속하기 제공. 허용된 연결만 8초 준비 제한. 미동의·거부·장치 없음·접근 실패는 단서 연출로 완료. 끄기·장면 이탈·다음 단계·pagehide·언마운트 시 트랙 종료. 늦게 도착한 스트림도 즉시 종료. 카메라 동의는 메모리에만 보관하며 보고서/분석/저장소에 영상 또는 스트림을 넣지 않음.

## 오디오 대응

참고: 원본 전시 폴더 `/Users/sarah/Desktop/UNANSWERED_미응답/images/zone3_1.png` (8개 도상).
각 번호 파일과 `UNANSWERED_sound_archive_normalized`의 이름 있는 파일을 SHA-1로 비교했다. 7쌍 모두 바이트 단위 동일.

|저장 ID|실제 원본 소리|표시|
|---|---|---|
|SOUND_01|빗소리|참고의 비구름·빗방울 SVG|
|SOUND_02|종이 넘기는 소리|참고의 겹친 종이 SVG|
|SOUND_03|사람들 웃고 떠드는 소리|참고의 세 사람 SVG|
|SOUND_04|엘리베이터|참고의 문·아래 화살표 SVG|
|SOUND_05|연필로 쓰고 지우는 소리|참고의 연필 SVG|
|SOUND_06|지하철|동일 선형의 지하철 SVG|
|SOUND_07|차가 지나가는 소리|동일 선형의 자동차 SVG|

**컵·발자국·바람 오디오는 현재 목록에 없다.** 재생 불가능한 여덟 번째 항목을 추가하지 않았다. 사용자는 기존 7개를 유지하고 이 항목들을 추가하지 않기로 확정했다.

## 검증 결과

기존 사용자 브라우저/관람 저장소에 접근하거나 초기화하지 않고 별도 Chromium 임시 프로필로 테스트했다. 내장 브라우저는 `Cannot redefine property: process`로 연결되지 않아 독립 테스트 브라우저를 사용했다. 개발 Vite 프로세스는 재시작하지 않았다.

- `npm run build` 통과. 기존 번들 크기 500 kB 초과 경고 존재.
- `git diff --check` 통과.
- 빛: 실제 UI의 0~4 단계 스크린샷, 다시 보기, 건너뛰기 후 타이머 중단, 모션 감소, 저장 후 다음 장면 진입 통과. 선택 이미지의 추가 메타데이터를 제외한 분석 결과 동일. 수정 전 렌더러와 **최종 PNG 픽셀 동일**. 실제 경계 8개/색 출처 5개/누적 렌더 단계 4개 확인. `light-qa.json`.
- 소리: 기본·호버·재생·선택 및 서로 다른 관의 동시 ‘재생’/‘선택’ 구별 확인. 1440×900 및 390×844 화면 확인. 클릭 (22%,73%)에서 파동 시작, 연속 입력 시 한 묶음 유지 확인. 키보드 이동 후 저장값 x=0.84/y=0.20, ID=SOUND_01 확인.
- 초기 진입: 새 Landing(390×844 포함)을 확인하고, 새로고침 → Landing → Elevator → Intro film → Investigation → Registration 경로 통과.
- 보고서: 실제 최장 체류 문장 옆에 초 단위 주석이 화면·인쇄 컴포넌트에 표시됨. 0·동률·더 오래 본 미선택 문장은 주석 없음 확인.
- 문장: 3개 선택, 텍스트 입력, 복원 후 저장, 중간 화면 없이 Zone 07 진입, 실제 체류시간, 뒤로가기와 재확정 통과. 선택 화면 내부 스크롤 없음 확인. `qa-part1.json`.
- 카메라: 가상 장치 허용 후 끄기/다음 단계/다른 장면 이탈, 권한 거부, 장치 없음, 접근 불가, 권한 대기 취소 후 늦은 스트림, 미동의의 8가지 경우 통과. 동의 시 video 요청 1회, 미동의 시 요청 0회. 모두 마이크 요청 없음, 종료 후 모든 트랙 ended. `camera-qa.json`. 권한 미결정 12.5초 동안 공개 단계가 0에 머무는 것과 취소 후 늦은 스트림 종료, 연결 후 다음 단계 종료도 최종 코드에서 재확인했다(`camera-readiness-qa.json`).

실제 웹캠의 화질·얼굴 구도와 운영체제의 실물 권한 창은 미검증. 장치 오류는 DOMException을 이용한 재현이며 허용 영상은 Chromium 가상 장치다. 소리는 원본 바이트 대응과 브라우저 재생을 확인했으며 청음에 의한 원본 명칭 재분류는 수행하지 않았다.

## 수정 파일

- `src/components/LightTransformation.tsx`, `.css`
- `src/lib/imageAnalysis.js`, `lightRenderer.js`, `sentenceDwellNote.ts`, `reportFindingCopy.ts`
- `src/types/index.ts`
- `src/data/content.ts`, `zones.ts`, `zoneFilms.ts`
- `src/scenes/SoundCluesScene.tsx`, `.css`, `SentenceCluesScene.tsx`
- `src/scenes/MemorySketchScene.tsx`, `RecordLayerSecondVisitScene.tsx`
- `src/components/ZoneLabel.tsx`, `CameraOptIn.tsx`
- `src/store/cameraPreference.ts`
- `src/scenes/LandingScene.tsx`, `.css`, `FinalReportScene.tsx`
- `src/scenes/report/ReportStage06SubjectReveal.tsx`, `.css`
- `src/scenes/report/ReportStage01CollectedClues.tsx`, `.css`, `PrintableFullReport.tsx`
- `src/scenes/report/FinalRecordLayer.tsx`, `FinalReportSummaryReceipt.tsx`

기존 작업 보존 확인을 위해 시작 시점의 tracked 차이를 `pre-task.diff`에 기록했다.
기존 이미지·영상 교체, 문장 선택 레이아웃, Zustand 관람 기록 키, 영상·소리 설정을 되돌리지 않았다.
작업 도중 Landing/MemoryField에 별도 수정이 감지되었다. 카메라 추가를 유지한 새 Landing을 보존했으며 해당 변경을 되돌리지 않았다.
커밋·푸시·reset·restore·stash를 수행하지 않았다.
