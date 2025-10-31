import { google } from 'googleapis';

export async function POST(request) {
  const authHeader = request.headers.get('authorization');

  if (authHeader !== `Bearer ${process.env.CRON_AUTH_TOKEN}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { urls } = await request.json(); // Get URLs from the request body

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return Response.json({ error: 'No URLs provided for indexing.' }, { status: 400 });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/indexing'], // Use Indexing API scope
    });

    const authClient = await auth.getClient();
    google.options({ auth: authClient });

    const indexing = google.indexing('v3');

    const notifications = urls.map(url => ({
      url: url,
      type: 'URL_UPDATED',
    }));

    const batchSize = 100; // Max 100 notifications per batch
    const batchResults = [];

    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      const currentBatchIndividualResults = []; // To store results for each URL in the current batch
      let batchOverallSuccess = true;

      for (const notification of batch) {
        try {
          const response = await indexing.urlNotifications.publish({
            requestBody: notification, // publish expects a single UrlNotification object
          });
          currentBatchIndividualResults.push({ url: notification.url, success: true, data: response.data });
        } catch (publishError) {
          console.error(`Failed to publish URL ${notification.url}:`, publishError.message);
          currentBatchIndividualResults.push({ url: notification.url, success: false, error: publishError.message });
          batchOverallSuccess = false; // Mark the batch as having failures
        }
      }

      if (batchOverallSuccess) {
        console.log(`Successfully submitted a batch of ${batch.length} URLs for indexing.`);
      } else {
        console.error(`Some URLs in a batch of ${batch.length} failed to submit for indexing.`);
      }
      batchResults.push({
        batchSize: batch.length,
        overallSuccess: batchOverallSuccess,
        individualResults: currentBatchIndividualResults,
      });
    }

    return Response.json({ success: true, message: 'URLs submitted to Google Indexing API in batches.', results: batchResults });
  } catch (error) {
    console.error('Error processing indexing request:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}