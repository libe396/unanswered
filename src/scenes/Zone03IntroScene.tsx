import { useExperienceStore } from '../store/experienceStore';
import { ZoneIntroCard } from '../components/ZoneIntroCard';
import { ZONE_INFO } from '../data/zones';

export function Zone03IntroScene() {
  const completeScene = useExperienceStore((s) => s.completeScene);

  return (
    <ZoneIntroCard
      zone={ZONE_INFO.zone03Intro.zone}
      title="소리의 흔적"
      subtitle="그 사람 곁에 있던 소리가 남아 있습니다."
      ctaLabel="조사 시작"
      onContinue={() => completeScene('zone03Intro')}
    />
  );
}
