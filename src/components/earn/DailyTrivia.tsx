import { useEffect, useState } from "react";
import { Brain, CheckCircle2, XCircle } from "lucide-react";

import { Chip, IconTile, VaultCard } from "@/components/vault/VaultCard";
import { useNow } from "@/hooks/use-earn";
import { formatCountdown } from "@/lib/earning";
import { dailyQuestions, nextTriviaReset, triviaDayKey } from "@/lib/trivia";
import { cn } from "@/lib/utils";

const storageKey = (day: string) => `wfr_trivia_${day}`;

export function DailyTrivia() {
  const now = useNow();
  const day = now ? triviaDayKey(now) : "";
  const [answers, setAnswers] = useState<(number | null)[]>([null, null, null]);

  useEffect(() => {
    if (!day) return;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey(day)) ?? "null");
      setAnswers(Array.isArray(saved) && saved.length === 3 ? saved : [null, null, null]);
    } catch {
      setAnswers([null, null, null]);
    }
  }, [day]);

  if (!now) return <VaultCard className="h-72 skeleton-shimmer" />;

  const questions = dailyQuestions(now);
  const answered = answers.filter((a) => a !== null).length;
  const score = questions.filter((q, i) => answers[i] === q.answer).length;

  const pick = (qi: number, oi: number) => {
    if (answers[qi] !== null) return;
    const next = answers.map((a, i) => (i === qi ? oi : a));
    setAnswers(next);
    try {
      localStorage.setItem(storageKey(day), JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <VaultCard className="animate-rise p-4">
      <div className="flex items-center gap-3">
        <IconTile tone="cyan">
          <Brain />
        </IconTile>
        <div className="flex-1">
          <h3 className="font-display font-semibold">Daily Roblox trivia</h3>
          <p className="text-xs text-muted-foreground">New questions in {formatCountdown(nextTriviaReset(now) - now)}</p>
        </div>
        <Chip tone={answered === 3 ? "emerald" : "muted"}>
          {answered === 3 ? `${score}/3` : `${answered}/3`}
        </Chip>
      </div>

      <ol className="mt-4 space-y-4">
        {questions.map((q, qi) => {
          const chosen = answers[qi];
          return (
            <li key={q.q}>
              <p className="text-sm font-semibold">
                <span className="mr-1.5 font-mono text-xs text-cyan">Q{qi + 1}</span>
                {q.q}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {q.options.map((opt, oi) => {
                  const isAnswer = oi === q.answer;
                  const isChosen = chosen === oi;
                  const revealed = chosen !== null;
                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={revealed}
                      onClick={() => pick(qi, oi)}
                      className={cn(
                        "flex min-h-10 cursor-pointer items-center justify-between gap-1 rounded-lg px-2.5 py-2 text-left text-xs ring-1 transition-colors disabled:cursor-default",
                        !revealed && "bg-vault-inner ring-vault-rim hover:ring-cyan/50",
                        revealed && isAnswer && "bg-emerald/12 text-emerald ring-emerald/40",
                        revealed && isChosen && !isAnswer && "bg-destructive/10 text-destructive ring-destructive/40",
                        revealed && !isAnswer && !isChosen && "bg-vault-inner text-muted-foreground ring-vault-rim opacity-60",
                      )}
                    >
                      <span>{opt}</span>
                      {revealed && isAnswer ? <CheckCircle2 className="size-3.5 shrink-0" /> : null}
                      {revealed && isChosen && !isAnswer ? <XCircle className="size-3.5 shrink-0" /> : null}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>

      {answered === 3 ? (
        <p className="vault-well mt-4 p-3 text-center text-sm">
          {score === 3 ? "Perfect score! " : score === 0 ? "Tough round. " : "Nice work. "}
          You got <span className="font-semibold text-emerald">{score} of 3</span>. Come back tomorrow for new questions.
        </p>
      ) : null}
    </VaultCard>
  );
}
