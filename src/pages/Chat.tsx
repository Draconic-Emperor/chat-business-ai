import { useCallback, useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Bot, Send } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const SUGGESTIONS = [
  "Nimeuza 2 shirts kwa 800",
  "I bought 10 cokes at 40 each",
  "profit today",
  "sales this week",
  "John alinipa 500",
  "John owes me 300",
  "inventory",
  "low stock",
];

/** Smart follow-up suggestions shown under the latest assistant reply. */
function suggestionsFor(reply: string): string[] {
  if (/Debt recorded|owes/i.test(reply)) {
    return ["show debts", "customer balances", "top customers"];
  }
  if (/Payment received|balance has been reduced/i.test(reply)) {
    return ["customer balances", "show debts", "sales today"];
  }
  if (/Sale recorded|Purchase recorded|Expense recorded/i.test(reply)) {
    return ["show profit", "inventory", "sales today"];
  }
  if (/Low stock alert|low-stock/i.test(reply)) {
    return ["low stock", "inventory value", "profit today"];
  }
  if (/Inventory|remaining in inventory/i.test(reply)) {
    return ["low stock", "inventory value", "sales today"];
  }
  if (/Profit:/i.test(reply)) {
    return ["sales this week", "expenses this month", "generate report"];
  }
  if (/customer/i.test(reply)) {
    return ["top customers", "show debts", "customer balances"];
  }
  if (/report/i.test(reply)) {
    return ["monthly report", "profit this month"];
  }
  return ["profit today", "inventory", "show customers"];
}

export default function Chat() {
  const messages = useQuery(api.chatStore.list, { limit: 100 });
  const send = useAction(api.chat.send);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages?.length, sending]);

  const handleSend = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const t = text.trim();
      if (!t || sending) return;
      setText("");
      setSending(true);
      try {
        await send({ message: t });
      } catch (err) {
        toast.error("Message failed", {
          description: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setSending(false);
        inputRef.current?.focus();
      }
    },
    [text, sending, send],
  );

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem-4rem)] max-w-3xl flex-col lg:h-[calc(100vh-5rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/60 px-1 pb-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Bot className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Smart Hustle AI</p>
          <p className="text-[11px] text-primary">
            ● online — understands English, Kiswahili &amp; Sheng
          </p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto py-4 pr-1">
        <div className="mx-auto max-w-md rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-center text-xs leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground">Karibu 👋</p>
          <p className="mt-1">
            Record sales, expenses, purchases, debts and payments by chatting. Try{" "}
            <span className="text-primary">“Nimeuza 3 shirts kwa 1500”</span> or{" "}
            <span className="text-primary">“profit today”</span>.
          </p>
        </div>

        {messages === undefined ? (
          <div className="flex justify-center py-8">
            <Spinner className="size-6 text-primary" />
          </div>
        ) : (
          messages.map((m, idx) => {
            const isUser = m.role === "user";
            const isLast = idx === messages.length - 1;
            const chips = !isUser && isLast && !sending ? suggestionsFor(m.content) : [];
            return (
              <div key={m._id}>
                <div className={isUser ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={
                      isUser
                        ? "bubble-in max-w-[85%] rounded-2xl border border-[#34D399] bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm sm:max-w-[70%]"
                        : "bubble-out max-w-[95%] rounded-2xl border border-border bg-card px-4 py-2.5 text-sm text-card-foreground shadow-sm sm:max-w-[75%]"
                    }
                  >
                    <p className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
                    <p
                      className={`mt-1 text-right text-[10px] ${
                        isUser ? "text-white/70" : "text-muted-foreground"
                      }`}
                    >
                      {formatDateTime(m.createdAt).split(", ")[1] ?? ""}
                    </p>
                  </div>
                </div>
                {chips.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 pl-1">
                    {chips.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setText(s);
                          inputRef.current?.focus();
                        }}
                        className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] text-primary transition-colors hover:border-primary hover:bg-primary/20"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}

        {sending && (
          <div className="flex justify-start">
            <div className="bubble-out rounded-2xl border border-border bg-card px-4 py-3">
              <Spinner className="size-4 text-primary" />
            </div>
          </div>
        )}
      </div>

      {/* Suggestions */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setText(s);
              inputRef.current?.focus();
            }}
            className="shrink-0 whitespace-nowrap rounded-full border border-border/70 bg-card/80 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => void handleSend(e)}
        className="flex items-end gap-2 border-t border-border/60 pt-3"
      >
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder="Type to record or ask… e.g. “Nimeuza 2 shirts kwa 800”"
          className="max-h-32 min-h-[44px] w-full flex-1 resize-none rounded-2xl border border-input bg-card px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/25"
        />
        <Button
          type="submit"
          size="icon"
          disabled={sending || !text.trim()}
          className="mb-0.5 size-11 shrink-0 rounded-2xl"
        >
          {sending ? <Spinner className="size-5" /> : <Send className="size-5" />}
        </Button>
      </form>
    </div>
  );
}
