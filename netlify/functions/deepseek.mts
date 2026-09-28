import { handleHostedApi } from "../../src/server/hostedApi.ts";

export default (request: Request) => handleHostedApi(request);

export const config = { path: ["/api/detect-language", "/api/analyze-chunk", "/api/furigana"] };
