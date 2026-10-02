/**
 * The delivery scene at the top of every public page (10월 2일 요청). The animation lives inside the image
 * (public/art/hero.svg, hero-m.svg below 640 px) and repeats every 7 s. WCAG 2.2.2: the '움직임 멈춤' switch is a native
 * checkbox (no script) — checked, the still image (…-still.svg, loaded only then) replaces the moving one
 * (app/globals.css). Under reduced motion the images draw their last frame and the switch is hidden.
 */
const PAUSE_ID = "site-hero-pause";

function Scene({ still }: { readonly still: boolean }): React.JSX.Element {
  const suffix = still ? "-still" : "";
  return (
    <picture data-hero-scene={still ? "still" : "moving"}>
      <source media="(min-width: 640px)" srcSet={`/art/hero${suffix}.svg`} width={560} height={150} />
      <img src={`/art/hero-m${suffix}.svg`} alt="" width={560} height={86} {...(still ? { loading: "lazy" } : { fetchPriority: "high" })} />
    </picture>
  );
}

export function SiteHero(): React.JSX.Element {
  return (
    <div data-site-hero="true">
      <input id={PAUSE_ID} type="checkbox" data-hero-pause="true" className="sr-only" />
      <Scene still={false} />
      <Scene still />
      <label htmlFor={PAUSE_ID} data-hero-pause-label="true">
        움직임 멈춤
      </label>
    </div>
  );
}
