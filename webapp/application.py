# coding= utf-8
from flask import Flask, render_template, request
import httplib
import logging
import math
import boto3
# import pdb
# pdb.set_trace()

application = Flask(__name__)
dyndb = boto3.resource('dynamodb', 'sa-east-1')
dataTb = dyndb.Table('Data')
dataKey = boto3.dynamodb.conditions.Key('id').eq(0)

def retrieveLatest():
    data = {'latestDislikes': [], 'latestLikes': []}
    res = dataTb.query(Limit=1,ScanIndexForward=False,KeyConditionExpression=dataKey)
    if len(res['Items']) == 0:
        return None

    res = res['Items'][0]
    for item in res['latestDislikes'].split(';'):
        if math.isnan(float(item)):
            data['latestDislikes'].append(-1)
        else:
            data['latestDislikes'].append(int(item))
    for item in res['latestLikes'].split(';'):
        if math.isnan(float(item)):
            data['latestLikes'].append(-1)
        else:
            data['latestLikes'].append(int(item))
    data['averageDuration'] = int(res['averageDuration'])
    data['latestDuration'] = int(res['latestDuration'])
    return data


def getData():
    data = retrieveLatest()

    if (data != None):
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

        latestHate = data['latestDislikes'][0]
        if latestHate == -1:
            data['latestHate'] = u'???'
            data['latestHateSubjective'] = u'IIIhh Deu pra trás...'
        else:
            data['latestHate'] = latestHate
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

        latestSixQuality = []
        for i in range(0, 6):
            quality = data['latestLikes'][i] >= data['latestDislikes'][i]*3
            latestSixQuality.append(quality)

        data['latestSixQuality'] = latestSixQuality

        return data
    else:
        return None

@application.route('/')
def root():
    data = getData()

    if (data != None):
        return render_template('index.html', **data)
    else:
        return u'Oopps. Algum terraplanista tá me sabotando...'

# run the application.
if __name__ == "__main__":
    # application.debug = True
    application.run()