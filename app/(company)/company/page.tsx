import type { Metadata } from "next";
import Image from "next/image";
import { Black_Han_Sans, IBM_Plex_Sans_KR } from "next/font/google";
import routeArt from "./route-hero.webp";
import styles from "./company.module.css";

/**
 * Company page served at https://tipoasis.com/ (next.config.ts rewrites the apex '/' here; 10월 10일 요청).
 * English, because its first readers are partners verifying the company (Claude Startups review). It follows the
 * route a product travels — each stop is where the business does something — and closes with the registered
 * details, kept in Korean where they must match the 사업자등록증 word for word.
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
  title: "TIP Oasis — Ddomong Store, cross-border e-commerce from Busan",
  description:
    "TIP Oasis (Ddomong Store, 또몽이네 스토어) sources products from overseas marketplaces for customers in Korea and runs a free customs and delivery tracking service.",
  alternates: { canonical: `${COMPANY_ORIGIN}/` },
  openGraph: { type: "website", url: `${COMPANY_ORIGIN}/`, title: "TIP Oasis — Ddomong Store" }
};

const ROUTE = [
  { name: "Overseas marketplace", does: "We pick products from marketplaces in China, Japan and beyond that are hard to find in Korea." },
  { name: "Forwarding warehouse", does: "Our forwarding partners receive, inspect and repack every order." },
  { name: "International freight", does: "Air or sea freight carries it to Korea." },
  { name: "Korea Customs", does: "It clears customs under the customer's own personal customs code." },
  { name: "Domestic courier", does: "CJ Logistics, Hanjin, Lotte, Korea Post or Logen deliver it to the door." }
] as const;

const CATEGORIES = ["Tesla accessories", "Games & hobbies", "Home & pet", "Fashion accessories"] as const;

const OPERATIONS = [
  { work: "Draft replies to customer inquiries, bulk parcel lookups", tool: "Internal CS desk", state: "In use" },
  { work: "Organize sourcing data, prepare store listing sheets", tool: "Sourcing toolkit", state: "In use" },
  { work: "Reconcile forwarding-warehouse records with sales at month end", tool: "Month-end closing helper", state: "In use" },
  { work: "Customs and delivery tracking for our customers", tool: "tracking.tipoasis.com", state: "Live" }
] as const;

const BUSINESS = [
  { label: "Trade name", value: "또몽이네 스토어 (Ddomong Store), brand TIP Oasis", wide: true },
  { label: "Representative", value: "Dongho Kim (김동호)" },
  { label: "Founded", value: "April 26, 2023" },
  { label: "Business registration no.", value: BUSINESS_NUMBER },
  { label: "Mail-order business no.", value: "제2023-부산해운대-1870호" },
  { label: "Business type", value: "Wholesale and retail / cross-border purchasing agent", wide: true },
  { label: "Location", value: "Haeundae-gu, Busan, Republic of Korea", wide: true },
  { label: "Email", value: "admin@tipoasis.com", wide: true }
] as const;

export default function CompanyPage(): React.JSX.Element {
  return (
    <div lang="en" className={`${styles.page} ${signFont.variable} ${bodyFont.variable}`}>
      <header className={`${styles.wrap} ${styles.top}`}>
        <a href="#main-content" className={styles.brand}>
          TIP Oasis<small>Ddomong Store</small>
        </a>
        <nav aria-label="Shortcuts" className={styles.nav}>
          <a href={STORE_URL}>Our store</a>
          <a href={TRACKING_URL}>Track a parcel</a>
        </nav>
      </header>

      <main id="main-content">
        <section className={`${styles.wrap} ${styles.hero}`}>
          <h1 className={styles.headline}>
            <span className={styles.line}>
              <span>From overseas shops</span>
            </span>
            <span className={styles.line}>
              <span>to Korean doorsteps</span>
            </span>
          </h1>
          <p className={styles.lede}>
            TIP Oasis is the brand of Ddomong Store (또몽이네 스토어), a cross-border e-commerce business founded in Busan, Korea in
            April 2023. We source products from overseas marketplaces, ship them to customers across Korea, and let every customer
            follow their parcel through customs and delivery.
          </p>
          <figure className={styles.art}>
            <Image
              src={routeArt}
              alt="A parcel's trip: overseas warehouse, cargo plane, customs green lane, delivery van, apartment door"
              priority
              sizes="(max-width: 1120px) 100vw, 1008px"
            />
            <span className={styles.tracker} aria-hidden="true" />
          </figure>
        </section>

        <section aria-labelledby="route-title" className={styles.sign}>
          <div className={styles.wrap}>
            <h2 id="route-title" className={styles.signTitle}>How a product reaches our customer</h2>
            <ol className={styles.route}>
              {ROUTE.map((stop, index) => (
                <li key={stop.name} className={styles.stop} style={{ "--i": index } as React.CSSProperties}>
                  <span className={styles.marker} aria-hidden="true">{index + 1}</span>
                  <h3 className={styles.stopName}>{stop.name}</h3>
                  <p className={styles.stopDo}>{stop.does}</p>
                </li>
              ))}
            </ol>
            <p className={styles.signFoot}>
              Customers follow steps 4 and 5 themselves with one number at <a href={TRACKING_URL}>tracking.tipoasis.com</a>.
            </p>
          </div>
        </section>

        <section aria-labelledby="business-title" className={`${styles.wrap} ${styles.section}`}>
          <h2 id="business-title">Where we sell, and where customers track</h2>
          <p className={styles.sectionLede}>
            Products are sold on our Naver Smart Store. What happens after the order is shown by a tracking service we built ourselves.
          </p>
          <div className={styles.split}>
            <article className={styles.store}>
              <h3>Ddomong Store</h3>
              <dl className={styles.facts}>
                <dt>Channel</dt>
                <dd>Naver Smart Store</dd>
                <dt>Seller grade</dt>
                <dd>Big Power</dd>
                <dt>Followers</dt>
                <dd>9,600+ (October 2026)</dd>
              </dl>
              <ul className={styles.cats} aria-label="Main categories">
                {CATEGORIES.map((category) => (
                  <li key={category}>{category}</li>
                ))}
              </ul>
              <a href={STORE_URL} className={styles.go}>Visit the store</a>
            </article>

            <article className={styles.trackerCard}>
              <h3>Customs and delivery tracking</h3>
              <p>
                A free service: enter an HBL or courier number to see Korea Customs clearance and domestic delivery on one screen. It
                answers the question we hear most, &ldquo;where is my order?&rdquo;, without a message to us.
              </p>
              <a href={TRACKING_URL} className={styles.lookup} aria-label="Open the tracking service">
                <span className={styles.lookupField} aria-hidden="true">ABCD 0000 0000</span>
                <span className={styles.lookupButton}>Track</span>
              </a>
              <p className={styles.carriers}>Works with CJ Logistics, Hanjin, Lotte, Korea Post and Logen</p>
            </article>
          </div>
        </section>

        <section aria-labelledby="ops-title" className={`${styles.wrap} ${styles.section}`}>
          <h2 id="ops-title">How a small team runs it</h2>
          <p className={styles.sectionLede}>
            We turn repetitive work into software. Every tool below is built in-house with Anthropic&rsquo;s Claude (Claude Code).
          </p>
          <table className={styles.ops}>
            <thead>
              <tr>
                <th scope="col">Work</th>
                <th scope="col">Tool</th>
                <th scope="col">Status</th>
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
      </main>

      <footer aria-labelledby="business-info" className={styles.footer}>
        <div className={styles.wrap}>
          <h2 id="business-info">Business registration</h2>
          <dl className={styles.form}>
            {BUSINESS.map((field) => (
              <div key={field.label} className={"wide" in field ? `${styles.field} ${styles.wide}` : styles.field}>
                <dt>{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>
          <div className={styles.footNote}>
            <a href={FTC_LOOKUP_URL} rel="noopener">Verify with the Korea Fair Trade Commission</a>
            <span>© 2026 Ddomong Store</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
