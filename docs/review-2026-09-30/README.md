# UNANSWERED — 영상·문장·보고서 변경 확인

## 실제 변경

- 걷기 영상은 `06_Memory_Layers_Final.mp4`입니다. 원본 6.5–9.7초를 원속도로 추출한 `06_Memory_Layers_Entry_3p2s.mp4`를 Record Layer 진입에 연결했습니다. 3.200초 재생 + 기존 0.800초 페이드(브라우저 약 4.03초). 원본과 보고서 출력·수령 영상 `07_Final_Report_Final.mp4`는 보존했습니다.
- 기존 동선: 문장 완료 → 단축 복도 영상 → Record Layer → 기록 확인 → 보고서 출력 영상 → Final Report 타이틀 → 보고서. 기록 확인 뒤 독립된 전체 화면 빛 장면과 3초 완료 타이머는 제거했습니다. 레이어 UI와 보고서의 개인 빛 그래픽은 보존했습니다.
- 최초 입장 클릭에서 기본 소리 설정을 활성화하고, Intro/Zone 영상이 같은 세션 음소거 설정을 사용합니다. 원본 8개 모두 오디오 트랙 1개이며 PCM 분석에서도 무음이 아닌 실제 신호를 확인했습니다. 편집본에도 오디오가 유지됩니다. 유음 자동재생 차단 시 자동 무음 전환 대신 명시적인 재생 버튼을 제공합니다. 사용자 음소거를 유지하고 이탈 시 재생을 멈춥니다.
- 문장 인트로에 핵심 질문·행동 안내·실제 카드 미리보기를 배치했습니다. 기존 복원 문맥은 펼쳐 읽기로 보존했습니다. 선택 화면은 질문/그리드/고정 선택 목록/버튼으로 분리했습니다. 데스크톱 20개 비교, 모바일 카드 스크롤, 5개 슬롯과 선택 수, 삭제 및 포커스 규칙을 유지했습니다.
- REPORT 01은 LIGHT/SOUND/SENTENCE 가로 구성, 실제 기록 단위 문장, 별도 하단 문구·페이지·버튼으로 변경했습니다. 작은 화면에서는 세로 스크롤합니다. 소리 표시는 기존 선택 ID 기반 파형 표현을 재사용하며 실제 음압 분석으로 주장하지 않습니다.
- 기억 보고서는 실제 선택 가능 SVG 9개 영역만 대상으로 미선택을 강조합니다. 선택했던 물건과 드로잉을 보존하고, 2.2초 뒤 1.8초 동안 미선택 영역이 나타납니다. 범례에 실제 물건 이름을 표시합니다. 일부/전체 선택, 선택 없이 지나감, 기록 없음이 구분됩니다. 보고서 번호는 기존 세션별 단계 수를 따르므로 캡처의 기억 화면은 REPORT 02로 표시될 수 있습니다.

## 이번 수정 파일

- `src/data/zoneFilms.ts`, `public/video/zones/06_Memory_Layers_Entry_3p2s.mp4`
- `src/hooks/useFilmSound.ts`, `src/components/ZoneFilmTransition.tsx`
- `src/scenes/LandingScene.tsx`, `src/scenes/IntroFilmScene.tsx`, `src/scenes/IntroFilmScene.css`
- `src/scenes/RecordLayerSecondVisitScene.tsx`
- `src/scenes/SentenceCluesScene.tsx`, `src/scenes/SentenceCluesScene.css`
- `src/components/MemoryRoom.tsx`, `src/components/MemoryRoom.css`
- `src/scenes/report/ReportStage01CollectedClues.tsx`, `.css`
- `src/scenes/report/ReportStage04MemoryReconstruction.tsx`, `.css`
- `scripts/verifyZoneTransitions.mjs`, `docs/zone-entry-films.md`, 이 검증 자료

## 브라우저 검증

- Chromium 1440×900 / 1366×768 / 390×844: 문장 0개·5개·선택 해제·입력·복원 완료 통과. 두 데스크톱 크기에서 그리드 스크롤 없이 20개 카드 표시. 하단 버튼과 진행바 겹침 없음.
- 같은 세 크기: REPORT 01 내용/마무리/내비게이션 영역 비중첩, 모바일 하단 스크롤 접근 통과.
- 기억 화면: 선택 `lamp`, `window` 제외한 7개만 강조. 전체 선택은 0개, 선택 없이 완료는 9개, 기록 없음은 0개 강조. 실제 영역과 이름 일치.
- 일반 모션: 첫 렌더의 미선택 영역 opacity 0 → 대기 후 0.38 확인. 선택 물건과 드로잉 캔버스 유지.
- 실제 관람 전체 경로: 빛 → 계단 → 소리 → 기억 드로잉 → 문장 → 레이어 → 보고서. 선택 데이터·드로잉 보존, 보고서 재진입 시 생성 시각 및 출력용 빛 캔버스 보존 통과.
- 영상: 단축본 실제 ended 및 페이드, 입력 차단, 건너뛰기/ended 중복 방지, 재생 실패, 자동재생 차단 버튼, 소리 끄기/켜기 및 다음 영상 설정 유지 통과.
- `npm run build` 통과. 기존 500 kB 번들 경고만 남음. 전체 reset/checkout, commit/push 없음. 기존 staged/unstaged 변경 보존.
- 미확인: 실제 iOS/Safari 기기, 물리 스피커 청음. 오디오 트랙 및 브라우저의 재생·muted 상태로 검증했습니다.

## 화면 캡처

[문장 인트로](sentence-intro-1440.png) · [0개 선택](sentence-zero-1366.png) · [5개 선택 1440](sentence-five-1440.png) · [5개 선택 1366](sentence-five-1366.png) · [모바일 선택](sentence-five-390.png) · [복원 완료](sentence-complete-1366.png)

[REPORT 01 1440](report01-1440.png) · [REPORT 01 1366](report01-1366.png) · [모바일 하단](report01-390-bottom.png) · [미선택 영역](report03-1366.png)

[모두 선택](memory-all.png) · [선택 없이 완료](memory-skip.png) · [기록 없음](memory-missing.png)

[오디오 트랙·PCM 검사](audio-tracks.txt) · [영상 검사 로그](video-verification.txt) · [전체 동선 검사 로그](journey-verification.txt)
