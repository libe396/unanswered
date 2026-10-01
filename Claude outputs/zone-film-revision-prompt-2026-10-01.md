# UNANSWERED — 구역 영상 재생 방식 수정

먼저 `AGENTS.md`를 읽고 그 규칙을 그대로 따라줘. 시작 전에 `git status`부터 확인하고, 커밋 안 된 기존 변경은 절대 건드리지 마.
작업이 끝나면 `npx tsc --noEmit`와 `npm run build`가 통과하는지 확인하고, 바꾼 파일 목록을 보고해줘.

## 구역 영상: 흐름을 막지 않게

교수님 피드백: 구역마다 들어가는 영상이 흐름을 끊어.
영상이 7개고 하나에 7~10초라 길이는 문제가 아니야. 문제는 두 가지야.
- 관객이 '하다가 보다가'를 7번 반복하게 돼.
- 매번 "소리 켜고 재생"을 눌러야 해.

그래서 영상 파일은 그대로 두고, 재생 방식만 바꿔.
풀버전 영상은 오프라인 전시장 루프랑 포트폴리오에 쓸 거라서 지우면 안 돼.

### 1. `ZoneFilm`에 재생 모드 추가 (`src/data/zoneFilms.ts`)
```ts
mode?: 'full' | 'cut' | 'none';  // 기본값 'full' — 기존 동작 그대로
cutStartMs?: number;            // cut 모드에서 재생을 시작할 지점. 기본 0
cutMs?: number;                 // cut 모드에서 재생할 길이. 기본 2500
```

| scene | 파일 | mode |
|---|---|---|
| lightArchive | 01_Color_Trace_Final | `cut` |
| zone03Intro | 02_Stairs_Final | `none` |
| soundClues | 03_Sound_Trace_Final | `cut` |
| memorySketch | 05_Memory_Sketch_Final | `cut` |
| sentenceClues | 04_Sentence_Clues_Final | `cut` |
| recordLayerSecondVisit | 06_Memory_Layers_Entry_3p2s | `cut` |
| finalReport | 07_Final_Report_Final | `full` (반전 직전에 유일하게 멈추는 지점) |

`intro-film.mp4`(인트로 필름)는 손대지 마. 엔딩에서 이 인물이 다시 나오기 때문에 처음에 반드시 봐야 해.

### 2. `cut` 모드 동작 (`ZoneFilmTransition`)
- 항상 무음으로 자동재생해. 사용자의 소리 설정(`useFilmSound` / `setFilmMuted`)은 읽지도 바꾸지도 마.
- `소리 켜기`, `소리 끄기`, `소리 켜고 재생`, `건너뛰기` 버튼을 모두 숨겨. 클릭 0회로 진행돼야 해.
- `cutStartMs`부터 재생하고, `cutMs`가 지나면 `finish()`를 호출해. 영상이 그보다 먼저 끝나면 `onEnded`로 똑같이 처리해.
- 자동재생이 막히거나(NotAllowedError) 재생에 실패하면 버튼을 띄우지 말고 바로 `finish()`로 넘어가.
- 이후 단계는 `videoOut 800 → 400ms`, `titleHold 1500 → 1200ms`로 줄여. 구역 하나 진입에 걸리는 시간이 4.5초 이내가 목표야.
- 타이틀 카드(zone, title, subtitle)는 그대로 둬.
- `prefers-reduced-motion`이면 영상 없이 타이틀 카드만 보여줘.

### 3. `none` 모드 동작
- 영상을 렌더하지 않고 곧바로 `onComplete`를 호출해. 기존 `isPassage` 분기의 `completeScene('zone03Intro')`가 그대로 실행되게 해서 전역 씬 흐름이 깨지지 않게 해.
- 검은 화면이 깜빡이지 않는지 확인해.

### 4. `full` 모드
- 지금 동작과 완전히 똑같이 유지해.

### 5. 수정 범위
- `src/data/zoneFilms.ts`, `src/components/ZoneFilmTransition.tsx`(필요하면 CSS)만 수정해.
- `ZoneExperienceHost.tsx`는 `none` 처리에 꼭 필요할 때만 최소한으로 수정해.
- 영상 파일은 삭제, 재인코딩, 이동 모두 금지.

### 6. 검증
- 각 구역 진입 시간을 측정해서 보고해줘. `cut`은 4.5초 이내여야 하고, `none`은 즉시 넘어가야 해.
- 소리 설정을 켠 상태로 `cut` 구역을 지난 뒤 `finalReport` 영상에 도착했을 때, 소리 설정이 그대로 유지되는지 확인해.
- Landing부터 Final Report까지 전체 흐름을 다시 한 번 확인해.

커밋은 하지 마. 내가 확인하고 직접 할게.
