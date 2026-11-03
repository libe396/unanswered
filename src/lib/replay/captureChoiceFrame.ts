import type { ChoiceReplay, ReplayFrame } from './choiceReplay';

/** Intern computed declarations across frames; no live selectors/hover rules in playback. */
export function createFrameCapture(record: ChoiceReplay) {
  const declarations = new Map<string, number>();
  function styleClass(style: CSSStyleDeclaration) {
    const css = Array.from(style)
      .filter(p => !p.startsWith('--') && !p.startsWith('animation') && !p.startsWith('transition'))
      .map(p => `${p}:${style.getPropertyValue(p).replaceAll(`${location.href.split('#')[0]}#`, '#')};`).join('') + 'animation:none!important;transition:none!important;';
    let index = declarations.get(css);
    if (index === undefined) {
      index = record.styles.length;
      declarations.set(css, index);
      record.styles.push(css);
    }
    return `r${index}`;
  }
  return (root: HTMLElement, t: number): ReplayFrame => {
    const scroll: ReplayFrame['scroll'] = [];
    let nodeIndex = 0;
    function copy(source: Element): Element {
      // Do not clone executable/media elements, embedded documents, or user text fields.
      if (source.matches('script,style,link,iframe,object,embed,audio,video')) {
        return document.createElement('span');
      }
      let clone: Element;
      const isTextField = source.matches('input,textarea');
      if (isTextField) {
        // Preserve the field's geometry without retaining a visitor's typed response.
        clone = document.createElement('div');
      } else if (source instanceof HTMLCanvasElement) {
        const img = document.createElement('img');
        try { img.src = source.toDataURL(); } catch { /* Untainted selection canvases only. */ }
        clone = img;
      } else clone = source.cloneNode(false) as Element;
      for (const attr of Array.from(clone.attributes)) {
        if (/^on/i.test(attr.name) || ['style', 'class', 'autofocus', 'tabindex', 'srcdoc'].includes(attr.name)) clone.removeAttribute(attr.name);
      }
      if (source.matches('a,area')) clone.removeAttribute('href');
      if (source instanceof HTMLImageElement) clone.setAttribute('src', source.currentSrc || source.src);
      const className = styleClass(getComputedStyle(source));
      clone.setAttribute('class', className);
      const index = nodeIndex++;
      clone.setAttribute('data-replay-node', String(index));
      if (source.scrollTop || source.scrollLeft) scroll.push([index, source.scrollLeft, source.scrollTop]);
      // Pseudo elements hold borders, glass reflections and selection marks.
      for (const pseudo of ['::before', '::after']) {
        const style = getComputedStyle(source, pseudo);
        if (style.content !== 'none' && style.content !== 'normal') {
          const pseudoClass = styleClass(style);
          const rule = `.${className}${pseudo}{${record.styles[Number(pseudoClass.slice(1))]}}`;
          if (!pseudoRules.has(rule)) { pseudoRules.add(rule); }
        }
      }
      if (!isTextField && !(source instanceof HTMLCanvasElement)) for (const child of source.childNodes) {
        if (child instanceof Element) clone.appendChild(copy(child));
        else if (child.nodeType === Node.TEXT_NODE) clone.appendChild(child.cloneNode());
      }
      return clone;
    }
    const pseudoRules = new Set<string>();
    const clone = copy(root) as HTMLElement;
    const rect = root.getBoundingClientRect();
    clone.style.cssText = `position:absolute!important;left:${rect.left}px!important;top:${rect.top}px!important;margin:0!important;`;
    const pseudoStyle = document.createElement('style');
    pseudoStyle.textContent = [...pseudoRules].join('\n');
    return { t, width: window.innerWidth, height: window.innerHeight,
      html: pseudoStyle.outerHTML + clone.outerHTML, scroll };
  };
}
