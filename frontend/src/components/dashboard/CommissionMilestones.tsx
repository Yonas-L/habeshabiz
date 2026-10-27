import React from 'react';
import { Trophy, CheckCircle2, Circle, Target } from 'lucide-react';

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
}

const TIER_TARGETS: TierTarget[] = [
  { stage: 1, name: 'Starter', threshold: 0, bonus: 0 },
  { stage: 2, name: 'Bronze', threshold: 100000, bonus: 1000 },
  { stage: 3, name: 'Silver', threshold: 250000, bonus: 2500 },
  { stage: 4, name: 'Gold Champion', threshold: 500000, bonus: 6000 },
];

export const CommissionMilestones: React.FC<CommissionMilestonesProps> = ({
  currentVolume,
  currentTier,
  className = '',
}) => {
  // Normalize tier name: remove redundant words like "Performer" or "Tier" to avoid duplication
  const cleanTierName = currentTier
    .replace(/performer/gi, '')
    .replace(/tier/gi, '')
    .trim();
  const displayTier = cleanTierName ? `${cleanTierName} Tier` : 'Starter Tier';

  // Find next tier target
  const nextTier = TIER_TARGETS.find((t) => t.threshold > currentVolume);
  const targetDiff = nextTier ? Math.max(0, nextTier.threshold - currentVolume) : 0;

  // Calculate pacing percentage toward the next tier
  let progressPercent = 100;
  if (nextTier) {
    const prevThreshold = TIER_TARGETS[nextTier.stage - 2]?.threshold ?? 0;
    const span = nextTier.threshold - prevThreshold;
    const achievedInSpan = Math.max(0, currentVolume - prevThreshold);
    progressPercent = span > 0 ? Math.min(100, Math.max(0, Math.round((achievedInSpan / span) * 100))) : 0;
  }

  return (
    <div
      className={`bg-white dark:bg-[#111C2D] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-4 shadow-2xs flex flex-col justify-between space-y-3.5 ${className}`}
    >
      {/* ── 1. Header: Clean Icon, Title, and Current Tier Badge ── */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Trophy className="w-4 h-4 stroke-[2]" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-tight">
              Commission Tiers
            </h3>
            <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
              Monthly targets & bonus schedule
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black dark:bg-black border border-emerald-500/40 text-white text-[11px] font-bold shadow-2xs">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          <span>{displayTier}</span>
        </div>
      </div>

      {/* ── 2. Pacing Strip: Minimal & Direct ── */}
      <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 space-y-2">
        <div className="flex items-center justify-between text-xs">
          {nextTier ? (
            <>
              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Next Target:</span>
                <strong className="text-slate-900 dark:text-white font-bold">{nextTier.name}</strong>
              </div>
              <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                +{nextTier.bonus.toLocaleString()} ETB Bonus
              </div>
            </>
          ) : (
            <div className="text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span>Highest commission tier unlocked this month!</span>
            </div>
          )}
        </div>

        {nextTier && (
          <>
            <div className="w-full bg-slate-200/80 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 dark:bg-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10.5px] text-slate-500 dark:text-slate-400 font-mono">
              <span>{targetDiff.toLocaleString()} ETB remaining</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{progressPercent}%</span>
            </div>
          </>
        )}
      </div>

      {/* ── 3. Four Tiers Progression Ladder ── */}
      <div className="space-y-1.5">
        {TIER_TARGETS.map((tier) => {
          const isCompleted = currentVolume >= tier.threshold;
          const isTarget = nextTier?.stage === tier.stage;

          return (
            <div
              key={tier.stage}
              className={`px-3 py-2 sm:py-2.5 rounded-xl text-xs flex items-center justify-between transition-colors border ${
                isTarget
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/40 text-slate-900 dark:text-white shadow-2xs'
                  : isCompleted
                  ? 'bg-slate-50/40 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800/60 text-slate-800 dark:text-slate-200'
                  : 'bg-transparent border-transparent text-slate-400 dark:text-slate-500 opacity-60'
              }`}
            >
              {/* Left: Status Icon + Tier Name & Threshold */}
              <div className="flex items-center gap-2.5 min-w-0">
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                ) : isTarget ? (
                  <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                )}

                <div className="min-w-0 truncate">
                  <span className="font-bold text-slate-900 dark:text-white block sm:inline">
                    {tier.name}
                  </span>
                  <span className="text-[10.5px] font-mono text-slate-400 block sm:inline sm:ml-2">
                    {tier.threshold > 0 ? `${tier.threshold.toLocaleString()} ETB` : 'Base Level'}
                  </span>
                </div>
              </div>

              {/* Right: Bonus Amount & Status */}
              <div className="flex items-center gap-3 shrink-0 text-right">
                <div className="font-mono font-bold text-xs">
                  {tier.bonus > 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      +{tier.bonus.toLocaleString()} ETB
                    </span>
                  ) : (
                    <span className="text-slate-400 font-normal text-[11px]">Standard</span>
                  )}
                </div>

                <div className="min-w-[64px] text-right">
                  {isCompleted ? (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      Unlocked
                    </span>
                  ) : isTarget ? (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-black dark:bg-black text-white border border-emerald-500/40 inline-block">
                      Target
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">
                      Locked
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
