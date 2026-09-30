# Zone 진입 영상

## 실제 연결

기존 `SCENE_ORDER`와 Zone 번호를 유지한다. ZIP 파일 번호로 순서를 만들지 않는다.

| 기존 씬 / 위치 | 원본 파일 | 영상 다음 단계 |
| --- | --- | --- |
| `lightArchive` / ZONE 03 | `01_Color_Trace_Final.mp4` | 빛의 흔적 → 기존 빛 인터랙션 |
| `zone03Intro` / 빛과 소리 사이 이동 | `02_Stairs_Final.mp4` | 타이틀 없이 소리 영상으로 이동 |
| `soundClues` / ZONE 04 | `03_Sound_Trace_Final.mp4` | 소리의 단서 → 기존 소리 인터랙션 |
| `memorySketch` / ZONE 05 | `05_Memory_Sketch_Final.mp4` | 복원된 기억의 방. → 기존 사물 선택·드로잉 |
| `sentenceClues` / ZONE 06 | `04_Sentence_Clues_Final.mp4` | 문장의 흔적 → 기존 문장 인터랙션 |
| `recordLayerSecondVisit` / ZONE 07 | `06_Memory_Layers_Final.mp4` | Record Layer → 기존 수집 기록 레이어 |
| `finalReport` / ZONE 08 | `07_Final_Report_Final.mp4` | Final Report → 기존 보고서 시퀀스 |

파일 위치: `public/video/zones/`. Vite의 `BASE_URL`을 사용하므로 현재 주소는 `/unanswered/video/zones/<파일명>`이다. ZIP의 7개 MP4와 배치 파일은 바이트 단위로 동일하다. 병합·재인코딩·속도 변경·영상 연장은 없다. 기존 `public/video/intro-film.mp4`와 Landing → Elevator → Investigation Start → Registration 흐름은 유지한다.

## 전환과 보존

- `ZoneFilmTransition`: 실제 `ended` 또는 건너뛰기 → 마지막 프레임 800ms 페이드 → 타이틀 250ms 페이드인 → 1500ms 유지 → 400ms 교차 페이드. 영상 길이에 대한 타이머는 없다.
- 계단에는 타이틀/인터랙션을 만들지 않는다. 기존 소리 진입 카드는 공통 타이틀로 통합한다.
- 소리 있는 자동재생이 거절되면 무음으로 재시도하고 선택 가능한 `소리 켜기`를 표시한다. 무음 자동재생까지 거절되면 `영상 재생`, 로딩/코덱 오류 시 `계속하기`를 표시한다. 건너뛰기는 로딩 중에도 사용할 수 있다.
- 공통 입력 차단과 `object-fit: contain`, `playsInline`을 적용한다. 영상 동안 기존 배경 음악을 일시정지한다.
- `ZoneExperienceHost`: 현재 React 19의 `Activity`로 작업 단계·선택·그림·추적 객체를 보존한다. 비활성 씬의 효과를 정리하고 재방문 때 복구한다. 영상이 끝난 작업 화면에는 영상을 다시 강제하지 않는다.
- `interactionClock`: 영상·타이틀·교차 페이드·다른 씬에 머문 시간을 선택/망설임 계산에서 제외한다. 기존 추적기와 빛/문장의 직접 시간 계산이 같은 시계를 사용한다.
- `visitId`는 영속 저장하지 않는다. 전시 초기화 시 화면 캐시도 초기화하며, 새로고침은 기존 정책대로 Landing에서 시작한다.
- 뒤로 가기는 소리 진입의 계단을 건너뛰고 이전 작업 화면으로 돌아간다.

## 검증 실행

