// Imports the Google Cloud client library
const Datastore = require('@google-cloud/datastore')

// Your Google Cloud Platform project ID
const projectId = 'pirula-time'

// Instantiates a client
const datastore = Datastore({
  projectId: projectId
})

// The kind for the new entity
const kind = 'time'
// The name/ID for the new entity
const name = 'average'
// The Cloud Datastore key for the new entity
const key = datastore.key([kind, name])

function scrape() {
  const data = {
    average: 3200,
  }
  return data
}

/**
 * Triggered from a message on a Cloud Pub/Sub topic.
 *
 * @param {!Object} event The Cloud Functions event.
 * @param {!Function} The callback function.
 */
exports.subscribe = function subscribe(event, callback) {
  console.log("START")
  // The Cloud Pub/Sub Message object.
  const pubsubMessage = event.data

  const data = scrape()

  // Prepares the new entity
  const average = {
    key: key,
    data: {
      val: data.average
    }
  }

  // Saves the entity
  datastore.save(average)
    .then(() => {
      console.log(`Saved ${average.key.name}: ${average.data}`)
    })
    .catch((err) => {
      console.error('ERROR:', err)
    })

  // Don't forget to call the callback.
  callback()
};