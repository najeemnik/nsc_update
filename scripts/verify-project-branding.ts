/**
 * Wave 29 verification: wallpaper allow-list, resolution precedence, clamps.
 * Run: npm run test:branding
 */
import {
  sanitizeBgUrl,
  sanitizeProjectBg,
  resolveWallpaper,
  wallpaperLayerStyle,
} from '../src/utils/projectBranding';

let passed = 0;
let failed = 0;
const results: string[] = [];

function check(name: string, cond: boolean, extra = '') {
  if (cond) { passed += 1; results.push(`PASS ${name}`); }
  else { failed += 1; results.push(`FAIL ${name}${extra ? ` — ${extra}` : ''}`); }
}

function main() {
  const good = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
  check('url-data-ok', sanitizeBgUrl(good) === good);
  check('url-data-png-ok', sanitizeBgUrl('data:image/png;base64,iVBORw0KGgo=') !== undefined);
  check('url-svg-no', sanitizeBgUrl('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=') === undefined);
  check('url-js-no', sanitizeBgUrl('javascript:alert(1)') === undefined);
  check('url-html-no', sanitizeBgUrl('data:text/html;base64,PGI+') === undefined);
  check('url-remote-no', sanitizeBgUrl('https://evil.example/x.jpg') === undefined);
  check('url-http-no', sanitizeBgUrl('http://evil.example/x.jpg') === undefined);
  check('url-relative-ok', sanitizeBgUrl('/assets/bg.png') === '/assets/bg.png');
  check('url-dot-ok', sanitizeBgUrl('./bg.png') === './bg.png');
  check('url-quote-no', sanitizeBgUrl('/a"b.png') === undefined);
  check('url-backslash-no', sanitizeBgUrl('..\\x.png') === undefined);
  check('url-empty-no', sanitizeBgUrl('') === undefined && sanitizeBgUrl(undefined) === undefined);
  check('url-huge-no', sanitizeBgUrl(`data:image/jpeg;base64,${'A'.repeat(3_000_000)}`) === undefined);

  const clean = sanitizeProjectBg({
    backgroundImageUrl: good,
    backgroundSize: 'evil',
    backgroundPosition: 'nope',
    backgroundOpacity: 999,
    backgroundBlur: -3,
  });
  check('bg-size-fallback', clean.size === 'cover');
  check('bg-pos-fallback', clean.position === 'center');
  check('bg-opacity-clamp', clean.opacity === 0.6);
  check('bg-blur-clamp', clean.blur === 0);
  check('bg-badurl-undefined', sanitizeProjectBg({ backgroundImageUrl: 'javascript:x' }).url === undefined);

  const proj = { backgroundImageUrl: good, backgroundOpacity: 20 };
  const glob = { backgroundImageUrl: '/assets/g.png', backgroundOpacity: 30 };
  check('resolve-project-wins', resolveWallpaper(proj, glob).url === good);
  check('resolve-global-fallback', resolveWallpaper({}, glob).url === '/assets/g.png');
  check('resolve-none', resolveWallpaper({}, {}).url === undefined);
  check('resolve-global-opacity', resolveWallpaper({}, glob).opacity === 0.3);

  check('style-hidden', (wallpaperLayerStyle({ url: undefined, size: 'cover', position: 'center', opacity: 0.1, blur: 0 }) as { display?: string }).display === 'none');
  const st = wallpaperLayerStyle({ url: '/assets/g.png', size: 'stretch', position: 'top left', opacity: 0.2, blur: 4 });
  check('style-stretch', st.backgroundSize === '100% 100%' && st.backgroundRepeat === 'no-repeat');
  check('style-blur', st.filter === 'blur(4px)' && st.opacity === 0.2);
  const rp = wallpaperLayerStyle({ url: good, size: 'repeat', position: 'center', opacity: 0.1, blur: 0 });
  check('style-repeat', rp.backgroundRepeat === 'repeat' && rp.filter === undefined);

  console.log(results.join('\n'));
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
