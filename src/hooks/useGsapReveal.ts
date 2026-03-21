import { RefObject } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';

gsap.registerPlugin(useGSAP);

export function useGsapReveal(rootRef: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useGSAP(() => {
    const root = rootRef.current;
    if (!root) return;

    const mm = gsap.matchMedia();

    mm.add(
      {
        reduceMotion: '(prefers-reduced-motion: reduce)',
        allowMotion: '(prefers-reduced-motion: no-preference)',
      },
      context => {
        const { reduceMotion } = context.conditions as { reduceMotion?: boolean };
        const sections = root.querySelectorAll<HTMLElement>('[data-reveal]');
        const staggerGroups = root.querySelectorAll<HTMLElement>('[data-reveal-stagger]');
        const floats = root.querySelectorAll<HTMLElement>('[data-reveal-float]');

        if (reduceMotion) {
          gsap.set([sections, staggerGroups, floats], { clearProps: 'all', autoAlpha: 1, y: 0, scale: 1 });
          return;
        }

        gsap.set(sections, { autoAlpha: 0, y: 18 });
        gsap.set(staggerGroups, { autoAlpha: 0, y: 14 });
        gsap.set(floats, { y: 0 });

        gsap.to(sections, {
          autoAlpha: 1,
          y: 0,
          duration: 0.62,
          ease: 'expo.out',
          stagger: 0.08,
          overwrite: 'auto',
        });

        staggerGroups.forEach(group => {
          const items = group.querySelectorAll<HTMLElement>('[data-reveal-item]');
          if (!items.length) return;
          gsap.set(items, { autoAlpha: 0, y: 14 });
          gsap.to(items, {
            autoAlpha: 1,
            y: 0,
            duration: 0.52,
            ease: 'power3.out',
            stagger: 0.06,
            delay: 0.08,
            overwrite: 'auto',
          });
        });

        floats.forEach(element => {
          gsap.to(element, {
            y: -5,
            duration: 2.8,
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: true,
          });
        });
      },
      root,
    );

    return () => {
      mm.revert();
    };
  }, { scope: rootRef, dependencies: deps, revertOnUpdate: true });
}
