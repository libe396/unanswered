import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { TerminalCorners } from '../components/TerminalCorners';
import { useExperienceStore } from '../store/experienceStore';
import './IntroScene.css';

const STATUS_LINES = [
  '조사 대상의 기록이 확인되었습니다.',
  '남겨진 흔적이 각 구역에 분산되어 있습니다.',
  '조사 의뢰서가 도착했습니다.',
];

const DUST_PARTICLES = [
  { left: '10%', delay: 0, duration: 16 },
  { left: '24%', delay: 4, duration: 19 },
  { left: '39%', delay: 8, duration: 15 },
  { left: '58%', delay: 2, duration: 21 },
  { left: '74%', delay: 6, duration: 17 },
  { left: '90%', delay: 10, duration: 20 },
];

/**
 * Arrival timings. This Scene does not open on the elevator — it opens on the
 * line of light the Memory Field was compressed into, which is still on screen
 * from the previous Scene. The seam runs out to full height, the doors part
 * around it, and only then is there an elevator. Landing's collapse plus these
 * two beats is the whole entry, and it has to stay under three seconds.
 */
const SEAM_EXTEND_MS = 450;
const DOOR_OPEN_MS = 1150;

export function IntroScene() {
  const completeScene = useExperienceStore((s) => s.completeScene);
  const prefersReducedMotion = useReducedMotion();
  const timeScale = prefersReducedMotion ? 0.4 : 1;

  const [seamExtended, setSeamExtended] = useState(false);
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [statusIndex, setStatusIndex] = useState(0);
  const [panelReady, setPanelReady] = useState(false);
  const [documentNoticeVisible, setDocumentNoticeVisible] = useState(false);
  const [documentOpen, setDocumentOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [floor, setFloor] = useState('3');
  const [floorFlicker, setFloorFlicker] = useState(false);
  const [departing, setDeparting] = useState(false);

  const timeoutsRef = useRef<number[]>([]);
  const animationFramesRef = useRef<number[]>([]);
  const elevatorAudioRef = useRef<HTMLAudioElement | null>(null);

  function schedule(fn: () => void, ms: number) {
    timeoutsRef.current.push(window.setTimeout(fn, ms));
  }

  function scheduleNextFrame(fn: () => void) {
    animationFramesRef.current.push(window.requestAnimationFrame(fn));
  }

  function setElevatorVolume(volume: number) {
    const audio = elevatorAudioRef.current;
    if (!audio) return;
    audio.volume = Math.max(0, Math.min(volume, 0.14));
  }

  function playElevatorSound(volume: number) {
    const audio = elevatorAudioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setElevatorVolume(volume);
    void audio.play().catch(() => {
      // Audio is atmospheric only; browser autoplay policy must never block the Scene.
    });
  }

  function stopElevatorSound() {
    const audio = elevatorAudioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }

  useEffect(() => {
    const elevatorAudio = new Audio(`${import.meta.env.BASE_URL}audio/elevator-open.wav`);
    elevatorAudio.preload = 'auto';
    elevatorAudio.loop = false;
    elevatorAudio.volume = 0;
    elevatorAudioRef.current = elevatorAudio;

    const seamAt = SEAM_EXTEND_MS * timeScale;
    const openAt = seamAt + DOOR_OPEN_MS * timeScale;
    // Everything the car does waits for the doors — the status readout must not
    // already be running behind a closed door.
    const interior = openAt * 0.75;

    if (import.meta.env.DEV) console.info('[entry] elevator-mounted');

    schedule(() => setSeamExtended(true), 40);
    schedule(() => {
      if (import.meta.env.DEV) console.info('[entry] door-open-start');
      setDoorsOpen(true);
      scheduleNextFrame(() => playElevatorSound(0.09));
    }, seamAt);
    schedule(() => setElevatorVolume(0.055), openAt + 600 * timeScale);
    schedule(() => setStatusIndex(1), interior + 3300 * timeScale);
    schedule(() => setStatusIndex(2), interior + 4600 * timeScale);
    schedule(() => {
      setDocumentNoticeVisible(true);
      setPanelReady(true);
    }, interior + 6200 * timeScale);

    return () => {
      timeoutsRef.current.forEach((id) => window.clearTimeout(id));
      animationFramesRef.current.forEach((id) => window.cancelAnimationFrame(id));
      timeoutsRef.current = [];
      animationFramesRef.current = [];
      stopElevatorSound();
      elevatorAudioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleApprove() {
    // Guards against double-input while the departure sequence is already running.
    if (!panelReady || isApproving) return;
    setIsApproving(true);

    const stillness = 400 * timeScale;
    const doorAt = stillness + 250 * timeScale;
    const leaveAt = doorAt + (prefersReducedMotion ? 500 : 1100) * timeScale;

    schedule(() => {
      setFloorFlicker(true);
      setFloor('B1');
      setElevatorVolume(0.035);
    }, stillness);
    schedule(() => {
      setDeparting(true);
      setElevatorVolume(0.012);
    }, doorAt);
    schedule(() => {
      stopElevatorSound();
      completeScene('intro');
    }, leaveAt);
  }

  const vibrationAnimate = prefersReducedMotion
    ? {}
    : isApproving
      ? { x: [0, 1.4, -1.1, 1.6, -0.8, 0], y: [0, -0.6, 0.5, -0.4, 0.3, 0] }
      : { x: [0, 0.5, -0.4, 0.3, 0], y: [0, -0.3, 0.2, -0.2, 0] };
  const vibrationTransition = prefersReducedMotion
    ? { duration: 0 }
    : isApproving
      ? { duration: 0.5, repeat: 2, ease: 'easeInOut' as const }
      : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' as const };

  const sceneClass = [
    'intro-scene',
    seamExtended ? 'intro-scene--seam-extended' : '',
    doorsOpen ? 'intro-scene--open' : '',
    isApproving ? 'intro-scene--moving' : '',
    floorFlicker ? 'intro-scene--arrived' : '',
    departing ? 'intro-scene--departing' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={sceneClass}>
      {/* Separate from the stage because Framer owns the stage's transform for
          the car's vibration — the camera push needs its own element. */}
      <div className="intro-scene__camera">
      <motion.div
        className="intro-scene__stage"
        animate={vibrationAnimate}
        transition={vibrationTransition}
      >
        <motion.div
          className="intro-scene__wall intro-scene__wall--left"
          animate={prefersReducedMotion ? {} : { opacity: [0.55, 0.68, 0.55] }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 9, repeat: Infinity, ease: 'easeInOut' }
          }
        />
        <motion.div
          className="intro-scene__wall intro-scene__wall--right"
          animate={prefersReducedMotion ? {} : { opacity: [0.6, 0.5, 0.6] }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }
          }
        />

        {!prefersReducedMotion
          ? DUST_PARTICLES.map((particle, index) => (
              <motion.span
                key={index}
                className="intro-scene__dust"
                style={{ left: particle.left }}
                animate={{ y: ['0%', '-120%'], opacity: [0, 0.5, 0] }}
                transition={{
                  duration: particle.duration,
                  delay: particle.delay,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              />
            ))
          : null}

        <div className="intro-scene__seam" />
        <div className="intro-scene__vignette" />

        <motion.div
          className="intro-scene__led"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.4 * timeScale, delay: 1.8 * timeScale }}
        >
          <span
            className={`intro-scene__led-floor${
              floorFlicker ? ' intro-scene__led-floor--flicker' : ''
            }`}
          >
            {floor}
          </span>
          <span className="intro-scene__led-caption">도착지 확인 중</span>
        </motion.div>

        <motion.div
          className="intro-scene__status"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2 * timeScale, delay: 2.3 * timeScale }}
          aria-live="polite"
        >
          <span className="intro-scene__status-label">STATUS</span>
          <AnimatePresence mode="wait">
            <motion.span
              key={statusIndex}
              className="intro-scene__status-line"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.6 }}
            >
              {STATUS_LINES[statusIndex]}
            </motion.span>
          </AnimatePresence>
        </motion.div>

        <AnimatePresence>
          {documentNoticeVisible && !documentOpen && !isApproving ? (
            <motion.button
              type="button"
              className={`intro-scene__document-arrival${
                panelReady ? ' intro-scene__document-arrival--ready' : ''
              }`}
              onClick={() => setDocumentOpen(true)}
              disabled={!panelReady}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.75 * timeScale, ease: [0.22, 1, 0.36, 1] }}
            >
              <TerminalCorners />
              <span className="intro-scene__document-arrival-kicker">INCOMING DOCUMENT</span>
              <span className="intro-scene__document-arrival-title">
                INVITATION TO THE INVESTIGATION
              </span>
            </motion.button>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {documentOpen && !isApproving ? (
            <motion.div
              className="intro-scene__document-layer"
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.8 * timeScale, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="intro-scene__case-file" role="dialog" aria-label="조사 의뢰서">
                <div className="intro-scene__envelope" aria-hidden="true">
                  <div className="intro-scene__envelope-flap" />
                  <div className="intro-scene__envelope-string intro-scene__envelope-string--top" />
                  <div className="intro-scene__envelope-string intro-scene__envelope-string--bottom" />
                  <span className="intro-scene__envelope-stamp">UNANSWERED</span>
                  <div className="intro-scene__envelope-title">
                    <span>조사 의뢰서</span>
                    <small>INVITATION TO THE INVESTIGATION</small>
                  </div>
                </div>

                <section className="intro-scene__letter">
                  <div className="intro-scene__letter-content">
                    <p>안녕하세요.</p>
                    <p>
                      당신은 한 사람의 기록을 조사하기 위해
                      <br />
                      이곳에 초대되었습니다.
                    </p>
                    <p>
                      우리는 오랫동안 자신을 설명하지 못한 채
                      <br />
                      남겨진 흔적들을 수집해왔습니다.
                    </p>
                    <p>
                      그 사람은 어떤 색에 오래 머물렀고,
                      <br />
                      어떤 문장 앞에서 멈추었으며,
                      <br />
                      어떤 기억을 끝내 설명하지 못했습니다.
                    </p>
                    <p>
                      당신의 임무는
                      <br />
                      그 사람이 누구인지 알아내는 것입니다.
                    </p>
                    <p>조사를 시작해주세요.</p>
                    <p className="intro-scene__letter-signature">미응답 프로젝트 팀 드림</p>
                  </div>

                  <button type="button" className="intro-scene__letter-start" onClick={handleApprove}>
                    <span>조사를 시작한다</span>
                    <span className="intro-scene__letter-start-arrow" aria-hidden="true">
                      →
                    </span>
                  </button>
                </section>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
      </div>

      {/*
        The doors sit in front of everything and are the first thing on screen.
        The arrival seam between them is the same line of light the Memory Field
        was compressed into one frame earlier — same position, same colour — so
        the Scene change lands as a match cut rather than as a transition.
      */}
      <div className="intro-scene__arrival" aria-hidden="true">
        <div className="intro-scene__door intro-scene__door--left" />
        <div className="intro-scene__door intro-scene__door--right" />
        <div className="intro-scene__arrival-glow" />
        <div className="intro-scene__arrival-seam" />
      </div>

      <div className="intro-scene__flash" />
    </div>
  );
}
