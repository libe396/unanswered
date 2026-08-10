import { useExperienceStore } from '../store/experienceStore';
import { ZoneIntroCard } from '../components/ZoneIntroCard';

export function Zone03IntroScene() {
  const completeScene = useExperienceStore((s) => s.completeScene);

  return (
    <ZoneIntroCard
      zone="ZONE 05"
      title="소리의 단서"
      subtitle="이름 없는 사람의 기억이 담긴, 그 순간의 소리를 들어보세요."
      ctaLabel="조사 시작"
      onContinue={() => completeScene('zone03Intro')}
    />
  );
}
