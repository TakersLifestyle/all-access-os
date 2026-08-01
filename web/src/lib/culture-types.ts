export type EpisodeStatus =
  | "idea"
  | "guest_identified"
  | "invited"
  | "confirmed"
  | "pre_interview_complete"
  | "recorded"
  | "editing"
  | "awaiting_approval"
  | "scheduled"
  | "published"
  | "archived";

export type CultureCategory =
  | "Music"
  | "Business"
  | "Sports"
  | "Fashion"
  | "Food"
  | "Community"
  | "Media"
  | "Art"
  | "Entrepreneurship"
  | "Non-Profit"
  | "Leadership"
  | "Culture"
  | "Youth"
  | "Wellness"
  | "Technology";

export interface SocialLinks {
  instagram?: string;
  tiktok?: string;
  twitter?: string;
  youtube?: string;
  linkedin?: string;
  website?: string;
}

export interface FeaturedQuote {
  text: string;
  context?: string;
}

export interface ProductionCredits {
  host?: string;
  producer?: string;
  director?: string;
  camera?: string;
  photography?: string;
  audio?: string;
  editing?: string;
  setDesign?: string;
  styling?: string;
  venue?: string;
}

export interface ContentChecklist {
  fullEpisodeReady: boolean;
  teaserReady: boolean;
  shortClipsReady: boolean;
  articleReady: boolean;
  transcriptReady: boolean;
  quoteGraphicsReady: boolean;
  photoGalleryReady: boolean;
  newsletterReady: boolean;
  socialCaptionsReady: boolean;
  audioReady: boolean;
}

export interface CultureEpisode {
  id: string;
  slug: string;
  episodeNumber: number;
  title: string;
  subtitle?: string;
  guestName: string;
  guestDisplayName: string;
  guestRole: string;
  guestOrganization?: string;
  shortBio: string;
  longBio?: string;
  profileImage?: string;
  coverImage?: string;
  thumbnailImage?: string;
  teaserVideo?: string;
  fullVideoUrl?: string;
  youtubeUrl?: string;
  audioUrl?: string;
  spotifyUrl?: string;
  applePodcastUrl?: string;
  publishDate?: string;
  recordingDate?: string;
  location?: string;
  duration?: string;
  category: CultureCategory;
  tags: string[];
  topics: string[];
  featuredQuotes: FeaturedQuote[];
  photoGallery: string[];
  socialLinks: SocialLinks;
  websiteUrl?: string;
  relatedMemoryIds: string[];
  relatedEventIds: string[];
  relatedGuestIds: string[];
  sponsors: string[];
  partnerCredits: string[];
  productionCredits: ProductionCredits;
  status: EpisodeStatus;
  featured: boolean;
  published: boolean;
  seoTitle?: string;
  seoDescription?: string;
  transcript?: string;
  articleBody?: string;
  consentStatus: "pending" | "approved" | "partial";
  mediaReleaseStatus: "pending" | "approved";
  contentChecklist: ContentChecklist;
}

export interface GuestNomination {
  yourName: string;
  yourEmail: string;
  nomineeName: string;
  nomineeRole: string;
  nomineeOrganization?: string;
  socialLinks?: string;
  whyFeature: string;
  winnipegImpact: string;
  nomineeContact?: string;
  category: CultureCategory | "";
  notes?: string;
}
