interface TavilySearchResponse {
  status: "ok" | "unavailable";
  reason?: "missing_api_key" | "request_failed" | "network_error";
  answer?: string;
  query: string;
  responseTime: number;
  results: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
    rawContent?: string;
  }>;
}

export async function searchWeb(query: string): Promise<TavilySearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    return {
      status: "unavailable",
      reason: "missing_api_key",
      query,
      responseTime: 0,
      results: [],
    };
  }

  let response: Response;
  try {
    response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "advanced",
        include_answer: true,
        max_results: 5,
      }),
    });
  } catch {
    return {
      status: "unavailable",
      reason: "network_error",
      query,
      responseTime: 0,
      results: [],
    };
  }

  if (!response.ok) {
    return {
      status: "unavailable",
      reason: "request_failed",
      query,
      responseTime: 0,
      results: [],
    };
  }

  return {
    status: "ok",
    query, // pinned before spread so it's always defined if Tavily omits the field
    ...(await response.json() as Omit<TavilySearchResponse, "status">),
  };
}
