from flask import Flask, render_template, request
from google.appengine.ext import ndb
from httplib import HTTPSConnection
import logging

app = Flask(__name__)

@app.before_request
def enable_local_error_handling():
    app.logger.addHandler(logging.StreamHandler())
    app.logger.setLevel(logging.INFO)

class AggregateData(ndb.Model):
    val = ndb.IntegerProperty()

def getData():
    data = {}

    key = ndb.Key(AggregateData, 'averageDuration')
    res = key.get()

    data['averageDuration'] = res.val
    return data

@app.route('/')
def root():
    data = getData()
    minutes, seconds = data['averageDuration']/60, data['averageDuration']%60

    return 'Um Pirula equivale a {} minutos e {} segundos\n'.format(minutes, seconds)

# @app.route('/runScrape')
# def runScrape():
#     conn = HTTPSConnection('us-central1-pirula-time.cloudfunctions.net')
#     conn.request('GET', '/doIt')
#     resp = conn.getresponse()
#     return resp.status
