import type { Plugin } from "vite";
import type { Connect } from "vite";
import { handleAssistRequest } from "./server";
import { handleBoardRequest } from "./board-file";
import { handleDeskRequest } from "./desk";
import { handleRainmeterRequest } from "./rainmeter";

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
    if (url.startsWith("/api/desk")) {
      void handleDeskRequest(req, res, root);
      return;
    }
    if (url.startsWith("/api/rainmeter")) {
      void handleRainmeterRequest(req, res, root);
      return;
    }
    next();
  };
}

/** Mounts /api/assist + /api/board + /api/rainmeter on vite dev + preview. */
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
