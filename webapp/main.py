# coding= utf-8

from flask import Flask, render_template, request
from google.appengine.ext import ndb
import httplib
import logging

app = Flask(__name__)

@app.before_request
def enable_local_error_handling():
    app.logger.addHandler(logging.StreamHandler())
    app.logger.setLevel(logging.INFO)

class AggregateData(ndb.Model):
    averageDuration = ndb.IntegerProperty()
    latestDuration = ndb.IntegerProperty()
    latestLikes = ndb.JsonProperty()
    latestDislikes = ndb.JsonProperty()

def getData():
    data = {}

    res = ndb.Key(AggregateData, 'lonelyone').get()

    if (res != None):
        data['latestLikes'] = res.latestLikes
        data['latestDislikes'] = res.latestDislikes
        latestHate = res.latestDislikes[0]
        data['latestHate'] = latestHate

        avgMin, avgSec = res.averageDuration/60, res.averageDuration%60
        data['averageDurationMin'] = avgMin
        data['averageDurationSec'] = avgSec

        latestPirulaDuration = float(res.latestDuration)/res.averageDuration
        data['latestPirulaDuration'] = '{:.2}'.format(latestPirulaDuration)

        if latestPirulaDuration >= 1.5:
            data['latestDurationSubjective'] = 'Hmmm... Delícia!'
        elif latestPirulaDuration >= 1:
            data['latestDurationSubjective'] = 'Bacana!'
        elif latestPirulaDuration >= 0.5:
            data['latestDurationSubjective'] = 'Meero...'
        elif latestPirulaDuration < 0.5:
            if latestPirulaDuration > 0.4:
                data['latestDurationSubjective'] = 'Vamo comer salgadinho?'
            data['latestDurationSubjective'] = 'O que é isso, Ricardo!?...'
        elif latestPirulaDuration <= 0.3:
            data['latestDurationSubjective'] = 'Ai que Burro. Dá zero pra ele'

        if latestHate >= 25000:
            data['latestHateSubjective'] = 'Tá bom! Sou evangélico agora.'
        elif latestHate >= 15000:
            data['latestHateSubjective'] = 'OK OK! A terra é plana. Satifeitos?'
        elif latestHate >= 7000:
            data['latestHateSubjective'] = 'Se segura que lá vem chumbo!'
        elif latestHate >= 5000:
            data['latestHateSubjective'] = 'Ai meu Senhor Jesus...'
        elif latestHate >= 3500:
            data['latestHateSubjective'] = 'O canal é meu, viu!!?'
        elif latestHate >= 1000:
            data['latestHateSubjective'] = 'Haters gonna hate...'
        elif latestHate > 500:
            data['latestHateSubjective'] = 'Acho que ouvi algum zunido...'
        elif latestHate <= 500:
            data['latestHateSubjective'] = 'Nem faz cócegas...'

        latestSixQuality = []
        for i in range(0, 5):
            quality = res.latestLikes > res.latestDislikes
            latestSixQuality.append(quality)

        return data
    else:
        return None

@app.route('/')
def root():
    data = getData()

    if (data != None):
        return render_template('index.html', **data)
    else:
        return 'Oopps. Algum terraplanista tá me sabotando...'

@app.route('/runScrape')
def runScrape():
    conn = httplib.HTTPSConnection('us-central1-pirula-time.cloudfunctions.net')
    conn.request('GET', '/doIt')
    resp = conn.getresponse()
    return resp.read()
