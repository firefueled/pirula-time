# coding= utf-8
from flask import Flask, render_template, request
from google.appengine.ext import ndb
import httplib
import logging
import math
# import pdb
# pdb.set_trace()

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

        avgMin, avgSec = res.averageDuration/60, res.averageDuration%60
        data['averageDurationMin'] = avgMin
        data['averageDurationSec'] = avgSec

        latestPirulaDuration = float(res.latestDuration)/res.averageDuration
        data['latestPirulaDuration'] = '{:.2}'.format(latestPirulaDuration)

        if latestPirulaDuration >= 1.5:
            data['latestDurationSubjective'] = u'Hmmm... Delícia!'
        elif latestPirulaDuration >= 1:
            data['latestDurationSubjective'] = u'Bacana!'
        elif latestPirulaDuration >= 0.5:
            data['latestDurationSubjective'] = u'Meero...'
        elif latestPirulaDuration < 0.5:
            if latestPirulaDuration >= 0.4:
                data['latestDurationSubjective'] = u'Vamo comer salgadinho?'
            data['latestDurationSubjective'] = u'O que é isso, Ricardo!?...'
        elif latestPirulaDuration <= 0.3:
            data['latestDurationSubjective'] = u'Ai que Burro. Dá zero pra ele'

        latestHate = res.latestDislikes[0]
        if math.isnan(latestHate):
            data['latestHate'] = u'???'
            data['latestHateSubjective'] = u'IIIhh Deu pra tráz...'
        else:
            data['latestHate'] = latestHate
            if latestHate >= 25000:
                data['latestHateSubjective'] = u'Tá bom! Sou evangélico agora.'
            elif latestHate >= 15000:
                data['latestHateSubjective'] = u'OK OK! A terra é plana. Satifeitos?'
            elif latestHate >= 7000:
                data['latestHateSubjective'] = u'Se segura que lá vem chumbo!'
            elif latestHate >= 5000:
                data['latestHateSubjective'] = u'Ai meu Senhor Jesus...'
            elif latestHate >= 3500:
                data['latestHateSubjective'] = u'O canal é meu, viu!!?'
            elif latestHate >= 1000:
                data['latestHateSubjective'] = u'Haters gonna hate...'
            elif latestHate > 500:
                data['latestHateSubjective'] = u'Acho que ouvi algum zunido...'
            elif latestHate <= 500:
                data['latestHateSubjective'] = u'Nem faz cócegas...'

        latestSixQuality = []
        for i in range(0, 6):
            quality = res.latestLikes[i] > res.latestDislikes[i]
            latestSixQuality.append(quality)

        data['latestSixQuality'] = latestSixQuality

        return data
    else:
        return None

@app.route('/')
def root():
    # nan = float('nan')
    # AggregateData(id='lonelyone',averageDuration = 1500, latestDuration = 1500, latestLikes = [nan, 211,211,251,121,4221], latestDislikes =[22,2031,210,2311,nan,215] ).put()

    data = getData()

    if (data != None):
        return render_template('index.html', **data)
    else:
        return u'Oopps. Algum terraplanista tá me sabotando...'

@app.route('/runScrape')
def runScrape():
    conn = httplib.HTTPSConnection('us-central1-pirula-time.cloudfunctions.net')
    conn.request('GET', '/doIt')
    resp = conn.getresponse()
    return resp.read()
