export type AccountStatus = 'pending' | 'created' | 'verified' | 'failed';

export interface Account {
  id: number;
  username: string;
  access_token?: string;
  refresh_token?: string;
  status: AccountStatus;
  errorLog?: string;
}
