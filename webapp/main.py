from flask import Flask, render_template, request
from google.appengine.ext import ndb

app = Flask(__name__)

project_id = "pirula-time"
# datastore = Google::Cloud::Datastore.new project: project_id
# scrapeUri = URI("https://us-central1-pirula-time.cloudfunctions.net/doIt")
class Account(ndb.Model):
    username = ndb.StringProperty()
    userid = ndb.IntegerProperty()
    email = ndb.StringProperty()

@app.route('/')
def root():
    sandy = Account(
        username='Sandy', userid=123, email='sandy@example.com')
    sandy_key = sandy.put()

    # average_entity = ndb.Key(urlsafe='ag1wfnBpcnVsYS10aW1lchELEgR0aW1lIgdhdmVyYWdlDA')

    # average = average_entity.get()
    # # average = [average/60, average%60]

    return sandy_key
    # self.response.write("1 unidade de tempo Pirula equivale a {} minutos e {} segundos".
    #     format(average[0], average[1]))
