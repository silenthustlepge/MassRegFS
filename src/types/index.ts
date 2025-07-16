
export type AccountStatus = 'pending' | 'credentials_generated' | 'verification_link_sent' | 'email_received' | 'verified' | 'failed';

export interface Account {
  id: number;
  email: string;
  full_name: string;
  status: AccountStatus;
  access_token?: string;
  refresh_token?: string;
  errorLog?: string;
}

// Represents the structure of the SSE progress update from the backend
export interface ProgressUpdate {
    accountId: number;
    email: string;
    full_name: string;
    status: AccountStatus;
    message: string;
}
