const Https = require('https')
const QueryString = require('querystring')
const Secrets = require('./secrets.js')
const Aws = require('aws-sdk')
const Plotly = require('plotly')('firefueled', Secrets.plotlyApiKey);

const playlistItemsUrl = 'https://www.googleapis.com/youtube/v3/playlistItems?'
const videosDataUrl = 'https://www.googleapis.com/youtube/v3/videos?'

const playlistItemsParamsObj = {
  key: Secrets.googleApiKey,
  playlistId: 'UUdGpd0gNn38UKwoncZd9rmA', // uploaded videos playlist
  maxResults: 50,
  part: 'contentDetails',
  fields: 'items/contentDetails/videoId, nextPageToken, pageInfo'
}

const videosDataParamsObj = {
  key: Secrets.googleApiKey,
  part: 'contentDetails, statistics, snippet',
  fields: 'items(contentDetails/duration, id, snippet(title, publishedAt), statistics(dislikeCount, likeCount))'
}

Aws.config.update({region: 'us-east-1'})
const dynamodb = new Aws.DynamoDB.DocumentClient({apiVersion: '2012-08-10'});
const s3 = new Aws.S3()

function getFromAPI(paramsObj, url) {
  const params = QueryString.stringify(paramsObj)
  const finalUrl = `${url}${params}`

  return new Promise((resolve, reject) => {
    Https.get(finalUrl, res => {
      res.setEncoding('utf8');
      let rawData = '';
      res.on('data', chunk => rawData += chunk);
      res.on('end', () => resolve(rawData))
    })
  })
}

const durationRe = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/
function parseDuration(str) {
  const res = durationRe.exec(str).slice(1)
  const seconds = Number.parseInt(res.pop()) || 0
  const minutes = Number.parseInt(res.pop()) || 0
  const hours = Number.parseInt(res.pop()) || 0

  return hours*60*60 + minutes*60 + seconds
}

function extractVideoIds(data) {
  const ids = data.items.map(item => {
    return item.contentDetails.videoId
  })
  return ids.join(',')
}

function gatherLatestData() {
  finalData.latestDuration = parseDuration(videosData[0].contentDetails.duration)
  finalData.latestVideoId = videosData[0].id
  finalData.latestPublishAt = videosData[0].snippet.publishedAt
  finalData.latestHate = videosData[0].statistics.dislikeCount
  finalData.latestVideos = []

  videosData.slice(0, 6).forEach((item, i) => {
    const obj = {
      id: i,
      title: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${item.id}`,
      quality: false,
    }
    const dislikeCount = Number(item.statistics.dislikeCount) || 0
    const likeCount = Number(item.statistics.likeCount) || 0
    obj.quality = likeCount > dislikeCount * 3

    finalData.latestVideos.push(obj)
  })
}

function gatherAverageDuration() {
  let sum = 0
  videosData.forEach(item => {
    sum += parseDuration(item.contentDetails.duration)
  })
  finalData.averageDuration = Math.ceil(sum / videoCount)
}

const finalData = {}
const videosData = []

// parse only the first 200 videos
// 50 per page
const MAX_VIDEOS = 200
let videoCount = 0

function scrape() {
  let nextPageToken = null

  // recursive function that finishes after data from MAX_VIDEOS videos has been gathered
  const getVideoInfo = () => {
    if (videoCount < MAX_VIDEOS) {

      return new Promise((resolve, reject) => {
        if (videoCount == 0 || nextPageToken) {
          playlistItemsParamsObj.pageToken = nextPageToken

          // get video ids from the uploaded playlist
          getFromAPI(playlistItemsParamsObj, playlistItemsUrl)
          .then(videoIdsData => {
            videoIdsData = JSON.parse(videoIdsData)
            nextPageToken = videoIdsData.nextPageToken
            const videoIds = extractVideoIds(videoIdsData)
            videosDataParamsObj.id = videoIds

            // get data from the video ids
            getFromAPI(videosDataParamsObj, videosDataUrl)
            .then(videoData => {
              videoData = JSON.parse(videoData)
              videosData.push(...videoData.items)
              videoCount += videoData.items.length
              resolve(getVideoInfo())
            })
          })
        }
      })
    } else { return }
  }

  getVideoInfo()
  .then(() => {
    videosData.sort((a, b) => a.snippet.publishedAt > b.snippet.publishedAt ? -1 : 1)
    gatherAverageDuration()
    gatherLatestData()
    saveData().then(msg => console.info(msg))
  })
}

function saveData() {
  const now = Math.round(new Date().getTime()/1000)
  const ttl = now + 604800 // 7 days

  const averageData = {
    TableName: 'Data-v2',
    Item: {
      id: 0, timestamp: now,
      latestVideos: finalData.latestVideos,
      latestHate: finalData.latestHate,
      averageDuration: finalData.averageDuration,
      latestDuration: finalData.latestDuration,
      ttl: ttl,
    },
  }

  // save the average data
  dynamodb.put(averageData, (err, res) => {})

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
          if (durationData.Items.length != 0 && finalData.latestVideoId != durationData.Items[0].videoId) {

            createNewGraph(durationData.Items).then(s3Key => {
              const publishTimestamp = Math.round(new Date(finalData.latestPublishAt).getTime()/1000)
              const twoMonthsAhead = now + 5184000
              const newDuration = {
                TableName: 'Duration',
                Item: {
                  id: 0,
                  ttl: twoMonthsAhead,
                  videoId: finalData.latestVideoId,
                  duration: finalData.latestDuration,
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
  yData.push(finalData.latestDuration)
  const max = finalData.averageDuration * 3
  const min = finalData.averageDuration / 3

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
    y: yData.map(x => finalData.averageDuration),
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

      const key = `generated/durationGraph-${finalData.latestVideoId}.jpeg`

      const params = {
        Body: imageStream,
        Bucket: 'pirula-time',
        Key: key,
        CacheControl: 'max-age=31536000',
        ContentType: 'jpeg',
      }

      s3.upload(params, (err, data) => resolve(key))
    })
  })
}

if (process.env['LAMBDA_ENV'] == 'PROD') {
  exports.doIt = function doIt(event, context, callback) {
    scrape()
    callback(null, 'scraping')
  }

} else {
  exports.doIt = function doIt(req, res) {
    scrape()
    res.end('scraping')
  }

  const http = require('http')
  const server = http.createServer((req, res) => {
    if (req.url == '/scrape') {
      this.doIt(req, res)
    } else {
      res.end()
    }
  })

  const hostname = '127.0.0.1'
  const port = 3000
  server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`)
  })
}
