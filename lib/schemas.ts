import { z } from "zod";

export const TrackRequestSchema = z.object({
  trackingNumber: z.string().min(1, "조회번호를 입력해주세요").max(30, "번호가 너무 깁니다").trim()
});

export type TrackRequest = z.infer<typeof TrackRequestSchema>;
