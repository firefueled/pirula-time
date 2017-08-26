# coding= utf-8
from flask import Flask, render_template, request, make_response
import httplib
import logging
import math
import boto3
# import pdb
# pdb.set_trace()

application = Flask(__name__)
dyndb = boto3.resource('dynamodb', 'sa-east-1')
dataTb = dyndb.Table('Data-v2')
durationTb = dyndb.Table('Duration')
zeroIdKey = boto3.dynamodb.conditions.Key('id').eq(0)

def retrieveLatest():
    data = { 'latestVideos': [] }

    # average data
    res = dataTb.query(Limit=1,ScanIndexForward=False,KeyConditionExpression=zeroIdKey)
    if len(res['Items']) == 0:
        return None

    res = res['Items'][0]

    for item in res['latestVideos']:
        item['id'] = int(item['id'])
        if item['quality']:
            item['imageSrc'] = '/static/images/pirula-yes.png'
        else:
            item['imageSrc'] = '/static/images/pirula-no.png'
        data['latestVideos'].append(item)


    data['averageDuration'] = int(res['averageDuration'])
    data['latestDuration'] = int(res['latestDuration'])
    data['latestHate'] = int(res['latestHate'])

    # duration data
    res = durationTb.query(Limit=1,ScanIndexForward=False,KeyConditionExpression=zeroIdKey)
    if len(res['Items']) != 0:
        data['durationGraphUrl'] = res['Items'][0]['graphUrl']

    return data

def processData(data):
    avgMin, avgSec = data['averageDuration']/60, data['averageDuration']%60
    data['averageDurationMin'] = avgMin
    data['averageDurationSec'] = avgSec

    latestPirulaDuration = float(data['latestDuration'])/data['averageDuration']
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

    latestHate = data['latestHate']
    if latestHate == -1:
        data['latestHate'] = u'???'
        data['latestHateSubjective'] = u'IIIhh Deu pra trás...'
    else:
        if latestHate >= 25000:
            data['latestHateSubjective'] = u'Tá bom! Sou evangélico agora.'
        elif latestHate >= 15000:
            data['latestHateSubjective'] = u'OK OK! A terra é plana. Satifeitos?'
        elif latestHate >= 7000:
            data['latestHateSubjective'] = u'Se segura que lá vem chumbo!'
        elif latestHate >= 4500:
            data['latestHateSubjective'] = u'Ai meu Senhor Jesus...'
        elif latestHate >= 3000:
            data['latestHateSubjective'] = u'O canal é meu, viu!!?'
        elif latestHate >= 1000:
            data['latestHateSubjective'] = u'Haters gonna hate...'
        elif latestHate > 500:
            data['latestHateSubjective'] = u'Acho que ouvi algum zunido...'
        elif latestHate <= 500:
            data['latestHateSubjective'] = u'Nem faz cócegas...'

    return data

def getData():
    data = retrieveLatest()

    if (data != None):
        return processData(data)
    else:
        return None

@application.route('/')
def root():
    data = getData()
    resp = None

    if (data != None):
        resp = make_response(render_template('index.html', **data), 200)
    else:
        resp = make_response(u'Oopps. Algum terraplanista tá me sabotando...', 200)

    resp.headers['Cache-Control'] = 'max-age=1800'
    return resp

@application.route('/health')
def health():
    return u"cOF COF... I'm OK doc Cof..."

# run the application.
if __name__ == "__main__":
    application.debug = True
    application.run()