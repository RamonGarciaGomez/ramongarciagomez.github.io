/**
 * Tiny utilities for Strava-style encoded polylines.
 * Self-contained — no deps.
 */

// Memoize polylineToSvgPath since the same polyline (recent activities list)
// may be rendered multiple times per build with identical dimensions.
const _svgPathCache = new Map<string, string | null>();

/** Decode a Google encoded polyline string → [lat, lng][] */
export function decodePolyline(str: string): [number, number][] {
  const coords: [number, number][] = [];
  let lat = 0;
  let lng = 0;
  let index = 0;

  while (index < str.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coords.push([lat / 1e5, lng / 1e5]);
  }

  return coords;
}

/**
 * Project a decoded polyline to a normalized SVG path.
 * Returns `null` if there are too few points to draw anything useful.
 */
export function polylineToSvgPath(
  encoded: string,
  width: number,
  height: number,
  padding = 2
): string | null {
  if (!encoded) return null;
  const cacheKey = `${encoded}:${width}x${height}p${padding}`;
  if (_svgPathCache.has(cacheKey)) return _svgPathCache.get(cacheKey)!;
  const coords = decodePolyline(encoded);
  if (coords.length < 2) return null;

  // Scale lng by cos(midLat) for a quick locally-flat projection.
  const lats = coords.map(([lat]) => lat);
  const lngs = coords.map(([, lng]) => lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const midLat = (minLat + maxLat) / 2;
  const cosLat = Math.cos((midLat * Math.PI) / 180);

  const projected = coords.map(([lat, lng]): [number, number] => [
    (lng - minLng) * cosLat,
    maxLat - lat, // flip Y
  ]);

  const maxX = Math.max(...projected.map(([x]) => x));
  const maxY = Math.max(...projected.map(([, y]) => y));
  if (maxX === 0 && maxY === 0) return null;

  const availW = width - padding * 2;
  const availH = height - padding * 2;
  const scale = Math.min(
    maxX > 0 ? availW / maxX : Infinity,
    maxY > 0 ? availH / maxY : Infinity
  );
  const drawW = maxX * scale;
  const drawH = maxY * scale;
  // Center inside viewBox
  const offsetX = padding + (availW - drawW) / 2;
  const offsetY = padding + (availH - drawH) / 2;

  const points = projected.map(
    ([x, y]) =>
      `${(x * scale + offsetX).toFixed(2)},${(y * scale + offsetY).toFixed(2)}`
  );
  const result = "M" + points.join(" L");
  _svgPathCache.set(cacheKey, result);
  return result;
}
