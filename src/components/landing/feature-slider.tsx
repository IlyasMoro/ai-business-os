"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { FEATURES } from "@/components/landing/feature-bento";
import { cn } from "@/lib/utils";
import styles from "@/components/landing/landing.module.css";

/* The landing page features as one square cornered split panel that slides
   between them: a soft navy left half with a real screenshot of the module,
   slightly tilted, and a dark glass right half
   with the copy and three points. The arrows sit beside the slide count;
   the dots, a horizontal swipe and the keyboard arrow keys also move it.
   Slides out of view are inert, so focus and screen readers only ever
   reach the visible one. */

const SWIPE_MIN = 40;

export function FeatureSlider() {
  const [index, setIndex] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const count = FEATURES.length;

  const go = (i: number) => setIndex((i + count) % count);
  const next = () => go(index + 1);
  const prev = () => go(index - 1);

  return (
    <div>
      {/* The arrows and corner square are placed against this box, so the
          dots sit outside it, below the panel. */}
      <div className={styles.slider}>
      <div
        className={styles.viewport}
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label="Features"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") next();
          if (e.key === "ArrowLeft") prev();
        }}
        onTouchStart={(e) => {
          touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }}
        onTouchEnd={(e) => {
          const start = touchStart.current;
          touchStart.current = null;
          if (!start) return;
          const dx = e.changedTouches[0].clientX - start.x;
          const dy = e.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy)) return;
          if (dx < 0) next();
          else prev();
        }}
      >
        <div className={styles.track} style={{ transform: `translateX(-${index * 100}%)` }}>
          {FEATURES.map((feature, i) => {
            const active = i === index;
            return (
              <div
                key={feature.name}
                className={cn(styles.slide, active && styles.slideActive)}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${count}: ${feature.name}`}
                inert={!active}
              >
                <div className={styles.slideL}>
                  <div className={styles.slideShot}>
                    <Image
                      src={feature.shot.src}
                      alt={feature.shot.alt}
                      width={1888}
                      height={1400}
                      sizes="(min-width: 760px) 560px, 100vw"
                    />
                  </div>
                </div>
                <div className={cn(styles.glass, styles.slideR)}>
                  <div className={styles.slideCopy}>
                    <p className={styles.slideEyebrow}>{feature.label}</p>
                    <h3 className={styles.slideTitle}>{feature.name}</h3>
                    <p className={styles.slideDesc}>{feature.description}</p>
                    <ul className={styles.slidePoints}>
                      {feature.points.map((point) => (
                        <li key={point}>
                          <span className={styles.slideTick} aria-hidden>
                            <Check />
                          </span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className={styles.slideCount}>
                    <b>{String(i + 1).padStart(2, "0")}</b> / {String(count).padStart(2, "0")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button type="button" onClick={prev} className={cn(styles.arrow, styles.arrowPrev)} aria-label="Previous feature">
        <ArrowLeft className="h-5 w-5" />
      </button>
      <button type="button" onClick={next} className={cn(styles.arrow, styles.arrowNext)} aria-label="Next feature">
        <ArrowRight className="h-5 w-5" />
      </button>
      </div>

      <div className={styles.dots}>
        {FEATURES.map((feature, i) => (
          <button
            key={feature.name}
            type="button"
            onClick={() => go(i)}
            className={cn(styles.dot, i === index && styles.dotActive)}
            aria-label={`Show ${feature.name}`}
            aria-current={i === index ? "true" : undefined}
          />
        ))}
      </div>
    </div>
  );
}
