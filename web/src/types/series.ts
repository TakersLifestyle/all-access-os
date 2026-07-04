export interface TicketTier {
  name: string;
  price: number;
  description?: string;
}

export interface ScheduleItem {
  time: string;
  title: string;
  desc: string;
}

export interface IncludedItem {
  icon: string;
  label: string;
}

export interface DressCodeDetail {
  label: string;
  value: string;
}

export interface DressCode {
  name: string;
  desc: string;
  details: DressCodeDetail[];
}

export interface FAQ {
  q: string;
  a: string;
}

export interface SeriesEvent {
  id: string;
  seriesId: string;
  seriesVolume: number;
  seriesVolumeLabel: string;
  title: string;
  subtitle: string;
  tagline: string;
  description: string;
  date: string;
  time: string;
  location: string;
  locationTBA?: boolean;
  capacity: number;
  ticketsRemaining: number;
  ageRestriction: string;
  status: "active" | "coming_soon" | "sold_out" | "past";
  checkoutEnabled: boolean;
  ticketTiers: Record<string, TicketTier> & { public?: TicketTier; supporter?: TicketTier; community?: TicketTier };
  generalPrice?: number;
  memberPrice?: number;
  schedule: ScheduleItem[];
  whatsIncluded: IncludedItem[];
  addOns: string[];
  faqs: FAQ[];
  dressCode?: DressCode;
  heroImageUrl: string;
  galleryImages: string[];
  grantsCommunityAccess: boolean;
  memoryAlbumId?: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventSeries {
  id: string;
  name: string;
  tagline: string;
  description: string;
  mission: string;
  color: string;
  bannerUrl: string;
  logoUrl: string;
  status: "active" | "paused";
  createdAt: string;
}
