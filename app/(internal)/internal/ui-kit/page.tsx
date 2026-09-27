import type { Metadata } from "next";
import { Button } from "@/components/primitives/Button";
import { ButtonLink } from "@/components/primitives/ButtonLink";
import { DEFAULT_STYLE_ID, STYLE_LABELS } from "@/lib/style/styles";
import { COLOR_TOKENS, CONTRAST_REQUIREMENTS, STYLE_COLOR_TOKENS, contrastRatio } from "@/lib/style/tokens";

export const metadata: Metadata = {
  title: "화면 부품 모음"
};

const SIGNAL_COLORS = STYLE_COLOR_TOKENS.signal;

const TYPE_SAMPLES = [
  { key: "xs", className: "text-tt-xs", text: "tt-xs · 12px · 척추 라벨, 고지, 원문 용어" },
  { key: "sm", className: "text-tt-sm", text: "tt-sm · 14px · 칩, 이유 한 줄, 안내 줄" },
  { key: "md", className: "text-tt-md", text: "tt-md · 16px · 본문, 버튼" },
  { key: "lg", className: "text-tt-lg font-tt-display [font-weight:var(--tt-weight-display)]", text: "tt-lg · 20px · 상태 제목" },
  { key: "xl", className: "text-tt-xl font-tt-display [font-weight:var(--tt-weight-display)]", text: "tt-xl · 24px · 홈 제목" },
  { key: "eta", className: "text-tt-eta font-tt-display tabular-nums [font-weight:var(--tt-weight-display)]", text: "9월 30일" }
] as const;

function Section({ id, title, children }: { readonly id: string; readonly title: string; readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <section aria-labelledby={`kit-${id}`} className="flex flex-col gap-4 border-t-2 border-tt-ink pt-3">
      <h2 id={`kit-${id}`} className="m-0 font-tt-display text-tt-lg [font-weight:var(--tt-weight-display)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ColorSection(): React.JSX.Element | null {
  if (!SIGNAL_COLORS) return null;
  const colors = SIGNAL_COLORS;
  return (
    <Section id="colors" title="색 토큰 · signal">
      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-5">
        {COLOR_TOKENS.map((token) => (
          <li key={token} className="flex min-w-0 flex-col gap-1">
            <span aria-hidden="true" className="block h-11 border border-tt-rule" style={{ backgroundColor: colors[token] }} />
            <code className="break-all font-tt-mono text-tt-xs">{token}</code>
            <span className="font-tt-mono text-tt-xs text-tt-muted">{colors[token]}</span>
          </li>
        ))}
      </ul>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {CONTRAST_REQUIREMENTS.map(({ fg, bg, min }) => (
          <li key={`${fg}-${bg}`} className="flex flex-wrap gap-x-2 text-tt-xs">
            <code className="break-all font-tt-mono">{fg}</code>
            <span>/</span>
            <code className="break-all font-tt-mono">{bg}</code>
            <span className="font-bold">{contrastRatio(colors[fg], colors[bg]).toFixed(2)}:1</span>
            <span className="text-tt-muted">기준 {min}:1</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function TypeSection(): React.JSX.Element {
  return (
    <Section id="type" title="글자 크기">
      <div className="flex flex-col gap-2">
        {TYPE_SAMPLES.map((sample) => (
          <p key={sample.key} className={`m-0 ${sample.className}`}>
            {sample.text}
          </p>
        ))}
        <p className="m-0 font-tt-mono text-tt-lg tracking-[0.02em] tabular-nums">0000 1234 5678</p>
      </div>
    </Section>
  );
}

function ButtonSection(): React.JSX.Element {
  return (
    <Section id="buttons" title="버튼 · 링크 버튼">
      <p className="m-0 text-tt-sm text-tt-muted">채움 버튼은 화면당 하나만 써요. 조회 중에도 버튼을 잠그지 않고 aria-busy만 걸어요.</p>
      <div className="flex flex-wrap items-center gap-3">
        <div data-demo="button-primary">
          <Button variant="primary" size="lg">
            조회하기
          </Button>
        </div>
        <div data-demo="button-busy">
          <Button variant="primary" size="lg" busy>
            조회 중…
          </Button>
        </div>
        <div data-demo="button-secondary">
          <Button variant="secondary">번호 수정</Button>
        </div>
        <div data-demo="button-text">
          <Button variant="text">다시 조회</Button>
        </div>
        <div data-demo="button-link-internal">
          <ButtonLink href="/privacy" variant="secondary" label="개인정보처리방침" />
        </div>
      </div>
    </Section>
  );
}

export default function UiKitPage(): React.JSX.Element {
  return (
    <main data-ui-kit="true" className="min-h-screen bg-tt-ground px-4 py-8 font-tt-body text-tt-ink sm:px-8">
      <div className="mx-auto flex max-w-[960px] flex-col gap-10">
        <header className="flex flex-col gap-2">
          <p className="m-0 text-tt-xs font-bold">
            내부 확인용 · {STYLE_LABELS[DEFAULT_STYLE_ID]} 스타일 ({DEFAULT_STYLE_ID})
          </p>
          <h1 className="m-0 font-tt-display text-tt-xl [font-weight:var(--tt-weight-display)]">화면 부품 모음</h1>
          <p className="m-0 max-w-[640px] text-tt-sm text-tt-muted">
            토큰과 공통 부품을 한 화면에서 확인해요. 값의 기준은 DESIGN.md와 app/styles/tokens.css예요.
          </p>
        </header>
        <ColorSection />
        <TypeSection />
        <ButtonSection />
      </div>
    </main>
  );
}
