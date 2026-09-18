/* 渐进增强：正文默认可见，动效失败或被禁用时不影响阅读。 */
(() => {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const running = new Set();
  const header = document.querySelector('.nav');
  const links = [...document.querySelectorAll('.nav nav a[href^="#"]')];
  const sections = links.map((link) => document.querySelector(link.hash));
  const progress = document.createElement('div');
  progress.className = 'reading-progress';
  progress.setAttribute('aria-hidden', 'true');
  document.body.append(progress);

  function animate(target, frames, options = {}) {
    if (preference.matches || !target.animate) return;
    const animation = target.animate(frames, {
      duration: 650,
      easing: 'cubic-bezier(.22, 1, .36, 1)',
      fill: 'backwards',
      ...options,
    });
    running.add(animation);
    animation.onfinish = animation.oncancel = () => running.delete(animation);
  }

  const entrance = [
    { opacity: 0, transform: 'translateY(22px)' },
    { opacity: 1, transform: 'translateY(0)' },
  ];
  const groups = [
    '.intro > *',
    '.workspace-demo',
    '.section-heading',
    '.feature-grid > article',
    '.preview-strip',
    '.permission-grid > article',
    '.safety',
    '.start > div',
    '.steps > li',
    '.faq > details',
    '.download > div',
    'footer > div',
  ];
  const delays = new Map();
  for (const selector of groups) {
    document.querySelectorAll(selector).forEach((target, index) => {
      delays.set(target, Math.min(index, 3) * 70);
    });
  }

  let observer;
  if ('IntersectionObserver' in window && !preference.matches) {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        // 键盘或锚点导航到达的内容立即可读。
        if (entry.target.contains(document.activeElement)) continue;
        animate(entry.target, entrance, { delay: delays.get(entry.target) });
        const highlight = entry.target.querySelector('.highlight');
        if (highlight) {
          animate(highlight, [{ backgroundSize: '0% 100%' }, { backgroundSize: '100% 100%' }], {
            duration: 1000,
            delay: 180,
          });
        }
      }
    }, { threshold: 0, rootMargin: '0px 0px -24px 0px' });
    delays.forEach((delay, target) => observer.observe(target));
  }

  // 一个滚动帧同时更新进度与导航，避免持续运行动画循环。
  let frame = 0;
  function updateScroll() {
    frame = 0;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = maxScroll > 0 ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0;
    progress.style.transform = `scaleX(${ratio})`;
    header.classList.toggle('is-scrolled', window.scrollY > 20);
    let current = -1;
    const boundary = header.getBoundingClientRect().bottom + 60;
    sections.forEach((section, index) => {
      if (section.getBoundingClientRect().top <= boundary) current = index;
    });
    if (maxScroll > 0 && window.scrollY >= maxScroll - 2) current = links.length - 1;
    links.forEach((link, index) => {
      if (index === current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  function scheduleScroll() {
    if (!frame) frame = requestAnimationFrame(updateScroll);
  }
  window.addEventListener('scroll', scheduleScroll, { passive: true });
  window.addEventListener('resize', scheduleScroll);
  document.querySelectorAll('.faq details').forEach((details) => {
    details.addEventListener('toggle', scheduleScroll);
  });
  // 页面高度随 FAQ 展开或响应式布局改变时同步阅读进度。
  if ('ResizeObserver' in window) new ResizeObserver(scheduleScroll).observe(document.body);
  preference.addEventListener('change', () => {
    if (!preference.matches) return;
    observer?.disconnect();
    [...running].forEach((animation) => animation.cancel());
  });
  function finishInteractingEntrance(event) {
    for (const animation of running) {
      if (animation.effect.target.contains(event.target)) animation.cancel();
    }
  }
  document.addEventListener('focusin', finishInteractingEntrance);
  document.addEventListener('pointerdown', finishInteractingEntrance, { passive: true });
  window.addEventListener('beforeprint', () => {
    [...running].forEach((animation) => animation.cancel());
  });
  updateScroll();
})();
