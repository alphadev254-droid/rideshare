import { io } from "socket.io-client";
import { BACKEND_ORIGIN } from "@/lib/api/config";
import { tokenStorage } from "@/lib/api/storage";

export function createAuthedSocket() {
  return io(BACKEND_ORIGIN, {
    transports: ["websocket", "polling"],
    auth: { token: tokenStorage.getAccess() },
    autoConnect: true,
  });
}
