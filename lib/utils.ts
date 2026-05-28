import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));

export const toIsoOrNow = (value?: string): string => {
  if (!value) {
    return new Date().toISOString();
  }

  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) {
    return new Date().toISOString();
  }

  return asDate.toISOString();
};
