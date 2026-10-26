import React from 'react';
import { Target, Check, Lock, Sparkles, Trophy } from 'lucide-react';

interface CommissionMilestonesProps {
  currentVolume: number;
  currentTier: string;
  className?: string;
}

export interface TierTarget {
  stage: number;
  name: string;
  threshold: number;
  bonus: number;
  desc: string;
}

const TIER_TARGETS: TierTarget[] = [
  { stage: 1, name: 'Starter', threshold: 0, bonus: 0, desc: 'Base Level' },
  { stage: 2, name: 'Bronze', threshold: 100000, bonus: 1000, desc: '100k ETB' },
  { stage: 3, name: 'Silver', threshold: 250000, bonus: 2500, desc: '250k ETB' },
  { stage: 4, name: 'Gold Champion', threshold: 500000, bonus: 6000, desc: '500k ETB' },
];

export const CommissionMilestones: React.FC<CommissionMilestonesProps> = ({
  currentVolume,
  currentTier,
  className = '',
}) => {
  // Clean tier display: avoid duplicate word like "Bronze Performer Performer Tier"
  const cleanTierDisplay =
    currentTier.toLowerCase().includes('performer') ||
    currentTier.toLowerCase().includes('tier')
      ? currentTier.toLowerCase().includes('tier')
        ? currentTier
        : `${currentTier} Tier`
      : `${currentTier} Performer Tier`;

  // Find next tier target
  const nextTier =
    TIER_TARGETS.find((t) => t.threshold > currentVolume) ||
    TIER_TARGETS[TIER_TARGETS.length - 1];

  const targetDiff = Math.max(0, nextTier.threshold - currentVolume);
  const activeTargetStage = nextTier.stage;

  // Calculate tier span progress
  const prevThreshold = TIER_TARGETS[activeTargetStage - 2]?.threshold ?? 0;
  const span = nextTier.threshold - prevThreshold;
  const spanAchieved = Math.max(0, currentVolume - prevThreshold);
  const tierSpanPercent =
    span > 0 ? Math.min(100, Math.round((spanAchieved / span) * 100)) : 100;

  // Track fill percentage
  const trackFillPercent = Math.min(100, Math.max(6, Math.round((currentVolume / 500000) * 100)));

  return (
    <div
      className={`bg-white dark:bg-[#111C2D] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-3.5 sm:p-4 shadow-2xs flex flex-col justify-between space-y-3 ${className}`}
    >
      {/* ── 1. Header: Icon + Title + Tier Badge (Black bg with white text & emerald icon) ── */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-black dark:bg-black border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-xs">
            <Target className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-tight">
              Commission Milestones
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">
              Monthly sales tier achievements
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black dark:bg-black border border-emerald-500/40 text-white text-[10px] sm:text-xs font-bold shadow-2xs">
          <Trophy className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{cleanTierDisplay}</span>
        </div>
      </div>

      {/* ── 2. Interconnected Visual Pipeline Stepper Track ── */}
      <div className="relative px-3 py-1">
        {/* Background Conduit Track */}
        <div className="absolute top-1/2 left-7 right-7 -translate-y-1/2 h-1 bg-slate-100 dark:bg-slate-800 rounded-full pointer-events-none" />

        {/* Glowing Active Track Fill */}
        <div
          className="absolute top-1/2 left-7 -translate-y-1/2 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 rounded-full transition-all duration-700 shadow-[0_0_8px_rgba(16,185,129,0.5)] pointer-events-none"
          style={{ width: `${Math.min(86, (trackFillPercent * 86) / 100)}%` }}
        />

        {/* 4 Pipeline Step Nodes */}
        <div className="relative flex items-center justify-between z-10">
          {TIER_TARGETS.map((tier) => {
            const isCompleted = currentVolume >= tier.threshold;
            const isCurrent = tier.stage === activeTargetStage && targetDiff > 0;

            return (
              <div key={tier.stage} className="flex flex-col items-center group">
                <div
                  className={`size-7 sm:size-7.5 rounded-full flex items-center justify-center font-mono font-bold text-[10px] transition-all shadow-xs ${
                    isCompleted
                      ? 'bg-black dark:bg-black border-2 border-emerald-500 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)] ring-2 ring-emerald-500/20'
                      : isCurrent
                      ? 'bg-black dark:bg-black border-2 border-amber-500 text-amber-400 ring-4 ring-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                      : 'bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-400'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="size-3.5 stroke-[3] text-emerald-400" />
                  ) : isCurrent ? (
                    <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
                  ) : (
                    <Lock className="size-3 text-slate-400" />
                  )}
                </div>
                <span
                  className={`text-[9px] font-mono uppercase tracking-wider mt-1 transition-colors ${
                    isCompleted
                      ? 'text-emerald-500 dark:text-emerald-400 font-bold'
                      : isCurrent
                      ? 'text-slate-900 dark:text-white font-bold'
                      : 'text-slate-400'
                  }`}
                >
                  Stage 0{tier.stage}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 3. Four Elevated Gamified Stage Cards (2x2 Grid) ── */}
      <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
        {TIER_TARGETS.map((tier) => {
          const isCompleted = currentVolume >= tier.threshold;
          const isCurrent = tier.stage === activeTargetStage && targetDiff > 0;

          return (
            <div
              key={tier.stage}
              className={`p-2.5 sm:p-3 rounded-xl border transition-all ${
                isCurrent
                  ? 'bg-white dark:bg-[#111C2D] border-emerald-500/80 shadow-[0_0_15px_-4px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500/25'
                  : isCompleted
                  ? 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800'
                  : 'bg-slate-50/40 dark:bg-slate-900/20 border-slate-200/60 dark:border-slate-800/60 opacity-75'
              }`}
            >
              {/* Card Header: STAGE 0X & Status Pill (Black bg with white text & colored icon) */}
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-mono uppercase tracking-wider font-bold text-slate-400">
                  STAGE 0{tier.stage}
                </span>
                {isCompleted ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8.5px] font-bold bg-black dark:bg-black text-white border border-emerald-500/40">
                    <Check className="size-2.5 stroke-[3] text-emerald-400" /> Unlocked
                  </span>
                ) : isCurrent ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8.5px] font-bold bg-black dark:bg-black text-white border border-amber-500/40">
                    <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" /> Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8.5px] font-bold bg-black dark:bg-black text-slate-300 border border-slate-700/60">
                    <Lock className="size-2.5 text-slate-400" /> Locked
                  </span>
                )}
              </div>

              {/* Tier Name & Threshold */}
              <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                {tier.name}
              </div>
              <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                {tier.desc}
              </div>

              {/* Reward Badge (Black bg with white text & emerald icon if needed) */}
              <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px]">
                <span className="text-slate-400 font-medium">Reward:</span>
                <span
                  className={`font-bold font-mono px-1.5 py-0.5 rounded-md text-[9.5px] ${
                    isCompleted || isCurrent
                      ? 'bg-black dark:bg-black text-white border border-emerald-500/40 flex items-center gap-1'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  }`}
                >
                  {(isCompleted || isCurrent) && tier.bonus > 0 && (
                    <Sparkles className="size-2.5 text-emerald-400" />
                  )}
                  <span>{tier.bonus > 0 ? `+${tier.bonus.toLocaleString()} ETB` : 'Standard'}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 4. Pacing Bottom Progress Footer ── */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          {targetDiff > 0 ? (
            <>
              <span className="text-slate-600 dark:text-slate-400 text-[11px]">
                <strong className="text-slate-900 dark:text-white font-mono font-bold">
                  {targetDiff.toLocaleString()} ETB
                </strong>{' '}
                to {nextTier.name}
              </span>
              <span className="font-bold text-white text-[11px] flex items-center gap-1 font-mono bg-black dark:bg-black px-2 py-0.5 rounded-md border border-emerald-500/40">
                <Sparkles className="size-3 text-emerald-400" />
                <span>+{nextTier.bonus.toLocaleString()} ETB reward</span>
              </span>
            </>
          ) : (
            <span className="text-white font-bold text-[11px] flex items-center gap-1 font-mono bg-black dark:bg-black px-2 py-0.5 rounded-md border border-emerald-500/40">
              <Sparkles className="size-3 text-emerald-400" />
              <span>Maximum tier unlocked this month!</span>
            </span>
          )}
        </div>

        {/* Micro Pacing Progress Bar */}
        {targetDiff > 0 && (
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500 shadow-xs"
              style={{ width: `${tierSpanPercent}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
