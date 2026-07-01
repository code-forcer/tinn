// jobs/processVoteGeoLocations.js
const cron = require('node-cron');
const VoteIP = require('../models/VoteIP');
const geoLocationService = require('../utils/geoLocationService');

async function processUnprocessedIPs() {
  try {
    console.log('Starting geo-location processing job...');

    // Find unprocessed vote IPs (limit to 40 per run to respect rate limits)
    const unprocessedVotes = await VoteIP.find({ 
      'geoLocation.processed': false 
    }).limit(40);

    if (unprocessedVotes.length === 0) {
      console.log('No unprocessed IPs found.');
      return;
    }

    console.log(`Processing ${unprocessedVotes.length} unprocessed IPs...`);

    let successCount = 0;
    let failCount = 0;

    for (const vote of unprocessedVotes) {
      try {
        const geoData = await geoLocationService.getGeoLocation(vote.ip);

        if (geoData) {
          vote.geoLocation = {
            ...geoData,
            processed: true,
            processedAt: new Date()
          };
          await vote.save();
          successCount++;
          console.log(`✓ Processed IP: ${vote.ip} -> ${geoData.city}, ${geoData.region}`);
        } else {
          // Mark as processed even if failed, to avoid retrying indefinitely
          vote.geoLocation.processed = true;
          vote.geoLocation.processedAt = new Date();
          await vote.save();
          failCount++;
          console.log(`✗ Failed to geo-locate IP: ${vote.ip}`);
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1500));

      } catch (error) {
        console.error(`Error processing vote ${vote._id}:`, error.message);
        failCount++;
      }
    }

    console.log(`Geo-location job completed: ${successCount} successful, ${failCount} failed`);

  } catch (error) {
    console.error('Error in processUnprocessedIPs job:', error);
  }
}

// Setup cron job: Run every 2 minutes
function startGeoLocationCronJob() {
  // Run every 2 minutes: */2 * * * *
  cron.schedule('*/2 * * * *', async () => {
    console.log('Running scheduled geo-location processing...');
    await processUnprocessedIPs();
  });

  console.log('Geo-location cron job started (runs every 2 minutes)');

  // Clear cache every hour to prevent memory buildup
  cron.schedule('0 * * * *', () => {
    geoLocationService.clearCache();
  });

  console.log('Cache clearing cron job started (runs every hour)');
}

// Manual trigger function (useful for testing)
async function manualProcessGeoLocations() {
  await processUnprocessedIPs();
}

module.exports = {
  startGeoLocationCronJob,
  manualProcessGeoLocations
};