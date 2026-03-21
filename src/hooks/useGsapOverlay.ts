import { RefObject } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';

gsap.registerPlugin(useGSAP);

export function useGsapOverlay(
  active: boolean,
  backdropRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
) {
  useGSAP(() => {
    if (!active) return;

    const backdrop = backdropRef.current;
    const panel = panelRef.current;
    if (!backdrop || !panel) return;

    const mm = gsap.matchMedia();

    mm.add(
      {
        reduceMotion: '(prefers-reduced-motion: reduce)',
        allowMotion: '(prefers-reduced-motion: no-preference)',
      },
      context => {
        const { reduceMotion } = context.conditions as { reduceMotion?: boolean };

        if (reduceMotion) {
          gsap.set([backdrop, panel], { clearProps: 'all', autoAlpha: 1, y: 0 });
          return;
        }

        gsap.fromTo(
          backdrop,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.18, ease: 'power1.out', overwrite: 'auto' },
        );

        gsap.fromTo(
          panel,
          { autoAlpha: 0, y: 28 },
          { autoAlpha: 1, y: 0, duration: 0.4, ease: 'expo.out', overwrite: 'auto' },
        );
      },
    );

    return () => {
      mm.revert();
    };
  }, { scope: panelRef, dependencies: [active], revertOnUpdate: true });
}
