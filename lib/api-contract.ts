import { NextResponse } from "next/server";

export const API_CONTRACT_VERSION = "2026-04-09";

export function withApiContract<T extends Record<string, unknown>>(payload: T) {
  return {
    contract: {
      version: API_CONTRACT_VERSION,
      compatibility: {
        web: ">=2026-04-09",
        mobile: ">=2026-04-09",
      },
    },
    ...payload,
  };
}

export function jsonWithApiContract<T extends Record<string, unknown>>(
  payload: T,
  init?: ResponseInit
) {
  const headers = new Headers(init?.headers);
  headers.set("X-Astro-Contract-Version", API_CONTRACT_VERSION);
  return NextResponse.json(withApiContract(payload), {
    ...init,
    headers,
  });
}

export function appendApiContractHeader(headers?: HeadersInit) {
  const result = new Headers(headers);
  result.set("X-Astro-Contract-Version", API_CONTRACT_VERSION);
  return result;
}
