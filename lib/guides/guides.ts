/**
 * Static guides for people who arrive from a search engine (10월 2일 요청 ②). Plain facts in customer words, hedged where
 * rules depend on the item or change over time, and always pointing to the official Korea Customs Service pages.
 * Never a real tracking number here: the repository guard rejects 10+ digit runs.
 */

export interface GuideSection {
  readonly heading: string;
  readonly paragraphs: readonly string[];
  readonly items: readonly string[];
}

export interface GuideFaqEntry {
  readonly question: string;
  readonly answer: string;
}

export interface GuideSource {
  readonly label: string;
  readonly url: string;
}

export interface Guide {
  readonly slug: string;
  readonly title: string;
  /** Meta description and the line under the title (40–120 characters). */
  readonly summary: string;
  readonly sections: readonly GuideSection[];
  readonly faq: readonly GuideFaqEntry[];
  readonly sources: readonly GuideSource[];
}

/** Shown on every guide; bump when the text changes. */
export const GUIDES_UPDATED = "2026년 10월 2일";

const UNIPASS: GuideSource = { label: "관세청 UNI-PASS 화물진행정보 조회", url: "https://unipass.customs.go.kr/" };
const CUSTOMS: GuideSource = { label: "관세청 누리집", url: "https://www.customs.go.kr/" };

