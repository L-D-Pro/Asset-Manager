interface TavilySearchResponse {
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

  // Use a mock response if no API key is present for development/testing
  if (!apiKey) {
    console.warn("No TAVILY_API_KEY found, using mock research data");
    return {
      query,
      responseTime: 0,
      results: [
        {
          title: "Mock Search Result: " + query,
          url: "https://example.com/mock",
          content: "This is a mock search result. Set TAVILY_API_KEY to get real web data. The company is known for its innovative approaches and recent funding round. The role typically requires deep expertise in modern tech stacks.",
          score: 1.0,
        }
      ]
    };
  }

  const response = await fetch("https://api.tavily.com/search", {
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

  if (!response.ok) {
    throw new Error(`Tavily search failed: ${response.statusText}`);
  }

  return (await response.json()) as TavilySearchResponse;
}
