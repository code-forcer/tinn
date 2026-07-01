// utils/geoLocationService.js
const axios = require('axios');

class GeoLocationService {
  constructor() {
    this.cache = new Map();
    this.requestCount = 0;
    this.lastResetTime = Date.now();
  }

  // Rate limiting: 45 requests per minute for ip-api.com
  async waitIfNeeded() {
    const now = Date.now();
    const timeSinceReset = now - this.lastResetTime;

    // Reset counter every minute
    if (timeSinceReset >= 60000) {
      this.requestCount = 0;
      this.lastResetTime = now;
    }

    // If we've hit 45 requests, wait until the minute is up
    if (this.requestCount >= 45) {
      const waitTime = 60000 - timeSinceReset;
      console.log(`Rate limit reached. Waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.lastResetTime = Date.now();
    }
  }

  async getGeoLocation(ip) {
    // Check cache first
    if (this.cache.has(ip)) {
      return this.cache.get(ip);
    }

    // Skip private/local IPs
    if (ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return null;
    }

    try {
      await this.waitIfNeeded();

      // Using ip-api.com (free, no key required)
      const response = await axios.get(`http://ip-api.com/json/${ip}`, {
        timeout: 5000
      });

      this.requestCount++;

      if (response.data.status === 'success') {
        const geoData = {
          lat: response.data.lat,
          lon: response.data.lon,
          city: response.data.city,
          region: response.data.regionName,
          country: response.data.country,
          countryCode: response.data.countryCode
        };

        // Cache it
        this.cache.set(ip, geoData);
        return geoData;
      }

      console.log(`Geo-IP lookup failed for ${ip}: ${response.data.message}`);
      return null;

    } catch (error) {
      console.error(`Geo-IP error for ${ip}:`, error.message);
      return null;
    }
  }

  // Clear cache periodically to avoid memory issues
  clearCache() {
    this.cache.clear();
    console.log('Geo-location cache cleared');
  }
}

// Singleton instance
const geoLocationService = new GeoLocationService();

module.exports = geoLocationService;