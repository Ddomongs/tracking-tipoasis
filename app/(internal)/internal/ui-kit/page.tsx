import type { Metadata } from "next";
import { UiKitInteractive } from "./UiKitInteractive";
import { buildReturnLink } from "@/lib/site";
import { buildInquiryCopy } from "@/lib/tracking/inquiry-copy";
import { AffiliateLinkGroup } from "@/components/primitives/AffiliateLinkGroup";
import { Button } from "@/components/primitives/Button";
import { NoticeBanner } from "@/components/primitives/NoticeBanner";
import { TalkLink } from "@/components/primitives/TalkLink";
import { NumberBar } from "@/components/primitives/NumberBar";
import { EtaDisplay } from "@/components/primitives/EtaDisplay";
import { JourneySpine } from "@/components/primitives/JourneySpine";
import { ButtonLink } from "@/components/primitives/ButtonLink";
import { StatusChip } from "@/components/primitives/StatusChip";
import { ManualAdSlot } from "@/components/ads/ManualAdSlot";
import { DEFAULT_STYLE_ID, STYLE_LABELS } from "@/lib/style/styles";
import { COLOR_TOKENS, CONTRAST_REQUIREMENTS, STYLE_COLOR_TOKENS, contrastRatio } from "@/lib/style/tokens";
import type {
  ActionWeight,
  EtaDate,
  EtaView,
  NoticeView,
  NumberView,
  SpineView,
  StoreLinkView,
  StoreLinksView,
  StorePlacementId,
  Tone
} from "@/lib/tracking/types";
import { channels, disclosures } from "@/config/site.config";
import { groupTrackingNumber } from "@/lib/tracking/number-format";
import { formatKstDate, weekdayLabel } from "@/lib/tracking/time";

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
        <ToneSection />
        <JourneySection />
        <EtaSection />
        <NumberBarSection />
        <LinkSection />
        <NoticeSection />
        <CopySection />
        <AdSlotSection />
      </div>
    </main>
  );
}

const TONES: readonly Tone[] = ["neutral", "progress", "waiting", "attention", "problem", "done"];

const TONE_NAMES: Readonly<Record<Tone, string>> = {
  neutral: "조회 중",
  progress: "정상 진행",
  waiting: "정보 대기",
  attention: "확인 필요",
  problem: "문제",
  done: "완료"
};

/** A signal color field. Full-bleed below 640px like the real result card. */
function Field({ tone, demo, children }: { readonly tone: Tone; readonly demo: string; readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <div data-slot="status-head" data-tone={tone} data-demo={demo} className="-mx-4 sm:mx-0">
      {children}
    </div>
  );
}

function StatusHeadDemo(): React.JSX.Element {
  return (
    <Field tone="progress" demo="status-head">
      <div className="flex flex-col items-start gap-2">
        <StatusChip tone="progress" text="통관 대기 · 2/4" />
        <div className="flex flex-col gap-1">
          <h3 className="m-0 font-tt-display text-tt-lg [font-weight:var(--tt-weight-display)]">통관 순서를 기다리고 있어요</h3>
          <p className="m-0 text-tt-sm font-medium">세관 접수가 끝났고 순서대로 심사가 진행돼요.</p>
        </div>
      </div>
      <JourneySpine spine={CUSTOMS_SPINE} />
      <EtaDisplay eta={DEMO_ETA} />
    </Field>
  );
}

