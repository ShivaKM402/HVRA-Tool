declare module 'leaflet-image' {
  import type { Map } from 'leaflet';
  /**
   * Render the current map view to a canvas.
   * @param map  Leaflet map instance.
   * @param done (err, canvas)
   */
  export default function leafletImage(
    map: Map,
    done: (err: Error | null, canvas: HTMLCanvasElement) => void
  ): void;
}