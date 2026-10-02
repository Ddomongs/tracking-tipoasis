import { z } from "zod";
import { RESULT_COPY_SLOTS, checkInvariants } from "@/lib/config/invariants";
import type { ResultCopyConfig, SiteConfig } from "@/lib/config/types";
import { GUIDE_KEYS } from "@/lib/tracking/types";
import type {
  EtaMode, GuideKey, InquiryLevel, NoticeKind, PrimaryActionKind, RecommendationContext, RecommendationPlacement,
  RevenueTier, StationId, StorePlacement, Tone
} from "@/lib/tracking/types";

/** z.enum from an exhaustive Record<K, true>: a new union member without a schema entry fails typecheck. */
function enumFromKeys<K extends string>(record: Readonly<Record<K, true>>): z.ZodEnum<[K, ...K[]]> {
  const keys = Object.keys(record) as K[];
  if (keys.length === 0) throw new Error("빈 목록으로는 값을 정할 수 없습니다");
  const [first, ...rest] = keys;
  const values: [K, ...K[]] = [first, ...rest];
  return z.enum(values);
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const KST_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?\+09:00$/;

function isRealDateKey(value: string): boolean {
  if (!DATE_KEY_PATTERN.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

const TextSchema = z.string().regex(/\S/, { message: "빈 문구입니다" });
const UrlSchema = z.string().url({ message: "주소 형식이 아닙니다" });
const PositiveIntSchema = z.number().int().positive();
const NonNegativeIntSchema = z.number().int().nonnegative();
const DateKeySchema = z.string().superRefine((value, ctx) => {
  if (!isRealDateKey(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "날짜는 2026-09-24처럼 있는 날짜를 YYYY-MM-DD로 씁니다" });
  }
});
const KstIsoSchema = z.string().superRefine((value, ctx) => {
  if (!KST_ISO_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "시각은 2026-09-26T14:05:00+09:00처럼 +09:00을 붙여 씁니다" });
  }
});

const ToneSchema = enumFromKeys<Tone>({ neutral: true, progress: true, waiting: true, attention: true, problem: true, done: true });
const InquiryLevelSchema = enumFromKeys<InquiryLevel>({
  header: true, shortcutRow: true, blockFirstLink: true, ctaButton: true, worryLink: true, textLink: true, afterStores: true, primary: true
});
const RevenueTierSchema = enumFromKeys<RevenueTier>({ none: true, quiet: true, lead: true });
const StorePlacementSchema = enumFromKeys<StorePlacement>({ none: true, shortcutRow: true, purchaseChoices: true, ctaLead: true });
const RecommendationPlacementSchema = enumFromKeys<RecommendationPlacement>({ none: true, optional: true, inline: true });
const RecommendationContextSchema = enumFromKeys<RecommendationContext>({
  pending: true, customsWaiting: true, customsCleared: true, inTransit: true, delivered: true
});
const EtaModeSchema = enumFromKeys<EtaMode>({ none: true, estimate: true, pendingInfo: true, withheld: true, deliveredOn: true });
const PrimaryActionKindSchema = enumFromKeys<PrimaryActionKind>({
  none: true, submit: true, fixNumber: true, retry: true, copyAndTalk: true, carrierOfficial: true, chooseCarrier: true, storeLead: true
});
const StationIdSchema = enumFromKeys<StationId>({ departed: true, customs: true, domestic: true, arrived: true });
const NoticeKindSchema = enumFromKeys<NoticeKind>({ outage: true, delay: true, holiday: true, info: true });
const GuideKeySchema = z.enum(GUIDE_KEYS);

const TalkChannelSchema = z.object({
  url: UrlSchema,
  labels: z.object({ header: TextSchema, shortcut: TextSchema, cta: TextSchema, copyAndTalk: TextSchema, footer: TextSchema }).strict()
}).strict();

const StoreChannelSchema = z.object({
  name: TextSchema,
  linkLabel: TextSchema,
  isAffiliate: z.boolean(),
  urls: z.object({ shortcut: UrlSchema, showcase: UrlSchema, pending: UrlSchema, deliveredLead: UrlSchema }).strict()
}).strict();

const YoutubeChannelSchema = z.object({ linkLabel: TextSchema, url: TextSchema.nullable() }).strict();

const ChannelsSchema = z.object({
  talk: TalkChannelSchema,
  naver: StoreChannelSchema,
  coupang: StoreChannelSchema,
  youtube: YoutubeChannelSchema,
  allowedHosts: z.array(TextSchema).min(1)
}).strict();

