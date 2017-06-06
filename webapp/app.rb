require 'uri'
require "sinatra"
require 'net/http'
require "google/cloud/datastore"

project_id = "pirula-time"
datastore = Google::Cloud::Datastore.new project: project_id
scrapeUri = URI("https://us-central1-pirula-time.cloudfunctions.net/doIt")

get "/" do
  average = datastore.find('time', 'average')['val']
  average = [average/60, average%60]

  "1 unidade de tempo Pirula equivale a #{average[0]} minutos e #{average[1]} segundos"
end

get "/runScrape" do
  Net::HTTP.get(scrapeUri)
end
