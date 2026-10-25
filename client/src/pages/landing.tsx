import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  GraduationCap,
  Menu,
  Quote,
  School,
  X,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { isStaffRole } from "@/lib/auth-utils";
import { WhatsAppFloat } from "@/components/whatsapp-float";

const brand = {
  teal: "#20A99A",
  navy: "#17243B",
  orange: "#FFA500",
  background: "#F3F9F9",
};

const heroSlides = [
  {
    title: "Build the foundations for what comes next.",
    description:
      "Explore structured learning for SS1, SS2, and SS3, and make steady progress toward your academic goals.",
    image:
      "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=2000&q=85",
    imageAlt: "Students learning together in a bright classroom",
  },
  {
    title: "Learning without limits.",
    description:
      "Find learning opportunities that support your university journey and help you deepen your understanding.",
    image: "/images/university-learning.svg",
    imageAlt: "Illustration of a university learner studying among books",
  },
  {
    title: "Make room for your next skill.",
    description:
      "Discover professional learning designed to help you build knowledge and move toward your ambitions.",
    image:
      "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=2000&q=85",
    imageAlt: "Colleagues sharing ideas during a learning session",
  },
];

const partnerSlots = [
  "Education partner",
  "Learning partner",
  "Community partner",
  "Institutional partner",
  "Industry partner",
];

const learningPaths = [
  {
    icon: School,
    label: "SENIOR SECONDARY",
    title: "SS1, SS2 & SS3",
    detail:
      "Strengthen your understanding with lessons and practice for your secondary school journey.",
    tint: "#E5F5F2",
  },
  {
    icon: GraduationCap,
    label: "UNIVERSITY",
    title: "Learn beyond school",
    detail:
      "Explore university-level learning opportunities and build confidence in your studies.",
    tint: "#FFF2D9",
  },
  {
    icon: BriefcaseBusiness,
    label: "PROFESSIONAL",
    title: "Grow your expertise",
    detail:
      "Develop knowledge and practical skills through professional learning opportunities.",
    tint: "#E8EFF8",
  },
];

const studentStories = [
  {
    image:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=900&q=85",
    imageAlt: "Illustrative portrait representing a secondary school learner",
    quote: "I can revisit topics at my own pace, and the quizzes help me see what I should practise next.",
    name: "Amina Yusuf",
    detail: "Illustrative SS2 learner",
  },
  {
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=85",
    imageAlt: "Illustrative portrait representing a university learner",
    quote: "The structured lessons make it easier to build a steady study routine alongside my university work.",
    name: "Chidi Okafor",
    detail: "Illustrative university learner",
  },
  {
    image:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&q=85",
    imageAlt: "Illustrative portrait representing a professional learner",
    quote: "I like being able to fit professional learning around my schedule and keep developing new skills.",
    name: "Zainab Bello",
    detail: "Illustrative professional learner",
  },
];

