import Link from "next/link";
import { ButtonLink } from "@/components/primitives/ButtonLink";

const LINK_CLASS = "tt-focus text-tt-link underline decoration-2 underline-offset-[5px]";

/** Page frame of /guide and /guide/{slug}: breadcrumbs, the article and a way into the lookup (10월 2일 요청 ②). */
export function GuideShell({
  crumbs,
  children
}: {
  readonly crumbs: ReadonlyArray<{ readonly name: string; readonly href: string | null }>;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-[var(--tt-column)] bg-tt-surface px-[var(--tt-gutter)] py-8 text-tt-ink outline-none"
    >
      <nav aria-label="현재 위치">
        <ol className="m-0 flex list-none flex-wrap items-center gap-x-2 p-0 text-tt-sm">
          {crumbs.map((crumb, index) => (
            <li key={crumb.name} className="flex min-h-[44px] items-center gap-2">
              {index > 0 ? <span aria-hidden="true" className="text-tt-muted">›</span> : null}
              {crumb.href === null ? (
                <span aria-current="page" className="font-bold">
                  {crumb.name}
                </span>
              ) : (
                <Link href={crumb.href} className={`${LINK_CLASS} inline-flex min-h-[44px] items-center`}>
                  {crumb.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
      {children}
      <aside aria-labelledby="guide-cta" className="mt-10 flex flex-col gap-3 border-t-2 border-tt-ink pt-6">
        <h2 id="guide-cta" className="m-0 text-tt-lg font-bold [word-break:keep-all]">
          내 물건은 지금 어디쯤일까요?
        </h2>
        <p className="m-0 text-tt-sm leading-6 [word-break:keep-all]">
          HBL 번호나 운송장 번호 하나로 통관 단계와 국내 배송을 한 화면에서 볼 수 있어요.
        </p>
        <div>
          <ButtonLink href="/" variant="primary" label="지금 조회하기" />
        </div>
      </aside>
    </main>
  );
}

export { LINK_CLASS as GUIDE_LINK_CLASS };