function ToneSection(): React.JSX.Element {
  return (
    <Section id="tones" title="상태 톤 · 칩 · 색면">
      <div data-demo="chips" className="flex flex-wrap gap-2">
        {TONES.map((tone) => (
          <StatusChip key={tone} tone={tone} text={TONE_NAMES[tone]} />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {TONES.map((tone) => (
          <Field key={tone} tone={tone} demo={`field-${tone}`}>
            <StatusChip tone={tone} text={TONE_NAMES[tone]} />
            <p className="m-0 text-tt-sm font-medium">색면 위 글자와 선은 색면 글자색 한 가지만 써요.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary">다시 조회</Button>
              <Button variant="text">번호 수정</Button>
            </div>
          </Field>
        ))}
      </div>
      <StatusHeadDemo />
    </Section>
  );
}

const CUSTOMS_SPINE: SpineView = { current: "customs", issue: null, handoffPending: false, positionLabel: "2/4" };

const SPINE_DEMOS: ReadonlyArray<{ readonly demo: string; readonly caption: string; readonly tone: Tone; readonly spine: SpineView }> = [
  { demo: "spine-customs", caption: "정상 진행 · 통관 대기 2/4", tone: "progress", spine: CUSTOMS_SPINE },
  {
    demo: "spine-handoff",
    caption: "통관 완료 · 인계 대기 2/4",
    tone: "progress",
    spine: { current: "customs", issue: null, handoffPending: true, positionLabel: "2/4" }
  },
  {
    demo: "spine-domestic",
    caption: "국내 배송 3/4",
    tone: "progress",
    spine: { current: "domestic", issue: null, handoffPending: false, positionLabel: "3/4" }
  },
  {
    demo: "spine-arrived",
    caption: "도착 4/4",
    tone: "done",
    spine: { current: "arrived", issue: null, handoffPending: false, positionLabel: "4/4" }
  },
  {
    demo: "spine-stopped",
    caption: "멈춤 · 장기 정체",
    tone: "attention",
    spine: { current: "customs", issue: { at: "customs", kind: "stopped", label: "멈춤" }, handoffPending: false, positionLabel: "2/4" }
  },
  {
    demo: "spine-cut",
    caption: "끊김 · 택배사 조회 지연",
    tone: "attention",
    spine: { current: "domestic", issue: { at: "domestic", kind: "cut", label: "끊김" }, handoffPending: false, positionLabel: "3/4" }
  },
  {
    demo: "spine-cut-ahead",
    caption: "끊김 · 통관 중 택배사 조회 지연",
    tone: "progress",
    spine: { current: "customs", issue: { at: "domestic", kind: "cut", label: "끊김" }, handoffPending: true, positionLabel: "2/4" }
  },
  {
    demo: "spine-branch",
    caption: "갈림 · 여러 택배사",
    tone: "attention",
    spine: { current: "domestic", issue: { at: "domestic", kind: "branch", label: "갈림" }, handoffPending: false, positionLabel: "3/4" }
  },
  {
    demo: "spine-unknown",
    caption: "위치 확인 전 · 국내 도착 전",
    tone: "waiting",
    spine: { current: null, issue: null, handoffPending: false, positionLabel: null }
  }
];

function JourneySection(): React.JSX.Element {
  return (
    <Section id="journey" title="4구간 여정 척추">
      <p className="m-0 text-tt-sm text-tt-muted">
        지금 구간 표식은 정확히 하나, 위치 확인 전에는 없어요. 멈춤·끊김·갈림은 색·아이콘·글자를 함께 써요.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {SPINE_DEMOS.map((item) => (
          <Field key={item.demo} tone={item.tone} demo={item.demo}>
            <p className="m-0 text-tt-sm font-bold">{item.caption}</p>
            <JourneySpine spine={item.spine} />
          </Field>
        ))}
      </div>
      <div data-demo="spine-surface" className="bg-tt-surface p-4">
        <JourneySpine spine={CUSTOMS_SPINE} />
      </div>
    </Section>
  );
}

/** EtaDate for a KST date key, formatted by S03's time helpers ('2026-09-30' → '9월 30일 (수)'). */
function etaDate(key: string): EtaDate {
  const [, month, day] = key.split("-").map(Number);
  return { key, label: formatKstDate(key), month, day, weekday: weekdayLabel(key) };
}

// The gallery pretends today is 2026-09-26 (the fixture date), so 9월 30일 is D-4.
const DEMO_ETA: EtaView = { kind: "date", label: "도착 예상", date: etaDate("2026-09-30"), dday: 4, caption: null };

const HOLIDAY_ETA: EtaView = {
  kind: "holidayAffected",
  label: "도착 예상",
  date: etaDate("2026-09-30"),
  badge: "추석 연휴 영향 · 1~2일 늦어질 수 있어요",
  holidayName: "추석 연휴",
  caption: "통관 완료 예상 9월 28일 (월)"
};

const ETA_DEMOS: ReadonlyArray<{ readonly demo: string; readonly eta: EtaView }> = [
  { demo: "eta-date", eta: DEMO_ETA },
  // S03 addition 5: the "today" view carries '오늘 예상' as its label (resultCopy.etaTodayLabel); caption stays the secondary line.
  { demo: "eta-today", eta: { kind: "today", label: "오늘 예상", date: etaDate("2026-09-26"), caption: null } },
  { demo: "eta-holiday", eta: HOLIDAY_ETA },
  { demo: "eta-overdue", eta: { kind: "overdue", label: "예상했던 날짜", date: etaDate("2026-09-30") } },
  { demo: "eta-delivered", eta: { kind: "deliveredOn", label: "배송 완료일", date: etaDate("2026-09-25") } },
  { demo: "eta-pending", eta: { kind: "pendingInfo", label: "도착 예상", text: "정보 등록 후 안내" } },
  { demo: "eta-withheld", eta: { kind: "withheld", label: "도착 예상", text: "지금은 도착 예상일을 안내하기 어려워요" } },
  { demo: "eta-unknown", eta: { kind: "unknown", label: "도착 예상", text: "아직 예상일을 계산할 기록이 없어요" } },
  { demo: "eta-none", eta: { kind: "none" } }
];

function EtaSection(): React.JSX.Element {
  return (
    <Section id="eta" title="도착 예상">
      <p className="m-0 text-tt-sm text-tt-muted">
        날짜는 화면에서 가장 큰 글자예요. 화면 낭독기는 날짜 문장 하나만 읽고, 숫자 조각은 숨겨요.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {ETA_DEMOS.map((item) => (
          <div key={item.demo} data-demo={item.demo} className="flex min-w-0 flex-col gap-2 bg-tt-surface p-4">
            <EtaDisplay eta={item.eta} />
          </div>
        ))}
      </div>
      <Field tone="progress" demo="field-eta-holiday">
        <EtaDisplay eta={HOLIDAY_ETA} />
      </Field>
    </Section>
  );
}

/** A 30-character HBL-shaped fake (letters + zeros), the longest input the lookup accepts. */
const LONG_HBL = `TEST${"0".repeat(26)}`;

function numberView(raw: string): NumberView {
  return { raw, grouped: groupTrackingNumber(raw) };
}

function NumberBarSection(): React.JSX.Element {
  return (
    <Section id="number-bar" title="번호 바">
      <p className="m-0 text-tt-sm text-tt-muted">
        4자리씩 묶은 고정폭 숫자예요. 말줄임은 없고, 좁은 화면에서는 버튼이 다음 줄로 내려가요.
      </p>
      <div data-demo="number-bar-loading" className="-mx-4 sm:mx-0">
        <NumberBar
          number={numberView("000012345678")}
          carrierLabel="택배사 자동 확인"
          actions={<Button variant="secondary">번호 변경</Button>}
        />
      </div>
      <div data-demo="number-bar-result" className="-mx-4 sm:mx-0">
        <NumberBar
          number={numberView("000012345678")}
          carrierLabel="CJ대한통운"
          actions={
            <>
              <Button variant="secondary">번호 수정</Button>
              <Button variant="text">다시 조회</Button>
            </>
          }
        />
      </div>
      <div data-demo="number-bar-hbl" className="-mx-4 sm:mx-0">
        <NumberBar number={numberView("TEST00000001")} carrierLabel="택배사 배정 전" />
      </div>
      <div data-demo="number-bar-cargo" className="-mx-4 sm:mx-0">
        <NumberBar
          number={numberView("000012345678901234")}
          carrierLabel="택배사"
          actions={<Button variant="secondary">번호 수정</Button>}
        />
      </div>
      <div data-demo="number-bar-hbl30" className="-mx-4 sm:mx-0">
        <NumberBar
          number={numberView(LONG_HBL)}
          carrierLabel="택배사 자동 확인"
          actions={<Button variant="secondary">번호 변경</Button>}
        />
      </div>
    </Section>
  );
}

function storeLink(channel: StoreLinkView["channel"], placement: StorePlacementId, weight: ActionWeight): StoreLinkView {
  const store = channels[channel];
  return { channel, label: store.linkLabel, href: store.urls[placement], isAffiliate: store.isAffiliate, weight };
}

const DELIVERED_STORES: StoreLinksView = {
  placement: "deliveredLead",
  intro: null,
  disclosure: disclosures.coupang,
  links: [storeLink("naver", "deliveredLead", "primary"), storeLink("coupang", "deliveredLead", "secondary")]
};

const STORE_DEMOS: ReadonlyArray<{
  readonly demo: string;
  readonly caption: string;
  readonly layout: "row" | "stack";
  readonly stores: StoreLinksView;
}> = [
  {
    demo: "affiliate-pending",
    caption: "국내 도착 전 · 구매처 선택지 (고지 → 안내 → 링크)",
    layout: "row",
    stores: {
      placement: "pending",
      intro: "주문하신 곳에서도 배송 안내를 볼 수 있어요",
      disclosure: disclosures.coupang,
      links: [storeLink("naver", "pending", "secondary"), storeLink("coupang", "pending", "secondary")]
    }
  },
  { demo: "affiliate-delivered", caption: "배송 완료 · 스토어 선두", layout: "row", stores: DELIVERED_STORES },
  {
    demo: "affiliate-missing-disclosure",
    caption: "고지 문구가 빠진 뷰라도 제휴 링크가 있으면 고지를 붙여요",
    layout: "stack",
    stores: { placement: "showcase", intro: null, disclosure: null, links: [storeLink("coupang", "showcase", "secondary")] }
  },
  {
    demo: "affiliate-naver-only",
    caption: "제휴 링크가 없으면 고지도 없어요",
    layout: "stack",
    stores: { placement: "showcase", intro: null, disclosure: disclosures.coupang, links: [storeLink("naver", "showcase", "secondary")] }
  },
  {
    demo: "affiliate-empty",
    caption: "링크가 0개면 묶음을 그리지 않아요",
    layout: "row",
    stores: { placement: "pending", intro: null, disclosure: null, links: [] }
  }
];

function LinkSection(): React.JSX.Element {
  const talk = channels.talk;
  return (
    <Section id="links" title="톡톡 링크 · 스토어 링크 묶음">
      <p className="m-0 text-tt-sm text-tt-muted">
        톡톡은 한 가지 모양을 세 무게로 써요. 스토어 묶음은 제휴 링크가 있을 때 고지를 첫 줄에 붙여요.
      </p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 bg-tt-surface p-4">
        <span data-demo="talk-header">
          <TalkLink href={talk.url} label={talk.labels.header} weight="text" placement="header" />
        </span>
        <span data-demo="talk-state">
          <TalkLink href={talk.url} label={talk.labels.cta} weight="text" placement="state" />
        </span>
        <span data-demo="talk-secondary">
          <TalkLink href={talk.url} label={talk.labels.cta} weight="secondary" placement="state" />
        </span>
        <span data-demo="talk-primary">
          <TalkLink href={talk.url} label={talk.labels.cta} weight="primary" placement="state" />
        </span>
        <span data-demo="talk-footer">
          <TalkLink href={talk.url} label={talk.labels.footer} weight="text" placement="footer" />
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {STORE_DEMOS.map((item) => (
          <div key={item.demo} className="flex min-w-0 flex-col gap-2 bg-tt-surface p-4">
            <p className="m-0 text-tt-xs font-bold text-tt-muted">{item.caption}</p>
            <div data-demo={item.demo}>
              <AffiliateLinkGroup stores={item.stores} layout={item.layout} />
            </div>
          </div>
        ))}
      </div>
      <Field tone="attention" demo="field-links">
        <TalkLink href={talk.url} label="9월 29일(화)까지 그대로면 알려 주세요" weight="text" placement="state" />
        <AffiliateLinkGroup stores={DELIVERED_STORES} layout="row" />
        <p className="m-0 text-tt-xs text-tt-muted">색면 안에서는 보조 글자도 색면 글자색으로 바뀌어요.</p>
      </Field>
    </Section>
  );
}

const HOME_NOTICE: NoticeView = {
  id: "demo-chuseok-home",
  kind: "holiday",
  title: "추석 연휴 안내",
  body: "추석 연휴(9/24~26)와 주말에는 통관·택배가 쉬어요. 9월 28일(월)부터 순서대로 진행돼요."
};

const INLINE_NOTICES: ReadonlyArray<{ readonly tone: Tone; readonly notice: NoticeView }> = [
  {
    tone: "attention",
    notice: { id: "demo-outage", kind: "outage", title: "통관 조회 점검", body: "UNI-PASS 점검(22:00~24:00) 중에는 통관 정보가 늦게 보일 수 있어요" }
  },
  { tone: "progress", notice: { id: "demo-delay", kind: "delay", title: "배송 지연", body: "택배 물량이 많아 배송이 하루 늦어질 수 있어요" } },
  { tone: "progress", notice: { id: "demo-holiday", kind: "holiday", title: "추석 연휴", body: "추석 연휴로 통관이 9월 28일(월)부터 이어져요." } },
  { tone: "waiting", notice: { id: "demo-info", kind: "info", title: "화면 안내", body: "조회 화면이 새로 바뀌었어요" } }
];

function NoticeSection(): React.JSX.Element {
  return (
    <Section id="notices" title="공지 줄">
      <p className="m-0 text-tt-sm text-tt-muted">공지는 화면당 하나예요. 화면을 열 때 읽어 주는 알림으로 만들지 않아요.</p>
      <div data-demo="notice-banner" className="-mx-4 sm:mx-0">
        <NoticeBanner notice={HOME_NOTICE} variant="banner" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {INLINE_NOTICES.map((item) => (
          <Field key={item.notice.id} tone={item.tone} demo={`notice-inline-${item.notice.kind}`}>
            <NoticeBanner notice={item.notice} variant="inline" />
          </Field>
        ))}
      </div>
    </Section>
  );
}

const DEMO_NOW = new Date("2026-09-26T14:05:00+09:00");
const DEMO_NUMBER = "000012345678";

function CopySection(): React.JSX.Element {
  // '[배송 문의] 조회번호 0000 1234 5678 / 조회 화면 오류 / 9월 26일 14:05' (S03's inquiry copy)
  const inquiryText = buildInquiryCopy({ kind: "screenError", number: numberView(DEMO_NUMBER), now: DEMO_NOW });
  return (
    <Section id="copy" title="복사 버튼">
      <p className="m-0 text-tt-sm text-tt-muted">
        클립보드가 막힌 인앱 브라우저에서는 내용을 고른 상태의 읽기 전용 글상자를 보여 줘요. 문의 복사 버튼은 같은 클릭에서 톡톡을 새 창으로 열어요.
      </p>
      <UiKitInteractive
        returnLink={buildReturnLink(DEMO_NUMBER, "AUTO")}
        inquiryText={inquiryText}
        talkUrl={channels.talk.url}
        talkLabel={channels.talk.labels.copyAndTalk}
      />
    </Section>
  );
}

/** A fake ad unit id (0000 series): /internal never loads ads, so the gallery shows only the reserved box. */
const DEMO_AD_SLOT_ID = "0000000000";

function AdSlotSection(): React.JSX.Element {
  return (
    <Section id="ad-slot" title="수동 광고 자리">
      <div data-demo="manual-ad-slot" className="border-2 border-dashed border-tt-rule">
        <ManualAdSlot allowed slotId={DEMO_AD_SLOT_ID} />
      </div>
    </Section>
  );
}
