"use client";

import { useEffect, useRef } from "react";

type RevealProps = {
  className?: string;
  children: React.ReactNode;
};

export function Reveal({ className, children }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.classList.add("reveal");

    if (typeof IntersectionObserver === "undefined") {
      element.classList.add("is-visible");
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        element.classList.add("is-visible");
        observer.unobserve(element);
      },
      { threshold: 0.12 },
    );
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
