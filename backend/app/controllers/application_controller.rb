class ApplicationController < ActionController::API
  # API-only mode strips this by default — the middleware
  # (config.application.rb) makes Set-Cookie/Cookie headers work at the Rack
  # level, but the controller-level `cookies` accessor still needs this.
  include ActionController::Cookies
  include Authentication

  # Also stripped by API-only mode (it's normally wired up for
  # ActionController::Base by ActiveStorage::Engine's on_load hook). Without
  # it, any `#url` call on an attached file — signed download links in
  # DocumentsController and Recruitment::ResumesController alike — raises
  # "Cannot generate URL ... please set ActiveStorage::Current.url_options."
  include ActiveStorage::SetCurrent
end
