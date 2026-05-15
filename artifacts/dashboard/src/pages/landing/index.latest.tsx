import { useReducedMotion, motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ClipboardList,
  Flame,
  Rocket,
  Target,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";

const fadeInUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

function Hero() {
  const shouldReduce = useReducedMotion();

  const scrollToHow = () => {
    const el = document.getElementById("how-it-works");
    if (el) el.scrollIntoView({ behavior: shouldReduce ? "auto" : "smooth" });
  };

  const pills = [
    { k: "Human reviewed", v: "No auto-submit" },
    { k: "Compare models", v: "Promote winners" },
    { k: "Learns", v: "From outcomes" },
  ];

  return (
    <section className="min-h-[90svh] bg-background flex flex-col items-center justify-center text-center px-4 relative overflow-hidden pt-16 pb-16">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-44 left-1/2 -translate-x-1/2 w-[980px] h-[640px] bg-[hsl(var(--primary)/0.16)] rounded-full blur-[120px]" />
        <div className="absolute -bottom-48 right-[-140px] w-[560px] h-[520px] bg-[hsl(var(--secondary)/0.14)] rounded-full blur-[120px]" />
      </div>

      <div className="absolute top-0 left-0 right-0 z-10">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl  text-white shadow-sm">
              <Rocket className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-sm font-extrabold tracking-tight text-foreground">
              Job Ops
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <Button asChild size="sm" className="rounded-xl">
              <Link to="/register">Join the pilot</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="relative max-w-3xl mx-auto w-full">
        <motion.div
          initial={shouldReduce ? {} : { opacity: 0, y: 20 }}
          animate={shouldReduce ? {} : { opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-5 inline-flex items-center justify-center"
          style={{
            animation: shouldReduce ? "none" : "float 3s ease-in-out infinite",
          }}
        >
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-card/70  border border-border/60 shadow-sm text-primary">
            <Rocket className="h-7 w-7" aria-hidden="true" />
          </span>
        </motion.div>

        <motion.h1
          initial={shouldReduce ? {} : { opacity: 0, y: 24 }}
          animate={shouldReduce ? {} : { opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight"
        >
          Level Up Your Job Search
        </motion.h1>

        <motion.p
          initial={shouldReduce ? {} : { opacity: 0, y: 20 }}
          animate={shouldReduce ? {} : { opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
        >
          AI-powered tools that gamify the hunt - earn XP, build streaks, and land
          your dream role.
        </motion.p>

        <motion.div
          initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
          animate={shouldReduce ? {} : { opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-7 flex flex-wrap items-center justify-center gap-2"
        >
          {pills.map((item) => (
            <div
              key={item.k}
              className="rounded-full border border-border/70 bg-card/70  px-4 py-2"
            >
              <span className="text-xs font-bold text-foreground">{item.k}</span>
              <span className="text-xs text-muted-foreground">
                {" "}
                /{" "}
                {item.v}
              </span>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={shouldReduce ? {} : { opacity: 0, y: 16 }}
          animate={shouldReduce ? {} : { opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            to="/register"
            className="inline-flex items-center gap-2 text-base font-bold bg-card text-primary hover:bg-white/90 transition-all px-6 py-3 rounded-2xl hover:-translate-y-0.5"
          >
            Get Started Free
          </Link>
          <button
            onClick={scrollToHow}
            className="inline-flex items-center gap-2 text-base font-bold text-primary border-2 border-primary/40 hover:border-primary/70 hover:bg-primary/5 transition-colors px-6 py-3 rounded-2xl cursor-pointer"
          >
            See How It Works
          </button>
        </motion.div>
      </div>

      <motion.div
        initial={shouldReduce ? {} : { opacity: 0, y: 40 }}
        animate={shouldReduce ? {} : { opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.4 }}
        className="mt-16 relative max-w-md mx-auto w-full px-4"
        style={{ animation: shouldReduce ? "none" : "float 4s ease-in-out infinite" }}
      >
        <div className="bg-background rounded-2xl border border-border shadow-xl p-6">
          <div className="flex items-center gap-1.5 -mx-6 -mt-6 mb-5 px-4 py-3 bg-muted/40 rounded-t-2xl border-b border-border/60">
            <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-warning/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-success/60" />
            <span className="text-xs text-muted-foreground ml-2">
              Job Ops Dashboard
            </span>
          </div>
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold">Level 12</span>
              <span className="text-xs text-muted-foreground">2,450 / 3,000 XP</span>
            </div>
            <div className="h-3 bg-surface rounded-full overflow-hidden border border-border/50">
              <div className="h-full bg-primary rounded-full" style={{ width: "82%" }} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            {[
              ["12", "Jobs"],
              ["47", "Applied"],
              ["7", "Day Streak"],
            ].map(([val, label]) => (
              <div key={label} className="bg-surface rounded-xl p-4 text-center">
                <div className="text-lg font-bold text-primary">{val}</div>
                <div className="text-xs text-muted-foreground leading-tight">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function HowItWorks() {
  const shouldReduce = useReducedMotion();

  const cards = [
    {
      icon: ClipboardList,
      title: "Ingest Jobs",
      desc: "Paste a job URL and our AI parses everything - requirements, company info, and key details in seconds.",
    },
    {
      icon: Target,
      title: "Tailor & Apply",
      desc: "AI drafts resumes and cover letters matched to each role, with human-in-the-loop review.",
    },
    {
      icon: TrendingUp,
      title: "Track & Level Up",
      desc: "Earn XP for every action, build streaks, and unlock achievements as you progress.",
    },
  ];

  return (
    <section id="how-it-works" className="py-20 md:py-28 bg-background">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <motion.div
          variants={shouldReduce ? undefined : fadeInUp}
          initial={shouldReduce ? undefined : "hidden"}
          whileInView={shouldReduce ? undefined : "visible"}
          viewport={shouldReduce ? undefined : { once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">How It Works</h2>
        </motion.div>

        <motion.div
          variants={shouldReduce ? undefined : staggerContainer}
          initial={shouldReduce ? undefined : "hidden"}
          whileInView={shouldReduce ? undefined : "visible"}
          viewport={shouldReduce ? undefined : { once: true }}
          className="grid md:grid-cols-3 gap-8"
        >
          {cards.map((card) => (
            <motion.div
              key={card.title}
              variants={shouldReduce ? undefined : staggerItem}
              className="p-8 text-center"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-card/70  border border-border/60 text-primary shadow-sm">
                <card.icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-bold mb-2">{card.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{card.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function GamificationTeaser() {
  const shouldReduce = useReducedMotion();

  const cards = [
    {
      icon: Zap,
      title: "Earn XP",
      desc: "Get points for every job ingested, resume tailored, and application tracked.",
    },
    {
      icon: Flame,
      title: "Build Streaks",
      desc: "Daily consistency pays off - maintain your streak and watch your flame grow.",
    },
    {
      icon: Trophy,
      title: "Collect Badges",
      desc: "Unlock achievements from your first job to your 100th application.",
    },
  ];

  const stats = [
    { value: "500+", label: "XP per application" },
    { value: "7-day", label: "streaks to build" },
    { value: "30+", label: "badges to unlock" },
  ];

  return (
    <section className="py-20 md:py-28 bg-surface">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <motion.div
          variants={shouldReduce ? undefined : fadeInUp}
          initial={shouldReduce ? undefined : "hidden"}
          whileInView={shouldReduce ? undefined : "visible"}
          viewport={shouldReduce ? undefined : { once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Why Its Different</h2>
        </motion.div>

        <motion.div
          variants={shouldReduce ? undefined : staggerContainer}
          initial={shouldReduce ? undefined : "hidden"}
          whileInView={shouldReduce ? undefined : "visible"}
          viewport={shouldReduce ? undefined : { once: true }}
          className="grid md:grid-cols-3 gap-6 mb-16"
        >
          {cards.map((card) => (
            <motion.div
              key={card.title}
              variants={shouldReduce ? undefined : staggerItem}
              className="p-8 text-center"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-card/70  border border-border/60 text-primary shadow-sm">
                <card.icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-bold mb-2">{card.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{card.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          variants={shouldReduce ? undefined : fadeInUp}
          initial={shouldReduce ? undefined : "hidden"}
          whileInView={shouldReduce ? undefined : "visible"}
          viewport={shouldReduce ? undefined : { once: true }}
          className="flex flex-wrap items-center justify-center gap-8 md:gap-16 py-8 px-6 bg-background rounded-2xl border border-border/50"
        >
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-primary">{stat.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function PricingCTA() {
  const shouldReduce = useReducedMotion();

  return (
    <section className="py-20 md:py-28 bg-background">
      <div className="max-w-2xl mx-auto px-4 md:px-6 text-center">
        <motion.div
          variants={shouldReduce ? undefined : fadeInUp}
          initial={shouldReduce ? undefined : "hidden"}
          whileInView={shouldReduce ? undefined : "visible"}
          viewport={shouldReduce ? undefined : { once: true }}
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Start Free Today</h2>
          <p className="mt-4 text-lg text-muted-foreground">No credit card required. Join the pilot program.</p>
          <div className="mt-8">
            <Button asChild variant="primary" size="lg" className="text-lg">
              <Link to="/register">Join the Pilot</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Already a member?{" "}
            <Link to="/login" className="text-primary font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/50 py-8 bg-surface">
      <div className="max-w-7xl mx-auto px-4 md:px-6 text-center">
        <p className="text-center text-xs text-muted-foreground space-y-2">
          <span>
            &copy; 2026 Cyrus Sepasi. All rights reserved. Portfolio Studio&trade; is a
            product of L&amp;D PRO.
          </span>
          <span className="block space-x-3 mt-1">
            <span className="hover:text-foreground transition-colors cursor-pointer">
              Terms of Service
            </span>
            <span>|</span>
            <span className="hover:text-foreground transition-colors cursor-pointer">
              Privacy Policy
            </span>
          </span>
        </p>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Hero />
      <HowItWorks />
      <GamificationTeaser />
      <PricingCTA />
      <Footer />
    </div>
  );
}
