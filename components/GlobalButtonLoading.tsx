import { useEffect } from "react";

/**
 * Adds a small loading spinner to the button that triggered a network request.
 * This works globally, so individual pages do not need to repeat loading state
 * just to show feedback while an API request is running.
 */
export default function GlobalButtonLoading() {
  useEffect(() => {
    let lastButton: HTMLButtonElement | null = null;
    let lastClickAt = 0;
    const pendingByButton = new Map<HTMLButtonElement, number>();
    const originalFetch = window.fetch.bind(window);

    const getButton = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return null;
      return target.closest("button") as HTMLButtonElement | null;
    };

    const markLoading = (button: HTMLButtonElement) => {
      button.dataset.globalLoading = "true";
      button.setAttribute("aria-busy", "true");
      button.classList.add("global-button-loading");
    };

    const clearLoading = (button: HTMLButtonElement) => {
      button.removeAttribute("data-global-loading");
      button.removeAttribute("aria-busy");
      button.classList.remove("global-button-loading");
    };

    const onClick = (event: MouseEvent) => {
      const button = getButton(event.target);
      if (!button || button.disabled) return;
      lastButton = button;
      lastClickAt = Date.now();
    };

    const onSubmit = (event: SubmitEvent) => {
      const submitter = event.submitter as HTMLButtonElement | null;
      if (!submitter || submitter.disabled) return;
      lastButton = submitter;
      lastClickAt = Date.now();
    };

    window.fetch = async (...args) => {
      const button = lastButton && Date.now() - lastClickAt < 1200 ? lastButton : null;

      if (button) {
        const count = pendingByButton.get(button) || 0;
        pendingByButton.set(button, count + 1);
        markLoading(button);
      }

      try {
        return await originalFetch(...args);
      } finally {
        if (button) {
          const remaining = (pendingByButton.get(button) || 1) - 1;
          if (remaining <= 0) {
            pendingByButton.delete(button);
            clearLoading(button);
          } else {
            pendingByButton.set(button, remaining);
          }
        }
      }
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);

    return () => {
      window.fetch = originalFetch;
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  return (
    <style jsx global>{`
      button.global-button-loading {
        position: relative;
        pointer-events: none;
        cursor: wait !important;
        opacity: 0.82;
      }

      button.global-button-loading::after {
        content: "";
        width: 0.8rem;
        height: 0.8rem;
        border: 2px solid currentColor;
        border-right-color: transparent;
        border-radius: 999px;
        display: inline-block;
        margin-left: 0.5rem;
        vertical-align: -0.12em;
        animation: global-button-spin 0.65s linear infinite;
      }

      @keyframes global-button-spin {
        to {
          transform: rotate(360deg);
        }
      }
    `}</style>
  );
}
