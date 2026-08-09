export type TopicFaq = {
  question: string;
  answer: string;
};

export type Topic = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  image: string;
  category: string;
  categorySlug: string;
  date: string;
  publishedAt: string;
  readingTime: string;
  isFeatured?: boolean;
  isPopular?: boolean;
  content?: string;
  series?: string;
  seriesSlug?: string;
  showDateOnPage?: boolean;
  showCategoryOnPage?: boolean;
  showSeriesOnPage?: boolean;
  showIntroCardOnPage?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  faq?: TopicFaq[];
};
