# pirula-time
Measures the average duration of Pirula's videos

This is intended to be run on AWS  
The scraper is a Node.js 6.10 Lambda serverless function  
The webapp is an Flask 0.10.1 Python 3.4 Elastic Beanstalk app

The scraper is called hourly, gathers youtube data from the Google APIs, and stores it on DynamoDB; which is then read by the webapp  
The subjective assessment of each relevant value is determined by the `yaml` files in the subjectives dir

## Contributions/Contribuições
You're welcome to edit the `yaml` files if you have any funny jokes  
Você pode editar os arquivos `yaml` se tiver alguma piada legal

The files can be edited directly on the browser, no need to clone or anything  
Os arquivos podem ser editados usando o navegador, sem precisar clonar nada