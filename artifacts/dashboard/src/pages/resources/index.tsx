import { BookOpen, Heart, ExternalLink, GraduationCap, LifeBuoy, Shield } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ContentCard } from "@/components/ui/content-card";
import { FadeIn } from "@/components/motion/fade-in";
import { StaggerContainer, StaggerItem } from "@/components/motion/stagger-container";

interface ResourceLink {
  name: string;
  url: string;
  description: string;
}

interface ResourceSection {
  title: string;
  icon: React.ComponentType;
  description: string;
  links: ResourceLink[];
}

const RESOURCE_SECTIONS: ResourceSection[] = [
  {
    title: "Free Learning Platforms",
    icon: GraduationCap,
    description: "Build skills and earn credentials without spending a dime.",
    links: [
      {
        name: "freeCodeCamp",
        url: "https://www.freecodecamp.org",
        description: "Thousands of hours of coding lessons, projects, and certifications — completely free.",
      },
      {
        name: "Khan Academy",
        url: "https://www.khanacademy.org",
        description: "Free courses in math, science, economics, computing, and test prep.",
      },
      {
        name: "Coursera Free Courses",
        url: "https://www.coursera.org/courses?query=free",
        description: "Audit courses from top universities for free. Financial aid available for certificates.",
      },
      {
        name: "edX Free Courses",
        url: "https://www.edx.org/free-online-courses",
        description: "Free courses from Harvard, MIT, and other top institutions. Audit tracks are free.",
      },
      {
        name: "MIT OpenCourseWare",
        url: "https://ocw.mit.edu",
        description: "Virtually all MIT course content — lecture notes, exams, and videos — available for free.",
      },
      {
        name: "Google Career Certificates",
        url: "https://grow.google/certificates",
        description: "Professional certificates in IT support, data analytics, project management, and more.",
      },
    ],
  },
  {
    title: "Career & Interview Prep",
    icon: BookOpen,
    description: "Free tools to sharpen your resume and interview skills.",
    links: [
      {
        name: "GitHub Learning Lab",
        url: "https://lab.github.com",
        description: "Learn GitHub workflows, open source contribution, and development practices hands-on.",
      },
      {
        name: "LinkedIn Free Courses",
        url: "https://www.linkedin.com/learning/topics/free",
        description: "Rotating selection of free LinkedIn Learning courses on business, tech, and creative skills.",
      },
      {
        name: "Harvard CS50",
        url: "https://cs50.harvard.edu",
        description: "Harvard's legendary intro to computer science — free online with certificate options.",
      },
      {
        name: "The Odin Project",
        url: "https://www.theodinproject.com",
        description: "Full-stack curriculum covering HTML, CSS, JavaScript, Ruby, and Node.js — entirely free.",
      },
    ],
  },
  {
    title: "Mental Health Resources",
    icon: Heart,
    description: "You're not alone. Free and low-cost support is available.",
    links: [
      {
        name: "988 Suicide & Crisis Lifeline",
        url: "https://988lifeline.org",
        description: "Call or text 988 for free, confidential support 24/7. Also offers online chat.",
      },
      {
        name: "Crisis Text Line",
        url: "https://www.crisistextline.org",
        description: "Text HOME to 741741 from anywhere in the US to connect with a trained crisis counselor.",
      },
      {
        name: "NAMI Helpline",
        url: "https://www.nami.org/help",
        description: "Free mental health information, referrals, and support at 1-800-950-NAMI (6264).",
      },
      {
        name: "BetterHelp Financial Aid",
        url: "https://www.betterhelp.com/faid",
        description: "Online therapy with financial aid options that can reduce cost to $60-90/week.",
      },
      {
        name: "Open Path Collective",
        url: "https://openpathcollective.org",
        description: "In-person and online therapy sessions for $40-70 per session.",
      },
    ],
  },
  {
    title: "Financial & Living Support",
    icon: LifeBuoy,
    description: "Government and community programs that can help while you search.",
    links: [
      {
        name: "SNAP Food Assistance",
        url: "https://www.fns.usda.gov/snap/supplemental-nutrition-assistance-program",
        description: "Monthly benefits to help buy food. Apply through your state agency.",
      },
      {
        name: "Medicaid",
        url: "https://www.medicaid.gov",
        description: "Free or low-cost health coverage for eligible individuals and families.",
      },
      {
        name: "USA.gov Unemployment Help",
        url: "https://www.usa.gov/unemployment",
        description: "Find your state's unemployment benefits program and application information.",
      },
      {
        name: "211.org",
        url: "https://www.211.org",
        description: "Free, confidential referral to local resources — housing, food, health, and more.",
      },
      {
        name: "FindHelp.org",
        url: "https://www.findhelp.org",
        description: "Search by ZIP code for free or reduced-cost local programs and services.",
      },
    ],
  },
  {
    title: "Staying Safe Online",
    icon: Shield,
    description: "Job searching means interacting with strangers. Stay vigilant.",
    links: [
      {
        name: "FTC Job Scam Guide",
        url: "https://consumer.ftc.gov/articles/job-scams",
        description: "How to spot and avoid fake job postings, phishing, and employment scams.",
      },
      {
        name: "BBB Scam Tracker",
        url: "https://www.bbb.org/scamtracker",
        description: "Search and report scams. See what fraud is trending in your area.",
      },
    ],
  },
];

export default function ResourcesPage() {
  return (
    <div>
      <PageHeader
        title="Resources"
        subtitle="Free tools, learning platforms, mental health support, and financial resources — curated for job seekers."
      />

      <StaggerContainer>
        {RESOURCE_SECTIONS.map((section) => (
          <StaggerItem key={section.title}>
            <FadeIn>
              <ContentCard>
                <div>
                  <h2>
                    <section.icon />
                    {" "}{section.title}
                  </h2>
                  <p>{section.description}</p>
                </div>
                <ul>
                  {section.links.map((link) => (
                    <li key={link.name}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <div>
                          <span>{link.name}</span>
                          <p>{link.description}</p>
                        </div>
                        <ExternalLink />
                      </a>
                    </li>
                  ))}
                </ul>
              </ContentCard>
            </FadeIn>
          </StaggerItem>
        ))}
      </StaggerContainer>

      <p>
        These are external resources. Job Ops is not affiliated with any of these organizations.
      </p>
    </div>
  );
}
