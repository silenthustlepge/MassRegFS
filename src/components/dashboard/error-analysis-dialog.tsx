"use client";

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { analyzeErrorLogs, AnalyzeErrorLogsOutput } from '@/ai/flows/analyze-error-logs';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, Lightbulb } from 'lucide-react';

interface ErrorAnalysisDialogProps {
  errorLog: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ErrorAnalysisDialog({ errorLog, open, onOpenChange }: ErrorAnalysisDialogProps) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalyzeErrorLogsOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && errorLog) {
      setLoading(true);
      setError(null);
      setAnalysis(null);
      analyzeErrorLogs({ errorLogs: errorLog })
        .then(setAnalysis)
        .catch(() => setError("An error occurred while analyzing the logs."))
        .finally(() => setLoading(false));
    }
  }, [open, errorLog]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl flex items-center gap-2">
            <Lightbulb className="text-primary" /> AI Error Analysis
          </DialogTitle>
          <DialogDescription>
            The AI is analyzing the error logs to suggest potential fixes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div>
            <h3 className="font-semibold mb-2 text-sm text-muted-foreground">Original Error Log:</h3>
            <pre className="bg-muted p-3 rounded-md text-xs font-code whitespace-pre-wrap">
              <code>{errorLog || 'No error log provided.'}</code>
            </pre>
          </div>
          {loading && (
            <div className="space-y-4">
               <h3 className="font-semibold mb-2 text-sm text-muted-foreground">AI Analysis:</h3>
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-16 w-full" />
            </div>
          )}
          {error && (
            <Alert variant="destructive">
              <Terminal className="h-4 w-4" />
              <AlertTitle>Analysis Failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {analysis && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Analysis:</h3>
                <p className="text-sm p-3 bg-secondary rounded-md">{analysis.analysis}</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Suggested Fixes:</h3>
                <p className="text-sm p-3 bg-secondary rounded-md">{analysis.suggestedFixes}</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
