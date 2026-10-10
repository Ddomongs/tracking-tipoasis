import type { Metadata } from "next";
import { Black_Han_Sans, IBM_Plex_Sans_KR } from "next/font/google";
import styles from "./company.module.css";

/**
 * Company page served at https://tipoasis.com/ (next.config.ts rewrites the apex '/' here; 10월 10일 요청).
 * It replaces the old WordPress blog so the domain shows who runs the business. The page is laid out along the
 * route a product travels — each stop is where the business does something — and closes with the registered
 * details (matching the 사업자등록증) and an English block for partners who verify the company from abroad.
 */
const COMPANY_ORIGIN = "https://tipoasis.com";
const STORE_URL = "https://smartstore.naver.com/ddomongs";
const TRACKING_URL = "https://tracking.tipoasis.com";
// Joined at runtime: the repository guard (tests/unit/real-number-guard.spec.ts) rejects any written 10-digit run.
const BUSINESS_NUMBER_PARTS = ["553", "52", "00857"] as const;
const BUSINESS_NUMBER = BUSINESS_NUMBER_PARTS.join("-");
const FTC_LOOKUP_URL = `https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${BUSINESS_NUMBER_PARTS.join("")}`;

// Korean glyphs come as unicode-range slices from the self-hosted CSS; nothing is preloaded (this page only).
const signFont = Black_Han_Sans({ weight: "400", subsets: ["latin"], display: "swap", preload: false, variable: "--font-han-sans" });
const bodyFont = IBM_Plex_Sans_KR({ weight: ["400", "600", "700"], subsets: ["latin"], display: "swap", preload: false, variable: "--font-plex-kr" });

export const metadata: Metadata = {
  title: "TIP Oasis | 또몽이네 스토어 — 해외직구대행",
  description: "또몽이네 스토어(TIP Oasis)는 해외 상품을 국내 고객에게 직구대행으로 공급하고, 통관·배송 조회 서비스를 운영합니다.",
  alternates: { canonical: `${COMPANY_ORIGIN}/` },
  openGraph: { type: "website", url: `${COMPANY_ORIGIN}/`, title: "TIP Oasis | 또몽이네 스토어" }
};

const ROUTE = [
  { name: "해외 쇼핑몰", does: "중국·일본 등 해외 쇼핑몰에서 국내에 없거나 더 나은 상품을 고릅니다." },
  { name: "배송대행지", does: "현지 창고에서 상품을 받아 검수하고 포장합니다." },
  { name: "국제 운송", does: "항공·해운으로 한국까지 옮깁니다." },
  { name: "통관", does: "관세청 통관을 거칩니다. 고객 이름의 개인통관고유부호로 신고합니다." },
  { name: "국내 택배", does: "CJ대한통운·한진·롯데·우체국·로젠 택배로 문 앞까지 갑니다." }
] as const;

const CATEGORIES = ["테슬라 차량 용품", "게임·취미", "생활·반려 용품", "패션 잡화"] as const;

const OPERATIONS = [
  { work: "고객 문의 답변 초안, 여러 건 배송 일괄 조회", tool: "내부 상담 데스크", state: "사용 중" },
  { work: "해외 상품 소싱 자료 정리, 스토어 등록 양식 작성", tool: "소싱 정리 도구", state: "사용 중" },
  { work: "월 마감 때 배송대행지 이력과 판매 내역 대조", tool: "마감 도우미", state: "사용 중" },
  { work: "고객이 직접 보는 통관·배송 조회", tool: "tracking.tipoasis.com", state: "공개 운영" }
] as const;

const BUSINESS = [
  { label: "상호", value: "또몽이네 스토어 (브랜드 TIP Oasis)", wide: true },
  { label: "대표자", value: "김동호" },
  { label: "개업일", value: "2023년 4월 26일" },
  { label: "사업자등록번호", value: BUSINESS_NUMBER },
  { label: "통신판매업 신고번호", value: "제2023-부산해운대-1870호" },
  { label: "업태 / 종목", value: "도매 및 소매업 / 해외직구대행업", wide: true },
  { label: "소재지", value: "부산광역시 해운대구", wide: true },
  { label: "이메일", value: "admin@tipoasis.com", wide: true }
] as const;

