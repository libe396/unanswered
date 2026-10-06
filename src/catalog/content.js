/*
  웹도록 — every line of copy and every image path on /catalog/ lives here.

  Images are read from public/catalog/. A missing file renders as a
  fixed-ratio placeholder showing its file name, so the layout never shifts
  when the real image lands. `src` may be a list: the first file that loads
  wins (used for the rule icons, which may be .svg or .png).
*/

export const CTA_LABEL = '온라인 전시 체험하기';

export const cover = {
  title: '미응답 UNANSWERED',
  subtitle: '대답하지 못한 순간을 기록하다',
  meta: ['F-08', 'AI 디자인스튜디오', '이서연', 'litzbeo@gmail.com'],
  image: { src: 'light-main.jpg', alt: 'RECORD NO. 08 선택한 단어 - 슬픔 · 불안', ratio: '21 / 9' },
  caption: ['RECORD NO. 08', '선택한 단어 - 슬픔 · 불안'],
};

export const intro = [
  '“너는 어떤 사람이야?”라는 질문 앞에서 우리는 종종 머뭇거린다. 좋아하는 것을 고를 수는 있어도, 왜 좋아하는지 설명하기는 쉽지 않다. 〈미응답 UNANSWERED〉는 이렇게 바로 답하지 못한 순간을 빈칸이 아닌 단서로 기록하는 참여형 전시이다.',
  '관객은 이름 없는 한 사람을 찾는 조사원이 된다. 마음이 가는 색과 문장을 고르고, 소리를 듣고, 흐릿한 방의 그림에 선을 더하며 그 사람에 대한 단서를 모은다. 무엇을 골랐는지뿐 아니라 선택하기까지 걸린 시간과 아무것도 고르지 않은 순간도 조사의 기록이 된다.',
  '조사가 끝나면 관객의 선택과 반응을 모은 한 장의 보고서가 발급된다. 찾고 있던 사람의 정체는 보고서의 마지막 줄에서 드러난다. 보고서에 적히는 것은 결론이 아니라 흔적이다. 관객은 무엇에 끌리고 어디에서 망설였는지 돌아보며, 스스로를 이해할 실마리를 찾는다.',
];

export const route = {
  label: 'INVESTIGATION ROUTE',
  description:
    '국립현대미술관(MMCA) 서울관 6전시실을 참고해 구성한 가상 평면이다. B1F에서 조사를 시작해 계단으로 B3F에 내려가 단서를 모으고 보고서를 받는다.',
  plans: [
    { floor: 'B1F', title: '조사 시작', image: { src: 'plan-b1f.svg', alt: 'B1F 조사 시작 평면도', ratio: '16 / 10' } },
    { floor: 'B3F', title: '단서 수집 · 보고서 발급', image: { src: 'plan-b3f.svg', alt: 'B3F 단서 수집 · 보고서 발급 평면도', ratio: '16 / 10' } },
  ],
  zones: [
    // [초안]
    { no: '01', floor: 'B1F', name: '입장', en: 'ENTRY', line: 'B1F에서 조사를 시작한다.' },
    // [초안]
    { no: '02', floor: 'B1F', name: '조사원 등록', en: 'REGISTRATION', line: '이름을 입력하고 임시 조사원증을 발급받는다.' },
    { no: '03', floor: 'B3F', name: '색의 흔적', en: 'LIGHT ARCHIVE', line: '마음이 가는 이미지를 고르며 색의 단서를 모은다.' },
    { no: '04', floor: 'B3F', name: '소리의 흔적', en: 'SOUND CLUES', line: '소리를 듣고 마음이 머무는 단서를 선택한다.' },
    { no: '05', floor: 'B3F', name: '기억의 흔적', en: 'MEMORY SKETCH', line: '흐릿한 방의 그림에 선을 더하며 기억을 남긴다.' },
    { no: '06', floor: 'B3F', name: '문장의 흔적', en: 'SENTENCE CLUES', line: '다음에 이어질 이야기를 상상하며 문장을 고른다.' },
    // [초안]
    { no: '07', floor: 'B3F', name: '기록의 레이어', en: 'RECORD LAYER', line: '수집한 단서가 겹쳐 보이는 구간을 지난다.' },
    { no: '08', floor: 'B3F', name: '최종 보고서', en: 'FINAL REPORT', line: '무엇에 끌리고 어디서 망설였는지, 조사 기록을 돌아본다.' },
  ],
  ambience: {
    label: 'CITY AMBIENCE',
    body: '지하철, 빗소리, 엘리베이터처럼 누구나 들어본 도시의 소리 일곱 개를 골랐다. 특정한 한 사람의 기억이 아니라 누구의 기억이든 될 수 있는 소리다.',
  },
};

