import L from 'leaflet';

/**
 * Énhånds-zoom («dobbelttrykk og dra») for Leaflet, slik som i Google Maps.
 *
 * Trykk én gang, trykk igjen på omtrent samme sted og hold fingeren nede:
 *   dra ned → zoom inn, dra opp → zoom ut, rundt kartets sentrum (sentrum ligger i ro).
 *   Vanlig dobbelttrykk zoomer fortsatt inn rundt punktet man trykket på.
 * Løftes fingeren uten å dra, zoomes det inn ett trinn (vanlig dobbelttrykk).
 *
 * Leaflet 1.9 har ikke denne gesten. Bevegelsen bruker samme interne kall som
 * Leaflets egen knipe-zoom (_moveStart/_move/_animateZoom), så den er like jevn
 * og snapper til zoomSnap når fingeren løftes, akkurat som knipe-zoom.
 *
 * Gjelder bare touch. Mus og knipe-zoom med to fingre påvirkes ikke.
 */

export const ONE_FINGER_ZOOM = {
  /** Maks tid fra første trykk slippes til andre trykk starter */
  maxTapIntervalMs: 300,
  /** Maks avstand mellom første og andre trykk */
  maxTapDistancePx: 30,
  /** Maks bevegelse for at et trykk skal regnes som et trykk */
  tapSlopPx: 10,
  /** Hvor langt man drar før zoomen starter (skiller dra fra dobbelttrykk) */
  dragStartPx: 6,
  /** Piksler loddrett per zoomnivå */
  pxPerZoomLevel: 120,
} as const;

/** zoom = startZoom + dy / k, begrenset til [min, max]. dy > 0 betyr dra nedover. */
export function oneFingerZoomLevel(
  startZoom: number,
  dy: number,
  min: number,
  max: number,
  pxPerZoomLevel: number = ONE_FINGER_ZOOM.pxPerZoomLevel
): number {
  return Math.min(max, Math.max(min, startZoom + dy / pxPerZoomLevel));
}

// Leaflets interne metoder (stabile i 1.x, brukes av Map.TouchZoom)
type LeafletMapInternals = L.Map & {
  _stop(): void;
  _moveStart(zoomChanged: boolean, noMoveStart: boolean): L.Map;
  _move(center: L.LatLng, zoom: number, data?: object, supressEvent?: boolean): L.Map;
  _animateZoom(center: L.LatLng, zoom: number, startAnim: boolean, noUpdate?: boolean | number): void;
  _resetView(center: L.LatLng, zoom: number): void;
  _limitZoom(zoom: number): number;
};

type Phase = 'idle' | 'armed' | 'zooming';

