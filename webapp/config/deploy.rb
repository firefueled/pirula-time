# config valid for current version and patch releases of Capistrano
lock "~> 3.11.0"

set :application, "pirula-time"
set :repo_url, "git@github.com:firefueled/pirula-time.git"

# Default branch is :master
# ask :branch, `git rev-parse --abbrev-ref HEAD`.chomp

# Default deploy_to directory is /var/www/my_app_name
set :deploy_to, "/srv/apps/pirula-time"

namespace :deploy do
  after :published, :restart_apache do
    on roles(:all) do
      execute :sudo, "apachectl", "restart"
    end
  end
end