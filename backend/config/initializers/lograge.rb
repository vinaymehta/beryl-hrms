Rails.application.configure do
  config.lograge.enabled = true
  config.lograge.formatter = Lograge::Formatters::Json.new

  config.lograge.custom_options = lambda do |event|
    {
      company_id: event.payload[:company_id],
      user_id: event.payload[:user_id],
      request_id: event.payload[:request_id]
    }.compact
  end
end
