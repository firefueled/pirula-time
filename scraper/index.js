const Https = require('https')
const QueryString = require('querystring')
const Secrets = require('./secrets.js')
const Aws = require('aws-sdk')
const Plotly = require('plotly')('firefueled', Secrets.plotlyApiKey);

const playlistItemsUrl = 'https://www.googleapis.com/youtube/v3/playlistItems?'
const videosUrl = 'https://www.googleapis.com/youtube/v3/videos?'
const channelId = 'UUdGpd0gNn38UKwoncZd9rmA'

Aws.config.update({region: 'sa-east-1'})
const dynamodb = new Aws.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});
const data = {}

const durationRe = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/
function parseDuration(str) {
  const data = durationRe.exec(str).slice(1)
  seconds = Number.parseInt(data.pop()) || 0
  minutes = Number.parseInt(data.pop()) || 0
  hours = Number.parseInt(data.pop()) || 0

  return hours*60*60 + minutes*60 + seconds
}

function extractVideoIds(data) {
  const ids = data.items.map(item => {
    return item.contentDetails.videoId
  })
  return ids.join(',')
}

function gatherLatestData(videoData) {
  data.latestDuration = parseDuration(videoData.items[0].contentDetails.duration).toString()
  data.latestVideoId = videoData.items[0].id
  data.latestPublishAt = videoData.items[0].snippet.publishedAt
  data.latestHate = videoData.items[0].statistics.dislikeCount
  data.latestVideos = []

  videoData.items.slice(0, 6).forEach((item, i) => {
    obj = {
      'id': i,
      'title': item.snippet.title,
      'url': `https://www.youtube.com/watch?v=${item.id}`
    }
    dislikeCount = Number(item.statistics.dislikeCount) || 0
    likeCount = Number(item.statistics.likeCount) || 0
    obj['quality'] = likeCount > dislikeCount*3

    data.latestVideos.push(obj)
  })
}

function sumVideoDurations(data) {
  let sum = 0
  data.items.forEach(item => {
    sum += parseDuration(item.contentDetails.duration)
  })
  return sum
}

function scrape() {

  let playlistItemsParamsObj = {
    key: Secrets.googleApiKey,
    playlistId: channelId,
    maxResults: 50,
    part: 'contentDetails',
    fields: 'items/contentDetails/videoId, nextPageToken, pageInfo'
  }

  let videosDurationParamsObj = {
    key: Secrets.googleApiKey,
    part: 'contentDetails, statistics, snippet',
    fields: 'items(contentDetails/duration, id, snippet(title, publishedAt), statistics(dislikeCount, likeCount))'
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
          playlistItemsParamsObj.pageToken = nextPageToken
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
            }).then(videoData => {
              videoData = JSON.parse(videoData)
              totalDuration += sumVideoDurations(videoData)

              // latest data is available on the first page
              if (videoCount == 0) {
                gatherLatestData(videoData)
              }

              videoCount += videoData.items.length
              resolve(sumVideoInfo(videoCount))
            })
          })
        }
      })
    } else {
      return videoCount
    }
  }

  sumVideoInfo().then(videoCount => handleData(Math.ceil(totalDuration / videoCount).toString()))
}

function handleData(averageDuration) {
  data.averageDuration = averageDuration
  const now = Math.round(new Date().getTime()/1000)
  const ttl = now + 604800 // 7 days

  const averageData = {
    TableName: 'Data',
    Item: {
      id: 0, timestamp: now,
      latestVideos: data.latestVideos,
      latestHate: data.latestHate,
      averageDuration: data.averageDuration,
      latestDuration: data.latestDuration,
      ttl: ttl,
    },
  }

  // save the average data
  dynamodb.put(averageData, function(err, res) {});

  // query the saved durations
  new Promise((resolve, reject) => {
    const params = {
      TableName: 'Duration',
      Limit: 15,
      ScanIndexForward: false,
      KeyConditionExpression: 'id = :zero',
      ExpressionAttributeValues: { ':zero': 0, },
    }
    dynamodb.query(params, (err, res) => {
      if (err) reject(err)
      else resolve(res.Items)
    })
  }).then(durationData => {

    // update graph if there's a new video
    if (durationData.length == 0 || data.latestVideoId != durationData[0].videoId) {
      createNewGraph(durationData)
      .then(url => {
        const publishTimestamp = Math.round(new Date(data.latestPublishAt).getTime()/1000)
        const twoMonthsAhead = now + 5184000
        const newDuration = {
          TableName: 'Duration',
          Item: {
            id: 0,
            videoId: data.latestVideoId,
            duration: data.latestDuration,
            timestamp: publishTimestamp,
            graphUrl: url, ttl: twoMonthsAhead,
          }
        }
        dynamodb.put(newDuration, (err, res) => {})
      })
    }
  })
}

function createNewGraph(graphData) {
  yData = graphData.map(item => { return item.duration })
  yData.reverse()
  yData.push(Number(data.latestDuration))
  max = Number(data.averageDuration) * 3
  min = Number(data.averageDuration) / 3

  const trace1 = {
    y: yData,
    line: {
      color: 'rgb(68, 68, 68)',
      shape: 'spline'
    },
    mode: 'lines',
    type: 'scatter',
  }
  layout = {
    autosize: false,
    width: 500,
    height: 50,
    margin: { l: 0, r: 0, b: 0, t: 0, pad: 0 },
    xaxis: {
      showgrid: false,
      zeroline: false,
      showline: false,
      showticklabels: false
    },
    yaxis: {
      autorange: false,
      showgrid: false,
      zeroline: false,
      showline: false,
      showticklabels: false,
      range: [min, max],
    },
  }
  var graphOptions = { layout: layout, fileopt: "overwrite" }
  return new Promise((resolve, reject) => {
    Plotly.plot([trace1], graphOptions, (err, msg) => {
      if (err) reject(err)
      else resolve(msg.url + '.jpeg')
    })
  })
}

// exports.doIt = function doIt(req, res) {
exports.doIt = function doIt(event, context, callback) {
  scrape()
  callback(null, 'scraping')
  // res.end('scraping')
}

// const http = require('http');
// const server = http.createServer((req, res) => {
//   if (req.url == '/scrape') {
//     this.doIt(req, res)
//   } else {
//     res.end()
//   }
// });

// const hostname = '127.0.0.1';
// const port = 3000;
// server.listen(port, hostname, () => {
//   console.log(`Server running at http://${hostname}:${port}/`);
// });
