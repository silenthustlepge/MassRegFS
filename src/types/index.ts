export type AccountStatus = 'pending' | 'created' | 'verified' | 'failed';

export interface Account {
  id: number;
  username: string;
  password?: string;
  token?: string;
  status: AccountStatus;
  errorLog?: string;
}
