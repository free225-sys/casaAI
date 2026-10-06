import { useEffect, useState, type RefObject } from "react";

/** Vrai dès que l'élément approche de l'écran (ou immédiatement si le navigateur n'a pas d'IntersectionObserver). Une fois vrai, il le reste :
 * sert à ne charger le module de découverte et ses liens que pour les visiteurs qui y arrivent réellement. */
export function useNearViewport(ref: RefObject<Element | null>, margin = "300px"): boolean {
  const [near, setNear] = useState(() => typeof IntersectionObserver === "undefined");
  useEffect(() => {
    if (near) return;
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setNear(true); observer.disconnect(); }
    }, { rootMargin: margin });
    observer.observe(element);
    return () => observer.disconnect();
  }, [near, ref, margin]);
  return near;
}