export const GUIDES: readonly Guide[] = [
  {
    slug: "customs-steps",
    title: "통관 진행 단계 한눈에 보기",
    summary: "해외에서 보낸 물건이 한국에 도착해 택배로 넘어오기까지 거치는 통관 단계를 순서대로 쉽게 풀어 드려요.",
    sections: [
      {
        heading: "한눈에 보는 순서",
        paragraphs: ["해외 배송 물건은 대체로 아래 순서로 진행돼요. 화물 종류나 운송 방식에 따라 일부 단계가 빠지거나 순서가 바뀔 수 있어요."],
        items: [
          "입항: 비행기나 배가 한국 공항·항구에 도착해요.",
          "하기·하선: 화물을 비행기나 배에서 내려요.",
          "반입신고 (보세창고 도착): 세관이 관리하는 보세창고에 물건이 들어가요.",
          "통관목록 접수·심사 또는 수입신고: 세관이 물건 정보를 확인해요.",
          "수입신고수리 또는 통관목록 심사 완료 (통관 완료): 세관 확인이 끝났다는 뜻이에요.",
          "반출신고 (보세창고 출고): 창고에서 나와 국내 택배사로 넘어가요.",
          "국내 배송: 택배사 집화부터 배송 완료까지 진행돼요."
        ]
      },
      {
        heading: "목록통관과 일반 수입신고",
        paragraphs: [
          "개인이 쓰려고 산 소액 물건은 간단한 목록만으로 통관하는 경우가 많아요. 이때 조회 화면에는 '통관목록 접수', '통관목록 심사 완료' 같은 말이 보여요.",
          "금액이 크거나 식품·의약품처럼 확인이 더 필요한 물건은 '수입신고' 절차를 거쳐요. 이 경우 서류 확인이나 세금 계산 때문에 조금 더 걸릴 수 있어요."
        ],
        items: []
      },
      {
        heading: "보통 얼마나 걸리나요",
        paragraphs: [
          "보세창고에 도착한 뒤 통관 완료까지는 보통 하루에서 이틀 정도 걸려요. 주말·공휴일이 끼거나 물량이 몰리는 시기, 세관 검사 대상이 되면 더 걸릴 수 있어요.",
          "통관이 끝나면 보세창고에서 나와 택배사로 넘어가고, 택배사 조회에 기록이 뜨기까지 다시 하루 정도 걸리기도 해요."
        ],
        items: []
      }
    ],
    faq: [],
    sources: [UNIPASS, CUSTOMS]
  },
  {
    slug: "customs-delays",
    title: "통관이 늦어지는 이유",
    summary: "통관이 며칠째 멈춰 있을 때 흔히 있는 이유와, 받는 사람이 확인하거나 준비하면 좋은 것을 정리했어요.",
    sections: [
      {
        heading: "자주 있는 이유",
        paragraphs: ["아래 이유가 겹치면 같은 날 들어온 물건이라도 통관 속도가 달라질 수 있어요."],
        items: [
          "세관 검사 대상: 엑스레이 검사나 개장 검사로 정해지면 하루 이상 더 걸릴 수 있어요.",
          "받는 사람 정보 불일치: 개인통관고유부호에 등록된 이름·휴대전화와 주문 정보가 다르면 확인 요청이 올 수 있어요.",
          "면세 기준 초과: 물품 가격이 면세 기준을 넘거나, 같은 날 들어온 다른 물건과 합쳐 기준을 넘으면 세금 납부 절차가 생겨요.",
          "확인이 필요한 품목: 식품, 건강기능식품, 의약품, 전자제품 일부처럼 별도 확인이 필요한 물건은 일반 수입신고로 바뀔 수 있어요.",
          "주말·공휴일과 물량: 세관과 보세창고 업무는 평일 중심이라 주말·연휴나 할인 행사 시즌에는 진행이 늦어 보일 수 있어요."
        ]
      },
      {
        heading: "받는 사람이 할 수 있는 일",
        paragraphs: [
          "세관이나 판매처에서 문자·전화로 자료를 요청하면 빨리 답할수록 통관도 빨리 끝나요. 개인통관고유부호에 등록된 휴대전화 번호가 바뀌었다면 UNI-PASS에서 먼저 고쳐 두세요.",
          "면세 기준과 세율은 물건 종류와 출발 국가에 따라 다르고 바뀔 수 있어요. 정확한 기준은 관세청 안내에서 확인해 주세요."
        ],
        items: []
      }
    ],
    faq: [],
    sources: [CUSTOMS, UNIPASS]
  },
  {
    slug: "customs-code",
    title: "개인통관고유부호 안내",
    summary: "해외 직구에 필요한 개인통관고유부호가 무엇인지, 어디서 발급받고 무엇을 확인해야 하는지 알려 드려요.",
    sections: [
      {
        heading: "개인통관고유부호란",
        paragraphs: [
          "개인통관고유부호는 해외에서 물건을 살 때 주민등록번호 대신 쓰는 번호예요. 영문 P로 시작하는 13자리이고, 관세청이 발급해요.",
          "판매처는 이 번호로 받는 사람을 확인해 통관을 진행해요. 번호가 없거나 틀리면 통관이 멈출 수 있어요."
        ],
        items: []
      },
      {
        heading: "발급과 확인",
        paragraphs: [],
        items: [
          "관세청 UNI-PASS 누리집이나 앱에서 본인 인증 후 바로 발급받거나 조회할 수 있어요.",
          "주문할 때 받는 사람 이름과 휴대전화 번호가 개인통관고유부호에 등록된 정보와 같은지 확인해 주세요.",
          "휴대전화 번호가 바뀌었다면 UNI-PASS에서 등록 정보를 먼저 고쳐 주세요.",
          "번호가 남에게 알려져 걱정되면 UNI-PASS에서 새 번호로 다시 발급받을 수 있어요."
        ]
      },
      {
        heading: "알아 두면 좋은 점",
        paragraphs: [
          "개인통관고유부호의 유효 기간이나 등록 절차 같은 세부 기준은 바뀔 수 있어요. 주문 전에 관세청 안내를 한 번 확인해 주세요."
        ],
        items: []
      }
    ],
    faq: [],
    sources: [UNIPASS, CUSTOMS]
  },
  {
    slug: "carriers",
    title: "택배사별 배송 조회 안내",
    summary: "통관이 끝난 뒤 국내 택배로 넘어가는 과정과, 이 사이트에서 조회할 수 있는 택배사와 조회 요령을 정리했어요.",
    sections: [
      {
        heading: "조회할 수 있는 택배사",
        paragraphs: ["이 사이트는 번호를 넣으면 통관 기록과 함께 아래 택배사의 국내 배송 기록을 찾아 보여 드려요. 택배사를 몰라도 자동으로 찾아요."],
        items: ["CJ대한통운", "우체국택배", "한진택배", "롯데택배", "로젠택배"]
      },
      {
        heading: "통관 완료 뒤 택배 기록이 늦게 뜨는 이유",
        paragraphs: [
          "통관이 끝나도 보세창고에서 나와 택배사 터미널에 도착해야 택배사 조회에 기록이 생겨요. 그래서 통관 완료 뒤 하루 정도는 택배 기록이 비어 있을 수 있어요.",
          "같은 운송장 번호가 여러 택배사에 있으면 택배사를 골라 달라는 안내가 나와요. 주문 안내 문자에 적힌 택배사 이름을 골라 주세요."
        ],
        items: []
      },
      {
        heading: "배송 단계 읽는 법",
        paragraphs: [],
        items: [
          "집화: 택배 기사님이 물건을 가져갔어요.",
          "간선 상차·하차: 터미널 사이를 이동하고 있어요.",
          "배송 출발: 오늘 받는 사람 주소로 출발했어요.",
          "배송 완료: 배송이 끝났어요. 물건이 안 보이면 문 앞·경비실·택배함을 먼저 확인해 주세요."
        ]
      }
    ],
    faq: [],
    sources: [UNIPASS]
  },
  {
    slug: "faq",
    title: "자주 묻는 질문",
    summary: "통관·배송 조회를 하면서 자주 묻는 질문에 짧게 답해 드려요. 번호 종류, 조회가 안 될 때, 주말 통관까지 정리했어요.",
    sections: [
      {
        heading: "더 궁금한 점이 있다면",
        paragraphs: ["주문하신 판매처의 안내 문자나 문의 창구로 물어보시면 주문 정보와 함께 더 정확히 안내받을 수 있어요."],
        items: []
      }
    ],
    faq: [
      {
        question: "어떤 번호로 조회할 수 있나요?",
        answer: "HBL 번호, 화물관리번호, 국내 택배 운송장 번호 중 하나로 조회할 수 있어요. 번호는 주문 안내 문자나 판매처 안내에서 찾을 수 있어요."
      },
      {
        question: "번호를 넣었는데 기록이 없다고 나와요.",
        answer: "막 출고된 물건은 아직 세관이나 택배사에 기록이 올라오기 전일 수 있어요. 번호를 다시 확인하고, 하루 정도 지난 뒤 다시 조회해 주세요."
      },
      {
        question: "통관은 끝났는데 택배 조회가 안 돼요.",
        answer: "보세창고에서 나와 택배사 터미널에 도착해야 택배 기록이 생겨요. 통관 완료 뒤 하루 정도는 택배 기록이 비어 있을 수 있어요."
      },
      {
        question: "주말에도 통관이 진행되나요?",
        answer: "세관과 보세창고 업무는 평일 중심이라 주말이나 공휴일에는 진행이 멈춰 보일 수 있어요. 다음 평일에 다시 진행되는 경우가 많아요."
      },
      {
        question: "관세나 부가세를 내야 하나요?",
        answer: "물건 가격이 면세 기준 안이고 개인이 쓸 물건이면 대부분 세금이 없어요. 기준을 넘거나 품목에 따라 세금이 생길 수 있으니 정확한 기준은 관세청 안내를 확인해 주세요."
      },
      {
        question: "조회한 번호가 어딘가에 저장되나요?",
        answer: "입력한 번호와 조회 결과는 데이터베이스에 저장하지 않아요. 같은 번호의 반복 조회를 줄이려고 서버 메모리에 최대 15분, 새로고침해도 결과가 남도록 지금 쓰는 브라우저 탭에 최대 30분 보관한 뒤 자동으로 지워요. 자세한 내용은 개인정보처리방침에 있어요."
      }
    ],
    sources: [UNIPASS, CUSTOMS]
  }
];

export const GUIDE_SLUGS: readonly string[] = GUIDES.map((guide) => guide.slug);

export function guideBySlug(slug: string): Guide | null {
  return GUIDES.find((guide) => guide.slug === slug) ?? null;
}
