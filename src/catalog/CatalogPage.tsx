import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import wordmark from '../assets/wordmark.svg';
import { Overview } from './Overview';
import { Research } from './Research';
import { Result } from './Result';
import { overviewChapters } from './editorialContent';
import './catalog.css';
import './cinematic.css';
import './editorial.css';
import './glass.css';

type Tab = 'overview' | 'research' | 'result';
type Route = { tab: Tab; chapter?: string; index?: number };
const tabs: { id: Tab; label: string }[] = [{ id: 'overview', label: 'Overview' }, { id: 'research', label: 'Research' }, { id: 'result', label: 'Result' }];
const legacySections: Record<string, number> = { cover: 0, intro: 0, route: 2, 'report-flow': 4, process: 3, scenes: 4 };

function readRoute(): Route {
  const hash = window.location.hash.slice(1);
  const research = /^(?:research|archive)-(\d{2})$/.exec(hash);
  if (research && Number(research[1]) >= 1 && Number(research[1]) <= 11) return { tab: 'research', chapter: research[1] };
  const overview = /^overview-0([1-5])$/.exec(hash);
  if (overview) return { tab: 'overview', index: Number(overview[1]) - 1 };
  if (hash === 'result') return { tab: 'result' };
  if (hash === 'research' || hash === 'archive') return { tab: 'research' };
  return { tab: 'overview', index: legacySections[hash] };
}

function Lightbox({ image, onClose }: { image: { url: string; alt: string } | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [actual, setActual] = useState(false);
  useEffect(() => {
    if (image && !dialog.current?.open) dialog.current?.showModal();
    if (!image && dialog.current?.open) dialog.current?.close();
  }, [image]);
  return <dialog ref={dialog} className="editorial-lightbox" aria-label={image?.alt ?? '이미지 확대'} onClose={() => { setActual(false); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
    {image ? <>
      <header><p>{image.alt}</p><div><button type="button" onClick={() => setActual(!actual)}>{actual ? '화면에 맞추기' : '원본 크기로 읽기'}</button><button type="button" autoFocus onClick={() => dialog.current?.close()}>닫기 ×</button></div></header>
      <div className={`editorial-lightbox-image${actual ? ' is-actual' : ''}`} tabIndex={0} aria-label="확대 이미지 스크롤 영역"><img src={image.url} alt={image.alt} /></div>
    </> : null}
  </dialog>;
}

export function CatalogPage() {
  const [route, setRoute] = useState<Route>(readRoute);
  const rememberedResearch = useRef<string | null>(route.chapter ?? null);
  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState<{ url: string; alt: string } | null>(null);
  const overview = useRef<HTMLDivElement>(null);
  const open = (url: string, alt: string) => setZoomed({ url, alt });
  const navigate = (next: Route) => {
    if (next.tab === 'research') rememberedResearch.current = next.chapter ?? null;
    const hash = next.tab === 'research' && next.chapter ? `research-${next.chapter}` : next.tab === 'overview' && next.index !== undefined ? overviewChapters[next.index].id : next.tab;
    if (window.location.hash !== `#${hash}`) history.pushState(null, '', `#${hash}`);
    setRoute(next);
  };
  useEffect(() => {
    const sync = () => { const next = readRoute(); if (next.tab === 'research') rememberedResearch.current = next.chapter ?? null; setRoute(next); };
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    document.title = '미응답 UNANSWERED · 전시 소개';
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync); };
  }, []);
  useLayoutEffect(() => {
    if (route.tab !== 'overview' || route.index === undefined) return;
    const panel = overview.current;
    const section = document.getElementById(overviewChapters[route.index].id);
    if (!panel || !section) return;
    const top = section.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop;
    panel.scrollTo({ top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [route]);
  useEffect(() => {
    if (route.tab !== 'overview') return;
    const panel = overview.current;
    if (!panel) return;
    let frame = 0;
    const measure = () => {
      const top = panel.getBoundingClientRect().top;
      const distances = overviewChapters.map((chapter) => Math.abs((document.getElementById(chapter.id)?.getBoundingClientRect().top ?? top) - top));
      setActive(distances.indexOf(Math.min(...distances)));
    };
    const onScroll = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    panel.addEventListener('scroll', onScroll, { passive: true });
    measure();
    return () => { panel.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); };
  }, [route.tab]);
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let target: number;
    if (event.key === 'ArrowRight') target = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') target = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = tabs.length - 1;
    else return;
    event.preventDefault();
    navigate({ tab: tabs[target].id, chapter: tabs[target].id === 'research' ? rememberedResearch.current ?? undefined : undefined });
    document.getElementById(`tab-${tabs[target].id}`)?.focus();
  };
  return <main className="catalog catalog-editorial catalog-glass">
    <header className="editorial-nav">
      <a className="editorial-brand" href={import.meta.env.BASE_URL} aria-label="UNANSWERED Landing"><img src={wordmark} alt="UNANSWERED" /><span>전시 소개</span></a>
      <div className="editorial-tabs" role="tablist" aria-label="전시 소개 메뉴">{tabs.map((tab, i) => <button key={tab.id} id={`tab-${tab.id}`} type="button" role="tab" aria-selected={route.tab === tab.id} aria-controls={`panel-${tab.id}`} tabIndex={route.tab === tab.id ? 0 : -1} onClick={() => navigate({ tab: tab.id, chapter: tab.id === 'research' ? rememberedResearch.current ?? undefined : undefined })} onKeyDown={(event) => onTabKey(event, i)}>{tab.label}</button>)}</div>
      <a className="editorial-enter" href={import.meta.env.BASE_URL}>전시 입장 <span aria-hidden="true">↗</span></a>
    </header>
    <div className="editorial-pane" hidden={route.tab !== 'overview'}><Overview panelRef={overview} active={active} visible={route.tab === 'overview'} onChapter={(index) => navigate({ tab: 'overview', index })} onResearch={(chapter) => navigate({ tab: 'research', chapter })} onResult={() => navigate({ tab: 'result' })} onOpen={open} /></div>
    <div className="editorial-pane" hidden={route.tab !== 'research'}><Research selected={route.tab === 'research' ? route.chapter ?? null : rememberedResearch.current} onSelect={(chapter) => navigate({ tab: 'research', chapter: chapter ?? undefined })} onOpen={open} /></div>
    <div className="editorial-pane" hidden={route.tab !== 'result'}><Result visible={route.tab === 'result'} /></div>
    <Lightbox image={zoomed} onClose={() => setZoomed(null)} />
  </main>;
}
