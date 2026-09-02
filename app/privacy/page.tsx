import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TALK_URL } from "@/lib/storefront";

export const metadata: Metadata = {
  title: "개인정보처리방침 | 통관·국내 배송 조회",
  description: "tracking.tipoasis.com 배송 조회 서비스의 개인정보 처리 원칙을 안내합니다.",
  alternates: { canonical: "/privacy" }
};

const LAST_UPDATED = "2026년 9월 3일";

const sections = [
  {
    title: "1. 수집하는 정보",
    body: [
      "이 서비스는 회원가입이나 로그인 없이 이용할 수 있으며, 이름·연락처·주소 등 개인정보를 입력받지 않습니다.",
      "조회를 위해 입력한 HBL 번호, 화물관리번호 또는 국내 운송장 번호는 조회 시점에 관세청 UNI-PASS와 택배사 조회 서비스에 전달되는 목적으로만 사용됩니다.",
      "입력한 번호와 조회 결과는 서버 데이터베이스에 저장하지 않습니다. 동일 번호의 반복 조회 부담을 줄이기 위해 조회 결과를 서버 메모리에 최대 15분간 임시 보관한 뒤 자동 삭제합니다."
    ]
  },
  {
    title: "2. 자동으로 기록되는 정보",
    body: [
      "서비스 호스팅 사업자(Vercel)는 서비스 안정 운영을 위해 접속 IP, 접속 시각, 브라우저 종류 등 접속 로그를 일정 기간 보관할 수 있습니다.",
      "과도한 요청을 막기 위해 접속 IP 기준 요청 횟수를 서버 메모리에서 짧게 계산하며, 이 정보는 별도로 저장하거나 식별에 사용하지 않습니다."
    ]
  },
  {
    title: "3. 광고 및 쿠키",
    body: [
      "이 서비스는 Google AdSense 광고를 게재합니다. Google 및 광고 파트너는 쿠키를 사용해 이용자의 이 사이트 또는 다른 사이트 방문 기록을 바탕으로 광고를 표시할 수 있습니다.",
      "맞춤 광고 쿠키 사용은 Google 광고 설정(https://www.google.com/settings/ads)에서 거부할 수 있습니다.",
      "이 서비스 자체는 이용자를 식별하기 위한 쿠키를 별도로 발행하지 않습니다."
    ]
  },
  {
    title: "4. 외부 링크",
    body: [
      "페이지 안의 네이버 스토어, 쿠팡 스토어, 네이버 톡톡 링크는 각 사업자가 운영하는 외부 서비스로 이동합니다. 이동한 뒤의 개인정보 처리는 해당 서비스의 방침을 따릅니다.",
      "쿠팡 링크는 쿠팡 파트너스 제휴 링크이며, 이를 통해 구매하면 운영자가 일정 수수료를 받을 수 있습니다. 구매 가격에는 영향이 없습니다."
    ]
  },
  {
    title: "5. 이용자의 권리",
    body: [
      "이 서비스는 개인정보를 저장하지 않으므로 열람·정정·삭제 요청 대상 정보가 없습니다.",
      "개인정보 처리에 관한 문의는 아래 문의 채널로 보내 주시면 확인 후 답변드립니다."
    ]
  },
  {
    title: "6. 방침 변경",
    body: ["이 방침이 바뀌면 이 페이지에 변경 내용과 시행일을 표시합니다."]
  }
] as const;

export default function PrivacyPolicyPage() {
  return (
    <main id="main-content" className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/80"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        배송 조회로 돌아가기
      </Link>

      <article className="brand-panel mt-6 p-5 sm:p-8">
        <p className="section-kicker">개인정보처리방침</p>
        <h1 className="section-title mt-3 text-2xl sm:text-3xl">tracking.tipoasis.com 개인정보처리방침</h1>
        <p className="mt-3 text-sm text-slate-400">시행일: {LAST_UPDATED}</p>
        <p className="section-copy mt-5 text-sm sm:text-base">
          이 서비스는 구매 고객이 통관과 국내 배송 상태를 조회할 수 있도록 운영자가 제공하는 무료 조회 도구입니다.
          개인정보 최소 수집 원칙에 따라 조회에 필요한 번호 외에는 어떤 정보도 요구하지 않습니다.
        </p>

        <div className="mt-8 space-y-8">
          {sections.map((section) => (
            <section key={section.title} aria-labelledby={section.title}>
              <h2 id={section.title} className="text-lg font-semibold text-slate-100">
                {section.title}
              </h2>
              <div className="mt-3 space-y-3">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="break-keep text-sm leading-6 text-slate-300">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}

          <section aria-labelledby="privacy-contact">
            <h2 id="privacy-contact" className="text-lg font-semibold text-slate-100">
              7. 문의 채널
            </h2>
            <p className="mt-3 break-keep text-sm leading-6 text-slate-300">
              개인정보 관련 문의는 네이버 톡톡으로 남겨 주세요.
            </p>
            <a
              href={TALK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-300/35 bg-emerald-300/10 px-4 text-sm font-semibold text-emerald-100 transition-colors hover:bg-emerald-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200/80"
            >
              톡톡으로 문의하기
            </a>
          </section>
        </div>
      </article>
    </main>
  );
}
