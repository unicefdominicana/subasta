export type ItemStatus = "draft" | "open" | "paused" | "closed";
export type Currency = "DOP" | "USD";

export type AuctionItem = {
  id: string;
  lot_number: number;
  title: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  starting_price: number;
  current_bid: number;
  leader_name: string | null;
  bid_count: number;
  status: ItemStatus;
  featured: boolean;
};

export type AuctionSettings = {
  is_open: boolean;
  currency: Currency;
};

export type Guest = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export type Winner = {
  lot_number: number;
  title: string;
  status: ItemStatus;
  amount: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  bid_at: string;
};
