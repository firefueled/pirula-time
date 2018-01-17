# coding= utf-8
from flask import Flask, render_template, request, make_response
import os
import logging
import math
import boto3
from subjectives import *
# import pdb
# pdb.set_trace()

application = Flask(__name__)
dyndb = boto3.resource('dynamodb', 'us-east-1')
dataTb = dyndb.Table('Data-v2')
durationTb = dyndb.Table('Duration')
zeroIdKey = boto3.dynamodb.conditions.Key('id').eq(0)

# Atronomical Unit in m
AU = 149597870700
# light speed in m/s
C = 299792458
# ISS' orbit period in s
ISS_ORBIT_PERIOD = 5480.4
# distance to closest start in ly
CLOSEST_STAR_DISTANCE = 4.22
# seconds in a year
SECONDS_IN_YEAR = 365.4 * 24 * 3600

def retrieveData():
    data = {}

    # average data
    res = dataTb.query(Limit=1,ScanIndexForward=False,KeyConditionExpression=zeroIdKey)
    if len(res['Items']) == 0:
        return None

    data['AverageData'] = res['Items'][0]

    # duration data
    res = durationTb.query(Limit=1,ScanIndexForward=False,KeyConditionExpression=zeroIdKey)
    if len(res['Items']) == 0:
        return None

    data['DurationData'] = res['Items'][0]

    return data

def processData(dbData):
    data = { 'latestVideos': [], 'unknownFacts': {} }

    for item in dbData['AverageData']['latestVideos']:
        item['id'] = int(item['id'])
        if item['quality']:
            item['imageSrc'] = 'https://d39f8y0nq8jhd8.cloudfront.net/images/pirula-yes.png'
        else:
            item['imageSrc'] = 'https://d39f8y0nq8jhd8.cloudfront.net/images/pirula-no.png'
        data['latestVideos'].append(item)

    data['averageDuration'] = int(dbData['AverageData']['averageDuration'])
    data['latestDuration'] = int(dbData['AverageData']['latestDuration'])
    data['latestHate'] = int(dbData['AverageData']['latestHate'])

    pirulaUnit = data['averageDuration']
    avgMin, avgSec = divmod(pirulaUnit, 60)
    data['averageDurationMin'], data['averageDurationSec'] = avgMin, avgSec


    latestPirulaDuration = float(data['latestDuration'])/pirulaUnit
    latestHate = data['latestHate']

    if latestHate == -1:
        data['latestHate'] = '???'

    data['latestPirulaDuration'] = '{:.2}'.format(latestPirulaDuration).replace(',','.')
    data['latestDurationSubjective'] = getDurationSubjective(latestPirulaDuration)
    data['latestHateSubjective'] = getHateSubjective(latestHate)

    data['durationGraphUrl'] = dbData['DurationData']['graphUrl']

    # Fatos Desconhecidos
    lightPirula = int(pirulaUnit * C / 1000  ** 2)
    pirulaSun2Earth = AU / C / pirulaUnit
    pirulaISSOrbit = ISS_ORBIT_PERIOD / pirulaUnit
    pirulaClosestStar = (SECONDS_IN_YEAR / pirulaUnit) * CLOSEST_STAR_DISTANCE

    data['unknownFacts']['lightPirula'] = '{:,}'.format(lightPirula).replace(',','.')
    data['unknownFacts']['pirulaClosestStar'] = '{:,.5g}'.format(pirulaClosestStar).replace(',','.')
    data['unknownFacts']['pirulaSunToEarth'] = '{:.2}'.format(pirulaSun2Earth).replace(',','.')
    data['unknownFacts']['pirulaISSOrbit'] = '{:.2}'.format(pirulaISSOrbit).replace(',','.')

    return data

def getData():
    data = retrieveData()
    processedData = processData(data)
    return processedData

@application.route('/')
def root():
    data = getData()
    resp = None

    if (data != None):
        resp = make_response(render_template('index.html', **data), 200)
    else:
        resp = make_response('Opa! Algum terraplanista tá me sabotando...', 200)

    resp.headers['Cache-Control'] = 'max-age=1800'
    return resp

@application.route('/health')
def health():
    return "cOF COF... I'm OK doc Cof..."

# run the application.
if __name__ == "__main__":
    application.debug = os.getenv('ENV') != 'PROD'
    application.run()