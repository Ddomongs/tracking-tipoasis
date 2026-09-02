export const NAVER_STORE_URL = "https://mkt.shopping.naver.com/link/6a0bbf9cc55d142f0519328c";
export const COUPANG_STORE_URL = "https://link.coupang.com/a/d7TbzdnS1s";
export const TALK_URL = "https://talk.naver.com/ct/w41rsr";

export type StorefrontTone = "naver" | "coupang";

export type Storefront = {
  readonly id: StorefrontTone;
  readonly name: string;
  readonly description: string;
  readonly href: string;
  readonly isAffiliate: boolean;
};

export const STOREFRONTS = [
  {
    id: "naver",
    name: "네이버 스토어",
    description: "판매 중인 상품과 새로 등록된 구성을 한곳에서 확인하세요.",
    href: NAVER_STORE_URL,
    isAffiliate: false
  },
  {
    id: "coupang",
    name: "쿠팡 스토어",
    description: "쿠팡에서 판매 중인 상품을 빠르게 둘러보세요.",
    href: COUPANG_STORE_URL,
    isAffiliate: true
  }
] as const satisfies readonly Storefront[];

export type FeaturedProduct = {
  readonly id: string;
  readonly category: "carplay" | "telescope" | "automotive" | "display";
  readonly name: string;
  readonly discountLabel: string;
  readonly priceLabel: string;
  readonly review: string;
  readonly reviewer: string;
  readonly reviewDate: string;
  readonly href: string;
  readonly storefront: StorefrontTone;
  readonly isAffiliate: boolean;
};

export const FEATURED_PRODUCTS = [
  {
    id: "carpodgo-carplay",
    category: "carplay",
    name: "Carpodgo mini 6.99인치 카플레이",
    discountLabel: "29%",
    priceLabel: "125,600원",
    review: "해외 구매대행으로 주문했는데 포장 상태가 깔끔하게 와서 만족했습니다.",
    reviewer: "ws****",
    reviewDate: "2026.05.24.",
    href: NAVER_STORE_URL,
    storefront: "naver",
    isAffiliate: false
  },
  {
    id: "svbony-eyepiece",
    category: "telescope",
    name: "SVBONY 천체 망원경 접안 렌즈",
    discountLabel: "17%",
    priceLabel: "46,100원",
    review: "잘 받았습니다. 요즘 날씨가 흐려서 맑은 날 별을 관측하려고 기다리고 있어요.",
    reviewer: "fore********",
    reviewDate: "2026.07.06.",
    href: COUPANG_STORE_URL,
    storefront: "coupang",
    isAffiliate: true
  },
  {
    id: "model-y-mat",
    category: "automotive",
    name: "테슬라 모델 Y 전천후 전면 매트",
    discountLabel: "17%",
    priceLabel: "94,400원",
    review: "아주 잘 사용 중입니다. 차량이 깔끔해졌어요!",
    reviewer: "addi******",
    reviewDate: "2026.07.08.",
    href: NAVER_STORE_URL,
    storefront: "naver",
    isAffiliate: false
  },
  {
    id: "blue-archive-display",
    category: "display",
    name: "블루 아카이브 아크릴 전시 케이스",
    discountLabel: "17%",
    priceLabel: "39,300원",
    review: "예쁩니다. 그리고 조립이 쉽습니다.",
    reviewer: "save****",
    reviewDate: "2026.07.04.",
    href: COUPANG_STORE_URL,
    storefront: "coupang",
    isAffiliate: true
  }
] as const satisfies readonly FeaturedProduct[];
