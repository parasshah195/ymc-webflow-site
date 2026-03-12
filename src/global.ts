import { animatedDetailsAccordions } from '$components/accordions';
import Dialog from '$components/dialog';
import { setCurrentYear } from '$utils/current-year';
import '$utils/disable-webflow-scroll';
import { disableWebflowAnchorSmoothScroll } from '$utils/disable-webflow-scroll';
import handleExternalLinks from '$utils/external-link';
import addMainElementId from '$utils/main-element-id';
import { initBgColorChange } from '$utils/bg-color-change';
import { duplicateMarqueeList } from '$utils/marquee-list';

window.Webflow = window.Webflow || [];
window.Webflow?.push(() => {
  setTimeout(() => {
    const wf = window.Webflow as any;
    window.WF_IX = wf.require('ix3');
    console.debug('Webflow IX3 globalised:', window.WF_IX);
  }, 100);

  // Set current year on respective elements
  setCurrentYear();
  addMainElementId();
  handleExternalLinks();

  initComponents();
  UIFunctions();
  webflowOverrides();

  loadScrollTimelineCSSPolyfill();
  loadVideoPlayer();
  loadTimeline();
});

function loadVideoPlayer() {
  window.conditionalLoadScript('[data-video-el="container"]', 'components/inline-video-player.js');
}

function loadTimeline() {
  window.conditionalLoadScript('.section_timeline', 'components/timeline.js');
}

function initComponents() {
  new Dialog();
}

function UIFunctions() {
  duplicateMarqueeList();
  animatedDetailsAccordions();
  initBgColorChange();
}

function webflowOverrides() {
  disableWebflowAnchorSmoothScroll();
}

function loadScrollTimelineCSSPolyfill() {
  window.loadScript('https://flackr.github.io/scroll-timeline/dist/scroll-timeline.js');
}
