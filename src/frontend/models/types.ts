export interface Account {
  id: string;
  name: string;
  password?: string; // Optional if we don't always need it loaded/decrypted
  created_at?: string;
}

export interface Subscription {
  id: string;
  status: string;
  price_id: string;
  current_period_end: string;
  cancel_at_period_end?: boolean;
}

export interface UserPlanInfo {
  isPremium: boolean;
  maxAccounts: number;
}
