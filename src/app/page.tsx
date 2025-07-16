"use client";

import * as React from 'react';
import type { Account } from '@/types';
import { SignupControlPanel } from '@/components/dashboard/signup-control-panel';
import { ProgressDashboard } from '@/components/dashboard/progress-dashboard';
import { AccountList } from '@/components/dashboard/account-list';
import { ErrorAnalysisDialog } from '@/components/dashboard/error-analysis-dialog';
import { Bot } from 'lucide-react';

const errorMessages = [
  "Error 503: Service Unavailable during account creation. The upstream server is not responding.",
  "Error 429: Too Many Requests. API rate limit exceeded. Please wait before trying again.",
  "Error 400: Bad Request. The username format is invalid or contains prohibited characters.",
  "Error 500: Internal Server Error. An unexpected condition was encountered on the server.",
  "Error 401: Unauthorized. The provided API key is invalid or has expired.",
];

export default function Home() {
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [totalSignups, setTotalSignups] = React.useState(0);
  const [errorDialog, setErrorDialog] = React.useState<{ open: boolean; log?: string }>({ open: false });

  const handleStartProcess = (count: number) => {
    if (isProcessing) return;

    setIsProcessing(true);
    setTotalSignups(count);

    const initialAccounts: Account[] = Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      username: `user_${Date.now().toString().slice(-5)}_${String(i + 1).padStart(2, '0')}`,
      status: 'pending',
    }));
    setAccounts(initialAccounts);

    const timeouts: NodeJS.Timeout[] = [];
    let completedCount = 0;

    const checkCompletion = () => {
      completedCount++;
      if (completedCount === count) {
        // All creations attempted, now start verifications
        startVerification();
      } else if (completedCount === count * 2) {
        // All processes attempted
        setIsProcessing(false);
      }
    };
    
    const startVerification = () => {
        initialAccounts.forEach((acc, index) => {
            const verificationTimeout = setTimeout(() => {
                setAccounts(prev => {
                    const currentAccount = prev.find(a => a.id === acc.id);
                    if (currentAccount && currentAccount.status === 'created') {
                        return prev.map(a =>
                            a.id === acc.id ? { ...a, status: 'verified', token: `aet-${btoa(a.username).slice(0, 24)}` } : a
                        );
                    }
                    return prev;
                });
                checkCompletion();
            }, (index + 1) * 200);
            timeouts.push(verificationTimeout);
        });
    };

    initialAccounts.forEach((acc, index) => {
      const creationTimeout = setTimeout(() => {
        setAccounts(prev => prev.map(a => {
          if (a.id === acc.id) {
            const isSuccess = Math.random() > 0.15; // 85% success rate
            if (isSuccess) {
              return { ...a, status: 'created', password: `pass_${Math.random().toString(36).slice(-8)}` };
            } else {
              const randomError = errorMessages[Math.floor(Math.random() * errorMessages.length)];
              return { ...a, status: 'failed', errorLog: `${randomError} for user ${a.username}.` };
            }
          }
          return a;
        }));
        checkCompletion();
      }, (index + 1) * 300);
      timeouts.push(creationTimeout);
    });
  };

  const handleTroubleshoot = (log: string) => {
    setErrorDialog({ open: true, log });
  };

  return (
    <>
      <main className="container mx-auto p-4 md:p-8">
        <header className="mb-8">
          <div className="flex items-center gap-3">
            <Bot className="h-8 w-8 text-primary" />
            <h1 className="text-3xl md:text-4xl font-headline font-bold">AutoEmergent</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            AI-Assisted Account Creation and Management Dashboard
          </p>
        </header>
        <div className="space-y-8">
          <SignupControlPanel onStartProcess={handleStartProcess} isProcessing={isProcessing} />
          {totalSignups > 0 && <ProgressDashboard accounts={accounts} totalSignups={totalSignups} />}
          <AccountList accounts={accounts} onTroubleshoot={handleTroubleshoot} />
        </div>
      </main>
      <ErrorAnalysisDialog 
        open={errorDialog.open} 
        onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}
        errorLog={errorDialog.log}
      />
    </>
  );
}
