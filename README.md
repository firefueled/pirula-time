# pirula-time
Measures the average duration of Pirula's videos

This is intended to be run on Google Cloud:
The scrapper as a Cloud Function
The webapp as an App Engine app

The scrapper is called periodically by an App Engine cron thingie, which gathers the
necessary data and stores it on Datastore; which is read by the webapp
