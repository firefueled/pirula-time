zip function.zip index.js secrets.js node_modules/ -r
aws lambda update-function-code --function-name pirula-time-scraper --zip-file fileb://function.zip --publish
