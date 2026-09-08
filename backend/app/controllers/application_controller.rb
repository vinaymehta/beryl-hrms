class ApplicationController < ActionController::API
  # API-only mode strips this by default — the middleware
  # (config.application.rb) makes Set-Cookie/Cookie headers work at the Rack
  # level, but the controller-level `cookies` accessor still needs this.
  include ActionController::Cookies
  include Authentication
end
