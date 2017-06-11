const http = require('http');

const hostname = '127.0.0.1';
const port = 3000;

const Datastore = require('@google-cloud/datastore')
const QueryString = require('querystring');
const Net = require('net')

const projectId = 'pirula-time'
const datastore = Datastore({ projectId: projectId })
const kind = 'time'
const averageKey = datastore.key([kind, 'average'])

const channelId = 'UUdGpd0gNn38UKwoncZd9rmA'
const apiKey = "XXX"

const playlistItemsUrl = 'https://www.googleapis.com/youtube/v3/playlistItems?'
const videosUrl = 'https://www.googleapis.com/youtube/v3/videos?'

const durationRe = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/
function parseDuration(str) {
  const data = durationRe.exec(str).slice(1)
  seconds = Number.parseInt(data.pop()) || 0
  minutes = Number.parseInt(data.pop()) || 0
  hours = Number.parseInt(data.pop()) || 0

  return hours*60*60 + minutes*60 + seconds
}

function extractVideoIds(data) {
  ids = data.items.map(item => {
    return contentDetails.videoId
  })
  return ids.join(',')
}

function sumVideoDurations(data) {
  sum = 0
  data.items.forEach(item => {
    sum += parseDuration(item.contentDetails.duration)
  })
  return sum
}

function scrape() {
  const data = {
    average: 2000
  }

  playlistItemsParamsObj = {
    key: apiKey,
    playlistId: channelId,
    maxResults: 50,
    part: 'contentDetails',
    fields: 'items/contentDetails/videoId,nextPageToken,pageInfo'
  }

  videosDurationParamsObj = {
    key: apiKey,
    part: 'contentDetails',
    fields: 'items/contentDetails/duration'
  }

  nextPageToken = null

  Promise.all(
    // parse only the first 200 videos
    [0, 1, 2, 3].forEach(i => {
      if (i == 0 || nextPageToken) {
        playlistItemsParamsObj.nextPageToken = nextPageToken
        const playlistItemsParams = QueryString.stringify(playlistItemsParamsObj)

        const videoIdsUrl = `${playlistItemsUrl}${playlistItemsParams}`

        client = Net.connect(videoIdsUrl)
        client.on('data', videoIdsData => {
          if (videoIdsData) {
            console.log(videoIdsData)
            videoIdsData = JSON.parse(videoIdsData)
            nextPageToken = videoIdsData.nextPageToken

            const videoIds = extractVideoIds(videoIdsData)

            const videosDurationParams = QueryString.stringify(videosDurationParamsObj)
            videosDurationParamsObj.id = videoIds

            const videosDurationUrl = `${videosUrl}${videosDurationParams}`

            Promise.all(Net.connect(videosDurationUrl).on('data', durationData => {
              if (durationData) {
                durationData = JSON.parse(durationData)
                data.average += sumVideoDurations(durationData)
              }
            }))
          }
        })
        client.on('end', () => {
        })
      }
    })
  )

  return data
}

exports.doIt = function doIt(req, res) {
  const data = scrape()

  const saveData = {
    key: averageKey,
    data: {
      val: data.average
    }
  }

  datastore.save(saveData)
    .then(() => {
      res.status(200).send(`Saved ${JSON.stringify(saveData)}`)
    })
    .catch((err) => {
      res.status(500).send('Error: ' + err.toString())
    })
  res.end("Done now\n")
}

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  this.doIt(req, res)
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});