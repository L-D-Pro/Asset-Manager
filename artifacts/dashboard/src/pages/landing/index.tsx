import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { easing } from '@/lib/animations';
import { cn } from '@/lib/utils';
import {
  Briefcase,
  CheckCircle,
  X,
  ChevronDown,
  ArrowRight,
  Users,
  Mail,
  Sparkles,
  FileText,
  MessageSquare,
  Menu,
  X as XIcon,
  Star,
  Play,
  Shield,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { CommunityActivity } from '@/components/community-activity';

/* ─── Animation primitives ─── */
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (delay = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, delay, ease: easing.smooth },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.4, ease: easing.smooth },
  },
};

/* ─── Data ─── */
const steps = [
  {
    num: '01',
    title: 'Onboard Your Profile',
    desc: 'Share your resume, career goals, and preferences. We learn what makes you unique — no generic templates.',
    icon: Users,
  },
  {
    num: '02',
    title: 'Expert Application Crafting',
    desc: 'Our hybrid team of AI tools and human reviewers tailor every resume and cover letter to match each job.',
    icon: Sparkles,
  },
  {
    num: '03',
    title: 'Land Interview Invitations',
    desc: 'Sit back while we apply. You focus on networking and prep — we handle the grind.',
    icon: Mail,
  },
];

const comparisons = [
  { feature: 'Human review on every application', us: true, them: false },
  { feature: 'Custom-tailored resumes (not AI slop)', us: true, them: false },
  { feature: 'ATS-optimized formatting', us: true, them: true },
  { feature: 'Real-time progress tracking', us: true, them: false },
  { feature: 'Privacy-first (data never sold)', us: true, them: false },
  { feature: 'Dedicated support channel', us: true, them: false },
  { feature: 'Works with any job board', us: true, them: true },
];

const stats = [
  { label: 'Hired in 3 Months', value: 93, suffix: '%', sub: 'Through our applications + personal networking' },
  { label: 'Less Time Searching', value: 40, suffix: '%', sub: 'From 5 months down to 1–3 months' },
  { label: 'Return on Investment', value: 200, suffix: 'x', sub: 'Saved weeks = extra salary + multiple offers' },
];

const proofCards = [
  { title: 'Resume Tailored', role: 'Senior PM @ Meta', time: '2 min ago', icon: FileText, status: 'done' },
  { title: 'Application Submitted', role: 'Staff Engineer @ Stripe', time: '12 min ago', icon: CheckCircle, status: 'done' },
  { title: 'Cover Letter Drafted', role: 'Product Designer @ Figma', time: '34 min ago', icon: MessageSquare, status: 'pending' },
  { title: 'Interview Scheduled', role: 'Eng Manager @ Google', time: '1 hr ago', icon: Mail, status: 'done' },
];

const testimonials = [
  {
    quote: 'I was applying to 50+ roles a week and burning out. L&D Pro took the entire process off my plate. I landed 3 offers in 6 weeks.',
    name: 'Aubrey Smith',
    role: 'Software Engineer',
  },
  {
    quote: 'The human touch matters. Every cover letter felt like I wrote it myself. Recruiters actually commented on the quality.',
    name: 'Teja Aditya',
    role: 'Product Strategy & Growth',
  },
  {
    quote: 'Facing a layoff with 60 days left on my visa, this was a lifeline. Three offers, 75% salary increase. I am incredibly grateful.',
    name: 'Hang Zou',
    role: 'Consultant',
  },
];

const faqs = [
  {
    q: 'Is my data safe? Who sees my resume?',
    a: 'Your data is encrypted at rest and in transit. Only your assigned reviewer and our internal tooling can access your resume. We never sell or share your information with third parties.',
  },
  {
    q: 'Will this work with my ATS system?',
    a: 'Yes. Every tailored resume is formatted to pass Applicant Tracking Systems. We test against the most common ATS parsers to ensure your application gets seen by human eyes.',
  },
  {
    q: 'How is this different from AI auto-apply tools?',
    a: 'Most auto-apply tools blast generic applications. We combine smart AI drafting with human review — so every submission is personalized, accurate, and professional. Recruiters can tell the difference.',
  },
  {
    q: 'What is your success rate?',
    a: '93% of our active users land a role within 3 months. That includes applications we submit plus the extra time you gain to network and prepare for interviews.',
  },
  {
    q: 'Can I get a refund if I am not satisfied?',
    a: 'Absolutely. We offer a pro-rated refund policy. If you land your dream job before using all your credits, we refund the remainder. No fine print.',
  },
];

