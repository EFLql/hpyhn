export default function sitemap() {
  return [
    {
      url: 'https://hpyhn.xyz',
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1,
    },
    {
      url: 'https://hpyhn.xyz/ask',
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.8,
    },
    {
      url: 'https://hpyhn.xyz/newest',
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: 'https://hpyhn.xyz/show',
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: 'https://hpyhn.xyz/weekly',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    }
  ];
}