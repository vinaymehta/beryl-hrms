# The API is camelCase end-to-end (see docs/API_CONVENTIONS.md): Alba
# camelizes outbound JSON (config/initializers/alba.rb); this is the inbound
# half, converting request bodies from the frontend's camelCase back to the
# snake_case Rails controllers/params conventionally expect — done once,
# centrally, at the JSON parser itself, rather than per-controller.
ActionDispatch::Request.parameter_parsers[:json] = lambda do |raw_post|
  # Plain JSON.parse, not ActiveSupport::JSON.decode: as of activesupport
  # 8.1.3.1 + json 3.0.0, ActiveSupport::JSON.decode passes an options hash
  # positionally into JSON.parse, which json 3.0's keyword-only signature
  # rejects with an ArgumentError — an upstream incompatibility between
  # those two gem versions, not specific to this code.
  data = JSON.parse(raw_post)
  data = data.deep_transform_keys { |key| key.to_s.underscore } if data.is_a?(Hash) || data.is_a?(Array)
  data.is_a?(Hash) ? data.with_indifferent_access : { _json: data }
end