/** Kobler gesten til kartet. Returnerer en funksjon som fjerner den. */
export function attachOneFingerZoom(leafletMap: L.Map): () => void {
  const map = leafletMap as LeafletMapInternals;
  const container = map.getContainer();
  const cfg = ONE_FINGER_ZOOM;

  const touchPointers = new Set<number>();
  let lastTap: { time: number; x: number; y: number } | null = null;
  let down: { id: number; time: number; x: number; y: number; moved: boolean } | null = null;

  let phase: Phase = 'idle';
  let gesturePointer = -1;
  let startY = 0;
  let startZoom = 0;
  let anchorPoint = L.point(0, 0); // trykkpunktet, brukes bare av vanlig dobbelttrykk
  let center = L.latLng(0, 0); // kartets sentrum ved start; ligger i ro under hele dra-gesten
  let zoom = 0;
  let raf = 0;
  // touch*-hendelser kommer etter pointer*-hendelsene; svelg dem til fingeren er løftet
  let swallowTouches = false;
  let lastTouchTime = -Infinity;

  const pointOf = (e: PointerEvent) => map.mouseEventToContainerPoint(e as unknown as MouseEvent);

  const swallow = (e: Event) => {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
  };

  const gestureAllowed = () => {
    // Følg kartets egne låser (f.eks. når en dialog med glidebryter er åpen)
    const tz = (map as L.Map & { touchZoom?: L.Handler }).touchZoom;
    return !tz || tz.enabled();
  };

  const finish = (commit: boolean) => {
    cancelAnimationFrame(raf);
    if (phase === 'zooming' && commit) {
      const target = map._limitZoom(zoom);
      const c = center;
      if (map.options.zoomAnimation) {
        map._animateZoom(c, target, true, map.options.zoomSnap);
      } else {
        map._resetView(c, target);
      }
    } else if (phase === 'zooming') {
      map._resetView(center, map._limitZoom(zoom));
    }
    phase = 'idle';
    gesturePointer = -1;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    lastTouchTime = performance.now();
    touchPointers.add(e.pointerId);

    // Finger nummer to: avbryt egen gest og la knipe-zoom ta over
    if (touchPointers.size > 1) {
      if (phase !== 'idle') finish(true);
      lastTap = null;
      down = null;
      return;
    }

    if (touchPointers.size === 1) swallowTouches = false;
    const now = performance.now();
    const p = pointOf(e);
    const isSecondTap =
      !!lastTap &&
      now - lastTap.time <= cfg.maxTapIntervalMs &&
      Math.hypot(p.x - lastTap.x, p.y - lastTap.y) <= cfg.maxTapDistancePx;

    if (isSecondTap && gestureAllowed()) {
      swallow(e);
      lastTap = null;
      down = null;
      phase = 'armed';
      swallowTouches = true;
      gesturePointer = e.pointerId;
      // Kartfliser under fingeren fjernes når zoomnivået skifter. Fang pekeren på
      // kartbeholderen, ellers mister vi fingeren etter et par zoomnivåer.
      try {
        container.setPointerCapture(e.pointerId);
      } catch {
        // ignorer
      }
      startY = e.clientY;
      startZoom = map.getZoom();
      zoom = startZoom;
      anchorPoint = p;
      center = map.getCenter();
      map._stop();
      return;
    }

    down = { id: e.pointerId, time: now, x: p.x, y: p.y, moved: false };
  };

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    if (phase === 'idle' || e.pointerId !== gesturePointer) {
      if (down && e.pointerId === down.id) {
        const p = pointOf(e);
        if (Math.hypot(p.x - down.x, p.y - down.y) > cfg.tapSlopPx) down.moved = true;
      }
      return;
    }
    swallow(e);

    const dy = e.clientY - startY; // bare loddrett bevegelse teller
    if (phase === 'armed') {
      if (Math.abs(dy) < cfg.dragStartPx) return;
      phase = 'zooming';
      map._moveStart(true, false);
    }

    zoom = oneFingerZoomLevel(startZoom, dy, map.getMinZoom(), map.getMaxZoom());
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      map._move(center, zoom, { pinch: true, round: false });
    });
  };

  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    lastTouchTime = performance.now();
    touchPointers.delete(e.pointerId);

    if (phase !== 'idle' && e.pointerId === gesturePointer) {
      swallow(e);
      const cancelled = e.type === 'pointercancel';
      if (phase === 'armed' && !cancelled) {
        // Vanlig dobbelttrykk: ett trinn inn, rundt punktet man trykket på
        phase = 'idle';
        gesturePointer = -1;
        map.setZoomAround(anchorPoint, map.getZoom() + (map.options.zoomDelta ?? 1));
      } else {
        finish(!cancelled);
      }
      return;
    }

    if (down && e.pointerId === down.id) {
      const p = pointOf(e);
      lastTap =
        !down.moved && e.type === 'pointerup' && touchPointers.size === 0
          ? { time: performance.now(), x: p.x, y: p.y }
          : null;
      down = null;
    }
  };

  // Lyttes på document: touch-hendelser går til elementet fingeren startet på, selv om det er fjernet.
  // Mens gesten pågår skal ingen andre (Leaflet-dra, klikk, nettleserens egen dobbelttrykk-zoom) se fingeren.
  const onTouch = (e: TouchEvent) => {
    if (!swallowTouches) return;
    if (e.touches.length > 1) {
      // To fingre: slipp taket så Leaflets knipe-zoom får hendelsene
      swallowTouches = false;
      return;
    }
    swallow(e);
    if ((e.type === 'touchend' || e.type === 'touchcancel') && e.touches.length === 0) swallowTouches = false;
  };
  // Leaflets dobbeltklikk-zoom skal bare gjelde mus. For touch gjør vi dobbelttrykket selv
  // (med krav til avstand), ellers ville to trykk langt fra hverandre også zoomet.
  type DczHandler = L.Handler & { _onDoubleClick: (e: L.LeafletMouseEvent) => void };
  const dcz = map.doubleClickZoom as unknown as DczHandler | undefined;
  const originalOnDoubleClick = dcz?._onDoubleClick;
  const isTouchOriginated = (ev?: Event) => {
    const pe = ev as (PointerEvent & { sourceCapabilities?: { firesTouchEvents?: boolean } }) | undefined;
    return (
      pe?.pointerType === 'touch' ||
      !!pe?.sourceCapabilities?.firesTouchEvents ||
      performance.now() - lastTouchTime < 1000
    );
  };
  if (dcz && originalOnDoubleClick) {
    const wasEnabled = dcz.enabled();
    dcz.disable();
    dcz._onDoubleClick = function (this: DczHandler, e: L.LeafletMouseEvent) {
      if (isTouchOriginated(e.originalEvent)) return;
      originalOnDoubleClick.call(this, e);
    };
    if (wasEnabled) dcz.enable();
  }

  const capture = { capture: true, passive: false } as const;
  container.addEventListener('pointerdown', onPointerDown, capture);
  container.addEventListener('pointermove', onPointerMove, capture);
  container.addEventListener('pointerup', onPointerUp, capture);
  container.addEventListener('pointercancel', onPointerUp, capture);
  document.addEventListener('touchstart', onTouch, capture);
  document.addEventListener('touchmove', onTouch, capture);
  document.addEventListener('touchend', onTouch, capture);
  document.addEventListener('touchcancel', onTouch, capture);

  return () => {
    finish(false);
    if (dcz && originalOnDoubleClick) {
      const wasEnabled = dcz.enabled();
      dcz.disable();
      dcz._onDoubleClick = originalOnDoubleClick;
      if (wasEnabled) dcz.enable();
    }
    container.removeEventListener('pointerdown', onPointerDown, capture);
    container.removeEventListener('pointermove', onPointerMove, capture);
    container.removeEventListener('pointerup', onPointerUp, capture);
    container.removeEventListener('pointercancel', onPointerUp, capture);
    document.removeEventListener('touchstart', onTouch, capture);
    document.removeEventListener('touchmove', onTouch, capture);
    document.removeEventListener('touchend', onTouch, capture);
    document.removeEventListener('touchcancel', onTouch, capture);
  };
}
