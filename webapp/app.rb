require "sinatra"
require "google/cloud/datastore"

before do
  @@project_id = "pirula-time"
end

get "/" do
  datastore = Google::Cloud::Datastore.new project: @@project_id

  average = datastore.find('time', 'average')['val']
  average = Time.at(average).strftime "%M:%S"

  "O tempo médio do Pirula é #{average}"
end
