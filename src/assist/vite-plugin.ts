import type { Plugin } from "vite";
import type { Connect } from "vite";
import { handleAssistRequest } from "./server";
import { handleBoardRequest } from "./board-file";
import { handleCalendarRequest } from "./calendar-api";
import { handleGoogleRequest } from "./google-cal";

function mountApi(root: string): Connect.NextHandleFunction {
  return (req, res, next) => {
    const url = req.url ?? "";
    if (url.startsWith("/api/assist")) {
      void handleAssistRequest(req, res);
      return;
    }
    if (url.startsWith("/api/board")) {
      void handleBoardRequest(req, res, root);
      return;
    }
    if (
      url.startsWith("/api/calendar") ||
      url.startsWith("/api/calendar.ics")
    ) {
      void handleCalendarRequest(req, res, root);
      return;
    }
    if (url.startsWith("/api/google")) {
      void handleGoogleRequest(req, res, root);
      return;
    }
    next();
  };
}

/** Mounts board / assist / calendar ICS / Google Calendar APIs. */
export function assistPlugin(): Plugin {
  return {
    name: "pid-api",
    configureServer(server) {
      server.middlewares.use(mountApi(server.config.root));
    },
    configurePreviewServer(server) {
      server.middlewares.use(mountApi(server.config.root));
    },
  };
}
