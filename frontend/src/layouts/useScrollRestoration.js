/**
 * Scroll restoration for a custom scroll container — owned by A.
 *
 * React Router's own <ScrollRestoration> only handles the *window* scroll. In
 * this shell the window never scrolls; the content pane does. So we track it
 * ourselves.
 *
 * Forward navigation (PUSH/REPLACE) starts at the top, like a fresh page.
 * Back navigation (POP) returns to where the user was, which is the whole
 * point — going back to a list and losing your place in 143 rows is miserable.
 */

import { useEffect, useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Keyed by location.key, which React Router makes unique per history entry.
 * Module-level so it survives AppShell remounts; it only lives as long as the
 * tab does, so there is nothing to clean up.
 */
const positions = new Map();

/** @param {{ current: HTMLElement|null }} ref the scrolling element */
export function useScrollRestoration(ref) {
  const location = useLocation();
  const navigationType = useNavigationType();

  // Record the position continuously, because we cannot know which scroll was
  // the last one before the user navigates away.
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const key = location.key;
    const onScroll = () => positions.set(key, element.scrollTop);

    element.addEventListener('scroll', onScroll, { passive: true });
    return () => element.removeEventListener('scroll', onScroll);
  }, [ref, location.key]);

  // Layout effect so the jump happens before paint — otherwise the user sees
  // the top of the page flash before it scrolls down.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.scrollTop =
      navigationType === 'POP' ? (positions.get(location.key) ?? 0) : 0;

    // Known limitation: if the page's data is still loading, the container is
    // too short to scroll to the saved offset and the restore lands short.
    // Fixing that properly needs the page to report when it is ready — worth
    // doing once a list page is slow enough for anyone to notice.
  }, [ref, location.key, navigationType]);
}
