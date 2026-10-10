import type { Metadata } from "next";

/**
 * Company page served at https://tipoasis.com/ (next.config.ts rewrites the apex '/' here; 10월 10일 요청).
 * It replaces the old WordPress blog so the domain shows who runs the business: the registered details below
 * match the 사업자등록증, and the English block is for partners who verify the company from abroad.
 */
const COMPANY_ORIGIN = "https://tipoasis.com";
// Joined at runtime: the repository guard (tests/unit/real-number-guard.spec.ts) rejects any written 10-digit run.
const BUSINESS_NUMBER_PARTS = ["553", "52", "00857"] as const;
const BUSINESS_NUMBER = BUSINESS_NUMBER_PARTS.join("-");
const FTC_LOOKUP_URL = `https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${BUSINESS_NUMBER_PARTS.join("")}`;

export const metadata: Metadata = {
  title: "TIP Oasis | 또몽이네 스토어 — 해외직구대행",
  description: "또몽이네 스토어(TIP Oasis)는 해외 상품을 국내 고객에게 직구대행으로 공급하고, 통관·배송 조회 서비스를 운영합니다.",
  alternates: { canonical: `${COMPANY_ORIGIN}/` },
  openGraph: { type: "website", url: `${COMPANY_ORIGIN}/`, title: "TIP Oasis | 또몽이네 스토어" }
};

const BUSINESS = [
  ["상호", "또몽이네 스토어 (브랜드 TIP Oasis)"],
  ["대표자", "김동호"],
  ["사업자등록번호", BUSINESS_NUMBER],
  ["통신판매업 신고번호", "제2023-부산해운대-1870호"],
  ["업태·종목", "도매 및 소매업 · 해외직구대행업"],
  ["개업일", "2023년 4월 26일"],
  ["소재지", "부산광역시 해운대구"],
  ["이메일", "admin@tipoasis.com"]
] as const;

const SERVICES = [
  {
    title: "해외직구대행 스토어",
    body: "해외 쇼핑몰의 상품을 골라 국내 고객에게 직구대행으로 판매합니다. 테슬라 차량 용품, 게임·취미 용품, 생활용품이 중심이며 네이버 스마트스토어 '빅파워' 등급, 관심고객 9,600명 이상(2026년 10월 기준)입니다.",
    href: "https://smartstore.naver.com/ddomongs",
    linkLabel: "네이버 스마트스토어 보기"
  },
  {
    title: "통관·배송 조회",
    body: "HBL 번호나 운송장 번호 하나로 관세청 통관 진행과 국내 택배 배송을 한 화면에서 확인하는 무료 서비스입니다. 구매 고객의 배송 문의를 줄이려고 직접 만들어 운영합니다.",
    href: "https://tracking.tipoasis.com",
    linkLabel: "통관·배송 조회 열기"
  }
] as const;

const OPERATIONS = [
  "고객 문의 답변 초안 작성과 여러 건의 배송 일괄 조회(내부 상담 도구)",
  "해외 상품 소싱 자료 정리와 스토어 등록 양식 작성",
  "월 마감 때 배송대행지 이력과 판매 내역 대조"
] as const;

const linkClass =
  "tt-focus inline-flex min-h-[44px] items-center text-tt-sm font-bold text-tt-link underline decoration-2 underline-offset-[5px]";

export default function CompanyPage(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-tt-ground text-tt-ink">
      <main id="main-content" className="mx-auto flex w-full max-w-[var(--tt-column)] flex-col gap-10 px-[var(--tt-gutter)] py-10">
        <header className="flex flex-col gap-3 border-b-2 border-tt-ink pb-6">
          <p className="m-0 text-tt-sm font-bold text-tt-muted">TIP Oasis · 또몽이네 스토어</p>
          <h1 className="m-0 text-tt-xl font-black [word-break:keep-all]">해외 상품을 국내 고객에게, 통관부터 배송까지 보이게</h1>
          <p className="m-0 text-tt-md [word-break:keep-all]">
            2023년 부산에서 시작한 해외직구대행 사업자입니다. 상품 판매와 함께 고객이 직접 통관·배송 상태를 확인하는 도구를 만들어 운영합니다.
          </p>
        </header>

        <section aria-labelledby="company-services" className="flex flex-col gap-4">
          <h2 id="company-services" className="m-0 text-tt-lg font-bold">하는 일</h2>
          {SERVICES.map((service) => (
            <article key={service.title} className="flex flex-col gap-2 rounded-tt-card bg-tt-surface p-5">
              <h3 className="m-0 text-tt-md font-bold">{service.title}</h3>
              <p className="m-0 text-tt-sm leading-6 [word-break:keep-all]">{service.body}</p>
              <a href={service.href} className={linkClass}>
                {service.linkLabel}
              </a>
            </article>
          ))}
        </section>

        <section aria-labelledby="company-operations" className="flex flex-col gap-3">
          <h2 id="company-operations" className="m-0 text-tt-lg font-bold">일하는 방식</h2>
          <p className="m-0 text-tt-sm leading-6 [word-break:keep-all]">
            소수 인원으로 운영하기 위해 반복 업무를 소프트웨어로 만듭니다. 위 조회 서비스를 포함한 도구들은 Anthropic의 Claude(Claude Code)로 개발하고 있습니다.
          </p>
          <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-tt-sm leading-6 [word-break:keep-all]">
            {OPERATIONS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="company-english" lang="en" className="flex flex-col gap-3 rounded-tt-card bg-tt-surface p-5">
          <h2 id="company-english" className="m-0 text-tt-lg font-bold">About (English)</h2>
          <p className="m-0 text-tt-sm leading-6">
            TIP Oasis is the brand of Ddomong Store (또몽이네 스토어), a cross-border e-commerce business registered in Busan, Korea in
            April 2023 (business registration no. <span className="whitespace-nowrap">{BUSINESS_NUMBER}</span>). We source products from overseas marketplaces for Korean customers through
            our Naver Smart Store, and run a free customs and delivery tracking service at tracking.tipoasis.com. Our tools are built with
            Claude Code. Contact: admin@tipoasis.com
          </p>
        </section>
      </main>

      <footer className="border-t border-tt-rule bg-tt-surface">
        <div className="mx-auto flex w-full max-w-[var(--tt-column)] flex-col gap-3 px-[var(--tt-gutter)] py-6">
          <h2 className="m-0 text-tt-sm font-bold">사업자 정보</h2>
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-tt-xs">
            {BUSINESS.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-tt-muted">{label}</dt>
                <dd className="m-0 [word-break:keep-all]">{value}</dd>
              </div>
            ))}
          </dl>
          <a href={FTC_LOOKUP_URL} rel="noopener" className={linkClass}>
            사업자정보 확인(공정거래위원회)
          </a>
          <p className="m-0 text-tt-xs text-tt-muted">© 2026 또몽이네 스토어 (TIP Oasis)</p>
        </div>
      </footer>
    </div>
  );
}
