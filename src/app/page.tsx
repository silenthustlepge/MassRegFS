
"use client";

import * as React from 'react';
import type { Account, ProgressUpdate } from '@/types';
import { SignupControlPanel } from '@/components/dashboard/signup-control-panel';
import { ProgressDashboard } from '@/components/dashboard/progress-dashboard';
import { AccountList } from '@/components/dashboard/account-list';
import { ErrorAnalysisDialog } from '@/components/dashboard/error-analysis-dialog';
import { Bot } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Home() {
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [totalSignups, setTotalSignups] = React.useState(0);
  const [errorDialog, setErrorDialog] = React.useState<{ open: boolean; log?: string }>({ open: false });
  const { toast } = useToast();

  const fetchVerifiedAccounts = async () => {
    try {
      const response = await fetch('/api/accounts');
      if (!response.ok) {
        // This will be caught by the .catch block below
        throw new Error(`Failed to fetch accounts. Status: ${response.status}`);
      }
      const data: Account[] = await response.json();
      setAccounts(data); // Replace state with the source of truth from DB
    } catch (error: any) {
      console.error("Error fetching verified accounts:", error);
      toast({
        variant: "destructive",
        title: "Network Error",
        description: "Could not connect to the backend to fetch accounts. Please ensure the backend server is running."
      });
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
        throw new Error(errorData.detail || 'Failed to start signup process');
      }

      const eventSource = new EventSource('/api/stream-progress');
      let completedCount = 0;
      
      eventSource.onmessage = (event) => {
        try {
          const progress: ProgressUpdate = JSON.parse(event.data);

          // If it's a failure for a non-existent account, don't add it.
          if (progress.accountId === -1 && progress.status === 'failed') {
              console.error("A task failed before account creation:", progress.message);
              completedCount++;
              return;
          }
          
          setAccounts(prev => {
            const existingAccountIndex = prev.findIndex(a => a.id === progress.accountId);
            
            if (existingAccountIndex > -1) {
              return prev.map((acc, index) => 
                index === existingAccountIndex 
                  ? { ...acc, status: progress.status, errorLog: progress.message } 
                  : acc
              );
            } else {
              return [...prev, {
                id: progress.accountId,
                email: progress.email,
                status: progress.status,
                errorLog: progress.message,
                full_name: progress.email.split('@')[0], 
              }];
            }
          });

          // Check for completion
          if (['verified', 'failed'].includes(progress.status)) {
            completedCount++;
            if (completedCount >= count) {
              eventSource.close();
              setIsProcessing(false);
              // Final refresh of accounts from DB after a short delay
              setTimeout(() => fetchVerifiedAccounts(), 1000);
            }
          }

        } catch (e) {
          console.error('Error parsing SSE message:', e);
        }
      };

      eventSource.onerror = (err) => {
        console.error('EventSource failed:', err);
        eventSource.close();
        setIsProcessing(false);
        toast({
            variant: "destructive",
            title: "Connection Lost",
            description: "Lost connection to the progress stream. Please check the backend."
        });
      };

    } catch (error: any) {
      console.error("Error starting process:", error);
      setIsProcessing(false);
      toast({
        variant: "destructive",
        title: "Process Failed to Start",
        description: error.message || "An unknown error occurred.",
      });
    }
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
          <AccountList accounts={[...accounts].sort((a,b) => (a.id ?? 0) - (b.id ?? 0))} onTroubleshoot={handleTroubleshoot} />
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
