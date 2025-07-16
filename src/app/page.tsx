
"use client";

import * as React from 'react';
import type { Account, ProgressUpdate } from '@/types';
import { SignupControlPanel } from '@/components/dashboard/signup-control-panel';
import { ProgressDashboard } from '@/components/dashboard/progress-dashboard';
import { AccountList } from '@/components/dashboard/account-list';
import { ErrorAnalysisDialog } from '@/components/dashboard/error-analysis-dialog';
import { Bot } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// The backend server runs on port 8000
const API_BASE_URL = 'https://d2e40730-100a-4052-8641-d9f3096c55cd.preview.emergentagent.com';

export default function Home() {
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [totalSignups, setTotalSignups] = React.useState(0);
  const [errorDialog, setErrorDialog] = React.useState<{ open: boolean; log?: string }>({ open: false });
  const { toast } = useToast();

  const fetchAccounts = React.useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/accounts`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch accounts. Status: ${response.status}. Message: ${errorText}`);
      }
      const data: Account[] = await response.json();
      setAccounts(data);
    } catch (error: any) {
      console.error("Error fetching accounts:", error);
      toast({
        variant: "destructive",
        title: "Network Error",
        description: error.message || "Could not connect to the backend to fetch accounts. Please ensure the backend server is running."
      });
    }
  }, [toast]);

  React.useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleStartProcess = async (count: number) => {
    if (isProcessing) return;

    setIsProcessing(true);
    setTotalSignups(count);
    // Clear previous results for a fresh start
    setAccounts([]);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/start-signups?count=${count}`, { method: 'POST' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to start signup process');
      }

      const eventSource = new EventSource(`${API_BASE_URL}/api/stream-progress`);
      let completedCount = 0;
      
      eventSource.onmessage = (event) => {
        try {
          const progress: ProgressUpdate = JSON.parse(event.data);
          
          setAccounts(prev => {
            const existingAccountIndex = prev.findIndex(a => a.id === progress.accountId);
            
            if (existingAccountIndex > -1) {
              // Update existing account
              const newAccounts = [...prev];
              newAccounts[existingAccountIndex] = {
                 ...newAccounts[existingAccountIndex],
                 status: progress.status,
                 errorLog: progress.status === 'failed' ? progress.message : newAccounts[existingAccountIndex].errorLog,
              };
              return newAccounts;
            } else if (progress.accountId !== -1) {
              // Add new account
              const newAccount: Account = {
                id: progress.accountId,
                email: progress.email,
                full_name: progress.full_name,
                status: progress.status,
                errorLog: progress.status === 'failed' ? progress.message : undefined,
              };
              // Add to the top of the list
              return [newAccount, ...prev];
            }
            return prev;
          });

          if (['verified', 'failed'].includes(progress.status)) {
            completedCount++;
            if (completedCount >= count) {
              eventSource.close();
              setIsProcessing(false);
              // A final fetch to ensure data consistency
              setTimeout(() => fetchAccounts(), 1000); 
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
          {(isProcessing || totalSignups > 0) && <ProgressDashboard accounts={accounts} totalSignups={totalSignups} />}
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
