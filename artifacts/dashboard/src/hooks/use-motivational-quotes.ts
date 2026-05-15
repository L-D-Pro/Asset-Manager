import { useState, useCallback } from "react";

export interface MotivationalQuote {
  quote: string;
  author: string;
}

const MOTIVATIONAL_QUOTES: MotivationalQuote[] = [
  { quote: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { quote: "Opportunities don't happen. You create them.", author: "Chris Grosser" },
  { quote: "The future depends on what you do today.", author: "Mahatma Gandhi" },
  { quote: "It is never too late to be what you might have been.", author: "George Eliot" },
  { quote: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  {
    quote: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    author: "Winston Churchill",
  },
];

export function useMotivationalQuotes() {
  const [index, setIndex] = useState(0);

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % MOTIVATIONAL_QUOTES.length);
  }, []);

  return {
    quote: MOTIVATIONAL_QUOTES[index],
    index,
    total: MOTIVATIONAL_QUOTES.length,
    next,
  };
}