Vite 실행 상태에서 사용 가능한 Playwright 모듈로 실행한다. 프로젝트 의존성은 추가하지 않았다.

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/verifyZoneTransitions.mjs
npm run build
```

자동 검증: 6개 Zone 영상의 실제 종료/전환 타이밍, 계단→소리 연결, 중복 종료·스킵, 네트워크 실패, 자동재생 거절, 이전 씬의 드로잉·작업 단계·기록 보존, 모바일 세로/가로 레이아웃, 새로고침 Landing 복귀. 모바일 검증은 Chromium 터치/뷰포트 에뮬레이션이며 실제 iOS Safari 하드웨어 검증은 별도다.

## 이번 변경 파일

- 공통 진입: `src/components/ZoneFilmTransition.tsx`, `ZoneFilmTransition.css`, `ZoneExperienceHost.tsx`, `SceneController.tsx`; 영상 연결표 `src/data/zoneFilms.ts`.
- 시간·세션·오디오: `src/lib/interactionClock.ts`, `src/hooks/useInteractionClock.ts`, `useSceneTracking.ts`, `src/store/experienceStore.ts`, `src/components/PostElevatorSoundManager.tsx`.
- 기존 시작 카드 통합/작업 복원: `src/scenes/LightArchiveScene.tsx`, `MemorySketchScene.tsx`, `SentenceCluesScene.tsx`, `RecordLayerSecondVisitScene.tsx`, `FinalReportScene.tsx`.
- 실데이터에서 페이드 지연 방지: `src/lib/lightRenderer.js`의 동일 결과 1개 캐시, `src/scenes/report/ReportStage01CollectedClues.tsx`의 숨겨진 시각화 준비 시점, `PrintableFullReport.tsx`의 인쇄 전 캔버스 준비. 계산식·해상도·보고서 내용은 유지한다.
- 원본 MP4 7개: `public/video/zones/`; 재현 테스트: `scripts/verifyZoneTransitions.mjs`; 이 문서.

## 확인 결과

- TypeScript + Vite production build 통과. 기존 500 kB 초과 청크 안내는 남아 있다.
- 7개 원본 영상의 정상 종료, 공통 타이밍, 스킵·종료 중복, 실패 대체 버튼, 자동재생 차단 후 수동 재생 통과.
- Landing → Elevator → 기존 Intro Film → Investigation Start → Registration → 빛 영상의 실제 클릭 동선 통과.
- 빛 선택 → 계단 → 소리/위치 선택 → 기억 사물 선택/드로잉 → 문장 3개/빈칸 → 기록 레이어 → 보고서의 실제 완료 버튼 동선 통과.
- 재방문의 드로잉·선택·작업 단계·행동 이력 유지, 보고서 생성 시각 유지 확인. 영상과 비활성 방문 시간은 기록용 시계에서 제외된다.
- Chromium 390×844 / 844×390에서 원본 비율, 중앙 타이틀, 자동 진입, 가로 넘침 없음 확인. 실제 iOS Safari/Android 기기는 미확인.
- 인쇄 직전 캔버스는 기존 1000×1000 해상도로 준비되는 것을 확인했다. 실제 프린터 출력은 수행하지 않았다.
- 기존 staged/unstaged 변경을 유지했다. 이번 작업에서 stage, commit, push 또는 배포는 수행하지 않았다.

2026-09-30 추가 조정: 모든 Zone 영상과 인트로의 종료 페이드를 800ms의 부드러운 감속으로 통일했다. `public/video/intro-film.mp4`는 제공된 `intro_video.mp4`로 원본 그대로 교체했다. 타이틀/인터랙션 진입 시간과 진행 순서는 유지한다.

2026-09-30 시작/연결 조정: 인트로 및 Zone 영상은 실제 `playing`부터 800ms 페이드인한다. 계단과 소리는 동일한 비디오 요소에서 별도 파일을 교체하여 계단 페이드아웃 → 소리 페이드인으로 이어진다. 중간 타이틀은 추가하지 않으며 소리 영상 종료 후에만 기존 타이틀을 표시한다. 소스 교체 때 발생하는 일시적인 pause와 실제 재생 중단을 구분하고, 이전 영상의 완료/재생 Promise가 다음 영상을 건너뛰지 않도록 분리했다.


## 2026-09-30 update

- Corridor entry now uses `06_Memory_Layers_Entry_3p2s.mp4`, source interval 6.5–9.7 s at original speed. Original `06_Memory_Layers_Final.mp4` remains untouched. Playback plus the existing 800 ms fade is approximately 4 s. `07_Final_Report_Final.mp4` is the separate report printing/receipt film and remains unchanged.
- Record Layer confirmation now opens the report film directly. The independent fullscreen light backdrop, its render effects, and completion delay were removed; report light graphics/data remain.
- Films no longer silently retry autoplay. They share an explicit session mute preference and show `소리 켜고 재생` only when blocked. Both Intro and Zone players pause on exit. This supersedes the earlier silent-fallback notes above.
- Native AVFoundation inspection found one audio track in the intro and each of the seven supplied originals.
