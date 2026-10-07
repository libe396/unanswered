# UNANSWERED UI·몰입·관람 시간 개선 기준

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
