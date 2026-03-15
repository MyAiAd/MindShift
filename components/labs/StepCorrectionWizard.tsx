'use client';

import React, { useState, useEffect, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CorrectionItem {
  stepResultId: string;
  stepId: string;
  stepLabel: string;
  flowName: string;
  renderedText: string;    // what the test actually returned
  suggestion: string;      // AI-suggested correction
  sourceFile: string | null;
  sourceFilePath: string | null;
  sourceValue: string | null; // the raw string literal from source
}

interface Props {
  runId: string;
  onClose: () => void;
}

type ItemStatus = 'pending' | 'applying' | 'applied' | 'skipped' | 'error';

interface ItemState extends CorrectionItem {
  editedValue: string;
  status: ItemStatus;
  errorMsg?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StepCorrectionWizard({ runId, onClose }: Props) {
  const [items, setItems] = useState<ItemState[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load corrections for this run
  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    fetch(`/api/labs/v5-tests/corrections/${runId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        const loaded: ItemState[] = (json.corrections ?? []).map((c: CorrectionItem) => ({
          ...c,
          editedValue: c.sourceValue ?? c.suggestion,
          status: 'pending' as ItemStatus,
        }));
        setItems(loaded);
        setCurrentIdx(0);
        if (loaded.length === 0) setDone(true);
      })
      .catch((e) => setLoadError(e.message ?? 'Failed to load corrections'))
      .finally(() => setLoading(false));
  }, [runId]);

  // Focus textarea when item changes
  useEffect(() => {
    textareaRef.current?.focus();
  }, [currentIdx]);

  const current = items[currentIdx];
  const appliedCount = items.filter((i) => i.status === 'applied').length;
  const skippedCount = items.filter((i) => i.status === 'skipped').length;

  const updateCurrent = (patch: Partial<ItemState>) => {
    setItems((prev) => prev.map((item, idx) => idx === currentIdx ? { ...item, ...patch } : item));
  };

  const advance = () => {
    const next = currentIdx + 1;
    if (next >= items.length) {
      setDone(true);
    } else {
      setCurrentIdx(next);
    }
  };

  const handleSkip = () => {
    updateCurrent({ status: 'skipped' });
    advance();
  };

  const handleApply = async () => {
    if (!current) return;

    if (!current.sourceFilePath || !current.sourceValue) {
      // No source — just mark skipped with a note
      updateCurrent({ status: 'skipped', errorMsg: 'Source not found — needs manual edit' });
      advance();
      return;
    }

    updateCurrent({ status: 'applying' });

    try {
      const resp = await fetch('/api/labs/v5-tests/corrections/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceFilePath: current.sourceFilePath,
          oldValue: current.sourceValue,
          newValue: current.editedValue,
          stepResultId: current.stepResultId,
        }),
      });
      const json = await resp.json();
      if (!resp.ok || json.error) throw new Error(json.error ?? 'Apply failed');
      updateCurrent({ status: 'applied' });
    } catch (err: any) {
      updateCurrent({ status: 'error', errorMsg: err.message ?? 'Unknown error' });
    }

    advance();
  };

  const handleSkipAll = () => {
    setItems((prev) => prev.map((item) =>
      item.status === 'pending' ? { ...item, status: 'skipped' } : item
    ));
    setDone(true);
  };

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <WizardShell onClose={onClose}>
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          Loading corrections…
        </div>
      </WizardShell>
    );
  }

  if (loadError) {
    return (
      <WizardShell onClose={onClose}>
        <div className="p-6 text-sm text-red-600 dark:text-red-400">{loadError}</div>
      </WizardShell>
    );
  }

  if (done || items.length === 0) {
    return (
      <WizardShell onClose={onClose} title="Corrections Complete">
        <div className="p-6 space-y-4">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No flagged steps with corrections found for this run.</p>
          ) : (
            <>
              <p className="text-sm text-foreground font-medium">All corrections processed.</p>
              <div className="flex gap-6 text-sm">
                <span className="text-green-600 dark:text-green-400">✓ Applied: {appliedCount}</span>
                <span className="text-muted-foreground">→ Skipped: {skippedCount}</span>
                {items.filter(i => i.status === 'error').length > 0 && (
                  <span className="text-red-600 dark:text-red-400">✗ Errors: {items.filter(i => i.status === 'error').length}</span>
                )}
              </div>
              {appliedCount > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-300">
                  {appliedCount} source file{appliedCount !== 1 ? 's' : ''} updated. Re-run the V5 tests to verify the corrections.
                </div>
              )}
              {items.filter(i => i.status === 'error').map((item) => (
                <div key={item.stepResultId} className="text-xs text-red-600 dark:text-red-400">
                  ✗ {item.stepLabel}: {item.errorMsg}
                </div>
              ))}
              {items.some(i => !i.sourceFile) && (
                <div className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠ Some steps had no detectable source — they need to be corrected manually.
                </div>
              )}
            </>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </WizardShell>
    );
  }

  // ---------------------------------------------------------------------------
  // Main wizard step
  // ---------------------------------------------------------------------------

  const total = items.length;
  const noSource = !current.sourceFile || !current.sourceValue;

  return (
    <WizardShell
      onClose={onClose}
      title="Script Correction Wizard"
      subtitle={`${currentIdx + 1} of ${total}`}
      progress={currentIdx / total}
    >
      <div className="p-4 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
        {/* Step meta */}
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
          <span><span className="font-medium text-foreground">Step:</span> <code className="font-mono">{current.stepId}</code></span>
          <span><span className="font-medium text-foreground">Flow:</span> {current.flowName}</span>
          {current.sourceFile && (
            <span><span className="font-medium text-foreground">File:</span> <code className="font-mono text-[10px]">{current.sourceFile}</code></span>
          )}
        </div>

        {/* What the test returned */}
        <Section label="What the test returned">
          <ReadonlyBox text={current.renderedText} />
        </Section>

        {/* AI suggestion */}
        <Section label="AI-suggested correction">
          <ReadonlyBox text={current.suggestion} highlight />
        </Section>

        {/* Source template */}
        {noSource ? (
          <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
            ⚠ Source template not found for step <code className="font-mono">{current.stepId}</code>.
            This step may need to be corrected manually in the source files.
          </div>
        ) : (
          <Section label="Edit source template (change text, keep ${variables})">
            <textarea
              ref={textareaRef}
              value={current.editedValue}
              onChange={(e) => updateCurrent({ editedValue: e.target.value })}
              rows={Math.max(3, current.editedValue.split('\n').length + 1)}
              spellCheck={false}
              className="w-full font-mono text-xs px-3 py-2 border border-border rounded-lg bg-background text-foreground resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed"
            />
            {current.editedValue === current.sourceValue && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Tip: Edit the text above to match the AI suggestion, keeping <code>{'${variable}'}</code> parts intact.
              </p>
            )}
          </Section>
        )}

        {/* Error from a previous attempt */}
        {current.status === 'error' && current.errorMsg && (
          <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-700 rounded p-2">
            ✗ {current.errorMsg}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={handleSkipAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
          >
            Skip all remaining
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleSkip}
              disabled={current.status === 'applying'}
              className="px-3 py-1.5 text-sm border border-border text-muted-foreground hover:bg-secondary/50 rounded-lg transition-colors disabled:opacity-40"
            >
              Skip →
            </button>
            <button
              onClick={handleApply}
              disabled={current.status === 'applying' || (!noSource && current.editedValue === current.sourceValue)}
              className="px-4 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              {current.status === 'applying' ? 'Applying…' : noSource ? 'Skip (no source)' : '✓ Apply to source'}
            </button>
          </div>
        </div>
      </div>
    </WizardShell>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function WizardShell({
  children,
  onClose,
  title = 'Script Correction Wizard',
  subtitle,
  progress,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  progress?: number;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-card dark:bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/20">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-foreground">🔧 {title}</span>
            {subtitle && (
              <span className="text-xs text-muted-foreground">{subtitle}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-sm px-2 py-0.5 rounded hover:bg-secondary transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Progress bar */}
        {progress !== undefined && (
          <div className="h-1 bg-secondary">
            <div
              className="h-1 bg-indigo-500 transition-all duration-300"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        )}

        {children}
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      {children}
    </div>
  );
}

function ReadonlyBox({ text, highlight }: { text: string; highlight?: boolean }) {
  return (
    <div className={`text-xs rounded-lg px-3 py-2 font-mono leading-relaxed whitespace-pre-wrap break-words ${
      highlight
        ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 text-yellow-900 dark:text-yellow-200'
        : 'bg-secondary/30 border border-border/50 text-foreground'
    }`}>
      {text}
    </div>
  );
}
