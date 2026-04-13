import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import type { User } from "@/lib/auth/oauth";

export function withAuth(
  handler: (user: User, request: NextRequest) => Promise<Response>
) {
  return async (request: NextRequest): Promise<Response> => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
      return handler(user, request);
    } catch (error) {
      console.error("[withAuth]", error);
      return NextResponse.json(
        { error: "internal_server_error" },
        { status: 500 }
      );
    }
  };
}
