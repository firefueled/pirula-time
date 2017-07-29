# pirula-time
Measures the average duration of Pirula's videos

This is intended to be run on ~~Google Cloud~~AWS:
The scrapper as a ~~Cloud~~Lamba Function
The webapp as an ~~App Engine~~Elastic Beanstalk app

The scrapper is called periodically, which gathers the
necessary data and stores it on ~~Datastore~~DynamoDB; which is read by the webapp
