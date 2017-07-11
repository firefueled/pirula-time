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
    val = ndb.IntegerProperty()

def getData():
    data = {}

    key = ndb.Key(AggregateData, 'averageDuration')
    res = key.get()

    if (res != None):
        data['averageDuration'] = res.val
        return data
    else:
        return None

@app.route('/')
def root():
    data = getData()

    if (data != None):
        minutes, seconds = data['averageDuration']/60, data['averageDuration']%60
        return render_template('index.html', {})
    else:
        return 'Oops'

@app.route('/runScrape')
def runScrape():
    conn = httplib.HTTPSConnection('us-central1-pirula-time.cloudfunctions.net')
    conn.request('GET', '/doIt')
    resp = conn.getresponse()
    return resp.read()
