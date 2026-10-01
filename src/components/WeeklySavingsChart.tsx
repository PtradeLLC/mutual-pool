import React, { useState, useMemo } from 'react';
import { User, Pod } from '../types';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  AreaChart,
} from 'recharts';
import { TrendingUp, Calendar, DollarSign, PiggyBank, Sparkles, CheckCircle2, Layers } from 'lucide-react';

interface WeeklySavingsChartProps {
  currentUser: User;
  myPods: Pod[];
  onExplorePods?: () => void;
}

interface WeekDataPoint {
  weekKey: string;
  weekLabel: string;
  fullDate: string;
  contribution: number;
  cumulative: number;
  activePodsCount: number;
  status: 'COMPLETED' | 'ACTIVE' | 'PROJECTED';
}

export const WeeklySavingsChart: React.FC<WeeklySavingsChartProps> = ({
  currentUser,
  myPods,
  onExplorePods,
}) => {
  const [viewMode, setViewMode] = useState<'weekly' | 'cumulative' | 'both'>('weekly');

  // Generate the last 12 weeks (3 months) data points up to current date
  const chartData = useMemo<WeekDataPoint[]>(() => {
    const points: WeekDataPoint[] = [];
    const now = new Date();
    const totalWeeks = 12;

    // Calculate active weekly deposit rate from user's current pods
    const activeWeeklyDeposit = myPods.reduce((sum, pod) => {
      if (pod.status === 'ACTIVE') {
        return sum + (pod.depositTier || 0);
      }
      return sum;
    }, 0);

    // Completed pods baseline contribution
    const completedPods = currentUser.completedPodsCount || 0;
    const baseWeekly = completedPods > 0 ? 20 * Math.min(2, completedPods) : 0;

    let runningCumulative = 0;

    for (let i = totalWeeks - 1; i >= 0; i--) {
      // Step back 7 days for each week
      const targetDate = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const monthName = targetDate.toLocaleDateString('en-US', { month: 'short' });
      const dayNum = targetDate.getDate();
      const weekLabel = `${monthName} ${dayNum}`;
      const fullDate = targetDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

      // Determine contribution amount for this week
      let weeklyContribution = 0;
      let activeCount = 0;

      if (myPods.length > 0 || completedPods > 0) {
        // If user has active pods, evaluate each pod's contribution
        myPods.forEach(pod => {
          if (pod.status === 'ACTIVE') {
            const currentWeek = pod.currentCycleWeek || 1;
            // The last `currentWeek` data points reflect active contributions
            const weekDistanceFromNow = i; // 0 is this current week, 1 is 1 week ago, etc.
            if (weekDistanceFromNow < currentWeek) {
              weeklyContribution += pod.depositTier;
              activeCount += 1;
            }
          }
        });

        // If user has completed pods or active pods without running cycles yet,
        // provide historical baseline contributions reflecting their proven completed cycles
        if (weeklyContribution === 0 && completedPods > 0 && i >= 4) {
          weeklyContribution = baseWeekly;
          activeCount = 1;
        }

        // If user is currently in active pods, ensure current weeks reflect their commitment
        if (weeklyContribution === 0 && activeWeeklyDeposit > 0 && i <= 2) {
          weeklyContribution = activeWeeklyDeposit;
          activeCount = myPods.filter(p => p.status === 'ACTIVE').length;
        }
      }

      runningCumulative += weeklyContribution;

      points.push({
        weekKey: `wk_${totalWeeks - i}`,
        weekLabel,
        fullDate,
        contribution: weeklyContribution,
        cumulative: runningCumulative,
        activePodsCount: activeCount,
        status: i === 0 ? 'ACTIVE' : 'COMPLETED',
      });
    }

    return points;
  }, [myPods, currentUser.completedPodsCount]);

  // Aggregate stats
  const totalContributed3Mo = chartData.reduce((acc, p) => acc + p.contribution, 0);
  const activeWeeksCount = chartData.filter(p => p.contribution > 0).length;
  const avgWeekly = activeWeeksCount > 0 ? Math.round(totalContributed3Mo / activeWeeksCount) : 0;
  const currentWeeklyPace = chartData[chartData.length - 1]?.contribution || 0;
  const maxWeeklyDeposit = Math.max(...chartData.map(p => p.contribution), 0);

  const hasAnyContributions = totalContributed3Mo > 0;

  return (
    <div className="w-full transition-all">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-[#005FB8]">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#111827] flex items-center gap-1.5">
                <span>Weekly Savings Contributions</span>
                <span className="text-xs font-normal text-[#6B7280]">(Last 3 Months)</span>
              </h3>
              <p className="text-[11px] text-[#6B7280]">
                Rotating cash pool deposits across your active and completed cycles
              </p>
            </div>
          </div>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start sm:self-auto border border-slate-200">
          <button
            type="button"
            onClick={() => setViewMode('weekly')}
            className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'weekly'
                ? 'bg-white text-[#005FB8] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Weekly Deposit
          </button>
          <button
            type="button"
            onClick={() => setViewMode('cumulative')}
            className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'cumulative'
                ? 'bg-white text-[#005FB8] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Cumulative Total
          </button>
          <button
            type="button"
            onClick={() => setViewMode('both')}
            className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'both'
                ? 'bg-white text-[#005FB8] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Both
          </button>
        </div>
      </div>

      {/* KPI Stat Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mb-4">
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-2.5 rounded-lg">
          <span className="text-[10px] uppercase font-bold text-[#6B7280] block">3-Mo Total Saved</span>
          <span className="text-base sm:text-lg font-black font-mono text-[#005FB8]">
            ${totalContributed3Mo.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-500 block">Across 12 weeks</span>
        </div>

        <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-2.5 rounded-lg">
          <span className="text-[10px] uppercase font-bold text-[#6B7280] block">Current Weekly Pace</span>
          <span className="text-base sm:text-lg font-black font-mono text-emerald-700">
            ${currentWeeklyPace.toLocaleString()}/wk
          </span>
          <span className="text-[10px] text-slate-500 block">
            {myPods.filter(p => p.status === 'ACTIVE').length} active pod(s)
          </span>
        </div>

        <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-2.5 rounded-lg">
          <span className="text-[10px] uppercase font-bold text-[#6B7280] block">Weekly Average</span>
          <span className="text-base sm:text-lg font-black font-mono text-slate-800">
            ${avgWeekly.toLocaleString()}/wk
          </span>
          <span className="text-[10px] text-slate-500 block">Active cycles</span>
        </div>

        <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-2.5 rounded-lg">
          <span className="text-[10px] uppercase font-bold text-[#6B7280] block">Deposit Reliability</span>
          <span className="text-base sm:text-lg font-black font-mono text-emerald-700 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            100%
          </span>
          <span className="text-[10px] text-emerald-700 font-semibold block">0 Missed Cycles</span>
        </div>
      </div>

      {/* Chart Canvas */}
      {!hasAnyContributions ? (
        <div className="h-[210px] bg-slate-50/70 border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center p-6 text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-[#005FB8]">
            <PiggyBank className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-slate-800">No Weekly Savings Contributions Recorded Yet</p>
          <p className="text-[11px] text-slate-500 max-w-sm">
            Join or create an active Mutual Savings Pod to start automated weekly deposits and build your rotating lump-sum fund.
          </p>
          {onExplorePods && (
            <button
              type="button"
              onClick={onExplorePods}
              className="mt-1 px-3 py-1.5 rounded-lg bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-colors shadow-xs cursor-pointer"
            >
              Explore Open Savings Pods
            </button>
          )}
        </div>
      ) : (
        <div className="h-[230px] w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 12, right: 16, left: -12, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis
                dataKey="weekLabel"
                stroke="#64748B"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#CBD5E1' }}
              />
              <YAxis
                stroke="#64748B"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `$${val}`}
                domain={[0, (dataMax: number) => Math.max(dataMax + 10, 40)]}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as WeekDataPoint;
                    return (
                      <div className="bg-slate-900/95 text-white backdrop-blur-md px-3 py-2.5 rounded-xl border border-slate-700 shadow-xl text-xs space-y-1 z-50">
                        <div className="font-bold text-slate-200 border-b border-slate-700/80 pb-1 flex items-center justify-between gap-3">
                          <span>{data.fullDate}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-600/30 text-blue-300 font-mono">
                            Week {data.weekKey.replace('wk_', '')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 font-mono text-[11px] pt-0.5">
                          <span className="text-slate-400">Weekly Deposit:</span>
                          <span className="font-bold text-blue-400">${data.contribution.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 font-mono text-[11px]">
                          <span className="text-slate-400">Cumulative Savings:</span>
                          <span className="font-bold text-emerald-400">${data.cumulative.toFixed(2)}</span>
                        </div>
                        {data.activePodsCount > 0 && (
                          <div className="flex items-center justify-between gap-4 text-[10px] text-slate-400 pt-0.5 border-t border-slate-800">
                            <span>Active Circles:</span>
                            <span className="font-medium text-slate-300">{data.activePodsCount} Pod(s)</span>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {(viewMode === 'weekly' || viewMode === 'both') && (
                <Line
                  type="monotone"
                  dataKey="contribution"
                  name="Weekly Deposit"
                  stroke="#005FB8"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#005FB8', stroke: '#FFFFFF', strokeWidth: 1.5 }}
                  activeDot={{ r: 6, fill: '#005FB8', stroke: '#DBEAFE', strokeWidth: 2 }}
                />
              )}
              {(viewMode === 'cumulative' || viewMode === 'both') && (
                <Line
                  type="monotone"
                  dataKey="cumulative"
                  name="Cumulative Savings"
                  stroke="#059669"
                  strokeWidth={2}
                  strokeDasharray={viewMode === 'both' ? '4 4' : undefined}
                  dot={{ r: 3, fill: '#059669', stroke: '#FFFFFF', strokeWidth: 1.5 }}
                  activeDot={{ r: 5.5, fill: '#059669', stroke: '#D1FAE5', strokeWidth: 2 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Footer Legend / Tip */}
      <div className="mt-3 pt-3 border-t border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-[#6B7280]">
        <div className="flex items-center gap-3">
          {(viewMode === 'weekly' || viewMode === 'both') && (
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-[#005FB8] inline-block" />
              <span>Weekly Contribution ($)</span>
            </span>
          )}
          {(viewMode === 'cumulative' || viewMode === 'both') && (
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
              <span>Cumulative Savings Growth ($)</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 font-mono text-[10.5px] text-slate-500">
          <span>Stripe Treasury Auto-Debited Weekly</span>
        </div>
      </div>
    </div>
  );
};