const DisclosuresSchema = z.object({ coupang: z.string() }).strict();

const HolidayPeriodSchema = z.object({
  id: TextSchema, name: TextSchema, dates: z.array(DateKeySchema).min(1), badge: TextSchema
}).strict();

const CalendarSchema = z.object({
  timeZone: z.literal("Asia/Seoul"),
  holidays: z.array(HolidayPeriodSchema),
  carrierDeliversSaturday: z.boolean()
}).strict();

const DayRangeSchema = z.object({ min: NonNegativeIntSchema, max: NonNegativeIntSchema })
  .strict()
  .refine((range) => range.min <= range.max, { message: "최솟값이 최댓값보다 큽니다" });

const DurationsSchema = z.object({
  stages: z.object({
    visibleAfterDeparture: DayRangeSchema, customs: DayRangeSchema, handoffBusinessDays: DayRangeSchema, domestic: DayRangeSchema
  }).strict(),
  typical: z.array(z.object({ station: StationIdSchema, text: TextSchema }).strict()).min(1),
  worry: z.object({
    afterEstimateBusinessDays: PositiveIntSchema,
    afterClearanceBusinessDays: PositiveIntSchema,
    notFoundDays: PositiveIntSchema,
    pendingDays: PositiveIntSchema,
    undeliveredHours: PositiveIntSchema
  }).strict(),
  staleDays: z.number().int(),
  pendingRecheck: TextSchema
}).strict();

const LookupSchema = z.object({
  skeletonDelayMs: PositiveIntSchema,
  stageMs: z.tuple([PositiveIntSchema, PositiveIntSchema]),
  spinnerStopMs: PositiveIntSchema,
  elapsedStepSeconds: PositiveIntSchema,
  timeoutMs: PositiveIntSchema,
  rateLimitCooldownSeconds: PositiveIntSchema,
  notFoundServiceCaveat: z.boolean(),
  copy: z.object({
    submit: TextSchema, submitting: TextSchema, title: TextSchema, body: TextSchema, started: TextSchema,
    longWait: TextSchema, veryLongWait: TextSchema, elapsed: TextSchema, cancel: TextSchema, carrierOfficialFirst: TextSchema,
    formatHint: TextSchema, numberFinderSummary: TextSchema, numberFinderItems: z.array(TextSchema).min(1),
    carrierAuto: TextSchema, typicalSummary: TextSchema, noscriptNotice: TextSchema
  }).strict()
}).strict();

const GuideRowSchema = z.object({
  tone: ToneSchema,
  chip: TextSchema.nullable(),
  docTitle: TextSchema,
  title: TextSchema,
  overdueTitle: TextSchema.nullable(),
  reason: TextSchema.nullable(),
  ctaHeading: TextSchema.nullable(),
  nextAction: TextSchema,
  worry: TextSchema.nullable(),
  primaryAction: PrimaryActionKindSchema,
  inquiryLevel: InquiryLevelSchema,
  revenueTier: RevenueTierSchema,
  stores: StorePlacementSchema,
  recommendations: RecommendationPlacementSchema,
  etaMode: EtaModeSchema
}).strict();

const stateGuideShape = {
  idle: GuideRowSchema, loading: GuideRowSchema,
  invalidNumber: GuideRowSchema, notFound: GuideRowSchema, temporaryDelay: GuideRowSchema, offline: GuideRowSchema,
  noResponse: GuideRowSchema, serverError: GuideRowSchema,
  pending: GuideRowSchema, customsArrived: GuideRowSchema, customsWaiting: GuideRowSchema, customsCleared: GuideRowSchema,
  handedToCarrier: GuideRowSchema, pickedUp: GuideRowSchema, inTransit: GuideRowSchema, delivered: GuideRowSchema,
  stale: GuideRowSchema, lookupUnavailable: GuideRowSchema, ambiguous: GuideRowSchema
} satisfies Record<GuideKey, typeof GuideRowSchema>;

const GlossaryEntrySchema = z.object({ source: TextSchema, label: TextSchema }).strict();

const HelpEntrySchema = z.object({
  id: TextSchema,
  summary: TextSchema,
  body: z.array(TextSchema).min(1),
  showIn: z.array(GuideKeySchema).min(1),
  openIn: z.array(GuideKeySchema)
}).strict();

