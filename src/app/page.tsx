
"use client";

import * as React from 'react';
import type { Account, ProgressUpdate } from '@/types';
import { SignupControlPanel } from '@/components/dashboard/signup-control-panel';
import { ProgressDashboard } from '@/components/dashboard/progress-dashboard';
import { AccountList } from '@/components/dashboard/account-list';
import { ErrorAnalysisDialog } from '@/components/dashboard/error-analysis-dialog';
import { Bot } from 'lucide-react';

export default function Home() {
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [totalSignups, setTotalSignups] = React.useState(0);
  const [errorDialog, setErrorDialog] = React.useState<{ open: boolean; log?: string }>({ open: false });

  const fetchVerifiedAccounts = async () => {
    try {
      const response = await fetch('/api/accounts');
      if (!response.ok) {
        throw new Error('Failed to fetch accounts');
      }
      const data: Account[] = await response.json();
      // Merge with existing accounts to preserve in-progress ones not yet in DB
      setAccounts(prev => {
        const existingIds = new Set(prev.map(a => a.id));
        const newAccounts = data.filter(a => !existingIds.has(a.id));
        return [...prev, ...newAccounts];
      });
    } catch (error) {
      console.error("Error fetching verified accounts:", error);
    }
  };

  // Fetch existing accounts on initial load
  React.useEffect(() => {
    fetchVerifiedAccounts();
  }, []);

  const handleStartProcess = async (count: number) => {
    if (isProcessing) return;

    setIsProcessing(true);
    setTotalSignups(count);
    setAccounts([]); // Clear previous accounts for this new batch

    try {
      const response = await fetch(`/api/start-signups?count=${count}`, { method: 'POST' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to start signup process');
      }

      // All good, now listen for SSE updates
      const eventSource = new EventSource('/api/stream-progress');
      
      eventSource.onmessage = (event) => {
        try {
          const progress: ProgressUpdate = JSON.parse(event.data);
          
          setAccounts(prev => {
            const existingAccountIndex = prev.findIndex(a => a.id === progress.accountId);
            
            if (existingAccountIndex > -1) {
              // Update existing account
              return prev.map((acc, index) => 
                index === existingAccountIndex 
                  ? { ...acc, status: progress.status, errorLog: progress.message } 
                  : acc
              );
            } else {
              // Add new account
              return [...prev, {
                id: progress.accountId,
                email: progress.email,
                status: progress.status,
                errorLog: progress.message,
                full_name: progress.email.split('@')[0], // Derive from email for display
              }];
            }
          });

          // Check if all initial accounts have reported a final status
          if (accounts.length >= count && accounts.every(a => ['verified', 'failed'].includes(a.status))) {
             eventSource.close();
             setIsProcessing(false);
             // Final refresh of accounts from DB
             fetchVerifiedAccounts();
          }

        } catch (e) {
          console.error('Error parsing SSE message:', e);
        }
      };

      eventSource.onerror = (err) => {
        console.error('EventSource failed:', err);
        eventSource.close();
        setIsProcessing(false);
      };

      // Optional: Add a timeout to stop listening if the process takes too long
      setTimeout(() => {
        if (eventSource.readyState !== EventSource.CLOSED) {
          eventSource.close();
          setIsProcessing(false);
          console.log("Stopped listening for updates due to timeout.");
          fetchVerifiedAccounts(); // fetch final state
        }
      }, 5 * 60 * 1000); // 5 minutes timeout

    } catch (error) {
      console.error("Error starting process:", error);
      setIsProcessing(false);
      // You could show a toast here
    }
  };

  const handleTroubleshoot = (log: string) => {
    setErrorDialog({ open: true, log });
  };
  
  const verifiedAccounts = accounts.filter(a => a.status === 'verified');
  const failedAccounts = accounts.filter(a => a.status === 'failed');

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
          <AccountList accounts={[...accounts].sort((a,b) => a.id - b.id)} onTroubleshoot={handleTroubleshoot} />
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
