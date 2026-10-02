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
  Area,
  AreaChart,
} from 'recharts';
import { 
  TrendingUp, 
  Calendar, 
  DollarSign, 
  PiggyBank, 
  Sparkles, 
  CheckCircle2, 
  Layers, 
  ArrowRight,
  ShieldCheck,
  Zap,
  Clock,
  Target
} from 'lucide-react';

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

interface ForecastDataPoint {
  monthKey: string;
  monthLabel: string;
  fullDate: string;
  monthlyDeposit: number;
  cumulativeSavings: number;
  projectedLumpSumPotential: number;
  activePodsCount: number;
}

export const WeeklySavingsChart: React.FC<WeeklySavingsChartProps> = ({
  currentUser,
  myPods,
  onExplorePods,
}) => {
  // Main toggle between Current Weekly Contributions and Projected Monthly Forecast
  const [chartMode, setChartMode] = useState<'weekly_history' | 'monthly_forecast'>('weekly_history');

  // Sub-view toggle for weekly history: 'weekly' | 'cumulative' | 'both'
  const [historyViewMode, setHistoryViewMode] = useState<'weekly' | 'cumulative' | 'both'>('weekly');

  // Horizon toggle for forecast: 6 months or 12 months
  const [forecastHorizon, setForecastHorizon] = useState<6 | 12>(6);

  // Optional simulation cadence tier override (null = use actual current cadence)
  const [simulationCadence, setSimulationCadence] = useState<number | null>(null);

  // 1. Calculate actual active and forming weekly deposit cadence from user's current pods
  const activePods = useMemo(() => myPods.filter(p => p.status === 'ACTIVE'), [myPods]);
  const formingPods = useMemo(() => myPods.filter(p => p.status === 'FORMING'), [myPods]);

  const activeWeeklyDeposit = useMemo(() => {
    return activePods.reduce((sum, p) => sum + (p.depositTier || 0), 0);
  }, [activePods]);

  const formingWeeklyDeposit = useMemo(() => {
    return formingPods.reduce((sum, p) => sum + (p.depositTier || 0), 0);
  }, [formingPods]);

  // Actual base weekly cadence (prioritize active, fallback to forming, then standard starter baseline)
  const actualWeeklyCadence = useMemo(() => {
    if (activeWeeklyDeposit > 0) return activeWeeklyDeposit;
    if (formingWeeklyDeposit > 0) return formingWeeklyDeposit;
    // If user has completed pods or default starter profile, provide $25/wk starter baseline
    if ((currentUser.completedPodsCount || 0) > 0) return 25;
    return 20; // Default starter MutualPool tier
  }, [activeWeeklyDeposit, formingWeeklyDeposit, currentUser.completedPodsCount]);

  // Effective weekly cadence for forecast (either simulated or actual)
  const effectiveWeeklyCadence = simulationCadence !== null ? simulationCadence : actualWeeklyCadence;

  // Monthly deposit equivalent: average 4.333 weeks in a calendar month
  const monthlyDepositEquivalent = Math.round(effectiveWeeklyCadence * (52 / 12));

  // 2. Generate the last 12 weeks (3 months) historical data points up to current date
  const historyChartData = useMemo<WeekDataPoint[]>(() => {
    const points: WeekDataPoint[] = [];
    const now = new Date();
    const totalWeeks = 12;

    const completedPods = currentUser.completedPodsCount || 0;
    const baseWeekly = completedPods > 0 ? 20 * Math.min(2, completedPods) : 0;

    let runningCumulative = 0;

    for (let i = totalWeeks - 1; i >= 0; i--) {
      const targetDate = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const monthName = targetDate.toLocaleDateString('en-US', { month: 'short' });
      const dayNum = targetDate.getDate();
      const weekLabel = `${monthName} ${dayNum}`;
      const fullDate = targetDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

      let weeklyContribution = 0;
      let activeCount = 0;

      if (myPods.length > 0 || completedPods > 0) {
        myPods.forEach(pod => {
          if (pod.status === 'ACTIVE') {
            const currentWeek = pod.currentCycleWeek || 1;
            const weekDistanceFromNow = i;
            if (weekDistanceFromNow < currentWeek) {
              weeklyContribution += pod.depositTier;
              activeCount += 1;
            }
          }
        });

        if (weeklyContribution === 0 && completedPods > 0 && i >= 4) {
          weeklyContribution = baseWeekly;
          activeCount = 1;
        }

        if (weeklyContribution === 0 && activeWeeklyDeposit > 0 && i <= 2) {
          weeklyContribution = activeWeeklyDeposit;
          activeCount = activePods.length;
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
  }, [myPods, activePods.length, activeWeeklyDeposit, currentUser.completedPodsCount]);

  // Aggregate stats for 3-Month History
  const totalContributed3Mo = historyChartData.reduce((acc, p) => acc + p.contribution, 0);
  const activeWeeksCount = historyChartData.filter(p => p.contribution > 0).length;
  const avgWeekly = activeWeeksCount > 0 ? Math.round(totalContributed3Mo / activeWeeksCount) : 0;
  const currentWeeklyPace = historyChartData[historyChartData.length - 1]?.contribution || actualWeeklyCadence;
  const hasAnyContributions = totalContributed3Mo > 0;

  // 3. Generate Projected Monthly Savings Forecast data points
  const forecastChartData = useMemo<ForecastDataPoint[]>(() => {
    const points: ForecastDataPoint[] = [];
    const now = new Date();
    let cumulative = 0;

    // Estimate lump-sum potential from active pods
    const estimatedLumpSumPerPod = activePods.reduce((sum, p) => {
      const size = p.members?.length || p.sizeTier || 6;
      return sum + (size * (p.depositTier || 20) * 0.90);
    }, 0);

    for (let m = 1; m <= forecastHorizon; m++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() + m, 1);
      const monthLabel = targetDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const fullDate = targetDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      // Each month accumulates approximately 4.333 weeks of weekly deposits
      cumulative += monthlyDepositEquivalent;

      // Model lump-sum rotation payouts returning to user
      // Assume a rotation turn occurs every 3 to 6 months depending on pod size
      const lumpSumInThisMonth = (m % 3 === 0 && estimatedLumpSumPerPod > 0)
        ? Math.round(estimatedLumpSumPerPod)
        : (m === 3 || m === 6 || m === 9 || m === 12)
        ? Math.round(effectiveWeeklyCadence * 6 * 0.90)
        : 0;

      points.push({
        monthKey: `m_${m}`,
        monthLabel,
        fullDate,
        monthlyDeposit: monthlyDepositEquivalent,
        cumulativeSavings: cumulative,
        projectedLumpSumPotential: lumpSumInThisMonth,
        activePodsCount: activePods.length > 0 ? activePods.length : (formingPods.length > 0 ? formingPods.length : 1),
      });
    }

    return points;
  }, [forecastHorizon, monthlyDepositEquivalent, effectiveWeeklyCadence, activePods, formingPods.length]);

  // Aggregate stats for Forecast
  const totalProjectedSavings = forecastChartData[forecastChartData.length - 1]?.cumulativeSavings || 0;
  const sixMonthProjected = forecastChartData[Math.min(5, forecastChartData.length - 1)]?.cumulativeSavings || (monthlyDepositEquivalent * 6);
  const twelveMonthProjected = monthlyDepositEquivalent * 12;

  return (
    <div className="w-full transition-all">
      {/* Top Header: Title, Description, and Primary Mode Toggle */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              chartMode === 'monthly_forecast'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                : 'bg-blue-50 border border-blue-200 text-[#005FB8]'
            }`}>
              {chartMode === 'monthly_forecast' ? (
                <Sparkles className="w-4 h-4 text-emerald-600" />
              ) : (
                <TrendingUp className="w-4 h-4" />
              )}
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#111827] flex items-center gap-1.5">
                <span>
                  {chartMode === 'monthly_forecast'
                    ? 'Projected Monthly Savings Forecast'
                    : 'Weekly Savings Contributions'}
                </span>
                <span className="text-xs font-normal text-[#6B7280]">
                  {chartMode === 'monthly_forecast'
                    ? `(${forecastHorizon}-Month Trajectory)`
                    : '(Last 3 Months)'}
                </span>
              </h3>
              <p className="text-[11px] text-[#6B7280]">
                {chartMode === 'monthly_forecast'
                  ? `Forward savings accumulation modeled on your current $${effectiveWeeklyCadence}/wk deposit cadence`
                  : 'Rotating cash pool deposits across your active and completed cycles'}
              </p>
            </div>
          </div>
        </div>

        {/* Controls Container: Primary Mode Toggle & Sub-Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          {/* PRIMARY TOGGLE: Switch between Current Weekly and Projected Monthly */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setChartMode('weekly_history')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer min-h-[32px] ${
                chartMode === 'weekly_history'
                  ? 'bg-white text-[#005FB8] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Current Weekly</span>
            </button>
            <button
              type="button"
              onClick={() => setChartMode('monthly_forecast')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer min-h-[32px] ${
                chartMode === 'monthly_forecast'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Projected Forecast</span>
            </button>
          </div>

          {/* Sub-view toggle when in Current Weekly mode */}
          {chartMode === 'weekly_history' && (
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setHistoryViewMode('weekly')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                  historyViewMode === 'weekly'
                    ? 'bg-white text-[#005FB8] font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Weekly
              </button>
              <button
                type="button"
                onClick={() => setHistoryViewMode('cumulative')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                  historyViewMode === 'cumulative'
                    ? 'bg-white text-[#005FB8] font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cumulative
              </button>
              <button
                type="button"
                onClick={() => setHistoryViewMode('both')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                  historyViewMode === 'both'
                    ? 'bg-white text-[#005FB8] font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Both
              </button>
            </div>
          )}

          {/* Horizon toggle when in Projected Forecast mode */}
          {chartMode === 'monthly_forecast' && (
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setForecastHorizon(6)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                  forecastHorizon === 6
                    ? 'bg-white text-emerald-700 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                6 Months
              </button>
              <button
                type="button"
                onClick={() => setForecastHorizon(12)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                  forecastHorizon === 12
                    ? 'bg-white text-emerald-700 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                12 Months
              </button>
            </div>
          )}
        </div>
      </div>

      {/* KPI Stat Chips - Dynamically adapts between Weekly History and Monthly Forecast */}
      {chartMode === 'weekly_history' ? (
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
              {activePods.length} active pod(s)
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
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mb-4">
          <div className="bg-[#F8FAFC] border border-emerald-200/80 p-2.5 rounded-lg">
            <span className="text-[10px] uppercase font-bold text-emerald-800 block">Deposit Cadence</span>
            <span className="text-base sm:text-lg font-black font-mono text-emerald-700">
              ${effectiveWeeklyCadence.toLocaleString()}/wk
            </span>
            <span className="text-[10px] text-slate-500 block">
              {activePods.length > 0
                ? `${activePods.length} Active Pod${activePods.length === 1 ? '' : 's'}`
                : formingPods.length > 0
                ? `${formingPods.length} Forming Pod${formingPods.length === 1 ? '' : 's'}`
                : 'Starter Pod Tier'}
            </span>
          </div>

          <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-2.5 rounded-lg">
            <span className="text-[10px] uppercase font-bold text-[#6B7280] block">Monthly Savings Rate</span>
            <span className="text-base sm:text-lg font-black font-mono text-[#005FB8]">
              ${monthlyDepositEquivalent.toLocaleString()}/mo
            </span>
            <span className="text-[10px] text-slate-500 block">~4.33 weeks per month</span>
          </div>

          <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-2.5 rounded-lg">
            <span className="text-[10px] uppercase font-bold text-[#6B7280] block">6-Month Projection</span>
            <span className="text-base sm:text-lg font-black font-mono text-slate-800">
              ${sixMonthProjected.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500 block">26 weekly deposits</span>
          </div>

          <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-2.5 rounded-lg">
            <span className="text-[10px] uppercase font-bold text-[#6B7280] block">12-Month Projection</span>
            <span className="text-base sm:text-lg font-black font-mono text-emerald-700">
              ${twelveMonthProjected.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500 block">Full annual cadence</span>
          </div>
        </div>
      )}

      {/* Cadence Scenario Selector in Forecast Mode */}
      {chartMode === 'monthly_forecast' && (
        <div className="mb-3 px-3 py-2 bg-emerald-50/70 border border-emerald-200/90 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-900">
            <Zap className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>
              Cadence Source: <strong>${actualWeeklyCadence}/wk</strong> active deposit schedule.
              {simulationCadence !== null && ` (Simulating $${simulationCadence}/wk)`}
            </span>
          </div>

          {/* Quick simulation presets */}
          <div className="flex items-center gap-1.5 font-medium text-[11px]">
            <span className="text-slate-500">Test Cadence:</span>
            <button
              type="button"
              onClick={() => setSimulationCadence(null)}
              className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                simulationCadence === null
                  ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              Current (${actualWeeklyCadence}/wk)
            </button>
            <button
              type="button"
              onClick={() => setSimulationCadence(25)}
              className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                simulationCadence === 25
                  ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              $25/wk
            </button>
            <button
              type="button"
              onClick={() => setSimulationCadence(50)}
              className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                simulationCadence === 50
                  ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              $50/wk
            </button>
            <button
              type="button"
              onClick={() => setSimulationCadence(100)}
              className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                simulationCadence === 100
                  ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              $100/wk
            </button>
          </div>
        </div>
      )}

      {/* CHART CANVAS */}
      {chartMode === 'weekly_history' ? (
        /* MODE 1: HISTORICAL WEEKLY CONTRIBUTIONS (LAST 3 MONTHS) */
        !hasAnyContributions ? (
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
                data={historyChartData}
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
                {(historyViewMode === 'weekly' || historyViewMode === 'both') && (
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
                {(historyViewMode === 'cumulative' || historyViewMode === 'both') && (
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    name="Cumulative Savings"
                    stroke="#059669"
                    strokeWidth={2}
                    strokeDasharray={historyViewMode === 'both' ? '4 4' : undefined}
                    dot={{ r: 3, fill: '#059669', stroke: '#FFFFFF', strokeWidth: 1.5 }}
                    activeDot={{ r: 5.5, fill: '#059669', stroke: '#D1FAE5', strokeWidth: 2 }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )
      ) : (
        /* MODE 2: PROJECTED MONTHLY SAVINGS FORECAST */
        <div className="h-[230px] w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={forecastChartData}
              margin={{ top: 12, right: 16, left: -12, bottom: 4 }}
            >
              <defs>
                <linearGradient id="forecastSavingsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="monthlyCadenceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#005FB8" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#005FB8" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis
                dataKey="monthLabel"
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
                domain={[0, (dataMax: number) => Math.max(dataMax + 50, 150)]}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as ForecastDataPoint;
                    return (
                      <div className="bg-slate-900/95 text-white backdrop-blur-md px-3.5 py-3 rounded-xl border border-slate-700 shadow-xl text-xs space-y-1.5 z-50 min-w-[210px]">
                        <div className="font-bold text-slate-200 border-b border-slate-700/80 pb-1 flex items-center justify-between gap-3">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{data.fullDate}</span>
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-600/30 text-emerald-300 font-mono">
                            Forecast
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 font-mono text-[11px]">
                          <span className="text-slate-400">Monthly Deposit:</span>
                          <span className="font-bold text-blue-400">${data.monthlyDeposit.toFixed(2)}/mo</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 font-mono text-[11px]">
                          <span className="text-slate-400">Projected Cumulative:</span>
                          <span className="font-bold text-emerald-400 text-sm">${data.cumulativeSavings.toFixed(2)}</span>
                        </div>
                        <div className="pt-1 border-t border-slate-800 text-[10px] text-slate-300 flex items-center justify-between">
                          <span className="text-slate-400">Weekly Equivalent:</span>
                          <span className="font-mono text-slate-200">${effectiveWeeklyCadence}/wk</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="cumulativeSavings"
                name="Cumulative Projected Fund"
                stroke="#059669"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#forecastSavingsGradient)"
                dot={{ r: 3.5, fill: '#059669', stroke: '#FFFFFF', strokeWidth: 1.5 }}
                activeDot={{ r: 6, fill: '#059669', stroke: '#D1FAE5', strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="monthlyDeposit"
                name="Monthly Deposit Cadence"
                stroke="#005FB8"
                strokeWidth={1.75}
                strokeDasharray="4 4"
                dot={{ r: 3, fill: '#005FB8', stroke: '#FFFFFF', strokeWidth: 1 }}
                activeDot={{ r: 5, fill: '#005FB8', stroke: '#DBEAFE', strokeWidth: 1.5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Footer Legend & Information */}
      <div className="mt-3 pt-3 border-t border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-[#6B7280]">
        <div className="flex items-center gap-3">
          {chartMode === 'weekly_history' ? (
            <>
              {(historyViewMode === 'weekly' || historyViewMode === 'both') && (
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#005FB8] inline-block" />
                  <span>Weekly Contribution ($)</span>
                </span>
              )}
              {(historyViewMode === 'cumulative' || historyViewMode === 'both') && (
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
                  <span>Cumulative Savings Growth ($)</span>
                </span>
              )}
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-800">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
                <span>Projected Cumulative Wealth</span>
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium text-[#005FB8]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#005FB8] inline-block border border-dashed border-[#005FB8]" />
                <span>Monthly Deposit (${monthlyDepositEquivalent}/mo)</span>
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 font-mono text-[10.5px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>
            {chartMode === 'monthly_forecast'
              ? 'Modeled on active pod escrow commitments'
              : 'Stripe Treasury Auto-Debited Weekly'}
          </span>
        </div>
      </div>
    </div>
  );
};