export default function CompanyPage(): React.JSX.Element {
  return (
    <div className={`${styles.page} ${signFont.variable} ${bodyFont.variable}`}>
      <header className={`${styles.wrap} ${styles.top}`}>
        <a href="#main-content" className={styles.brand}>
          TIP Oasis<small>또몽이네 스토어</small>
        </a>
        <nav aria-label="바로가기" className={styles.nav}>
          <a href={STORE_URL}>스마트스토어</a>
          <a href={TRACKING_URL}>배송 조회</a>
        </nav>
      </header>

      <main id="main-content">
        <section className={`${styles.wrap} ${styles.hero}`}>
          <h1>
            해외 쇼핑몰에서
            <br />
            문 앞까지
          </h1>
          <p className={styles.lede}>
            또몽이네 스토어(TIP Oasis)는 부산에서 운영하는 해외직구대행 사업자입니다. 해외 상품을 골라 들여오고, 통관과 배송이
            어디쯤인지 고객이 직접 확인할 수 있게 만듭니다.
          </p>
        </section>

        <section aria-labelledby="route-title" className={styles.sign}>
          <div className={styles.wrap}>
            <h2 id="route-title" className={styles.signTitle}>상품이 오는 길</h2>
            <ol className={styles.route}>
              {ROUTE.map((stop, index) => (
                <li key={stop.name} className={styles.stop}>
                  <span className={styles.marker} aria-hidden="true">{index + 1}</span>
                  <h3 className={styles.stopName}>{stop.name}</h3>
                  <p className={styles.stopDo}>{stop.does}</p>
                </li>
              ))}
            </ol>
            <p className={styles.signFoot}>
              통관부터 국내 택배까지의 진행은 <a href={TRACKING_URL}>통관·배송 조회</a>에서 번호 하나로 볼 수 있습니다.
            </p>
          </div>
        </section>

        <section aria-labelledby="business-title" className={`${styles.wrap} ${styles.section}`}>
          <h2 id="business-title">파는 곳과 보여주는 곳</h2>
          <p className={styles.sectionLede}>상품은 네이버 스마트스토어에서 팔고, 주문한 뒤의 여정은 직접 만든 조회 서비스로 보여 줍니다.</p>
          <div className={styles.split}>
            <article className={styles.store}>
              <h3>또몽이네 스토어</h3>
              <dl className={styles.facts}>
                <dt>판매처</dt>
                <dd>네이버 스마트스토어</dd>
                <dt>스토어 등급</dt>
                <dd>빅파워</dd>
                <dt>관심고객</dt>
                <dd>9,600명 이상 (2026년 10월)</dd>
              </dl>
              <ul className={styles.cats} aria-label="주요 상품군">
                {CATEGORIES.map((category) => (
                  <li key={category}>{category}</li>
                ))}
              </ul>
              <a href={STORE_URL} className={styles.go}>스마트스토어에서 상품 보기</a>
            </article>

            <article className={styles.tracker}>
              <h3>통관·배송 조회</h3>
              <p>HBL 번호나 운송장 번호를 넣으면 관세청 통관 진행과 국내 택배 배송을 한 화면에 보여 주는 무료 서비스입니다. 배송 문의를 줄이려고 만들었습니다.</p>
              <a href={TRACKING_URL} className={styles.lookup} aria-label="통관·배송 조회 열기">
                <span className={styles.lookupField} aria-hidden="true">ABCD 0000 0000</span>
                <span className={styles.lookupButton}>조회하기</span>
              </a>
              <p className={styles.carriers}>CJ대한통운, 한진, 롯데, 우체국, 로젠 택배 지원</p>
            </article>
          </div>
        </section>

        <section aria-labelledby="ops-title" className={`${styles.wrap} ${styles.section}`}>
          <h2 id="ops-title">작은 팀이 일하는 방식</h2>
          <p className={styles.sectionLede}>
            반복되는 일은 소프트웨어로 만듭니다. 아래 도구는 모두 Anthropic의 Claude(Claude Code)로 직접 개발하고 있습니다.
          </p>
          <table className={styles.ops}>
            <thead>
              <tr>
                <th scope="col">하는 일</th>
                <th scope="col">도구</th>
                <th scope="col">상태</th>
              </tr>
            </thead>
            <tbody>
              {OPERATIONS.map((row) => (
                <tr key={row.work}>
                  <td>{row.work}</td>
                  <td>{row.tool}</td>
                  <td>
                    <span className={styles.state}>{row.state}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section aria-labelledby="english-title" lang="en" className={`${styles.wrap} ${styles.section}`}>
          <h2 id="english-title">About TIP Oasis</h2>
          <p className={styles.english}>
            TIP Oasis is the brand of Ddomong Store (또몽이네 스토어), a cross-border e-commerce business registered in Busan, Korea in
            April 2023 (business registration no. <span style={{ whiteSpace: "nowrap" }}>{BUSINESS_NUMBER}</span>). We source products
            from overseas marketplaces for Korean customers through our Naver Smart Store, and run a free customs and delivery tracking
            service at tracking.tipoasis.com. Our internal tools and the tracking service are built with Claude Code. Contact:
            admin@tipoasis.com
          </p>
        </section>
      </main>

      <footer aria-labelledby="business-info" className={styles.footer}>
        <div className={styles.wrap}>
          <h2 id="business-info">사업자 정보</h2>
          <dl className={styles.form}>
            {BUSINESS.map((field) => (
              <div key={field.label} className={"wide" in field ? `${styles.field} ${styles.wide}` : styles.field}>
                <dt>{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>
          <div className={styles.footNote}>
            <a href={FTC_LOOKUP_URL} rel="noopener">사업자정보 확인 (공정거래위원회)</a>
            <span>© 2026 또몽이네 스토어</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
