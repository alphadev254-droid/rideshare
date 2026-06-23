import type { User } from "@/lib/api";

export function homeForRole(user: User) {
  if (user.role === "admin") return "/admin";
  if (user.role === "driver") return "/driver";
  return "/app";
}