export const reportFlow = {
  label: 'REPORT FLOW',
  steps: [
    { no: '01', title: '입력', body: '고른 것, 고르기까지 걸린 시간, 다시 본 횟수, 고르지 않은 것' },
    { no: '02', title: '처리(AI)', body: 'AI가 선택과 망설임 사이의 어긋남을 읽어 해석한다.' },
    { no: '03', title: '보고서', body: '고른 단서와, 근거가 붙은 AI 해석을 돌려받는다.' },
  ],
  quote: '심리테스트는 고른 답을 해석한다. 이 전시는 고르지 못한 순간을 해석한다.',
  body: '행동 하나를 성향 하나로 번역하지 않는다. 서로 다른 구역에서 나타난 행동 사이의 반복, 충돌, 공백, 순서를 읽는다. 유형을 붙이지 않고, 모든 해석에는 실제 행동 근거가 붙는다.',
};

const rule = (name) => [`rule-${name}.svg`, `rule-${name}.png`];

export const process = {
  label: 'PROCESS _ AI COLLABORATION',
  title: '빛 그래픽 변환 시스템 제작 과정',
  subtitle: '직접 그린 초안을 규칙으로 정리하고, 코드로 구현했다.',
  steps: [
    {
      no: '01',
      title: '초안 제작',
      body: '설계를 위해 직접 제작한 빛 그래픽이다. 빛을 원, 선, 광점으로 표현했다.',
      images: [1, 2, 3].map((n) => ({ src: `draft-${n}.jpg`, alt: `초안 제작 ${n}`, ratio: '1 / 1' })),
    },
    {
      no: '02',
      title: '규칙 정리',
      body: '초안의 요소를 여섯 개의 규칙으로 정리했다.',
      rules: [
        { name: '캔버스 매핑', en: 'Canvas', line: '사진과 같은 좌표계를 쓴다.', icon: { src: rule('canvas'), alt: '캔버스 매핑', ratio: '1 / 1' } },
        { name: '감각의 시작점', en: 'Sensory Origin', line: '빛이 가장 강한 곳에서 시작한다.', icon: { src: rule('origin'), alt: '감각의 시작점', ratio: '1 / 1' } },
        { name: '원형 레이어', en: 'Soft Circle', line: '정원형 빛을 기본 형태로 쓴다.', icon: { src: rule('circle'), alt: '원형 레이어', ratio: '1 / 1' } },
        { name: '흐린 선', en: 'Faint Line', line: '얇은 선으로 움직임을 표시한다.', icon: { src: rule('line'), alt: '흐린 선', ratio: '1 / 1' } },
        { name: '교차점', en: 'Intersection', line: '선과 원이 만나는 곳에 빛을 둔다.', icon: { src: rule('intersection'), alt: '교차점', ratio: '1 / 1' } },
        { name: '질감', en: 'Texture', line: '필름 그레인을 전체에 입힌다.', icon: { src: rule('texture'), alt: '질감', ratio: '1 / 1' } },
      ],
    },
    {
      no: '03',
      title: '1차 생성',
      body: '사진을 분석하는 시스템을 AI와 함께 개발했다. 1차 결과는 입자와 광원이 과해 사용하지 않았다.',
      images: [1, 2, 3].map((n) => ({ src: `gen1-${n}.jpg`, alt: `1차 생성 ${n}`, ratio: '1 / 1' })),
    },
    {
      no: '04',
      title: '최종 그래픽 결과',
      body: '1차 결과를 고쳐 최종 시스템을 완성했다. 감정 단어 10개 중 2개를 고르면, 단어에 따라 색과 밝기, 번짐이 달라진다.',
      source: {
        title: '원본 사진',
        notes: ['비 오는 날 거리'],
        image: { src: 'final-source.jpg', alt: '원본 사진 - 비 오는 날 거리', ratio: '1 / 1' },
      },
      results: [
        { title: '슬픔', notes: ['남색 계열', '어둡게', '번짐 크게'], image: { src: 'final-sad.jpg', alt: '슬픔', ratio: '1 / 1' } },
        { title: '불안', notes: ['보라 계열', '어둡게', '윤곽 또렷하게'], image: { src: 'final-anxious.jpg', alt: '불안', ratio: '1 / 1' } },
        { title: '슬픔+불안', notes: ['두 값의 평균'], image: { src: 'final-mix.jpg', alt: '슬픔+불안', ratio: '1 / 1' } },
      ],
    },
  ],
  tools: '사용 도구 : Illustrator · ChatGPT · Codex · Claude Code',
  // 03 1차 생성: the mark laid over the unused first results.
  unusedLabel: '사용하지 않음',
};