const pricingTiers = [
  {
    name: 'Pilot Program',
    price: 'Free',
    description: 'Limited-time early access. Invite code required.',
    features: ['Weekly AI request quota', 'Job parsing & matching', 'Resume tailoring', 'Cover letter drafting', 'Application tracking'],
    cta: 'Join Pilot',
    featured: false,
  },
  {
    name: 'Pilot + Bonus',
    price: 'Free + 3mo Basic',
    description: 'Complete the pilot and get 3 months of Basic Tier free at launch.',
    features: ['All Pilot features', '3 months post-launch access', 'Priority support channel', 'Early access to new features', 'Shape the product roadmap'],
    cta: 'Join Pilot',
    featured: true,
  },
  {
    name: 'VIP Pilot',
    price: 'Free',
    description: 'For close connections and power users. Higher limits.',
    features: ['Enhanced weekly quota', 'All Pilot + Bonus features', 'Direct line to the founder', 'Custom feature requests', 'Early adopter badge'],
    cta: 'Join Pilot',
    featured: false,
  },
];

/* ─── Sections ─── */

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const shouldReduce = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinks = [
    { label: 'How it Works', href: '#how-it-works' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ];

  const scrollTo = (id: string) => {
    setMobileOpen(false);
    const el = document.querySelector(id);
    if (el) el.scrollIntoView({ behavior: shouldReduce ? 'auto' : 'smooth' });
  };

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: easing.smooth }}
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-background/70 backdrop-blur-xl border-b border-border/50 shadow-sm'
          : 'bg-transparent'
      )}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <Briefcase className="h-6 w-6 text-primary" />
            <span>L&D Pro</span>
            <span className="text-muted-foreground font-normal text-sm hidden sm:inline">— Job Ops</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((l) => (
              <button
                key={l.label}
                onClick={() => scrollTo(l.href)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {l.label}
              </button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/login">
              <button className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2">
                Sign In
              </button>
            </Link>
            <Link to="/register">
              <button className="text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-4 py-2 rounded-lg">
                Join Pilot
              </button>
            </Link>
          </div>

          <button
            className="md:hidden p-2 text-muted-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <XIcon className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="md:hidden overflow-hidden bg-background/95 backdrop-blur-xl border-b border-border/50"
          >
            <div className="px-4 py-4 space-y-3">
              {navLinks.map((l) => (
                <button
                  key={l.label}
                  onClick={() => scrollTo(l.href)}
                  className="block w-full text-left text-sm font-medium text-muted-foreground hover:text-foreground py-2"
                >
                  {l.label}
                </button>
              ))}
              <div className="pt-2 border-t border-border/50 flex flex-col gap-2">
                <Link to="/login" onClick={() => setMobileOpen(false)}>
                  <button className="w-full text-left text-sm font-medium text-muted-foreground hover:text-foreground py-2">
                    Sign In
                  </button>
                </Link>
                <Link to="/register" onClick={() => setMobileOpen(false)}>
                  <button className="w-full text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-4 py-2 rounded-lg">
                    Join Pilot
                  </button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

function Hero() {
  const shouldReduce = useReducedMotion();
  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-28">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/10 rounded-full blur-[120px] opacity-60" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: shouldReduce ? 0 : 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: easing.smooth }}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 backdrop-blur-sm px-4 py-1.5 text-sm text-muted-foreground mb-6"
          >
            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
            Private pilot with limited spots
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: shouldReduce ? 0 : 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease: easing.smooth }}
            className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]"
          >
            Land your dream job{' '}
            <span className="bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">
              while you sleep
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: shouldReduce ? 0 : 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.16, ease: easing.smooth }}
            className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
          >
            Human assistants + AI agents apply to jobs for you with custom resumes and cover letters.
            So you can focus on what actually matters: networking and interviews.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: shouldReduce ? 0 : 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.24, ease: easing.smooth }}
            className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link to="/register">
              <button className="group inline-flex items-center gap-2 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all px-6 py-3 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5">
                Start for Free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </Link>
            <Link to="/register">
              <button className="inline-flex items-center gap-2 text-base font-medium text-foreground bg-card border border-border hover:bg-accent transition-colors px-6 py-3 rounded-xl">
                <Play className="h-4 w-4" />
                See How It Works
              </button>
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="mt-4 text-xs text-muted-foreground"
          >
            Limited pilot access · Invite code required
          </motion.p>
        </div>

        {/* Dashboard preview */}
        <motion.div
          initial={{ opacity: 0, y: shouldReduce ? 0 : 40, scale: shouldReduce ? 1 : 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3, ease: easing.smooth }}
          className="mt-16 relative max-w-5xl mx-auto"
        >
          <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30 bg-muted/30">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400/80" />
                <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
              </div>
              <span className="text-xs text-muted-foreground ml-2">L&D Pro — Job Ops Dashboard</span>
            </div>
            <div className="p-6 md:p-8 grid gap-4 md:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-xl border border-border/40 bg-background/60 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="h-3 w-20 bg-muted rounded" />
                    <div className="h-6 w-6 rounded bg-primary/10" />
                  </div>
                  <div className="h-8 w-16 bg-foreground/10 rounded" />
                  <div className="h-2 w-full bg-muted rounded" />
                </div>
              ))}
              <div className="md:col-span-3 rounded-xl border border-border/40 bg-background/60 p-4 space-y-3">
                <div className="h-3 w-32 bg-muted rounded" />
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-2.5 w-3/4 bg-muted rounded" />
                      <div className="h-2 w-1/2 bg-muted/60 rounded" />
                    </div>
                    <div className="h-5 w-14 bg-emerald-100 dark:bg-emerald-900/30 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function SocialProof() {
  return (
    <section className="py-10 border-y border-border/30 bg-muted/20">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <motion.p
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4"
        >
          Built for modern job seekers
        </motion.p>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
          <span className="text-lg font-bold text-muted-foreground/60 select-none">
            AI-Powered &middot; Human-Guided &middot; Private Pilot
          </span>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">How We Get You Hired</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Recruiters reject sloppy AI auto-filled applications. We apply with real human oversight — no AI slop, no vibe-coded nonsense.
          </p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid md:grid-cols-3 gap-8"
        >
          {steps.map((s) => (
            <motion.div
              key={s.num}
              variants={staggerItem}
              className="group relative rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm p-8 hover:border-primary/30 hover:bg-card/60 transition-all duration-300"
            >
              <div className="text-5xl font-bold text-primary/10 group-hover:text-primary/20 transition-colors mb-4">
                {s.num}
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{s.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function Comparison() {
  return (
    <section className="py-20 md:py-28 bg-muted/20">
      <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8">
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Us vs. Them</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            The difference between human-in-the-loop and generic AI automation.
          </p>
        </motion.div>

        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="rounded-2xl border border-border/50 bg-card overflow-hidden"
        >
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-6 py-4 bg-muted/40 border-b border-border/30 text-sm font-semibold">
            <span>Feature</span>
            <span className="text-center w-20">L&D Pro</span>
            <span className="text-center w-20 text-muted-foreground">Others</span>
          </div>
          {comparisons.map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_auto_auto] gap-4 px-6 py-4 items-center border-b border-border/20 last:border-0 hover:bg-muted/20 transition-colors"
            >
              <span className="text-sm">{row.feature}</span>
              <div className="flex justify-center w-20">
                {row.us ? (
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                ) : (
                  <X className="h-5 w-5 text-red-400" />
                )}
              </div>
              <div className="flex justify-center w-20">
                {row.them ? (
                  <CheckCircle className="h-5 w-5 text-emerald-500/40" />
                ) : (
                  <X className="h-5 w-5 text-red-400/40" />
                )}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function Stats() {
  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-[100px]" />
      </div>
      <div className="relative max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">What the Pilot Offers</h2>
          <p className="mt-4 text-muted-foreground text-lg">Free access to powerful job application tools.</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              variants={fadeInUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={i * 0.1}
              className="text-center rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm p-8"
            >
              <div className="text-5xl md:text-6xl font-bold tracking-tight bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent">
                {s.value}{s.suffix}
              </div>
              <div className="mt-2 text-base font-semibold">{s.label}</div>
              <div className="mt-1 text-sm text-muted-foreground">{s.sub}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProofOfWork() {
  return (
    <section className="py-20 md:py-28 bg-muted/20">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Proof of Work</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Live updates from your dedicated assistant — every application, every tailored resume, every win.
          </p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {proofCards.map((card) => (
            <motion.div
              key={card.title}
              variants={staggerItem}
              className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-5 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'h-8 w-8 rounded-lg flex items-center justify-center',
                    card.status === 'done' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                  )}>
                    <card.icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">{card.title}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{card.role}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">{card.time}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Pilot Program</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Free for the duration of the test phase. No credit card required. Invite code needed to join.
          </p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid md:grid-cols-3 gap-6 lg:gap-8"
        >
          {pricingTiers.map((tier) => (
            <motion.div
              key={tier.name}
              variants={staggerItem}
              className={cn(
                'relative rounded-2xl border p-8 flex flex-col',
                tier.featured
                  ? 'border-primary/40 bg-primary/5 backdrop-blur-sm shadow-lg shadow-primary/5'
                  : 'border-border/50 bg-card/40 backdrop-blur-sm'
              )}
            >
              {tier.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-block text-xs font-semibold bg-primary text-primary-foreground px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}
              <h3 className="text-lg font-semibold">{tier.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight">{tier.price}</span>
                <span className="text-muted-foreground text-sm">one-time</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{tier.description}</p>
              <ul className="mt-6 space-y-3 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link to="/register" className="mt-8 block">
                <button className={cn(
                  'w-full text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors',
                  tier.featured
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-card border border-border hover:bg-accent'
                )}>
                  {tier.cta}
                </button>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="py-20 md:py-28 bg-muted/20">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Straight from Our DMs</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Real conversations with real people getting hired.
          </p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid md:grid-cols-3 gap-6"
        >
          {testimonials.map((t) => (
            <motion.div
              key={t.name}
              variants={staggerItem}
              className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm p-8 flex flex-col"
            >
              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className="h-4 w-4 text-amber-500 fill-amber-500" />
                ))}
              </div>
              <p className="text-sm leading-relaxed flex-1">&ldquo;{t.quote}&rdquo;</p>
              <div className="mt-6 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-semibold">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20 md:py-28">
      <div className="max-w-3xl mx-auto px-4 md:px-6 lg:px-8">
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Frequently Asked Questions</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Everything you need to know before getting started.
          </p>
        </motion.div>

        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="space-y-3"
        >
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-muted/20 transition-colors"
              >
                <span className="text-sm font-semibold pr-4">{faq.q}</span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200',
                    openIndex === i && 'rotate-180'
                  )}
                />
              </button>
              <AnimatePresence initial={false}>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: easing.smooth }}
                  >
                    <div className="px-6 pb-4 text-sm text-muted-foreground leading-relaxed">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-emerald-500/5" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-primary/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-3xl mx-auto px-4 md:px-6 lg:px-8 text-center">
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
            Ready to stop applying and start interviewing?
          </h2>
          <p className="mt-6 text-lg text-muted-foreground">
            Join our pilot community and help shape the future of AI-assisted job applications.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register">
              <button className="group inline-flex items-center gap-2 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all px-6 py-3 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5">
                Start for Free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </Link>
            <Link to="/register">
              <button className="inline-flex items-center gap-2 text-base font-medium text-foreground bg-card border border-border hover:bg-accent transition-colors px-6 py-3 rounded-xl">
                Sign In
              </button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Free forever access · No credit card needed</p>
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/50 py-12 bg-muted/20">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="grid md:grid-cols-3 gap-8">
          <div>
            <Link to="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
              <Briefcase className="h-5 w-5 text-primary" />
              <span>L&D Pro</span>
            </Link>
            <p className="mt-2 text-sm text-muted-foreground">
              Human-in-the-loop job application platform. Apply smarter, interview better.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">Product</h4>
            <ul className="space-y-2">
              {['Dashboard', 'Jobs Pipeline', 'Resume Queue', 'Cover Letters'].map((item) => (
                <li key={item}>
                  <span className="text-sm text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-3">Legal</h4>
            <ul className="space-y-2">
              {[
                { label: 'Privacy Policy', href: '/privacy-policy' },
                { label: 'Terms of Service', href: '/terms-of-service' },
              ].map((item) => (
                <li key={item.label}>
                  <Link to={item.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-border/30 text-center text-xs text-muted-foreground space-y-2">
          <p>&copy; 2026 L&D PRO. All rights reserved. Job Ops is a product of L&amp;D PRO.</p>
          <p className="space-x-3">
            <Link to="/terms-of-service" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <span className="text-border">|</span>
            <Link to="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ─── Main Page ─── */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <Hero />
      <SocialProof />
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 mt-8">
        <CommunityActivity />
      </div>
      <HowItWorks />
      <Comparison />
      <Stats />
      <ProofOfWork />
      <Pricing />
      <Testimonials />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
