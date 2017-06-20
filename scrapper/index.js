const Https = require('https');
const Datastore = require('@google-cloud/datastore')
const QueryString = require('querystring');

const playlistItemsUrl = 'https://www.googleapis.com/youtube/v3/playlistItems?'
const videosUrl = 'https://www.googleapis.com/youtube/v3/videos?'
const apiKey = 'XXX'
const channelId = 'UUdGpd0gNn38UKwoncZd9rmA'
const projectId = 'pirula-time'
const kind = 'time'

const datastore = Datastore({ projectId: projectId })
const averageKey = datastore.key([kind, 'average'])

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
    return item.contentDetails.videoId
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
  let data = {
  }

  let playlistItemsParamsObj = {
    key: apiKey,
    playlistId: channelId,
    maxResults: 50,
    part: 'contentDetails',
    fields: 'items/contentDetails/videoId,nextPageToken,pageInfo'
  }

  let videosDurationParamsObj = {
    key: apiKey,
    part: 'contentDetails',
    fields: 'items/contentDetails/duration'
  }

  let nextPageToken = null
  let totalDuration = 0

  // parse only the first 200 videos
  // 50 per page
  let maxVideos = 200

  const sumVideoInfo = (videoCount = 0) => {
    if (videoCount < maxVideos) {

      return new Promise((resolve, reject) => {
        if (videoCount == 0 || nextPageToken) {
          playlistItemsParamsObj.nextPageToken = nextPageToken
          const playlistItemsParams = QueryString.stringify(playlistItemsParamsObj)
          const videoIdsUrl = `${playlistItemsUrl}${playlistItemsParams}`

          new Promise((resolve, reject) => {
            Https.get(videoIdsUrl, res => {
              res.setEncoding('utf8');
              let rawData = '';
              res.on('data', chunk => rawData += chunk);
              res.on('end', () => resolve(rawData))
            })
          }).then(videoIdsData => {
            new Promise((resolve, reject) => {
              videoIdsData = JSON.parse(videoIdsData)
              nextPageToken = videoIdsData.nextPageToken

              const videoIds = extractVideoIds(videoIdsData)
              videosDurationParamsObj.id = videoIds
              const videosDurationParams = QueryString.stringify(videosDurationParamsObj)
              const videosDurationUrl = `${videosUrl}${videosDurationParams}`

              Https.get(videosDurationUrl, res => {
                res.setEncoding('utf8');
                let rawData = '';
                res.on('data', chunk => rawData += chunk);
                res.on('end', () => resolve(rawData))
              })
            }).then(durationData => {
              durationData = JSON.parse(durationData)
              totalDuration += sumVideoDurations(durationData)
              videoCount += durationData.items.length
              resolve(sumVideoInfo(videoCount))
            })
          })
        }
      })
    } else {
      return videoCount
    }
  }

  sumVideoInfo().then(videoCount => {
    data.average = Math.ceil(totalDuration / videoCount)

    const saveData = {
      key: averageKey,
      data: {
        val: data.average
      }
    }

    datastore.save(saveData)
  })
}

exports.doIt = function doIt(req, res) {
  scrape()
  res.end('scraping')
}

const http = require('http');
const server = http.createServer((req, res) => {
  if (req.url == '/scrape') {
    this.doIt(req, res)
  } else {
    res.end()
  }
});

const hostname = '127.0.0.1';
const port = 3000;
server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