/* `wide` spans both columns. */
export const scenes = [
  { title: '색의 흔적', line: '마음이 가는 이미지를 고르며 색의 단서를 모은다.', image: { src: 'scene-color.jpg', alt: '색의 흔적', ratio: '4 / 3' } },
  { title: '소리의 흔적', line: '소리를 듣고 마음이 머무는 단서를 선택한다.', image: { src: 'scene-sound.jpg', alt: '소리의 흔적', ratio: '4 / 3' } },
  { title: '기억의 흔적', line: '흐릿한 방의 그림에 선을 더하며 기억을 남긴다.', image: { src: 'scene-memory.jpg', alt: '기억의 흔적', ratio: '4 / 3' } },
  { title: '문장의 흔적', line: '다음에 이어질 이야기를 상상하며 문장을 고른다.', image: { src: 'scene-sentence.jpg', alt: '문장의 흔적', ratio: '4 / 3' } },
  { title: '최종 보고서', line: '무엇에 끌리고 어디서 망설였는지, 조사 기록을 돌아본다.', image: { src: 'scene-report.jpg', alt: '최종 보고서', ratio: '21 / 9' }, wide: true },
  { title: '결과 요약본과 조사원증', line: '조사의 흔적을 가져가는 기록', image: { src: 'scene-badge.jpg', alt: '결과 요약본과 조사원증', ratio: '4 / 5' } },
  { title: '온라인 전시', line: '전시장 밖에서도 이어지는 조사 경험', image: { src: 'scene-online.jpg', alt: '온라인 전시', ratio: '4 / 5' } },
];

/* Fixed top bar. `id` is the section each tab scrolls to. */
export const nav = {
  label: '웹도록',
  home: '웹도록',
  cta: '온라인 전시',
  toTop: '맨 위로',
  logoAlt: 'UNANSWERED',
  tabs: [
    { id: 'intro', label: '소개' },
    { id: 'route', label: '동선' },
    { id: 'report-flow', label: '보고서' },
    { id: 'process', label: '제작 과정' },
    { id: 'scenes', label: '장면' },
    { id: 'archive', label: '아카이브' },
  ],
};

/* 07 · RECORD — between 장면 and PROCESS ARCHIVE. Dwell time per section is
   measured in memory only (nothing stored or sent). `sections` names the six
   body sections the times are reported under. */
export const record = {
  label: 'RECORD',
  title: '이 페이지에서 가장 오래 머문 곳',
  unit: '초',
  fastest: '가장 빨리 지나간 곳 —',
  closing: '대답하지 못한 것도 기록됩니다.',
  sections: [
    { id: 'cover', label: '표지' },
    { id: 'intro', label: '소개' },
    { id: 'route', label: '동선' },
    { id: 'report-flow', label: '보고서' },
    { id: 'process', label: '제작 과정' },
    { id: 'scenes', label: '장면' },
  ],
};
