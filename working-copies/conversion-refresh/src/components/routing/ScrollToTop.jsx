import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    try {
      window.scrollTo({ top: 0, behavior: "auto" });
    } catch {
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  return null;
}
