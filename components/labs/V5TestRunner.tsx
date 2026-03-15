'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { ALL_V5_FLOWS, FlowStep } from '@/lib/v5/test-flows';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReviewStatus = 'unreviewed' | 'pass' | 'fail' | 'flag';
type FlowStatus = 'pending' | 'running' | 'complete' | 'error';
type RunnerStatus = 'idle' | 'running' | 'complete';

interface StepState {
  index: number;
  label: string;
  userInput: string;
  actualStep: string;
  expectedStep?: string;
  matched?: boolean | null;
  message: string;
  responseTime: number;
  usedAI: boolean;
  apiError?: string;
  reviewStatus: ReviewStatus;
  reviewNote: string;
  savedStepId?: string; // DB id after saving
}

interface FlowState {
  name: string;
  status: FlowStatus;
  steps: StepState[];
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

interface HistoricalRun {
  id: string;
  run_name: string | null;
  started_at: string;
  completed_at: string | null;
  total_steps: number;
  passed_steps: number;
  failed_steps: number;
  flagged_steps: number;
  unreviewed_steps: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FLOW_NAMES = Object.keys(ALL_V5_FLOWS);

function initialFlows(): FlowState[] {
  return FLOW_NAMES.map((name) => ({
    name,
    status: 'pending',
    steps: [],
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractProblemRefs(message: string): string[] {
  const matches = message.match(/'([^']+)'/g);
  return matches ? matches.map((m) => m.replace(/'/g, '')) : [];
}

function checkProblemRef(message: string, problem: string): boolean {
  const refs = extractProblemRefs(message);
  return refs.some((ref) => ref.toLowerCase().includes(problem.toLowerCase()));
}

function statusBadge(status: FlowStatus, steps: StepState[]) {
  switch (status) {
    case 'pending':
      return <span className="px-2 py-0.5 rounded text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">PENDING</span>;
    case 'running':
      return <span className="px-2 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 animate-pulse">RUNNING</span>;
    case 'error':
      return <span className="px-2 py-0.5 rounded text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">FAILED</span>;
    case 'complete': {
      const matched = steps.filter((s) => s.matched === true).length;
      const mismatched = steps.filter((s) => s.matched === false).length;
      if (mismatched > 0) {
        return <span className="px-2 py-0.5 rounded text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">✗ {mismatched} mismatch</span>;
      }
      return <span className="px-2 py-0.5 rounded text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">✓ {matched}/{steps.length}</span>;
    }
  }
}

function reviewRowClass(status: ReviewStatus) {
  switch (status) {
    case 'pass': return 'bg-green-50 dark:bg-green-900/10';
    case 'fail': return 'bg-red-50 dark:bg-red-900/10';
    case 'flag': return 'bg-yellow-50 dark:bg-yellow-900/10';
    default: return '';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function V5TestRunner() {
  const { user } = useAuth();

  const [status, setStatus] = useState<RunnerStatus>('idle');
  const [flows, setFlows] = useState<FlowState[]>(initialFlows());
  const [activeFlowIndex, setActiveFlowIndex] = useState<number>(-1);
  const [expandedFlows, setExpandedFlows] = useState<Set<number>>(new Set());
  const [selectedFlow, setSelectedFlow] = useState<string>('');
  const [savedRunId, setSavedRunId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [runName, setRunName] = useState('');
  const [runNotes, setRunNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [historicalRuns, setHistoricalRuns] = useState<HistoricalRun[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const startedAtRef = useRef<string | null>(null);

  // ---------------------------------------------------------------------------
  // Flow execution
  // ---------------------------------------------------------------------------

  const updateFlowStep = useCallback((flowIndex: number, stepState: StepState) => {
    setFlows((prev) => {
      const next = [...prev];
      const flow = { ...next[flowIndex] };
      const steps = [...flow.steps];
      const existing = steps.findIndex((s) => s.index === stepState.index);
      if (existing >= 0) {
        steps[existing] = stepState;
      } else {
        steps.push(stepState);
      }
      flow.steps = steps;
      next[flowIndex] = flow;
      return next;
    });
  }, []);

  const updateFlowStatus = useCallback((flowIndex: number, update: Partial<FlowState>) => {
    setFlows((prev) => {
      const next = [...prev];
      next[flowIndex] = { ...next[flowIndex], ...update };
      return next;
    });
  }, []);

  const runSingleFlow = useCallback(async (flowIndex: number) => {
    const flowName = FLOW_NAMES[flowIndex];
    const flowSteps: FlowStep[] = ALL_V5_FLOWS[flowName];

    setExpandedFlows((prev) => { const s = new Set(prev); s.add(flowIndex); return s; });
    setActiveFlowIndex(flowIndex);
    updateFlowStatus(flowIndex, { status: 'running', steps: [], startedAt: new Date().toISOString() });

    const sessionId = `v5-test-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const userId = user?.id ?? 'anonymous';

    let problem: string | undefined;

    try {
      // Step 0: start
      const t0 = Date.now();
      const startResp = await fetch('/api/treatment-v5', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', sessionId, userId }),
      });
      const startJson = await startResp.json();
      const startTime = Date.now() - t0;

      updateFlowStep(flowIndex, {
        index: 0,
        label: 'start',
        userInput: '—',
        actualStep: startJson.currentStep ?? '',
        expectedStep: 'mind_shifting_explanation',
        matched: (startJson.currentStep ?? '') === 'mind_shifting_explanation' || undefined,
        message: startJson.message ?? '',
        responseTime: startTime,
        usedAI: startJson.usedAI ?? false,
        apiError: startResp.ok ? undefined : (startJson.error ?? 'Request failed'),
        reviewStatus: 'unreviewed',
        reviewNote: '',
      });

      await new Promise((r) => setTimeout(r, 0));

      // Steps 1..N
      for (let i = 0; i < flowSteps.length; i++) {
        const stepDef = flowSteps[i];
        const t1 = Date.now();
        const resp = await fetch('/api/treatment-v5', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'continue', sessionId, userId, userInput: stepDef.input }),
        });
        const json = await resp.json();
        const elapsed = Date.now() - t1;

        // Track problem from first free-text input for problem-based flows
        if (!problem && i >= 2 && stepDef.label?.toLowerCase().includes('describe')) {
          problem = stepDef.input;
        }

        // Check step match
        let matched: boolean | null = null;
        if (stepDef.expectStep) {
          matched = (json.currentStep ?? '') === stepDef.expectStep;
        }

        // Check problem ref
        let problemRefFound: boolean | null = null;
        if (stepDef.checkProblemRef && problem) {
          problemRefFound = checkProblemRef(json.message ?? '', problem);
        }

        updateFlowStep(flowIndex, {
          index: i + 1,
          label: stepDef.label ?? `step ${i + 1}`,
          userInput: stepDef.input,
          actualStep: json.currentStep ?? '',
          expectedStep: stepDef.expectStep,
          matched,
          message: json.message ?? '',
          responseTime: elapsed,
          usedAI: json.usedAI ?? false,
          apiError: resp.ok ? undefined : (json.error ?? 'Request failed'),
          reviewStatus: 'unreviewed',
          reviewNote: '',
        });

        await new Promise((r) => setTimeout(r, 0));
      }

      updateFlowStatus(flowIndex, { status: 'complete', completedAt: new Date().toISOString() });
    } catch (err: any) {
      updateFlowStatus(flowIndex, { status: 'error', error: err?.message ?? 'Unknown error', completedAt: new Date().toISOString() });
    }
  }, [user, updateFlowStep, updateFlowStatus]);

  const runAllFlows = useCallback(async () => {
    if (status === 'running') return;
    setStatus('running');
    setFlows(initialFlows());
    setExpandedFlows(new Set());
    setSavedRunId(null);
    setSaveError(null);
    startedAtRef.current = new Date().toISOString();

    for (let i = 0; i < FLOW_NAMES.length; i++) {
      await runSingleFlow(i);
    }
    setStatus('complete');
    setActiveFlowIndex(-1);
    loadHistoricalRuns();
  }, [status, runSingleFlow]);

  const runOneFlow = useCallback(async () => {
    if (!selectedFlow || status === 'running') return;
    const idx = FLOW_NAMES.indexOf(selectedFlow);
    if (idx < 0) return;
    setStatus('running');
    setFlows(initialFlows());
    setExpandedFlows(new Set());
    setSavedRunId(null);
    setSaveError(null);
    startedAtRef.current = new Date().toISOString();
    await runSingleFlow(idx);
    setStatus('complete');
    setActiveFlowIndex(-1);
  }, [selectedFlow, status, runSingleFlow]);

  // ---------------------------------------------------------------------------
  // Review actions
  // ---------------------------------------------------------------------------

  const handleReview = useCallback((flowIndex: number, stepIndex: number, reviewStatus: ReviewStatus) => {
    setFlows((prev) => {
      const next = [...prev];
      const flow = { ...next[flowIndex] };
      const steps = [...flow.steps];
      const si = steps.findIndex((s) => s.index === stepIndex);
      if (si >= 0) {
        steps[si] = { ...steps[si], reviewStatus };
      }
      flow.steps = steps;
      next[flowIndex] = flow;
      return next;
    });
  }, []);

  const handleNoteChange = useCallback((flowIndex: number, stepIndex: number, note: string) => {
    setFlows((prev) => {
      const next = [...prev];
      const flow = { ...next[flowIndex] };
      const steps = [...flow.steps];
      const si = steps.findIndex((s) => s.index === stepIndex);
      if (si >= 0) {
        steps[si] = { ...steps[si], reviewNote: note };
      }
      flow.steps = steps;
      next[flowIndex] = flow;
      return next;
    });
  }, []);

  // After saving, patch individual steps via API
  const patchStepReview = useCallback(async (stepId: string, reviewStatus: ReviewStatus, reviewNote: string) => {
    await fetch(`/api/labs/v5-tests/steps/${stepId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review_status: reviewStatus, review_note: reviewNote }),
    });
  }, []);

  const handleReviewAfterSave = useCallback(async (flowIndex: number, stepIndex: number, reviewStatus: ReviewStatus) => {
    handleReview(flowIndex, stepIndex, reviewStatus);
    const step = flows[flowIndex]?.steps.find((s) => s.index === stepIndex);
    if (step?.savedStepId) {
      await patchStepReview(step.savedStepId, reviewStatus, step.reviewNote);
    }
  }, [flows, handleReview, patchStepReview]);

  // ---------------------------------------------------------------------------
  // Save run
  // ---------------------------------------------------------------------------

  const saveRun = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveError(null);

    const payload = {
      runName: runName || undefined,
      notes: runNotes || undefined,
      startedAt: startedAtRef.current ?? new Date().toISOString(),
      completedAt: new Date().toISOString(),
      flows: flows.map((flow, fi) => ({
        flowName: flow.name,
        flowIndex: fi,
        status: flow.status,
        totalSteps: flow.steps.length,
        passedSteps: flow.steps.filter((s) => s.matched === true).length,
        failedSteps: flow.steps.filter((s) => s.matched === false).length,
        errorMessage: flow.error,
        startedAt: flow.startedAt,
        completedAt: flow.completedAt,
        steps: flow.steps.map((s) => ({
          stepIndex: s.index,
          stepLabel: s.label,
          userInput: s.userInput !== '—' ? s.userInput : undefined,
          expectedStep: s.expectedStep,
          actualStep: s.actualStep,
          responseMessage: s.message,
          responseTimeMs: s.responseTime,
          usedAI: s.usedAI,
          stepMatched: s.matched,
          apiError: s.apiError,
        })),
      })),
    };

    try {
      const resp = await fetch('/api/labs/v5-tests/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? 'Save failed');
      setSavedRunId(json.runId);
      // Now load the saved run to get step IDs for inline review updates
      const detailResp = await fetch(`/api/labs/v5-tests/runs/${json.runId}`);
      if (detailResp.ok) {
        const detail = await detailResp.json();
        // Map saved step IDs back to local state
        setFlows((prev) => {
          const next = [...prev];
          for (const savedFlow of detail.flows ?? []) {
            const fi = savedFlow.flow_index;
            if (fi < 0 || fi >= next.length) continue;
            const flow = { ...next[fi] };
            const steps = [...flow.steps];
            for (const savedStep of savedFlow.steps ?? []) {
              const si = steps.findIndex((s) => s.index === savedStep.step_index);
              if (si >= 0) {
                steps[si] = { ...steps[si], savedStepId: savedStep.id };
              }
            }
            flow.steps = steps;
            next[fi] = flow;
          }
          return next;
        });
      }
      loadHistoricalRuns();
    } catch (err: any) {
      setSaveError(err.message ?? 'Unknown error saving run');
    } finally {
      setIsSaving(false);
    }
  }, [flows, isSaving, runName, runNotes]);

  // ---------------------------------------------------------------------------
  // Historical runs
  // ---------------------------------------------------------------------------

  const loadHistoricalRuns = useCallback(async () => {
    setHistLoading(true);
    try {
      const resp = await fetch('/api/labs/v5-tests/runs');
      if (resp.ok) {
        const json = await resp.json();
        setHistoricalRuns(json.runs ?? []);
      }
    } finally {
      setHistLoading(false);
    }
  }, []);

  // Load on mount
  React.useEffect(() => {
    loadHistoricalRuns();
  }, [loadHistoricalRuns]);

  // ---------------------------------------------------------------------------
  // Computed summary
  // ---------------------------------------------------------------------------

  const allSteps = flows.flatMap((f) => f.steps);
  const totalSteps = allSteps.length;
  const passCount = allSteps.filter((s) => s.reviewStatus === 'pass').length;
  const failCount = allSteps.filter((s) => s.reviewStatus === 'fail').length;
  const flagCount = allSteps.filter((s) => s.reviewStatus === 'flag').length;
  const unreviewedCount = allSteps.filter((s) => s.reviewStatus === 'unreviewed').length;

  const completedSteps = flows.reduce((n, f) => n + f.steps.length, 0);
  const expectedSteps = FLOW_NAMES.reduce((n, name) => n + ALL_V5_FLOWS[name].length + 1, 0); // +1 for start

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6 max-w-full">
      {/* Header */}
      <div className="bg-card dark:bg-card border border-border rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">V5 Protocol Test Runner</h1>
            <p className="text-sm text-muted-foreground mt-1">Step-by-step verification of the V5 treatment script against live API</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              status === 'idle' ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400' :
              status === 'running' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 animate-pulse' :
              'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
            }`}>
              {status.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Run controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={runAllFlows}
            disabled={status === 'running'}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition-colors"
          >
            ▶ Run All Flows
          </button>
          <div className="flex items-center gap-2">
            <select
              value={selectedFlow}
              onChange={(e) => setSelectedFlow(e.target.value)}
              disabled={status === 'running'}
              className="px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground disabled:opacity-50"
            >
              <option value="">— Select single flow —</option>
              {FLOW_NAMES.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <button
              onClick={runOneFlow}
              disabled={!selectedFlow || status === 'running'}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition-colors"
            >
              Run
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {status !== 'idle' && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{completedSteps} / {expectedSteps} steps complete</span>
              <span>{Math.round((completedSteps / Math.max(expectedSteps, 1)) * 100)}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.round((completedSteps / Math.max(expectedSteps, 1)) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Summary bar */}
      {totalSteps > 0 && (
        <div className="bg-card dark:bg-card border border-border rounded-xl p-4">
          <div className="flex flex-wrap gap-4 text-sm font-medium">
            <span className="text-green-600 dark:text-green-400">✅ Pass: {passCount}</span>
            <span className="text-red-600 dark:text-red-400">❌ Fail: {failCount}</span>
            <span className="text-yellow-600 dark:text-yellow-400">🚩 Flag: {flagCount}</span>
            <span className="text-gray-500 dark:text-gray-400">⬜ Unreviewed: {unreviewedCount}</span>
            <span className="text-muted-foreground ml-auto">Total: {totalSteps} steps</span>
          </div>
        </div>
      )}

      {/* Flow accordions */}
      {flows.some((f) => f.status !== 'pending' || f.steps.length > 0) && (
        <div className="space-y-3">
          {flows.map((flow, fi) => {
            if (flow.status === 'pending' && flow.steps.length === 0) return null;
            const isExpanded = expandedFlows.has(fi);
            return (
              <div key={fi} className="bg-card dark:bg-card border border-border rounded-xl overflow-hidden">
                {/* Accordion header */}
                <button
                  onClick={() => setExpandedFlows((prev) => {
                    const next = new Set(prev);
                    if (next.has(fi)) next.delete(fi); else next.add(fi);
                    return next;
                  })}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-secondary/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-xs">{isExpanded ? '▼' : '▶'}</span>
                    <span className="font-medium text-foreground text-sm">{flow.name}</span>
                    {statusBadge(flow.status, flow.steps)}
                  </div>
                  <span className="text-xs text-muted-foreground">{flow.steps.length} steps</span>
                </button>

                {/* Transcript table */}
                {isExpanded && flow.steps.length > 0 && (
                  <div className="overflow-x-auto border-t border-border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-secondary/30 text-muted-foreground">
                          <th className="px-2 py-2 text-left font-medium w-8">#</th>
                          <th className="px-2 py-2 text-left font-medium">Label</th>
                          <th className="px-2 py-2 text-left font-medium">User Input</th>
                          <th className="px-2 py-2 text-left font-medium">Expected Step</th>
                          <th className="px-2 py-2 text-left font-medium">Actual Step</th>
                          <th className="px-2 py-2 text-center font-medium w-8">✓</th>
                          <th className="px-2 py-2 text-left font-medium">Response Message</th>
                          <th className="px-2 py-2 text-left font-medium">Review</th>
                        </tr>
                      </thead>
                      <tbody>
                        {flow.steps.map((step) => (
                          <tr
                            key={step.index}
                            className={`border-t border-border/50 ${reviewRowClass(step.reviewStatus)}`}
                          >
                            <td className="px-2 py-2 text-muted-foreground">{step.index}</td>
                            <td className="px-2 py-2 text-foreground font-medium max-w-[120px] truncate" title={step.label}>{step.label}</td>
                            <td className="px-2 py-2 text-muted-foreground max-w-[100px] truncate" title={step.userInput}>{step.userInput}</td>
                            <td className="px-2 py-2 text-muted-foreground font-mono text-[10px] max-w-[140px] truncate" title={step.expectedStep}>{step.expectedStep ?? '—'}</td>
                            <td className={`px-2 py-2 font-mono text-[10px] max-w-[140px] truncate ${step.matched === false ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`} title={step.actualStep}>{step.actualStep}</td>
                            <td className="px-2 py-2 text-center">
                              {step.matched === true ? '✅' : step.matched === false ? '❌' : step.apiError ? '⚠️' : '—'}
                            </td>
                            <td className="px-2 py-2 text-foreground max-w-[280px]">
                              {step.apiError ? (
                                <span className="text-red-600 dark:text-red-400">Error: {step.apiError}</span>
                              ) : (
                                <div className="max-h-20 overflow-y-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed">
                                  {step.message}
                                </div>
                              )}
                            </td>
                            <td className="px-2 py-2">
                              <div className="flex flex-col gap-1">
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => savedRunId
                                      ? handleReviewAfterSave(fi, step.index, 'pass')
                                      : handleReview(fi, step.index, 'pass')}
                                    className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors ${
                                      step.reviewStatus === 'pass'
                                        ? 'bg-green-500 text-white border-green-500'
                                        : 'border-border hover:bg-green-50 dark:hover:bg-green-900/20 text-muted-foreground'
                                    }`}
                                    title="Pass"
                                  >✅</button>
                                  <button
                                    onClick={() => savedRunId
                                      ? handleReviewAfterSave(fi, step.index, 'fail')
                                      : handleReview(fi, step.index, 'fail')}
                                    className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors ${
                                      step.reviewStatus === 'fail'
                                        ? 'bg-red-500 text-white border-red-500'
                                        : 'border-border hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground'
                                    }`}
                                    title="Fail"
                                  >❌</button>
                                  <button
                                    onClick={() => savedRunId
                                      ? handleReviewAfterSave(fi, step.index, 'flag')
                                      : handleReview(fi, step.index, 'flag')}
                                    className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors ${
                                      step.reviewStatus === 'flag'
                                        ? 'bg-yellow-500 text-white border-yellow-500'
                                        : 'border-border hover:bg-yellow-50 dark:hover:bg-yellow-900/20 text-muted-foreground'
                                    }`}
                                    title="Flag"
                                  >🚩</button>
                                </div>
                                <input
                                  type="text"
                                  placeholder="note…"
                                  value={step.reviewNote}
                                  onChange={(e) => handleNoteChange(fi, step.index, e.target.value)}
                                  className="text-[10px] px-1.5 py-0.5 border border-border rounded bg-background text-foreground w-24"
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Save results panel */}
      {status === 'complete' && !savedRunId && (
        <div className="bg-card dark:bg-card border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Save Results</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Run Name (optional)</label>
              <input
                type="text"
                value={runName}
                onChange={(e) => setRunName(e.target.value)}
                placeholder="e.g. V5 Sprint 1 verification"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Doctor Notes</label>
              <textarea
                value={runNotes}
                onChange={(e) => setRunNotes(e.target.value)}
                placeholder="Overall observations about this test run…"
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm resize-y"
              />
            </div>
            {saveError && (
              <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>
            )}
            <button
              onClick={saveRun}
              disabled={isSaving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors"
            >
              {isSaving ? 'Saving…' : 'Save to Database'}
            </button>
          </div>
        </div>
      )}

      {savedRunId && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
          <p className="text-sm text-green-700 dark:text-green-300 font-medium">
            ✅ Saved! View at{' '}
            <a href={`/dashboard/labs/v5-tests?runId=${savedRunId}`} className="underline">
              /dashboard/labs/v5-tests?runId={savedRunId}
            </a>
          </p>
        </div>
      )}

      {/* Historical runs */}
      <div className="bg-card dark:bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Historical Runs</h2>
          <button
            onClick={loadHistoricalRuns}
            disabled={histLoading}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {histLoading ? 'Loading…' : '↻ Refresh'}
          </button>
        </div>
        {historicalRuns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No saved runs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="pb-2 text-left font-medium">Run Name</th>
                  <th className="pb-2 text-left font-medium">Date</th>
                  <th className="pb-2 text-center font-medium">Total</th>
                  <th className="pb-2 text-center font-medium">✅</th>
                  <th className="pb-2 text-center font-medium">❌</th>
                  <th className="pb-2 text-center font-medium">🚩</th>
                  <th className="pb-2 text-center font-medium">⬜</th>
                  <th className="pb-2 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {historicalRuns.map((run) => (
                  <tr key={run.id} className="border-b border-border/50">
                    <td className="py-2 text-foreground">{run.run_name ?? <span className="text-muted-foreground italic">unnamed</span>}</td>
                    <td className="py-2 text-muted-foreground">{new Date(run.started_at).toLocaleDateString()}</td>
                    <td className="py-2 text-center text-muted-foreground">{run.total_steps}</td>
                    <td className="py-2 text-center text-green-600 dark:text-green-400">{run.passed_steps}</td>
                    <td className="py-2 text-center text-red-600 dark:text-red-400">{run.failed_steps}</td>
                    <td className="py-2 text-center text-yellow-600 dark:text-yellow-400">{run.flagged_steps}</td>
                    <td className="py-2 text-center text-muted-foreground">{run.unreviewed_steps}</td>
                    <td className="py-2">
                      <a
                        href={`/dashboard/labs/v5-tests?runId=${run.id}`}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs"
                      >
                        View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
