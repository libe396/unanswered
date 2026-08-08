import { useExperienceStore } from '../store/experienceStore';
import { ZoneIntroCard } from '../components/ZoneIntroCard';

export function Zone03IntroScene() {
  const completeScene = useExperienceStore((s) => s.completeScene);

  return (
    <ZoneIntroCard
      zone="ZONE 05"
      title="소리의 단서를 조사한다."
      subtitle="공간은 보이지 않는 소리를 기억한다."
      ctaLabel="조사 시작"
      onContinue={() => completeScene('zone03Intro')}
    />
  );
}
