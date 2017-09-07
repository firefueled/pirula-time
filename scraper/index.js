const Https = require('https')
const QueryString = require('querystring')
const Secrets = require('./secrets.js')
const Aws = require('aws-sdk')
const Plotly = require('plotly')('firefueled', Secrets.plotlyApiKey);

const playlistItemsUrl = 'https://www.googleapis.com/youtube/v3/playlistItems?'
const videosUrl = 'https://www.googleapis.com/youtube/v3/videos?'
const playlistId = 'UUdGpd0gNn38UKwoncZd9rmA'

Aws.config.update({region: 'us-east-1'})
const dynamodb = new Aws.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});
const s3 = new Aws.S3()
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
    const obj = {
      'id': i,
      'title': item.snippet.title,
      'url': `https://www.youtube.com/watch?v=${item.id}`
    }
    const dislikeCount = Number(item.statistics.dislikeCount) || 0
    const likeCount = Number(item.statistics.likeCount) || 0
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

  const playlistItemsParamsObj = {
    key: Secrets.googleApiKey,
    playlistId: playlistId,
    maxResults: 50,
    part: 'contentDetails',
    fields: 'items/contentDetails/videoId, nextPageToken, pageInfo'
  }

  const videosDurationParamsObj = {
    key: Secrets.googleApiKey,
    part: 'contentDetails, statistics, snippet',
    fields: 'items(contentDetails/duration, id, snippet(title, publishedAt), statistics(dislikeCount, likeCount))'
  }

  let nextPageToken = null
  let totalDuration = 0

  // parse only the first 200 videos
  // 50 per page
  const maxVideos = 200

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

  sumVideoInfo()
  .then(videoCount => {
    const averageDuration = Math.ceil(totalDuration / videoCount).toString()
    saveData(averageDuration)
    .then(msg => {
      console.info(msg)
    })
  })
}

function saveData(averageDuration) {
  data.averageDuration = averageDuration
  const now = Math.round(new Date().getTime()/1000)
  const ttl = now + 604800 // 7 days

  const averageData = {
    TableName: 'Data-v2',
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
  return new Promise(resolve => {
    const params = {
      TableName: 'Duration',
      Limit: 15,
      ScanIndexForward: false,
      KeyConditionExpression: 'id = :zero',
      ExpressionAttributeValues: { ':zero': 0, },
    }
    dynamodb.query(params, (err, durationData) => {
      if (err) resolve("done. couldn't query Duration")
      else {
        // update graph if this is a new video
        new Promise(resolve => {
          if (durationData.Items.length != 0 && data.latestVideoId != durationData.Items[0].videoId) {

            createNewGraph(durationData.Items).then(s3Key => {
              const publishTimestamp = Math.round(new Date(data.latestPublishAt).getTime()/1000)
              const twoMonthsAhead = now + 5184000
              const newDuration = {
                TableName: 'Duration',
                Item: {
                  id: 0,
                  ttl: twoMonthsAhead,
                  videoId: data.latestVideoId,
                  duration: data.latestDuration,
                  timestamp: publishTimestamp,
                  graphUrl: `https://d39f8y0nq8jhd8.cloudfront.net/${s3Key}`,
                }
              }
              dynamodb.put(newDuration, (err, res) => resolve('done. saved new graph'))
            })
          } else { resolve('done. no new graph') }
        }).then(msg => resolve(msg))
      }
    })
  })
}

function createNewGraph(graphData) {
  const yData = graphData.map(x => { return x.duration })
  yData.reverse()
  yData.push(Number(data.latestDuration))
  const max = Number(data.averageDuration) * 3
  const min = Number(data.averageDuration) / 3

  const trace = {
    y: yData,
    line: {
      color: 'rgb(68, 68, 68)',
      shape: 'spline'
    },
    mode: 'lines',
    type: 'scatter',
  }

  const avgTrace = {
    y: yData.map(x => Number(data.averageDuration)),
    line: {
      color: 'rgb(44, 160, 44, 0.7)',
      shape: 'spline',
      width: 1,
    },
    mode: 'lines',
    type: 'scatter',
  }

  const layout = {
    autosize: false,
    margin: { l: 0, r: 0, b: 0, t: 0, pad: 0 },
    showlegend: false,
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

  const figure = { data: [avgTrace, trace], layout: layout }

  const imgOpts = {
    format: 'jpeg',
    width: 500,
    height: 50
  }

  return new Promise(resolve => {
    Plotly.getImage(figure, imgOpts, (error, imageStream) => {
      if (error) return console.log (error)

      const key = `generated/durationGraph-${data.latestVideoId}.jpeg`

      const params = {
        Body: imageStream,
        Bucket: 'pirula-time',
        Key: key,
        CacheControl: '1800',
        ContentType: 'jpeg',
      }

      s3.upload(params, (err, data) => resolve(key))
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
