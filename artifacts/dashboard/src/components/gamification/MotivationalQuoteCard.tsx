import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

const QUOTES = [
  { quote: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { quote: "Opportunities don't happen. You create them.", author: "Chris Grosser" },
  { quote: "The future depends on what you do today.", author: "Mahatma Gandhi" },
  { quote: "It is never too late to be what you might have been.", author: "George Eliot" },
  { quote: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  {
    quote: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    author: "Winston Churchill",
  },
]

const AUTO_ADVANCE_MS = 8000

interface MotivationalQuoteCardProps {
  className?: string
}

export function MotivationalQuoteCard({ className }: MotivationalQuoteCardProps) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * QUOTES.length))
  const [direction, setDirection] = useState(1)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const go = (next: number, dir: number) => {
    setDirection(dir)
    setIndex(next)
  }

  const goTo = (i: number) => go(i, i > index ? 1 : -1)

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      go((index + 1) % QUOTES.length, 1)
    }, AUTO_ADVANCE_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [index])

  const current = QUOTES[index]!

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl",
        "bg-card/70  border border-border/50",
        "shadow-[0_2px_15px_-3px_rgba(0,0,0,0.06),0_10px_20px_-2px_rgba(0,0,0,0.03)]",
        className,
      )}
    >
      {/* Gradient bottom accent line — matches the example design */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary via-secondary to-primary/40 rounded-b-2xl" />

      <div className="flex items-center gap-4 px-8 py-5">
        {/* Quote content */}
        <div className="flex-1 min-w-0 text-center">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={index}
              custom={direction}
              initial={{ opacity: 0, x: direction * 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -30 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="text-sm md:text-base italic leading-relaxed text-muted-foreground">
                &ldquo;{current.quote}&rdquo;
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground/70 font-medium">
                &mdash; {current.author}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Dot navigation */}
          <div className="flex justify-center gap-1.5 mt-3">
            {QUOTES.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={cn(
                  "rounded-full transition-all duration-300",
                  i === index
                    ? "w-4 h-1.5 bg-primary"
                    : "w-1.5 h-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60",
                )}
                aria-label={`Go to quote ${i + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Mascot avatar — matches the fox avatar in the example screenshot */}
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="shrink-0 flex h-12 w-12 items-center justify-center rounded-full  shadow-[0_4px_15px_-3px_hsl(var(--primary)/0.4)] select-none"
        >
          <span className="text-2xl">🦊</span>
        </motion.div>
      </div>
    </div>
  )
}