function Brand() {
  return (
    <Link
      href="/"
      className="inline-flex flex-col rounded-md leading-none"
      aria-label="Learnpedia home"
    >
      <span className="text-xl font-extrabold tracking-tight" style={{ color: brand.navy }}>Learnpedia</span>
      <span className="mt-1 text-[10px] font-bold tracking-[0.16em] text-[#20A99A]">LEARN WITHOUT LIMITS</span>
    </Link>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [heroIndex, setHeroIndex] = useState(0);
  const [storyIndex, setStoryIndex] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (user) setLocation(isStaffRole(user.role) ? "/admin" : "/dashboard");
  }, [user, setLocation]);

  useEffect(() => {
    const timer = window.setInterval(
      () => setHeroIndex((current) => (current + 1) % heroSlides.length),
      6000,
    );
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(
      () => setStoryIndex((current) => (current + 1) % studentStories.length),
      7000,
    );
    return () => window.clearInterval(timer);
  }, []);

  if (user) return null;

  const activeHero = heroSlides[heroIndex];
  const activeStory = studentStories[storyIndex];
  return (
    <main className="min-h-screen" style={{ backgroundColor: brand.background, color: brand.navy }}>
      <header className="sticky top-0 z-40 border-b border-[#17243B]/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Brand />

          <nav aria-label="Main navigation" className="hidden items-center gap-9 md:flex">
            <a href="#learning-paths" className="text-sm font-semibold text-[#17243B]/75 transition-colors hover:text-[#20A99A]">
              Learning paths
            </a>
            <a href="#why-learnpedia" className="text-sm font-semibold text-[#17243B]/75 transition-colors hover:text-[#20A99A]">
              Why Learnpedia
            </a>
            <a href="#about" className="text-sm font-semibold text-[#17243B]/75 transition-colors hover:text-[#20A99A]">
              About us
            </a>
          </nav>

          <div className="hidden items-center gap-3 sm:flex">
            <Link href="/login" className="rounded-md px-4 py-2 text-sm font-bold transition-colors hover:bg-[#F3F9F9]">
              Log in
            </Link>
            <Button asChild className="h-11 rounded-lg px-5 font-bold text-[#17243B] hover:opacity-90" style={{ backgroundColor: brand.teal }}>
              <Link href="/register">Create account</Link>
            </Button>
          </div>

          <div className="flex items-center gap-2 sm:hidden">
            <Link href="/login" className="px-2 py-2 text-sm font-bold">Log in</Link>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#17243B]/15"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav aria-label="Mobile navigation" className="border-t border-[#17243B]/10 bg-white px-4 py-3 sm:hidden">
            <a onClick={() => setMobileMenuOpen(false)} href="#learning-paths" className="block rounded-lg px-3 py-3 text-sm font-semibold hover:bg-[#F3F9F9]">Learning paths</a>
            <a onClick={() => setMobileMenuOpen(false)} href="#why-learnpedia" className="block rounded-lg px-3 py-3 text-sm font-semibold hover:bg-[#F3F9F9]">Why Learnpedia</a>
            <a onClick={() => setMobileMenuOpen(false)} href="#about" className="block rounded-lg px-3 py-3 text-sm font-semibold hover:bg-[#F3F9F9]">About us</a>
            <Link href="/register" className="mt-2 block rounded-lg px-3 py-3 text-sm font-bold text-[#20A99A] hover:bg-[#F3F9F9]">Create account</Link>
          </nav>
        )}
      </header>

      <section
        aria-label="Learnpedia highlights"
        aria-roledescription="carousel"
        className="relative isolate flex min-h-[590px] items-center overflow-hidden bg-[#17243B] sm:min-h-[650px]"
      >
        <div
          key={activeHero.image}
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-700"
          role="img"
          aria-label={activeHero.imageAlt}
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(23,36,59,.94) 0%, rgba(23,36,59,.80) 48%, rgba(23,36,59,.28) 100%), url("${activeHero.image}")`,
          }}
        />
        <div className="relative mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h1 className="mt-7 max-w-xl text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
              {heroIndex === 0 ? (
                <>One platform. Different ambitions. <span className="text-[#FFA500]">Endless possibilities.</span></>
              ) : activeHero.title}
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/80 sm:text-lg sm:leading-8">
              {activeHero.description}
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:flex sm:flex-row sm:gap-4">
              <Button asChild size="lg" className="h-auto min-h-12 w-full whitespace-normal rounded-lg px-2.5 py-3 text-center text-xs font-bold leading-tight text-[#17243B] hover:opacity-90 sm:w-auto sm:px-6 sm:text-base" style={{ backgroundColor: brand.teal }}>
                <Link href="/register" className="justify-center">Explore Learnpedia <ArrowRight className="ml-1 h-4 w-4 shrink-0 sm:ml-2" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-auto min-h-12 w-full whitespace-normal rounded-lg border-[#FFA500] px-2.5 py-3 text-center text-xs font-bold leading-tight text-[#17243B] hover:bg-[#FFA500]/90 hover:text-[#17243B] sm:w-auto sm:px-6 sm:text-base" style={{ backgroundColor: brand.orange }}>
                <a href="#learning-paths" className="justify-center">Find your path <ArrowDown className="ml-1 h-4 w-4 shrink-0 sm:ml-2" /></a>
              </Button>
            </div>
          </div>

          <div className="mt-12 border-t border-white/20 pt-5 sm:max-w-2xl">
            <div className="flex items-center gap-2" aria-label={`Slide ${heroIndex + 1} of ${heroSlides.length}`}>
              {heroSlides.map((slide, index) => (
                <span
                  key={slide.title}
                  aria-current={index === heroIndex ? "true" : undefined}
                  className={`h-2 rounded-full transition-all ${index === heroIndex ? "w-9 bg-[#FFA500]" : "w-2 bg-white/60"}`}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 right-0 hidden bg-[#FFA500] px-8 py-4 text-xs font-extrabold tracking-[0.18em] text-[#17243B] lg:block">
          LEARN WITH PURPOSE
        </div>
      </section>

      <section id="learning-paths" className="scroll-mt-24 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="text-sm font-extrabold tracking-[0.17em] text-[#20A99A]">LEARNING, FOR EVERY NEXT STEP</p>
              <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-[#17243B] sm:text-4xl">
                One platform. Different ambitions. Endless possibilities.
              </h2>
            </div>
            <p className="max-w-lg leading-7 text-[#17243B]/65">
              Whether you are preparing for what comes next at school or building skills for your career, find a path that fits.
            </p>
          </div>

          <div className="mt-10 grid auto-cols-[86%] grid-flow-col gap-5 overflow-x-auto pb-4 snap-x snap-mandatory md:grid-flow-row md:auto-cols-auto md:grid-cols-3 md:overflow-visible">
            {learningPaths.map(({ icon: Icon, label, title, detail, tint }) => (
              <article key={label} className="min-h-[270px] snap-start rounded-2xl border border-[#17243B]/10 bg-white p-7 shadow-[0_8px_28px_rgba(23,36,59,0.05)] sm:p-8">
                <div className="flex items-start justify-between">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: tint, color: brand.teal }}>
                    <Icon className="h-7 w-7" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-extrabold tracking-[0.15em] text-[#17243B]/45">{label}</span>
                </div>
                <h3 className="mt-7 text-xl font-bold text-[#17243B]">{title}</h3>
                <p className="mt-3 leading-7 text-[#17243B]/65">{detail}</p>
                <Link href="/register" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#20A99A] hover:text-[#17243B]">
                  Get started <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            ))}
          </div>
          <p className="mt-2 text-xs text-[#17243B]/45 md:hidden">Swipe to explore all learning paths</p>
        </div>
      </section>

      <section id="about" className="scroll-mt-24 border-y border-[#17243B]/5 bg-white py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
          <div className="relative min-h-[340px] overflow-hidden rounded-2xl bg-[#17243B] sm:min-h-[440px]">
            <img
              src="https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1200&q=85"
              alt="Students collaborating around a table"
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#17243B]/85 via-[#17243B]/10 to-transparent" />
            <div className="absolute bottom-0 p-7 text-white sm:p-9">
              <p className="text-sm font-bold tracking-[0.14em] text-[#FFA500]">A PLACE TO KEEP GROWING</p>
              <p className="mt-3 max-w-sm text-2xl font-bold leading-snug">Learning should open doors at every stage.</p>
            </div>
            <span className="absolute right-5 top-5 rounded-full bg-white/95 px-4 py-2 text-xs font-extrabold tracking-wide text-[#17243B]">LEARNPEDIA</span>
          </div>

          <div>
            <p className="text-sm font-extrabold tracking-[0.17em] text-[#20A99A]">LEARNING THAT MOVES WITH YOU</p>
            <h2 className="mt-3 text-balance text-3xl font-extrabold leading-tight text-[#17243B] sm:text-4xl">
              More than a starting point. A place to keep progressing.
            </h2>
            <p className="mt-5 text-base leading-8 text-[#17243B]/65">
              Learnpedia brings together learning for secondary school, university, and professional development. Follow structured lessons, practice what you learn, and keep building toward your goals.
            </p>
            <ul className="mt-7 space-y-4">
              {[
                "Courses organized around a clear learning journey",
                "Lessons and quizzes that bring learning and practice together",
                "A place to return to as your goals evolve",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm font-semibold leading-6 text-[#17243B]/80">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#20A99A]/10 text-[#20A99A]">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <Button asChild className="mt-8 h-12 rounded-lg px-6 font-bold text-white hover:opacity-90" style={{ backgroundColor: brand.navy }}>
              <Link href="/register">Start your journey <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      <section id="why-learnpedia" className="scroll-mt-24 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-extrabold tracking-[0.17em] text-[#20A99A]">WHY OUR STUDENTS LOVE US</p>
            <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-[#17243B] sm:text-4xl">
              A little inspiration for your own journey.
            </h2>
            <p className="mt-4 leading-7 text-[#17243B]/65">
              These fictional sample stories illustrate the section. Replace them with real testimonials and approved learner photos before publishing.
            </p>
          </div>

          <div
            className="relative mx-auto mt-12 grid max-w-5xl overflow-hidden rounded-3xl border border-[#17243B]/10 bg-white shadow-[0_16px_50px_rgba(23,36,59,0.08)] md:grid-cols-[0.8fr_1.2fr]"
          >
            <div className="relative min-h-[300px] bg-[#17243B] md:min-h-[390px]">
              <img
                key={activeStory.image}
                src={activeStory.image}
                alt={activeStory.imageAlt}
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#17243B]/70 to-transparent md:bg-gradient-to-r md:from-transparent md:to-[#17243B]/10" />
              <span className="absolute bottom-5 left-5 rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-extrabold tracking-[0.14em] text-[#17243B]">
                FICTIONAL SAMPLE
              </span>
            </div>
            <div className="flex min-h-[300px] flex-col justify-between p-7 sm:p-10 md:min-h-[390px]">
              <div>
                <Quote className="h-9 w-9 text-[#FFA500]" aria-hidden="true" />
                <p aria-live="polite" className="mt-7 text-xl font-semibold leading-8 text-[#17243B] sm:text-2xl sm:leading-9">
                  “{activeStory.quote}”
                </p>
                <p className="mt-4 text-xs leading-5 text-[#17243B]/50">Fictional sample quote and name; replace with a real, approved student story before launch.</p>
              </div>
              <div className="mt-8 flex items-end justify-between gap-4 border-t border-[#17243B]/10 pt-5">
                <div>
                  <p className="font-bold text-[#17243B]">{activeStory.name}</p>
                  <p className="mt-1 text-sm text-[#17243B]/60">{activeStory.detail}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-5 flex justify-center gap-2" aria-label={`Student story ${storyIndex + 1} of ${studentStories.length}`}>
            {studentStories.map((story, index) => (
              <span
                key={story.image}
                aria-current={index === storyIndex ? "true" : undefined}
                className={`h-2 rounded-full transition-all ${index === storyIndex ? "w-8 bg-[#20A99A]" : "w-2 bg-[#17243B]/25"}`}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 sm:pb-24 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-7 rounded-3xl bg-[#17243B] px-7 py-10 text-white sm:px-12 sm:py-12 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <p className="text-sm font-extrabold tracking-[0.17em] text-[#FFA500]">YOUR NEXT CHAPTER STARTS HERE</p>
            <h2 className="mt-3 text-balance text-3xl font-extrabold leading-tight sm:text-4xl">
              Make learning part of where you are going.
            </h2>
            <p className="mt-3 leading-7 text-white/70">Create your Learnpedia account and find a learning path that fits your ambitions.</p>
          </div>
          <Button asChild size="lg" className="h-12 shrink-0 rounded-lg px-6 font-bold text-[#17243B] hover:opacity-90" style={{ backgroundColor: brand.orange }}>
            <Link href="/register">Create your account <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      <section aria-labelledby="partners-heading" className="overflow-hidden border-y border-[#17243B]/[0.06] bg-white py-12 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 id="partners-heading" className="text-sm font-extrabold tracking-[0.16em] text-[#17243B] sm:text-base">
              OUR PARTNERS
            </h2>
            <p className="mt-2 text-sm text-[#17243B]/55">
              Partner logo spaces are placeholders until confirmed organizations and approved brand assets are provided.
            </p>
          </div>
          <div className="partner-marquee mt-8" aria-label="Partner logo placeholders">
            <div className="partner-marquee-track">
              {[false, true].map((isDuplicate) => (
                <div
                  key={isDuplicate ? "duplicate" : "partners"}
                  aria-hidden={isDuplicate}
                  className="partner-marquee-group"
                >
                  {partnerSlots.map((label) => (
                    <div
                      key={label}
                      className="flex h-20 w-52 shrink-0 items-center justify-center rounded-xl border border-dashed border-[#17243B]/20 bg-[#F3F9F9] px-5 text-center text-sm font-semibold text-[#17243B]/45"
                    >
                      <span>{label}<br />Logo placeholder</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-10 border-b border-[#17243B]/10 pb-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_0.8fr_1fr]">
            <div className="max-w-sm">
              <Brand />
              <p className="mt-4 text-sm leading-6 text-[#17243B]/60">
                Learning opportunities for Senior Secondary School, university, and professional learners.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#17243B]">Explore</h3>
              <ul className="mt-4 space-y-3 text-sm text-[#17243B]/65">
                <li><a href="#learning-paths" className="hover:text-[#20A99A]">Learning paths</a></li>
                <li><a href="#about" className="hover:text-[#20A99A]">About Learnpedia</a></li>
                <li><a href="#why-learnpedia" className="hover:text-[#20A99A]">Student stories</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#17243B]">Your account</h3>
              <ul className="mt-4 space-y-3 text-sm text-[#17243B]/65">
                <li><Link href="/login" className="hover:text-[#20A99A]">Log in</Link></li>
                <li><Link href="/register" className="hover:text-[#20A99A]">Create an account</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#17243B]">Need help?</h3>
              <p className="mt-4 text-sm leading-6 text-[#17243B]/65">Questions about learning with us? Get in touch.</p>
              <a href="https://wa.me/2349030578183?text=Hello%2C%20I%20would%20like%20to%20know%20more%20about%20Learnpedia." target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#20A99A] hover:text-[#17243B]">
                Contact Learnpedia <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
          <div className="flex flex-col gap-3 pt-6 text-xs text-[#17243B]/50 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Learnpedia. All rights reserved.</p>
            <p>Learn with purpose. Grow at every stage.</p>
          </div>
        </div>
      </footer>
      <WhatsAppFloat />
    </main>
  );
}
