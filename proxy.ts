import { NextResponse, type NextRequest } from "next/server";

const INTERNAL_REALM = "tracking-tipoasis-internal";
const BASIC_PREFIX = "Basic ";

const isSameSecret = (provided: string, expected: string): boolean => {
  if (provided.length !== expected.length) return false;

  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= provided.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
};

const readBasicPassword = (header: string | null): string | null => {
  if (!header?.startsWith(BASIC_PREFIX)) return null;

  try {
    const decoded = atob(header.slice(BASIC_PREFIX.length));
    const separatorIndex = decoded.indexOf(":");
    return separatorIndex === -1 ? null : decoded.slice(separatorIndex + 1);
  } catch {
    return null;
  }
};

const unauthorizedResponse = (): NextResponse =>
  new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": `Basic realm="${INTERNAL_REALM}", charset="UTF-8"` }
  });

export function proxy(request: NextRequest): NextResponse {
  const expectedPassword = process.env.INTERNAL_ACCESS_PASSWORD;

  if (!expectedPassword) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("Not Found", { status: 404 });
    }
    return NextResponse.next();
  }

  const providedPassword = readBasicPassword(request.headers.get("authorization"));
  if (providedPassword !== null && isSameSecret(providedPassword, expectedPassword)) {
    return NextResponse.next();
  }

  return unauthorizedResponse();
}

export const config = {
  matcher: ["/internal/:path*"]
};
