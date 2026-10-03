/**
 * The delivery scene under the header on every public page (10월 2일 요청). Header and scene share one blue band
 * (app/globals.css, data-site-header / data-site-hero), so they read as one block. The animation lives inside the image
 * (public/art/hero.svg, hero-m.svg below 640 px) and plays once for about 4 s, so no pause control is needed
 * (WCAG 2.2.2); under reduced motion the image draws its last frame.
 */
export function SiteHero(): React.JSX.Element {
  return (
    <div data-site-hero="true">
      <picture>
        <source media="(min-width: 640px)" srcSet="/art/hero.svg" width={560} height={150} />
        <img src="/art/hero-m.svg" alt="" width={560} height={86} fetchPriority="high" />
      </picture>
    </div>
  );
}
