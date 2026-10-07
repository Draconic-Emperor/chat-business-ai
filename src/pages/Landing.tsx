import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  MessageSquareText,
  Package,
  ShieldCheck,
  Smartphone,
  Users,
  Wallet,
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";

const FEATURES = [
  {
    icon: MessageSquareText,
    title: "Chat-first bookkeeping",
    body: "Type \"I sold 3 shirts for KES 1,500\" and it's recorded — sales, expenses, purchases, debts. English, Kiswahili or Sheng.",
  },
  {
    icon: Package,
    title: "Inventory that updates itself",
    body: "Purchases top up stock, sales bring it down, and low-stock alerts warn you before you promise a customer what you don't have.",
  },
  {
    icon: Users,
    title: "Customer debts (deni) tracked",
    body: "\"John owes me 500\" keeps his balance, and his payment clears it. Every customer's spending history stays put.",
  },
  {
    icon: BarChart3,
    title: "Real profit, not guesswork",
    body: "Daily, weekly and monthly charts calculated live from your own transactions — no placeholders, no estimates.",
  },
];

const STEPS = [
  {
    icon: MessageSquareText,
    title: "1 · Chat to record",
    body: "\"Nimeuza mashati matatu kwa 1500\" or \"Paid transport 300\" — in the chat, or on the go.",
  },
  {
    icon: Bot,
    title: "2 · AI does the books",
    body: "Every message becomes a proper record: sale, expense, purchase, debt or payment — with stock updates.",
  },
  {
    icon: Wallet,
    title: "3 · Know your position",
    body: "Dashboard, analytics and one-tap PDF reports show exactly where the business stands.",
  },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <Toaster position="top-center" richColors />

      {/* Backdrop glow + dotted grid */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 grid-backdrop opacity-40" />
        <div className="absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute right-0 top-1/3 h-72 w-72 rounded-full bg-accent/15 blur-[100px]" />
      </div>

      {/* Nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Bot className="size-5" />
          </div>
          <span className="text-base font-bold tracking-tight">
            Smart Hustle <span className="text-primary">AI</span>
          </span>
        </div>
        <nav className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/auth?returnTo=%2Fdashboard")}
            className="rounded-full px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => navigate("/auth?returnTo=%2Fdashboard")}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-105"
          >
            Start free
          </button>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              🇰🇪 Built for Kenyan hustles — kiosks, dukas, salons, online sellers
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              Run your entire business{" "}
              <span className="text-primary glow-text">through chat</span>.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Record sales, expenses, stock, customers and debts just by
              typing. Smart Hustle AI turns your messages into real records —
              and turns them into profit you can see.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() => navigate("/auth?returnTo=%2Fdashboard")}
                className="glow-primary inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground sm:text-base"
              >
                Start free with your email <ArrowRight className="size-4" />
              </motion.button>
              <button
                type="button"
                onClick={() => navigate("/auth?returnTo=%2Fchat")}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted sm:text-base"
              >
                <MessageSquareText className="size-4 text-primary" />
                See the assistant
              </button>
            </div>
            <div className="mt-6 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-primary" /> Sign-in codes sent to your email
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Smartphone className="size-4 text-primary" /> Works on any phone
              </span>
            </div>
          </motion.div>

          {/* Phone mockup: WhatsApp-like chat */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
            className="relative mx-auto w-full max-w-sm"
          >
            <div className="glass rounded-3xl p-3 shadow-2xl">
              <div className="rounded-2xl border border-border/50 bg-card/80">
                <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
                  <div className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Bot className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Smart Hustle AI</p>
                    <p className="text-[11px] text-primary">● online</p>
                  </div>
                </div>
                <div className="space-y-3 px-4 py-5 text-sm">
                  <div className="bubble-in ml-auto max-w-[85%] bg-secondary px-3.5 py-2.5 text-secondary-foreground w-fit">
                    Nimeuza mashati matatu kwa 1500
                  </div>
                  <div className="bubble-out mr-auto max-w-[85%] bg-primary/15 px-3.5 py-2.5 text-primary-foreground w-fit">
                    ✅ Sale recorded: 3 × mashati —{" "}
                    <span className="font-semibold text-primary">KES 1,500</span>
                    <br />
                    Stock left: 17.
                  </div>
                  <div className="bubble-in ml-auto max-w-[85%] bg-secondary px-3.5 py-2.5 text-secondary-foreground w-fit">
                    John owes me 500
                  </div>
                  <div className="bubble-out mr-auto max-w-[85%] bg-primary/15 px-3.5 py-2.5 text-primary-foreground w-fit">
                    📝 Debt recorded: John owes KES 500.
                  </div>
                  <div className="bubble-in ml-auto max-w-[85%] bg-secondary px-3.5 py-2.5 text-secondary-foreground w-fit">
                    profit today
                  </div>
                  <div className="bubble-out mr-auto max-w-[85%] bg-primary/15 px-3.5 py-2.5 text-primary-foreground w-fit">
                    📈 Today: sales KES 2,300 · profit KES 780
                  </div>
                  <p className="pt-1 text-center text-[10px] text-muted-foreground">
                    Your data. Your business. No fake numbers.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
          Everything a real business needs —{" "}
          <span className="text-primary">nothing fake</span>
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, body }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              className="group glass rounded-2xl p-6 transition-transform duration-200 hover:-translate-y-1"
            >
              <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary transition-transform group-hover:scale-110">
                <Icon className="size-5" />
              </div>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {body}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mt-16 rounded-3xl border border-primary/25 bg-primary/5 p-8 sm:p-12">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">
            From kipchumba arithmetic to clean books in 3 steps
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="rounded-2xl border border-border/50 bg-card/60 p-5"
              >
                <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Icon className="size-5" />
                </div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pt-16 sm:px-6">
        <div className="glass flex flex-col items-center gap-5 rounded-3xl p-10 text-center">
          <div className="flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-primary" /> Every number from
              your own records
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-primary" /> Swahili &amp; Sheng
              understood
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-primary" /> Free to start
            </span>
          </div>
          <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">
            Your hustle deserves better than a{" "}
            <span className="text-primary">exercise book</span>.
          </h2>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.96 }}
            type="button"
            onClick={() => navigate("/auth?returnTo=%2Fdashboard")}
            className="glow-primary inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-base font-semibold text-primary-foreground"
          >
            Open my Smart Hustle <ArrowRight className="size-4" />
          </motion.button>
          <p className="text-xs text-muted-foreground">
            No card needed · Sign in with your email · Your data stays yours
          </p>
        </div>
      </section>

      <footer className="relative z-10 mx-auto max-w-6xl px-4 pb-10 pt-12 text-center text-xs text-muted-foreground sm:px-6">
        Smart Hustle AI — run your business through chat. Karibu ndani. 🇰🇪
      </footer>
    </div>
  );
}
