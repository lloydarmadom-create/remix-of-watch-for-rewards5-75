import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

const router = () => createRouter({ routeTree, context: { queryClient: new QueryClient() } });

describe("App shell routes", () => {
  it.each(["/videos", "/store", "/history", "/profile", "/admin", "/privacy"])(
    "matches a page for %s",
    (path) => {
      expect(router().matchRoutes(path).at(-1)?.routeId).toBe(path);
    },
  );
});
