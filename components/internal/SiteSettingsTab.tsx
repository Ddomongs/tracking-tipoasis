"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/primitives/Button";
import type { SiteSettings, SiteSettingsField } from "@/lib/site-settings/settings";
import { ERROR_CLASS, FIELD_CLASS, HELP_CLASS, LABEL_CLASS, PANEL_CLASS, SECTION_TITLE_CLASS } from "./ui";

/**
 * '사이트 문구·링크' (10월 2일 요청): staff edit the home store sheet's words and links. Saved to Vercel Global Config (formerly Edge Config)
 * through /internal/site-settings; the public pages pick the change up at once. Without the store the form explains
 * what to connect (docs/ops/site-settings.md).
 */
const ENDPOINT = "/internal/site-settings";

const GROUPS: ReadonlyArray<{ readonly title: string; readonly fields: ReadonlyArray<{ readonly id: SiteSettingsField; readonly label: string; readonly help?: string }> }> = [
  {
    title: "스토어 칸",
    fields: [
      { id: "storeButtonLabel", label: "여는 버튼 문구", help: "모바일 첫 화면 [조회하기] 아래 버튼" },
      { id: "storeTitle", label: "칸 제목" },
      { id: "storeIntro", label: "안내 한 줄" }
    ]
  },
  {
    title: "네이버 스토어",
    fields: [
      { id: "naverLabel", label: "버튼 문구" },
      { id: "naverUrl", label: "링크 주소" }
    ]
  },
  {
    title: "쿠팡 스토어",
    fields: [
      { id: "coupangLabel", label: "버튼 문구" },
      { id: "coupangUrl", label: "링크 주소", help: "쿠팡 파트너스 고지 문구는 자동으로 붙어요" }
    ]
  },
  {
    title: "유튜브",
    fields: [
      { id: "youtubeLabel", label: "버튼 문구" },
      { id: "youtubeUrl", label: "채널 주소", help: "비우면 유튜브 버튼을 숨겨요. 예: https://www.youtube.com/@채널이름" }
    ]
  }
];

interface Loaded {
  readonly values: SiteSettings;
  readonly defaults: SiteSettings;
  readonly writable: boolean;
  readonly source: "defaults" | "edgeConfig" | "error";
}

type Errors = Partial<Record<SiteSettingsField | "form", string>>;

const READ_FAILED = "저장된 값을 불러오지 못해 기본값이 보이고 있어요. 이대로 저장하면 저장된 값이 모두 바뀌니 새로고침한 뒤 다시 시도해 주세요.";

const REASONS: Readonly<Record<string, string>> = {
  notConfigured: "저장소(Global Config)나 저장용 토큰이 아직 없어 저장할 수 없어요.",
  rejected: "Vercel이 저장을 거절했어요. 토큰과 팀 설정을 확인해 주세요(docs/ops/site-settings.md).",
  network: "Vercel에 연결하지 못했어요. 잠시 뒤 다시 저장해 주세요.",
  forbidden: "이 화면에서만 저장할 수 있어요. 새로고침 뒤 다시 시도해 주세요."
};

export function SiteSettingsTab(): React.JSX.Element {
  const baseId = useId();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [form, setForm] = useState<SiteSettings | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  // A failed read shows the defaults; saving them would silently replace every stored value, so it is blocked.
  const readFailed = loaded?.source === "error";

  useEffect(() => {
    let alive = true;
    fetch(ENDPOINT, { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<Loaded>) : Promise.reject(new Error(String(response.status)))))
      .then((data) => {
        if (!alive) return;
        setLoaded(data);
        setForm(data.values);
      })
      .catch(() => {
        if (alive) setStatus("현재 값을 불러오지 못했어요. 새로고침해 주세요.");
      });
    return () => {
      alive = false;
    };
  }, []);

  const save = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (form === null) return;
    if (readFailed) {
      setStatus(READ_FAILED);
      return;
    }
    setSaving(true);
    setStatus("저장하고 있어요…");
    try {
      const response = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const data = (await response.json()) as { ok: boolean; reason?: string; detail?: string; errors?: Errors; values?: SiteSettings };
      if (data.ok && data.values !== undefined) {
        setErrors({});
        setForm(data.values);
        setStatus("저장했어요. 사이트에 바로 반영돼요(늦어도 1분).");
      } else {
        setErrors(data.errors ?? {});
        const reason = REASONS[data.reason ?? ""] ?? "저장하지 못했어요.";
        setStatus(
          data.reason === "invalid" ? "고칠 칸이 있어요. 빨간 안내를 확인해 주세요." : data.detail ? `${reason} (Vercel 응답: ${data.detail})` : reason
        );
        // After the errors render, take the keyboard to the first field to fix.
        requestAnimationFrame(() => formRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus());
      }
    } catch {
      setStatus(REASONS.network ?? "");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby={`${baseId}-title`} className={PANEL_CLASS} data-site-settings="true">
      <h2 id={`${baseId}-title`} className={SECTION_TITLE_CLASS}>
        사이트 문구·링크
      </h2>
      <p className={HELP_CLASS}>첫 화면 스토어 칸(모바일 팝업·PC 오른쪽 칸)의 버튼 문구와 링크를 바꿔요. 다른 문구는 설정 파일에서 바꿔요.</p>
      {loaded !== null && !loaded.writable ? (
        <p className={ERROR_CLASS} data-site-settings-readonly="true">
          저장소(Vercel Global Config) 연결이나 저장용 토큰(VERCEL_API_TOKEN)이 없어 지금은 볼 수만 있어요. 연결 방법은 docs/ops/site-settings.md에 있어요.
        </p>
      ) : null}
      {readFailed ? (
        <p className={ERROR_CLASS} data-site-settings-read-failed="true">
          {READ_FAILED}
        </p>
      ) : null}
      {form === null || loaded === null ? null : (
        <form ref={formRef} onSubmit={(event) => void save(event)} noValidate className="flex flex-col gap-5">
          {GROUPS.map((group) => (
            <fieldset key={group.title} className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
              <legend className="mb-2 p-0 text-tt-md font-bold">{group.title}</legend>
              {group.fields.map((field) => {
                const inputId = `${baseId}-${field.id}`;
                const error = errors[field.id];
                const describedBy = [field.help ? `${inputId}-help` : null, error ? `${inputId}-error` : null].filter(Boolean).join(" ");
                return (
                  <div key={field.id} className="flex flex-col gap-1">
                    <label htmlFor={inputId} className={LABEL_CLASS}>
                      {field.label}
                    </label>
                    <input
                      id={inputId}
                      name={field.id}
                      type={field.id.endsWith("Url") ? "url" : "text"}
                      value={form[field.id]}
                      onChange={(event) => setForm({ ...form, [field.id]: event.target.value })}
                      aria-invalid={error ? true : undefined}
                      aria-describedby={describedBy || undefined}
                      className={FIELD_CLASS}
                    />
                    {field.help ? (
                      <p id={`${inputId}-help`} className={HELP_CLASS}>
                        {field.help}
                      </p>
                    ) : null}
                    {error ? (
                      <p id={`${inputId}-error`} className={ERROR_CLASS}>
                        {error}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </fieldset>
          ))}
          {errors.form ? <p className={ERROR_CLASS}>{errors.form}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" busy={saving}>
              저장
            </Button>
            <Button type="button" variant="secondary" onClick={() => {
                setForm(loaded.defaults);
                setErrors({});
              }}>
              기본값 불러오기
            </Button>
          </div>
        </form>
      )}
      <p role="status" className={HELP_CLASS} data-site-settings-status="true">
        {status}
      </p>
    </section>
  );
}
