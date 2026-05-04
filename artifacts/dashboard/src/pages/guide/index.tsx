import { BookOpen, Lightbulb, HelpCircle, ArrowRight, FileText, Briefcase, Brain, MessageSquare, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ContentCard } from "@/components/ui/content-card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { FadeIn } from "@/components/motion/fade-in";

const FAQ_ITEMS = [
 {
 q: "How do I start my first job application?",
 a: `Head to the Dashboard and click "New Job" — or go to Jobs Pipeline → Ingest Job. Paste the job title, company, source URL, and the full job description text. The AI will parse the requirements and you can then tailor your resume and draft a cover letter.`,
 },
 {
 q: "Why do I need a Base Resume?",
 a: "Your Base Resume is your master document. The AI uses it as the foundation for every tailored resume. Paste your current resume once, and it will be adapted for each job you apply to — keeping the facts accurate while emphasizing the most relevant experience.",
 },
 {
 q: "What does 'tailoring' actually do?",
 a: "Tailoring rewrites your base resume to match a specific job. It reorders bullet points, emphasizes matching skills, and adjusts language to align with the job description — all while preserving the truth. Every tailored resume must be approved by you before use.",
 },
 {
 q: "What are Claims and why should I use them?",
 a: "Claims are individual facts about your experience — like 'Led a team of 5 engineers' or 'Reduced cloud costs by 30%'. The AI uses these building blocks in your resumes and cover letters. Claims acts as a truth-lock: the AI can only use facts you've approved.",
 },
 {
 q: "Can I apply to jobs automatically?",
 a: "No. Job Ops is deliberately designed for human-in-the-loop operation. It helps you prepare materials — resumes, cover letters, proposals — but you always review and submit applications yourself. This keeps you compliant with platform terms of service.",
 },
 {
 q: "What's the difference between a resume version and a cover letter draft?",
 a: "Resume versions are tailored rewrites of your base resume. Cover letters are personalized letters that highlight matching claims for a specific job. Both go through a review queue where you approve or reject them before using them in applications.",
 },
 {
 q: "How do I use the AI tools effectively?",
 a: "Start with good inputs: a detailed base resume, well-written claims, and complete job descriptions. The AI Review page lets you see past AI runs. Over time, AI Learning can automatically optimize which prompts and models work best for you based on your outcomes.",
 },
 {
 q: "Where can I get help if I'm stuck?",
 a: "Check the Resources page for free learning platforms, career prep tools, and mental health support. For technical issues, see Admin Docs (admin users only) or refer to the repository documentation.",
 },
];

const GETTING_STARTED = [
 { step: "Set up your Base Resume", desc: "Go to Base Resume and paste your current resume text. This unlocks all tailoring features.", icon: FileText, to: "/base-resume" },
 { step: "Build your Claims", desc: "Add key facts about your experience in Claims Ledger. The AI uses these as truth-locked building blocks.", icon: Brain, to: "/claims" },
 { step: "Ingest a job", desc: "Paste a job description in Jobs Pipeline. The AI extracts requirements and scores the fit.", icon: Briefcase, to: "/jobs" },
 { step: "Tailor & draft", desc: "Generate a tailored resume and cover letter from your base resume and matching claims.", icon: MessageSquare, to: "/resume-versions" },
];

export default function GuidePage() {
 return (
  <div className="max-w-4xl space-y-6">
  <PageHeader
  title="Help & Tips"
  subtitle="Everything you need to run an effective, honest job search with Job Ops."
  badge={
  <div className="flex flex-wrap gap-2">
  <Badge variant="outline">Human reviewed</Badge>
  <Badge variant="outline">AI assisted</Badge>
  <Badge variant="outline">No auto-submit</Badge>
  </div>
  }
  />

  <FadeIn>
  <ContentCard>
  <div className="mb-4">
  <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
  <Sparkles className="h-5 w-5 text-primary shrink-0" />
  Getting Started
  </h2>
  <p className="text-sm text-muted-foreground mt-0.5">Follow these four steps to make your first application.</p>
  </div>
  <div className="space-y-2">
  {GETTING_STARTED.map((item, i) => (
  <Link key={i} to={item.to} className="flex items-start gap-4 rounded-xl px-4 py-3 hover:bg-muted/60 transition-colors group">
  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
  <span className="text-sm font-bold">{i + 1}</span>
  </div>
  <div className="flex-1 min-w-0">
  <p className="font-medium text-sm group-hover:text-primary transition-colors">{item.step}</p>
  <p className="text-sm text-muted-foreground">{item.desc}</p>
  </div>
  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1.5 group-hover:translate-x-0.5 transition-transform" />
  </Link>
  ))}
  </div>
  </ContentCard>
 </FadeIn>

  <FadeIn>
  <ContentCard>
  <div className="mb-4">
  <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
  <Lightbulb className="h-5 w-5 text-warning shrink-0" />
  Pro Tips
  </h2>
  <p className="text-sm text-muted-foreground mt-0.5">Small habits that make a big difference.</p>
  </div>
  <ul className="space-y-3 text-sm text-muted-foreground">
  <li className="flex items-start gap-2">
  <span className="font-bold text-foreground">Keep your base resume updated.</span>
  {" "}Every tailored resume starts here. The better your base, the better the output.
  </li>
  <li className="flex items-start gap-2">
  <span className="font-bold text-foreground">Build claims for everything.</span>
  {" "}The more claims you have, the more material the AI has to personalize cover letters.
  </li>
  <li className="flex items-start gap-2">
  <span className="font-bold text-foreground">Review before using.</span>
  {" "}Always read AI-generated drafts carefully. The AI can make mistakes — you are the final editor.
  </li>
  <li className="flex items-start gap-2">
  <span className="font-bold text-foreground">Log your outcomes.</span>
  {" "}Mark applications with their result (interview, offer, rejected). This feeds the AI Learning system.
  </li>
  <li className="flex items-start gap-2">
  <span className="font-bold text-foreground">Use the Trends page.</span>
  {" "}Check market data and salary ranges before applying to ensure the role is a good fit.
  </li>
  </ul>
  </ContentCard>
 </FadeIn>

  <FadeIn>
  <ContentCard>
  <div className="mb-4">
  <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
  <HelpCircle className="h-5 w-5 text-primary shrink-0" />
  Frequently Asked Questions
  </h2>
  </div>
  <Accordion type="single" collapsible className="w-full">
  {FAQ_ITEMS.map((item, i) => (
  <AccordionItem key={i} value={`faq-${i}`}>
  <AccordionTrigger className="text-sm font-medium text-left">{item.q}</AccordionTrigger>
  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
  {item.a}
  </AccordionContent>
  </AccordionItem>
  ))}
  </Accordion>
  </ContentCard>
 </FadeIn>

 <p className="text-center text-xs text-muted-foreground pb-8">
 Need more help? Check the <Link to="/resources" className="underline hover:text-foreground">Resources page</Link>{" "}
 for free learning platforms and support services.
 </p>
 </div>
 );
}
