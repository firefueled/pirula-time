const Datastore = require('@google-cloud/datastore')
const projectId = 'pirula-time'
const datastore = Datastore({
  projectId: projectId
})

const kind = 'time'
const averageKey = datastore.key([kind, 'average'])

function scrape() {
  const data = {
    average: 1800,
  }
  return data
}

exports.doIt = function doIt(req, res) {
  console.log("DOIN' IT!")
  const message = req.body.message

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
}