const FeaturedItemSchema = z.object({
  id: TextSchema,
  name: TextSchema,
  channel: z.enum(["naver", "coupang"]),
  href: UrlSchema,
  isAffiliate: z.boolean(),
  validFrom: KstIsoSchema,
  validUntil: KstIsoSchema,
  priceLabel: TextSchema.nullable(),
  priceCheckedAt: KstIsoSchema.nullable(),
  contexts: z.array(RecommendationContextSchema).min(1)
}).strict();

const NoticeSchema = z.object({
  id: TextSchema,
  kind: NoticeKindSchema,
  title: TextSchema,
  body: TextSchema,
  startsAt: KstIsoSchema,
  endsAt: KstIsoSchema,
  home: z.boolean(),
  guideKeys: z.array(GuideKeySchema),
  cs: z.boolean()
}).strict();

const AdsSchema = z.object({
  manualSlotId: z.string().regex(/^\d+$/, { message: "광고 단위 ID는 숫자만 씁니다" }).nullable(),
  minHeightMobilePx: PositiveIntSchema,
  minHeightDesktopPx: PositiveIntSchema,
  anchorReservePx: NonNegativeIntSchema
}).strict();

const StyleSchema = z.object({ followSystemDark: z.boolean() }).strict();

const RESULT_COPY_KEYS = Object.keys(RESULT_COPY_SLOTS) as (keyof ResultCopyConfig)[];
const resultCopyShape = Object.fromEntries(RESULT_COPY_KEYS.map((key) => [key, TextSchema])) as Record<keyof ResultCopyConfig, typeof TextSchema>;
const ResultCopySchema = z.object(resultCopyShape).strict();

const SiteConfigObjectSchema = z.object({
  channels: ChannelsSchema,
  disclosures: DisclosuresSchema,
  calendar: CalendarSchema,
  durations: DurationsSchema,
  lookup: LookupSchema,
  stateGuide: z.object(stateGuideShape).strict(),
  glossary: z.array(GlossaryEntrySchema),
  help: z.array(HelpEntrySchema),
  featuredProducts: z.array(FeaturedItemSchema),
  notices: z.array(NoticeSchema),
  ads: AdsSchema,
  style: StyleSchema,
  resultCopy: ResultCopySchema
}).strict();

export const SiteConfigSchema: z.ZodType<SiteConfig, z.ZodTypeDef, unknown> = SiteConfigObjectSchema.superRefine(checkInvariants);

const TYPE_NAMES: Readonly<Record<string, string>> = {
  string: "문자열", number: "숫자", boolean: "true/false", array: "목록", object: "객체", null: "null"
};

function formatPath(path: readonly (string | number)[]): string {
  const text = path.reduce<string>(
    (acc, part) => (typeof part === "number" ? `${acc}[${part}]` : acc.length > 0 ? `${acc}.${part}` : part),
    ""
  );
  return text.length > 0 ? text : "(설정 전체)";
}

function koreanMessage(issue: z.ZodIssue): string {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      return issue.received === "undefined" ? "값이 없습니다" : `${TYPE_NAMES[issue.expected] ?? issue.expected} 형식이어야 합니다`;
    case z.ZodIssueCode.invalid_literal:
      return `값은 ${String(issue.expected)}이어야 합니다`;
    case z.ZodIssueCode.invalid_enum_value:
      return `허용되지 않은 값입니다(가능한 값: ${issue.options.join(", ")})`;
    case z.ZodIssueCode.unrecognized_keys:
      return `알 수 없는 항목입니다: ${issue.keys.join(", ")}`;
    case z.ZodIssueCode.too_small:
      if (issue.type === "array") return `항목이 ${String(issue.minimum)}개 이상 있어야 합니다`;
      return issue.inclusive ? `${String(issue.minimum)} 이상이어야 합니다` : `${String(issue.minimum)}보다 커야 합니다`;
    case z.ZodIssueCode.too_big:
      if (issue.type === "array") return `항목은 ${String(issue.maximum)}개까지입니다`;
      return issue.inclusive ? `${String(issue.maximum)} 이하여야 합니다` : `${String(issue.maximum)}보다 작아야 합니다`;
    case z.ZodIssueCode.invalid_string:
      return issue.validation === "url" ? "주소 형식이 아닙니다" : issue.message;
    default:
      return issue.message;
  }
}

/** One Korean line per issue: 'notices[0].endsAt: 종료 시각이 시작보다 빠릅니다'. */
export function formatConfigIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `${formatPath(issue.path)}: ${koreanMessage(issue)}`).join("\n");
}
