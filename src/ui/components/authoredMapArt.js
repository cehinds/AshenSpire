import { assetUrl } from '../assetmap.js';

// The painting and traced roads are authored; navigation is the usual map board.
export function authoredMapTerrainHtml({ art, visited, fog }) {
  const { width, height } = art;
  const roads = art.routes.map(r => `<polyline points="${r.points.map(p=>p.join(',')).join(' ')}"/>`).join('');
  return `<g class="authored-terrain" aria-hidden="true" pointer-events="none">
    <defs><radialGradient id="legacy-reveal"><stop offset=".45" stop-color="black"/><stop offset="1" stop-color="white"/></radialGradient>
    <mask id="legacy-fog"><rect width="${width}" height="${height}" fill="white"/>${visited.map(p=>`<ellipse cx="${p.x}" cy="${p.y}" rx="${width*.17}" ry="${height*.17}" fill="url(#legacy-reveal)"/>`).join('')}</mask>
    <filter id="legacy-smoke" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${9/width} ${16/height}" numOctaves="3" seed="7"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".3"/></feComponentTransfer></filter>
    <filter id="legacy-road-haze" x="-15%" y="-15%" width="130%" height="130%"><feGaussianBlur stdDeviation="${width*.012} ${height*.012}"/></filter></defs>
    <g class="map-detail-surface"><image class="terrain-detail" href="${assetUrl(art.map)}" width="${width}" height="${height}" preserveAspectRatio="none"/></g>
    ${fog ? `<g mask="url(#legacy-fog)"><rect class="legacy-fog" width="${width}" height="${height}"/><rect class="legacy-smoke" width="${width}" height="${height}" filter="url(#legacy-smoke)"/><g class="legacy-path-haze" filter="url(#legacy-road-haze)">${roads}</g></g>` : ''}
    <g class="legacy-roads">${roads}</g></g>`;
}
