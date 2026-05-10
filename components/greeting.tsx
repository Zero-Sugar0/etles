import { motion } from "framer-motion";
import { Bot, Clock3, PlugZap } from "lucide-react";

export const Greeting = () => {
  const highlights = [
    { icon: Bot, label: "Delegate agent work" },
    { icon: PlugZap, label: "Connect tools" },
    { icon: Clock3, label: "Schedule follow-ups" },
  ];

  return (
    <div
      className="mx-auto flex size-full max-w-3xl flex-col justify-center px-4 pt-8 pb-4 md:px-8"
      key="overview"
    >
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1.5 font-medium text-muted-foreground text-xs shadow-xs backdrop-blur"
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.35 }}
      >
        <span className="size-1.5 rounded-full bg-primary" />
        Etles workspace is ready
      </motion.div>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-balance font-semibold text-3xl tracking-normal md:text-5xl"
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.45 }}
      >
        What should we move forward today?
      </motion.div>
      <motion.p
        animate={{ opacity: 1, y: 0 }}
        className="mt-3 max-w-2xl text-muted-foreground text-sm leading-6 md:text-base"
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.55 }}
      >
        Ask a question, hand off a task to an agent, or turn a loose idea into a
        concrete next step.
      </motion.p>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 grid gap-2 sm:grid-cols-3"
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.65 }}
      >
        {highlights.map(({ icon: Icon, label }) => (
          <div
            className="flex items-center gap-2 rounded-lg border border-border/70 bg-card/65 px-3 py-2 text-muted-foreground text-xs shadow-xs backdrop-blur"
            key={label}
          >
            <Icon className="size-3.5 text-primary" />
            <span>{label}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
};
